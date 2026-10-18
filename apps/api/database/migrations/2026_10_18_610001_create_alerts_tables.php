<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Central de pendências: o alerta é do espaço (uma linha por pendência, deduplicada por `dedup_key`);
     * leitura e arquivamento são por usuário. A visibilidade é calculada a cada consulta pelo papel atual.
     */
    public function up(): void
    {
        Schema::create('alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->string('kind', 40);
            $table->string('category', 20);
            $table->string('dedup_key', 120);
            $table->string('priority', 8)->default('normal');       // low | normal | high | critical
            $table->string('title', 160);
            $table->string('message', 500)->nullable();
            $table->string('subject_type', 24)->nullable();         // vehicle, student, enrollment, exam, lesson, fee, process, instructor, document
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('audience', 12)->default('staff');       // staff | instructor | both
            $table->unsignedBigInteger('instructor_id')->nullable();
            $table->date('due_on')->nullable();
            $table->string('status', 10)->default('open');          // open | resolved
            $table->dateTime('resolved_at')->nullable();
            $table->string('resolved_reason', 120)->nullable();
            $table->dateTime('first_seen_at');
            $table->dateTime('last_seen_at');
            $table->timestamps();

            $table->unique(['organization_id', 'dedup_key']);
            $table->index(['organization_id', 'status', 'priority']);
            $table->index(['organization_id', 'instructor_id', 'status']);
        });

        Schema::create('alert_user_states', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alert_id')->constrained('alerts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->dateTime('read_at')->nullable();
            $table->dateTime('archived_at')->nullable();
            $table->timestamps();

            $table->unique(['alert_id', 'user_id']);
        });

        // Antecedência, prazos e destinatários dos alertas; nulo = padrões do sistema.
        Schema::table('organizations', function (Blueprint $table) {
            $table->json('alert_settings')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('organizations', fn (Blueprint $table) => $table->dropColumn('alert_settings'));
        Schema::dropIfExists('alert_user_states');
        Schema::dropIfExists('alerts');
    }
};
