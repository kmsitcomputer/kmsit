<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Central in-app notifications (A-25), stored in the existing `notifications` table.
 *
 * - Idempotent: every event carries a deterministic `event_key`; the (user_id, event_key) unique
 *   index plus INSERT-OR-IGNORE means a replayed webhook or retried request never adds a second row.
 * - Transactional: callers invoke this inside their business transaction, so a rollback removes
 *   the notification together with the change it describes.
 * - No e-mail/SMS, and payloads carry no secrets or personal contact data (titles, amounts, links only).
 */
class NotificationService
{
    public function notify(string $userId, string $eventKey, string $title, ?string $body = null, ?string $link = null, string $kind = 'info'): void
    {
        $now = now();
        DB::table('notifications')->insertOrIgnore([
            'id' => Str::lower(Str::random(12)),
            'user_id' => $userId,
            'event_key' => Str::limit($eventKey, 160, ''),
            'title' => Str::limit($title, 190, ''),
            'body' => $body === null ? null : Str::limit($body, 500, ''),
            'link' => $link,
            'kind' => in_array($kind, ['info', 'success', 'warning', 'danger'], true) ? $kind : 'info',
            'is_read' => false,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    /** Every active super_admin, plus active admins whose role grants the permission (or '*'). */
    public function notifyStaff(string $permission, string $eventKey, string $title, ?string $body = null, ?string $link = null, string $kind = 'warning'): void
    {
        foreach ($this->staffWith($permission) as $userId) {
            $this->notify($userId, $eventKey, $title, $body, $link, $kind);
        }
    }

    /** @return Collection<int, string> */
    public function staffWith(string $permission): Collection
    {
        return User::query()->where('status', 'active')->whereIn('role_key', ['super_admin', 'admin'])->with('role')->get(['id', 'role_key'])
            ->filter(function (User $user) use ($permission) {
                if ($user->role_key === 'super_admin') return true;
                $permissions = $user->role?->permissions ?? [];
                return in_array($permission, $permissions, true) || in_array('*', $permissions, true);
            })
            ->pluck('id')->values();
    }

    public static function money(int $amount): string
    {
        return 'Rp' . number_format($amount, 0, ',', '.');
    }
}
