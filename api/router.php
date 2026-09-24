<?php
// router.php

function json_response($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function handle_cors() {
    // Minimal same-origin CORS handling
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

function rate_limit($key, $limit, $window) {
    $dir = '/tmp/earthsar_rate/';
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = $dir . md5($ip . '_' . $key) . '.json';
    
    $now = time();
    $data = [];
    
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true);
        if (!is_array($data)) $data = [];
    }
    
    // Cleanup old entries
    $data = array_filter($data, function($timestamp) use ($now, $window) {
        return $timestamp > ($now - $window);
    });
    
    if (count($data) >= $limit) {
        json_response(['error' => 'Rate limit exceeded'], 429);
    }
    
    $data[] = $now;
    file_put_contents($file, json_encode(array_values($data)));
}

function get_request_method() {
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'POST') {
        if (isset($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'])) {
            $method = strtoupper($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']);
        } elseif (isset($_POST['_method'])) {
            $method = strtoupper($_POST['_method']);
        } else {
            $input = json_decode(file_get_contents('php://input'), true);
            if (is_array($input) && isset($input['_method'])) {
                $method = strtoupper($input['_method']);
            }
        }
    }
    return $method;
}

try {
    handle_cors();
    header('Cache-Control: no-cache, must-revalidate, max-age=0');
    
    $method = get_request_method();
    
    // Parse path
    $request_uri = $_SERVER['REQUEST_URI'] ?? '/';
    $path = parse_url($request_uri, PHP_URL_PATH);
    // Strip trailing slash
    $path = rtrim($path, '/');
    if (empty($path)) $path = '/';
    
    // Only handle /api/ routes
    if (strpos($path, '/api') !== 0) {
        // Not an API route, this shouldn't happen if routed correctly, but just in case
        json_response(['error' => 'Not found'], 404);
    }

    // Health check
    if ($method === 'GET' && $path === '/api/health') {
        json_response(['ok' => true]);
    }

    // Determine handler
    if (strpos($path, '/api/admin') === 0) {
        require_once __DIR__ . '/admin_routes.php';
        
        require_once __DIR__ . '/auth.php';
        // Ensure auth for non-login routes
        if ($path !== '/api/admin/login' && $path !== '/api/admin/logout') {
            $current_admin = require_admin();
        }
        
        if ($method === 'POST' && $path === '/api/admin/login') {
            rate_limit('admin_login', 10, 900); // 10 per 15 min
            admin_login();
        } elseif ($method === 'POST' && $path === '/api/admin/logout') {
            admin_logout();
        } elseif ($method === 'GET' && $path === '/api/admin/me') {
            admin_me();
        } elseif ($method === 'PATCH' && $path === '/api/admin/profile') {
            admin_profile();
        } elseif ($method === 'POST' && $path === '/api/admin/password') {
            admin_password();
        } elseif ($method === 'GET' && $path === '/api/admin/stats') {
            admin_stats();
        } elseif ($method === 'GET' && $path === '/api/admin/settings') {
            admin_get_settings();
        } elseif ($method === 'PATCH' && $path === '/api/admin/settings') {
            admin_patch_settings();
        } elseif ($method === 'GET' && $path === '/api/admin/reviews') {
            admin_get_reviews();
        } elseif ($method === 'PATCH' && preg_match('#^/api/admin/reviews/(\d+)$#', $path, $matches)) {
            admin_patch_review($matches[1]);
        } elseif ($method === 'POST' && preg_match('#^/api/admin/reviews/(\d+)/remove-media$#', $path, $matches)) {
            admin_remove_media($matches[1]);
        } elseif ($method === 'DELETE' && preg_match('#^/api/admin/reviews/(\d+)$#', $path, $matches)) {
            admin_delete_review($matches[1]);
        } elseif ($method === 'GET' && $path === '/api/admin/gallery') {
            admin_get_gallery();
        } elseif ($method === 'POST' && $path === '/api/admin/gallery') {
            admin_post_gallery();
        } elseif ($method === 'POST' && $path === '/api/admin/gallery/upload') {
            admin_upload_gallery();
        } elseif ($method === 'PATCH' && preg_match('#^/api/admin/gallery/(\d+)$#', $path, $matches)) {
            admin_patch_gallery($matches[1]);
        } elseif ($method === 'POST' && $path === '/api/admin/gallery/reorder') {
            admin_reorder_gallery();
        } elseif ($method === 'DELETE' && preg_match('#^/api/admin/gallery/(\d+)$#', $path, $matches)) {
            admin_delete_gallery($matches[1]);
        } elseif ($method === 'GET' && $path === '/api/admin/enquiries') {
            admin_get_enquiries();
        } elseif ($method === 'PATCH' && preg_match('#^/api/admin/enquiries/(\d+)$#', $path, $matches)) {
            admin_patch_enquiry($matches[1]);
        } elseif ($method === 'DELETE' && preg_match('#^/api/admin/enquiries/(\d+)$#', $path, $matches)) {
            admin_delete_enquiry($matches[1]);
        } else {
            json_response(['error' => 'Route not found'], 404);
        }
    } else {
        require_once __DIR__ . '/public_routes.php';
        
        if ($method === 'GET' && $path === '/api/reviews') {
            get_reviews();
        } elseif ($method === 'POST' && $path === '/api/reviews') {
            rate_limit('post_review', 5, 3600); // 5 per hour
            post_review();
        } elseif ($method === 'GET' && $path === '/api/gallery') {
            get_gallery();
        } elseif ($method === 'GET' && $path === '/api/settings') {
            get_settings();
        } elseif ($method === 'POST' && $path === '/api/enquiries') {
            rate_limit('post_enquiry', 10, 3600); // 10 per hour
            post_enquiry();
        } else {
            json_response(['error' => 'Route not found'], 404);
        }
    }
} catch (Exception $e) {
    error_log($e->getMessage());
    json_response(['error' => 'Internal Server Error', 'message' => $e->getMessage()], 500);
}
