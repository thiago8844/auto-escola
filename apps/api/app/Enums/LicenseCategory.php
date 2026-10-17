<?php

namespace App\Enums;

/**
 * Categorias de habilitação (CNH) usadas em matrículas, processos e nas especialidades
 * do instrutor. Combinações (AB, AC...) são pedidos conjuntos; veículos e aulas práticas
 * usam sempre uma categoria simples (ver components()).
 */
enum LicenseCategory: string
{
    case A = 'A';
    case AB = 'AB';
    case AC = 'AC';
    case AD = 'AD';
    case AE = 'AE';
    case B = 'B';
    case C = 'C';
    case D = 'D';
    case E = 'E';
    case ACC = 'ACC';

    /**
     * Categorias simples que compõem esta (AB → A e B). ACC é autorização própria
     * para ciclomotor e não se confunde com A nem com C.
     *
     * @return list<self>
     */
    public function components(): array
    {
        return match ($this) {
            self::AB => [self::A, self::B],
            self::AC => [self::A, self::C],
            self::AD => [self::A, self::D],
            self::AE => [self::A, self::E],
            default => [$this],
        };
    }

    public function isSimple(): bool
    {
        return $this->components() === [$this];
    }

    /**
     * Categorias simples, as únicas aceitas em veículos.
     *
     * @return list<string>
     */
    public static function simpleValues(): array
    {
        return array_values(array_map(
            fn (self $case) => $case->value,
            array_filter(self::cases(), fn (self $case) => $case->isSimple()),
        ));
    }

    /**
     * Verifica se esta categoria (de matrícula ou de instrutor) cobre a categoria simples informada.
     */
    public function covers(self $simple): bool
    {
        return in_array($simple, $this->components(), true);
    }
}
