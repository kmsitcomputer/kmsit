<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Models\CartItem;
use App\Models\Voucher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ShopApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_cart_validates_variant_and_never_exceeds_server_stock(): void
    {
        $this->seed();
        $user = $this->user('shop-user@example.com');
        $other = $this->user('other-shop-user@example.com');
        $product = Product::create(['id' => 'product00001', 'slug' => 'keyboard', 'name' => 'Keyboard', 'price' => 100000, 'stock' => 5, 'status' => 'published']);
        $variant = ProductVariant::create(['id' => 'variant00001', 'product_id' => $product->id, 'label' => 'Black', 'price' => 120000, 'stock' => 2]);

        $this->actingAs($user, 'sanctum')->postJson('/api/v1/shop/cart', ['product_id' => $product->id, 'qty' => 1])->assertStatus(422);
        $item = $this->actingAs($user, 'sanctum')->postJson('/api/v1/shop/cart', ['product_id' => $product->id, 'variant_id' => $variant->id, 'qty' => 99])->assertCreated()->json('item');
        $this->assertSame(2, $item['qty']);
        $this->actingAs($other, 'sanctum')->deleteJson('/api/v1/shop/cart/' . $item['id'])->assertNotFound();
    }

    public function test_shop_checkout_recalculates_total_on_server(): void
    {
        $this->seed();
        $user = $this->user('checkout-shop@example.com');
        $product = Product::create(['id' => 'product00002', 'slug' => 'mouse', 'name' => 'Mouse', 'price' => 50000, 'discount_price' => 40000, 'stock' => 3, 'status' => 'published', 'is_digital' => false]);
        CartItem::create(['id' => 'cartitem00001', 'user_id' => $user->id, 'product_id' => $product->id, 'qty' => 2]);
        Voucher::create(['id' => 'voucher00001', 'code' => 'HEMAT10', 'type' => 'percent', 'value' => 10, 'min_order' => 0, 'active' => true]);

        $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/shop', ['voucher_code' => 'HEMAT10'])->assertStatus(422);
        $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/shop', ['voucher_code' => 'HEMAT10', 'shipping' => ['name' => 'Buyer', 'address' => 'Jalan Test 1', 'phone' => '08123456789']]);
        $response->assertCreated()->assertJsonPath('order.subtotal', 80000)->assertJsonPath('order.discount_amount', 8000)->assertJsonPath('order.total', 72000);
    }

    public function test_admin_product_crud_recalculates_variant_stock(): void
    {
        $this->seed();
        $admin = $this->user('product-admin@example.com', 'admin');
        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/products', ['name' => 'Laptop', 'price' => 1000000, 'stock' => 0, 'status' => 'published', 'variants' => [['label' => '8GB', 'price' => 1000000, 'stock' => 2], ['label' => '16GB', 'price' => 1200000, 'stock' => 3]]]);
        $response->assertCreated()->assertJsonPath('product.stock', 5)->assertJsonCount(2, 'product.variants');
    }

    public function test_admin_can_publish_a_draft_product_without_resending_every_field(): void
    {
        $this->seed();
        $admin = $this->user('product-toggle-admin@example.com', 'admin');
        $product = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/products', [
            'name' => 'Mouse Wireless', 'price' => 75000, 'stock' => 4, 'status' => 'draft',
            'variants' => [['label' => 'Hitam', 'price' => 75000, 'stock' => 4]],
        ])->assertCreated()->json('product');
        $this->assertFalse(\App\Models\Product::whereKey($product['id'])->where('status', 'published')->exists());

        // The dashboard's row-level publish/unpublish toggle only ever sends {status}.
        $updated = $this->actingAs($admin, 'sanctum')->putJson("/api/v1/admin/products/{$product['id']}", ['status' => 'published'])
            ->assertOk()->json('product');
        $this->assertSame('published', $updated['status']);
        // Fields not included in the partial payload (and existing variants) must survive untouched.
        $this->assertSame('Mouse Wireless', $updated['name']);
        $this->assertSame(75000, $updated['price']);
        $this->assertCount(1, $updated['variants']);

        $this->getJson('/api/v1/shop/products')->assertOk()->assertJsonFragment(['id' => $product['id']]);
    }

    private function user(string $email, string $role = 'student'): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => 'Shop User', 'email' => $email, 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }
}
