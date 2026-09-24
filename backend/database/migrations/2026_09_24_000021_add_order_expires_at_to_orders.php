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
        Schema::table('orders', function (Blueprint $table) {
            // Universal expiry for ALL pending orders — stock is reclaimed when expired.
            // This prevents permanent inventory lock when gateways don't send expiry events.
            $table->timestamp('expires_at')->nullable()->after('paid_at');
            $table->index(['status', 'expires_at'], 'orders_expiry_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_expiry_index');
            $table->dropColumn('expires_at');
        });
    }
};
