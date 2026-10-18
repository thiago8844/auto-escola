<?php

namespace App\Models;

use App\Enums\IssuanceStatus;
use App\Enums\LicenseCategory;
use App\Enums\ProcessStatus;
use App\Enums\ProcessType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

/**
 * Acompanhamento local de um processo de habilitação. Não representa o sistema oficial:
 * guarda referências (Renach, protocolo) e o checklist de liberação para a prática.
 */
#[Fillable([
    'organization_id', 'student_id', 'type', 'uf', 'municipality', 'renach', 'protocol',
    'opened_at', 'current_categories', 'target_categories', 'status', 'notes',
    'issuance_status', 'issuance_kind', 'issuance_reference', 'issued_at', 'delivered_at', 'issuance_document_id',
    'definitive_follow_up', 'definitive_due_at', 'closure_kind', 'closure_reason', 'closed_at',
])]
class QualificationProcess extends Model
{
    use HasFactory;

    protected $attributes = [
        'status' => 'preparing',
        'issuance_status' => 'not_started',
        'definitive_follow_up' => false,
    ];

    protected function casts(): array
    {
        return [
            'type' => ProcessType::class,
            'status' => ProcessStatus::class,
            'opened_at' => 'date',
            'issuance_status' => IssuanceStatus::class,
            'issued_at' => 'date',
            'delivered_at' => 'date',
            'definitive_due_at' => 'date',
            'definitive_follow_up' => 'boolean',
            'closed_at' => 'datetime',
            'current_categories' => 'array',
            'target_categories' => 'array',
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

    public function checklistItems(): HasMany
    {
        return $this->hasMany(ProcessChecklistItem::class);
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function categoryTracks(): HasMany
    {
        return $this->hasMany(ProcessCategoryTrack::class);
    }

    public function exams(): HasMany
    {
        return $this->hasMany(PracticalExam::class);
    }

    public function externalFees(): HasMany
    {
        return $this->hasMany(ExternalFee::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    /**
     * Categorias pretendidas como enums.
     *
     * @return list<LicenseCategory>
     */
    public function targetCategoryEnums(): array
    {
        return array_map(fn (string $c) => LicenseCategory::from($c), $this->target_categories ?? []);
    }

    /**
     * Itens obrigatórios que ainda não liberam a prática (nem conferidos, nem dispensados com motivo).
     *
     * @return Collection<int, ProcessChecklistItem>
     */
    public function pendingRequiredItems(): Collection
    {
        $items = $this->relationLoaded('checklistItems') ? $this->checklistItems : $this->checklistItems()->get();

        return $items
            ->filter(fn (ProcessChecklistItem $item) => $item->required && ! $item->status->clearsPractice())
            ->values();
    }

    public function practiceReleased(): bool
    {
        return $this->pendingRequiredItems()->isEmpty();
    }
}
