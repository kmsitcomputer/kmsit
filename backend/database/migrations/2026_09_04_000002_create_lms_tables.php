<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->enum('scope', ['course', 'article', 'news', 'tutorial', 'product']);
            $table->string('name', 120);
            $table->string('slug', 140);
            $table->timestamps();
            $table->unique(['scope', 'slug']);
            $table->index('scope');
        });

        Schema::create('courses', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('slug', 140)->unique();
            $table->string('instructor_id', 12);
            $table->string('category_id', 12)->nullable();
            $table->string('title', 190);
            $table->string('short_description', 500)->default('');
            $table->longText('description')->nullable();
            $table->text('thumbnail')->nullable();
            $table->unsignedInteger('price')->default(0);
            $table->unsignedInteger('discount_price')->default(0);
            $table->boolean('is_free')->default(false);
            $table->enum('level', ['beginner', 'intermediate', 'advanced'])->default('beginner');
            $table->string('language', 40)->default('Indonesia');
            $table->enum('status', ['draft', 'pending', 'published', 'rejected', 'archived'])->default('draft');
            $table->boolean('featured')->default(false);
            $table->json('requirements')->nullable();
            $table->json('outcomes')->nullable();
            $table->json('tags')->nullable();
            $table->string('reject_note', 500)->nullable();
            $table->timestamp('published_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
            $table->foreign('instructor_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('category_id')->references('id')->on('categories')->nullOnDelete();
            $table->index(['status', 'featured']);
        });

        Schema::create('course_sections', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('course_id', 12);
            $table->string('title', 190);
            $table->integer('sort')->default(0);
            $table->timestamps();
            $table->foreign('course_id')->references('id')->on('courses')->cascadeOnDelete();
            $table->index(['course_id', 'sort']);
        });

        Schema::create('lessons', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('course_id', 12);
            $table->string('section_id', 12);
            $table->string('title', 190);
            $table->enum('type', ['text', 'youtube', 'video', 'pdf', 'file', 'image', 'url', 'embed'])->default('text');
            $table->longText('content')->nullable();
            $table->text('media_url')->nullable();
            $table->unsignedInteger('duration_min')->default(0);
            $table->boolean('preview')->default(false);
            $table->enum('status', ['draft', 'published'])->default('published');
            $table->integer('sort')->default(0);
            $table->timestamps();
            $table->foreign('course_id')->references('id')->on('courses')->cascadeOnDelete();
            $table->foreign('section_id')->references('id')->on('course_sections')->cascadeOnDelete();
            $table->index(['section_id', 'sort']);
        });

        Schema::create('enrollments', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('user_id', 12);
            $table->string('course_id', 12);
            $table->enum('status', ['active', 'completed'])->default('active');
            $table->unsignedTinyInteger('progress_pct')->default(0);
            $table->string('last_lesson_id', 12)->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'course_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('course_id')->references('id')->on('courses')->cascadeOnDelete();
            $table->index('course_id');
        });

        Schema::create('lesson_progress', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('user_id', 12);
            $table->string('lesson_id', 12);
            $table->timestamp('completed_at')->useCurrent();
            $table->timestamps();
            $table->unique(['user_id', 'lesson_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('lesson_id')->references('id')->on('lessons')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lesson_progress');
        Schema::dropIfExists('enrollments');
        Schema::dropIfExists('lessons');
        Schema::dropIfExists('course_sections');
        Schema::dropIfExists('courses');
        Schema::dropIfExists('categories');
    }
};
