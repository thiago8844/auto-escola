<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;

/**
 * Recuperação e troca de senha.
 *
 * - O pedido de recuperação responde SEMPRE igual, exista a conta ou não (não revela cadastros).
 * - O link é de uso único e expira (config auth.passwords.users.expire); reutilizar ou expirar dá o mesmo erro.
 * - Redefinir ou trocar a senha encerra as outras sessões e tokens da conta.
 */
class PasswordController extends Controller
{
    public function forgot(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email', 'max:150']]);

        // O resultado do broker (enviado, limitado, sem usuário) é ignorado de propósito.
        Password::sendResetLink(['email' => mb_strtolower(trim($data['email']))]);

        return response()->json(['message' => 'Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha. Ele vale por 60 minutos.']);
    }

    public function reset(Request $request, Audit $audit): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:200'],
            'email' => ['required', 'email', 'max:150'],
            'password' => ['required', 'string', 'confirmed', PasswordRule::defaults()],
        ]);

        $user = null;

        $status = Password::reset(
            ['email' => mb_strtolower(trim($data['email'])), 'token' => $data['token'], 'password' => $data['password'], 'password_confirmation' => $request->input('password_confirmation')],
            function (User $found, string $password) use (&$user) {
                $found->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
                $user = $found;
                event(new PasswordReset($found));
            },
        );

        if ($status !== Password::PASSWORD_RESET || $user === null) {
            throw new BusinessRuleException('Este link de redefinição é inválido ou expirou. Peça um novo.', 'invalid_reset_token', 422);
        }

        $this->endOtherSessions($user, null);

        return response()->json(['message' => 'Senha redefinida. Entre com a nova senha.']);
    }

    /**
     * Troca a própria senha, confirmando a atual. Outras sessões e tokens são encerrados; a atual continua.
     */
    public function change(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'confirmed', 'different:current_password', PasswordRule::defaults()],
        ]);

        $user = $request->user();

        if (! Hash::check($data['current_password'], $user->password)) {
            throw \Illuminate\Validation\ValidationException::withMessages(['current_password' => 'A senha atual está incorreta.']);
        }

        $user->forceFill(['password' => $data['password'], 'remember_token' => Str::random(60)])->save();
        $this->endOtherSessions($user, $request);

        return response()->json(['message' => 'Senha alterada. Os outros dispositivos foram desconectados.']);
    }

    private function endOtherSessions(User $user, ?Request $request): void
    {
        $currentToken = $request?->user()?->currentAccessToken();
        $user->tokens()
            ->when($currentToken instanceof \Laravel\Sanctum\PersonalAccessToken, fn ($q) => $q->whereKeyNot($currentToken->getKey()))
            ->delete();

        if (config('session.driver') === 'database') {
            $currentSession = $request?->hasSession() ? $request->session()->getId() : null;

            DB::table(config('session.table', 'sessions'))
                ->where('user_id', $user->getKey())
                ->when($currentSession, fn ($q) => $q->where('id', '!=', $currentSession))
                ->delete();
        }
    }
}
