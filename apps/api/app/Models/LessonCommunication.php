<?php

namespace App\Models;

use Database\Factories\LessonCommunicationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'organization_id', 'lesson_id', 'student_id', 'actor_id', 'channel', 'purpose',
    'fingerprint', 'recipient', 'subject', 'body', 'status', 'opened_at', 'sent_at', 'marked_sent_at',
])]
class LessonCommunication extends Model
{
    /** @use HasFactory<LessonCommunicationFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
            'sent_at' => 'datetime',
            'marked_sent_at' => 'datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
