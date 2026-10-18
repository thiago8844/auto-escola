<?php

namespace App\Models;

use App\Enums\EnrollmentStatus;
use App\Enums\LicenseCategory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Matrícula de um aluno em uma categoria, dentro de uma organização. Pode estar ligada a um
 * processo de habilitação; sem processo, não há checklist de liberação a conferir.
 */
#[Fillable([
    'organization_id', 'student_id', 'partner_id', 'qualification_process_id', 'category',
    'status', 'contracted_minutes', 'price_cents', 'notes',
])]
class Enrollment extends Model
{
    use HasFactory;

    protected $attributes = [
        'status' => 'contracted',
    ];

    protected function casts(): array
    {
        return [
            'category' => LicenseCategory::class,
            'status' => EnrollmentStatus::class,
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }

    public function process(): BelongsTo
    {
        return $this->belongsTo(QualificationProcess::class, 'qualification_process_id');
    }

    public function packages(): HasMany
    {
        return $this->hasMany(EnrollmentPackage::class);
    }

    public function creditEntries(): HasMany
    {
        return $this->hasMany(CreditEntry::class);
    }

    public function exams(): HasMany
    {
        return $this->hasMany(PracticalExam::class);
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(Lesson::class);
    }
}
