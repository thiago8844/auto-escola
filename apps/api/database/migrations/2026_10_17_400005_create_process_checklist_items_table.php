<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Checklist de liberação para a prática. Cada item tem situação, origem e quem conferiu.
     * Anexar documento não conclui o item: a conferência é um ato separado.
     */
    public function up(): void
    {
        Schema::create('process_checklist_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->unsignedBigInteger('qualification_process_id');
            $table->string('type', 40);
            $table->boolean('required')->default(true);
            $table->enum('status', ['unknown', 'pending', 'in_progress', 'done', 'verified', 'not_applicable', 'blocked'])
                ->default('pending');
            $table->enum('source', ['student_declared', 'document', 'official_system', 'imported'])->nullable();
            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();
            $table->date('occurred_on')->nullable();
            $table->unsignedBigInteger('document_id')->nullable();
            $table->foreignId('checked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('checked_at')->nullable();
            $table->timestamps();

            $table->unique(['qualification_process_id', 'type']);
            $table->unique(['organization_id', 'id']);

            $table->foreign(['organization_id', 'qualification_process_id'], 'checklist_process_fk')
                ->references(['organization_id', 'id'])->on('qualification_processes')->restrictOnDelete();
            $table->foreign(['organization_id', 'document_id'], 'checklist_document_fk')
                ->references(['organization_id', 'id'])->on('documents')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('process_checklist_items');
    }
};
