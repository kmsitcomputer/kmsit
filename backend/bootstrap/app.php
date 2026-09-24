<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use App\Http\Middleware\PreventMaintenanceAccess;

$basePath = dirname(__DIR__);
$envPath = $basePath . '/.env';

if (!is_file($envPath)) {
    $appKey = 'base64:' . base64_encode(random_bytes(32));
    $templatePath = $basePath . '/.env.production.example';
    $template = is_file($templatePath) ? file_get_contents($templatePath) : "APP_ENV=production\nAPP_DEBUG=false\n";
    $environment = preg_replace('/^APP_KEY=.*$/m', 'APP_KEY=' . $appKey, $template);

    if (@file_put_contents($envPath, $environment, LOCK_EX) === false) {
        putenv('APP_KEY=' . $appKey);
        $_ENV['APP_KEY'] = $appKey;
    }
}

return Application::configure(basePath: $basePath)
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(PreventMaintenanceAccess::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
