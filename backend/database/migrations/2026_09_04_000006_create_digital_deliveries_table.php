<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('digital_deliveries', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('user_id', 12);
            $table->string('product_id', 12);
            $table->string('order_item_id', 12)->nullable();
            $table->string('license_key', 60)->unique();
            $table->text('download_url')->nullable();
            $table->unsignedInteger('downloads')->default(0);
            $table->enum('status', ['active', 'revoked'])->default('active');
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            $table->foreign('order_item_id')->references('id')->on('order_items')->nullOnDelete();
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('digital_deliveries');
    }
};
