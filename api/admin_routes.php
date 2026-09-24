<?php
/**
 * Admin panel API routes — mirrors server/routes/admin.js.
 * All functions here are called from router.php.
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/media.php';
require_once __DIR__ . '/site-settings.php';

// The current admin, set by router.php after require_admin()
$current_admin = null;

function _str($v, $max) {
    return mb_substr(trim((string)($v ?? '')), 0, $max);
}

function _int_id($v) {
    $n = (int)$v;
    if ($n < 1) {
        json_response(['error' => 'Not found.'], 404);
    }
    return $n;
}

function _json_input() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function _json_out($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$EMAIL_RE = '/^[^\s@]+@[^\s@]+\.[^\s@]+$/';

/* ---------- Session ---------- */

function admin_login() {
    $body = _json_input();
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $password = (string)($body['password'] ?? '');

    $admin = verify_login($email, $password);
    if (!$admin) {
        _json_out(['error' => 'That email and password do not match.'], 401);
    }
    issue_cookie($admin);
    _json_out(['admin' => ['email' => $admin['email'], 'name' => $admin['name']]]);
}

function admin_logout() {
    clear_cookie();
    _json_out(['ok' => true]);
}

function admin_me() {
    global $current_admin, $config;
    _json_out([
        'admin' => ['email' => $current_admin['email'], 'name' => $current_admin['name']],
        'storage' => ['configured' => true, 'name' => 'Local storage'],
        'limits' => ['adminUploadMb' => $config['ADMIN_UPLOAD_MAX_MB']]
    ]);
}

function admin_profile() {
    global $current_admin, $EMAIL_RE;
    $body = _json_input();
    $name = _str($body['name'] ?? '', 160);
    $email = strtolower(_str($body['email'] ?? '', 255));
    $current = (string)($body['current'] ?? '');

    if (!preg_match($EMAIL_RE, $email)) {
        _json_out(['error' => 'Enter a valid login email.'], 400);
    }
    $ok = verify_login($current_admin['email'], $current);
    if (!$ok) {
        _json_out(['error' => 'The current password is not correct.'], 400);
    }
    $exists = db_query("SELECT id FROM admins WHERE email = ? AND id <> ?", [$email, $current_admin['id']]);
    if (!empty($exists)) {
        _json_out(['error' => 'Another admin already uses that email.'], 400);
    }
    db_execute("UPDATE admins SET email = ?, name = ?, token_version = token_version + 1 WHERE id = ?",
        [$email, $name, $current_admin['id']]);
    $rows = db_query("SELECT * FROM admins WHERE id = ?", [$current_admin['id']]);
    issue_cookie($rows[0]);
    _json_out(['admin' => ['email' => $rows[0]['email'], 'name' => $rows[0]['name']]]);
}

function admin_password() {
    global $current_admin;
    $body = _json_input();
    $current = (string)($body['current'] ?? '');
    $next = (string)($body['next'] ?? '');

    if (mb_strlen($next) < 10) {
        _json_out(['error' => 'Use at least 10 characters for the new password.'], 400);
    }
    $ok = verify_login($current_admin['email'], $current);
    if (!$ok) {
        _json_out(['error' => 'The current password is not correct.'], 400);
    }
    db_execute("UPDATE admins SET password_hash = ?, token_version = token_version + 1 WHERE id = ?",
        [hash_pw($next), $current_admin['id']]);
    $rows = db_query("SELECT * FROM admins WHERE id = ?", [$current_admin['id']]);
    issue_cookie($rows[0]);
    _json_out(['ok' => true]);
}

/* ---------- Stats ---------- */

