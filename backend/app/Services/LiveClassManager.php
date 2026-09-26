<?php

namespace App\Services;

use App\Contracts\LiveClassProvider;
use App\Models\Setting;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;

/**
 * Live class manager (IMP-006). Resolves the provider behind the
 * LiveClassProvider contract and owns runtime business-setting gates,
 * mirroring the ShippingService runtime pattern.
 */
class LiveClassManager
{
    public const PROVIDERS = ['zoom', 'google_meet'];

    public function resolve(string $provider): LiveClassProvider
    {
        return match ($provider) {
            'zoom' => ZoomProvider::fromConfig(),
            'google_meet' => new GoogleMeetProvider(),
            default => throw new InvalidArgumentException('Provider Live Class tidak didukung.'),
        };
    }

    public function assertProviderUsable(string $provider): void
    {
        if (!in_array($provider, self::PROVIDERS, true)) throw new InvalidArgumentException('Provider Live Class tidak didukung.');
        // Absent settings mean usable (backward compatible); explicit '0' disables.
        if (($this->setting('live_class_enabled') ?? '1') !== '1') {
            throw new InvalidArgumentException('Live Class belum diaktifkan.');
        }
        if ($provider === 'zoom' && ($this->setting('zoom_enabled') ?? '1') !== '1') {
            throw new InvalidArgumentException('Zoom belum diaktifkan.');
        }
        if ($provider === 'google_meet' && ($this->setting('gmeet_enabled') ?? '1') !== '1') {
            throw new InvalidArgumentException('Google Meet belum diaktifkan.');
        }
    }

    public function defaultProvider(): string
    {
        $default = $this->setting('live_class_default_provider');
        return in_array($default, self::PROVIDERS, true) ? $default : 'zoom';
    }

    private function setting(string $key): ?string
    {
        try {
            if (!Schema::hasTable('settings')) return null;
            $value = Setting::where('setting_key', $key)->value('setting_value');
            return is_string($value) ? $value : null;
        } catch (\Throwable) {
            return null;
        }
    }
}
