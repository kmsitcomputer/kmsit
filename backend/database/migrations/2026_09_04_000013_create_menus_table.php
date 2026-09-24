<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('menus', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('name', 80)->unique();
            $table->enum('location', ['header', 'footer', 'both'])->default('header');
            $table->timestamps();
        });
        Schema::create('menu_items', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('menu_id', 12);
            $table->string('parent_id', 12)->nullable();
            $table->string('label', 120);
            $table->string('type', 30)->default('url');
            $table->string('target', 12)->nullable();
            $table->string('url')->nullable();
            $table->integer('sort')->default(0);
            $table->timestamps();
            $table->foreign('menu_id')->references('id')->on('menus')->cascadeOnDelete();
            $table->foreign('parent_id')->references('id')->on('menu_items')->cascadeOnDelete();
            $table->index(['menu_id', 'sort']);
        });
    }
    public function down(): void { Schema::dropIfExists('menu_items'); Schema::dropIfExists('menus'); }
};
