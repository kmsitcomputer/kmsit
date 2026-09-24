<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('name', 190);
            $table->string('mime', 100);
            $table->unsignedInteger('size')->default(0);
            $table->string('path', 500);
            $table->string('uploaded_by', 12)->nullable();
            $table->timestamps();
            $table->foreign('uploaded_by')->references('id')->on('users')->nullOnDelete();
            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media');
    }
};
