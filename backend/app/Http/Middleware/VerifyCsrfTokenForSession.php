<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Cookie\CookieValuePrefix;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * CSRF protection for cookie-authenticated API mutations (A-02).
 * Bearer-token clients are exempt (no ambient credential to ride). The token comes from
 * X-CSRF-TOKEN (plain) or X-XSRF-TOKEN (the encrypted XSRF-TOKEN cookie echoed by the SPA),
 * exactly like Laravel's own CSRF middleware.
 */
class VerifyCsrfTokenForSession
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->bearerToken() !== null) {
            return $next($request);
        }

        if (in_array(strtoupper($request->method()), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return $next($request);
        }

        // CSRF rides on ambient browser credentials. A request carrying neither the session cookie
        // nor a remember-me cookie cannot be cookie-authenticated, so there is nothing to protect.
        if (!$request->hasSession() || !$this->hasAmbientCredentials($request)) {
            return $next($request);
        }

        $expected = $request->session()->token();
        $given = $this->tokenFromRequest($request);

        // abort() must stay outside any try/catch: HttpException extends RuntimeException.
        abort_unless(is_string($expected) && $expected !== '' && is_string($given) && hash_equals($expected, $given), 419, 'CSRF token mismatch.');

        return $next($request);
    }

    private function hasAmbientCredentials(Request $request): bool
    {
        if ($request->cookies->has(config('session.cookie'))) return true;
        foreach ($request->cookies->keys() as $name) {
            if (str_starts_with((string) $name, 'remember_')) return true;
        }
        return false;
    }

    private function tokenFromRequest(Request $request): ?string
    {
        $token = $request->header('X-CSRF-TOKEN');
        if (is_string($token) && $token !== '') return $token;

        $header = $request->header('X-XSRF-TOKEN');
        if (!is_string($header) || $header === '') return null;
        try {
            return CookieValuePrefix::remove(app('encrypter')->decrypt($header, false));
        } catch (DecryptException) {
            return null;
        }
    }
}
