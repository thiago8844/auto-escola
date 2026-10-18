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
    'organization_id', 'qualification_process_id', 'student_id', 'enrollment_id', 'partner_id', 'category', 'attempt_number',
    'scheduled_at', 'location', 'notes', 'status', 'status_reason', 'result_at',
    'instructor_id', 'vehicle_id', 'reschedule_count', 'schedule_history', 'created_by',
])]
class PracticalExam extends Model
{
    /** O exame não tem duração própria: instrutor, veículo e aluno ficam reservados por este bloco. */
    public const SLOT_MINUTES = 60;

    protected $attributes = ['status' => 'scheduled', 'reschedule_count' => 0];

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
        return $this->scheduled_at->copy()->addMinutes(self::SLOT_MINUTES);
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

    /** Autoescola do exame; nulo significa o próprio espaço. */
    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
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
