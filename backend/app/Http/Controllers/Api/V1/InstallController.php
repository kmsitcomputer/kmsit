<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class InstallController extends Controller
{
    public function status(): JsonResponse
    {
        try { $installed = Schema::hasTable('users') && User::query()->exists(); }
        catch (\Throwable) { $installed = false; }
        return response()->json(['installed' => $installed, 'database' => config('database.default')]);
    }

    public function install(Request $request): JsonResponse
    {
        try { if (Schema::hasTable('users') && User::query()->exists()) return response()->json(['message' => 'Aplikasi sudah terinstall.'], 409); }
        catch (\Throwable) { /* Fresh database; migrations below create the schema. */ }
        $data = $request->validate([
            'site_name' => ['required', 'string', 'max:190'], 'site_url' => ['nullable', 'url', 'max:255'],
            'slogan' => ['nullable', 'string', 'max:255'], 'admin_name' => ['required', 'string', 'max:120'],
            'admin_email' => ['required', 'email:rfc', 'max:190', 'unique:users,email'], 'password' => ['required', 'confirmed', 'min:8'],
            'timezone' => ['required', 'timezone'], 'language' => ['required', 'in:id,en'], 'currency' => ['required', 'in:IDR,USD'],
        ]);
        if (config('database.default') === 'sqlite' && !file_exists(config('database.connections.sqlite.database'))) @touch(config('database.connections.sqlite.database'));
        Artisan::call('migrate', ['--force' => true]);
        $user = DB::transaction(function () use ($data) {
            $roles = [
                ['id' => 'role_super', 'role_key' => 'super_admin', 'name' => 'Super Admin', 'permissions' => ['*']],
                ['id' => 'role_admin', 'role_key' => 'admin', 'name' => 'Admin', 'permissions' => ['manage_content', 'manage_courses', 'manage_users']],
                ['id' => 'role_instr', 'role_key' => 'instructor', 'name' => 'Instructor', 'permissions' => ['learn', 'instructor_courses']],
                ['id' => 'role_student', 'role_key' => 'student', 'name' => 'Student', 'permissions' => ['learn', 'student_orders']],
            ];
            foreach ($roles as $role) Role::updateOrCreate(['role_key' => $role['role_key']], ['id' => $role['id'], 'name' => $role['name'], 'permissions' => $role['permissions']]);
            foreach (['site_name' => $data['site_name'], 'site_url' => $data['site_url'] ?? '', 'slogan' => $data['slogan'] ?? '', 'timezone' => $data['timezone'], 'default_language' => $data['language'], 'currency' => $data['currency'], 'allow_registration' => '1', 'maintenance_mode' => '0'] as $key => $value) Setting::updateOrCreate(['setting_key' => $key], ['setting_value' => $value]);
            return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'super_admin', 'name' => trim($data['admin_name']), 'email' => Str::lower(trim($data['admin_email'])), 'password_hash' => Hash::make($data['password']), 'status' => 'active', 'instructor_approved' => true]);
        });
        return response()->json(['installed' => true, 'user' => $user->only(['id', 'name', 'email', 'role_key'])], 201);
    }
}
