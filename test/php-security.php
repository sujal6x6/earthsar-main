<?php
// Run with PHP 8+ and the fileinfo extension enabled. No database is used.
require_once __DIR__ . '/../api/media.php';
require_once __DIR__ . '/../api/jwt.php';
function expect($value, $message) {
    if (!$value) throw new RuntimeException($message);
}
$temp = tempnam(sys_get_temp_dir(), 'earthsar-test-');
try {
    foreach (['not an image', '<html><script>alert(1)</script></html>', '<?php echo 1; ?>', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'] as $content) {
        file_put_contents($temp, $content);
        $file = ['tmp_name' => $temp, 'type' => 'image/jpeg', 'name' => 'image.php', 'size' => strlen($content)];
        expect(media_check_type($file) === null, 'Disguised active content accepted');
    }
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=');
    file_put_contents($temp, $png);
    $file = ['tmp_name' => $temp, 'type' => 'text/html', 'name' => 'image.php', 'size' => strlen($png)];
    expect(media_check_type($file) === 'image', 'Genuine PNG was rejected');
    expect(_safe_ext($file) === '.png', 'Unsafe filename extension retained');
    expect(media_check_type($file, 0.000001) === null, 'Oversize image accepted');
    $secret = bin2hex(random_bytes(48));
    $claims = ['sub' => 1, 'v' => 0, 'exp' => time() + 60];
    $token = jwt_encode($claims, $secret);
    expect(jwt_decode($token, $secret) === $claims, 'Valid session rejected');
    expect(jwt_decode($token, 'incorrect-secret') === null, 'Invalid signature accepted');
    expect(jwt_decode(jwt_encode(['sub' => 1, 'v' => 0], $secret), $secret) === null, 'Missing expiration accepted');
    expect(jwt_decode(jwt_encode(['sub' => 1, 'v' => 0, 'exp' => time() - 1], $secret), $secret) === null, 'Expired session accepted');
    expect(jwt_decode('malformed.session', $secret) === null, 'Malformed session accepted');
    echo "PHP upload and session regression checks passed.\n";
} finally {
    unlink($temp);
}
