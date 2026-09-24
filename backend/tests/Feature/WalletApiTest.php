<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class WalletApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_withdrawal_is_limited_by_available_balance_and_has_ledger_entry(): void
    {
        $this->seed();
        $instructor = $this->user('instructor', 'wallet-instructor@example.com');
        $admin = $this->user('admin', 'wallet-admin@example.com');
        WalletTransaction::create(['id' => 'earning00001', 'user_id' => $instructor->id, 'type' => 'earning', 'amount' => 100000, 'gross' => 120000, 'platform_fee' => 20000, 'status' => 'completed', 'note' => 'Course sale']);

        $withdrawal = $this->actingAs($instructor, 'sanctum')->postJson('/api/v1/wallet/withdrawals', ['amount' => 60000, 'bank_name' => 'BCA', 'account_name' => 'Instructor', 'account_number' => '1234567890'])->assertCreated()->json('withdrawal.id');
        $this->actingAs($instructor, 'sanctum')->postJson('/api/v1/wallet/withdrawals', ['amount' => 50000, 'bank_name' => 'BCA', 'account_name' => 'Instructor', 'account_number' => '1234567890'])->assertStatus(422);
        $this->assertDatabaseHas('instructor_wallet_transactions', ['ref_id' => $withdrawal, 'amount' => -60000, 'status' => 'pending']);

        $this->actingAs($admin, 'sanctum')->patchJson('/api/v1/wallet/withdrawals/' . $withdrawal, ['status' => 'approved'])->assertOk();
        $this->actingAs($admin, 'sanctum')->patchJson('/api/v1/wallet/withdrawals/' . $withdrawal, ['status' => 'completed'])->assertOk();
        $this->assertDatabaseHas('instructor_wallet_transactions', ['ref_id' => $withdrawal, 'status' => 'completed']);
    }

    private function user(string $role, string $email): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => ucfirst($role), 'email' => $email, 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }
}
