<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class CmsContentTypesApiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * news/tutorials/activities/pages each have a different schema (no shared "excerpt",
     * "category_id", "description" or "published_at" set of columns) but are served by the
     * same generic ContentController. Every one of these used to 500 with a SQL "Unknown
     * column" error on create because the controller filled a fixed set of fields onto
     * every model regardless of what columns that model's table actually has. The public
     * slug-detail route also 404'd for all of them because ContentController::show()
     * couldn't resolve its route-default "type" parameter without an explicit Request arg.
     */
    public function test_news_tutorials_activities_and_pages_can_all_be_created_and_appear_publicly(): void
    {
        $this->seed();
        $admin = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'admin', 'name' => 'Admin', 'email' => 'cms-admin@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);

        foreach (['news', 'tutorials'] as $type) {
            $created = $this->actingAs($admin, 'sanctum')->postJson("/api/v1/{$type}", [
                'title' => ucfirst($type) . ' Item', 'excerpt' => 'Ringkasan', 'content' => '<p>Isi</p>', 'status' => 'published',
            ])->assertCreated()->json('content');
            $this->assertSame('published', $created['status']);
            $this->getJson("/api/v1/{$type}")->assertOk()->assertJsonFragment(['id' => $created['id']]);
        }

        $activity = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/activities', [
            'title' => 'Workshop Laravel', 'description' => 'Belajar Laravel bareng', 'status' => 'published',
            'event_date' => '2026-12-01', 'event_time' => '09:00', 'location' => 'Jakarta', 'registration_url' => 'https://example.com/daftar',
        ])->assertCreated()->json('content');
        $this->assertSame('Jakarta', $activity['location']);
        $this->assertSame('2026-12-01', $activity['event_date']);
        $this->getJson('/api/v1/activities')->assertOk()->assertJsonFragment(['id' => $activity['id']]);

        $page = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/pages', [
            'title' => 'Kebijakan Privasi', 'content' => '<p>Kebijakan</p>', 'status' => 'published',
        ])->assertCreated()->json('content');
        $this->getJson('/api/v1/pages')->assertOk()->assertJsonFragment(['id' => $page['id']]);
        $this->getJson('/api/v1/pages/' . $page['slug'])->assertOk()->assertJsonPath('content.id', $page['id']);

        // Partial updates (the dashboard's quick publish toggle) must also work per-type.
        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/pages/{$page['id']}", ['status' => 'draft'])->assertOk()->assertJsonPath('content.status', 'draft');
        $this->getJson('/api/v1/pages')->assertOk()->assertJsonMissing(['id' => $page['id']]);
    }
}
