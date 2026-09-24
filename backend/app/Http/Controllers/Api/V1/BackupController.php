<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class BackupController extends Controller
{
    public function export(Request $request): JsonResponse
    {
        abort_unless($request->user()->role_key === 'super_admin', 403, 'Hanya Super Admin yang dapat membuat backup.');
        $tables = Schema::getTableListing();
        $excluded = ['password_hash', 'salt', 'remember_token', 'token', 'api_key', 'private_key', 'secret_key', 'webhook_secret', 'callback_token'];
        $excludedTables = ['migrations', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs', 'personal_access_tokens', 'password_reset_tokens', 'sessions'];
        $data = [];
        foreach ($tables as $table) {
            $tableName = str_contains($table, '.') ? substr($table, strrpos($table, '.') + 1) : $table;
            if (in_array($tableName, $excludedTables, true)) continue;
            $query = DB::table($table);
            $rows = $query->get();
            if ($tableName === 'settings') {
                $rows = $rows->reject(fn ($row) => preg_match('/(^|_)(api_?key|private_?key|secret|token|password|credential|callback_?token)($|_)/i', (string) ($row->setting_key ?? '')));
            }
            $rows = $rows->map(function ($row) use ($excluded) {
                $values = (array) $row;
                foreach (array_keys($values) as $key) foreach ($excluded as $term) if (str_contains(strtolower($key), $term)) unset($values[$key]);
                return $values;
            })->all();
            $data[$tableName] = $rows;
        }
        // Recorded so the operations panel can show when the last export happened (no data in the log).
        \App\Models\AuditLog::create(['user_id' => $request->user()->id, 'user_name' => $request->user()->name, 'action' => 'backup_export', 'model' => 'System', 'model_id' => null, 'detail' => 'tables=' . count($data)]);
        return response()->json(['app' => 'kmsit-computer', 'exported_at' => now()->toISOString(), 'tables' => $data]);
    }
}
