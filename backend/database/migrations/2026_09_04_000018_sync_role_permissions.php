<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $permissions = [
            'admin' => ['dashboard', 'manage_articles', 'manage_news', 'manage_tutorials', 'manage_activities', 'manage_pages', 'manage_media', 'manage_menus', 'manage_homepage', 'manage_about', 'manage_courses', 'moderate_courses', 'manage_categories', 'manage_quizzes', 'manage_certificates', 'manage_students', 'manage_instructors', 'manage_orders', 'view_payments', 'process_withdrawals', 'manage_shop', 'manage_vouchers', 'view_reports', 'view_messages'],
            'instructor' => ['dashboard', 'instructor_courses', 'instructor_quizzes', 'instructor_students', 'instructor_wallet', 'instructor_withdrawals', 'instructor_certificates', 'edit_own_profile'],
            'student' => ['dashboard', 'learn', 'student_orders', 'student_certificates', 'edit_own_profile', 'shop'],
        ];

        foreach ($permissions as $roleKey => $rolePermissions) {
            DB::table('roles')->where('role_key', $roleKey)->update(['permissions' => json_encode($rolePermissions)]);
        }
    }

    public function down(): void
    {
        // Permission changes are data configuration and should not be rolled back automatically.
    }
};
