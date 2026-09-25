<?php

namespace App\Providers;

use App\Contracts\ShippingProvider;
use App\Models\User;
use App\Policies\UserPolicy;
use App\Services\RajaOngkirProvider;
use App\Services\ShippingService;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(ShippingProvider::class, fn () => RajaOngkirProvider::fromConfig());
        $this->app->bind(ShippingService::class, fn ($app) => new ShippingService($app->make(ShippingProvider::class)));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(User::class, UserPolicy::class);
    }
}
