<?php

namespace App\Http\Resources;

use App\Enums\MembershipRole;
use App\Models\PracticalExam;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Tentativa de exame. A equipe recebe tudo (inclusive pendências e histórico de remarcações);
 * o instrutor responsável recebe só o resumo operacional: quando, onde, quem e com qual veículo.
 *
 * @mixin PracticalExam
 */
class PracticalExamResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $role = $request->attributes->get('organization_role');
        $staff = $role instanceof MembershipRole && $role->canOperate();

        $summary = [
            'id' => $this->id,
            'category' => $this->category,
            'attempt_number' => $this->attempt_number,
            'status' => $this->status->value,
            'scheduled_at' => $this->scheduled_at->toIso8601String(),
            'location' => $this->location,
            'student' => $this->whenLoaded('student', fn () => ['id' => $this->student->id, 'name' => $this->student->name]),
            'driving_school' => $this->when($this->relationLoaded('partner'), fn () => $this->partner
                ? ['kind' => 'partner', 'id' => $this->partner->id, 'name' => $this->partner->name]
                : ['kind' => 'space', 'id' => null, 'name' => $this->organization?->name]),
            'vehicle' => $this->whenLoaded('vehicle', fn () => $this->vehicle ? ['id' => $this->vehicle->id, 'plate' => $this->vehicle->plate, 'model' => $this->vehicle->model] : null),
            'instructor' => $this->whenLoaded('instructor', fn () => $this->instructor ? ['id' => $this->instructor->id, 'full_name' => $this->instructor->full_name] : null),
        ];

        if (! $staff) {
            return $summary;
        }

        return $summary + [
            'qualification_process_id' => $this->qualification_process_id,
            'student_id' => $this->student_id,
            'enrollment_id' => $this->enrollment_id,
            'partner_id' => $this->partner_id,
            // Dados que a inscrição pede, vindos do cadastro do aluno (nada é digitado de novo).
            'registration' => $this->whenLoaded('student', fn () => [
                'name' => $this->student->name,
                'cpf' => $this->student->cpf,
                'category' => $this->category,
                'birth_date' => $this->student->birth_date?->toDateString(),
                'identity_number' => $this->student->identity_number,
                'identity_issuer' => $this->student->identity_issuer,
            ]),
            'notes' => $this->notes,
            'status_reason' => $this->status_reason,
            'result_at' => $this->result_at?->toIso8601String(),
            'reschedule_count' => $this->reschedule_count,
            'schedule_history' => $this->schedule_history ?? [],
            'pending' => $this->pending(),
            'fees' => $this->when($this->relationLoaded('fees'), fn () => ExternalFeeResource::collection($this->fees)->resolve()),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /**
     * Pendências operacionais para o exame: liberação do processo e taxas em aberto. Não presume
     * mínimo de aulas, prazo de reteste nem reconhecimento oficial.
     *
     * @return list<array{code: string, message: string}>
     */
    private function pending(): array
    {
        if ($this->status->value !== 'scheduled' || ! $this->relationLoaded('process')) {
            return [];
        }

        $pending = [];
        $process = $this->process;

        if ($this->relationLoaded('student')) {
            $missing = collect([
                'cpf' => 'CPF', 'birth_date' => 'data de nascimento',
                'identity_number' => 'identidade', 'identity_issuer' => 'órgão expedidor',
            ])->filter(fn ($label, $field) => blank($this->student->{$field}))->values();

            if ($missing->isNotEmpty()) {
                $pending[] = ['code' => 'student_data', 'message' => 'Faltam no cadastro do aluno: '.$missing->implode(', ').'.'];
            }
        }

        if ($process->relationLoaded('checklistItems')) {
            $items = $process->pendingRequiredItems();
            if ($items->isNotEmpty()) {
                $pending[] = ['code' => 'checklist', 'message' => $items->count().' item(ns) do checklist de liberação ainda sem conferência.'];
            }
        }

        if ($process->relationLoaded('externalFees')) {
            $linked = $this->relationLoaded('fees') ? $this->fees : collect();
            $open = $process->externalFees
                ->filter(fn ($fee) => $fee->status->isOpen()
                    && ($linked->contains('id', $fee->id) || $fee->exams->isEmpty()))
                ->count();

            if ($open > 0) {
                $pending[] = ['code' => 'fees_open', 'message' => "{$open} taxa(s) externa(s) sem pagamento confirmado."];
            }
        }

        if (in_array($process->status->value, ['completed', 'closed'], true)) {
            $pending[] = ['code' => 'process_closed', 'message' => 'O processo está encerrado.'];
        }

        return $pending;
    }
}
