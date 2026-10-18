<?php

namespace App\Actions\Processes;

use App\Enums\ExamStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\ProcessCategoryTrack;
use App\Models\QualificationProcess;
use App\Services\Audit;
use App\Services\ProcessOutcome;
use Illuminate\Support\Facades\DB;

/**
 * Renúncia a uma categoria do processo (ex.: seguir só com a B num pedido AB) e sua confirmação,
 * que são atos separados. Não encerra o processo nem altera as outras categorias.
 */
class SetCategoryRenunciation
{
    public function __construct(private readonly Audit $audit, private readonly ProcessOutcome $outcome) {}

    public function renounce(QualificationProcess $process, string $category, string $reason): ProcessCategoryTrack
    {
        return DB::transaction(function () use ($process, $category, $reason) {
            $process = QualificationProcess::query()->whereKey($process->getKey())->lockForUpdate()->firstOrFail();
            $result = collect($this->outcome->categories($process->load(['exams', 'categoryTracks'])))->firstWhere('category', $category);

            if ($result === null) {
                throw new BusinessRuleException('A categoria não faz parte deste processo.', 'exam_category_invalid', 422);
            }
            if ($result['result'] === 'approved') {
                throw new BusinessRuleException('Categoria já aprovada não pode ser renunciada.', 'category_already_approved', 422);
            }
            if ($process->exams()->where('category', $category)->where('status', ExamStatus::Scheduled->value)->exists()) {
                throw new BusinessRuleException('Cancele o exame agendado desta categoria antes de registrar a renúncia.', 'exam_already_scheduled', 422);
            }

            $track = ProcessCategoryTrack::query()->firstOrNew(['qualification_process_id' => $process->getKey(), 'category' => $category]);
            $track->organization_id = $process->organization_id;
            $track->forceFill(['renounced_at' => now(), 'renunciation_reason' => $reason, 'renunciation_confirmed_at' => null, 'renunciation_reference' => null])->save();

            $this->audit->record($process->organization_id, 'process.renunciation', "Renúncia à categoria {$category} registrada.", [
                'student_id' => $process->student_id, 'process_id' => $process->getKey(), 'subject' => $track, 'reason' => $reason,
            ]);

            return $track;
        });
    }

    public function confirm(QualificationProcess $process, string $category, string $reference): ProcessCategoryTrack
    {
        return DB::transaction(function () use ($process, $category, $reference) {
            $track = ProcessCategoryTrack::query()->where('qualification_process_id', $process->getKey())
                ->where('category', $category)->lockForUpdate()->first();

            if ($track === null || $track->renounced_at === null) {
                throw new BusinessRuleException('Não há renúncia registrada para esta categoria.', 'renunciation_missing', 422);
            }

            $track->forceFill(['renunciation_confirmed_at' => now(), 'renunciation_reference' => $reference])->save();

            $this->audit->record($process->organization_id, 'process.renunciation_confirmed', "Renúncia à categoria {$category} confirmada.", [
                'student_id' => $process->student_id, 'process_id' => $process->getKey(), 'subject' => $track,
                'changes' => ['reference' => $reference],
            ]);

            return $track;
        });
    }

    public function revert(QualificationProcess $process, string $category, string $reason): ProcessCategoryTrack
    {
        return DB::transaction(function () use ($process, $category, $reason) {
            $track = ProcessCategoryTrack::query()->where('qualification_process_id', $process->getKey())
                ->where('category', $category)->lockForUpdate()->first();

            if ($track === null || $track->renounced_at === null) {
                throw new BusinessRuleException('Não há renúncia registrada para esta categoria.', 'renunciation_missing', 422);
            }

            $track->forceFill(['renounced_at' => null, 'renunciation_confirmed_at' => null])->save();

            $this->audit->record($process->organization_id, 'process.renunciation_reverted', "Renúncia à categoria {$category} desfeita.", [
                'student_id' => $process->student_id, 'process_id' => $process->getKey(), 'subject' => $track, 'reason' => $reason,
            ]);

            return $track;
        });
    }
}
