<?php

namespace App\Services;

use App\Enums\LessonStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Instructor;
use App\Models\Lesson;
use App\Models\PracticalExam;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Verifica conflitos de agenda do instrutor (aulas e exames) considerando TODAS as organizações.
 *
 * Estratégia de concorrência: antes de checar, a linha do instrutor é travada com
 * SELECT ... FOR UPDATE. Requisições concorrentes para o mesmo instrutor ficam em
 * fila dentro do banco, então duas aulas sobrepostas não conseguem ser gravadas.
 * Esta classe deve ser chamada dentro de uma transação.
 *
 * A resposta de erro não revela de qual organização é o conflito.
 */
class InstructorAvailability
{
    public function lockInstructor(int $instructorId): Instructor
    {
        return Instructor::query()->whereKey($instructorId)->lockForUpdate()->firstOrFail();
    }

    public function assertAvailable(
        int $instructorId,
        CarbonInterface $startsAt,
        CarbonInterface $endsAt,
        ?int $ignoreLessonId = null,
        ?int $ignoreExamId = null,
    ): void {
        if (DB::transactionLevel() === 0) {
            throw new \LogicException('A verificação de disponibilidade deve rodar dentro de uma transação.');
        }

        $conflict = Lesson::query()
            ->where('instructor_id', $instructorId)
            ->where('status', LessonStatus::Scheduled->value)
            ->when($ignoreLessonId, fn ($q) => $q->whereKeyNot($ignoreLessonId))
            ->where('starts_at', '<', $endsAt)
            ->where('ends_at', '>', $startsAt)
            ->exists();

        // Exames práticos também ocupam a janela do instrutor, em qualquer espaço.
        $conflict = $conflict || PracticalExam::query()
            ->where('instructor_id', $instructorId)
            ->where('status', 'scheduled')
            ->when($ignoreExamId, fn ($q) => $q->whereKeyNot($ignoreExamId))
            ->where('scheduled_at', '<', $endsAt)
            ->whereRaw('DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?', [$startsAt])
            ->exists();

        if ($conflict) {
            throw new BusinessRuleException(
                'Instrutor indisponível nesse horário.',
                'instructor_unavailable',
                409,
            );
        }
    }
}
