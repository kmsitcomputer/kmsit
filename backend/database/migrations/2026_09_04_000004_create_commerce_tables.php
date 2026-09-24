<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('user_id', 12);
            $table->enum('type', ['course', 'shop']);
            $table->enum('status', ['pending', 'paid', 'failed', 'expired'])->default('pending');
            $table->unsignedInteger('subtotal')->default(0);
            $table->unsignedInteger('discount_amount')->default(0);
            $table->string('voucher_code', 40)->nullable();
            $table->unsignedInteger('gateway_fee')->default(0);
            $table->unsignedInteger('total')->default(0);
            $table->string('currency', 3)->default('IDR');
            $table->timestamp('paid_at')->nullable();
            $table->boolean('needs_shipping')->default(false);
            $table->string('shipping_name', 120)->nullable();
            $table->text('shipping_address')->nullable();
            $table->string('shipping_phone', 30)->nullable();
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['user_id', 'status']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('order_id', 12);
            $table->enum('kind', ['course', 'product']);
            $table->string('ref_id', 12);
            $table->string('title', 190);
            $table->unsignedInteger('price')->default(0);
            $table->unsignedInteger('qty')->default(1);
            $table->string('instructor_id', 12)->nullable();
            $table->text('thumbnail')->nullable();
            $table->string('variant_id', 12)->nullable();
            $table->string('variant_label', 120)->nullable();
            $table->boolean('is_digital')->default(false);
            $table->timestamps();
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();
            $table->index(['kind', 'ref_id']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('order_id', 12);
            $table->enum('gateway', ['tripay', 'xendit', 'stripe']);
            $table->enum('mode', ['sandbox', 'live'])->default('sandbox');
            $table->string('method', 60);
            $table->string('reference', 80)->unique();
            $table->string('merchant_ref', 80);
            $table->unsignedInteger('amount')->default(0);
            $table->unsignedInteger('fee')->default(0);
            $table->enum('status', ['pending', 'paid', 'failed', 'expired'])->default('pending');
            $table->string('signature', 128);
            $table->json('events')->nullable();
            $table->timestamps();
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();
            $table->index(['order_id', 'status']);
        });

        Schema::create('webhook_logs', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('reference', 80);
            $table->string('payload_hash', 128)->unique();
            $table->enum('gateway', ['tripay', 'xendit', 'stripe']);
            $table->string('status', 20);
            $table->enum('result', ['processed', 'duplicate', 'invalid']);
            $table->timestamps();
            $table->index('reference');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webhook_logs');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
