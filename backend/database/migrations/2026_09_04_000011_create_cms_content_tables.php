<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['news', 'tutorials'] as $tableName) {
            Schema::create($tableName, function (Blueprint $table) {
                $table->string('id', 12)->primary();
                $table->string('slug', 140)->unique();
                $table->string('title', 190);
                $table->string('author_id', 12)->nullable();
                $table->string('category_id', 12)->nullable();
                $table->text('excerpt')->nullable();
                $table->longText('content')->nullable();
                $table->text('thumbnail')->nullable();
                $table->string('video_url')->nullable();
                $table->json('tags')->nullable();
                $table->enum('status', ['draft', 'published'])->default('draft');
                $table->timestamp('published_at')->nullable();
                $table->string('seo_title', 190)->nullable();
                $table->string('seo_description', 500)->nullable();
                $table->softDeletes();
                $table->timestamps();
                $table->foreign('author_id')->references('id')->on('users')->nullOnDelete();
                $table->foreign('category_id')->references('id')->on('categories')->nullOnDelete();
                $table->index('status');
            });
        }

        Schema::create('activities', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('slug', 140)->unique();
            $table->string('title', 190);
            $table->text('description')->nullable();
            $table->longText('content')->nullable();
            $table->text('thumbnail')->nullable();
            $table->date('event_date')->nullable();
            $table->string('event_time', 30)->nullable();
            $table->string('location')->nullable();
            $table->string('video_url')->nullable();
            $table->string('registration_url')->nullable();
            $table->json('gallery')->nullable();
            $table->enum('status', ['draft', 'published'])->default('draft');
            $table->string('author_id', 12)->nullable();
            $table->softDeletes();
            $table->timestamps();
            $table->foreign('author_id')->references('id')->on('users')->nullOnDelete();
            $table->index(['status', 'event_date']);
        });

        Schema::create('pages', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('slug', 140)->unique();
            $table->string('title', 190);
            $table->longText('content')->nullable();
            $table->text('thumbnail')->nullable();
            $table->enum('status', ['draft', 'published'])->default('draft');
            $table->string('seo_title', 190)->nullable();
            $table->string('seo_description', 500)->nullable();
            $table->softDeletes();
            $table->timestamps();
            $table->index('status');
        });
    }

    public function down(): void
    {
        foreach (['pages', 'activities', 'tutorials', 'news'] as $tableName) Schema::dropIfExists($tableName);
    }
};
