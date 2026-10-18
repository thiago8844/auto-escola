<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Disponibilidade e frota: bloqueios de agenda (veículo/instrutor), manutenção e horário de atendimento.
     *
     * Bloqueio de instrutor tem dois alcances: `organization` (vale só no espaço que o criou) e `personal`
     * (indisponibilidade pessoal do instrutor, vale em todos os espaços dele).
     */
    public function up(): void
    {
        Schema::create('vehicle_maintenances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->unsignedBigInteger('vehicle_id');
            $table->string('type', 60);
            $table->string('status', 12)->default('scheduled');   // scheduled | done | cancelled
            $table->date('scheduled_on');
            $table->date('performed_on')->nullable();
            $table->string('provider', 150)->nullable();
            $table->unsignedInteger('odometer_km')->nullable();
            $table->unsignedBigInteger('estimated_cost_cents')->nullable();
            $table->unsignedBigInteger('actual_cost_cents')->nullable();
            $table->unsignedBigInteger('document_id')->nullable();
            $table->date('next_due_date')->nullable();
            $table->unsignedInteger('next_due_km')->nullable();
            $table->text('notes')->nullable();
            // Referência única para a futura conta a pagar (módulo 8): evita lançamento duplicado.
            $table->char('finance_ref', 36)->unique();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'vehicle_id', 'status']);
            $table->index(['organization_id', 'next_due_date']);
            $table->foreign(['organization_id', 'vehicle_id'], 'maintenance_vehicle_fk')
                ->references(['organization_id', 'id'])->on('vehicles')->restrictOnDelete();
            $table->foreign(['organization_id', 'document_id'], 'maintenance_document_fk')
                ->references(['organization_id', 'id'])->on('documents')->restrictOnDelete();
        });

        Schema::create('availability_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->string('resource_type', 12);                    // vehicle | instructor
            $table->unsignedBigInteger('vehicle_id')->nullable();
            $table->unsignedBigInteger('instructor_id')->nullable();
            $table->string('scope', 12)->default('organization');  // organization | personal
            $table->string('kind', 16);                             // maintenance | absence | vacation | other
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('reason', 255)->nullable();
            $table->string('status', 10)->default('active');       // active | released
            $table->dateTime('released_at')->nullable();
            $table->foreignId('released_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('release_note', 255)->nullable();
            $table->unsignedBigInteger('maintenance_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->index(['vehicle_id', 'status', 'starts_at']);
            $table->index(['instructor_id', 'status', 'starts_at']);
            $table->index(['organization_id', 'status', 'ends_at']);
            $table->foreign(['organization_id', 'vehicle_id'], 'blocks_vehicle_fk')
                ->references(['organization_id', 'id'])->on('vehicles')->restrictOnDelete();
            $table->foreign(['organization_id', 'instructor_id'], 'blocks_instructor_fk')
                ->references(['organization_id', 'instructor_id'])->on('organization_instructor')->restrictOnDelete();
            $table->foreign(['organization_id', 'maintenance_id'], 'blocks_maintenance_fk')
                ->references(['organization_id', 'id'])->on('vehicle_maintenances')->restrictOnDelete();
        });

        // Horário de atendimento do espaço e disponibilidade semanal do instrutor.
        // JSON { "1": [{"start":"08:00","end":"12:00"}], ... } com 1 = segunda ... 7 = domingo.
        // Nulo = agenda livre (somente os bloqueios restringem).
        Schema::table('organizations', function (Blueprint $table) {
            $table->json('business_hours')->nullable();
        });
        Schema::table('organization_instructor', function (Blueprint $table) {
            $table->json('weekly_hours')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('organization_instructor', fn (Blueprint $table) => $table->dropColumn('weekly_hours'));
        Schema::table('organizations', fn (Blueprint $table) => $table->dropColumn('business_hours'));
        Schema::dropIfExists('availability_blocks');
        Schema::dropIfExists('vehicle_maintenances');
    }
};
