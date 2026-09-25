<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * IMP-004: additive shipping support.
 *
 * - products.weight_grams / product_variants.weight_grams: authoritative physical
 *   weight in grams (nullable = not set; physical checkout requires it).
 * - orders: shipping_cost into the authoritative total + full shipping/address
 *   snapshot so historical orders never need a live RajaOngkir lookup.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('weight_grams')->nullable()->after('stock');
        });
        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedInteger('weight_grams')->nullable()->after('stock');
        });
        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedInteger('shipping_cost')->default(0)->after('discount_amount');
            $table->unsignedInteger('shipping_weight_grams')->nullable()->after('shipping_cost');
            $table->string('shipping_courier', 30)->nullable()->after('shipping_weight_grams');
            $table->string('shipping_courier_name', 80)->nullable()->after('shipping_courier');
            $table->string('shipping_service', 60)->nullable()->after('shipping_courier_name');
            $table->string('shipping_service_name', 120)->nullable()->after('shipping_service');
            $table->string('shipping_etd', 60)->nullable()->after('shipping_service_name');
            $table->string('shipping_province_id', 20)->nullable()->after('shipping_phone');
            $table->string('shipping_province_name', 120)->nullable()->after('shipping_province_id');
            $table->string('shipping_city_id', 20)->nullable()->after('shipping_province_name');
            $table->string('shipping_city_name', 120)->nullable()->after('shipping_city_id');
            $table->string('shipping_district_id', 20)->nullable()->after('shipping_city_name');
            $table->string('shipping_district_name', 120)->nullable()->after('shipping_district_id');
            $table->string('shipping_subdistrict_id', 20)->nullable()->after('shipping_district_name');
            $table->string('shipping_subdistrict_name', 120)->nullable()->after('shipping_subdistrict_id');
            $table->string('shipping_postal_code', 10)->nullable()->after('shipping_subdistrict_name');
            $table->text('shipping_note')->nullable()->after('shipping_postal_code');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['shipping_cost', 'shipping_weight_grams', 'shipping_courier',
                'shipping_courier_name', 'shipping_service', 'shipping_service_name', 'shipping_etd',
                'shipping_province_id', 'shipping_province_name', 'shipping_city_id', 'shipping_city_name',
                'shipping_district_id', 'shipping_district_name', 'shipping_subdistrict_id',
                'shipping_subdistrict_name', 'shipping_postal_code', 'shipping_note']);
        });
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('weight_grams');
        });
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('weight_grams');
        });
    }
};
