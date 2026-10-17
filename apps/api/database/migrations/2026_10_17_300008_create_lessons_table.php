<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Aulas. Cada aula existe uma única vez, na organização que a criou.
     * O instrutor é global, mas só pode ser atribuído via vínculo profissional da organização.
     */
    public function up(): void
    {
        Schema::create('lessons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->unsignedBigInteger('enrollment_id');
            $table->unsignedBigInteger('instructor_id');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->enum('status', ['scheduled', 'completed', 'missed', 'cancelled'])->default('scheduled');
            $table->text('notes')->nullable();
            $table->timestamps();

            // Consulta de conflito entre organizações: todas as aulas agendadas de um instrutor.
            $table->index(['instructor_id', 'status', 'starts_at']);
            $table->index(['organization_id', 'starts_at']);
            $table->index(['organization_id', 'status']);

            $table->foreign(['organization_id', 'enrollment_id'])
                ->references(['organization_id', 'id'])->on('enrollments')->restrictOnDelete();
            $table->foreign(['organization_id', 'instructor_id'])
                ->references(['organization_id', 'instructor_id'])->on('organization_instructor')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lessons');
    }
};
