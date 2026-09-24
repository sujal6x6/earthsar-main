<?php
// config.php
function load_env($file) {
    if (!file_exists($file)) return;
    $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        list($name, $value) = explode('=', $line, 2) + [1 => ''];
        $name = trim($name);
        $value = trim($value);
        if (!empty($name) && !array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
            putenv(sprintf('%s=%s', $name, $value));
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
}

$env_file = dirname(__DIR__) . '/.env';
load_env($env_file);

// Handle DATABASE_URL if individual vars aren't set
if (empty($_ENV['DATABASE_HOST']) && !empty($_ENV['DATABASE_URL'])) {
    $db_url = parse_url($_ENV['DATABASE_URL']);
    $_ENV['DATABASE_HOST'] = $db_url['host'] ?? '127.0.0.1';
    $_ENV['DATABASE_PORT'] = $db_url['port'] ?? 3306;
    $_ENV['DATABASE_USER'] = $db_url['user'] ?? 'root';
    $_ENV['DATABASE_PASS'] = $db_url['pass'] ?? '';
    $_ENV['DATABASE_NAME'] = ltrim($db_url['path'] ?? '', '/');
}

$config = [
    'DATABASE_HOST' => $_ENV['DATABASE_HOST'] ?? '127.0.0.1',
    'DATABASE_PORT' => $_ENV['DATABASE_PORT'] ?? 3306,
    'DATABASE_USER' => $_ENV['DATABASE_USER'] ?? 'root',
    'DATABASE_PASS' => $_ENV['DATABASE_PASS'] ?? '',
    'DATABASE_NAME' => $_ENV['DATABASE_NAME'] ?? 'earthsar',
    
    'JWT_SECRET' => $_ENV['JWT_SECRET'] ?? 'fallback_secret_must_be_changed_in_prod',
    
    'ADMIN_EMAIL' => $_ENV['ADMIN_EMAIL'] ?? 'admin@example.com',
    'ADMIN_PASSWORD' => $_ENV['ADMIN_PASSWORD'] ?? 'admin123',
    'ADMIN_NAME' => $_ENV['ADMIN_NAME'] ?? 'Admin',
    
    'REVIEW_PHOTO_MAX_MB' => isset($_ENV['REVIEW_PHOTO_MAX_MB']) ? (float)$_ENV['REVIEW_PHOTO_MAX_MB'] : 5,
    'REVIEW_VIDEO_MAX_MB' => isset($_ENV['REVIEW_VIDEO_MAX_MB']) ? (float)$_ENV['REVIEW_VIDEO_MAX_MB'] : 50,
    'ADMIN_UPLOAD_MAX_MB' => isset($_ENV['ADMIN_UPLOAD_MAX_MB']) ? (float)$_ENV['ADMIN_UPLOAD_MAX_MB'] : 100,
    
    'APP_ENV' => $_ENV['NODE_ENV'] ?? $_ENV['APP_ENV'] ?? 'development',
    'SITE_URL' => rtrim($_ENV['SITE_URL'] ?? '', '/')
];

// Alias used by index.php
$earthsar_config = &$config;
