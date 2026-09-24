<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Support\AdminAccess;
use App\Support\FileSecurity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Illuminate\Support\Str;

class MediaController extends Controller
{
    private const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    private const MIME_EXTENSIONS = [
        'image/jpeg' => ['jpg', 'jpeg'], 'image/png' => ['png'], 'image/webp' => ['webp'], 'application/pdf' => ['pdf'],
    ];

    /**
     * Serve a public-disk file directly. Many shared-hosting environments disable PHP's
     * symlink() function, so `php artisan storage:link` silently fails and the normal
     * public/storage symlink never exists — without this route, image URLs would fall
     * through to the SPA catch-all in routes/web.php and return the app's HTML instead
     * of the file. This route works whether or not the symlink exists.
     */
    public function serve(string $path): BinaryFileResponse
    {
        abort_unless(FileSecurity::isPublicPath($path), 404);
        abort_unless(Storage::disk('public')->exists($path), 404);
        $fullPath = Storage::disk('public')->path($path);
        return response()->file($fullPath, ['Content-Type' => Storage::disk('public')->mimeType($path) ?: 'application/octet-stream']);
    }

    public function index(Request $request): JsonResponse
    {
        $this->staff($request);
        $media = \App\Support\Pagination::paginate(Media::query()
            ->when($request->string('q')->trim()->value(), fn ($q, string $search) => $q->where('name', 'like', '%' . addcslashes($search, '%_\\') . '%'))
            ->when($request->string('mime')->trim()->value(), fn ($q, string $mime) => $q->where('mime', 'like', addcslashes($mime, '%_\\') . '%'))
            ->latest()->orderByDesc('id'), $request, 30);
        $media->getCollection()->transform(fn (Media $item) => [...$item->toArray(), 'url' => asset('storage/' . $item->path)]);
        return response()->json(['media' => $media]);
    }

    public function upload(Request $request): JsonResponse
    {
        $this->staff($request);
        $request->validate(['file' => ['required', 'file', 'max:5120', 'mimetypes:' . implode(',', self::MIME_TYPES), 'extensions:jpg,jpeg,png,webp,pdf']]);
        $file = $request->file('file');
        $actualMime = FileSecurity::validateUpload($file, self::MIME_EXTENSIONS);
        $path = $file->store('media', 'public');
        $name = Str::limit(basename(str_replace('\\', '/', $file->getClientOriginalName())), 190, '');
        $media = Media::create(['id' => Str::lower(Str::random(12)), 'name' => $name, 'mime' => $actualMime, 'size' => $file->getSize(), 'path' => $path, 'uploaded_by' => $request->user()->id]);
        return response()->json(['media' => $media, 'url' => asset('storage/' . $path)], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $media = Media::findOrFail($id);
        $user = $request->user();
        if ($user->id === $media->uploaded_by && $user->role_key !== 'student') {
            // Owner path (upload sendiri tidak tersedia untuk student).
        } else {
            AdminAccess::authorize($user, 'manage_media');
        }
        abort_unless(FileSecurity::isPathWithin($media->path, 'media'), 422, 'Path media tidak valid.');
        Storage::disk('public')->delete($media->path);
        $media->delete();
        return response()->json(['message' => 'File dihapus.']);
    }

    private function staff(Request $request): void
    {
        $user = $request->user();
        if ($user->role_key === 'instructor') return;
        AdminAccess::authorize($user, 'manage_media');
    }
}
