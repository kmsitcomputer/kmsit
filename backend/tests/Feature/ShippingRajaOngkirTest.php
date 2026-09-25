<?php

namespace Tests\Feature;

use App\Models\CartItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * IMP-004: RajaOngkir shipping via faked provider HTTP (never live network).
 * Covers region hierarchy, weight authority, quote normalization, checkout
 * revalidation, snapshot persistence, and digital-only independence.
 */
class ShippingRajaOngkirTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config([
            'shipping.api_key' => 'test-rajaongkir-key',
            'shipping.base_url' => 'https://rajaongkir.test/api/v1',
            'shipping.origin_subdistrict_id' => '10',
            'shipping.couriers' => ['jne', 'jnt'],
            'shipping.http.timeout' => 5,
            'shipping.http.connect_timeout' => 2,
            'shipping.region_cache_ttl' => 60,
        ]);
        $this->seed();
    }

    private function fakeSuccess(): void
    {
        $this->fakeRegions();
    }

    private function fakeRegions(): void
    {
        Http::fake([
            'rajaongkir.test/api/v1/destination/province' => Http::response([
                'meta' => ['message' => 'ok', 'code' => 200, 'status' => 'success'],
                'data' => [['id' => 1, 'name' => 'JAWA BARAT'], ['id' => 2, 'name' => 'DKI JAKARTA']],
            ]),
            'rajaongkir.test/api/v1/destination/city/1' => Http::response([
                'meta' => ['message' => 'ok', 'code' => 200, 'status' => 'success'],
                'data' => [['id' => 11, 'name' => 'BANDUNG', 'zip_code' => '40111']],
            ]),
            'rajaongkir.test/api/v1/destination/city/2' => Http::response([
                'meta' => ['message' => 'ok', 'code' => 200, 'status' => 'success'],
                'data' => [['id' => 21, 'name' => 'JAKARTA SELATAN', 'zip_code' => '12510']],
            ]),
            'rajaongkir.test/api/v1/destination/district/11' => Http::response([
                'meta' => ['message' => 'ok', 'code' => 200, 'status' => 'success'],
                'data' => [['id' => 111, 'name' => 'COBLONG', 'zip_code' => '40132']],
            ]),
            'rajaongkir.test/api/v1/destination/sub-district/111' => Http::response([
                'meta' => ['message' => 'ok', 'code' => 200, 'status' => 'success'],
                'data' => [['id' => 1111, 'name' => 'DAGO', 'zip_code' => '40135']],
            ]),
            'rajaongkir.test/api/v1/destination/*' => Http::response([
                'meta' => ['message' => 'not found', 'code' => 404, 'status' => 'error'], 'data' => null,
            ], 404),
            'rajaongkir.test/api/v1/calculate/*' => Http::response([
                'meta' => ['message' => 'Success Calculate Domestic Shipping cost', 'code' => 200, 'status' => 'success'],
                'data' => [
                    ['name' => 'JNE', 'code' => 'jne', 'service' => 'REG', 'description' => 'Layanan Reguler', 'cost' => 12000, 'etd' => '2-3 day'],
                    ['name' => 'J&T', 'code' => 'jnt', 'service' => 'EZ', 'description' => 'Reguler', 'cost' => 11000, 'etd' => '1-2 day'],
                ],
            ]),
        ]);
    }

    private function user(string $email = 'ship-user@example.com'): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Ship User', 'email' => $email, 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }

    private function physicalProduct(string $id = 'shipprod0001', int $weight = 500): Product
    {
        return Product::create(['id' => $id, 'slug' => 'produk-' . $id, 'name' => 'Produk ' . $id, 'price' => 50000, 'stock' => 10, 'weight_grams' => $weight, 'status' => 'published', 'is_digital' => false]);
    }

    private function destination(): array
    {
        return ['province_id' => 1, 'city_id' => 11, 'district_id' => 111, 'subdistrict_id' => 1111];
    }

    private function shipping(string $courier = 'jne', string $service = 'REG'): array
    {
        return ['name' => 'Buyer', 'address' => 'Jalan Test 1', 'phone' => '08123456789', ...$this->destination(), 'courier' => $courier, 'service' => $service];
    }

    public function test_region_hierarchy_lists_and_rejects_mismatch(): void
    {
        $this->fakeSuccess();
        $user = $this->user();
        $this->actingAs($user, 'sanctum')->getJson('/api/v1/shipping/provinces')->assertOk()->assertJsonFragment(['id' => 1]);
        $this->actingAs($user, 'sanctum')->getJson('/api/v1/shipping/cities/1')->assertOk()->assertJsonFragment(['id' => 11]);
        $this->actingAs($user, 'sanctum')->getJson('/api/v1/shipping/districts/11')->assertOk()->assertJsonFragment(['id' => 111]);
        $this->actingAs($user, 'sanctum')->getJson('/api/v1/shipping/subdistricts/111')->assertOk()->assertJsonFragment(['zip_code' => '40135']);
        $this->actingAs($user, 'sanctum')->getJson('/api/v1/shipping/cities/999')->assertStatus(502);
        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'destination/province');
        });
    }

    public function test_quote_uses_authoritative_weight_and_normalized_services(): void
    {
        $this->fakeSuccess();
        $user = $this->user();
        $product = $this->physicalProduct();
        CartItem::create(['id' => 'shipcart0001', 'user_id' => $user->id, 'product_id' => $product->id, 'qty' => 3]);
        $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/shipping/quote', $this->destination());
        $response->assertOk()->assertJsonPath('weight_grams', 1500)->assertJsonCount(2, 'services')
            ->assertJsonPath('services.0.courier', 'jne')->assertJsonPath('services.0.cost', 12000);
        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'calculate/district/domestic-cost')
                && ($request['weight'] ?? null) === 1500
                && ($request['origin'] ?? null) === '10'
                && ($request['destination'] ?? null) === '1111'
                && ($request['courier'] ?? null) === 'jne:jnt';
        });
        $this->assertSame('test-rajaongkir-key', Http::recorded()[0][0]->header('key')[0] ?? null);
    }

    public function test_mismatched_hierarchy_and_missing_weight_fail_safely(): void
    {
        $this->fakeSuccess();
        $user = $this->user();
        $product = $this->physicalProduct();
        CartItem::create(['id' => 'shipcart0002', 'user_id' => $user->id, 'product_id' => $product->id, 'qty' => 1]);
        $bad = $this->destination();
        $bad['city_id'] = 21;
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/shipping/quote', $bad)->assertStatus(422);
        $product->update(['weight_grams' => null]);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/shipping/quote', $this->destination())->assertStatus(422);
    }

    public function test_checkout_revalidates_and_ignores_frontend_price(): void
    {
        $this->fakeSuccess();
        $user = $this->user();
        $product = $this->physicalProduct();
        CartItem::create(['id' => 'shipcart0003', 'user_id' => $user->id, 'product_id' => $product->id, 'qty' => 2]);
        $order = $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/shop', ['shipping' => $this->shipping(), 'shipping_cost' => 1])
            ->assertCreated()->json('order');
        $this->assertSame(100000, $order['subtotal']);
        $this->assertSame(12000, $order['shipping_cost']);
        $this->assertSame(112000, $order['total']);
        $this->assertSame('jne', $order['shipping_courier']);
        $this->assertSame('REG', $order['shipping_service']);
        $this->assertSame(1000, $order['shipping_weight_grams']);
        $this->assertSame('1111', (string) $order['shipping_subdistrict_id']);
        $this->assertSame('DAGO', $order['shipping_subdistrict_name']);
        $this->assertSame('40135', (string) $order['shipping_postal_code']);
        $this->assertSame('JAWA BARAT', $order['shipping_province_name']);
        $payment = $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/' . $order['id'] . '/payment', ['method' => 'QRIS'])
            ->assertCreated()->json('payment');
        $this->assertSame(112000, $payment['amount']);
    }

    public function test_checkout_rejects_unknown_service(): void
    {
        $this->fakeSuccess();
        $user = $this->user('unknown-service@example.com');
        $product = $this->physicalProduct('shipprod0004');
        CartItem::create(['id' => 'shipcart0009', 'user_id' => $user->id, 'product_id' => $product->id, 'qty' => 1]);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/shop', ['shipping' => $this->shipping('jne', 'NOPE')])->assertStatus(422);
        $this->assertDatabaseMissing('orders', ['user_id' => $user->id, 'status' => 'pending']);
    }

    public function test_checkout_fails_safely_when_provider_is_down(): void
    {
        Http::fake([
            'rajaongkir.test/api/v1/destination/province' => Http::response([
                'meta' => ['message' => 'ok', 'code' => 200, 'status' => 'success'],
                'data' => [['id' => 1, 'name' => 'JAWA BARAT']],
            ]),
            'rajaongkir.test/api/v1/destination/city/1' => Http::response([
                'meta' => ['message' => 'ok', 'code' => 200, 'status' => 'success'],
                'data' => [['id' => 11, 'name' => 'BANDUNG', 'zip_code' => '40111']],
            ]),
            'rajaongkir.test/api/v1/destination/district/11' => Http::response([
                'meta' => ['message' => 'ok', 'code' => 200, 'status' => 'success'],
                'data' => [['id' => 111, 'name' => 'COBLONG', 'zip_code' => '40132']],
            ]),
            'rajaongkir.test/api/v1/destination/sub-district/111' => Http::response([
                'meta' => ['message' => 'ok', 'code' => 200, 'status' => 'success'],
                'data' => [['id' => 1111, 'name' => 'DAGO', 'zip_code' => '40135']],
            ]),
            'rajaongkir.test/api/v1/calculate/*' => Http::response(['meta' => ['message' => 'error', 'code' => 500, 'status' => 'error'], 'data' => null], 500),
        ]);
        $user = $this->user('provider-down@example.com');
        $product = $this->physicalProduct('shipprod0005');
        CartItem::create(['id' => 'shipcart0010', 'user_id' => $user->id, 'product_id' => $product->id, 'qty' => 1]);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/shop', ['shipping' => $this->shipping()])->assertStatus(502);
        $this->assertDatabaseMissing('orders', ['user_id' => $user->id, 'status' => 'pending']);
    }

    public function test_digital_cart_needs_no_shipping_and_variant_weight_wins(): void
    {
        $this->fakeSuccess();
        $user = $this->user();
        $digital = Product::create(['id' => 'shipdigi0001', 'slug' => 'ebook', 'name' => 'Ebook', 'price' => 25000, 'stock' => 99, 'status' => 'published', 'is_digital' => true, 'digital_file_url' => 'digital/ebook.pdf']);
        CartItem::create(['id' => 'shipcart0005', 'user_id' => $user->id, 'product_id' => $digital->id, 'qty' => 1]);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/shipping/quote', $this->destination())
            ->assertOk()->assertJsonPath('weight_grams', 0)->assertJsonCount(0, 'services');
        $order = $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/shop', [])
            ->assertCreated()->json('order');
        $this->assertSame(0, $order['shipping_cost']);
        $this->assertSame(25000, $order['total']);
        CartItem::where('user_id', $user->id)->delete();
        $product = Product::create(['id' => 'shipprod0002', 'slug' => 'tas', 'name' => 'Tas', 'price' => 80000, 'stock' => 5, 'weight_grams' => 1000, 'status' => 'published', 'is_digital' => false]);
        $variant = ProductVariant::create(['id' => 'shipvar00001', 'product_id' => $product->id, 'label' => 'Hitam', 'price' => 80000, 'stock' => 5, 'weight_grams' => 250]);
        CartItem::create(['id' => 'shipcart0006', 'user_id' => $user->id, 'product_id' => $product->id, 'variant_id' => $variant->id, 'qty' => 2]);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/shipping/quote', $this->destination())
            ->assertOk()->assertJsonPath('weight_grams', 500);
    }

    public function test_mixed_cart_requires_shipping_but_ignores_digital_weight(): void
    {
        $this->fakeSuccess();
        $user = $this->user('mixed-ship@example.com');
        $physical = $this->physicalProduct('shipprod0003', 400);
        $digital = Product::create(['id' => 'shipdigi0002', 'slug' => 'video', 'name' => 'Video', 'price' => 30000, 'stock' => 99, 'status' => 'published', 'is_digital' => true, 'digital_file_url' => 'digital/video.mp4']);
        CartItem::create(['id' => 'shipcart0007', 'user_id' => $user->id, 'product_id' => $physical->id, 'qty' => 1]);
        CartItem::create(['id' => 'shipcart0008', 'user_id' => $user->id, 'product_id' => $digital->id, 'qty' => 5]);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/shipping/quote', $this->destination())
            ->assertOk()->assertJsonPath('weight_grams', 400);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/shop', ['shipping' => ['name' => 'B', 'address' => 'Jl', 'phone' => '08', 'province_id' => 1, 'city_id' => 999, 'district_id' => 111, 'subdistrict_id' => 1111, 'courier' => 'jne', 'service' => 'REG']])
            ->assertStatus(422);
    }

    public function test_physical_cart_without_shipping_selection_is_rejected(): void
    {
        $this->fakeSuccess();
        $user = $this->user('no-ship-bypass@example.com');
        $product = $this->physicalProduct('shipprod0006');
        CartItem::create(['id' => 'shipcart0012', 'user_id' => $user->id, 'product_id' => $product->id, 'qty' => 1]);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/shop', [
            'shipping' => ['name' => 'Buyer', 'address' => 'Jalan Test 1', 'phone' => '08123456789'],
        ])->assertStatus(422);
        $this->assertDatabaseMissing('orders', ['user_id' => $user->id]);
        $partial = $this->shipping();
        unset($partial['district_id'], $partial['subdistrict_id'], $partial['courier'], $partial['service']);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/shop', ['shipping' => $partial])->assertStatus(422);
        $this->assertDatabaseMissing('orders', ['user_id' => $user->id]);
    }

    public function test_runtime_admin_settings_override_static_config(): void
    {
        $this->fakeSuccess();
        $this->seed();
        config(['shipping.origin_subdistrict_id' => '10', 'shipping.couriers' => 'jne:jnt']);
        $service = app(\App\Services\ShippingService::class);
        $this->assertSame('10', $service->originSubdistrictId());
        $this->assertSame(['jne', 'jnt'], $service->enabledCouriers());
        \App\Models\Setting::updateOrCreate(['setting_key' => 'shipping_origin_subdistrict_id'], ['setting_value' => '9999']);
        \App\Models\Setting::updateOrCreate(['setting_key' => 'shipping_couriers'], ['setting_value' => 'jne']);
        $this->assertSame('9999', $service->originSubdistrictId());
        $this->assertSame(['jne'], $service->enabledCouriers());
        \App\Models\Setting::updateOrCreate(['setting_key' => 'shipping_origin_subdistrict_id'], ['setting_value' => '10']);
        $this->assertSame('10', $service->originSubdistrictId());
        \App\Models\Setting::whereIn('setting_key', ['shipping_origin_subdistrict_id', 'shipping_couriers'])->delete();
        $this->assertSame('10', $service->originSubdistrictId());
        $this->assertSame(['jne', 'jnt'], $service->enabledCouriers());
    }

    public function test_region_endpoints_are_throttled(): void
    {
        $routes = collect(\Illuminate\Support\Facades\Route::getRoutes())->filter(fn ($route) => str_contains((string) $route->uri(), 'shipping/'));
        $region = $routes->filter(fn ($route) => in_array('GET', $route->methods(), true) && !str_contains((string) $route->uri(), 'quote'));
        $this->assertNotEmpty($region);
        foreach ($region as $route) {
            $this->assertContains('throttle:60,1', $route->gatherMiddleware(), 'Route ' . $route->uri() . ' must be throttled');
        }
    }
    public function test_shipping_key_never_leaks_to_public_settings(): void
    {
        $this->getJson('/api/v1/settings/public')->assertOk()->assertJsonMissing(['RAJAONGKIR_API_KEY' => 'test-rajaongkir-key']);
        $content = $this->getJson('/api/v1/settings/public')->getContent();
        $this->assertStringNotContainsString('test-rajaongkir-key', $content);
    }

    public function test_shipping_origin_and_couriers_are_admin_managed(): void
    {
        $this->seed();
        config(['shipping.origin_subdistrict_id' => '10', 'shipping.couriers' => 'jne:jnt']);
        $admin = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'admin', 'name' => 'Admin', 'email' => 'ship-settings-admin@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
        $student = $this->user('ship-settings-student@example.com');
        $this->actingAs($student, 'sanctum')->putJson('/api/v1/settings', ['key' => 'shipping_origin_subdistrict_id', 'value' => '99'])->assertForbidden();
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings', ['key' => 'shipping_origin_subdistrict_id', 'value' => '10'])->assertOk();
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings', ['key' => 'shipping_couriers', 'value' => 'jne:jnt'])->assertOk();
        // Runtime resolution (not frozen config): admin settings win at request time.
        $service = app(\App\Services\ShippingService::class);
        $this->assertSame('10', $service->originSubdistrictId());
        $this->assertSame(['jne', 'jnt'], $service->enabledCouriers());
        $this->getJson('/api/v1/settings/public')->assertOk()->assertJsonMissing(['shipping_origin_subdistrict_id' => '10']);
    }

    public function test_product_weight_crud_flows_to_quote(): void
    {
        $this->fakeSuccess();
        $this->seed();
        $admin = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'admin', 'name' => 'Admin', 'email' => 'ship-weight-admin@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
        $product = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/products', [
            'name' => 'Kopi Fisik', 'price' => 60000, 'stock' => 0, 'weight_grams' => 700, 'status' => 'published',
            'variants' => [['label' => 'Bubuk', 'price' => 60000, 'stock' => 3, 'weight_grams' => 350]],
        ])->assertCreated()->json('product');
        $this->assertSame(700, $product['weight_grams']);
        $this->assertSame(350, $product['variants'][0]['weight_grams']);
        $user = $this->user('ship-weight-buyer@example.com');
        CartItem::create(['id' => 'shipcart0011', 'user_id' => $user->id, 'product_id' => $product['id'], 'variant_id' => $product['variants'][0]['id'], 'qty' => 2]);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/shipping/quote', $this->destination())
            ->assertOk()->assertJsonPath('weight_grams', 700);
    }
}
