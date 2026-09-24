<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Align sessions.user_id type with users.id (VARCHAR 12) instead of BIGINT (A-22).
     * MySQL-safe: the original table has no foreign key, so it is only dropped when present;
     * orphaned user_id values are cleared before the constraint is added (sessions are
     * ephemeral, so clearing an unknown owner only logs that browser out).
     */
    public function up(): void
    {
        $this->dropUserForeignKeyIfExists();

        Schema::table('sessions', function (Blueprint $table) {
            $table->string('user_id', 12)->nullable()->change();
        });

        DB::table('sessions')->whereNotNull('user_id')
            ->whereNotIn('user_id', DB::table('users')->select('id'))
            ->update(['user_id' => null]);

        Schema::table('sessions', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    /**
     * Back to the framework default (BIGINT, no foreign key). String ids cannot be represented
     * as integers, so session ownership is cleared first; affected browsers must log in again.
     */
    public function down(): void
    {
        $this->dropUserForeignKeyIfExists();
        DB::table('sessions')->update(['user_id' => null]);

        Schema::table('sessions', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable()->change();
        });
    }

    private function dropUserForeignKeyIfExists(): void
    {
        $exists = collect(Schema::getForeignKeys('sessions'))
            ->contains(fn (array $fk) => $fk['columns'] === ['user_id']);
        if (!$exists) return;

        Schema::table('sessions', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
        });
    }
};
