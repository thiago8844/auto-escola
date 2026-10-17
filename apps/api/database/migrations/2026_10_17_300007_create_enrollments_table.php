<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Matrículas: aluno + categoria dentro de uma organização, com parceiro opcional.
     */
    public function up(): void
    {
        Schema::create('enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->unsignedBigInteger('student_id');
            $table->unsignedBigInteger('partner_id')->nullable();
            $table->string('category', 3);
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'student_id']);

            // FKs compostas: aluno e parceiro precisam pertencer à mesma organização da matrícula.
            $table->foreign(['organization_id', 'student_id'])
                ->references(['organization_id', 'id'])->on('students')->restrictOnDelete();
            $table->foreign(['organization_id', 'partner_id'])
                ->references(['organization_id', 'id'])->on('partners')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('enrollments');
    }
};
