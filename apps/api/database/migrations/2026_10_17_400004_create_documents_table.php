<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Documentos privados. O arquivo fica em disco privado (nunca em URL pública);
     * a tabela guarda metadados e o histórico de substituição (replaces_document_id).
     */
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->string('type', 40);
            $table->enum('status', ['attached', 'verified', 'rejected', 'replaced'])->default('attached');

            // Titular: ao menos um dos três (validado na API).
            $table->unsignedBigInteger('student_id')->nullable();
            $table->unsignedBigInteger('qualification_process_id')->nullable();
            $table->unsignedBigInteger('vehicle_id')->nullable();

            $table->unsignedBigInteger('replaces_document_id')->nullable();
            $table->unsignedSmallInteger('version')->default(1);

            $table->string('issuer', 150)->nullable();
            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->text('notes')->nullable();

            $table->string('storage_path', 255);
            $table->string('original_name', 255);
            $table->string('mime_type', 100);
            $table->unsignedInteger('size');

            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'student_id']);
            $table->index(['organization_id', 'qualification_process_id']);
            $table->index(['organization_id', 'vehicle_id']);
            $table->index(['organization_id', 'type']);

            $table->foreign(['organization_id', 'student_id'])
                ->references(['organization_id', 'id'])->on('students')->restrictOnDelete();
            $table->foreign(['organization_id', 'qualification_process_id'])
                ->references(['organization_id', 'id'])->on('qualification_processes')->restrictOnDelete();
            $table->foreign(['organization_id', 'vehicle_id'])
                ->references(['organization_id', 'id'])->on('vehicles')->restrictOnDelete();
            $table->foreign(['organization_id', 'replaces_document_id'])
                ->references(['organization_id', 'id'])->on('documents')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
