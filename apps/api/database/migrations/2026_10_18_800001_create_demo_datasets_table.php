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
        Schema::create('demo_datasets', function (Blueprint $table) {
            $table->string('key', 60)->primary();
            $table->foreignId('organization_id')->unique()->constrained('organizations')->restrictOnDelete();
            $table->foreignId('user_id')->unique()->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });

        Schema::create('demo_dataset_users', function (Blueprint $table) {
            $table->foreignId('user_id')->unique()->constrained('users')->restrictOnDelete();
            $table->string('dataset_key', 60);
            $table->foreign('dataset_key')->references('key')->on('demo_datasets')->cascadeOnDelete();
            $table->primary(['dataset_key', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('demo_dataset_users');
        Schema::dropIfExists('demo_datasets');
    }
};
