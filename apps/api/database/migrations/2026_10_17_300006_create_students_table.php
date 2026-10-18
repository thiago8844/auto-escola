<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Alunos pertencem a uma única organização e a uma autoescola (o espaço ou um parceiro). CPF não é global: alunos de
     * CFCs diferentes nunca são unificados automaticamente.
     */
    public function up(): void
    {
        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->string('name', 150);
            $table->char('cpf', 11)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('phone', 30)->nullable();
            $table->date('birth_date')->nullable();
            // Identidade e órgão expedidor (ex.: SSP/MG): exigidos na inscrição do exame.
            $table->string('identity_number', 20)->nullable();
            $table->string('identity_issuer', 20)->nullable();
            // Autoescola do aluno: um parceiro do espaço. Nulo significa o próprio espaço (só válido em autoescola;
            // no espaço particular de instrutor a API exige o parceiro).
            $table->unsignedBigInteger('partner_id')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['organization_id', 'cpf']);
            $table->unique(['organization_id', 'id']);
            $table->foreign(['organization_id', 'partner_id'], 'students_partner_fk')
                ->references(['organization_id', 'id'])->on('partners')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('students');
    }
};
