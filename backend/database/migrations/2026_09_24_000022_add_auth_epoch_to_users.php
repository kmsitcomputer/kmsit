<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add auth_epoch column to users table for session revocation across drivers.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('auth_epoch')->default(0)->after('remember_token');
            $table->index(['id', 'auth_epoch'], 'users_auth_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_auth_index');
            $table->dropColumn('auth_epoch');
        });
    }
};
