<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\JsonResponse;
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
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        return response()->json(['messages' => ContactMessage::latest()->paginate(30)]);
    }
}
