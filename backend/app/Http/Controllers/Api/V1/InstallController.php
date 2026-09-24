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
    /** Lock file path used across requests to guard against installer re-execution. */
    private const LOCK_PATH = '/../../storage/installed.lock';

    /**
     * Return true when the application has been installed (lock file or DB).
     * Returns null only on a hard DB error without a lock file — this means "unknown".
     */
    private function alreadyInstalled(): ?bool
    {
        // Fast path: if the lock file was written by a previous install, trust it.
        $lockPath = dirname(__DIR__, 4) . self::LOCK_PATH;
        if (file_exists($lockPath)) return true;

        try { return Schema::hasTable('users') && User::query()->exists(); }
        catch (\Throwable $e) {
            // A completely fresh, not-yet-configured environment (e.g. the placeholder
            // sqlite file from composer install doesn't exist yet) is expected and means
            // "not installed" — anything else (wrong credentials, host unreachable, access
            // denied) is a real outage/misconfiguration and must not be reported as such.
            $message = $e->getMessage();
            $looksUnconfigured = str_contains($message, 'unable to open database file')
                || str_contains($message, 'no such file or directory');
            return $looksUnconfigured ? false : null;
        }
    }

    public function status(): JsonResponse
    {
        $installed = $this->alreadyInstalled();
        if ($installed === null) {
            return response()->json(['installed' => null, 'message' => 'Database tidak dapat dihubungi. Periksa konfigurasi DB_* di .env.'], 503);
        }
        return response()->json(['installed' => $installed, 'database' => config('database.default')]);
    }

    public function requirements(): JsonResponse
    {
        $extensions = ['pdo', 'pdo_mysql', 'mbstring', 'openssl', 'tokenizer', 'xml', 'ctype', 'json', 'fileinfo', 'curl'];
        $checks = [
            ['key' => 'php', 'label' => 'PHP Version', 'detail' => 'PHP ' . PHP_VERSION . ' (butuh ≥ 8.3)', 'ok' => version_compare(PHP_VERSION, '8.3.0', '>=')],
        ];
        foreach ($extensions as $ext) {
            $checks[] = ['key' => "ext_{$ext}", 'label' => "Extension: {$ext}", 'detail' => extension_loaded($ext) ? 'Terpasang' : 'Tidak ditemukan', 'ok' => extension_loaded($ext)];
        }
        $paths = [
            'storage/' => storage_path(),
            'storage/framework/' => storage_path('framework'),
            'storage/logs/' => storage_path('logs'),
            'bootstrap/cache/' => base_path('bootstrap/cache'),
        ];
        foreach ($paths as $label => $path) {
            $checks[] = ['key' => 'writable_' . Str::slug($label), 'label' => "Writable: {$label}", 'detail' => is_dir($path) ? (is_writable($path) ? 'Bisa ditulis' : 'Tidak bisa ditulis') : 'Folder tidak ditemukan', 'ok' => is_dir($path) && is_writable($path)];
        }
        $envPath = base_path('.env');
        $envWritable = file_exists($envPath) ? is_writable($envPath) : is_writable(base_path());
        $checks[] = ['key' => 'env_writable', 'label' => 'Writable: .env', 'detail' => $envWritable ? 'Bisa ditulis' : 'Tidak bisa ditulis — set permission folder aplikasi', 'ok' => $envWritable];
        return response()->json(['checks' => $checks, 'ok' => collect($checks)->every(fn ($c) => $c['ok'])]);
    }

    public function testDb(Request $request): JsonResponse
    {
        $data = $request->validate([
            'host' => ['required', 'string', 'max:190'], 'port' => ['required', 'string', 'max:10'],
            'database' => ['required', 'string', 'max:120'], 'username' => ['required', 'string', 'max:120'],
            'password' => ['nullable', 'string', 'max:190'],
        ]);
        try {
            $dsn = "mysql:host={$data['host']};port={$data['port']};dbname={$data['database']};charset=utf8mb4";
            new \PDO($dsn, $data['username'], $data['password'] ?? '', [\PDO::ATTR_TIMEOUT => 5]);
            return response()->json(['ok' => true, 'message' => 'Koneksi database berhasil.']);
        } catch (\Throwable $e) {
            return response()->json(['ok' => false, 'message' => 'Koneksi database gagal: ' . $e->getMessage()], 422);
        }
    }

    public function configure(Request $request): JsonResponse
    {
        if ($this->alreadyInstalled()) return response()->json(['message' => 'Aplikasi sudah terinstall.'], 409);
        // Block installer when DB is unreachable (null = outage, not fresh install).
        // This prevents writing .env with attacker-controlled DB host during a DB outage.
        if ($this->alreadyInstalled() === null) {
            return response()->json(['message' => 'Database tidak dapat dihubungi. Instalasi diblokir untuk mencegah penyalahgunaan.'], 503);
        }
        $data = $request->validate([
            'host' => ['required', 'string', 'max:190'], 'port' => ['required', 'string', 'max:10'],
            'database' => ['required', 'string', 'max:120'], 'username' => ['required', 'string', 'max:120'],
            'password' => ['nullable', 'string', 'max:190'], 'site_url' => ['nullable', 'url', 'max:255'],
        ]);
        $templatePath = file_exists(base_path('.env.production.example')) ? base_path('.env.production.example') : base_path('.env.example');
        abort_unless(file_exists($templatePath), 500, 'Template .env tidak ditemukan di server.');
        $envPath = base_path('.env');
        abort_unless(file_exists($envPath) ? is_writable($envPath) : is_writable(base_path()), 500, 'File .env tidak bisa ditulis. Periksa permission folder aplikasi.');

        $overrides = [
            'APP_KEY' => 'base64:' . base64_encode(random_bytes(32)),
            'APP_URL' => $data['site_url'] ?? $request->getSchemeAndHttpHost(),
            'DB_CONNECTION' => 'mysql',
            'DB_HOST' => $data['host'],
            'DB_PORT' => $data['port'],
            'DB_DATABASE' => $data['database'],
            'DB_USERNAME' => $data['username'],
            'DB_PASSWORD' => $data['password'] ?? '',
        ];
        $lines = preg_split('/\r\n|\r|\n/', file_get_contents($templatePath));
        $written = [];
        $output = array_map(function ($line) use ($overrides, &$written) {
            if (preg_match('/^([A-Z0-9_]+)=/', $line, $m) && array_key_exists($m[1], $overrides)) {
                $written[$m[1]] = true;
                $value = $overrides[$m[1]];
                $needsQuotes = $value !== '' && preg_match('/\s|#/', $value);
                return $m[1] . '=' . ($needsQuotes ? '"' . str_replace('"', '\"', $value) . '"' : $value);
            }
            return $line;
        }, $lines);
        foreach ($overrides as $key => $value) {
            if (!isset($written[$key])) $output[] = "{$key}={$value}";
        }
        file_put_contents($envPath, implode("\n", $output) . "\n");

        try { Artisan::call('config:clear'); } catch (\Throwable) { /* cache may not exist yet, harmless */ }

        return response()->json(['message' => 'Konfigurasi .env berhasil ditulis.']);
    }

    public function install(Request $request): JsonResponse
    {
        if ($this->alreadyInstalled()) return response()->json(['message' => 'Aplikasi sudah terinstall.'], 409);
        // Block installer when DB is unreachable during an outage.
        if ($this->alreadyInstalled() === null) {
            return response()->json(['message' => 'Database tidak dapat dihubungi. Instalasi diblokir.'], 503);
        }
        if (config('database.default') === 'sqlite' && !file_exists(config('database.connections.sqlite.database'))) @touch(config('database.connections.sqlite.database'));
        // Migrate dulu sebelum validasi — rule "unique:users,email" akan error 500 (bukan 422) jika tabel users belum ada.
        Artisan::call('migrate', ['--force' => true]);
        try { Artisan::call('storage:link'); } catch (\Throwable) { /* symlink may already exist atau tidak didukung host */ }
        $data = $request->validate([
            'site_name' => ['required', 'string', 'max:190'], 'site_url' => ['nullable', 'url', 'max:255'],
            'slogan' => ['nullable', 'string', 'max:255'], 'admin_name' => ['required', 'string', 'max:120'],
            'admin_email' => ['required', 'email:rfc', 'max:190', 'unique:users,email'], 'password' => ['required', 'confirmed', 'min:8'],
            'timezone' => ['required', 'timezone'], 'language' => ['required', 'in:id,en'], 'currency' => ['required', 'in:IDR,USD'],
        ]);
        $user = DB::transaction(function () use ($data) {
            $roles = [
                ['id' => 'role_super', 'role_key' => 'super_admin', 'name' => 'Super Admin', 'permissions' => ['*']],
                ['id' => 'role_admin', 'role_key' => 'admin', 'name' => 'Admin', 'permissions' => ['dashboard', 'manage_articles', 'manage_news', 'manage_tutorials', 'manage_activities', 'manage_pages', 'manage_media', 'manage_menus', 'manage_homepage', 'manage_about', 'manage_courses', 'moderate_courses', 'manage_categories', 'manage_quizzes', 'manage_certificates', 'manage_students', 'manage_instructors', 'manage_orders', 'view_payments', 'process_withdrawals', 'manage_shop', 'manage_vouchers', 'view_reports', 'view_messages']],
                ['id' => 'role_instr', 'role_key' => 'instructor', 'name' => 'Instructor', 'permissions' => ['dashboard', 'instructor_courses', 'instructor_quizzes', 'instructor_students', 'instructor_wallet', 'instructor_withdrawals', 'instructor_certificates', 'edit_own_profile']],
                ['id' => 'role_student', 'role_key' => 'student', 'name' => 'Student', 'permissions' => ['dashboard', 'learn', 'student_orders', 'student_certificates', 'edit_own_profile', 'shop']],
            ];
            foreach ($roles as $role) Role::updateOrCreate(['role_key' => $role['role_key']], ['id' => $role['id'], 'name' => $role['name'], 'permissions' => $role['permissions']]);
            foreach (['site_name' => $data['site_name'], 'site_url' => $data['site_url'] ?? '', 'slogan' => $data['slogan'] ?? '', 'timezone' => $data['timezone'], 'default_language' => $data['language'], 'currency' => $data['currency'], 'allow_registration' => '1', 'maintenance_mode' => '0'] as $key => $value) Setting::updateOrCreate(['setting_key' => $key], ['setting_value' => $value]);
            // Without this, the dashboard's Menu manager has no way to create the first menu
            // item at all (it requires an existing menu container) — see MenuController::storeMenu.
            \App\Models\Menu::firstOrCreate(['location' => 'header'], ['id' => Str::lower(Str::random(12)), 'name' => 'Header Menu']);
            \App\Models\Menu::firstOrCreate(['location' => 'footer'], ['id' => Str::lower(Str::random(12)), 'name' => 'Footer Menu']);
            return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'super_admin', 'name' => trim($data['admin_name']), 'email' => Str::lower(trim($data['admin_email'])), 'password_hash' => Hash::make($data['password']), 'status' => 'active', 'instructor_approved' => true]);
        });
        // Write lock file so future requests trust it without hitting DB.
        $lockPath = dirname(__DIR__, 4) . self::LOCK_PATH;
        @file_put_contents($lockPath, 'installed');
        return response()->json(['installed' => true, 'user' => $user->only(['id', 'name', 'email', 'role_key'])], 201);
    }
}
