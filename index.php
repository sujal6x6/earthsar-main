<?php
/**
 * Dynamic index.php — serves public/index.html with dynamic SEO meta tags
 * injected from database site_settings (just like the Node.js version did).
 */
require_once __DIR__ . '/api/config.php';
require_once __DIR__ . '/api/db.php';
require_once __DIR__ . '/api/site-settings.php';

function escape_html($v) {
    return htmlspecialchars((string)($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

function absolute_url($value, $origin) {
    if (!$value) return '';
    if (preg_match('#^https?://#', $value)) return $value;
    return rtrim($origin, '/') . '/' . ltrim($value, '/');
}

function upsert_meta($html, $type, $key, $value) {
    if (!$value) return $html;
    $content = escape_html($value);
    if ($type === 'name') {
        $re = '/<meta\s+name=["\']' . preg_quote($key, '/') . '["\']\s[^>]*>/i';
        $tag = '<meta name="' . $key . '" content="' . $content . '">';
        if (preg_match($re, $html)) return preg_replace($re, $tag, $html);
        return str_replace('</head>', $tag . "\n</head>", $html);
    }
    if ($type === 'property') {
        $re = '/<meta\s+property=["\']' . preg_quote($key, '/') . '["\']\s[^>]*>/i';
        $tag = '<meta property="' . $key . '" content="' . $content . '">';
        if (preg_match($re, $html)) return preg_replace($re, $tag, $html);
        return str_replace('</head>', $tag . "\n</head>", $html);
    }
    // link canonical
    $re = '/<link\s+rel=["\']canonical["\']\s[^>]*>/i';
    $tag = '<link rel="canonical" href="' . $content . '">';
    if (preg_match($re, $html)) return preg_replace($re, $tag, $html);
    return str_replace('</head>', $tag . "\n</head>", $html);
}

function site_origin() {
    global $earthsar_config;
    if (!empty($earthsar_config['SITE_URL'])) return $earthsar_config['SITE_URL'];
    if (!empty($earthsar_config['site_url'])) return $earthsar_config['site_url'];
    $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $proto . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
}

// Read HTML
$html_path = __DIR__ . '/public/index.html';
if (!file_exists($html_path)) {
    http_response_code(404);
    echo 'index.html not found';
    exit;
}
$html = file_get_contents($html_path);

// Read settings from DB
try {
    $rows = db_query("SELECT setting_value FROM site_settings WHERE setting_key = 'site'");
    $saved = [];
    if (!empty($rows[0])) {
        $val = $rows[0]['setting_value'];
        $saved = is_string($val) ? (json_decode($val, true) ?? []) : (array)$val;
    }
    $settings = sanitize_site_settings($saved);
    $seo = $settings['seo'] ?? [];
    $hero = $settings['hero'] ?? [];
    $origin = site_origin();

    $title = $seo['title'] ?: ($seo['ogTitle'] ?: ($seo['twitterTitle'] ?? ''));
    $description = $seo['description'] ?: ($seo['ogDescription'] ?: ($seo['twitterDescription'] ?? ''));
    $canonical = $seo['canonicalUrl'] ?: ($origin . '/');
    $image = absolute_url($seo['ogImage'] ?: ($hero['image'] ?? ''), $origin);

    if ($title) {
        $html = preg_replace('/<title>[\s\S]*?<\/title>/i', '<title>' . escape_html($title) . '</title>', $html);
    }
    $html = upsert_meta($html, 'name', 'description', $description);
    $html = upsert_meta($html, 'name', 'keywords', $seo['keywords'] ?? '');
    $html = upsert_meta($html, 'name', 'robots', $seo['robots'] ?? '');
    $html = upsert_meta($html, 'link', 'canonical', $canonical);
    $html = upsert_meta($html, 'property', 'og:url', $canonical);
    $html = upsert_meta($html, 'property', 'og:title', $seo['ogTitle'] ?: $title);
    $html = upsert_meta($html, 'property', 'og:description', $seo['ogDescription'] ?: $description);
    $html = upsert_meta($html, 'property', 'og:image', $image);
    $html = upsert_meta($html, 'property', 'og:image:alt', $seo['ogImageAlt'] ?: ($hero['imageAlt'] ?? ''));
    $html = upsert_meta($html, 'name', 'twitter:title', $seo['twitterTitle'] ?: ($seo['ogTitle'] ?: $title));
    $html = upsert_meta($html, 'name', 'twitter:description', $seo['twitterDescription'] ?: ($seo['ogDescription'] ?: $description));
    $html = upsert_meta($html, 'name', 'twitter:image', $image);
} catch (Exception $e) {
    // If DB is not yet configured, just serve the raw HTML
}

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-cache');
echo $html;
