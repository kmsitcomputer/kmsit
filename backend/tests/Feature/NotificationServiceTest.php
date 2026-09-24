<?php

namespace Tests\Feature;

use App\Contracts\PaymentGateway;
use App\Models\{AppNotification, AuditLog, Certificate, CertificateTemplate, Course, Order, OrderItem, Payment, Role, Setting, User, Withdrawal, WalletTransaction};
use App\Services\NotificationService;
use App\Services\PaymentGatewayManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{DB, Hash, Http};
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Mockery;
use Tests\TestCase;

class NotificationServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config(['payment.mode' => 'live', 'payment.tripay.private_key' => 'test-callback-secret']);
        $provider = Mockery::mock(PaymentGateway::class);
        $provider->shouldReceive('createPayment')->andReturnUsing(fn () => ['reference' => 'MOCK-' . Str::random(16), 'checkout_url' => 'https://example.test/pay']);
        $manager = Mockery::mock(PaymentGatewayManager::class);
        $manager->shouldReceive('resolve')->andReturn($provider);
        $this->app->instance(PaymentGatewayManager::class, $manager);
        $this->seed();
        Setting::updateOrCreate(['setting_key' => 'gateway_active'], ['setting_value' => 'tripay']);
    }

    private function user(string $role, string $email): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => ucfirst($role), 'email' => $email,
            'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }

    private function courseOrder(User $buyer, User $instructor): Order
    {
        $course = Course::create(['id' => 'ntfcourse001', 'slug' => 'ntf-course', 'instructor_id' => $instructor->id, 'title' => 'Kelas Notif', 'price' => 100000, 'status' => 'published']);
        $order = Order::create(['id' => 'ntforder0001', 'user_id' => $buyer->id, 'type' => 'course', 'status' => 'pending', 'subtotal' => 100000, 'total' => 100000, 'currency' => 'IDR']);
        OrderItem::create(['id' => 'ntfitem00001', 'order_id' => $order->id, 'kind' => 'course', 'ref_id' => $course->id, 'title' => $course->title, 'price' => 100000, 'qty' => 1, 'instructor_id' => $instructor->id]);
        return $order;
    }

    private function pay(User $buyer, Order $order): Payment
    {
        $id = $this->actingAs($buyer, 'sanctum')->postJson("/api/v1/orders/{$order->id}/payment", ['method' => 'QRIS'])->assertCreated()->json('payment.id');
        return Payment::findOrFail($id);
    }

    private function webhook(Payment $payment, string $status): TestResponse
    {
        $raw = json_encode(['reference' => $payment->reference, 'amount' => $payment->amount, 'status' => $status]);
        return $this->call('POST', '/api/v1/payments/webhook/tripay', [], [], [], [
            'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_CALLBACK_SIGNATURE' => hash_hmac('sha256', $raw, 'test-callback-secret'),
        ], $raw);
    }

    private function keys(User $user): array
    {
        return AppNotification::where('user_id', $user->id)->orderBy('event_key')->pluck('event_key')->all();
    }

    public function test_paid_webhook_notifies_buyer_and_instructor_once_even_on_replay(): void
    {
        $buyer = $this->user('student', 'buyer@example.com');
        $instructor = $this->user('instructor', 'teacher@example.com');
        $order = $this->courseOrder($buyer, $instructor);
        $payment = $this->pay($buyer, $order);

        $this->webhook($payment, 'paid')->assertOk()->assertJsonPath('result', 'processed');
        $this->webhook($payment, 'paid')->assertOk()->assertJsonPath('result', 'duplicate');

        $this->assertSame(['enrollment:ntforder0001:ntfcourse001', 'order:ntforder0001:paid'], $this->keys($buyer));
        $this->assertSame(['earning:ntforder0001:ntfcourse001'], $this->keys($instructor));
        $earning = AppNotification::where('user_id', $instructor->id)->first();
        $this->assertStringNotContainsString('buyer@example.com', $earning->title . $earning->body);
    }

    public function test_failed_payment_notifies_buyer_only(): void
    {
        $buyer = $this->user('student', 'buyer2@example.com');
        $instructor = $this->user('instructor', 'teacher2@example.com');
        $payment = $this->pay($buyer, $this->courseOrder($buyer, $instructor));
        $this->webhook($payment, 'failed')->assertOk();
        $this->assertSame(["payment:{$payment->id}:failed"], $this->keys($buyer));
        $this->assertSame([], $this->keys($instructor));
    }

    public function test_second_paid_payment_is_recorded_as_anomaly_for_payment_staff(): void
    {
        $buyer = $this->user('student', 'dup@example.com');
        $instructor = $this->user('instructor', 'dupteach@example.com');
        $super = $this->user('super_admin', 'root@example.com');
        $order = $this->courseOrder($buyer, $instructor);
        $first = $this->pay($buyer, $order);
        $second = $this->pay($buyer, $order);
        $this->webhook($first, 'paid')->assertOk();
        $this->webhook($second, 'paid')->assertOk();

        $this->assertSame(1, AuditLog::where('action', 'duplicate_payment')->where('model_id', $second->id)->count());
        $this->assertSame(["payment:{$second->id}:duplicate_paid"], $this->keys($super));
        $this->assertSame(1, WalletTransaction::where('type', 'earning')->count(), 'fulfillment must still happen once');
    }

    public function test_same_event_key_is_idempotent_and_rollback_leaves_no_notification(): void
    {
        $user = $this->user('student', 'idem@example.com');
        $service = app(NotificationService::class);
        $service->notify($user->id, 'custom:event:1', 'A');
        $service->notify($user->id, 'custom:event:1', 'B');
        $this->assertSame(1, AppNotification::where('user_id', $user->id)->count());

        try {
            DB::transaction(function () use ($service, $user) {
                $service->notify($user->id, 'custom:event:2', 'Rolled back');
                throw new \RuntimeException('business failure');
            });
        } catch (\RuntimeException) {
        }
        $this->assertSame(0, AppNotification::where('event_key', 'custom:event:2')->count());
    }

    public function test_staff_recipients_follow_permissions(): void
    {
        $super = $this->user('super_admin', 's@example.com');
        $admin = $this->user('admin', 'a@example.com');
        $student = $this->user('student', 'st@example.com');
        $this->assertEqualsCanonicalizing([$super->id, $admin->id], app(NotificationService::class)->staffWith('process_withdrawals')->all());

        Role::where('role_key', 'admin')->update(['permissions' => json_encode(['dashboard'])]);
        $this->assertSame([$super->id], app(NotificationService::class)->staffWith('process_withdrawals')->all());
        $this->assertNotContains($student->id, app(NotificationService::class)->staffWith('process_withdrawals')->all());
    }

    public function test_withdrawal_request_and_status_notify_the_right_people(): void
    {
        $instructor = $this->user('instructor', 'wd@example.com');
        $super = $this->user('super_admin', 'wdroot@example.com');
        WalletTransaction::create(['id' => 'ntfearn00001', 'user_id' => $instructor->id, 'type' => 'earning', 'amount' => 200000, 'gross' => 200000, 'status' => 'completed']);
        $id = $this->actingAs($instructor, 'sanctum')->postJson('/api/v1/wallet/withdrawals', ['amount' => 50000, 'bank_name' => 'BCA', 'account_name' => 'Ins', 'account_number' => '123456'])
            ->assertCreated()->json('withdrawal.id');
        $this->assertSame(["withdrawal:{$id}:requested"], $this->keys($super));
        $notice = AppNotification::where('user_id', $super->id)->first();
        $this->assertStringNotContainsString('123456', $notice->title . $notice->body, 'bank account number must not be in the payload');

        $this->actingAs($super, 'sanctum')->patchJson("/api/v1/wallet/withdrawals/{$id}", ['status' => 'rejected', 'admin_note' => 'Data rekening salah'])->assertOk();
        $this->assertSame(["withdrawal:{$id}:rejected"], $this->keys($instructor));
        $this->assertSame('danger', AppNotification::where('user_id', $instructor->id)->value('kind'));
    }

    public function test_course_moderation_and_certificate_events(): void
    {
        $instructor = $this->user('instructor', 'mod@example.com');
        $super = $this->user('super_admin', 'modroot@example.com');
        $student = $this->user('student', 'certst@example.com');
        $course = Course::create(['id' => 'ntfmodcourse', 'slug' => 'ntf-mod', 'instructor_id' => $instructor->id, 'title' => 'Kelas Moderasi', 'price' => 0, 'is_free' => true, 'status' => 'draft']);

        $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/submit")->assertOk();
        $this->assertCount(1, AppNotification::where('user_id', $super->id)->where('event_key', 'like', 'course:ntfmodcourse:submitted:%')->get());
        $this->actingAs($super, 'sanctum')->patchJson("/api/v1/admin/courses/{$course->id}/moderate", ['action' => 'reject', 'reject_note' => 'Lengkapi deskripsi'])->assertOk();
        $rejected = AppNotification::where('user_id', $instructor->id)->where('event_key', 'like', 'course:ntfmodcourse:reject:%')->firstOrFail();
        $this->assertStringContainsString('Lengkapi deskripsi', $rejected->body);

        $template = CertificateTemplate::create(['id' => 'ntfctpl00001', 'name' => 'T', 'theme' => 'navy', 'accent' => '#ffffff', 'frame' => 'modern']);
        $certificate = Certificate::create(['id' => 'ntfcert00001', 'number' => 'KMSIT-2026-NTF001', 'user_id' => $student->id, 'course_id' => $course->id, 'template_id' => $template->id, 'status' => 'issued']);
        $this->actingAs($super, 'sanctum')->patchJson("/api/v1/certificates/{$certificate->id}/revoke")->assertOk();
        $this->assertSame(['certificate:ntfcert00001:revoked'], $this->keys($student));
    }

    public function test_notification_endpoints_are_paginated_and_owner_scoped(): void
    {
        $user = $this->user('student', 'list@example.com');
        $other = $this->user('student', 'other@example.com');
        foreach (range(1, 3) as $i) app(NotificationService::class)->notify($user->id, "list:{$i}", "N{$i}");
        app(NotificationService::class)->notify($other->id, 'list:other', 'Other');

        $this->actingAs($user, 'sanctum')->getJson('/api/v1/notifications?per_page=2')->assertOk()
            ->assertJsonPath('notifications.total', 3)->assertJsonPath('notifications.per_page', 2)->assertJsonPath('unread_count', 3);
        $otherId = AppNotification::where('user_id', $other->id)->value('id');
        $this->postJson("/api/v1/notifications/{$otherId}/read")->assertNotFound();
        $this->postJson('/api/v1/notifications/read-all')->assertOk();
        $this->getJson('/api/v1/notifications')->assertJsonPath('unread_count', 0);
        $this->assertFalse((bool) AppNotification::where('user_id', $other->id)->value('is_read'));
    }
}
