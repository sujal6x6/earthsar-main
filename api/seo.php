<?php
/**
 * Handles robots.txt and sitemap.xml dynamically.
 */
require_once __DIR__ . '/api/config.php';

function seo_origin() {
    global $earthsar_config;
    if (!empty($earthsar_config['SITE_URL'])) return $earthsar_config['SITE_URL'];
    if (!empty($earthsar_config['site_url'])) return $earthsar_config['site_url'];
    $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $proto . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
}

$sitemap_urls = [
    ['', 'weekly', '1.0'],
    ['services.html', 'monthly', '0.9'],
    ['real-estate-advisory-gurugram.html', 'monthly', '0.8'],
    ['contact.html', 'monthly', '0.7'],
    ['privacy.html', 'yearly', '0.3'],
    ['terms.html', 'yearly', '0.3'],
    ['disclaimer.html', 'yearly', '0.3']
];

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
    foreach ($sitemap_urls as $entry) {
        [$path, $changefreq, $priority] = $entry;
        echo "  <url>\n";
        echo "    <loc>{$origin}/{$path}</loc>\n";
        echo "    <lastmod>{$today}</lastmod>\n";
        echo "    <changefreq>{$changefreq}</changefreq>\n";
        echo "    <priority>{$priority}</priority>\n";
        echo "  </url>\n";
    }
    echo '</urlset>' . "\n";
    exit;
}

http_response_code(404);
echo 'Not found';
