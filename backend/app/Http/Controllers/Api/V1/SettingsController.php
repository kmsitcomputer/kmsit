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
        'map_lat', 'map_lng', 'map_query', 'social_facebook', 'social_instagram', 'social_youtube', 'social_tiktok',
        'seo_title', 'seo_description', 'about_hero_title', 'about_hero_subtitle', 'about_description', 'about_vision',
        'about_mission', 'about_history', 'about_video', 'about_team', 'about_gallery', 'theme_website', 'theme_dashboard',
        'platform_fee_percent',
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

    private function authorizeAdmin(Request $request): void
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
    }
}
