<?php

namespace App\Models;

use App\Enums\ExamStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Tentativa de exame prático de um percurso (processo + categoria simples). Cada tentativa
 * tem número único; remarcar mantém a tentativa e guarda a data/local anteriores no histórico.
 */
#[Fillable([
    'organization_id', 'qualification_process_id', 'student_id', 'enrollment_id', 'category', 'attempt_number',
    'scheduled_at', 'duration_minutes', 'location', 'protocol', 'notes', 'status', 'status_reason', 'result_at',
    'instructor_id', 'vehicle_id', 'reschedule_count', 'schedule_history', 'created_by',
])]
class PracticalExam extends Model
{
    protected $attributes = ['status' => 'scheduled', 'duration_minutes' => 60, 'reschedule_count' => 0];

    protected function casts(): array
    {
        return [
            'status' => ExamStatus::class,
            'scheduled_at' => 'datetime',
            'result_at' => 'datetime',
            'schedule_history' => 'array',
        ];
    }

    public function endsAt(): \Carbon\CarbonInterface
    {
        return $this->scheduled_at->copy()->addMinutes($this->duration_minutes);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function process(): BelongsTo
    {
        return $this->belongsTo(QualificationProcess::class, 'qualification_process_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function instructor(): BelongsTo
    {
        return $this->belongsTo(Instructor::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function fees(): BelongsToMany
    {
        return $this->belongsToMany(ExternalFee::class, 'external_fee_exam');
    }
}
