<?php

namespace App\Http\Resources;

use App\Models\QualificationProcess;

/**
 * Resumo de liberação para a prática. Expõe só os tipos pendentes (sem laudos nem notas),
 * por isso pode aparecer para o instrutor na matrícula.
 */
class PracticeReleaseSummary
{
    /**
     * @return array{released: bool, pending: list<string>}
     */
    public static function of(QualificationProcess $process): array
    {
        $pending = $process->pendingRequiredItems();

        return [
            'released' => $pending->isEmpty(),
            'pending' => $pending->map(fn ($item) => $item->type->value)->all(),
        ];
    }
}
