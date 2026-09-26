<?php

namespace App\Services;

use App\Contracts\LiveClassProvider;
use InvalidArgumentException;

/**
 * Google Meet stored-link provider (IMP-006). No Google API, no OAuth, no
 * external calls. Validates that the instructor-supplied URL is a genuine
 * Google Meet link (https://meet.google.com/...); rejects everything else
 * including deceptive subdomains.
 */
class GoogleMeetProvider implements LiveClassProvider
{
    /**
     * For stored links the "creation" input carries the instructor-supplied
     * Meet URL in $title position is WRONG — callers pass the link via
     * createStoredLink(); the contract methods exist for interface symmetry
     * and reject direct use without a validated link.
     */
    public function createMeeting(string $title, string $startTime, int $durationMinutes, string $timezone): array
    {
        throw new InvalidArgumentException('Google Meet memakai link tersimpan — berikan join_url yang valid.');
    }

    public function updateMeeting(string $providerMeetingId, string $title, string $startTime, int $durationMinutes, string $timezone): array
    {
        throw new InvalidArgumentException('Google Meet memakai link tersimpan — berikan join_url yang valid.');
    }

    public function cancelMeeting(string $providerMeetingId): void
    {
        // Stored-link model manages no remote meeting; cancellation is local.
    }

    /** @return array{provider_meeting_id: string, join_url: string} */
    public function createStoredLink(string $url): array
    {
        $link = self::validateMeetUrl($url);
        return ['provider_meeting_id' => 'meet:' . hash('sha256', $link), 'join_url' => $link];
    }

    public static function validateMeetUrl(string $url): string
    {
        // Reject ambiguous input before parsing: browsers (WHATWG) and PHP
        // parse_url can disagree on backslash/userinfo handling for special
        // (HTTPS) URLs, so any control character, whitespace, or backslash
        // makes the link unsafe. Fail closed.
        if (strpos($url, '\\') !== false || preg_match('/[\x00-\x1f\x7f\s]/', $url)) {
            throw new InvalidArgumentException('Link Google Meet tidak valid.');
        }

        $parts = parse_url($url);
        if (!$parts || strtolower((string) ($parts['scheme'] ?? '')) !== 'https') {
            throw new InvalidArgumentException('Link Google Meet harus berupa URL https yang valid.');
        }

        // No userinfo (user), password, or explicit port on a Meet link.
        if (isset($parts['user']) || isset($parts['pass']) || isset($parts['port'])) {
            throw new InvalidArgumentException('Link Google Meet tidak valid.');
        }

        if (strtolower((string) ($parts['host'] ?? '')) !== 'meet.google.com') {
            throw new InvalidArgumentException('Link Google Meet harus berdomain meet.google.com.');
        }

        $path = trim((string) ($parts['path'] ?? ''), '/');
        if ($path === '' || !preg_match('#^[a-z0-9-]+([/?\#].*)?$#i', $path)) {
            throw new InvalidArgumentException('Link Google Meet tidak valid.');
        }

        return $url;
    }
}
