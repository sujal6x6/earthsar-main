<?php
/**
 * Local file uploads and URL helpers — mirrors server/media.js.
 */

define('PUBLIC_DIR', dirname(__DIR__) . '/public');
define('UPLOAD_DIR', PUBLIC_DIR . '/uploads');

$IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif'];
$VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/3gpp'];

$EXT_BY_TYPE = [
    'image/jpeg' => '.jpg', 'image/png' => '.png', 'image/webp' => '.webp',
    'image/gif' => '.gif', 'image/heic' => '.heic', 'image/heif' => '.heif', 'image/avif' => '.avif',
    'video/mp4' => '.mp4', 'video/webm' => '.webm', 'video/quicktime' => '.mov',
    'video/x-m4v' => '.m4v', 'video/3gpp' => '.3gp'
];

/**
 * Check file type and size. Returns 'image'|'video' or null.
 */
function media_check_type($file, $maxMb = null) {
    global $IMAGE_TYPES, $VIDEO_TYPES;
    $mime = $file['type'] ?? (function_exists('mime_content_type') ? mime_content_type($file['tmp_name']) : '');
    if (in_array($mime, $IMAGE_TYPES)) $kind = 'image';
    elseif (in_array($mime, $VIDEO_TYPES)) $kind = 'video';
    else return null;

    if ($maxMb && $file['size'] > $maxMb * 1024 * 1024) {
        return null; // Too large
    }
    return $kind;
}

function _safe_ext($file) {
    global $EXT_BY_TYPE;
    $ext = strtolower(pathinfo($file['name'] ?? '', PATHINFO_EXTENSION));
    if ($ext && preg_match('/^[a-z0-9]{1,8}$/', $ext)) return '.' . $ext;
    if (isset($EXT_BY_TYPE[$file['type'] ?? ''])) return $EXT_BY_TYPE[$file['type']];
    return str_starts_with($file['type'] ?? '', 'video/') ? '.mp4' : '.jpg';
}

/**
 * Move uploaded file to public/uploads/{subfolder}. Returns ['type','url','publicId'].
 */
function upload_file($file, $kind, $subfolder) {
    $dir = UPLOAD_DIR . '/' . $subfolder;
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $name = time() . '-' . bin2hex(random_bytes(8)) . _safe_ext($file);
    $dest = $dir . '/' . $name;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        return null;
    }

    $url = '/uploads/' . $subfolder . '/' . $name;
    return ['type' => $kind, 'url' => $url, 'publicId' => $url];
}

/**
 * Delete local uploaded files. Never throws.
 */
function media_destroy($items) {
    if (!is_array($items)) return;
    foreach ($items as $item) {
        if (!$item) continue;
        $url = $item['publicId'] ?? $item['url'] ?? '';
        if (!$url || strpos($url, '/uploads/') !== 0) continue;
        $file = PUBLIC_DIR . $url;
        // Safety: make sure it's inside public dir
        $real = realpath(dirname($file));
        if ($real && strpos($real, realpath(PUBLIC_DIR)) === 0) {
            @unlink($file);
        }
    }
}

/**
 * Parse YouTube / Vimeo link. Returns array or null.
 */
function parse_video_link($raw) {
    $url = trim((string)($raw ?? ''));
    if (!$url) return null;
    if (!preg_match('#^https?://#i', $url)) return null;

    // YouTube
    if (preg_match('#(?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|embed/|live/)|youtu\.be/)([\w-]{6,})#', $url, $m)) {
        return [
            'kind' => 'youtube',
            'url' => $url,
            'embed' => 'https://www.youtube-nocookie.com/embed/' . $m[1] . '?autoplay=1&rel=0',
            'thumb' => 'https://i.ytimg.com/vi/' . $m[1] . '/hqdefault.jpg'
        ];
    }
    // Vimeo
    if (preg_match('#vimeo\.com/(?:video/)?(\d+)#', $url, $m)) {
        return [
            'kind' => 'vimeo',
            'url' => $url,
            'embed' => 'https://player.vimeo.com/video/' . $m[1] . '?autoplay=1',
            'thumb' => ''
        ];
    }
    return null;
}

function is_https_url($raw) {
    $url = trim((string)($raw ?? ''));
    return (bool)preg_match('#^https://#i', $url);
}

function guess_type($url) {
    if (parse_video_link($url)) return 'video';
    if (preg_match('#\.(mp4|webm|mov|m4v|ogv)(\?|#|$)#i', $url)) return 'video';
    return 'image';
}

/**
 * Shape one stored media item for the public site.
 */
function present($item) {
    if (!$item) return ['type' => 'image', 'url' => '', 'embed' => '', 'thumb' => '', 'full' => ''];
    $url = $item['url'] ?? '';
    $type = $item['type'] ?? 'image';

    if ($type === 'video') {
        $link = parse_video_link($url);
        if ($link) return ['type' => 'video', 'url' => $link['url'], 'embed' => $link['embed'], 'thumb' => $link['thumb'], 'full' => ''];
        return ['type' => 'video', 'url' => $url, 'embed' => '', 'thumb' => '', 'full' => $url];
    }
    return ['type' => 'image', 'url' => $url, 'embed' => '', 'thumb' => $url, 'full' => $url];
}
