<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['notifications' => AppNotification::where('user_id', $request->user()->id)->latest()->limit(50)->get()]);
    }

    public function read(Request $request, string $id): JsonResponse
    {
        $notification = AppNotification::where('user_id', $request->user()->id)->findOrFail($id);
        $notification->update(['is_read' => true]);
        return response()->json(['notification' => $notification]);
    }

    public function readAll(Request $request): JsonResponse
    {
        AppNotification::where('user_id', $request->user()->id)->where('is_read', false)->update(['is_read' => true]);
        return response()->json(['message' => 'Notifikasi ditandai dibaca.']);
    }
}
