<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\EnrollmentPackage;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Primeiros passos do espaço: o que já foi feito e o que falta para operar. Só a equipe.
 */
class OnboardingController extends Controller
{
    public function show(Request $request, Organization $organization): JsonResponse
    {
        abort_unless($this->isOperator($request), 403);

        $independent = $organization->type->value === 'independent';

        $steps = [
            ['key' => 'profile', 'label' => 'Completar os dados do espaço', 'hint' => 'Endereço, cidade e contato aparecem nos documentos e facilitam o suporte.', 'done' => filled($organization->address) && filled($organization->city)],
            ['key' => 'instructor', 'label' => $independent ? 'Confirmar seu perfil de instrutor' : 'Cadastrar ou vincular um instrutor', 'hint' => 'Sem instrutor ativo não é possível agendar aulas.', 'done' => $organization->instructors()->wherePivot('active', true)->exists()],
            ['key' => 'vehicle', 'label' => 'Cadastrar um veículo', 'hint' => 'Informe a categoria e a validade do CRLV.', 'done' => $organization->vehicles()->exists()],
            ['key' => 'student', 'label' => 'Cadastrar um aluno', 'hint' => 'Nome e telefone bastam para começar.', 'done' => $organization->students()->exists()],
            ['key' => 'enrollment', 'label' => 'Criar a matrícula do aluno', 'hint' => 'Escolha a categoria e, se houver, o processo de habilitação.', 'done' => $organization->enrollments()->exists()],
            ['key' => 'package', 'label' => 'Registrar a contratação de aulas', 'hint' => 'O pacote define o saldo de aulas que será consumido.', 'done' => EnrollmentPackage::query()->whereHas('enrollment', fn ($q) => $q->where('organization_id', $organization->getKey()))->exists()],
            ['key' => 'lesson', 'label' => 'Agendar a primeira aula', 'hint' => 'Com instrutor, veículo e horário.', 'done' => $organization->lessons()->exists()],
        ];

        return response()->json(['data' => [
            'steps' => $steps,
            'done' => collect($steps)->where('done', true)->count(),
            'total' => count($steps),
            'support_email' => config('autoescola.support_email'),
        ]]);
    }
}
