<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        $query = AuditLog::query()->latest();
        if ($request->string('model')->trim()->value()) $query->where('model', $request->string('model')->trim()->value());
        return response()->json(['logs' => $query->limit(200)->get(), 'models' => AuditLog::query()->distinct()->orderBy('model')->pluck('model')]);
    }
}
