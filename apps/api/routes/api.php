<?php

use App\Http\Controllers\Api\V1\AlertController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\AvailabilityBlockController;
use App\Http\Controllers\Api\V1\ChecklistItemController;
use App\Http\Controllers\Api\V1\DocumentController;
use App\Http\Controllers\Api\V1\EmailVerificationController;
use App\Http\Controllers\Api\V1\ExternalFeeController;
use App\Http\Controllers\Api\V1\EnrollmentBalanceController;
use App\Http\Controllers\Api\V1\EnrollmentController;
use App\Http\Controllers\Api\V1\FleetOverviewController;
use App\Http\Controllers\Api\V1\InvitationAcceptController;
use App\Http\Controllers\Api\V1\InvitationController;
use App\Http\Controllers\Api\V1\LessonController;
use App\Http\Controllers\Api\V1\MaintenanceController;
use App\Http\Controllers\Api\V1\MeInstructorController;
use App\Http\Controllers\Api\V1\MyLessonController;
use App\Http\Controllers\Api\V1\OnboardingController;
use App\Http\Controllers\Api\V1\OrganizationController;
use App\Http\Controllers\Api\V1\PasswordController;
use App\Http\Controllers\Api\V1\OrganizationInstructorController;
use App\Http\Controllers\Api\V1\OrganizationMemberController;
use App\Http\Controllers\Api\V1\PartnerController;
use App\Http\Controllers\Api\V1\PracticalExamController;
use App\Http\Controllers\Api\V1\ProcessOutcomeController;
use App\Http\Controllers\Api\V1\TimelineController;
use App\Http\Controllers\Api\V1\QualificationProcessController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\StudentController;
use App\Http\Controllers\Api\V1\VehicleController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API v1
|--------------------------------------------------------------------------
|
| Prefixo final: /api/v1. Documentação em docs/api.md.
| Rotas dentro de organizations/{organization} passam por auth:sanctum e
| organization.member, e usam scopeBindings() para que todo registro filho
| seja buscado dentro do espaço da rota.
|
*/

