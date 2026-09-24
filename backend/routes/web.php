<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->file(public_path('app.html'));
});

foreach (['database/{path}', 'backend/{path}', '.env', 'composer.json', 'package.json'] as $sensitivePath) {
    Route::get('/' . $sensitivePath, fn () => abort(404))->where('path', '.*');
}

Route::get('/{path}', function () {
    return response()->file(public_path('app.html'));
})->where('path', '.*');
