<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SettingsController extends Controller
{
    private const PUBLIC_KEYS = ['site_name', 'slogan', 'logo', 'favicon', 'default_language', 'timezone', 'currency', 'maintenance_mode', 'about_hero_title', 'about_hero_subtitle', 'about_description', 'about_vision', 'about_mission', 'about_history', 'about_video', 'about_team', 'about_gallery'];
    private const SECRET_KEYS = ['tripay_api_key', 'tripay_private_key', 'xendit_api_key', 'stripe_publishable_key', 'stripe_secret_key', 'stripe_webhook_secret'];

    public function public(): JsonResponse
    {
        return response()->json(['settings' => Setting::whereIn('setting_key', self::PUBLIC_KEYS)->pluck('setting_value', 'setting_key')]);
    }

    public function update(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        $data = $request->validate(['key' => ['required', 'string', 'max:100'], 'value' => ['nullable', 'string', 'max:10000']]);
        if (in_array(Str::lower($data['key']), ['tripay_private_key', 'xendit_api_key', 'stripe_secret_key', 'stripe_webhook_secret'], true)) abort(403, 'Credential payment dikelola melalui environment server.');
        Setting::updateOrCreate(['setting_key' => $data['key']], ['setting_value' => $data['value'] ?? null]);
        return response()->json(['setting' => Setting::find($data['key'])]);
    }

    public function updateMany(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        $data = $request->validate(['settings' => ['required', 'array'], 'settings.*' => ['nullable', 'string', 'max:10000']]);
        foreach ($data['settings'] as $key => $value) {
            if (in_array(Str::lower($key), self::SECRET_KEYS, true)) continue;
            Setting::updateOrCreate(['setting_key' => $key], ['setting_value' => $value]);
        }
        return response()->json(['message' => 'Settings diperbarui.']);
    }

    public function admin(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        return response()->json(['settings' => Setting::whereNotIn('setting_key', self::SECRET_KEYS)->pluck('setting_value', 'setting_key')]);
    }

    public function payment(): JsonResponse
    {
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