function admin_stats() {
    $rows = db_query("SELECT
        (SELECT COUNT(*) FROM reviews WHERE status = 'pending') AS pending,
        (SELECT COUNT(*) FROM reviews WHERE status = 'approved') AS approved,
        (SELECT COUNT(*) FROM reviews WHERE status = 'rejected') AS rejected,
        (SELECT COALESCE(ROUND(AVG(rating), 1), 0) FROM reviews WHERE status = 'approved') AS average,
        (SELECT COUNT(*) FROM gallery_items) AS gallery,
        (SELECT COUNT(*) FROM gallery_items WHERE published = 1) AS gallery_published,
        (SELECT COUNT(*) FROM enquiries WHERE handled = 0) AS enquiries_new
    ");
    _json_out($rows[0]);
}

/* ---------- Settings ---------- */

function admin_get_settings() {
    $rows = db_query("SELECT setting_value FROM site_settings WHERE setting_key = 'site'");
    $saved = [];
    if (!empty($rows[0])) {
        $val = $rows[0]['setting_value'];
        $saved = is_string($val) ? (json_decode($val, true) ?? []) : (array)$val;
    }
    _json_out(['settings' => sanitize_site_settings($saved)]);
}

function admin_patch_settings() {
    $body = _json_input();
    $settings = sanitize_site_settings($body['settings'] ?? $body);
    db_execute(
        "INSERT INTO site_settings (setting_key, setting_value) VALUES ('site', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [json_encode($settings, JSON_UNESCAPED_UNICODE)]
    );
    _json_out(['settings' => $settings]);
}

/* ---------- Reviews ---------- */

function _admin_review_format($r) {
    $avatar = null;
    if ($r['avatar']) {
        $av = is_string($r['avatar']) ? json_decode($r['avatar'], true) : $r['avatar'];
        if ($av) {
            $presented = present($av);
            $presented['publicId'] = $av['publicId'] ?? '';
            $avatar = $presented;
        }
    }
    $media_raw = $r['media'] ? (is_string($r['media']) ? json_decode($r['media'], true) : $r['media']) : [];
    $media = [];
    foreach ($media_raw as $item) {
        $p = present($item);
        $p['publicId'] = $item['publicId'] ?? '';
        $media[] = $p;
    }
    $link = $r['video_link'] ? parse_video_link($r['video_link']) : null;

    return [
        'id' => (int)$r['id'],
        'name' => $r['name'],
        'email' => $r['email'],
        'phone' => $r['phone'],
        'rating' => (int)$r['rating'],
        'message' => $r['message'],
        'status' => $r['status'],
        'verified' => (bool)$r['verified'],
        'adminNote' => $r['admin_note'],
        'createdAt' => $r['created_at'],
        'reviewedAt' => $r['reviewed_at'],
        'avatar' => $avatar,
        'media' => $media,
        'videoLink' => $link
    ];
}

function admin_get_reviews() {
    $status = $_GET['status'] ?? 'pending';
    if (!in_array($status, ['pending', 'approved', 'rejected'])) $status = 'pending';
    $order = $status === 'pending' ? 'created_at ASC' : 'COALESCE(reviewed_at, created_at) DESC';
    $rows = db_query("SELECT * FROM reviews WHERE status = ? ORDER BY {$order} LIMIT 500", [$status]);
    _json_out(['reviews' => array_map('_admin_review_format', $rows)]);
}

function admin_patch_review($id) {
    $id = _int_id($id);
    $body = _json_input();
    $sets = [];
    $vals = [];

    if (isset($body['status'])) {
        if (!in_array($body['status'], ['pending', 'approved', 'rejected'])) {
            _json_out(['error' => 'Unknown status.'], 400);
        }
        $sets[] = 'status = ?';
        $vals[] = $body['status'];
        if ($body['status'] === 'pending') {
            $sets[] = 'reviewed_at = NULL';
        } else {
            $sets[] = 'reviewed_at = CURRENT_TIMESTAMP';
        }
    }
    if (isset($body['verified'])) {
        $sets[] = 'verified = ?';
        $vals[] = $body['verified'] ? 1 : 0;
    }
    if (isset($body['adminNote'])) {
        $sets[] = 'admin_note = ?';
        $vals[] = _str($body['adminNote'], 1000);
    }
    if (empty($sets)) {
        _json_out(['error' => 'Nothing to change.'], 400);
    }
    $vals[] = $id;
    $result = db_execute("UPDATE reviews SET " . implode(', ', $sets) . " WHERE id = ?", $vals);
    if ($result['affected'] === 0) {
        _json_out(['error' => 'That review no longer exists.'], 404);
    }
    $rows = db_query("SELECT * FROM reviews WHERE id = ?", [$id]);
    if (empty($rows)) _json_out(['error' => 'That review no longer exists.'], 404);
    _json_out(['review' => _admin_review_format($rows[0])]);
}

function admin_remove_media($id) {
    $id = _int_id($id);
    $body = _json_input();
    $url = _str($body['url'] ?? '', 2000);

    $review = db_transaction(function($pdo) use ($id, $url) {
        $stmt = $pdo->prepare("SELECT * FROM reviews WHERE id = ? FOR UPDATE");
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) _json_out(['error' => 'That review no longer exists.'], 404);

        $removed = null;
        $avatar = $row['avatar'] ? json_decode($row['avatar'], true) : null;
        $media = $row['media'] ? json_decode($row['media'], true) : [];
        $video_link = $row['video_link'];

        if ($avatar && ($avatar['url'] ?? '') === $url) {
            $removed = $avatar;
            $avatar = null;
        } elseif ($video_link) {
            $vl = parse_video_link($video_link);
            if ($vl && ($vl['url'] ?? '') === $url) {
                $removed = ['type' => 'link'];
                $video_link = '';
            }
        }

        if ($removed === null) {
            $idx = -1;
            foreach ($media as $i => $m) {
                if (($m['url'] ?? '') === $url) { $idx = $i; break; }
            }
            if ($idx === -1) _json_out(['error' => 'That file is not part of this review.'], 404);
            $removed = $media[$idx];
            array_splice($media, $idx, 1);
        }

        $stmt = $pdo->prepare("UPDATE reviews SET avatar = ?, media = ?, video_link = ? WHERE id = ?");
        $stmt->execute([
            $avatar ? json_encode($avatar) : null,
            json_encode($media),
            $video_link,
            $id
        ]);

        // Destroy removed file
        if ($removed && !empty($removed['publicId'])) {
            media_destroy([$removed]);
        }

        $stmt = $pdo->prepare("SELECT * FROM reviews WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    });

    _json_out(['review' => _admin_review_format($review)]);
}

function admin_delete_review($id) {
    $id = _int_id($id);
    $rows = db_query("SELECT * FROM reviews WHERE id = ?", [$id]);
    if (empty($rows)) _json_out(['error' => 'That review no longer exists.'], 404);
    $r = $rows[0];

    db_execute("DELETE FROM reviews WHERE id = ?", [$id]);

    // Cleanup files
    $items = [];
    if ($r['avatar']) {
        $av = is_string($r['avatar']) ? json_decode($r['avatar'], true) : $r['avatar'];
        if ($av) $items[] = $av;
    }
    $media = $r['media'] ? (is_string($r['media']) ? json_decode($r['media'], true) : $r['media']) : [];
    $items = array_merge($items, $media);
    if (!empty($items)) media_destroy($items);

    _json_out(['ok' => true]);
}

/* ---------- Gallery ---------- */

function _admin_gallery_format($g) {
    return array_merge([
        'id' => (int)$g['id'],
        'title' => $g['title'],
        'caption' => $g['caption'],
        'published' => (bool)$g['published'],
        'sortOrder' => (int)$g['sort_order'],
        'uploadedHere' => !empty($g['public_id']),
        'createdAt' => $g['created_at'],
    ], present(['type' => $g['type'], 'url' => $g['url']]));
}

function _next_sort_order() {
    $rows = db_query("SELECT COALESCE(MIN(sort_order), 0) - 1 AS n FROM gallery_items");
    return (int)$rows[0]['n'];
}

function admin_get_gallery() {
    $rows = db_query("SELECT * FROM gallery_items ORDER BY sort_order ASC, created_at DESC");
    _json_out(['items' => array_map('_admin_gallery_format', $rows)]);
}

function admin_post_gallery() {
    $body = _json_input();
    $url = _str($body['url'] ?? '', 2000);
    if (!is_https_url($url)) {
        _json_out(['error' => 'Paste a full link that starts with https://'], 400);
    }
    $type = in_array($body['type'] ?? '', ['image', 'video']) ? $body['type'] : guess_type($url);
    $result = db_execute(
        "INSERT INTO gallery_items (type, url, title, caption, published, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        [$type, $url, _str($body['title'] ?? '', 120), _str($body['caption'] ?? '', 500),
         ($body['published'] ?? true) ? 1 : 0, _next_sort_order()]
    );
    $rows = db_query("SELECT * FROM gallery_items WHERE id = ?", [$result['insertId']]);
    _json_out(['item' => _admin_gallery_format($rows[0])], 201);
}

function admin_upload_gallery() {
    global $config;
    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        _json_out(['error' => 'Choose a photo or video to upload.'], 400);
    }
    $file = $_FILES['file'];
    $kind = media_check_type($file, $config['ADMIN_UPLOAD_MAX_MB']);
    if (!$kind) {
        _json_out(['error' => 'The file must be an image or video.'], 400);
    }

    $uploaded = upload_file($file, $kind, 'gallery');
    if (!$uploaded) {
        _json_out(['error' => 'The upload could not be saved. Check the file and try again.'], 502);
    }

    $body = $_POST;
    $result = db_execute(
        "INSERT INTO gallery_items (type, url, public_id, title, caption, published, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [$kind, $uploaded['url'], $uploaded['publicId'],
         _str($body['title'] ?? '', 120), _str($body['caption'] ?? '', 500),
         ($body['published'] ?? 'true') !== 'false' ? 1 : 0, _next_sort_order()]
    );
    $rows = db_query("SELECT * FROM gallery_items WHERE id = ?", [$result['insertId']]);
    _json_out(['item' => _admin_gallery_format($rows[0])], 201);
}

