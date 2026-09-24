<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A-25: idempotent in-app notifications. Additive only: existing rows keep event_key NULL
 * (NULLs never collide in a unique index on MySQL/SQLite), new event notifications carry a
 * deterministic key so webhook replays / retries cannot create a second row per recipient.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('event_key', 160)->nullable()->after('user_id');
            $table->unique(['user_id', 'event_key'], 'notifications_user_event_unique');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropUnique('notifications_user_event_unique');
            $table->dropColumn('event_key');
        });
    }
};
