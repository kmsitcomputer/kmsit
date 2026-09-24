<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('user_id', 12)->nullable();
            $table->string('user_name', 120)->default('system');
            $table->string('action', 60);
            $table->string('model', 60);
            $table->string('model_id', 12)->nullable();
            $table->string('detail', 500)->nullable();
            $table->ipAddress('ip')->nullable();
            $table->string('ua', 255)->nullable();
            $table->timestamps();
            $table->index(['model', 'created_at']);
            $table->index(['user_id', 'created_at']);
        });
    }
    public function down(): void { Schema::dropIfExists('audit_logs'); }
};
