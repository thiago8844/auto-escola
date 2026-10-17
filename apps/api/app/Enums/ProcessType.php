<?php

namespace App\Enums;

/**
 * Tipo de atendimento (processo de habilitação acompanhado pela organização).
 * Mapeia a seção 2 de docs/fluxo-habilitacao-brasil-mg.md.
 */
enum ProcessType: string
{
    case FirstLicense = 'first_license';
    case CategoryAddition = 'category_addition';
    case CategoryChange = 'category_change';
    case Refresher = 'refresher';

    /**
     * Quem já tem habilitação precisa informar as categorias atuais.
     */
    public function requiresCurrentCategories(): bool
    {
        return $this !== self::FirstLicense;
    }
}
