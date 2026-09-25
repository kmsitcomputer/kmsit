<?php

namespace App\Providers;

use App\Contracts\RouteProvider;
use App\Contracts\ShippingProvider;
use App\Models\User;
use App\Policies\UserPolicy;
use App\Services\LocalDeliveryService;
use App\Services\OpenRouteProvider;
use App\Services\RajaOngkirProvider;
use App\Services\RouteManager;
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
        $this->app->bind(RouteProvider::class, fn () => OpenRouteProvider::fromConfig());
        $this->app->bind(RouteManager::class, fn ($app) => new RouteManager($app->make(RouteProvider::class)));
        $this->app->bind(LocalDeliveryService::class, fn ($app) => new LocalDeliveryService($app->make(RouteManager::class)));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(User::class, UserPolicy::class);
    }
}
