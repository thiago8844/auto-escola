<?php

namespace App\Services\Reports;

use App\Models\AuditEvent;
use App\Models\Document;
use App\Models\ExternalFee;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\PracticalExam;
use App\Models\QualificationProcess;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Processos por etapa/situação, tempo sem movimentação, documentos vencendo/vencidos e taxas externas por situação.
 * Taxa compartilhada entre tentativas é contada uma única vez (por guia, nunca por tentativa).
 */
class ProcessReport
{
    /** @return array<string, mixed> */
    public function run(Organization $org, int $stalledDays = 15, int $documentDays = 30): array
    {
        $timezone = $org->timezone ?: config('autoescola.default_timezone');
        $today = CarbonImmutable::now($timezone)->startOfDay();
        $limit = $today->addDays($documentDays)->toDateString();

        $byStatus = QualificationProcess::query()->where('organization_id', $org->getKey())->select('status', DB::raw('COUNT(*) as n'))->groupBy('status')->pluck('n', 'status');
        $byIssuance = QualificationProcess::query()->where('organization_id', $org->getKey())->whereNotIn('status', ['closed'])->select('issuance_status', DB::raw('COUNT(*) as n'))->groupBy('issuance_status')->pluck('n', 'issuance_status');

        return [
            'by_status' => $byStatus->map(fn ($n, $status) => ['key' => $status, 'count' => (int) $n])->values()->all(),
            'by_issuance' => $byIssuance->map(fn ($n, $status) => ['key' => $status, 'count' => (int) $n])->values()->all(),
            'stalled_days' => $stalledDays,
            'stalled' => $this->stalled($org, $stalledDays, $timezone),
            'documents' => [
                'expired' => $this->documents($org)->whereDate('expires_at', '<', $today->toDateString())->count(),
                'expiring' => $this->documents($org)->whereDate('expires_at', '>=', $today->toDateString())->whereDate('expires_at', '<=', $limit)->count(),
                'window_days' => $documentDays,
            ],
            'fees' => ExternalFee::query()->where('organization_id', $org->getKey())->select('status', DB::raw('COUNT(*) as n'), DB::raw('COALESCE(SUM(amount_cents),0) as amount'))->groupBy('status')->get()
                ->map(fn ($r) => ['key' => $r->status, 'count' => (int) $r->n, 'amount_cents' => (int) $r->amount])->all(),
        ];
    }

    /** @return \Illuminate\Database\Eloquent\Builder<Document> */
    private function documents(Organization $org)
    {
        return Document::query()->where('organization_id', $org->getKey())->whereIn('status', ['attached', 'verified'])->whereNotNull('expires_at');
    }

    /** @return list<array<string, mixed>> */
    private function stalled(Organization $org, int $days, string $timezone): array
    {
        $cutoff = now()->subDays($days);

        return QualificationProcess::query()
            ->where('organization_id', $org->getKey())
            ->whereNotIn('status', ['completed', 'closed'])
            ->with('student:id,name')
            ->get()
            ->map(function (QualificationProcess $process) {
                $last = collect([
                    $process->updated_at,
                    AuditEvent::query()->where('qualification_process_id', $process->getKey())->max('created_at'),
                    Lesson::query()->whereIn('enrollment_id', $process->enrollments()->select('id'))->max('updated_at'),
                    PracticalExam::query()->where('qualification_process_id', $process->getKey())->max('updated_at'),
                ])->filter()->map(fn ($v) => CarbonImmutable::parse($v))->max();

                return ['process' => $process, 'last' => $last];
            })
            ->filter(fn ($row) => $row['last'] < $cutoff)
            ->sortBy('last')
            ->take(100)
            ->map(fn ($row) => [
                'id' => $row['process']->getKey(),
                'student' => $row['process']->student?->name,
                'status' => $row['process']->status->value,
                'last_movement_at' => $row['last']->toIso8601String(),
                'days_without_movement' => (int) $row['last']->diffInDays(now()),
            ])->values()->all();
    }
}
