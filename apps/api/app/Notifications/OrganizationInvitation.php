<?php

namespace App\Notifications;

use App\Enums\MembershipRole;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * E-mail de convite. Propositalmente NÃO implementa ShouldQueue: o token em texto
 * não pode ser gravado na tabela de jobs. Use notifyNow().
 */
class OrganizationInvitation extends Notification
{
    public function __construct(
        private readonly string $organizationName,
        private readonly MembershipRole $role,
        private readonly string $plainToken,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim((string) config('autoescola.frontend_url'), '/')
            .'/convites/aceitar?token='.urlencode($this->plainToken);

        return (new MailMessage)
            ->subject("Convite para acessar {$this->organizationName}")
            ->greeting('Olá!')
            ->line("Você foi convidado para acessar **{$this->organizationName}** como {$this->role->value}.")
            ->line('Entre com a conta deste e-mail e aceite o convite. Ele expira em '
                .config('autoescola.invitation_ttl_days').' dias e só pode ser usado uma vez.')
            ->action('Aceitar convite', $url)
            ->line('Se você não esperava este convite, ignore este e-mail.');
    }
}
