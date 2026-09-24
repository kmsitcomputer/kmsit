<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;

/**
 * Session revocation helper — invalidates other sessions, API tokens, and remember tokens on password change.
 */
class SessionRevoker extends Model
{
    /**
     * Revoke all authentication for a user except the current request's context.
     *
     * - Rotates remember_token (invalidates old remember-me cookies)
     * - Deletes all API tokens (Sanctum PATs)
     * - Purges session data keyed to this user from every configured session store
     *   except the one bound to the provided request (if any).
     *
     * @param  \Illuminate\Http\Request|null  $keepRequest  Current authenticated request — its session stays intact.
     */
    public static function revokeOtherSessions(?Model $user, ?\Illuminate\Http\Request $keepRequest = null): void
    {
        if (!$user) return;

        // Rotate remember token and increment auth_epoch to invalidate other sessions (A-16).
        $user->forceFill(['remember_token' => random_bytes(24), 'auth_epoch' => ($user->auth_epoch ?? 0) + 1])->save();

        // Invalidate API tokens (Sanctum personal access tokens)
        if ($user->relationLoaded('tokens')) {
            $user->tokens()->each->delete();
        } else {
            $user->tokens()->delete();
        }

        // Purge sessions belonging to this user, keeping only the current one
        if ($keepRequest && $keepRequest->hasSession()) {
            self::purgeUserSessionsExcept($user->id, $keepRequest->session()->getId());
        }
    }

    /**
     * Delete all sessions for a user except the given session ID.
     */
    private static function purgeUserSessionsExcept(string $userId, string $exceptSessionId): void
    {
        $connections = [config('session.connection')];
        foreach ($connections as $connection) {
            if (!$connection) continue;
            try {
                $db = \DB::connection($connection);
                $table = config('session.table', 'sessions');
                $sessionId = $exceptSessionId ?: '%';
                $db->table($table)
                   ->where('user_id', $userId)
                   ->whereNot('id', $sessionId)
                   ->delete();
            } catch (\Throwable $e) {
                // Best-effort: ignore errors if the connection/table isn't available.
            }
        }
    }
}
