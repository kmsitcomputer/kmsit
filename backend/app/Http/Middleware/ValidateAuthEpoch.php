<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Validate that the session's stored auth_epoch matches the user's current epoch.
 * After password reset/suspend/reactivate, auth_epoch is incremented and old sessions get 401.
 */
class ValidateAuthEpoch
{
    public function handle(Request $request, Closure $next): Response
    {
        // Only check for authenticated users (via cookie/session). Bearer tokens handled separately.
        if ($request->bearerToken() !== null) {
            return $next($request);
        }

        if (!$request->hasSession()) {
            return $next($request);
        }

        $user = $request->user();
        if (!$user) {
            return $next($request);
        }

        // Session stores 'auth_epoch' during login. Compare against current DB value.
        $sessionEpoch = $request->session()->get('auth_epoch');
        $currentEpoch = (int) ($user->auth_epoch ?? 0);

        if ($sessionEpoch !== null && $sessionEpoch !== $currentEpoch) {
            // Epoch mismatch — session is stale (password changed or user suspended).
            $request->session()->invalidate();
            return response()->json(['message' => 'Session tidak valid. Silakan login ulang.'], 401);
        }

        return $next($request);
    }
}
