<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Aula com veículo, duração real, motivo, evolução pedagógica e situação do registro oficial.
     * A duração agendada continua sendo starts_at/ends_at; actual_minutes guarda o realizado.
     */
    public function up(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            $table->unsignedBigInteger('vehicle_id')->nullable()->after('instructor_id');
            $table->unsignedSmallInteger('actual_minutes')->nullable()->after('ends_at');
            $table->string('status_reason', 255)->nullable()->after('status');
            $table->text('evolution')->nullable()->after('notes');
            $table->enum('registry_status', ['not_informed', 'pending', 'confirmed', 'rejected'])
                ->default('not_informed')->after('evolution');
            $table->string('registry_reference', 100)->nullable()->after('registry_status');
            $table->unsignedBigInteger('registry_document_id')->nullable()->after('registry_reference');

            $table->index(['vehicle_id', 'status', 'starts_at']);
            $table->foreign(['organization_id', 'vehicle_id'], 'lessons_vehicle_fk')
                ->references(['organization_id', 'id'])->on('vehicles')->restrictOnDelete();
            $table->foreign(['organization_id', 'registry_document_id'], 'lessons_registry_document_fk')
                ->references(['organization_id', 'id'])->on('documents')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            $table->dropForeign('lessons_vehicle_fk');
            $table->dropForeign('lessons_registry_document_fk');
            $table->dropIndex(['vehicle_id', 'status', 'starts_at']);
            $table->dropColumn([
                'vehicle_id', 'actual_minutes', 'status_reason', 'evolution',
                'registry_status', 'registry_reference', 'registry_document_id',
            ]);
        });
    }
};
