<?php

namespace App\Services;

use App\Contracts\LiveClassProvider;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;
use RuntimeException;

/**
 * Zoom Server-to-Server OAuth provider (IMP-006). Backend-only; credentials
 * never leave the server and never appear in logs, errors, or responses.
 */
class ZoomProvider implements LiveClassProvider
{
    public function __construct(
        private readonly string $accountId,
        private readonly string $clientId,
        private readonly string $clientSecret,
        private readonly string $baseUrl,
        private readonly int $timeout,
        private readonly int $connectTimeout,
    ) {}

    public static function fromConfig(): self
    {
        $accountId = (string) config('services.zoom.account_id');
        $clientId = (string) config('services.zoom.client_id');
        $clientSecret = (string) config('services.zoom.client_secret');
        if ($accountId === '' || $clientId === '' || $clientSecret === '') {
            throw new InvalidArgumentException('Zoom belum dikonfigurasi.');
        }
        return new self(
            $accountId, $clientId, $clientSecret,
            rtrim((string) config('services.zoom.base_url', 'https://api.zoom.us'), '/'),
            max(1, (int) config('services.zoom.http_timeout', 15)),
            max(1, (int) config('services.zoom.http_connect_timeout', 5)),
        );
    }

    public function createMeeting(string $title, string $startTime, int $durationMinutes, string $timezone): array
    {
        $this->assertArgs($title, $durationMinutes);
        [$wallTime, $tz] = self::normalizeTime($startTime, $timezone);
        $payload = $this->api('post', '/v2/users/me/meetings', [
            'topic' => $title, 'type' => 2, 'start_time' => $wallTime,
            'duration' => $durationMinutes, 'timezone' => $tz,
            'settings' => ['join_before_host' => false, 'waiting_room' => true],
        ]);
        return $this->normalized($payload);
    }

    public function updateMeeting(string $providerMeetingId, string $title, string $startTime, int $durationMinutes, string $timezone): array
    {
        $this->assertArgs($title, $durationMinutes);
        $this->assertId($providerMeetingId);
        [$wallTime, $tz] = self::normalizeTime($startTime, $timezone);
        $this->api('patch', '/v2/meetings/' . urlencode($providerMeetingId), [
            'topic' => $title, 'start_time' => $wallTime,
            'duration' => $durationMinutes, 'timezone' => $tz,
        ]);
        $payload = $this->api('get', '/v2/meetings/' . urlencode($providerMeetingId));
        return $this->normalized($payload, $providerMeetingId);
    }

    public function cancelMeeting(string $providerMeetingId): void
    {
        $this->assertId($providerMeetingId);
        $this->api('delete', '/v2/meetings/' . urlencode($providerMeetingId));
    }

    /** @return array{provider_meeting_id: string, join_url: string, start_url?: string|null} */
    private function normalized(array $payload, ?string $fallbackId = null): array
    {
        $id = isset($payload['id']) ? (string) $payload['id'] : ($fallbackId ?? '');
        $joinUrl = isset($payload['join_url']) ? (string) $payload['join_url'] : '';
        if ($id === '' || $joinUrl === '') throw new RuntimeException('Respons Zoom tidak valid.');
        $result = ['provider_meeting_id' => $id, 'join_url' => $joinUrl];
        if (isset($payload['start_url']) && is_string($payload['start_url']) && $payload['start_url'] !== '') {
            $result['start_url'] = $payload['start_url'];
        }
        return $result;
    }

    private function assertArgs(string $title, int $durationMinutes): void
    {
        if (trim($title) === '' || $durationMinutes < 1) throw new InvalidArgumentException('Data meeting tidak valid.');
    }

    private function assertId(string $id): void
    {
        if (trim($id) === '') throw new InvalidArgumentException('ID meeting tidak valid.');
    }

