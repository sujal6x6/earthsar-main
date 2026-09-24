<?php
/**
 * Database connection and helpers — mirrors server/db.js.
 * Uses PDO singleton with MySQL. Provides db_query(), db_execute(), db_transaction().
 */
require_once __DIR__ . '/config.php';

$_db_pdo = null;

function db_connect() {
    global $_db_pdo, $config;
    if ($_db_pdo !== null) return $_db_pdo;

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        $config['DATABASE_HOST'],
        $config['DATABASE_PORT'],
        $config['DATABASE_NAME']
    );
    $_db_pdo = new PDO($dsn, $config['DATABASE_USER'], $config['DATABASE_PASS'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $_db_pdo;
}

/**
 * Run a SELECT query. Returns array of rows.
 */
function db_query($sql, $params = []) {
    $pdo = db_connect();
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

/**
 * Run an INSERT/UPDATE/DELETE. Returns ['affected' => int, 'insertId' => int].
 */
function db_execute($sql, $params = []) {
    $pdo = db_connect();
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return [
        'affected' => $stmt->rowCount(),
        'insertId' => (int)$pdo->lastInsertId()
    ];
}

/**
 * Run a callback inside a transaction.
 */
function db_transaction($callback) {
    $pdo = db_connect();
    $pdo->beginTransaction();
    try {
        $result = $callback($pdo);
        $pdo->commit();
        return $result;
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/**
 * Run schema.sql to create tables (safe to run on every request — uses IF NOT EXISTS).
 */
function db_migrate() {
    $schema_file = dirname(__DIR__) . '/server/schema.sql';
    if (!file_exists($schema_file)) return;

    $sql = file_get_contents($schema_file);
    // Split on semicolons followed by whitespace/newline
    $statements = preg_split('/;\s*(?:\r?\n|$)/', $sql);
    foreach ($statements as $stmt) {
        $stmt = trim($stmt);
        if ($stmt) {
            db_execute($stmt);
        }
    }
}
