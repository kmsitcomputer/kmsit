<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $mine = AppNotification::where('user_id', $request->user()->id);
        $query = (clone $mine)
            ->when($request->has('is_read'), fn ($q) => $q->where('is_read', $request->boolean('is_read')))
            ->latest()->orderByDesc('id');
        return response()->json([
            'notifications' => Pagination::paginate($query, $request),
            'unread_count' => (clone $mine)->where('is_read', false)->count(),
        ]);
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
