<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('lesson_communications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->foreignId('lesson_id')->constrained('lessons')->restrictOnDelete();
            $table->foreignId('student_id')->constrained('students')->restrictOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('channel', 24);
            $table->string('purpose', 40);
            $table->char('fingerprint', 64);
            $table->string('recipient', 160);
            $table->string('subject', 200)->nullable();
            $table->text('body');
            $table->string('status', 24);
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('marked_sent_at')->nullable();
            $table->timestamps();

            $table->unique(['lesson_id', 'channel', 'fingerprint'], 'lesson_communications_dedup');
            $table->index(['organization_id', 'student_id', 'created_at'], 'lesson_comms_student_history');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lesson_communications');
    }
};
