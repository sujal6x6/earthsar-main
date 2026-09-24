<?php
/**
 * Admin authentication — mirrors server/auth.js.
 * Cookie-based JWT auth with CSRF protection.
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/jwt.php';

define('COOKIE_NAME', 'es_admin');
define('MAX_AGE', 7 * 24 * 60 * 60); // 7 days

function hash_pw($pw) {
    return password_hash($pw, PASSWORD_BCRYPT, ['cost' => 12]);
}

function verify_login($email, $password) {
    $email = strtolower(trim((string)($email ?? '')));
    $password = (string)($password ?? '');
    $rows = db_query("SELECT * FROM admins WHERE email = ?", [$email]);
    if (empty($rows)) {
        // Constant-time: always run password_verify even if no user found
        password_verify($password, '$2y$10$dummy.hash.to.prevent.timing.attacks.000000000000000');
        return null;
    }
    $admin = $rows[0];
    if (password_verify($password, $admin['password_hash'])) {
        return $admin;
    }
    return null;
}

function issue_cookie($admin) {
    global $config;
    $exp = time() + MAX_AGE;
    $payload = [
        'sub' => (int)$admin['id'],
        'v' => (int)$admin['token_version'],
        'exp' => $exp
    ];
    $token = jwt_encode($payload, $config['JWT_SECRET']);
    $secure = $config['APP_ENV'] === 'production';

    setcookie(COOKIE_NAME, $token, [
        'expires' => $exp,
        'path' => '/api/admin',
        'domain' => '',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
}

function clear_cookie() {
    global $config;
    $secure = $config['APP_ENV'] === 'production';
    setcookie(COOKIE_NAME, '', [
        'expires' => time() - 3600,
        'path' => '/api/admin',
        'domain' => '',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
}

/**
 * Middleware: verifies admin session.
 * Returns admin row or sends 401/403 and exits.
 */
function require_admin() {
    global $config;

    if (empty($_COOKIE[COOKIE_NAME])) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Sign in to continue.']);
        exit;
    }

    $token = $_COOKIE[COOKIE_NAME];
    $payload = jwt_decode($token, $config['JWT_SECRET']);

    if (!$payload || !isset($payload['sub'])) {
        clear_cookie();
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Your session has expired. Sign in again.']);
        exit;
    }

    $rows = db_query("SELECT id, email, name, token_version, password_hash FROM admins WHERE id = ?", [$payload['sub']]);
    if (empty($rows)) {
        clear_cookie();
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Your session has expired. Sign in again.']);
        exit;
    }

    $admin = $rows[0];
    if ((int)$admin['token_version'] !== (int)$payload['v']) {
        clear_cookie();
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Your session has expired. Sign in again.']);
        exit;
    }

    // CSRF protection for non-GET/HEAD requests
    $method = $_SERVER['REQUEST_METHOD'];
    if (!in_array($method, ['GET', 'HEAD'])) {
        $xrw = $_SERVER['HTTP_X_REQUESTED_WITH'] ?? '';
        if ($xrw !== 'earthsar-admin') {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Request blocked.']);
            exit;
        }
    }

    return $admin;
}

/**
 * Create the first admin from env vars if no admins exist yet.
 */
function bootstrap_admin() {
    global $config;
    $email = strtolower(trim($config['ADMIN_EMAIL'] ?? ''));
    $password = $config['ADMIN_PASSWORD'] ?? '';
    $name = $config['ADMIN_NAME'] ?? 'Admin';

    if (!$email || !$password) return;

    try {
        $rows = db_query("SELECT COUNT(*) AS n FROM admins");
        if ((int)$rows[0]['n'] > 0) return;

        if (strlen($password) < 10) {
            error_log("ADMIN_PASSWORD must be at least 10 characters. Admin not created.");
            return;
        }

        db_execute(
            "INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)",
            [$email, $name, hash_pw($password)]
        );
        error_log("Created admin account {$email}. You can remove ADMIN_PASSWORD from the environment now.");
    } catch (Exception $e) {
        // Table might not exist yet — that's OK
    }
}
