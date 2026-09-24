<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('instructor_wallet_transactions', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('user_id', 12);
            $table->enum('type', ['earning', 'withdrawal']);
            $table->string('ref_id', 12)->nullable();
            $table->string('order_id', 12)->nullable();
            $table->integer('amount')->default(0);
            $table->unsignedInteger('gross')->default(0);
            $table->unsignedInteger('platform_fee')->default(0);
            $table->unsignedInteger('payment_fee')->default(0);
            $table->enum('status', ['pending', 'completed', 'rejected'])->default('completed');
            $table->string('note')->nullable();
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('order_id')->references('id')->on('orders')->nullOnDelete();
            $table->index(['user_id', 'status']);
        });

        Schema::create('withdrawals', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('user_id', 12);
            $table->unsignedInteger('amount');
            $table->string('bank_name', 80);
            $table->string('account_name', 120);
            $table->string('account_number', 40);
            $table->text('notes')->nullable();
            $table->enum('status', ['pending', 'approved', 'processing', 'completed', 'rejected'])->default('pending');
            $table->string('processed_by', 12)->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->string('admin_note')->nullable();
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('processed_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('withdrawals');
        Schema::dropIfExists('instructor_wallet_transactions');
    }
};