    /**
     * Canonical time boundary (IMP-006 remediation F01): validate the target
     * timezone against real PHP identifiers, parse the requested instant, and
     * express it as Zoom wall time (Y-m-d\TH:i:s) in that timezone — never a
     * UTC `Z` timestamp paired with a different timezone field.
     *
     * @return array{0: string, 1: string} [wallTime, timezone]
     */
    public static function normalizeTime(string $startTime, string $timezone): array
    {
        $tz = self::assertTimezone($timezone, true);
        try {
            $instant = new \DateTimeImmutable($startTime);
        } catch (\Throwable) {
            throw new InvalidArgumentException('Waktu jadwal tidak valid.');
        }
        return [$instant->setTimezone(new \DateTimeZone($tz))->format('Y-m-d\TH:i:s'), $tz];
    }

    /** Real PHP identifier allowlist (no duplicated list); empty falls back to app timezone. */
    public static function assertTimezone(string $timezone, bool $allowEmpty = false): string
    {
        $tz = trim($timezone) === '' && $allowEmpty ? (string) config('app.timezone', 'UTC') : trim($timezone);
        if ($tz === '' || !in_array($tz, timezone_identifiers_list(), true)) {
            throw new InvalidArgumentException('Timezone tidak valid.');
        }
        return $tz;
    }

    /**
     * Canonical application instant (IMP-006 R01): parse the requested
     * scheduled time as an absolute instant and express it in the
     * application timezone, matching the repository's existing Eloquent
     * datetime convention (naive DB datetimes round-trip in app tz).
     * The session `timezone` stays separate metadata and never redefines
     * the stored instant.
     */
    public static function canonicalInstant(string $startTime): \DateTimeImmutable
    {
        try {
            $instant = new \DateTimeImmutable($startTime);
        } catch (\Throwable) {
            throw new InvalidArgumentException('Waktu jadwal tidak valid.');
        }
        return $instant->setTimezone(new \DateTimeZone((string) config('app.timezone', 'UTC')));
    }

    private function token(): string
    {
        try {
            $response = Http::asForm()->timeout($this->timeout)->connectTimeout($this->connectTimeout)
                ->withBasicAuth($this->clientId, $this->clientSecret)
                ->acceptJson()->post('https://zoom.us/oauth/token', [
                    'grant_type' => 'account_credentials', 'account_id' => $this->accountId,
                ]);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Layanan Zoom tidak dapat dihubungi. Coba lagi.', previous: $e);
        }
        if (in_array($response->status(), [401, 403], true)) throw new RuntimeException('Konfigurasi Zoom tidak valid.');
        $json = $response->json();
        $token = is_array($json) ? ($json['access_token'] ?? null) : null;
        if (!is_string($token) || $token === '') throw new RuntimeException('Respons Zoom tidak valid.');
        return $token;
    }

    private function api(string $method, string $path, array $payload = []): mixed
    {
        $token = $this->token();
        try {
            $pending = Http::withToken($token)->timeout($this->timeout)->connectTimeout($this->connectTimeout)->acceptJson();
            $response = match ($method) {
                'post' => $pending->post($this->baseUrl . $path, $payload),
                'patch' => $pending->patch($this->baseUrl . $path, $payload),
                'get' => $pending->get($this->baseUrl . $path),
                'delete' => $pending->delete($this->baseUrl . $path),
            };
        } catch (ConnectionException $e) {
            throw new RuntimeException('Layanan Zoom tidak dapat dihubungi. Coba lagi.', previous: $e);
        }
        $status = $response->status();
        if ($status === 401 || $status === 403) throw new RuntimeException('Konfigurasi Zoom tidak valid.');
        if ($method === 'delete' && ($status === 200 || $status === 204)) return [];
        $json = $response->json();
        if (!is_array($json)) throw new RuntimeException('Respons Zoom tidak valid.');
        if ($status >= 400) {
            $message = is_string($json['message'] ?? null) && $json['message'] !== '' ? $json['message'] : 'Layanan Zoom tidak dapat dihubungi. Coba lagi.';
            throw new RuntimeException($status < 500 ? $message : 'Layanan Zoom tidak dapat dihubungi. Coba lagi.');
        }
        return $json;
    }
}
