<?php

namespace App\Support;

/**
 * Server-side shape validation for homepage dynamic-block content (IMP-003).
 *
 * Blocks stay schemaless in storage (the existing `homepage_blocks.content` JSON
 * column), but the four locked block types — banner, slider, faq, testimonial —
 * now have a backend contract: titles are plain strings, URLs/paths go through
 * the same http(s)-or-relative rule as the rest of the CMS, ratings are
 * numeric ranges, item lists are structured arrays, and rich-text answers go
 * through HtmlSanitizer. Unknown block types keep the legacy behavior (payload
 * sanitization in the controller) so existing blocks never break.
 */
class HomepageBlockShapes
{
    public const LOCKED_TYPES = ['banner', 'slider', 'faq', 'testimonial'];

    /**
     * Validate a block's type + content pair. Aborts with 422 on violation.
     */
    public static function validate(string $type, mixed $content, HtmlSanitizer $sanitizer): void
    {
        if (!in_array($type, self::LOCKED_TYPES, true)) return;
        if ($content !== null && !is_array($content)) abort(422, "Isi blok {$type} harus berupa objek.");

        $content ??= [];
        match ($type) {
            'banner' => self::banner($content, $sanitizer),
            'slider' => self::slider($content, $sanitizer),
            'faq' => self::faq($content, $sanitizer),
            'testimonial' => self::testimonial($content, $sanitizer),
        };
    }

    private static function banner(array $content, HtmlSanitizer $sanitizer): void
    {
        self::plain($content, ['title', 'subtitle', 'cta_label'], 190);
        self::link($content, 'image', $sanitizer);
        self::link($content, 'cta_url', $sanitizer);
        if (isset($content['align']) && !in_array($content['align'], ['left', 'center', 'right'], true)) {
            abort(422, 'Perataan banner harus left, center, atau right.');
        }
    }

    private static function slider(array $content, HtmlSanitizer $sanitizer): void
    {
        $items = $content['items'] ?? null;
        if ($items !== null && !is_array($items)) abort(422, 'Item slider harus berupa daftar.');
        foreach (is_array($items) ? array_values($items) : [] as $item) {
            if (!is_array($item)) abort(422, 'Setiap item slider harus berupa objek.');
            self::plain($item, ['title', 'subtitle', 'cta_label'], 190);
            self::link($item, 'image', $sanitizer);
            self::link($item, 'cta_url', $sanitizer);
        }
    }

    private static function faq(array $content, HtmlSanitizer $sanitizer): void
    {
        self::plain($content, ['title', 'subtitle'], 190);
        $items = $content['items'] ?? null;
        if ($items !== null && !is_array($items)) abort(422, 'Item FAQ harus berupa daftar.');
        foreach (is_array($items) ? array_values($items) : [] as $item) {
            if (!is_array($item)) abort(422, 'Setiap item FAQ harus berupa objek.');
            self::requiredPlain($item, 'question', 500);
            $answer = $item['answer'] ?? null;
            if (!is_string($answer) || trim($answer) === '') abort(422, 'Setiap item FAQ wajib memiliki jawaban.');
            $sanitizer->html($answer);
        }
    }

    private static function testimonial(array $content, HtmlSanitizer $sanitizer): void
    {
        self::plain($content, ['title', 'subtitle'], 190);
        $items = $content['items'] ?? null;
        if ($items !== null && !is_array($items)) abort(422, 'Item testimoni harus berupa daftar.');
        foreach (is_array($items) ? array_values($items) : [] as $item) {
            if (!is_array($item)) abort(422, 'Setiap item testimoni harus berupa objek.');
            self::requiredPlain($item, 'name', 120);
            self::plain($item, ['role'], 120);
            self::requiredPlain($item, 'testimonial', 2000);
            self::link($item, 'photo', $sanitizer);
            if (array_key_exists('rating', $item) && $item['rating'] !== null
                && (!is_numeric($item['rating']) || $item['rating'] < 1 || $item['rating'] > 5)) {
                abort(422, 'Rating testimoni harus berupa angka 1 sampai 5.');
            }
        }
    }

    /** Optional plain-text fields: must be strings within length when present. */
    private static function plain(array $data, array $keys, int $max): void
    {
        foreach ($keys as $key) {
            if (!array_key_exists($key, $data) || $data[$key] === null) continue;
            if (!is_string($data[$key]) || mb_strlen($data[$key]) > $max) abort(422, "Kolom {$key} harus berupa teks maksimal {$max} karakter.");
        }
    }

    private static function requiredPlain(array $data, string $key, int $max): void
    {
        if (!isset($data[$key]) || !is_string($data[$key]) || trim($data[$key]) === '' || mb_strlen($data[$key]) > $max) {
            abort(422, "Kolom {$key} wajib diisi (maksimal {$max} karakter).");
        }
    }

    /**
     * Optional link fields: absolute URLs must be http(s); root-relative paths
     * pass; bare relative paths (the Media Library `media/...` convention) are
     * allowed when they carry no scheme and no markup/traversal characters.
     */
    private static function link(array $data, string $key, HtmlSanitizer $sanitizer): void
    {
        if (!array_key_exists($key, $data) || $data[$key] === null || $data[$key] === '') return;
        if (!is_string($data[$key])) abort(422, "Kolom {$key} harus berupa URL http/https atau path relatif yang valid.");
        $value = trim($data[$key]);
        if ($value === '') return;
        if (preg_match('#^[a-zA-Z][a-zA-Z0-9+.-]*:#', $value) || str_starts_with($value, '/')) {
            if ($sanitizer->url($value) === null) abort(422, "Kolom {$key} harus berupa URL http/https atau path relatif yang valid.");
            return;
        }
        if (preg_match('#[<>"\'\s]#', $value) || str_contains($value, '..')) {
            abort(422, "Kolom {$key} harus berupa URL http/https atau path relatif yang valid.");
        }
    }
}
