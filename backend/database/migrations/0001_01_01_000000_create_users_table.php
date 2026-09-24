<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('role_key', 50)->unique();
            $table->string('name', 100);
            $table->json('permissions');
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('perm_key', 80)->unique();
            $table->string('description')->default('');
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('role_key', 50);
            $table->string('name', 120);
            $table->string('email', 190)->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password_hash');
            $table->string('salt', 64)->nullable();
            $table->enum('status', ['active', 'suspended'])->default('active');
            $table->text('avatar')->nullable();
            $table->text('bio')->nullable();
            $table->string('phone', 30)->nullable();
            $table->boolean('instructor_approved')->default(false);
            $table->string('instructor_headline', 190)->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->index(['role_key', 'status']);
            $table->foreign('role_key')->references('role_key')->on('roles')->restrictOnDelete()->cascadeOnUpdate();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
