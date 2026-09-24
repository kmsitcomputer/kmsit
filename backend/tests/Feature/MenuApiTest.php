<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class MenuApiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Without a way to create the menu "container" itself, a site whose `menus` table is
     * empty (a fresh install before the seeded default menus existed, or any reset DB) had
     * NO path to ever add a menu item — storeItem() requires an existing menu_id, and the
     * dashboard's "Item Menu" button stayed disabled with nothing to select.
     */
    public function test_admin_can_create_a_menu_from_scratch_and_add_items_to_it(): void
    {
        $this->seed();
        $admin = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'admin', 'name' => 'Admin', 'email' => 'menu-admin@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);

        $this->getJson('/api/v1/menus?location=header')->assertOk()->assertJsonCount(0, 'menus');

        $menu = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/menus', ['name' => 'Header Menu', 'location' => 'header'])
            ->assertCreated()->json('menu');

        // Creating the same location twice must not create a duplicate container.
        $again = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/menus', ['name' => 'Header Menu', 'location' => 'header'])
            ->assertCreated()->json('menu');
        $this->assertSame($menu['id'], $again['id']);

        $item = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/menus/items', [
            'menu_id' => $menu['id'], 'label' => 'Beranda', 'type' => 'custom', 'url' => '/',
        ])->assertCreated()->json('item');
        $this->assertSame($menu['id'], $item['menu_id']);

        $this->getJson('/api/v1/menus?location=header')->assertOk()->assertJsonPath('menus.0.items.0.label', 'Beranda');
        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/menus')->assertOk()->assertJsonCount(1, 'menus');
    }
}
