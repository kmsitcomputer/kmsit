<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('user_id', 12);
            $table->string('title', 190);
            $table->string('body', 500)->nullable();
            $table->string('link')->nullable();
            $table->enum('kind', ['info', 'success', 'warning', 'danger'])->default('info');
            $table->boolean('is_read')->default(false);
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['user_id', 'is_read']);
        });
    }

    public function down(): void { Schema::dropIfExists('notifications'); }
};
