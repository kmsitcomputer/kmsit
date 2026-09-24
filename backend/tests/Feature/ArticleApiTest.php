<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ArticleApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_draft_is_hidden_and_admin_can_publish_article(): void
    {
        $this->seed();
        $admin = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'admin', 'name' => 'Admin', 'email' => 'article-admin@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/articles', ['title' => 'Artikel Baru', 'slug' => 'artikel-baru', 'content' => '<p>Konten</p>', 'status' => 'draft'])->assertCreated();
        $this->getJson('/api/v1/articles/artikel-baru')->assertNotFound();
        $article = Article::where('slug', 'artikel-baru')->firstOrFail();
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/articles/' . $article->id, ['title' => 'Artikel Diperbarui', 'status' => 'published'])->assertOk();
        Article::whereKey($article->id)->update(['status' => 'published', 'published_at' => now()]);
        $this->getJson('/api/v1/articles/artikel-baru')->assertOk()->assertJsonPath('article.title', 'Artikel Diperbarui');
        $this->actingAs($admin, 'sanctum')->deleteJson('/api/v1/articles/' . $article->id)->assertOk();
        $this->getJson('/api/v1/articles/artikel-baru')->assertNotFound();
    }
}
