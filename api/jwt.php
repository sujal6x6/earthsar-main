<?php
// jwt.php
function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    $padded = str_pad($data, strlen($data) + (4 - strlen($data) % 4) % 4, '=', STR_PAD_RIGHT);
    return base64_decode(strtr($padded, '-_', '+/'), true);
}

function jwt_encode($payload, $secret) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $base64UrlHeader = base64url_encode($header);
    $base64UrlPayload = base64url_encode(json_encode($payload));
    
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
    $base64UrlSignature = base64url_encode($signature);
    
    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

function jwt_decode($token, $secret) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }
    
    list($base64UrlHeader, $base64UrlPayload, $base64UrlSignature) = $parts;
    
    $header = json_decode(base64url_decode($base64UrlHeader) ?: '', true);
    if (!is_array($header) || ($header['alg'] ?? '') !== 'HS256') return null;
    $signature = base64url_decode($base64UrlSignature);
    if ($signature === false) return null;
    $expectedSignature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
    
    if (!hash_equals($expectedSignature, $signature)) {
        return null;
    }
    
    $payload = json_decode(base64url_decode($base64UrlPayload), true);
    
    if (!is_array($payload) || !isset($payload['sub'], $payload['v'], $payload['exp']) || !is_numeric($payload['exp']) || $payload['exp'] <= time()) {
        return null; // Expired
    }
    
    return $payload;
}
