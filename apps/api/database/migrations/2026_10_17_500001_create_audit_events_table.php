<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Trilha de auditoria append-only das ações críticas. Nunca é editada: correções geram novos eventos.
     */
    public function up(): void
    {
        Schema::create('audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event', 60);
            $table->string('category', 20);
            $table->string('summary', 255);
            $table->text('reason')->nullable();
            $table->json('changes')->nullable();
            $table->unsignedBigInteger('student_id')->nullable();
            $table->unsignedBigInteger('qualification_process_id')->nullable();
            $table->unsignedBigInteger('enrollment_id')->nullable();
            $table->string('subject_type', 40)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['organization_id', 'created_at']);
            $table->index(['organization_id', 'student_id', 'created_at']);
            $table->index(['organization_id', 'qualification_process_id', 'created_at'], 'audit_process_idx');
            $table->index(['organization_id', 'enrollment_id', 'created_at'], 'audit_enrollment_idx');
            $table->index(['organization_id', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_events');
    }
};
