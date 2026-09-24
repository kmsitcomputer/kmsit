<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('slug', 140)->unique();
            $table->string('name', 190);
            $table->longText('description')->nullable();
            $table->text('thumbnail')->nullable();
            $table->unsignedInteger('price')->default(0);
            $table->unsignedInteger('discount_price')->default(0);
            $table->unsignedInteger('stock')->default(0);
            $table->string('category_id', 12)->nullable();
            $table->enum('status', ['draft', 'published'])->default('draft');
            $table->boolean('featured')->default(false);
            $table->boolean('is_digital')->default(false);
            $table->text('digital_file_url')->nullable();
            $table->softDeletes();
            $table->timestamps();
            $table->foreign('category_id')->references('id')->on('categories')->nullOnDelete();
            $table->index(['status', 'featured']);
        });

        Schema::create('product_variants', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('product_id', 12);
            $table->string('label', 120);
            $table->unsignedInteger('price')->default(0);
            $table->unsignedInteger('stock')->default(0);
            $table->integer('sort')->default(0);
            $table->timestamps();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            $table->unique(['product_id', 'label']);
        });

        Schema::create('vouchers', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('code', 40)->unique();
            $table->enum('type', ['percent', 'fixed'])->default('percent');
            $table->unsignedInteger('value')->default(0);
            $table->unsignedInteger('min_order')->default(0);
            $table->unsignedInteger('max_discount')->default(0);
            $table->unsignedInteger('usage_limit')->default(0);
            $table->unsignedInteger('used_count')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->boolean('active')->default(true);
            $table->string('note')->nullable();
            $table->timestamps();
        });

        Schema::create('cart_items', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('user_id', 12);
            $table->string('product_id', 12);
            $table->string('variant_id', 12)->nullable();
            $table->unsignedInteger('qty')->default(1);
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            $table->foreign('variant_id')->references('id')->on('product_variants')->cascadeOnDelete();
            $table->unique(['user_id', 'product_id', 'variant_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cart_items');
        Schema::dropIfExists('vouchers');
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('products');
    }
};
