<?php
/**
 * Handles robots.txt and sitemap.xml dynamically.
 */
require_once __DIR__ . '/api/config.php';

function seo_origin() {
    global $earthsar_config;
    if (!empty($earthsar_config['site_url'])) return $earthsar_config['site_url'];
    $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $proto . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
}

$type = $_GET['type'] ?? '';
$origin = seo_origin();

if ($type === 'robots') {
    header('Content-Type: text/plain; charset=UTF-8');
    echo "User-agent: *\n";
    echo "Allow: /\n";
    echo "Disallow: /admin\n";
    echo "Disallow: /api/\n";
    echo "\n";
    echo "Sitemap: {$origin}/sitemap.xml\n";
    exit;
}

if ($type === 'sitemap') {
    header('Content-Type: application/xml; charset=UTF-8');
    $today = date('Y-m-d');
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    echo "  <url>\n";
    echo "    <loc>{$origin}/</loc>\n";
    echo "    <lastmod>{$today}</lastmod>\n";
    echo "    <changefreq>weekly</changefreq>\n";
    echo "    <priority>1.0</priority>\n";
    echo "  </url>\n";
    echo '</urlset>' . "\n";
    exit;
}

http_response_code(404);
echo 'Not found';
