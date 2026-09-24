<?php
/**
 * Public API routes — mirrors server/routes/public.js.
 * All functions here are called from router.php.
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/media.php';
require_once __DIR__ . '/site-settings.php';

$_EMAIL_RE = '/^[^\s@]+@[^\s@]+\.[^\s@]+$/';

function _pub_str($v, $max) {
    return mb_substr(trim((string)($v ?? '')), 0, $max);
}

function _pub_json_out($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    header('Cache-Control: no-cache');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/* ---------- Reviews ---------- */

function _public_review($r) {
    $avatar = null;
    if ($r['avatar']) {
        $av = is_string($r['avatar']) ? json_decode($r['avatar'], true) : $r['avatar'];
        $avatar = $av ? ($av['url'] ?? '') : '';
    }
    $media_raw = $r['media'] ? (is_string($r['media']) ? json_decode($r['media'], true) : $r['media']) : [];
    $media = array_filter(array_map('present', $media_raw));

    $link = $r['video_link'] ? parse_video_link($r['video_link']) : null;
    $videoLink = null;
    if ($link) {
        $videoLink = ['type' => 'video', 'url' => $link['url'], 'embed' => $link['embed'], 'thumb' => $link['thumb'], 'full' => ''];
    }

    return [
        'id' => (int)$r['id'],
        'name' => $r['name'],
        'rating' => (int)$r['rating'],
        'message' => $r['message'],
        'verified' => (bool)$r['verified'],
        'createdAt' => $r['created_at'],
        'avatar' => $avatar ?: '',
        'media' => array_values($media),
        'videoLink' => $videoLink
    ];
}

function get_reviews() {
    global $config;
    $rows = db_query("SELECT * FROM reviews WHERE status = 'approved' ORDER BY created_at DESC LIMIT 500");

    $distribution = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
    $total = 0;
    foreach ($rows as $r) {
        $rating = (int)$r['rating'];
        if (isset($distribution[$rating])) $distribution[$rating]++;
        $total += $rating;
    }
    $count = count($rows);

    _pub_json_out([
        'summary' => [
            'count' => $count,
            'average' => $count ? round($total / $count, 2) : 0,
            'distribution' => $distribution
        ],
        'limits' => [
            'photoMb' => $config['REVIEW_PHOTO_MAX_MB'],
            'videoMb' => $config['REVIEW_VIDEO_MAX_MB']
        ],
        'reviews' => array_map('_public_review', $rows)
    ]);
}

function post_review() {
    global $config, $_EMAIL_RE;

    // Honeypot check
    if (!empty($_POST['website'])) {
        _pub_json_out(['ok' => true], 201);
    }

    $name = _pub_str($_POST['name'] ?? '', 80);
    $email = strtolower(_pub_str($_POST['email'] ?? '', 200));
    $phone = _pub_str($_POST['phone'] ?? '', 30);
    $message = _pub_str($_POST['message'] ?? '', 1500);
    $rating = (int)($_POST['rating'] ?? 0);
    $videoLinkRaw = _pub_str($_POST['videoLink'] ?? '', 500);

    // Validate
    $errors = [];
    if (mb_strlen($name) < 2) $errors['name'] = 'Enter your name.';
    if (!preg_match($_EMAIL_RE, $email)) $errors['email'] = 'Enter a valid email address.';
    if ($rating < 1 || $rating > 5) $errors['rating'] = 'Choose a rating from 1 to 5 stars.';
    if (mb_strlen($message) < 3) $errors['message'] = 'Write a few words about your experience.';

    $link = $videoLinkRaw ? parse_video_link($videoLinkRaw) : null;
    if ($videoLinkRaw && !$link) $errors['videoLink'] = 'Paste a full YouTube or Vimeo link.';

    if (!empty($errors)) {
        _pub_json_out(['error' => 'Check the highlighted fields.', 'fields' => $errors], 400);
    }

    $uploaded = [];
    try {
        $avatar = null;
        $photos = [];
        $video = null;

        // Avatar
        if (!empty($_FILES['avatar']) && $_FILES['avatar']['error'] === UPLOAD_ERR_OK) {
            $kind = media_check_type($_FILES['avatar']);
            if ($kind !== 'image') {
                _pub_json_out(['error' => 'Profile photo must be a JPG, PNG, WebP or HEIC image.', 'fields' => []], 400);
            }
            if ($_FILES['avatar']['size'] > $config['REVIEW_PHOTO_MAX_MB'] * 1024 * 1024) {
                _pub_json_out(['error' => 'Profile photo is larger than ' . $config['REVIEW_PHOTO_MAX_MB'] . ' MB.'], 400);
            }
            $avatar = upload_file($_FILES['avatar'], 'image', 'reviews');
            if ($avatar) $uploaded[] = $avatar;
        }

        // Photos (multi-file upload)
        if (!empty($_FILES['photos'])) {
            $photo_files = _rearray_files($_FILES['photos']);
            $count = min(count($photo_files), 4);
            for ($i = 0; $i < $count; $i++) {
                $f = $photo_files[$i];
                if ($f['error'] !== UPLOAD_ERR_OK) continue;
                $kind = media_check_type($f);
                if ($kind !== 'image') {
                    _pub_json_out(['error' => 'Photo ' . ($i + 1) . ' must be a JPG, PNG, WebP or HEIC image.'], 400);
                }
                if ($f['size'] > $config['REVIEW_PHOTO_MAX_MB'] * 1024 * 1024) {
                    _pub_json_out(['error' => 'Photo ' . ($i + 1) . ' is larger than ' . $config['REVIEW_PHOTO_MAX_MB'] . ' MB.'], 400);
                }
                $p = upload_file($f, 'image', 'reviews');
                if ($p) { $photos[] = $p; $uploaded[] = $p; }
            }
        }

        // Video
        if (!empty($_FILES['video']) && $_FILES['video']['error'] === UPLOAD_ERR_OK) {
            $kind = media_check_type($_FILES['video']);
            if ($kind !== 'video') {
                _pub_json_out(['error' => 'Video must be an MP4, MOV or WebM video.'], 400);
            }
            if ($_FILES['video']['size'] > $config['REVIEW_VIDEO_MAX_MB'] * 1024 * 1024) {
                _pub_json_out(['error' => 'Video is larger than ' . $config['REVIEW_VIDEO_MAX_MB'] . ' MB.'], 400);
            }
            $video = upload_file($_FILES['video'], 'video', 'reviews');
            if ($video) $uploaded[] = $video;
        }

        $items = $photos;
        if ($video) $items[] = $video;

        db_execute(
            "INSERT INTO reviews (name, email, phone, rating, message, avatar, media, video_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                $name, $email, $phone, $rating, $message,
                $avatar ? json_encode($avatar) : null,
                json_encode($items),
                $link ? $link['url'] : ''
            ]
        );

        _pub_json_out(['ok' => true], 201);
    } catch (Exception $e) {
        if (!empty($uploaded)) media_destroy($uploaded);
        throw $e;
    }
}

