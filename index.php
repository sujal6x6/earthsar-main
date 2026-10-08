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

function maintenance_html($settings) {
    $maintenance = $settings['maintenance'] ?? [];
    $contact = $settings['contact'] ?? [];
    $title = $maintenance['title'] ?? 'Website under maintenance';
    $message = $maintenance['message'] ?? 'We are making a few updates and will be back online shortly.';
    $phone = $contact['phone'] ?? ($contact['whatsapp'] ?? '');
    $email = $contact['email'] ?? '';
    $phone_href = preg_replace('/\s+/', '', $phone);
    return '<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>' . escape_html($title) . ' | earthsar</title>
<style>
:root{color-scheme:light;--blue:#0B2D4D;--orange:#E97824;--ink:#263342;--muted:#687386;--bg:#F6F3EE;--surface:#fff}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--bg);color:var(--ink);font-family:Arial,Helvetica,sans-serif}
main{width:min(620px,100%);background:var(--surface);border:1px solid #E4DED4;border-top:5px solid var(--orange);border-radius:18px;padding:38px 34px;box-shadow:0 24px 70px rgba(11,45,77,.16);text-align:center}
.brand img{width:min(220px,80%);height:auto;margin-bottom:20px}
h1{margin:0;color:var(--blue);font-size:clamp(28px,5vw,42px);line-height:1.08}p{font-size:18px;line-height:1.65;margin:18px auto 0;max-width:46ch;color:var(--muted)}
.contact{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:26px}.contact a{border:1px solid #D9E1EA;border-radius:999px;padding:10px 16px;color:var(--blue);text-decoration:none;font-weight:700}.contact a:hover{border-color:var(--blue)}
</style>
</head>
<body>
<main>
<div class="brand" aria-label="earthsar"><img src="/assets/earthsar-logo.png" alt="earthsar - Smart Advisors In Real Estate"></div>
<h1>' . escape_html($title) . '</h1>
<p>' . escape_html($message) . '</p>' .
($phone || $email ? '<div class="contact">' . ($phone ? '<a href="tel:' . escape_html($phone_href) . '">' . escape_html($phone) . '</a>' : '') . ($email ? '<a href="mailto:' . escape_html($email) . '">' . escape_html($email) . '</a>' : '') . '</div>' : '') .
'</main>
</body>
</html>';
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
    if (!empty($settings['maintenance']['enabled'])) {
        http_response_code(503);
        header('Content-Type: text/html; charset=UTF-8');
        header('Cache-Control: no-cache');
        header('Retry-After: 3600');
        echo maintenance_html($settings);
        exit;
    }
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
