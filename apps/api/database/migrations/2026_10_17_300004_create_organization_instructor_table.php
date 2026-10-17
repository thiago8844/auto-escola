<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Vínculo profissional: permite atribuir aulas do instrutor dentro de uma organização.
     * Independente do vínculo de acesso (organization_user).
     */
    public function up(): void
    {
        Schema::create('organization_instructor', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->foreignId('instructor_id')->constrained('instructors')->restrictOnDelete();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['organization_id', 'instructor_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_instructor');
    }
};
