<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Endereço do espaço (rua e número, cidade e UF). Todos opcionais.
     */
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('address', 255)->nullable()->after('phone');
            $table->string('city', 100)->nullable()->after('address');
            $table->string('state', 2)->nullable()->after('city');
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn(['address', 'city', 'state']);
        });
    }
};
