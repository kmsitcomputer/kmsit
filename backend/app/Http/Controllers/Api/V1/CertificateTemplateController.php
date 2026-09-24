<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CertificateTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CertificateTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->admin($request); return response()->json(['templates' => CertificateTemplate::latest()->get()]);
    }
    public function store(Request $request): JsonResponse
    {
        $this->admin($request); $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'theme' => ['required', 'in:navy,ivory,graphite'], 'accent' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'], 'frame' => ['required', 'in:modern,classic']]);
        return response()->json(['template' => CertificateTemplate::create(['id' => Str::lower(Str::random(12)), ...$data])], 201);
    }
    public function update(Request $request, string $id): JsonResponse
    {
        $this->admin($request); $data = $request->validate(['name' => ['sometimes', 'string', 'max:120'], 'theme' => ['sometimes', 'in:navy,ivory,graphite'], 'accent' => ['sometimes', 'regex:/^#[0-9a-fA-F]{6}$/'], 'frame' => ['sometimes', 'in:modern,classic']]);
        $template = CertificateTemplate::findOrFail($id); $template->update($data); return response()->json(['template' => $template]);
    }
    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->admin($request); CertificateTemplate::findOrFail($id)->delete(); return response()->json(['message' => 'Template dihapus.']);
    }
    private function admin(Request $request): void { abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.'); }
}
