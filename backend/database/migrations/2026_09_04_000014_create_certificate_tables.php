<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificate_templates', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('name', 120);
            $table->enum('theme', ['navy', 'ivory', 'graphite'])->default('navy');
            $table->string('accent', 9)->default('#2dd4bf');
            $table->enum('frame', ['modern', 'classic'])->default('modern');
            $table->timestamps();
        });
        Schema::create('certificates', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('number', 40)->unique();
            $table->string('user_id', 12);
            $table->string('course_id', 12);
            $table->string('template_id', 12);
            $table->timestamp('issued_at')->useCurrent();
            $table->enum('status', ['issued', 'revoked'])->default('issued');
            $table->unsignedInteger('views')->default(0);
            $table->timestamp('revoked_at')->nullable();
            $table->string('revoked_by', 12)->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'course_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('course_id')->references('id')->on('courses')->cascadeOnDelete();
            $table->foreign('template_id')->references('id')->on('certificate_templates')->restrictOnDelete();
            $table->foreign('revoked_by')->references('id')->on('users')->nullOnDelete();
        });
    }
    public function down(): void { Schema::dropIfExists('certificates'); Schema::dropIfExists('certificate_templates'); }
};
