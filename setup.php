<?php
// Setup is a deployment operation, never a public web endpoint.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/api/db.php';
require_once __DIR__ . '/api/auth.php';
db_migrate();
bootstrap_admin();
echo "Database initialized.\n";
