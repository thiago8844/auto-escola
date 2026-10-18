<?php

namespace App\Enums;

/**
 * Origem de um movimento do extrato. Movimentos nunca são editados nem apagados: correções
 * entram como novos movimentos (ajuste ou estorno).
 */
enum CreditEntryType: string
{
    case Grant = 'grant';
    case InitialBalance = 'initial_balance';
    case Adjustment = 'adjustment';
    case Reserve = 'reserve';
    case ReserveAdjust = 'reserve_adjust';
    case Release = 'release';
    case Consume = 'consume';
    case ConsumeAdjustment = 'consume_adjustment';
    case Reversal = 'reversal';

    public function label(): string
    {
        return match ($this) {
            self::Grant => 'Contratação',
            self::InitialBalance => 'Saldo inicial',
            self::Adjustment => 'Ajuste manual',
            self::Reserve => 'Reserva (aula agendada)',
            self::ReserveAdjust => 'Ajuste de reserva',
            self::Release => 'Liberação da reserva',
            self::Consume => 'Consumo',
            self::ConsumeAdjustment => 'Ajuste de consumo',
            self::Reversal => 'Estorno',
        };
    }
}
