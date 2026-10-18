<?php

namespace App\Services;

use App\Models\AuditEvent;
use Illuminate\Database\Eloquent\Model;

/**
 * Grava a trilha de auditoria (append-only). O autor é o usuário autenticado, salvo se informado.
 *
 * `event` segue "categoria.ação" (ex.: "balance.grant"); a categoria agrupa os filtros da tela.
 */
class Audit
{
    /**
     * @param  array{reason?: ?string, changes?: array<string, mixed>, student_id?: ?int, process_id?: ?int, enrollment_id?: ?int, subject?: ?Model, actor_id?: ?int}  $context
     */
    public function record(int $organizationId, string $event, string $summary, array $context = []): AuditEvent
    {
        $subject = $context['subject'] ?? null;

        return AuditEvent::create([
            'organization_id' => $organizationId,
            'actor_id' => array_key_exists('actor_id', $context) ? $context['actor_id'] : auth()->id(),
            'event' => $event,
            'category' => explode('.', $event)[0],
            'summary' => mb_substr($summary, 0, 255),
            'reason' => $context['reason'] ?? null,
            'changes' => $context['changes'] ?? null,
            'student_id' => $context['student_id'] ?? null,
            'qualification_process_id' => $context['process_id'] ?? null,
            'enrollment_id' => $context['enrollment_id'] ?? null,
            'subject_type' => $subject ? class_basename($subject) : null,
            'subject_id' => $subject?->getKey(),
        ]);
    }
}
