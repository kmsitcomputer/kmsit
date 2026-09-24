<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Historical identity survives voucher deletion/code reuse. No cascading FK.
            $table->string('voucher_id', 12)->nullable();
            $table->enum('voucher_reservation_status', ['reserved', 'consumed', 'released'])->nullable();
            $table->timestamp('voucher_reserved_until')->nullable();
            $table->index(['voucher_id', 'voucher_reservation_status', 'voucher_reserved_until'], 'orders_voucher_reservation_index');
            $table->index(['voucher_reservation_status', 'voucher_reserved_until'], 'orders_voucher_due_index');
            $table->enum('status', ['pending', 'paid', 'failed', 'expired', 'cancelled'])->default('pending')->change();
        });
        Schema::table('payments', function (Blueprint $table) {
            $table->index(['gateway', 'merchant_ref'], 'payments_gateway_merchant_ref_index');
        });
        $duplicateEarning = DB::table('instructor_wallet_transactions')
            ->where('type', 'earning')->whereNotNull('order_id')->whereNotNull('ref_id')
            ->select('order_id', 'user_id', 'type', 'ref_id')
            ->groupBy('order_id', 'user_id', 'type', 'ref_id')
            ->havingRaw('COUNT(*) > 1')->exists();
        if ($duplicateEarning) {
            throw new \RuntimeException('Duplicate instructor earnings must be reconciled before migration 000019.');
        }
        Schema::table('instructor_wallet_transactions', function (Blueprint $table) {
            $table->unique(['order_id', 'user_id', 'type', 'ref_id'], 'wallet_earning_idempotency_unique');
        });
        // Do not infer reservations for legacy orders: their historical counter is unknown.
    }

    public function down(): void
    {
        if (\Illuminate\Support\Facades\DB::table('orders')->where('status', 'cancelled')->exists()) {
            throw new \RuntimeException('Reconcile cancelled orders before reverting the order status enum.');
        }
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_voucher_due_index');
            $table->dropIndex('orders_voucher_reservation_index');
            $table->dropColumn(['voucher_id', 'voucher_reservation_status', 'voucher_reserved_until']);
            $table->enum('status', ['pending', 'paid', 'failed', 'expired'])->default('pending')->change();
        });
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('payments_gateway_merchant_ref_index');
        });
        Schema::table('instructor_wallet_transactions', function (Blueprint $table) {
            $table->dropUnique('wallet_earning_idempotency_unique');
        });
    }
};
