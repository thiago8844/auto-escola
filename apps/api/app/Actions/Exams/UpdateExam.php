<?php

namespace App\Actions\Exams;

use App\Enums\ExamStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\PracticalExam;
use App\Services\Audit;
use App\Services\ExamPlanner;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Edita um exame. Corrige qualquer informação, inclusive a data (por exemplo, digitada errada),
 * sem passar pelo histórico de remarcações: a alteração fica na auditoria. Data, instrutor, veículo
 * e autoescola só mudam enquanto o exame está agendado; local e observações, sempre.
 */
class UpdateExam
{
    private const WHILE_SCHEDULED = ['scheduled_at', 'instructor_id', 'vehicle_id', 'partner_id'];

    public function __construct(private readonly ExamPlanner $planner, private readonly Audit $audit) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function __invoke(PracticalExam $exam, array $data): PracticalExam
    {
        return DB::transaction(function () use ($exam, $data) {
            $organization = $exam->organization;
            $startsAt = isset($data['scheduled_at']) ? CarbonImmutable::parse($data['scheduled_at'])->utc() : null;
            $instructorId = array_key_exists('instructor_id', $data) ? $data['instructor_id'] : $exam->instructor_id;
            $vehicleId = array_key_exists('vehicle_id', $data) ? $data['vehicle_id'] : $exam->vehicle_id;

            if (array_intersect_key($data, array_flip(['scheduled_at', 'instructor_id', 'vehicle_id'])) !== []) {
                $this->planner->assertResourcesFree(
                    $organization, $exam->student_id, $instructorId, $vehicleId,
                    $startsAt ?? CarbonImmutable::instance($exam->scheduled_at)->utc(), $exam->getKey(),
                );
            }

            $current = PracticalExam::query()->whereKey($exam->getKey())->lockForUpdate()->firstOrFail();

            if ($current->status !== ExamStatus::Scheduled && array_intersect_key($data, array_flip(self::WHILE_SCHEDULED)) !== []) {
                throw new BusinessRuleException('Data, instrutor, veículo e autoescola só mudam em exames agendados.', 'invalid_status_transition', 422);
            }

            if (array_key_exists('partner_id', $data)) {
                $this->planner->assertDrivingSchool($organization, $data['partner_id']);
            }

            if ($startsAt !== null) {
                $data['scheduled_at'] = $startsAt;
            }

            $current->fill($data);
            $changes = collect($current->getDirty())->map(fn ($new, $key) => [
                'from' => $current->getOriginal($key) instanceof \DateTimeInterface ? $current->getOriginal($key)->format(DATE_ATOM) : $current->getOriginal($key),
                'to' => $new instanceof \DateTimeInterface ? $new->format(DATE_ATOM) : $new,
            ])->all();
            $current->save();

            if ($changes !== []) {
                $this->audit->record($current->organization_id, 'exam.updated', 'Dados do exame atualizados.', [
                    'student_id' => $current->student_id,
                    'process_id' => $current->qualification_process_id,
                    'subject' => $current,
                    'changes' => $changes,
                ]);
            }

            return $current;
        });
    }
}
