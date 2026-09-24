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
            ['id' => 'role_admin', 'role_key' => 'admin', 'name' => 'Admin', 'permissions' => ['manage_content', 'manage_courses', 'manage_users']],
            ['id' => 'role_instr', 'role_key' => 'instructor', 'name' => 'Instructor', 'permissions' => ['learn', 'instructor_courses', 'instructor_quizzes']],
            ['id' => 'role_student', 'role_key' => 'student', 'name' => 'Student', 'permissions' => ['learn', 'student_orders']],
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
