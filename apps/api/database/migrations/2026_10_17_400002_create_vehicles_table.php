<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Veículos de instrução. Pertencem a uma organização; a categoria é sempre simples (A, B, C, D, E ou ACC).
     */
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->string('plate', 8);
            $table->string('brand', 60)->nullable();
            $table->string('model', 80);
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('category', 3);
            $table->boolean('adapted')->default(false);
            $table->text('adaptations')->nullable();
            $table->date('crlv_expires_at')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Placa única no espaço (inclui veículos excluídos logicamente).
            $table->unique(['organization_id', 'plate']);
            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
