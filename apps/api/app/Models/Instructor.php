<?php

namespace App\Models;

use Database\Factories\InstructorFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Identidade profissional global do instrutor. Uma pessoa pode atuar em várias
 * organizações; o vínculo profissional fica em organization_instructor.
 */
#[Fillable(['user_id', 'full_name', 'credential_number', 'categories'])]
class Instructor extends Model
{
    /** @use HasFactory<InstructorFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'categories' => 'array',
        ];
    }

    /**
     * Conta de acesso, quando o instrutor tiver uma. Pode ser nulo (instrutor sem conta).
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function organizations(): BelongsToMany
    {
        return $this->belongsToMany(Organization::class, 'organization_instructor')
            ->withPivot('active')
            ->withTimestamps();
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(Lesson::class);
    }
}
