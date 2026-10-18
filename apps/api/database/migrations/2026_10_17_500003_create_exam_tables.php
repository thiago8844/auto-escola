<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tentativas de exame prático e taxas externas. Taxas não são receita nem caixa do espaço.
     */
    public function up(): void
    {
        Schema::create('practical_exams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->unsignedBigInteger('qualification_process_id');
            $table->unsignedBigInteger('student_id');
            $table->unsignedBigInteger('enrollment_id')->nullable();
            // Autoescola do exame: parceiro do espaço; nulo = o próprio espaço (autoescola).
            $table->unsignedBigInteger('partner_id')->nullable();
            $table->string('category', 3);
            $table->unsignedSmallInteger('attempt_number');
            $table->dateTime('scheduled_at');
            $table->string('location', 150)->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 12)->default('scheduled');
            $table->string('status_reason', 255)->nullable();
            $table->dateTime('result_at')->nullable();
            $table->unsignedBigInteger('instructor_id')->nullable();
            $table->unsignedBigInteger('vehicle_id')->nullable();
            $table->unsignedSmallInteger('reschedule_count')->default(0);
            $table->json('schedule_history')->nullable();   // remarcações por imprevisto, com motivo
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->unique(['qualification_process_id', 'category', 'attempt_number'], 'exam_attempt_unique');
            $table->index(['organization_id', 'scheduled_at']);
            $table->index(['organization_id', 'status']);
            $table->index(['instructor_id', 'status', 'scheduled_at']);
            $table->index(['vehicle_id', 'status', 'scheduled_at']);
            $table->foreign(['organization_id', 'qualification_process_id'], 'exams_process_fk')
                ->references(['organization_id', 'id'])->on('qualification_processes')->restrictOnDelete();
            $table->foreign(['organization_id', 'student_id'], 'exams_student_fk')
                ->references(['organization_id', 'id'])->on('students')->restrictOnDelete();
            $table->foreign(['organization_id', 'enrollment_id'], 'exams_enrollment_fk')
                ->references(['organization_id', 'id'])->on('enrollments')->restrictOnDelete();
            $table->foreign(['organization_id', 'partner_id'], 'exams_partner_fk')
                ->references(['organization_id', 'id'])->on('partners')->restrictOnDelete();
            $table->foreign(['organization_id', 'vehicle_id'], 'exams_vehicle_fk')
                ->references(['organization_id', 'id'])->on('vehicles')->restrictOnDelete();
            $table->foreign(['organization_id', 'instructor_id'], 'exams_instructor_fk')
                ->references(['organization_id', 'instructor_id'])->on('organization_instructor')->restrictOnDelete();
        });

        Schema::create('external_fees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->unsignedBigInteger('qualification_process_id');
            $table->unsignedBigInteger('student_id');
            $table->string('kind', 60);
            $table->string('voucher_number', 60)->nullable();
            $table->unsignedBigInteger('amount_cents')->nullable();
            $table->date('issued_at')->nullable();
            $table->date('due_date')->nullable();
            $table->string('reference', 100)->nullable();
            $table->string('status', 16)->default('unknown');
            $table->string('obligor', 12)->default('student');       // quem deve
            $table->string('paid_by', 12)->nullable();                // quem pagou de fato
            $table->string('reimbursement', 12)->default('none');     // none | to_settle | settled
            $table->string('status_reason', 255)->nullable();
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('confirmed_at')->nullable();
            $table->unsignedBigInteger('receipt_document_id')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'status']);
            $table->index(['organization_id', 'qualification_process_id']);
            $table->foreign(['organization_id', 'qualification_process_id'], 'fees_process_fk')
                ->references(['organization_id', 'id'])->on('qualification_processes')->restrictOnDelete();
            $table->foreign(['organization_id', 'student_id'], 'fees_student_fk')
                ->references(['organization_id', 'id'])->on('students')->restrictOnDelete();
            $table->foreign(['organization_id', 'receipt_document_id'], 'fees_receipt_fk')
                ->references(['organization_id', 'id'])->on('documents')->restrictOnDelete();
        });

        // Taxa compartilhada: um registro só, vinculado a várias tentativas (contado uma vez).
        Schema::create('external_fee_exam', function (Blueprint $table) {
            $table->unsignedBigInteger('external_fee_id');
            $table->unsignedBigInteger('practical_exam_id');
            $table->primary(['external_fee_id', 'practical_exam_id']);
            $table->foreign('external_fee_id')->references('id')->on('external_fees')->cascadeOnDelete();
            $table->foreign('practical_exam_id')->references('id')->on('practical_exams')->cascadeOnDelete();
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->unsignedBigInteger('practical_exam_id')->nullable()->after('vehicle_id');
            $table->index(['organization_id', 'practical_exam_id']);
            $table->foreign(['organization_id', 'practical_exam_id'], 'documents_exam_fk')
                ->references(['organization_id', 'id'])->on('practical_exams')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropForeign('documents_exam_fk');
            $table->dropColumn('practical_exam_id');
        });
        Schema::dropIfExists('external_fee_exam');
        Schema::dropIfExists('external_fees');
        Schema::dropIfExists('practical_exams');
    }
};
