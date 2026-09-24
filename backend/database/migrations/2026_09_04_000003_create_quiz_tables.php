<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quizzes', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('course_id', 12)->nullable();
            $table->string('creator_id', 12);
            $table->string('title', 190);
            $table->text('description')->nullable();
            $table->unsignedInteger('time_limit_min')->default(10);
            $table->unsignedTinyInteger('passing_score')->default(70);
            $table->unsignedInteger('max_attempts')->default(0);
            $table->boolean('randomize')->default(false);
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->foreign('course_id')->references('id')->on('courses')->cascadeOnDelete();
            $table->foreign('creator_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['course_id', 'active']);
        });

        Schema::create('quiz_questions', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('quiz_id', 12);
            $table->enum('type', ['single', 'multiple', 'boolean', 'short'])->default('single');
            $table->text('text');
            $table->unsignedInteger('points')->default(10);
            $table->integer('sort')->default(0);
            $table->timestamps();
            $table->foreign('quiz_id')->references('id')->on('quizzes')->cascadeOnDelete();
            $table->index(['quiz_id', 'sort']);
        });

        Schema::create('quiz_options', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('question_id', 12);
            $table->text('text');
            $table->boolean('is_correct')->default(false);
            $table->integer('sort')->default(0);
            $table->timestamps();
            $table->foreign('question_id')->references('id')->on('quiz_questions')->cascadeOnDelete();
            $table->index(['question_id', 'sort']);
        });

        Schema::create('quiz_attempts', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('quiz_id', 12);
            $table->string('user_id', 12);
            $table->enum('status', ['running', 'submitted'])->default('running');
            $table->json('answers')->nullable();
            $table->unsignedInteger('score')->default(0);
            $table->unsignedInteger('max_score')->default(0);
            $table->unsignedTinyInteger('percent')->default(0);
            $table->boolean('passed')->default(false);
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
            $table->foreign('quiz_id')->references('id')->on('quizzes')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['quiz_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quiz_attempts');
        Schema::dropIfExists('quiz_options');
        Schema::dropIfExists('quiz_questions');
        Schema::dropIfExists('quizzes');
    }
};
