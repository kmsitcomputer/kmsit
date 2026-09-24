<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('homepage_blocks', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('type', 40);
            $table->string('title', 190)->nullable();
            $table->string('sub', 255)->nullable();
            $table->json('content')->nullable();
            $table->boolean('enabled')->default(true);
            $table->integer('sort')->default(0);
            $table->timestamps();
            $table->index(['enabled', 'sort']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('homepage_blocks');
    }
};