/* ---------- Gallery ---------- */

function get_gallery() {
    $rows = db_query("SELECT * FROM gallery_items WHERE published = 1 ORDER BY sort_order ASC, created_at DESC LIMIT 300");
    $items = array_map(function($g) {
        return array_merge(
            ['id' => (int)$g['id'], 'title' => $g['title'], 'caption' => $g['caption']],
            present(['type' => $g['type'], 'url' => $g['url']])
        );
    }, $rows);
    _pub_json_out(['items' => $items]);
}

/* ---------- Settings ---------- */

function get_settings() {
    $rows = db_query("SELECT setting_value FROM site_settings WHERE setting_key = 'site'");
    $saved = [];
    if (!empty($rows[0])) {
        $val = $rows[0]['setting_value'];
        $saved = is_string($val) ? (json_decode($val, true) ?? []) : (array)$val;
    }
    _pub_json_out(['settings' => sanitize_site_settings($saved)]);
}

/* ---------- Enquiries ---------- */

function post_enquiry() {
    global $_EMAIL_RE;

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    // Honeypot
    if (!empty($body['website'])) {
        _pub_json_out(['ok' => true], 201);
    }

    $name = _pub_str($body['name'] ?? '', 80);
    $phone = _pub_str($body['phone'] ?? '', 30);
    $email = strtolower(_pub_str($body['email'] ?? '', 200));

    $errors = [];
    if (!$name) $errors['name'] = 'Enter your name.';
    if (strlen(preg_replace('/\D/', '', $phone)) < 7) $errors['phone'] = 'Enter a phone number we can call.';
    if ($email && !preg_match($_EMAIL_RE, $email)) $errors['email'] = 'Enter a valid email address.';
    if (empty($body['consent'])) $errors['consent'] = 'Please confirm we may contact you.';

    if (!empty($errors)) {
        _pub_json_out(['error' => 'Check the highlighted fields.', 'fields' => $errors], 400);
    }

    db_execute(
        "INSERT INTO enquiries (name, phone, email, topic, message) VALUES (?, ?, ?, ?, ?)",
        [$name, $phone, $email, _pub_str($body['topic'] ?? '', 80), _pub_str($body['message'] ?? '', 3000)]
    );

    _pub_json_out(['ok' => true], 201);
}

/* ---------- Helper ---------- */

function _rearray_files(&$file_post) {
    if (!is_array($file_post['name'])) return [$file_post];
    $files = [];
    $count = count($file_post['name']);
    $keys = array_keys($file_post);
    for ($i = 0; $i < $count; $i++) {
        $f = [];
        foreach ($keys as $key) $f[$key] = $file_post[$key][$i];
        $files[] = $f;
    }
    return $files;
}
