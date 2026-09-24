<?php

namespace App\Http\Middleware;

use App\Models\Setting;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PreventMaintenanceAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        try {
            $maintenance = Setting::where('setting_key', 'maintenance_mode')->value('setting_value') === '1';
        } catch (\Throwable) {
            // A fresh installation must remain reachable until the first migration completes.
            $maintenance = false;
        }
        $user = $request->user();
        $allowed = $user && in_array($user->role_key, ['admin', 'super_admin'], true);

        if ($maintenance && !$allowed && !$request->is('api/v1/auth/*') && !$request->is('api/v1/settings/public')) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json(['message' => 'Aplikasi sedang dalam maintenance.'], 503);
            }
            return response()->view('maintenance', [], 503);
        }

        return $next($request);
    }
}
