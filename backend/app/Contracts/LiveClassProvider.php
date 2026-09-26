<?php

namespace App\Contracts;

/**
 * Live class provider boundary (IMP-006). Normalized application data only;
 * raw provider payloads terminate at the provider implementation.
 */
interface LiveClassProvider
{
    /**
     * @return array{provider_meeting_id: string, join_url: string, start_url?: string|null}
     */
    public function createMeeting(string $title, string $startTime, int $durationMinutes, string $timezone): array;

    /** @return array{provider_meeting_id: string, join_url: string} */
    public function updateMeeting(string $providerMeetingId, string $title, string $startTime, int $durationMinutes, string $timezone): array;

    public function cancelMeeting(string $providerMeetingId): void;
}
