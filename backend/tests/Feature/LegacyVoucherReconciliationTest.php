<?php

namespace Tests\Feature;

use App\Models\{Order, Role, User, Voucher};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LegacyVoucherReconciliationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['role_key' => 'student'], ['id' => 'legrole00001', 'name' => 'Student', 'permissions' => ['shop']]);
        User::create(['id' => 'leguser00001', 'role_key' => 'student', 'name' => 'Buyer',
            'email' => 'legacy@example.test', 'password_hash' => Hash::make('password'), 'status' => 'active']);
    }

    public function test_dry_run_reports_without_changing_any_data(): void
    {
        $voucher = $this->voucher(1);
        $order = $this->legacyOrder('failed');

        $this->artisan('vouchers:reconcile-legacy')->assertExitCode(0);

        $this->assertSame(1, $voucher->fresh()->used_count);
        $this->assertNull($order->fresh()->voucher_reservation_status);
    }

    public function test_apply_releases_only_non_ambiguous_terminal_hold(): void
    {
        $voucher = $this->voucher(2);
        $terminal = $this->legacyOrder('expired');
        $pending = $this->legacyOrder('pending', 'legorder00002');
        $orphan = $this->legacyOrder('failed', 'legorder00003', 'NO-SUCH-CODE');

        $this->artisan('vouchers:reconcile-legacy --apply')->assertExitCode(0);

        $this->assertSame('released', $terminal->fresh()->voucher_reservation_status);
        $this->assertSame(1, $voucher->fresh()->used_count);
        $this->assertNull($pending->fresh()->voucher_reservation_status);
        $this->assertNull($orphan->fresh()->voucher_reservation_status);
    }

    public function test_apply_is_idempotent_and_never_underflows(): void
    {
        $voucher = $this->voucher(1);
        $order = $this->legacyOrder('cancelled');

        $this->artisan('vouchers:reconcile-legacy --apply')->assertExitCode(0);
        $this->assertSame(0, $voucher->fresh()->used_count);
        $this->assertSame('released', $order->fresh()->voucher_reservation_status);

        $this->artisan('vouchers:reconcile-legacy --apply')->assertExitCode(0);
        $this->assertSame(0, $voucher->fresh()->used_count);
        $this->assertSame('released', $order->fresh()->voucher_reservation_status);
    }

    public function test_pending_and_paid_legacy_orders_are_never_modified(): void
    {
        $voucher = $this->voucher(2);
        $pending = $this->legacyOrder('pending');
        $paid = $this->legacyOrder('paid', 'legorder00002');

        $this->artisan('vouchers:reconcile-legacy --apply')->assertExitCode(0);

        $this->assertSame(2, $voucher->fresh()->used_count);
        $this->assertNull($pending->fresh()->voucher_reservation_status);
        $this->assertNull($paid->fresh()->voucher_reservation_status);
    }

    private function voucher(int $usedCount): Voucher
    {
        return Voucher::create(['id' => 'legvoucher01', 'code' => 'LEGACY', 'type' => 'fixed', 'value' => 5000,
            'usage_limit' => 0, 'used_count' => $usedCount, 'active' => true]);
    }

    private function legacyOrder(string $status, string $id = 'legorder00001', string $code = 'LEGACY'): Order
    {
        return Order::create(['id' => $id, 'user_id' => 'leguser00001', 'type' => 'shop',
            'status' => $status, 'total' => 45000, 'voucher_code' => $code]);
    }
}
