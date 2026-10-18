<?php

namespace App\Actions\Lessons;

use App\Enums\LessonStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Services\CreditLedger;
use Illuminate\Support\Facades\DB;

/**
 * Ajusta observações, evolução pedagógica e duração real. Evolução e duração real só
 * existem em aula realizada. Mudar a duração real recalcula o consumo (diferença rastreável).
 */
class UpdateLessonDetails
{
    public function __construct(private readonly CreditLedger $ledger) {}

    /**
     * @param  array{notes?: ?string, evolution?: ?string, actual_minutes?: ?int}  $data
     */
    public function __invoke(Lesson $lesson, array $data): Lesson
    {
        $touchesExecution = array_key_exists('evolution', $data) || array_key_exists('actual_minutes', $data);

        if ($touchesExecution && $lesson->status !== LessonStatus::Completed) {
            throw new BusinessRuleException(
                'Evolução e duração real só podem ser registradas em aulas realizadas.',
                'lesson_not_completed',
                422,
            );
        }

        return DB::transaction(function () use ($lesson, $data) {
            $current = Lesson::query()->whereKey($lesson->getKey())->lockForUpdate()->firstOrFail();
            $previous = $current->actual_minutes ?? $current->scheduledMinutes();

            $current->forceFill($data)->save();

            if (array_key_exists('actual_minutes', $data) && $current->status === LessonStatus::Completed
                && ($current->actual_minutes ?? $current->scheduledMinutes()) !== $previous) {
                $current->setRelation('enrollment', Enrollment::query()->whereKey($current->enrollment_id)->lockForUpdate()->firstOrFail());
                $this->ledger->adjustConsumption($current, $previous);
            }

            return $current;
        });
    }
}
