<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Models\Withdrawal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class WalletFinanceApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_paid_course_credits_instructor_wallet_once_with_correct_net_and_audit(): void
    {
        $this->seed();
        Setting::create(['setting_key' => 'platform_fee_percent', 'setting_value' => '15']);
        $instructor = $this->user('instructor', 'wf-instructor@example.com');
        $student = $this->user('student', 'wf-student@example.com');
        Course::create(['id' => 'wfcourse0001', 'slug' => 'wf-course', 'instructor_id' => $instructor->id, 'title' => 'WF', 'price' => 100000, 'is_free' => false, 'status' => 'published']);

        $orderId = $this->actingAs($student, 'sanctum')->postJson('/api/v1/orders/course', ['course_slug' => 'wf-course'])->assertCreated()->json('order.id');
        $payment = $this->actingAs($student, 'sanctum')->postJson('/api/v1/orders/' . $orderId . '/payment', ['gateway' => 'tripay', 'method' => 'QRIS'])->assertCreated()->json('payment');

        $this->webhook($payment, 'paid')->assertOk()->assertJsonPath('result', 'processed');

        $this->assertSame(1, WalletTransaction::where('order_id', $orderId)->where('type', 'earning')->count());
        $tx = WalletTransaction::where('order_id', $orderId)->where('type', 'earning')->firstOrFail();
        $this->assertSame($instructor->id, $tx->user_id);
        $this->assertSame(100000, (int) $tx->gross);
        $this->assertSame(15000, (int) $tx->platform_fee);
        $this->assertSame(0, (int) $tx->payment_fee);
        $this->assertSame(85000, (int) $tx->amount);
        $this->assertSame((int) $tx->gross - (int) $tx->platform_fee - (int) $tx->payment_fee, (int) $tx->amount);
        $this->assertSame('completed', $tx->status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'wallet_earning', 'model' => 'WalletTransaction', 'model_id' => $tx->id]);

        // Replay must not duplicate the ledger.
        $this->webhook($payment, 'paid')->assertOk()->assertJsonPath('result', 'duplicate');
        $this->assertSame(1, WalletTransaction::where('order_id', $orderId)->where('type', 'earning')->count());
    }

    public function test_order_and_payment_amounts_come_from_backend_not_client(): void
    {
        $this->seed();
        $instructor = $this->user('instructor', 'wf2-instructor@example.com');
        $student = $this->user('student', 'wf2-student@example.com');
        Course::create(['id' => 'wfcourse0002', 'slug' => 'wf2-course', 'instructor_id' => $instructor->id, 'title' => 'WF2', 'price' => 100000, 'is_free' => false, 'status' => 'published']);

        $order = $this->actingAs($student, 'sanctum')->postJson('/api/v1/orders/course', [
            'course_slug' => 'wf2-course', 'total' => 1, 'subtotal' => 1, 'amount' => 1, 'gateway_fee' => 999999,
        ])->assertCreated()->json('order');
        $this->assertSame(100000, (int) $order['total']);

        $payment = $this->actingAs($student, 'sanctum')->postJson('/api/v1/orders/' . $order['id'] . '/payment', [
            'gateway' => 'tripay', 'method' => 'QRIS', 'amount' => 1, 'total' => 1,
        ])->assertCreated()->json('payment');
        $this->assertSame(100000, (int) $payment['amount']);
    }

    public function test_withdrawal_status_transitions_are_validated_and_audited(): void
    {
        $this->seed();
        $instructor = $this->user('instructor', 'wf3-instructor@example.com');
        $admin = $this->user('admin', 'wf3-admin@example.com');
        WalletTransaction::create(['id' => 'wf3earn00001', 'user_id' => $instructor->id, 'type' => 'earning', 'amount' => 100000, 'gross' => 120000, 'platform_fee' => 20000, 'status' => 'completed']);

        $id = $this->actingAs($instructor, 'sanctum')->postJson('/api/v1/wallet/withdrawals', [
            'amount' => 50000, 'bank_name' => 'BCA', 'account_name' => 'Instructor', 'account_number' => '1234567890',
        ])->assertCreated()->json('withdrawal.id');

        $patch = fn (string $status) => $this->actingAs($admin, 'sanctum')->patchJson('/api/v1/wallet/withdrawals/' . $id, ['status' => $status]);

        $patch('completed')->assertStatus(422);
        $patch('processing')->assertStatus(422);
        $patch('approved')->assertOk();
        $patch('approved')->assertStatus(422);
        $patch('processing')->assertOk();
        $patch('approved')->assertStatus(422);
        $patch('completed')->assertOk();
        $patch('rejected')->assertStatus(422);

        $this->assertDatabaseHas('audit_logs', ['action' => 'withdrawal_status', 'model' => 'Withdrawal', 'model_id' => $id]);
    }

    public function test_admin_without_process_withdrawals_permission_is_denied(): void
    {
        $this->seed();
        Role::where('role_key', 'admin')->update(['permissions' => []]);
        $admin = $this->user('admin', 'wf4-admin@example.com');
        $instructor = $this->user('instructor', 'wf4-instructor@example.com');
        $withdrawal = Withdrawal::create(['id' => 'wf4wd0000001', 'user_id' => $instructor->id, 'amount' => 25000, 'bank_name' => 'BCA', 'account_name' => 'X', 'account_number' => '123', 'status' => 'pending']);

        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/withdrawals')->assertForbidden();
        $this->actingAs($admin, 'sanctum')->patchJson('/api/v1/wallet/withdrawals/' . $withdrawal->id, ['status' => 'approved'])->assertForbidden();

        $super = $this->user('super_admin', 'wf4-super@example.com');
        $this->actingAs($super, 'sanctum')->getJson('/api/v1/admin/withdrawals')->assertOk();
        $this->actingAs($super, 'sanctum')->patchJson('/api/v1/wallet/withdrawals/' . $withdrawal->id, ['status' => 'approved'])->assertOk();
    }

    public function test_two_withdrawals_cannot_both_spend_the_same_balance(): void
    {
        $this->seed();
        $instructor = $this->user('instructor', 'wf7-instructor@example.com');
        WalletTransaction::create(['id' => 'wf7earn00001', 'user_id' => $instructor->id, 'type' => 'earning', 'amount' => 100000, 'gross' => 120000, 'platform_fee' => 20000, 'status' => 'completed']);

        $this->actingAs($instructor, 'sanctum')->postJson('/api/v1/wallet/withdrawals', ['amount' => 60000, 'bank_name' => 'BCA', 'account_name' => 'I', 'account_number' => '1'])->assertCreated();
        $this->actingAs($instructor, 'sanctum')->postJson('/api/v1/wallet/withdrawals', ['amount' => 60000, 'bank_name' => 'BCA', 'account_name' => 'I', 'account_number' => '1'])->assertStatus(422);
        $this->actingAs($instructor, 'sanctum')->postJson('/api/v1/wallet/withdrawals', ['amount' => 40000, 'bank_name' => 'BCA', 'account_name' => 'I', 'account_number' => '1'])->assertCreated();
        $this->actingAs($instructor, 'sanctum')->postJson('/api/v1/wallet/withdrawals', ['amount' => 30000, 'bank_name' => 'BCA', 'account_name' => 'I', 'account_number' => '1'])->assertStatus(422);
    }

    public function test_wallet_visibility_is_limited_to_the_owner(): void
    {
        $this->seed();
        $a = $this->user('instructor', 'wfa@example.com');
        $b = $this->user('instructor', 'wfb@example.com');
        WalletTransaction::create(['id' => 'wfvis0000001', 'user_id' => $a->id, 'type' => 'earning', 'amount' => 100000, 'gross' => 120000, 'platform_fee' => 20000, 'status' => 'completed']);

        $this->actingAs($a, 'sanctum')->getJson('/api/v1/wallet')->assertOk()->assertJsonPath('summary.earned', 100000)->assertJsonCount(1, 'ledger');
        $this->actingAs($b, 'sanctum')->getJson('/api/v1/wallet')->assertOk()->assertJsonPath('summary.earned', 0)->assertJsonCount(0, 'ledger');
    }

    public function test_withdrawal_request_rolls_back_when_ledger_write_fails(): void
    {
        $this->seed();
        $instructor = $this->user('instructor', 'wf5-instructor@example.com');
        WalletTransaction::create(['id' => 'wf5earn00001', 'user_id' => $instructor->id, 'type' => 'earning', 'amount' => 100000, 'gross' => 120000, 'platform_fee' => 20000, 'status' => 'completed']);

        $fail = true;
        WalletTransaction::creating(function () use (&$fail) {
            if ($fail) throw new \RuntimeException('ledger failure');
        });
        $this->withoutExceptionHandling();
        try {
            $this->actingAs($instructor, 'sanctum')->postJson('/api/v1/wallet/withdrawals', ['amount' => 50000, 'bank_name' => 'BCA', 'account_name' => 'I', 'account_number' => '1']);
            $this->fail('Expected the ledger failure to abort the request.');
        } catch (\RuntimeException $e) {
            $this->assertSame('ledger failure', $e->getMessage());
        } finally {
            $fail = false;
        }

        $this->assertDatabaseCount('withdrawals', 0);
        $this->assertSame(1, WalletTransaction::where('type', 'earning')->count());

        $this->actingAs($instructor, 'sanctum')->postJson('/api/v1/wallet/withdrawals', ['amount' => 50000, 'bank_name' => 'BCA', 'account_name' => 'I', 'account_number' => '1'])->assertCreated();
        $this->assertDatabaseCount('withdrawals', 1);
    }

    private function webhook(array $payment, string $status): \Illuminate\Testing\TestResponse
    {
        $privateKey = (string) config('payment.tripay.private_key');
        $signature = hash_hmac('sha256', implode('|', [$payment['reference'], $payment['amount'], $status]), $privateKey);
        return $this->postJson('/api/v1/payments/webhook/tripay', [
            'reference' => $payment['reference'], 'amount' => $payment['amount'], 'status' => $status, 'signature' => $signature,
        ]);
    }

    private function user(string $role, string $email): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => ucfirst($role),
            'email' => $email, 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }
}
