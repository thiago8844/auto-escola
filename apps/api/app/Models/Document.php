<?php

namespace App\Models;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Metadados de um arquivo privado. O caminho em disco (storage_path) nunca é exposto pela API.
 */
#[Fillable([
    'organization_id', 'type', 'status', 'student_id', 'qualification_process_id', 'vehicle_id',
    'replaces_document_id', 'version', 'issuer', 'issued_at', 'expires_at', 'notes',
    'storage_path', 'original_name', 'mime_type', 'size', 'uploaded_by', 'verified_by', 'verified_at',
])]
class Document extends Model
{
    use HasFactory;

    protected $attributes = [
        'status' => 'attached',
        'version' => 1,
    ];

    protected function casts(): array
    {
        return [
            'type' => DocumentType::class,
            'status' => DocumentStatus::class,
            'issued_at' => 'date',
            'expires_at' => 'date',
            'verified_at' => 'datetime',
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

    public function process(): BelongsTo
    {
        return $this->belongsTo(QualificationProcess::class, 'qualification_process_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function replaces(): BelongsTo
    {
        return $this->belongsTo(self::class, 'replaces_document_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
