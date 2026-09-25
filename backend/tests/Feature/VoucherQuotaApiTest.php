<?php

namespace Tests\Feature;

use App\Models\CartItem;
use App\Models\Product;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class VoucherQuotaApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_voucher_usage_limit_is_enforced_by_consuming_quota_on_checkout(): void
    {
        $this->seed();
        $user = User::create([
            'id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Shop User',
            'email' => 'voucher-quota@example.com', 'password_hash' => Hash::make('password'),
            'status' => 'active', 'instructor_approved' => true,
        ]);
        $product = Product::create(['id' => 'product00003', 'slug' => 'ebook-kabel', 'name' => 'Ebook', 'price' => 50000, 'stock' => 50, 'status' => 'published', 'is_digital' => true, 'digital_file_url' => 'digital/ebook.pdf']);
        CartItem::create(['id' => 'cartitem00002', 'user_id' => $user->id, 'product_id' => $product->id, 'qty' => 1]);
        Voucher::create(['id' => 'voucher00002', 'code' => 'SEKALI', 'type' => 'fixed', 'value' => 5000, 'min_order' => 0, 'usage_limit' => 1, 'active' => true]);

        // Voucher quota is shipping-agnostic; the digital fixture keeps this
        // test independent of the RajaOngkir checkout contract.
        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/orders/shop', ['voucher_code' => 'SEKALI'])
            ->assertCreated()
            ->assertJsonPath('order.discount_amount', 5000);
        $this->assertSame(1, Voucher::where('code', 'SEKALI')->value('used_count'));

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/orders/shop', ['voucher_code' => 'SEKALI'])
            ->assertStatus(422);
        $this->assertSame(1, Voucher::where('code', 'SEKALI')->value('used_count'));
    }
}
