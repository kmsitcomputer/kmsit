<?php

namespace App\Http\Middleware;

use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Cookie\CookieValuePrefix;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class PreventMaintenanceAccess
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        try {
            $maintenance = Setting::where('setting_key', 'maintenance_mode')
                                  ->value('setting_value') === '1';
        } catch (\Throwable) {
            // Fresh install stays reachable until migration completes.
            $maintenance = false;
        }

        if (!$maintenance) {
            return $next($request);
        }

        // Exception paths always accessible during maintenance.
        if ($request->is('api/v1/auth/*') || $request->is('api/v1/settings/public')) {
            return $next($request);
        }

        // Try to resolve user from session first (cookie-based auth). When this runs as global
        // middleware the session has not been started yet, so read it directly (A-04).
        $user = $request->user() ?? $this->sessionUser($request);

        // If no session user, fall back to resolving via Sanctum Bearer token.
        if (!$user && $request->bearerToken()) {
            $token = \Laravel\Sanctum\PersonalAccessToken::findToken($request->bearerToken());
            if ($token?->tokenable instanceof User) {
                $user = $token->tokenable;
            }
        }

        // Admin/Super Admin always get through.
        if ($user && in_array($user->role_key, ['admin', 'super_admin'], true)) {
            return $next($request);
        }

        // All other API requests get 503 during maintenance.
        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json(['message' => 'Aplikasi sedang dalam maintenance.'], 503);
        }

        return response()->view('maintenance', [], 503);
    }

    /**
     * Resolve the logged-in user from the session cookie before StartSession runs. Uses a clone
     * of the session store so the shared instance StartSession will use is left untouched.
     */
    private function sessionUser(Request $request): ?User
    {
        try {
            $raw = $request->cookies->get(config('session.cookie'));
            if (!is_string($raw) || $raw === '') return null;
            try {
                $id = CookieValuePrefix::remove(app('encrypter')->decrypt($raw, false));
            } catch (DecryptException) {
                $id = $raw; // already decrypted by EncryptCookies (route-level instance)
            }
            $store = clone app('session')->driver();
            $store->setId($id);
            $store->start();
            $userId = $store->get(Auth::guard('web')->getName());
            $user = $userId ? User::find($userId) : null;
            return $user && $user->status === 'active' ? $user : null;
        } catch (\Throwable) {
            return null;
        }
    }
}
