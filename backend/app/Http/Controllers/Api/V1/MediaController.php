<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MediaController extends Controller
{
    private const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf'];

    public function index(): JsonResponse
    {
        $media = Media::latest()->paginate(30);
        $media->getCollection()->transform(fn (Media $item) => [...$item->toArray(), 'url' => asset('storage/' . $item->path)]);
        return response()->json(['media' => $media]);
    }

    public function upload(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin', 'instructor'], true), 403, 'Tidak memiliki permission.');
        $request->validate(['file' => ['required', 'file', 'max:5120', 'mimetypes:' . implode(',', self::MIME_TYPES)]]);
        $file = $request->file('file');
        $path = $file->store('media', 'public');
        $media = Media::create(['id' => Str::lower(Str::random(12)), 'name' => $file->getClientOriginalName(), 'mime' => $file->getMimeType(), 'size' => $file->getSize(), 'path' => $path, 'uploaded_by' => $request->user()->id]);
        return response()->json(['media' => $media, 'url' => asset('storage/' . $path)], 201);
    }
}
