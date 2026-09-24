<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\MediaController;

Route::get('/', function () {
    return response()->file(public_path('app.html'));
});

foreach (['database/{path}', 'backend/{path}', '.env', 'composer.json', 'package.json'] as $sensitivePath) {
    Route::get('/' . $sensitivePath, fn () => abort(404))->where('path', '.*');
}

// Fallback file server for the public disk. Only reached when the web server didn't already
// serve the file as a real static asset (i.e. when the storage:link symlink doesn't exist,
// common on shared hosting where PHP's symlink() is disabled) — see MediaController::serve().
Route::get('/storage/{path}', [MediaController::class, 'serve'])->where('path', '.*');

Route::get('/{path}', function () {
    return response()->file(public_path('app.html'));
})->where('path', '.*');
