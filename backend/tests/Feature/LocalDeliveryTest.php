<?php

namespace Tests\Feature;

use App\Models\CartItem;
use App\Models\Product;
use App\Models\Setting;
use App\Models\User;
use App\Services\LocalDeliveryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * IMP-005: OpenRoute routing + Local Delivery pricing, all provider HTTP
 * faked (never live). Covers auth/coordinate order/profile validation,
 * failure mapping, locked tariff boundaries, maximum gate on actual
 * distance, runtime settings, tamper resistance, snapshot, regressions.
 */
class LocalDeliveryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config([
            'route.api_key' => 'test-openroute-key',
            'route.base_url' => 'https://openroute.test',
            'route.profile' => 'driving-car',
            'route.http.timeout' => 5,
            'route.http.connect_timeout' => 2,
        ]);
        $this->seed();
    }

    private function settings(array $overrides = []): void
    {
        $defaults = [
            'local_delivery_enabled' => '1',
            'local_delivery_store_name' => 'Toko KMSIT',
            'local_delivery_store_latitude' => '-6.9175',
            'local_delivery_store_longitude' => '107.6191',
            'local_delivery_minimum_distance_km' => '3',
            'local_delivery_minimum_fee' => '10000',
            'local_delivery_rate_per_km' => '2500',
            'local_delivery_maximum_distance_km' => '30',
        ];
        foreach ([...$defaults, ...$overrides] as $key => $value) {
            Setting::updateOrCreate(['setting_key' => $key], ['setting_value' => (string) $value]);
        }
    }

    private function fakeRoute(int $meters, int $duration = 600): void
    {
        Http::fake([
            'openroute.test/v2/directions/*' => Http::response([
                'routes' => [['summary' => ['distance' => $meters, 'duration' => $duration]]],
                'bbox' => [107.0, -7.0, 108.0, -6.0],
            ]),
        ]);
    }

    private function user(string $email = 'local-user@example.com'): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Local User', 'email' => $email, 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }

    private function physicalProduct(string $id = 'localprod0001'): Product
    {
        return Product::create(['id' => $id, 'slug' => 'produk-' . $id, 'name' => 'Produk ' . $id, 'price' => 50000, 'stock' => 10, 'weight_grams' => 500, 'status' => 'published', 'is_digital' => false]);
    }

    private function coords(float $lat = -6.9200, float $lng = 107.6250): array
    {
        return ['latitude' => $lat, 'longitude' => $lng];
    }

    // ---------- Provider ----------

    public function test_route_uses_auth_and_lng_lat_order(): void
    {
        $this->settings();
        $this->fakeRoute(1800);
        $service = app(LocalDeliveryService::class);
        $quote = $service->quote(-6.9200, 107.6250);
        $this->assertSame(1800, $quote['distance_meters']);
        $this->assertSame(10000, $quote['shipping_cost']);
        Http::assertSent(function ($request) {
            if (!str_contains($request->url(), 'v2/directions/driving-car')) return false;
            $this->assertSame('test-openroute-key', $request->header('Authorization')[0] ?? null);
            $coords = $request['coordinates'] ?? null;
            $this->assertSame([[107.6191, -6.9175], [107.625, -6.92]], $coords);
            return true;
        });
    }

    public function test_invalid_coordinates_rejected_without_clamp_or_swap(): void
    {
        $this->settings();
        $this->fakeRoute(1000);
        $user = $this->user('coord-invalid@example.com');
        foreach ([[91.0, 107.0], [-91.0, 107.0], [-6.9, 181.0], [-6.9, -181.0]] as [$lat, $lng]) {
            $this->actingAs($user, 'sanctum')
                ->postJson('/api/v1/local-delivery/quote', ['latitude' => $lat, 'longitude' => $lng])->assertStatus(422);
        }
        Http::assertNothingSent();
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/local-delivery/quote', ['latitude' => 'abc', 'longitude' => 107.0])->assertStatus(422);
    }

    public function test_unsupported_profile_rejected(): void
    {
        $this->settings();
        $this->fakeRoute(1000);
        $provider = \App\Services\OpenRouteProvider::fromConfig();
        try {
            $provider->route(-6.9175, 107.6191, -6.92, 107.625, 'teleport');
            $this->fail('unsupported profile must throw');
        } catch (\InvalidArgumentException $e) {
            $this->assertStringContainsString('Profil', $e->getMessage());
        }
    }

    public function test_provider_failures_map_safely(): void
    {
        $this->settings();
        $user = $this->user();
        Http::fake(['openroute.test/*' => Http::response(null, 500)]);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/local-delivery/quote', $this->coords())->assertStatus(502);
        Http::fake(['openroute.test/*' => Http::response(['message' => 'nope'], 200)]);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/local-delivery/quote', $this->coords())->assertStatus(502);
        Http::fake(['openroute.test/*' => Http::response(['routes' => []], 200)]);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/local-delivery/quote', $this->coords())->assertStatus(502);
        Http::fake(['openroute.test/*' => Http::response(['routes' => [['summary' => ['duration' => 5]]]], 200)]);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/local-delivery/quote', $this->coords())->assertStatus(502);
        Http::fake(['openroute.test/*' => Http::response(['error' => 'Quota exceeded'], 429)]);
        $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/local-delivery/quote', $this->coords());
        $response->assertStatus(502);
        $this->assertStringNotContainsString('test-openroute-key', $response->getContent());
    }

    // ---------- Locked pricing ----------

    #[\PHPUnit\Framework\Attributes\DataProvider('pricingCases')]
    public function test_locked_tariff_boundaries(int $meters, int $expected): void
    {
        $this->assertSame($expected, LocalDeliveryService::price($meters, 3.0, 10000, 2500));
    }

    public static function pricingCases(): array
    {
        return [
            'below min 1.80km' => [1800, 10000],
            'exactly min 3.00km' => [3000, 10000],
            'excess .20' => [3200, 10000],
            'excess .49' => [3490, 10000],
            'excess .50 up' => [3500, 12500],
            'excess 1.20' => [4200, 12500],
            'excess 1.50 up' => [4500, 15000],
            'excess 5.40' => [8400, 22500],
            'excess 5.50 up' => [8500, 25000],
            'whole excess 2.00' => [5000, 15000],
            'excess .80' => [3800, 12500],
        ];
    }

    // ---------- Maximum gate on ACTUAL distance ----------

    public function test_maximum_uses_actual_distance_not_rounded(): void
    {
        $this->settings(['local_delivery_maximum_distance_km' => '30']);
        $user = $this->user('local-maxq@example.com');
        $this->fakeRoute(30000);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/local-delivery/quote', $this->coords())->assertOk();
    }

    public function test_fraction_above_maximum_is_rejected(): void
    {
        $this->settings(['local_delivery_maximum_distance_km' => '30']);
        $user = $this->user('local-maxfrac@example.com');
        $this->fakeRoute(30100);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/local-delivery/quote', $this->coords())
            ->assertStatus(422)->assertJsonFragment(['message' => 'Lokasi di luar jangkauan Local Delivery.']);
    }

    public function test_decimal_minimum_uses_integer_meter_math(): void
    {
        // DeepSeek F02: float 0.7-0.2 left 0.49999… and undercharged.
        // Integer meters: 700-200=500 → up.
        $this->assertSame(200, LocalDeliveryService::kmToMeters(0.2));
        $this->assertSame(2500, LocalDeliveryService::kmToMeters(2.5));
        $this->assertSame(3000, LocalDeliveryService::kmToMeters(3.0));
        $this->assertSame(10000, LocalDeliveryService::price(200, 0.2, 10000, 2500));
        $this->assertSame(10000, LocalDeliveryService::price(690, 0.2, 10000, 2500));
        $this->assertSame(12500, LocalDeliveryService::price(700, 0.2, 10000, 2500));
        $this->assertSame(12500, LocalDeliveryService::price(1690, 0.2, 10000, 2500));
        $this->assertSame(15000, LocalDeliveryService::price(1700, 0.2, 10000, 2500));
    }

    public function test_decimal_minimum_quote_end_to_end(): void
    {
        $this->settings(['local_delivery_minimum_distance_km' => '0.2', 'local_delivery_minimum_fee' => '10000', 'local_delivery_rate_per_km' => '2500']);
        $user = $this->user('local-decimal@example.com');
        $this->fakeRoute(700);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/local-delivery/quote', $this->coords())
            ->assertOk()->assertJsonPath('shipping_cost', 12500);
    }

    // ---------- Runtime settings ----------

    public function test_runtime_setting_changes_apply_without_config_rebuild(): void
    {
        $this->settings();
        $this->fakeRoute(1800);
        $service = app(LocalDeliveryService::class);
        $this->assertSame(10000, $service->quote(-6.92, 107.625)['shipping_cost'] ?? null);
        Setting::updateOrCreate(['setting_key' => 'local_delivery_minimum_fee'], ['setting_value' => '20000']);
        $this->assertSame(20000, $service->quote(-6.92, 107.625)['shipping_cost'] ?? null);
        Setting::updateOrCreate(['setting_key' => 'local_delivery_enabled'], ['setting_value' => '0']);
        try {
            $service->quote(-6.92, 107.625);
            $this->fail('disabled delivery must throw');
        } catch (\InvalidArgumentException $e) {
            $this->assertStringContainsString('belum diaktifkan', $e->getMessage());
        }
    }

    public function test_runtime_rate_change_applies_without_config_rebuild(): void
    {
        $this->settings(['local_delivery_minimum_fee' => '20000', 'local_delivery_rate_per_km' => '5000']);
        $this->fakeRoute(4500);
        $service = app(LocalDeliveryService::class);
        $this->assertSame(30000, $service->quote(-6.92, 107.625)['shipping_cost'] ?? null);
    }

    // ---------- Checkout security ----------

    public function test_checkout_ignores_tampered_distance_and_cost(): void
    {
        $this->settings();
        $this->fakeRoute(1800);
        $user = $this->user();
        $product = $this->physicalProduct();
        CartItem::create(['id' => 'localcart001', 'user_id' => $user->id, 'product_id' => $product->id, 'qty' => 1]);
        $order = $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/shop', ['shipping' => [
            'name' => 'B', 'address' => 'Jl', 'phone' => '08', 'delivery_method' => 'local_delivery',
            'local_latitude' => -6.92, 'local_longitude' => 107.625,
            'distance' => 1, 'distance_meters' => 1, 'shipping_cost' => 1, 'local_delivery_cost' => 1,
            'eligible' => true, 'minimum_fee' => 1, 'rate_per_km' => 1, 'maximum_distance' => 9999,
        ]])->assertCreated()->json('order');
        $this->assertSame('local_delivery', $order['delivery_method']);
        $this->assertSame(10000, $order['shipping_cost']);
        $this->assertSame(60000, $order['total']);
        $this->assertEqualsWithDelta(-6.92, (float) $order['delivery_latitude'], 0.0001);
        $this->assertSame(1800, $order['delivery_distance_meters']);
    }

    public function test_over_max_and_provider_down_create_no_order(): void
    {
        $this->settings(['local_delivery_maximum_distance_km' => '5']);
        $this->fakeRoute(6000);
        $user = $this->user('local-max@example.com');
        $product = $this->physicalProduct('localprod0002');
        CartItem::create(['id' => 'localcart002', 'user_id' => $user->id, 'product_id' => $product->id, 'qty' => 1]);
        $ship = ['name' => 'B', 'address' => 'Jl', 'phone' => '08', 'delivery_method' => 'local_delivery', 'local_latitude' => -6.92, 'local_longitude' => 107.625];
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/shop', ['shipping' => $ship])->assertStatus(422);
        $this->assertDatabaseMissing('orders', ['user_id' => $user->id]);
    }

    public function test_provider_down_creates_no_local_order(): void
    {
        $this->settings();
        Http::fake(['openroute.test/*' => Http::response(null, 500)]);
        $user = $this->user('local-down@example.com');
        $product = $this->physicalProduct('localprod0004');
        CartItem::create(['id' => 'localcart005', 'user_id' => $user->id, 'product_id' => $product->id, 'qty' => 1]);
        $ship = ['name' => 'B', 'address' => 'Jl', 'phone' => '08', 'delivery_method' => 'local_delivery', 'local_latitude' => -6.92, 'local_longitude' => 107.625];
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/shop', ['shipping' => $ship])->assertStatus(502);
        $this->assertDatabaseMissing('orders', ['user_id' => $user->id]);
    }

    public function test_snapshot_survives_tariff_changes(): void
    {
        $this->settings();
        $this->fakeRoute(4500);
        $user = $this->user('local-snap@example.com');
        $product = $this->physicalProduct('localprod0003');
        CartItem::create(['id' => 'localcart003', 'user_id' => $user->id, 'product_id' => $product->id, 'qty' => 1]);
        $order = $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/shop', ['shipping' => [
            'name' => 'B', 'address' => 'Jl', 'phone' => '08', 'delivery_method' => 'local_delivery',
            'local_latitude' => -6.92, 'local_longitude' => 107.625,
        ]])->assertCreated()->json('order');
        $this->assertSame(15000, $order['shipping_cost']);
        $this->assertSame(4500, $order['delivery_distance_meters']);
        Setting::updateOrCreate(['setting_key' => 'local_delivery_minimum_fee'], ['setting_value' => '99999']);
        $fresh = $this->actingAs($user, 'sanctum')->getJson('/api/v1/orders/' . $order['id'])->assertOk()->json('order');
        $this->assertSame(15000, $fresh['shipping_cost']);
        $this->assertSame(65000, $fresh['total']);
    }

    public function test_config_endpoint_exposes_no_secret(): void
    {
        $this->settings();
        $user = $this->user();
        $response = $this->actingAs($user, 'sanctum')->getJson('/api/v1/local-delivery/config')->assertOk();
        $response->assertJsonPath('enabled', true)->assertJsonPath('minimum_fee', 10000);
        $this->assertStringNotContainsString('test-openroute-key', $response->getContent());
    }

    public function test_digital_checkout_needs_no_route(): void
    {
        $this->settings();
        $user = $this->user('local-digital@example.com');
        $digital = Product::create(['id' => 'localdigi0001', 'slug' => 'ebook-local', 'name' => 'Ebook', 'price' => 25000, 'stock' => 99, 'status' => 'published', 'is_digital' => true, 'digital_file_url' => 'digital/ebook.pdf']);
        CartItem::create(['id' => 'localcart004', 'user_id' => $user->id, 'product_id' => $digital->id, 'qty' => 1]);
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/shop', [])->assertCreated()->assertJsonPath('order.shipping_cost', 0);
        Http::assertNothingSent();
    }

    private function settingsAdmin(): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'admin', 'name' => 'Admin', 'email' => 'local-settings-admin@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }

    public function test_local_delivery_write_validation_rejects_bad_values(): void
    {
        $this->seed();
        $admin = $this->settingsAdmin();
        $put = fn (string $key, ?string $value) => $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings', ['key' => $key, 'value' => $value]);
        $put('local_delivery_store_latitude', '-91')->assertStatus(422);
        $put('local_delivery_store_latitude', '91')->assertStatus(422);
        $put('local_delivery_store_longitude', '-181')->assertStatus(422);
        $put('local_delivery_store_longitude', '181')->assertStatus(422);
        $put('local_delivery_minimum_distance_km', '-1')->assertStatus(422);
        $put('local_delivery_maximum_distance_km', '0')->assertStatus(422);
        $put('local_delivery_minimum_fee', '-100')->assertStatus(422);
        $put('local_delivery_rate_per_km', '-100')->assertStatus(422);
        $put('local_delivery_minimum_fee', '')->assertStatus(422);
        $put('local_delivery_rate_per_km', '')->assertStatus(422);
        $put('local_delivery_profile', 'teleport')->assertStatus(422);
        $put('local_delivery_enabled', 'yes')->assertStatus(422);
        $put('local_delivery_minimum_distance_km', '10')->assertOk();
        $put('local_delivery_maximum_distance_km', '5')->assertStatus(422);
        $this->assertDatabaseMissing('settings', ['setting_key' => 'local_delivery_store_latitude']);
        $put('local_delivery_store_latitude', '-6.9175')->assertOk();
        $put('local_delivery_store_longitude', '107.6191')->assertOk();
        $put('local_delivery_maximum_distance_km', '5')->assertStatus(422);
        $put('local_delivery_maximum_distance_km', '15')->assertOk();
        $put('local_delivery_minimum_fee', '10000')->assertOk();
        $put('local_delivery_rate_per_km', '2500')->assertOk();
        $put('local_delivery_profile', 'foot-walking')->assertOk();
        $put('local_delivery_enabled', '1')->assertOk();
    }

    public function test_local_delivery_bulk_write_is_atomic_and_cross_validated(): void
    {
        $this->seed();
        $admin = $this->settingsAdmin();
        $post = fn (array $settings) => $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings/bulk', ['settings' => $settings]);
        $post([
            'local_delivery_enabled' => '1', 'local_delivery_store_latitude' => '-6.9175',
            'local_delivery_store_longitude' => '107.6191', 'local_delivery_minimum_distance_km' => '3',
            'local_delivery_minimum_fee' => '10000', 'local_delivery_rate_per_km' => '2500',
            'local_delivery_maximum_distance_km' => '30', 'local_delivery_profile' => 'driving-car',
        ])->assertOk();
        $this->assertSame('30', Setting::where('setting_key', 'local_delivery_maximum_distance_km')->value('setting_value'));
        $post(['local_delivery_minimum_distance_km' => '10', 'local_delivery_maximum_distance_km' => '5'])->assertStatus(422);
        $this->assertSame('3', Setting::where('setting_key', 'local_delivery_minimum_distance_km')->value('setting_value'));
        $this->assertSame('30', Setting::where('setting_key', 'local_delivery_maximum_distance_km')->value('setting_value'));
        $post(['local_delivery_maximum_distance_km' => '2'])->assertStatus(422);
        $post(['local_delivery_minimum_distance_km' => '2'])->assertOk();
        $post(['local_delivery_maximum_distance_km' => '2'])->assertOk();
        $this->assertSame('2', Setting::where('setting_key', 'local_delivery_maximum_distance_km')->value('setting_value'));
    }

    public function test_google_maps_map_id_follows_public_setting_contract(): void
    {
        $this->seed();
        $admin = $this->settingsAdmin();
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings', ['key' => 'google_maps_map_id', 'value' => 'DEMO_MAP_ID'])->assertOk();
        $this->getJson('/api/v1/settings/public')->assertOk()->assertJsonFragment(['google_maps_map_id' => 'DEMO_MAP_ID']);
        $this->getJson('/api/v1/settings/public')->assertOk()->assertJsonMissing(['OPENROUTE_API_KEY' => 'test-openroute-key']);
        $this->assertStringNotContainsString('test-openroute-key', $this->getJson('/api/v1/settings/public')->getContent());
    }
}
