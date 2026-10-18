<?php

namespace App\Enums;

/**
 * Papel de acesso de um usuário dentro de uma organização (organization_user.role).
 */
enum MembershipRole: string
{
    case Owner = 'owner';
    case Admin = 'admin';
    case Staff = 'staff';
    case Instructor = 'instructor';

    /**
     * Pode gerenciar membros e convites (com as restrições de cada papel).
     */
    public function canManageMembers(): bool
    {
        return in_array($this, [self::Owner, self::Admin], true);
    }

    /**
     * Pode operar cadastros e agenda do espaço (alunos, matrículas, aulas, parceiros).
     */
    public function canOperate(): bool
    {
        return in_array($this, [self::Owner, self::Admin, self::Staff], true);
    }

    /**
     * Pode ajustar/estornar saldo e ver a trilha de auditoria do espaço (proprietário e administrador).
     */
    public function canAudit(): bool
    {
        return in_array($this, [self::Owner, self::Admin], true);
    }

    /**
     * Papéis que um administrador pode conceder ou revogar. Administradores não
     * promovem nem removem proprietários ou outros administradores.
     *
     * @return list<self>
     */
    public static function assignableByAdmin(): array
    {
        return [self::Staff, self::Instructor];
    }
}
