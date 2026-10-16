<?php
require_once __DIR__ . '/../api/site-settings.php';
function check_registration($condition, $message) {
    if (!$condition) throw new Exception($message);
}
check_registration(sanitize_site_settings([])['registration'] === $DEFAULT_SITE_SETTINGS['registration'], 'Missing defaults');
$empty = ['enabled' => false, 'number' => '', 'verificationUrl' => '', 'office' => ''];
check_registration(sanitize_site_settings(['registration' => $empty])['registration'] === $empty, 'Cleared values were replaced');
$edited = ['enabled' => true, 'number' => 'NEW/123', 'verificationUrl' => 'https://example.com/certificate', 'office' => 'New office'];
check_registration(sanitize_site_settings(['registration' => $edited])['registration'] === $edited, 'Edits were not preserved');
foreach (['javascript:alert(1)', 'http://example.com', '//example.com', 'https://user:pass@example.com', 'https://example.com\\evil', 'https://example.com/ bad'] as $url) {
    check_registration(clean_registration(['verificationUrl' => $url])['verificationUrl'] === '', 'Unsafe URL accepted');
}
echo "PASS: PHP registration defaults, edits, clearing and unsafe links\n";