function admin_patch_gallery($id) {
    $id = _int_id($id);
    $body = _json_input();
    $sets = [];
    $vals = [];

    if (array_key_exists('title', $body)) { $sets[] = 'title = ?'; $vals[] = _str($body['title'], 120); }
    if (array_key_exists('caption', $body)) { $sets[] = 'caption = ?'; $vals[] = _str($body['caption'], 500); }
    if (array_key_exists('published', $body)) { $sets[] = 'published = ?'; $vals[] = $body['published'] ? 1 : 0; }

    if (empty($sets)) _json_out(['error' => 'Nothing to change.'], 400);
    $vals[] = $id;
    $result = db_execute("UPDATE gallery_items SET " . implode(', ', $sets) . " WHERE id = ?", $vals);
    if ($result['affected'] === 0) _json_out(['error' => 'That item no longer exists.'], 404);
    $rows = db_query("SELECT * FROM gallery_items WHERE id = ?", [$id]);
    if (empty($rows)) _json_out(['error' => 'That item no longer exists.'], 404);
    _json_out(['item' => _admin_gallery_format($rows[0])]);
}

function admin_reorder_gallery() {
    $body = _json_input();
    $ids = is_array($body['ids'] ?? null) ? array_map('intval', $body['ids']) : [];
    if (empty($ids)) _json_out(['error' => 'Nothing to reorder.'], 400);

    db_transaction(function($pdo) use ($ids) {
        $stmt = $pdo->prepare("UPDATE gallery_items SET sort_order = ? WHERE id = ?");
        foreach ($ids as $i => $id) {
            $stmt->execute([$i + 1, $id]);
        }
    });
    _json_out(['ok' => true]);
}

