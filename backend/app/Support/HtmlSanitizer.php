<?php

namespace App\Support;

use DOMDocument;
use DOMElement;
use DOMNode;

final class HtmlSanitizer
{
    private const TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'iframe', 'code', 'pre', 'span', 'div',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'];
    private const ATTRIBUTES = [
        'a' => ['href', 'title', 'target'],
        'img' => ['src', 'alt', 'title', 'width', 'height'],
        'iframe' => ['src', 'title', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder'],
        'th' => ['colspan', 'rowspan'], 'td' => ['colspan', 'rowspan'],
    ];
    private const EMBED_HOSTS = ['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'player.vimeo.com'];
    private const VIDEO_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'vimeo.com', 'www.vimeo.com', 'player.vimeo.com'];

    public function html(?string $html): ?string
    {
        if ($html === null || $html === '') return $html;
        $document = new DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="UTF-8"><div id="safe-root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        $root = $document->getElementById('safe-root');
        if (!$root) return '';
        $this->cleanChildren($root);
        $output = '';
        foreach ($root->childNodes as $child) $output .= $document->saveHTML($child);
        return $output;
    }

    public function payload(mixed $value, ?string $key = null): mixed
    {
        if (is_array($value)) {
            foreach ($value as $childKey => $child) $value[$childKey] = $this->payload($child, (string) $childKey);
            return $value;
        }
        if (!is_string($value)) return $value;
        if ($key && preg_match('/(?:url|href|src)$/i', $key)) return $this->url($value);
        return str_contains($value, '<') ? $this->html($value) : $value;
    }

    public function url(?string $url): ?string
    {
        if ($url === null || trim($url) === '') return $url;
        $url = trim($url);
        if (str_starts_with($url, '/') && !str_starts_with($url, '//')) return $url;
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        return in_array($scheme, ['http', 'https'], true) ? $url : null;
    }

    public function embedUrl(?string $url): ?string
    {
        $url = $this->url($url);
        if (!$url || strtolower((string) parse_url($url, PHP_URL_SCHEME)) !== 'https') return null;
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        return in_array($host, self::EMBED_HOSTS, true) ? $url : null;
    }

    /**
     * Video links shown through the site's YouTube/Vimeo player: https only, allowlisted hosts.
     * Deliberately wider than embedUrl() (watch/short links) but still never arbitrary hosts.
     */
    public function videoUrl(?string $url): ?string
    {
        $url = $this->url($url);
        if (!$url || strtolower((string) parse_url($url, PHP_URL_SCHEME)) !== 'https') return null;
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        return in_array($host, self::VIDEO_HOSTS, true) ? $url : null;
    }

    private function cleanChildren(DOMNode $parent): void
    {
        foreach (iterator_to_array($parent->childNodes) as $node) {
            if (!$node instanceof DOMElement) continue;
            $tag = strtolower($node->tagName);
            if (!in_array($tag, self::TAGS, true)) {
                $this->cleanChildren($node);
                if (in_array($tag, ['script', 'style', 'object', 'embed', 'form', 'input', 'meta', 'link'], true)) {
                    $parent->removeChild($node);
                } else {
                    while ($node->firstChild) $parent->insertBefore($node->firstChild, $node);
                    $parent->removeChild($node);
                }
                continue;
            }
            foreach (iterator_to_array($node->attributes) as $attribute) {
                $name = strtolower($attribute->name);
                if (str_starts_with($name, 'on') || $name === 'style' || !in_array($name, self::ATTRIBUTES[$tag] ?? [], true)) {
                    $node->removeAttribute($attribute->name);
                }
            }
            if ($tag === 'a') {
                $href = $this->url($node->getAttribute('href'));
                if (!$href) $node->removeAttribute('href'); else $node->setAttribute('href', $href);
                if ($node->getAttribute('target') === '_blank') $node->setAttribute('rel', 'noopener noreferrer');
            } elseif ($tag === 'img') {
                $src = $this->url($node->getAttribute('src'));
                if (!$src) $node->removeAttribute('src'); else $node->setAttribute('src', $src);
            } elseif ($tag === 'iframe') {
                $src = $this->embedUrl($node->getAttribute('src'));
                if (!$src) {
                    $parent->removeChild($node);
                    continue;
                }
                $node->setAttribute('src', $src);
                $node->setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
                $node->setAttribute('referrerpolicy', 'no-referrer');
            }
            $this->cleanChildren($node);
        }
    }
}
