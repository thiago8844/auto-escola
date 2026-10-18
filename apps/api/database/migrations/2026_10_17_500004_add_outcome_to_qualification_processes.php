<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Desfecho: emissão do documento, encerramento e renúncia por categoria.
     */
    public function up(): void
    {
        Schema::table('qualification_processes', function (Blueprint $table) {
            $table->string('issuance_status', 12)->default('not_started')->after('status'); // not_started|pending|issued|delivered
            $table->string('issuance_kind', 4)->nullable()->after('issuance_status');       // ppd | cnh
            $table->string('issuance_reference', 100)->nullable()->after('issuance_kind');
            $table->date('issued_at')->nullable()->after('issuance_reference');
            $table->date('delivered_at')->nullable()->after('issued_at');
            $table->unsignedBigInteger('issuance_document_id')->nullable()->after('delivered_at');
            $table->boolean('definitive_follow_up')->default(false)->after('issuance_document_id');
            $table->date('definitive_due_at')->nullable()->after('definitive_follow_up');
            $table->string('closure_kind', 12)->nullable()->after('definitive_due_at'); // completed|abandoned|other
            $table->string('closure_reason', 255)->nullable()->after('closure_kind');
            $table->timestamp('closed_at')->nullable()->after('closure_reason');
            $table->foreign(['organization_id', 'issuance_document_id'], 'processes_issuance_doc_fk')
                ->references(['organization_id', 'id'])->on('documents')->restrictOnDelete();
        });

        Schema::create('process_category_tracks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->unsignedBigInteger('qualification_process_id');
            $table->string('category', 3);
            $table->timestamp('renounced_at')->nullable();
            $table->string('renunciation_reason', 255)->nullable();
            $table->timestamp('renunciation_confirmed_at')->nullable();
            $table->string('renunciation_reference', 100)->nullable();
            $table->timestamps();

            $table->unique(['qualification_process_id', 'category']);
            $table->foreign(['organization_id', 'qualification_process_id'], 'tracks_process_fk')
                ->references(['organization_id', 'id'])->on('qualification_processes')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('process_category_tracks');
        Schema::table('qualification_processes', function (Blueprint $table) {
            $table->dropForeign('processes_issuance_doc_fk');
            $table->dropColumn([
                'issuance_status', 'issuance_kind', 'issuance_reference', 'issued_at', 'delivered_at',
                'issuance_document_id', 'definitive_follow_up', 'definitive_due_at',
                'closure_kind', 'closure_reason', 'closed_at',
            ]);
        });
    }
};
