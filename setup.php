<?php
/**
 * One-click Database Setup & Migration Script for Hostinger
 * Visit: https://earthsar.in/setup.php in your browser once after uploading.
 */
header('Content-Type: text/html; charset=UTF-8');
require_once __DIR__ . '/api/config.php';
require_once __DIR__ . '/api/db.php';
require_once __DIR__ . '/api/auth.php';

$messages = [];
$status = 'info';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // 1. Test DB Connection
        $pdo = db_connect();
        $messages[] = ['type' => 'success', 'text' => '✅ Connected to MySQL database successfully.'];

        // 2. Run migrations
        db_migrate();
        $messages[] = ['type' => 'success', 'text' => '✅ Database tables created successfully (admins, reviews, gallery_items, enquiries, site_settings).'];

        // 3. Bootstrap admin
        $adminEmail = $config['ADMIN_EMAIL'] ?? '';
        $adminPass = $config['ADMIN_PASSWORD'] ?? '';
        $adminName = $config['ADMIN_NAME'] ?? 'Admin';

        if (!empty($adminEmail) && !empty($adminPass)) {
            $rows = db_query("SELECT COUNT(*) AS n FROM admins");
            if ((int)$rows[0]['n'] === 0) {
                if (strlen($adminPass) >= 10) {
                    db_execute("INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)", [
                        strtolower(trim($adminEmail)),
                        $adminName,
                        hash_pw($adminPass)
                    ]);
                    $messages[] = ['type' => 'success', 'text' => "✅ Created first admin account for: <b>" . htmlspecialchars($adminEmail) . "</b>"];
                } else {
                    $messages[] = ['type' => 'warning', 'text' => '⚠️ ADMIN_PASSWORD in .env must be at least 10 characters to create an admin account.'];
                }
            } else {
                $messages[] = ['type' => 'info', 'text' => 'ℹ️ Admin account already exists. Skipping bootstrap.'];
            }
        } else {
            $messages[] = ['type' => 'warning', 'text' => '⚠️ ADMIN_EMAIL or ADMIN_PASSWORD not set in .env. Admin account was not created.'];
        }

        // 4. Ensure upload directory exists
        $uploadDir = __DIR__ . '/public/uploads';
        if (!is_dir($uploadDir . '/reviews')) @mkdir($uploadDir . '/reviews', 0755, true);
        if (!is_dir($uploadDir . '/gallery')) @mkdir($uploadDir . '/gallery', 0755, true);
        $messages[] = ['type' => 'success', 'text' => '✅ Upload folders created at public/uploads/.'];

        $status = 'complete';
    } catch (Exception $e) {
        $messages[] = ['type' => 'danger', 'text' => '❌ Error: ' . htmlspecialchars($e->getMessage())];
        $status = 'error';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EarthSar Setup & Migration</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b132b; color: #f0f4f8; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
  .card { background: #1c2541; padding: 32px; border-radius: 12px; max-width: 560px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.4); border: 1px solid #3a506b; }
  h1 { margin-top: 0; font-size: 24px; color: #6fffe9; }
  p { color: #cbd5e1; line-height: 1.5; font-size: 15px; }
  .msg { padding: 12px 16px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; line-height: 1.4; }
  .msg.success { background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #a7f3d0; }
  .msg.danger { background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; }
  .msg.warning { background: rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; color: #fde68a; }
  .msg.info { background: rgba(59, 130, 246, 0.2); border: 1px solid #3b82f6; color: #bfdbfe; }
  button { background: #004AAD; color: white; border: none; padding: 14px 24px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; width: 100%; transition: background 0.2s; }
  button:hover { background: #003a88; }
  .actions { margin-top: 24px; display: flex; gap: 12px; }
  .btn-link { display: block; text-align: center; background: #3a506b; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; flex: 1; }
  .btn-link:hover { background: #4a6282; }
  code { background: #0b132b; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #f1770a; }
</style>
</head>
<body>
<div class="card">
  <h1>⚡ EarthSar Hostinger Setup</h1>
  <p>This script initializes your MySQL database tables and creates your default admin account based on your <code>.env</code> file.</p>

  <?php foreach ($messages as $m): ?>
    <div class="msg <?= $m['type'] ?>"><?= $m['text'] ?></div>
  <?php endforeach; ?>

  <?php if ($status !== 'complete'): ?>
    <form method="POST">
      <button type="submit">Run Database Setup & Migrations</button>
    </form>
  <?php else: ?>
    <p style="color: #6fffe9; font-weight: 600;">Setup complete! You can now visit your site or sign in to admin.</p>
    <div class="actions">
      <a href="/" class="btn-link">View Website</a>
      <a href="/admin" class="btn-link" style="background: #004AAD;">Go to Admin Panel</a>
    </div>
  <?php endif; ?>
</div>
</body>
</html>
