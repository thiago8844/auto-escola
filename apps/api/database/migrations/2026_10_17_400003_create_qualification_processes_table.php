<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Processo de habilitação: acompanhamento LOCAL de um atendimento (primeira habilitação,
     * adição, mudança ou aperfeiçoamento). Guarda referências oficiais, mas não é o sistema oficial.
     */
    public function up(): void
    {
        Schema::create('qualification_processes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->unsignedBigInteger('student_id');
            $table->enum('type', ['first_license', 'category_addition', 'category_change', 'refresher']);
            $table->char('uf', 2);
            $table->string('municipality', 100)->nullable();
            $table->string('renach', 30)->nullable();
            $table->string('protocol', 50)->nullable();
            $table->date('opened_at')->nullable();
            $table->json('current_categories');
            $table->json('target_categories');
            $table->enum('status', ['preparing', 'active', 'pending', 'awaiting_issuance', 'completed', 'closed'])
                ->default('preparing');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'student_id']);
            $table->index(['organization_id', 'status']);

            $table->foreign(['organization_id', 'student_id'])
                ->references(['organization_id', 'id'])->on('students')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qualification_processes');
    }
};
