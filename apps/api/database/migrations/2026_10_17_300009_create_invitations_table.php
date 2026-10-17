<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Convites de acesso. Guarda apenas o hash SHA-256 do token; o token em texto
     * existe somente no e-mail enviado ao destinatário.
     */
    public function up(): void
    {
        Schema::create('invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->string('email', 150);
            $table->enum('role', ['owner', 'admin', 'staff', 'instructor']);
            $table->unsignedBigInteger('instructor_id')->nullable();
            $table->char('token_hash', 64)->unique();
            $table->foreignId('invited_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->foreignId('accepted_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'email']);

            // O perfil indicado no convite precisa estar vinculado profissionalmente à organização.
            $table->foreign(['organization_id', 'instructor_id'])
                ->references(['organization_id', 'instructor_id'])->on('organization_instructor')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invitations');
    }
};