function admin_delete_gallery($id) {
    $id = _int_id($id);
    $rows = db_query("SELECT * FROM gallery_items WHERE id = ?", [$id]);
    if (empty($rows)) _json_out(['error' => 'That item no longer exists.'], 404);

    db_execute("DELETE FROM gallery_items WHERE id = ?", [$id]);
    if (!empty($rows[0]['public_id'])) {
        media_destroy([['type' => $rows[0]['type'], 'publicId' => $rows[0]['public_id']]]);
    }
    _json_out(['ok' => true]);
}

/* ---------- Enquiries ---------- */

function admin_get_enquiries() {
    $rows = db_query("SELECT * FROM enquiries ORDER BY handled ASC, created_at DESC LIMIT 500");
    $enquiries = array_map(function($e) {
        return [
            'id' => (int)$e['id'],
            'name' => $e['name'],
            'phone' => $e['phone'],
            'email' => $e['email'],
            'topic' => $e['topic'],
            'message' => $e['message'],
            'handled' => (bool)$e['handled'],
            'status' => $e['lead_status'],
            'note' => $e['lead_note'],
            'followUp' => $e['follow_up_at'] ? substr($e['follow_up_at'], 0, 10) : '',
            'createdAt' => $e['created_at']
        ];
    }, $rows);
    _json_out(['enquiries' => $enquiries]);
}

function admin_patch_enquiry($id) {
    $id = _int_id($id);
    $body = _json_input();
    $sets = [];
    $vals = [];

    if (array_key_exists('handled', $body)) { $sets[] = 'handled = ?'; $vals[] = $body['handled'] ? 1 : 0; }
    if (array_key_exists('status', $body)) {
        $s = _str($body['status'], 40);
        if (!in_array($s, ['new', 'contacted', 'site_visit', 'converted', 'not_interested'])) {
            _json_out(['error' => 'Unknown lead status.'], 400);
        }
        $sets[] = 'lead_status = ?'; $vals[] = $s;
    }
    if (array_key_exists('note', $body)) { $sets[] = 'lead_note = ?'; $vals[] = _str($body['note'], 1000); }
    if (array_key_exists('followUp', $body)) { $sets[] = 'follow_up_at = ?'; $vals[] = $body['followUp'] ?: null; }

    if (empty($sets)) _json_out(['error' => 'Nothing to change.'], 400);
    $vals[] = $id;
    $result = db_execute("UPDATE enquiries SET " . implode(', ', $sets) . " WHERE id = ?", $vals);
    if ($result['affected'] === 0) _json_out(['error' => 'That lead no longer exists.'], 404);
    _json_out(['ok' => true]);
}

function admin_delete_enquiry($id) {
    $id = _int_id($id);
    db_execute("DELETE FROM enquiries WHERE id = ?", [$id]);
    _json_out(['ok' => true]);
}
