<?php

namespace App\Http\Middleware;

use App\Models\Organization;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Exige acesso ativo do usuário autenticado ao espaço da rota.
 *
 * Sem acesso, responde 404 (e não 403) para não revelar se a organização existe.
 * O papel fica disponível em $request->attributes para Resources e Policies.
 */
class EnsureOrganizationMember
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Organization|null $organization */
        $organization = $request->route('organization');
        $user = $request->user();

        $role = $organization && $user ? $organization->roleFor($user) : null;

        if ($role === null) {
            return response()->json(['message' => 'Organização não encontrada.', 'error' => 'not_found'], 404);
        }

        $request->attributes->set('organization_role', $role);

        return $next($request);
    }
}
