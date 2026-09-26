<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * IMP-006: additive live_classes storage (course-level entity).
 * Persisted lifecycle is scheduled|cancelled only; display state derives
 * from scheduled_at + duration_minutes. No lesson/certificate impact.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('live_classes', function (Blueprint $table) {
            $table->string('id', 12)->primary();
            $table->string('course_id', 12);
            $table->string('created_by', 12);
            $table->enum('provider', ['zoom', 'google_meet']);
            $table->string('provider_meeting_id', 120)->nullable();
            $table->string('title', 190);
            $table->timestamp('scheduled_at')->nullable();
            $table->unsignedInteger('duration_minutes')->default(60);
            $table->string('timezone', 60)->nullable();
            $table->text('join_url')->nullable();
            $table->enum('status', ['scheduled', 'cancelled'])->default('scheduled');
            $table->timestamps();
            $table->foreign('course_id')->references('id')->on('courses')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['course_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('live_classes');
    }
};
