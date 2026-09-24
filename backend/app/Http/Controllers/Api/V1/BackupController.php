<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BackupController extends Controller
{
    public function export(Request $request): JsonResponse
    {
        abort_unless($request->user()->role_key === 'super_admin', 403, 'Hanya Super Admin yang dapat membuat backup.');
        $tables = DB::select('SHOW TABLES');
        $databaseKey = 'Tables_in_' . DB::getDatabaseName();
        $excluded = ['password_hash', 'salt', 'remember_token', 'token', 'api_key', 'private_key', 'secret_key', 'webhook_secret', 'callback_token'];
        $data = [];
        foreach ($tables as $tableRow) {
            $table = $tableRow->{$databaseKey} ?? null;
            if (!$table || in_array($table, ['migrations', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs', 'personal_access_tokens'], true)) continue;
            $rows = DB::table($table)->get()->map(function ($row) use ($excluded) {
                $values = (array) $row;
                foreach (array_keys($values) as $key) foreach ($excluded as $term) if (str_contains(strtolower($key), $term)) unset($values[$key]);
                return $values;
            })->all();
            $data[$table] = $rows;
        }
        return response()->json(['app' => 'kmsit-computer', 'exported_at' => now()->toISOString(), 'tables' => $data]);
    }
}
