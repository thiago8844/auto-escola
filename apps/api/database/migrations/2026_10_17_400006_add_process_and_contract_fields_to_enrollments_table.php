<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Matrícula passa a ter situação comercial, serviço contratado (em minutos, para não
     * presumir "hora" ou "hora-aula"), preço e vínculo opcional com o processo.
     */
    public function up(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->unsignedBigInteger('qualification_process_id')->nullable()->after('partner_id');
            $table->enum('status', ['prospect', 'contracted', 'in_service', 'closed', 'terminated'])
                ->default('contracted')->after('category');
            $table->unsignedInteger('contracted_minutes')->nullable()->after('status');
            $table->unsignedBigInteger('price_cents')->nullable()->after('contracted_minutes');
            $table->text('notes')->nullable()->after('price_cents');

            $table->index(['organization_id', 'status']);
            $table->foreign(['organization_id', 'qualification_process_id'], 'enrollments_process_fk')
                ->references(['organization_id', 'id'])->on('qualification_processes')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropForeign('enrollments_process_fk');
            $table->dropIndex(['organization_id', 'status']);
            $table->dropColumn(['qualification_process_id', 'status', 'contracted_minutes', 'price_cents', 'notes']);
        });
    }
};
