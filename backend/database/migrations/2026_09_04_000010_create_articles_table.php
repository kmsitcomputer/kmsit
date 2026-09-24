<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('articles', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('slug', 140)->unique();
            $table->string('title', 190);
            $table->string('author_id', 12)->nullable();
            $table->string('category_id', 12)->nullable();
            $table->text('excerpt')->nullable();
            $table->longText('content')->nullable();
            $table->text('thumbnail')->nullable();
            $table->json('tags')->nullable();
            $table->enum('status', ['draft', 'published'])->default('draft');
            $table->boolean('featured')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->string('seo_title', 190)->nullable();
            $table->string('seo_description', 500)->nullable();
            $table->softDeletes();
            $table->timestamps();
            $table->foreign('author_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('category_id')->references('id')->on('categories')->nullOnDelete();
            $table->index(['status', 'featured']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('articles');
    }
};
