<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pacotes (contratações/acréscimos) e livro-razão de minutos por matrícula.
     * O saldo nunca é gravado: sempre calculado sobre todos os movimentos.
     */
    public function up(): void
    {
        Schema::create('enrollment_packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->unsignedBigInteger('enrollment_id');
            $table->string('kind', 20)->default('contract'); // contract | addition | initial
            $table->string('category', 3)->nullable();
            $table->string('description', 150);
            $table->unsignedInteger('minutes');
            $table->unsignedSmallInteger('reference_minutes')->nullable();
            $table->unsignedBigInteger('price_cents')->nullable();
            $table->string('consume_basis', 12)->default('actual'); // actual | scheduled
            $table->string('absence_charge', 8)->default('none'); // none | full
            $table->string('late_cancel_charge', 8)->default('none'); // none | full
            $table->unsignedSmallInteger('cancel_notice_hours')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'enrollment_id']);
            $table->foreign(['organization_id', 'enrollment_id'])
                ->references(['organization_id', 'id'])->on('enrollments')->restrictOnDelete();
        });

        Schema::create('enrollment_credit_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->unsignedBigInteger('enrollment_id');
            $table->unsignedBigInteger('package_id')->nullable();
            $table->unsignedBigInteger('lesson_id')->nullable();
            $table->unsignedBigInteger('reverses_entry_id')->nullable();
            // credit = contratado; reserve = reservado em aula agendada; consume = consumo comercial
            $table->string('bucket', 8);
            $table->string('type', 24);
            $table->string('category', 3)->nullable();
            $table->integer('minutes');
            $table->string('reason', 255)->nullable();
            $table->string('dedupe_key', 80)->nullable()->unique();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('occurred_at')->useCurrent();

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'enrollment_id', 'bucket'], 'credit_entries_enrollment_idx');
            $table->index('lesson_id');
            $table->foreign(['organization_id', 'enrollment_id'])
                ->references(['organization_id', 'id'])->on('enrollments')->restrictOnDelete();
        });

        Schema::table('lessons', function (Blueprint $table) {
            $table->string('category', 3)->nullable()->after('vehicle_id');
        });
    }

    public function down(): void
    {
        Schema::table('lessons', fn (Blueprint $table) => $table->dropColumn('category'));
        Schema::dropIfExists('enrollment_credit_entries');
        Schema::dropIfExists('enrollment_packages');
    }
};
