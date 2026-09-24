<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_messages', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('name', 120);
            $table->string('email', 190);
            $table->string('subject', 190)->nullable();
            $table->text('body');
            $table->boolean('is_read')->default(false);
            $table->timestamps();
            $table->index('is_read');
        });
    }
    public function down(): void { Schema::dropIfExists('contact_messages'); }
};
