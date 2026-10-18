<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rules\Password;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Mínimo configurável: 3 em desenvolvimento e 8 em produção (ver config/autoescola.php).
        Password::defaults(fn () => Password::min((int) config('autoescola.password_min')));

        // O e-mail de redefinição também aponta para o web: /redefinir-senha?token=...&email=...
        ResetPassword::createUrlUsing(fn (object $notifiable, string $token): string => rtrim((string) config('autoescola.frontend_url'), '/')
            .'/redefinir-senha?token='.$token.'&email='.urlencode($notifiable->getEmailForPasswordReset()));

        // O e-mail de confirmação aponta para o frontend. Ele repassa expires e signature à API,
        // que valida a assinatura calculada sobre a rota da própria API.
        VerifyEmail::createUrlUsing(function (object $notifiable): string {
            $id = $notifiable->getKey();
            $hash = sha1($notifiable->getEmailForVerification());

            $signedUrl = URL::temporarySignedRoute(
                'verification.verify',
                now()->addMinutes((int) config('auth.verification.expire', 60)),
                ['id' => $id, 'hash' => $hash],
            );

            return rtrim((string) config('autoescola.frontend_url'), '/')
                ."/auth/email/verify/{$id}/{$hash}?".parse_url($signedUrl, PHP_URL_QUERY);
        });
    }
}
