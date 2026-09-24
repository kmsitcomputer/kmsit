<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class OrderPaymentApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_paid_course_is_enrolled_only_after_valid_webhook(): void
    {
        // Ensure private_key is set for signature verification
        config(['payment.tripay.private_key' => 'test-callback-secret']);

        $this->seed();
        $instructor = $this->user('instructor', 'pay-instructor@example.com');
        $student = $this->user('student', 'pay-student@example.com');
        Course::create(['id' => 'paycourse001', 'slug' => 'paid-course', 'instructor_id' => $instructor->id, 'title' => 'Paid Course', 'price' => 100000, 'is_free' => false, 'status' => 'published']);

        $order = $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/orders/course', ['course_slug' => 'paid-course'])
            ->assertCreated()
            ->assertJsonPath('order.status', 'pending')
            ->json('order.id');
        $this->assertDatabaseMissing('enrollments', ['user_id' => $student->id, 'course_id' => 'paycourse001']);

        $this->actingAs($student, 'sanctum')->getJson('/api/v1/orders')->assertOk()->assertJsonPath('data.0.id', $order);
        $this->actingAs($student, 'sanctum')->getJson('/api/v1/payments')->assertOk();

        $payment = $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/orders/' . $order . '/payment', ['gateway' => 'tripay', 'method' => 'QRIS'])
            ->assertCreated()
            ->json('payment');
        // Tripay payload-based HMAC: reference|amount|status signed with private_key config.
        $privateKey = (string) config('payment.tripay.private_key');
        $signature = hash_hmac('sha256', implode('|', [$payment['reference'], $payment['amount'], 'paid']), $privateKey);

        $this->postJson('/api/v1/payments/webhook/tripay', [
            'reference' => $payment['reference'], 'amount' => $payment['amount'], 'status' => 'paid', 'signature' => 'invalid',
        ])->assertStatus(422);

        $this->postJson('/api/v1/payments/webhook/tripay', [
            'reference' => $payment['reference'], 'amount' => $payment['amount'], 'status' => 'paid', 'signature' => $signature,
        ])->assertOk()->assertJsonPath('result', 'processed');
        $this->assertDatabaseHas('enrollments', ['user_id' => $student->id, 'course_id' => 'paycourse001']);

        $this->postJson('/api/v1/payments/webhook/tripay', [
            'reference' => $payment['reference'], 'amount' => $payment['amount'], 'status' => 'paid', 'signature' => $signature,
        ])->assertOk()->assertJsonPath('result', 'duplicate');
    }

    private function user(string $role, string $email): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => ucfirst($role), 'email' => $email, 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }
}
