<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        foreach ([
            ['id' => 'role_super', 'role_key' => 'super_admin', 'name' => 'Super Admin', 'permissions' => ['*']],
            ['id' => 'role_admin', 'role_key' => 'admin', 'name' => 'Admin', 'permissions' => ['dashboard', 'manage_articles', 'manage_news', 'manage_tutorials', 'manage_activities', 'manage_pages', 'manage_media', 'manage_menus', 'manage_homepage', 'manage_about', 'manage_courses', 'moderate_courses', 'manage_categories', 'manage_quizzes', 'manage_certificates', 'manage_students', 'manage_instructors', 'manage_orders', 'manage_settings', 'view_payments', 'process_withdrawals', 'manage_shop', 'manage_vouchers', 'view_reports', 'view_messages', 'view_audit']],
            ['id' => 'role_instr', 'role_key' => 'instructor', 'name' => 'Instructor', 'permissions' => ['dashboard', 'instructor_courses', 'instructor_quizzes', 'instructor_students', 'instructor_wallet', 'instructor_withdrawals', 'instructor_certificates', 'edit_own_profile']],
            ['id' => 'role_student', 'role_key' => 'student', 'name' => 'Student', 'permissions' => ['dashboard', 'learn', 'student_orders', 'student_certificates', 'edit_own_profile', 'shop']],
        ] as $role) {
            DB::table('roles')->updateOrInsert(['role_key' => $role['role_key']], [
                'id' => $role['id'],
                'name' => $role['name'],
                'permissions' => json_encode($role['permissions']),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
