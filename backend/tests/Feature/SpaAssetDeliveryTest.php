<?php

namespace Tests\Feature;

use Tests\TestCase;

class SpaAssetDeliveryTest extends TestCase
{
    public function test_spa_shell_is_not_cached(): void
    {
        $home = $this->get('/')->assertOk();
        $this->assertStringContainsString('no-cache', (string) $home->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', (string) $home->headers->get('Cache-Control'));

        $dashboard = $this->get('/dashboard')->assertOk();
        $this->assertStringContainsString('no-cache', (string) $dashboard->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', (string) $dashboard->headers->get('Cache-Control'));
    }

    public function test_missing_vite_asset_returns_404_instead_of_spa_html(): void
    {
        $this->get('/assets/build-that-no-longer-exists.js')
            ->assertNotFound();
    }
}