Route::prefix('v1')->group(function () {

    // Autenticação pública (limitada por IP)
    Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('auth/token', [AuthController::class, 'token'])->middleware('throttle:10,1');

    // Recuperação de senha: resposta idêntica exista a conta ou não; tentativas limitadas por IP
    Route::post('auth/forgot-password', [PasswordController::class, 'forgot'])->middleware('throttle:5,1');
    Route::post('auth/reset-password', [PasswordController::class, 'reset'])->middleware('throttle:10,1');

    // Link de confirmação de e-mail (assinado, enviado por e-mail)
    Route::get('auth/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
        ->middleware(['signed', 'throttle:6,1'])
        ->name('verification.verify');

    Route::middleware('auth:sanctum')->group(function () {

        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('auth/password', [PasswordController::class, 'change'])->middleware('throttle:10,1');
        Route::get('auth/user', [AuthController::class, 'user']);
        Route::post('auth/email/verification-notification', [EmailVerificationController::class, 'resend'])
            ->middleware('throttle:6,1');

        // Perfil profissional da própria conta e agenda pessoal
        Route::get('me/instructor', [MeInstructorController::class, 'show']);
        Route::post('me/instructor', [MeInstructorController::class, 'store']);
        Route::patch('me/instructor', [MeInstructorController::class, 'update']);
        Route::get('me/lessons', [MyLessonController::class, 'index']);

        // Espaços
        Route::get('organizations', [OrganizationController::class, 'index']);
        Route::post('organizations', [OrganizationController::class, 'store']);

        // Aceite de convite: somente o token no corpo da requisição
        Route::post('invitations/accept', InvitationAcceptController::class)->middleware('throttle:20,1');

        Route::prefix('organizations/{organization}')
            ->middleware(['organization.member', 'idempotent'])
            ->scopeBindings()
            ->group(function () {

                Route::get('/', [OrganizationController::class, 'show']);
                Route::get('onboarding', [OnboardingController::class, 'show']);
                Route::patch('/', [OrganizationController::class, 'update']);

                // Membros (acesso)
                Route::get('members', [OrganizationMemberController::class, 'index']);
                Route::patch('members/{member}', [OrganizationMemberController::class, 'update']);
                Route::delete('members/{member}', [OrganizationMemberController::class, 'destroy']);

                // Convites
                Route::get('invitations', [InvitationController::class, 'index']);
                Route::post('invitations', [InvitationController::class, 'store']);
                Route::delete('invitations/{invitation}', [InvitationController::class, 'destroy']);

                // Instrutores (identidade + vínculo com o espaço)
                Route::get('instructors', [OrganizationInstructorController::class, 'index']);
                Route::post('instructors', [OrganizationInstructorController::class, 'store']);
                Route::get('instructors/{instructor}', [OrganizationInstructorController::class, 'show']);
                Route::patch('instructors/{instructor}', [OrganizationInstructorController::class, 'update']);
                Route::patch('instructors/{instructor}/link', [OrganizationInstructorController::class, 'link']);

                // Cadastros operacionais
                Route::apiResource('partners', PartnerController::class);
                Route::post('partners/{partner}/restore', [PartnerController::class, 'restore'])->withTrashed();
                Route::apiResource('students', StudentController::class);
                Route::post('students/{student}/restore', [StudentController::class, 'restore'])->withTrashed();
                Route::apiResource('enrollments', EnrollmentController::class)
                    ->only(['index', 'store', 'show', 'update']);

                // Pacotes e saldo de aulas
                Route::get('enrollments/{enrollment}/balance', [EnrollmentBalanceController::class, 'show']);
                Route::get('enrollments/{enrollment}/credit-entries', [EnrollmentBalanceController::class, 'entries']);
                Route::post('enrollments/{enrollment}/packages', [EnrollmentBalanceController::class, 'storePackage']);
                Route::post('enrollments/{enrollment}/credit-adjustments', [EnrollmentBalanceController::class, 'adjust']);
                Route::post('enrollments/{enrollment}/credit-entries/{credit_entry}/reversal', [EnrollmentBalanceController::class, 'reverse']);

                // Veículos
                Route::apiResource('vehicles', VehicleController::class);
                Route::post('vehicles/{vehicle}/restore', [VehicleController::class, 'restore'])->withTrashed();

                // Disponibilidade e frota: bloqueios, manutenção, detalhe do veículo e do instrutor
                Route::get('availability-blocks', [AvailabilityBlockController::class, 'index']);
                Route::get('availability-blocks/impact', [AvailabilityBlockController::class, 'impact']);
                Route::post('availability-blocks', [AvailabilityBlockController::class, 'store']);
                Route::patch('availability-blocks/{availability_block}', [AvailabilityBlockController::class, 'update']);
                Route::post('availability-blocks/{availability_block}/release', [AvailabilityBlockController::class, 'release']);
                Route::get('maintenances', [MaintenanceController::class, 'index']);
                Route::post('maintenances', [MaintenanceController::class, 'store']);
                Route::get('maintenances/{maintenance}', [MaintenanceController::class, 'show']);
                Route::patch('maintenances/{maintenance}', [MaintenanceController::class, 'update']);
                Route::post('maintenances/{maintenance}/complete', [MaintenanceController::class, 'complete']);
                Route::post('maintenances/{maintenance}/cancel', [MaintenanceController::class, 'cancel']);
                Route::get('vehicles/{vehicle}/overview', [FleetOverviewController::class, 'vehicle']);
                Route::get('vehicles/{vehicle}/commitments', [FleetOverviewController::class, 'vehicleCommitments']);
                Route::get('instructors/{instructor}/availability', [FleetOverviewController::class, 'instructor']);
                Route::put('instructors/{instructor}/weekly-hours', [FleetOverviewController::class, 'updateWeeklyHours']);
                Route::get('instructors/{instructor}/commitments', [FleetOverviewController::class, 'instructorCommitments']);

                // Processos de habilitação e checklist de liberação para a prática
                Route::apiResource('qualification-processes', QualificationProcessController::class)
                    ->only(['index', 'store', 'show', 'update']);
                Route::post('qualification-processes/{qualification_process}/checklist-items', [ChecklistItemController::class, 'store']);
                Route::patch('qualification-processes/{qualification_process}/checklist-items/{checklist_item}', [ChecklistItemController::class, 'update']);

                // Desfecho do processo, linha do tempo e auditoria
                Route::get('qualification-processes/{qualification_process}/closure-check', [ProcessOutcomeController::class, 'closureCheck']);
                Route::post('qualification-processes/{qualification_process}/issuance', [ProcessOutcomeController::class, 'issuance']);
                Route::post('qualification-processes/{qualification_process}/close', [ProcessOutcomeController::class, 'close']);
                Route::post('qualification-processes/{qualification_process}/reopen', [ProcessOutcomeController::class, 'reopen']);
                Route::post('qualification-processes/{qualification_process}/categories/{category}/renunciation', [ProcessOutcomeController::class, 'renounce']);
                Route::post('qualification-processes/{qualification_process}/categories/{category}/renunciation/confirm', [ProcessOutcomeController::class, 'confirmRenunciation']);
                Route::post('qualification-processes/{qualification_process}/categories/{category}/renunciation/revert', [ProcessOutcomeController::class, 'revertRenunciation']);
                Route::get('qualification-processes/{qualification_process}/timeline', [TimelineController::class, 'process']);
                Route::get('students/{student}/timeline', [TimelineController::class, 'student']);
                Route::get('audit-events', [TimelineController::class, 'organization']);

                // Exames práticos e taxas externas
                Route::get('exams', [PracticalExamController::class, 'index']);
                Route::post('exams', [PracticalExamController::class, 'store']);
                Route::get('exams/{exam}', [PracticalExamController::class, 'show']);
                Route::patch('exams/{exam}', [PracticalExamController::class, 'update']);
                Route::post('exams/{exam}/reschedule', [PracticalExamController::class, 'reschedule']);
                Route::post('exams/{exam}/result', [PracticalExamController::class, 'result']);
                Route::post('exams/{exam}/result-correction', [PracticalExamController::class, 'correct']);
                Route::get('external-fees', [ExternalFeeController::class, 'index']);
                Route::post('external-fees', [ExternalFeeController::class, 'store']);
                Route::get('external-fees/{external_fee}', [ExternalFeeController::class, 'show']);
                Route::patch('external-fees/{external_fee}', [ExternalFeeController::class, 'update']);
                Route::post('external-fees/{external_fee}/status', [ExternalFeeController::class, 'status']);
                Route::post('external-fees/{external_fee}/reimbursement', [ExternalFeeController::class, 'reimbursement']);

                // Central de pendências (o sino)
                Route::get('alerts', [AlertController::class, 'index']);
                Route::get('alerts/summary', [AlertController::class, 'summary']);
                Route::post('alerts/read-all', [AlertController::class, 'readAll']);
                Route::post('alerts/refresh', [AlertController::class, 'refresh'])->middleware('throttle:30,1');
                Route::post('alerts/{alert}/read', [AlertController::class, 'read']);
                Route::post('alerts/{alert}/archive', [AlertController::class, 'archive']);
                Route::post('alerts/{alert}/unarchive', [AlertController::class, 'unarchive']);
                Route::get('alert-settings', [AlertController::class, 'settings']);
                Route::patch('alert-settings', [AlertController::class, 'updateSettings']);

                // Relatórios e painel (equipe; o instrutor só tem o painel e o próprio resumo)
                Route::get('reports/dashboard', [ReportController::class, 'dashboard']);
                Route::get('reports/my-summary', [ReportController::class, 'mySummary']);
                Route::get('reports/lessons', [ReportController::class, 'lessons']);
                Route::get('reports/lessons/detail', [ReportController::class, 'lessonDetail']);
                Route::get('reports/lessons/export', [ReportController::class, 'lessonExport'])->middleware('throttle:20,1');
                Route::get('reports/exams', [ReportController::class, 'exams']);
                Route::get('reports/exams/detail', [ReportController::class, 'examDetail']);
                Route::get('reports/exams/export', [ReportController::class, 'examExport'])->middleware('throttle:20,1');
                Route::get('reports/utilization', [ReportController::class, 'utilization']);
                Route::get('reports/processes', [ReportController::class, 'processes']);
                Route::get('reports/partners', [ReportController::class, 'partners']);
                Route::get('students/{student}/summary', [ReportController::class, 'studentSummary']);

                // Documentos privados
                Route::get('documents', [DocumentController::class, 'index']);
                Route::post('documents', [DocumentController::class, 'store']);
                Route::get('documents/{document}', [DocumentController::class, 'show']);
                Route::patch('documents/{document}', [DocumentController::class, 'update']);
                Route::get('documents/{document}/versions', [DocumentController::class, 'versions']);
                Route::get('documents/{document}/download', [DocumentController::class, 'download']);

                // Aulas
                Route::get('lessons', [LessonController::class, 'index']);
                Route::post('lessons', [LessonController::class, 'store']);
                Route::get('lessons/{lesson}', [LessonController::class, 'show']);
                Route::patch('lessons/{lesson}', [LessonController::class, 'update']);
                Route::patch('lessons/{lesson}/registry', [LessonController::class, 'registry']);
                Route::post('lessons/{lesson}/reschedule', [LessonController::class, 'reschedule']);
                Route::post('lessons/{lesson}/reassign', [LessonController::class, 'reassign']);
                Route::patch('lessons/{lesson}/status', [LessonController::class, 'updateStatus']);
            });
    });
});
