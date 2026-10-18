<?php

namespace App\Services;

use App\Models\Organization;

/**
 * Antecedência, prazos e destinatários dos alertas de um espaço. Sem configuração, valem os padrões.
 */
class AlertSettings
{
    public const DEFAULTS = [
        'crlv_lead_days' => 30,
        'document_lead_days' => 30,
        'exam_lead_days' => 3,
        'fee_lead_days' => 5,
        'release_lead_days' => 7,
        'low_balance_minutes' => 100,
        'inactive_days' => 14,
        'lesson_grace_hours' => 2,
        // Perfil "equipe" também recebe os alertas operacionais (proprietário e gestor sempre recebem).
        'staff_receives' => true,
    ];

    /** @return array<string, int|bool> */
    public function for(Organization $organization): array
    {
        return array_replace(self::DEFAULTS, array_intersect_key($organization->alert_settings ?? [], self::DEFAULTS));
    }
}
