<?php

namespace App\Providers;

use App\Contracts\RouteProvider;
use App\Contracts\ShippingProvider;
use App\Contracts\LiveClassProvider;
use App\Models\User;
use App\Policies\UserPolicy;
use App\Services\GoogleMeetProvider;
use App\Services\LocalDeliveryService;
use App\Services\LiveClassManager;
use App\Services\OpenRouteProvider;
use App\Services\ZoomProvider;
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
        $this->app->bind(LiveClassProvider::class, fn () => new GoogleMeetProvider());
        $this->app->bind(LiveClassManager::class, fn () => new LiveClassManager());
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(User::class, UserPolicy::class);
    }
}
