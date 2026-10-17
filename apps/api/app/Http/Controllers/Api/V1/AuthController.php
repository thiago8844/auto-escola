<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\TokenRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Autenticação. Dois fluxos independentes:
 * - SPA: POST /auth/login cria sessão com cookie (exige GET /sanctum/csrf-cookie antes).
 * - Mobile: POST /auth/token devolve um token Bearer.
 * O logout encerra a forma de autenticação usada na requisição.
 */
class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create($request->validated());

        // Confirmação de e-mail é exigida para aceitar convites. Não bloqueia o login.
        $user->sendEmailVerificationNotification();

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        if (! Auth::guard('web')->attempt($request->only('email', 'password'))) {
            throw new BusinessRuleException('Credenciais inválidas.', 'invalid_credentials', 401);
        }

        $request->session()->regenerate();

        return (new UserResource($request->user()))->response();
    }

    public function token(TokenRequest $request): JsonResponse
    {
        $credentials = $request->only('email', 'password');

        if (! Auth::guard('web')->validate($credentials)) {
            throw new BusinessRuleException('Credenciais inválidas.', 'invalid_credentials', 401);
        }

        $user = User::query()->where('email', $credentials['email'])->firstOrFail();

        $expiresAt = config('sanctum.expiration') ? now()->addMinutes((int) config('sanctum.expiration')) : null;
        $token = $user->createToken($request->string('device_name')->toString(), ['*'], $expiresAt);

        return response()->json([
            'token' => $token->plainTextToken,
            'token_type' => 'Bearer',
            'expires_at' => $expiresAt?->toIso8601String(),
            'user' => new UserResource($user),
        ], 201);
    }

    public function logout(Request $request): Response
    {
        $accessToken = $request->user()->currentAccessToken();

        if ($accessToken instanceof PersonalAccessToken) {
            $accessToken->delete();

            return response()->noContent();
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    public function user(Request $request): JsonResponse
    {
        return (new UserResource($request->user()))->response();
    }
}
