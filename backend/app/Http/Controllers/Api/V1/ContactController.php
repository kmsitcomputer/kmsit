<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\JsonResponse;
use App\Support\AdminAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ContactController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'email' => ['required', 'email:rfc', 'max:190'], 'subject' => ['nullable', 'string', 'max:190'], 'body' => ['required', 'string', 'max:5000']]);
        $message = ContactMessage::create(['id' => Str::lower(Str::random(12)), ...$data, 'name' => trim($data['name']), 'email' => Str::lower(trim($data['email']))]);
        return response()->json(['message' => 'Pesan berhasil dikirim.', 'contact' => $message], 201);
    }

    public function index(Request $request): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'view_messages');
        $query = ContactMessage::query()
            ->when($request->has('is_read'), fn ($q) => $q->where('is_read', $request->boolean('is_read')))
            ->latest()->orderByDesc('id');
        return response()->json(['messages' => \App\Support\Pagination::paginate($query, $request, 30)]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'view_messages');
        $data = $request->validate(['is_read' => ['required', 'boolean']]);
        $message = ContactMessage::findOrFail($id);
        $message->update($data);
        return response()->json(['contact' => $message->fresh()]);
    }
}
