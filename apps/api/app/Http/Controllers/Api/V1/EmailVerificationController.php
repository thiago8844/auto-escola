<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmailVerificationController extends Controller
{
    /**
     * Link assinado enviado por e-mail. A assinatura é validada pelo middleware "signed".
     */
    public function verify(Request $request, int $id, string $hash): JsonResponse
    {
        $user = User::query()->findOrFail($id);

        if (! hash_equals($hash, sha1($user->getEmailForVerification()))) {
            throw new BusinessRuleException('Link de confirmação inválido.', 'invalid_verification_link', 403);
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
            event(new Verified($user));
        }

        return response()->json(['message' => 'E-mail confirmado.']);
    }

    public function resend(Request $request): JsonResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            throw new BusinessRuleException('Seu e-mail já está confirmado.', 'already_verified', 422);
        }

        $request->user()->sendEmailVerificationNotification();

        return response()->json(['message' => 'Enviamos um novo link de confirmação.']);
    }
}
