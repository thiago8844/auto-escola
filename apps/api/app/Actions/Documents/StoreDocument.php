<?php

namespace App\Actions\Documents;

use App\Enums\DocumentStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Document;
use App\Models\Organization;
use App\Models\PracticalExam;
use App\Models\QualificationProcess;
use App\Services\Audit;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Guarda o arquivo em disco privado com nome aleatório e registra os metadados.
 *
 * Substituição: informar `replaces_document_id` cria a próxima versão e marca a anterior
 * como "replaced"; o histórico permanece. Anexar um arquivo NÃO conclui nenhuma etapa.
 */
class StoreDocument
{
    public function __construct(private readonly Audit $audit) {}

    /**
     * @param  array<string, mixed>  $data  Metadados validados (sem o arquivo).
     */
    public function __invoke(Organization $organization, User $user, UploadedFile $file, array $data): Document
    {
        $disk = Storage::disk(config('autoescola.documents_disk'));

        // Exame informado: processo e aluno vêm da tentativa.
        if (! empty($data['practical_exam_id'])) {
            $exam = PracticalExam::query()->where('organization_id', $organization->getKey())->findOrFail($data['practical_exam_id']);
            $data['qualification_process_id'] ??= $exam->qualification_process_id;
            $data['student_id'] ??= $exam->student_id;
        }

        // Titular derivado do processo quando só ele foi informado.
        if (! empty($data['qualification_process_id']) && empty($data['student_id'])) {
            $data['student_id'] = QualificationProcess::query()
                ->whereKey($data['qualification_process_id'])->value('student_id');
        }

        $path = $disk->putFileAs(
            "organizations/{$organization->getKey()}/documents",
            $file,
            Str::uuid()->toString().'.'.($file->guessExtension() ?: 'bin'),
        );

        if ($path === false) {
            throw new BusinessRuleException('Não foi possível guardar o arquivo.', 'storage_failed', 500);
        }

        try {
            return DB::transaction(function () use ($organization, $user, $file, $data, $path) {
                $version = 1;

                if (! empty($data['replaces_document_id'])) {
                    $previous = Document::query()
                        ->where('organization_id', $organization->getKey())
                        ->whereKey($data['replaces_document_id'])
                        ->lockForUpdate()
                        ->firstOrFail();

                    $this->assertReplaceable($previous, $data);

                    $previous->forceFill(['status' => DocumentStatus::Replaced])->save();
                    $version = $previous->version + 1;
                }

                $document = Document::create($data + [
                    'organization_id' => $organization->getKey(),
                    'status' => DocumentStatus::Attached,
                    'version' => $version,
                    'storage_path' => $path,
                    'original_name' => Str::limit($file->getClientOriginalName(), 250, ''),
                    'mime_type' => $file->getMimeType() ?? 'application/octet-stream',
                    'size' => $file->getSize(),
                    'uploaded_by' => $user->getKey(),
                ]);

                $this->audit->record($organization->getKey(), 'document.attached', "Documento anexado: {$document->type->value} (v{$version}).", [
                    'student_id' => $document->student_id,
                    'process_id' => $document->qualification_process_id,
                    'subject' => $document,
                ]);

                return $document;
            });
        } catch (\Throwable $e) {
            $disk->delete($path);

            throw $e;
        }
    }

    /**
     * Só se substitui a versão vigente, do mesmo tipo e do mesmo titular.
     *
     * @param  array<string, mixed>  $data
     */
    private function assertReplaceable(Document $previous, array $data): void
    {
        // Formulários multipart chegam como texto: normaliza antes de comparar.
        $id = fn (string $key) => isset($data[$key]) ? (int) $data[$key] : null;

        $sameOwner = $previous->student_id === $id('student_id')
            && $previous->qualification_process_id === $id('qualification_process_id')
            && $previous->vehicle_id === $id('vehicle_id')
            && $previous->practical_exam_id === $id('practical_exam_id')
            && $previous->finance_entry_id === $id('finance_entry_id')
            && $previous->finance_payment_id === $id('finance_payment_id');

        if ($previous->status === DocumentStatus::Replaced
            || $previous->type->value !== $data['type']
            || ! $sameOwner) {
            throw new BusinessRuleException(
                'Só é possível substituir a versão vigente de um documento do mesmo tipo e titular.',
                'document_not_replaceable',
                422,
            );
        }
    }
}
