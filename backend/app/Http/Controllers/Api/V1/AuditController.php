<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use App\Support\AdminAccess;
use App\Support\Pagination;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'view_audit');
        $query = AuditLog::query()
            ->when($request->string('model')->trim()->value(), fn ($q, string $model) => $q->where('model', $model))
            ->when($request->string('action')->trim()->value(), fn ($q, string $action) => $q->where('action', $action))
            ->latest()->orderByDesc('id');
        return response()->json([
            'logs' => Pagination::paginate($query, $request, 25),
            'models' => AuditLog::query()->distinct()->orderBy('model')->pluck('model'),
        ]);
    }
}
