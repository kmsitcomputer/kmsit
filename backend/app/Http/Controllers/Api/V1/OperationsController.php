<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\OperationsStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Super-admin operations panel (queue, scheduler heartbeat, failed jobs, maintenance, integrations). */
class OperationsController extends Controller
{
    public function status(Request $request, OperationsStatus $status): JsonResponse
    {
        abort_unless($request->user()->role_key === 'super_admin', 403, 'Hanya Super Admin.');
        return response()->json(['status' => $status->snapshot()]);
    }
}
