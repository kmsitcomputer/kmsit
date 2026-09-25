<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * IMP-005: additive Local Delivery snapshot on orders. Existing shipping_cost
 * stays the authoritative shipping amount; these columns preserve the
 * delivery method, destination coordinates and actual route distance so
 * history never needs a live provider lookup.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('delivery_method', 20)->nullable()->after('needs_shipping');
            $table->decimal('delivery_latitude', 10, 7)->nullable()->after('shipping_note');
            $table->decimal('delivery_longitude', 10, 7)->nullable()->after('delivery_latitude');
            $table->unsignedInteger('delivery_distance_meters')->nullable()->after('delivery_longitude');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['delivery_method', 'delivery_latitude', 'delivery_longitude', 'delivery_distance_meters']);
        });
    }
};
