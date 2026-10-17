<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\URL;
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
