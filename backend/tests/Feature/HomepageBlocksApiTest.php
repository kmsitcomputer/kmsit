<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * IMP-003: Banner/Slider/FAQ/Testimonial are dynamic homepage_blocks (no new
 * tables). The locked types carry a server-side shape contract; drafts stay
 * hidden from the public endpoint and only enabled blocks go public.
 */
class HomepageBlocksApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_locked_block_types_validate_shape_and_sanitize(): void
    {
        $this->seed();
        $admin = $this->admin();

        $banner = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/homepage/blocks', [
            'type' => 'banner', 'title' => 'Promo', 'content' => [
                'title' => 'Belajar Hemat', 'subtitle' => 'Diskon akhir tahun',
                'image' => 'media/promo.jpg', 'cta_label' => 'Lihat Kelas', 'cta_url' => '/courses', 'align' => 'center',
            ],
        ])->assertCreated()->json('block');
        $this->getJson('/api/v1/homepage/blocks')->assertOk()->assertJsonMissing(['id' => $banner['id']]);

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/homepage/blocks', [
            'type' => 'banner', 'content' => ['title' => 'X', 'cta_url' => 'javascript:alert(1)'],
        ])->assertStatus(422);

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/homepage/blocks', [
            'type' => 'slider', 'content' => ['items' => [
                ['title' => 'S1', 'image' => 'https://example.com/s1.jpg', 'cta_label' => 'Lihat', 'cta_url' => 'https://example.com/s1'],
                ['title' => 'S2', 'image' => '/media/s2.jpg'],
            ]],
        ])->assertCreated();

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/homepage/blocks', [
            'type' => 'slider', 'content' => ['items' => 'not-a-list'],
        ])->assertStatus(422);

        $faq = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/homepage/blocks', [
            'type' => 'faq', 'title' => 'FAQ', 'content' => ['items' => [
                ['question' => 'Apa itu KMSIT?', 'answer' => '<p>Platform <strong>belajar</strong> online.</p><script>alert(1)</script>'],
            ]],
        ])->assertCreated()->json('block');
        $this->assertStringNotContainsString('<script>', json_encode($faq));

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/homepage/blocks', [
            'type' => 'faq', 'content' => ['items' => [['question' => 'Tanpa jawaban']]],
        ])->assertStatus(422);

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/homepage/blocks', [
            'type' => 'testimonial', 'content' => ['title' => 'Kata alumni', 'items' => [
                ['name' => 'Dita', 'role' => 'Alumni', 'photo' => 'media/dita.jpg', 'testimonial' => 'Materinya jelas.', 'rating' => 5],
            ]],
        ])->assertCreated();

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/homepage/blocks', [
            'type' => 'testimonial', 'content' => ['items' => [['name' => 'X', 'testimonial' => 'Y', 'rating' => 9]]],
        ])->assertStatus(422);

        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/homepage/blocks/{$banner['id']}", [
            'content' => ['title' => 'Buruk', 'cta_url' => 'ftp://example.com/x'],
        ])->assertStatus(422);
    }

    public function test_draft_blocks_stay_private_and_publish_goes_public(): void
    {
        $this->seed();
        $admin = $this->admin();

        $block = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/homepage/blocks', [
            'type' => 'banner', 'content' => ['title' => 'Segera hadir'],
        ])->assertCreated()->json('block');

        $this->getJson('/api/v1/homepage/blocks')->assertOk()->assertJsonMissing(['id' => $block['id']]);

        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/homepage/blocks/{$block['id']}", ['enabled' => false])
            ->assertOk();
        $this->getJson('/api/v1/homepage/blocks')->assertOk()->assertJsonMissing(['id' => $block['id']]);

        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/homepage/blocks/{$block['id']}", ['enabled' => true])
            ->assertOk();
        $this->getJson('/api/v1/homepage/blocks')->assertOk()->assertJsonFragment(['id' => $block['id']]);

        $student = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Student', 'email' => 'block-student@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
        $this->actingAs($student, 'sanctum')->postJson('/api/v1/homepage/blocks', ['type' => 'banner'])
            ->assertForbidden();

        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/homepage/blocks')->assertOk();
    }

    public function test_management_listing_includes_drafts_while_public_excludes_them(): void
    {
        $this->seed();
        $admin = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'admin', 'name' => 'Admin', 'email' => 'blocks-mgmt@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
        $student = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Student', 'email' => 'blocks-mgmt-student@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);

        $draft = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/homepage/blocks', [
            'type' => 'banner', 'content' => ['title' => 'Draft rahasia'],
        ])->assertCreated()->json('block');
        $live = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/homepage/blocks', [
            'type' => 'banner', 'enabled' => true, 'content' => ['title' => 'Publik'],
        ])->assertCreated()->json('block');

        $this->getJson('/api/v1/homepage/blocks')->assertOk()
            ->assertJsonFragment(['id' => $live['id']])
            ->assertJsonMissing(['id' => $draft['id']]);

        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/homepage/blocks')->assertOk()
            ->assertJsonFragment(['id' => $live['id']])
            ->assertJsonFragment(['id' => $draft['id']]);

        $this->actingAs($student, 'sanctum')->getJson('/api/v1/admin/homepage/blocks')->assertForbidden();
    }

    public function test_page_landing_uses_existing_page_system(): void
    {
        $this->seed();
        $admin = $this->admin();

        // Landing-style content composes through the existing Page system.
        // About stays settings-based (AboutEditor/AboutPage) and Contact stays
        // settings + contact_messages workflow — neither migrates to Page here.
        foreach (['landing-promo' => 'Promo Akhir Tahun'] as $slug => $title) {
            $page = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/pages', [
                'title' => $title, 'content' => "<p>{$title}</p>", 'status' => 'draft',
            ])->assertCreated()->json('content');
            $this->getJson("/api/v1/pages/{$page['slug']}")->assertNotFound();

            $this->actingAs($admin, 'sanctum')->putJson("/api/v1/pages/{$page['id']}", ['status' => 'published'])
                ->assertOk()->assertJsonPath('content.status', 'published');
            $this->getJson("/api/v1/pages/{$page['slug']}")->assertOk()->assertJsonPath('content.title', $title);
        }
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasTable('banners'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasTable('sliders'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasTable('faqs'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasTable('testimonials'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasTable('landing_pages'));
    }

    private function admin(): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'admin', 'name' => 'Admin', 'email' => 'blocks-admin@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }
}
