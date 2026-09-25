<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Support\AdminAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class SettingsController extends Controller
{
    /**
     * Every setting the public site (footer, contact info, About page, social links, map)
     * actually reads via getSetting() must be listed here — anything missing silently comes
     * back empty on the public site even though it saves fine from the admin dashboard,
     * since admin()/adminSettings() (all non-secret keys) is a different, staff-only endpoint.
     */
    private const PUBLIC_KEYS = [
        'site_name', 'site_url', 'slogan', 'logo', 'favicon', 'footer_text', 'default_language', 'timezone', 'currency',
        'allow_registration', 'maintenance_mode', 'email', 'phone', 'whatsapp', 'address', 'google_maps_api_key',
        'google_maps_map_id',
        'map_lat', 'map_lng', 'map_query', 'social_facebook', 'social_instagram', 'social_youtube', 'social_tiktok',
        'seo_title', 'seo_description', 'about_hero_title', 'about_hero_subtitle', 'about_description', 'about_vision',
        'about_mission', 'about_history', 'about_video', 'about_team', 'about_gallery', 'theme_website', 'theme_dashboard',
    ];
    /**
     * Explicit write allowlist: every key the dashboard's Settings forms may persist through the
     * generic endpoints. Anything outside this list (gateway control keys, credentials, unknown
     * keys) is never stored, so a new sensitive key can't silently become writable.
     */
    private const WRITABLE_KEYS = [
        'site_name', 'site_url', 'slogan', 'logo', 'favicon', 'footer_text', 'default_language', 'timezone', 'currency',
        'allow_registration', 'maintenance_mode', 'email', 'phone', 'whatsapp', 'address', 'google_maps_api_key',
        'google_maps_map_id',
        'map_lat', 'map_lng', 'map_query', 'social_facebook', 'social_instagram', 'social_youtube', 'social_tiktok',
        'seo_title', 'seo_description', 'about_hero_title', 'about_hero_subtitle', 'about_description', 'about_vision',
        'about_mission', 'about_history', 'about_video', 'about_team', 'about_gallery', 'theme_website', 'theme_dashboard',
        'platform_fee_percent',
        'shipping_origin_subdistrict_id', 'shipping_couriers',
        'local_delivery_enabled', 'local_delivery_store_name', 'local_delivery_store_latitude',
        'local_delivery_store_longitude', 'local_delivery_minimum_distance_km', 'local_delivery_minimum_fee',
        'local_delivery_rate_per_km', 'local_delivery_maximum_distance_km', 'local_delivery_profile',
        'zoom_enabled', 'zoom_account_id', 'zoom_client_id', 'gmeet_enabled', 'gmeet_default_url',
        'youtube_enabled', 'youtube_channel_url',
    ];

    private const ABOUT_KEYS = ['about_hero_title', 'about_hero_subtitle', 'about_description', 'about_vision', 'about_mission', 'about_history', 'about_video', 'about_team', 'about_gallery'];

    private const URL_KEYS = ['logo', 'favicon', 'about_video', 'site_url', 'social_facebook', 'social_instagram', 'social_youtube', 'social_tiktok', 'gmeet_default_url', 'youtube_channel_url'];

    /** Gateway credentials live in the server environment, never in settings. */
    private const SECRET_KEYS = ['tripay_api_key', 'tripay_private_key', 'xendit_api_key', 'xendit_callback_token', 'stripe_publishable_key', 'stripe_secret_key', 'stripe_webhook_secret'];

    public function public(): JsonResponse
    {
        try {
            $settingsReady = Schema::hasTable('settings');
        } catch (\Throwable) {
            $settingsReady = false;
        }

        if (!$settingsReady) {
            return response()->json(['settings' => []]);
        }

        return response()->json(['settings' => Setting::whereIn('setting_key', self::PUBLIC_KEYS)->pluck('setting_value', 'setting_key')]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate(['key' => ['required', 'string', 'max:100'], 'value' => ['nullable', 'string', 'max:10000']]);
        $key = Str::lower($data['key']);
        if (in_array($key, self::SECRET_KEYS, true)) abort(403, 'Credential payment dikelola melalui environment server.');
        $this->authorizeKey($request, $key);
        if (!in_array($key, self::WRITABLE_KEYS, true)) return response()->json(['setting' => Setting::find($key)]);
        $this->assertSafeValue($key, $data['value'] ?? null);
        $this->assertLocalDeliveryValue($key, $data['value'] ?? null, [$key => $data['value'] ?? null]);

        Setting::updateOrCreate(['setting_key' => $key], ['setting_value' => $data['value'] ?? null]);
        return response()->json(['setting' => Setting::find($key)]);
    }

    public function updateMany(Request $request): JsonResponse
    {
        $data = $request->validate(['settings' => ['required', 'array'], 'settings.*' => ['nullable', 'string', 'max:10000']]);
        $writes = [];
        foreach ($data['settings'] as $key => $value) {
            $key = Str::lower($key);
            if (in_array($key, self::SECRET_KEYS, true) || !in_array($key, self::WRITABLE_KEYS, true)) continue;
            // Validate everything first so a rejected key leaves no partial write behind.
            $this->authorizeKey($request, $key);
            $this->assertSafeValue($key, $value);
            $writes[$key] = $value;
        }
        foreach ($writes as $key => $value) $this->assertLocalDeliveryValue($key, $value, $writes);
        foreach ($writes as $key => $value) Setting::updateOrCreate(['setting_key' => $key], ['setting_value' => $value]);
        return response()->json(['message' => 'Settings diperbarui.']);
    }

    /** Returns only the keys this user may manage (all writable keys, or just the About page keys). */
    public function admin(Request $request): JsonResponse
    {
        $user = $request->user();
        $keys = AdminAccess::allows($user, 'manage_settings') ? self::WRITABLE_KEYS
            : (AdminAccess::allows($user, 'manage_about') ? self::ABOUT_KEYS : abort(403, 'Tidak memiliki permission.'));
        return response()->json(['settings' => Setting::whereIn('setting_key', $keys)->pluck('setting_value', 'setting_key')]);
    }

    /** About-page keys are editable with manage_about; every other key needs manage_settings. */
    private function authorizeKey(Request $request, string $key): void
    {
        $user = $request->user();
        if (in_array($key, self::ABOUT_KEYS, true) && AdminAccess::allows($user, 'manage_about')) return;
        AdminAccess::authorize($user, 'manage_settings');
    }

    /**
     * Local Delivery write validation (IMP-005 remediation): backend is
     * authoritative — HTML min/step/type are never trusted. Single and bulk
     * writes share this path; cross-field rules (max >= min) read the
     * resulting configuration (incoming value or persisted counterpart).
     */
    private function assertLocalDeliveryValue(string $key, ?string $value, array $pending): void
    {
        $resulting = fn (string $k) => array_key_exists($k, $pending) ? $pending[$k] : Setting::where('setting_key', $k)->value('setting_value');
        switch ($key) {
            case 'local_delivery_enabled':
                if (!in_array($value, ['0', '1'], true)) abort(422, 'Setting local_delivery_enabled harus 0 atau 1.');
                return;
            case 'local_delivery_store_latitude':
                $this->assertRange($key, $value, -90, 90, true);
                return;
            case 'local_delivery_store_longitude':
                $this->assertRange($key, $value, -180, 180, true);
                return;
            case 'local_delivery_minimum_distance_km':
                $this->assertNumber($key, $value, 0, true);
                if (!$this->isMissing($value)) {
                    $max = $resulting('local_delivery_maximum_distance_km');
                    if ($max !== null && trim((string) $max) !== '' && is_numeric($max) && (float) $max < (float) $value) {
                        abort(422, 'Setting local_delivery_maximum_distance_km harus >= minimum distance.');
                    }
                }
                return;
            case 'local_delivery_maximum_distance_km':
                $this->assertPositive($key, $value);
                $min = $resulting('local_delivery_minimum_distance_km');
                $min = $min !== null && trim((string) $min) !== '' && is_numeric($min) ? (float) $min : 0;
                if ((float) $value < $min) abort(422, 'Setting local_delivery_maximum_distance_km harus >= minimum distance.');
                return;
            case 'local_delivery_minimum_fee':
            case 'local_delivery_rate_per_km':
                $this->assertIntegerMoney($key, $value);
                return;
            case 'local_delivery_profile':
                if (!in_array($value, \App\Services\OpenRouteProvider::PROFILES, true)) {
                    abort(422, 'Setting local_delivery_profile tidak didukung.');
                }
                return;
        }
    }

    private function assertRange(string $key, ?string $value, float $min, float $max, bool $allowEmpty): void
    {
        if ($this->isMissing($value)) {
            if ($allowEmpty) return;
            abort(422, "Setting {$key} wajib diisi.");
        }
        if (!is_numeric($value) || !is_finite((float) $value) || (float) $value < $min || (float) $value > $max) {
            abort(422, "Setting {$key} harus berupa angka {$min} sampai {$max}.");
        }
    }

    private function assertNumber(string $key, ?string $value, float $min, bool $allowEmpty): void
    {
        if ($this->isMissing($value)) {
            if ($allowEmpty) return;
            abort(422, "Setting {$key} wajib diisi.");
        }
        if (!is_numeric($value) || !is_finite((float) $value) || (float) $value < $min) {
            abort(422, "Setting {$key} harus berupa angka >= {$min}.");
        }
    }

    private function assertIntegerMoney(string $key, ?string $value): void
    {
        if ($this->isMissing($value)) abort(422, "Setting {$key} wajib diisi.");
        if (!is_numeric($value) || !is_finite((float) $value) || (float) $value < 0 || floor((float) $value) != (float) $value) {
            abort(422, "Setting {$key} harus berupa bilangan bulat >= 0.");
        }
    }

    private function assertPositive(string $key, ?string $value): void
    {
        if ($this->isMissing($value)) abort(422, "Setting {$key} wajib diisi.");
        if (!is_numeric($value) || !is_finite((float) $value) || (float) $value <= 0) {
            abort(422, "Setting {$key} harus berupa angka > 0.");
        }
    }

    private function isMissing(?string $value): bool
    {
        return $value === null || trim($value) === '';
    }

    /** A-21: link-type settings are rendered as href/src, so only http(s) URLs are stored (single and bulk writes). */
    private function assertSafeValue(string $key, ?string $value): void
    {
        if ($value === null || $value === '' || !in_array($key, self::URL_KEYS, true)) return;
        $parsed = parse_url($value);
        if (!$parsed || !in_array(strtolower($parsed['scheme'] ?? ''), ['http', 'https'], true)) {
            abort(422, "Setting {$key} harus berupa URL http atau https.");
        }
    }

    public function payment(Request $request): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_settings');
        $settings = Setting::whereIn('setting_key', ['gateway_active', 'gateway_mode'])->pluck('setting_value', 'setting_key');
        return response()->json(['gateway' => $settings['gateway_active'] ?? config('payment.active'), 'mode' => $settings['gateway_mode'] ?? config('payment.mode'), 'configured' => [
            'tripay' => (bool) (config('payment.tripay.api_key') && config('payment.tripay.private_key') && config('payment.tripay.merchant_code')),
            'xendit' => (bool) (config('payment.xendit.api_key') && config('payment.xendit.callback_token')),
            'stripe' => (bool) (config('payment.stripe.secret_key') && config('payment.stripe.webhook_secret')),
        ]]);
    }

    public function updatePayment(Request $request): JsonResponse
    {
        abort_unless($request->user()->role_key === 'super_admin', 403, 'Hanya Super Admin yang dapat mengubah payment gateway.');
        $data = $request->validate(['gateway' => ['required', 'in:tripay,xendit,stripe'], 'mode' => ['required', 'in:sandbox,live']]);
        Setting::updateOrCreate(['setting_key' => 'gateway_active'], ['setting_value' => $data['gateway']]);
        Setting::updateOrCreate(['setting_key' => 'gateway_mode'], ['setting_value' => $data['mode']]);
        return response()->json(['gateway' => $data['gateway'], 'mode' => $data['mode']]);
    }
}
