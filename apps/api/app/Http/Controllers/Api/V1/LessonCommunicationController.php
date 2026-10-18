<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\LessonStatus;
use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Models\Lesson;
use App\Models\LessonCommunication;
use App\Models\Organization;
use App\Models\Student;
use App\Notifications\LessonConfirmation;
use App\Services\LessonMessageComposer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Throwable;

class LessonCommunicationController extends Controller
{
    public function preview(Request $request, Organization $organization, Lesson $lesson, LessonMessageComposer $composer): JsonResponse
    {
        $this->assertOperator($request, $organization);
        $this->assertUpcoming($lesson);
        $lesson->load(['organization', 'enrollment.student', 'instructor']);
        $student = $lesson->enrollment->student;

        return response()->json(['data' => [
            ...$composer->compose($lesson),
            'student_name' => $student->name,
            'email' => $student->email,
            'phone' => $student->phone,
            'can_email' => filled($student->email),
            'can_whatsapp' => $this->whatsappNumber($student->phone) !== null,
        ]]);
    }

    public function index(Request $request, Organization $organization, Lesson $lesson): JsonResponse
    {
        $this->assertOperator($request, $organization);

        $communications = LessonCommunication::query()
            ->where('organization_id', $organization->getKey())
            ->where('lesson_id', $lesson->getKey())
            ->with('actor:id,name')
            ->latest()
            ->limit(100)
            ->get();

        return response()->json(['data' => $communications]);
    }

    public function studentIndex(Request $request, Organization $organization, Student $student): JsonResponse
    {
        $this->assertOperator($request, $organization);

        $communications = LessonCommunication::query()
            ->where('organization_id', $organization->getKey())
            ->where('student_id', $student->getKey())
            ->with('actor:id,name')
            ->latest()
            ->limit(100)
            ->get();

        return response()->json(['data' => $communications]);
    }

    public function sendEmail(Request $request, Organization $organization, Lesson $lesson, LessonMessageComposer $composer): JsonResponse
    {
        $this->assertOperator($request, $organization);
        $this->assertUpcoming($lesson);
        $lesson->load(['organization', 'enrollment.student', 'instructor']);
        $student = $lesson->enrollment->student;
        $recipient = $student->email;

        if (! filled($recipient)) {
            throw new BusinessRuleException('Cadastre um e-mail para o aluno antes de enviar.', 'student_email_missing');
        }

        $message = $composer->compose($lesson);
        $communication = $this->findOrCreate($request, $lesson, $student, 'email', $recipient, $message, 'sending');

        if (! $communication->wasRecentlyCreated) {
            if ($communication->status === 'sent') {
                return response()->json(['data' => $communication->load('actor:id,name')]);
            }

            $claimed = LessonCommunication::query()
                ->whereKey($communication->getKey())
                ->where('status', 'failed')
                ->update(['status' => 'sending']);

            if ($claimed !== 1) {
                throw new BusinessRuleException('Este e-mail já está em envio. Aguarde antes de tentar novamente.', 'email_already_sending', 409);
            }
        }

        try {
            Notification::route('mail', $recipient)->notifyNow(new LessonConfirmation($message['subject'], $message['body']));
            $communication->update(['status' => 'sent', 'sent_at' => now()]);
        } catch (Throwable $exception) {
            $communication->update(['status' => 'failed']);
            report($exception);

            throw new BusinessRuleException('Não foi possível enviar o e-mail. Tente novamente.', 'email_send_failed', 503);
        }

        return response()->json(['data' => $communication->load('actor:id,name')]);
    }

    public function openWhatsApp(Request $request, Organization $organization, Lesson $lesson, LessonMessageComposer $composer): JsonResponse
    {
        $this->assertOperator($request, $organization);
        $this->assertUpcoming($lesson);
        $lesson->load(['organization', 'enrollment.student', 'instructor']);
        $student = $lesson->enrollment->student;
        $recipient = $this->whatsappNumber($student->phone);

        if ($recipient === null) {
            throw new BusinessRuleException('Cadastre um celular válido com DDD para abrir o WhatsApp.', 'student_phone_invalid');
        }

        $message = $composer->compose($lesson);
        $communication = $this->findOrCreate($request, $lesson, $student, 'whatsapp_manual', $recipient, $message, 'opened');

        return response()->json([
            'data' => $communication->load('actor:id,name'),
            'url' => 'https://wa.me/'.$recipient.'?text='.rawurlencode($message['body']),
        ]);
    }

    public function markWhatsAppSent(Request $request, Organization $organization, Lesson $lesson, int $communicationId): JsonResponse
    {
        $this->assertOperator($request, $organization);

        $communication = LessonCommunication::query()
            ->where('organization_id', $organization->getKey())
            ->where('lesson_id', $lesson->getKey())
            ->where('channel', 'whatsapp_manual')
            ->findOrFail($communicationId);

        if ($communication->status === 'opened') {
            $communication->update(['status' => 'marked_sent', 'marked_sent_at' => now()]);
        }

        return response()->json(['data' => $communication->load('actor:id,name')]);
    }

    private function assertOperator(Request $request, Organization $organization): void
    {
        abort_unless($organization->roleFor($request->user())?->canOperate(), 403);
    }

    private function assertUpcoming(Lesson $lesson): void
    {
        if ($lesson->status !== LessonStatus::Scheduled || $lesson->starts_at->isPast()) {
            throw new BusinessRuleException('A confirmação só pode ser enviada para uma aula futura agendada.', 'lesson_not_upcoming');
        }
    }

    /** @return array{subject: string, body: string} */
    private function findOrCreate(Request $request, Lesson $lesson, Student $student, string $channel, string $recipient, array $message, string $status): LessonCommunication
    {
        $fingerprint = hash('sha256', implode('|', [$channel, $recipient, $message['subject'], $message['body']]));

        return LessonCommunication::query()->firstOrCreate(
            ['lesson_id' => $lesson->getKey(), 'channel' => $channel, 'fingerprint' => $fingerprint],
            [
                'organization_id' => $lesson->organization_id,
                'student_id' => $student->getKey(),
                'actor_id' => $request->user()->getKey(),
                'purpose' => 'lesson_confirmation',
                'recipient' => $recipient,
                'subject' => $message['subject'],
                'body' => $message['body'],
                'status' => $status,
                'opened_at' => $channel === 'whatsapp_manual' ? now() : null,
            ],
        );
    }

    private function whatsappNumber(?string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', $phone ?? '');

        if (strlen($digits) === 10 || strlen($digits) === 11) {
            $digits = '55'.$digits;
        }

        return preg_match('/^55\d{10,11}$/', $digits) === 1 ? $digits : null;
    }
}
