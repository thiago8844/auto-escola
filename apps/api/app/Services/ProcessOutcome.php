<?php

namespace App\Services;

use App\Enums\ClosureKind;
use App\Enums\ExamStatus;
use App\Enums\IssuanceStatus;
use App\Enums\LicenseCategory;
use App\Enums\LessonStatus;
use App\Enums\ProcessStatus;
use App\Models\Lesson;
use App\Models\ProcessCategoryTrack;
use App\Models\QualificationProcess;

/**
 * Desfecho de um processo, em quatro eixos independentes (cada um com regra própria):
 * situação comercial da matrícula (outra tela), liberação para a prática, resultado por
 * categoria e situação da emissão — mais o encerramento do acompanhamento.
 *
 * Tudo é derivado dos registros; nada aqui grava. O resultado de uma categoria nunca altera o da outra.
 */
class ProcessOutcome
{
    public function __construct(private readonly CreditLedger $ledger) {}

    /**
     * @return array<string, mixed>
     */
    public function for(QualificationProcess $process): array
    {
        $process->loadMissing(['exams', 'categoryTracks', 'checklistItems', 'externalFees.exams', 'enrollments']);

        $categories = $this->categories($process);
        $active = collect($categories)->reject(fn ($c) => in_array($c['result'], ['approved', 'renounced'], true));
        $approved = collect($categories)->where('result', 'approved');

        return [
            'practice_release' => [
                'released' => $process->practiceReleased(),
                'pending_count' => $process->pendingRequiredItems()->count(),
            ],
            'categories' => $categories,
            'issuance' => [
                'status' => $process->issuance_status->value,
                'kind' => $process->issuance_kind,
                'reference' => $process->issuance_reference,
                'issued_at' => $process->issued_at?->toDateString(),
                'delivered_at' => $process->delivered_at?->toDateString(),
                'document_id' => $process->issuance_document_id,
                'awaiting' => $approved->isNotEmpty() && ! in_array($process->issuance_status, [IssuanceStatus::Issued, IssuanceStatus::Delivered], true),
                'definitive_follow_up' => $process->definitive_follow_up,
                'definitive_due_at' => $process->definitive_due_at?->toDateString(),
            ],
            'closure' => [
                'kind' => $process->closure_kind,
                'reason' => $process->closure_reason,
                'closed_at' => $process->closed_at?->toIso8601String(),
            ],
            'all_categories_resolved' => $active->isEmpty() && $categories !== [],
            'next_step' => $this->nextStep($process, $categories),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function categories(QualificationProcess $process): array
    {
        $simple = collect($process->targetCategoryEnums())
            ->flatMap(fn (LicenseCategory $c) => $c->components())
            ->map->value->unique()->values();

        return $simple->map(function (string $category) use ($process) {
            /** @var ProcessCategoryTrack|null $track */
            $track = $process->categoryTracks->firstWhere('category', $category);
            $exams = $process->exams->where('category', $category)->sortBy('attempt_number');
            $counted = $exams->reject(fn ($e) => $e->status === ExamStatus::Cancelled);
            $last = $counted->last();

            $result = match (true) {
                $track?->renounced_at !== null => 'renounced',
                $counted->contains(fn ($e) => $e->status === ExamStatus::Approved) => 'approved',
                $last === null => 'pending',
                default => $last->status->value,
            };

            return [
                'category' => $category,
                'result' => $result,
                'attempts' => $exams->count(),
                'last_exam_id' => $last?->id,
                'renunciation' => [
                    'renounced_at' => $track?->renounced_at?->toIso8601String(),
                    'reason' => $track?->renunciation_reason,
                    'confirmed_at' => $track?->renunciation_confirmed_at?->toIso8601String(),
                    'reference' => $track?->renunciation_reference,
                ],
            ];
        })->all();
    }

    /**
     * Itens que o encerramento deixaria em aberto, para decisão explícita da equipe.
     *
     * @return array<string, mixed>
     */
    public function closureCheck(QualificationProcess $process): array
    {
        $process->loadMissing(['exams', 'categoryTracks', 'externalFees', 'enrollments']);

        $enrollmentIds = $process->enrollments->pluck('id');
        $futureLessons = Lesson::query()->whereIn('enrollment_id', $enrollmentIds)
            ->where('status', LessonStatus::Scheduled->value)->count();
        $futureExams = $process->exams->where('status', ExamStatus::Scheduled)->count();
        $openFees = $process->externalFees->filter(fn ($f) => $f->status->isOpen())->count();
        $reimbursements = $process->externalFees->where('reimbursement', 'to_settle')->count();

        $balances = $this->ledger->balancesFor($process->enrollments);
        $credits = collect($balances)->sum(fn ($b) => max(0, $b['available']));

        $categories = collect($this->categories($process));
        $canComplete = $categories->isNotEmpty()
            && $categories->every(fn ($c) => in_array($c['result'], ['approved', 'renounced'], true))
            && in_array($process->issuance_status, [IssuanceStatus::Issued, IssuanceStatus::Delivered], true);

        $pending = array_values(array_filter([
            $openFees > 0 ? ['code' => 'open_fees', 'count' => $openFees, 'message' => "{$openFees} taxa(s) externa(s) sem pagamento confirmado."] : null,
            $reimbursements > 0 ? ['code' => 'reimbursements', 'count' => $reimbursements, 'message' => "{$reimbursements} reembolso(s) de taxa a acertar."] : null,
            $credits > 0 ? ['code' => 'unused_credits', 'count' => $credits, 'message' => "{$credits} min de saldo contratado ainda disponível (não é removido ao encerrar)."] : null,
            $process->definitive_follow_up && $process->closure_kind === null ? ['code' => 'definitive_follow_up', 'count' => 1, 'message' => 'Acompanhamento da futura definitiva ainda marcado como pendência.'] : null,
        ]));

        return [
            'can_complete' => $canComplete,
            'future_lessons' => $futureLessons,
            'future_exams' => $futureExams,
            'pending' => $pending,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $categories
     * @return array{code: string, label: string}
     */
    private function nextStep(QualificationProcess $process, array $categories): array
    {
        if (in_array($process->status, [ProcessStatus::Completed, ProcessStatus::Closed], true)) {
            return ['code' => 'closed', 'label' => $process->status === ProcessStatus::Completed ? 'Processo concluído.' : 'Processo encerrado.'];
        }

        if (! $process->practiceReleased()) {
            $n = $process->pendingRequiredItems()->count();

            return ['code' => 'practice_release', 'label' => "Concluir a liberação para a prática ({$n} item(ns) do checklist pendente(s))."];
        }

        // Prioridade: exame já marcado → nova tentativa necessária → exame ainda por marcar.
        foreach (['scheduled', 'failed', 'absent', 'incomplete', 'pending'] as $wanted) {
            foreach ($categories as $category) {
                if ($category['result'] !== $wanted) {
                    continue;
                }

                $cat = $category['category'];

                return match ($wanted) {
                    'scheduled' => ['code' => 'exam_scheduled', 'label' => "Aguardar o exame da categoria {$cat}".(($exam = $process->exams->firstWhere('id', $category['last_exam_id'])) ? ' em '.$exam->scheduled_at->format('d/m/Y').'.' : '.')],
                    'pending' => ['code' => 'exam_to_schedule', 'label' => "Concluir as aulas e agendar o exame da categoria {$cat}."],
                    default => ['code' => 'exam_retry', 'label' => "Agendar nova tentativa do exame da categoria {$cat}."],
                };
            }
        }

        $hasApproved = collect($categories)->contains('result', 'approved');

        if ($hasApproved) {
            return match ($process->issuance_status) {
                IssuanceStatus::NotStarted, IssuanceStatus::Pending => ['code' => 'issuance_pending', 'label' => 'Acompanhar a emissão do documento (aprovado, emissão pendente).'],
                IssuanceStatus::Issued => ['code' => 'delivery_pending', 'label' => 'Registrar a entrega do documento ao aluno.'],
                IssuanceStatus::Delivered => ['code' => 'ready_to_close', 'label' => 'Documento entregue. Concluir o processo.'],
            };
        }

        return ['code' => 'ready_to_close', 'label' => 'Todas as categorias foram resolvidas. Encerrar o processo.'];
    }
}
