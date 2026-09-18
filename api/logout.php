<?php
/**
 * api/logout.php - ログアウトAPI
 * セッションCookieおよびDBセッションを安全に消去する
 */

header('Content-Type: application/json; charset=UTF-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Credentials: true");

require_once __DIR__ . '/../config/db.php';

$sessionToken = $_COOKIE['auth_session'] ?? '';

if (!empty($sessionToken)) {
    try {
        $pdo = getPDOConnection();
        $stmt = $pdo->prepare("DELETE FROM sessions WHERE session_token = ?");
        $stmt->execute([$sessionToken]);
    } catch (Exception $e) {
        // エラーログ記録（Cookie消去は続行）
        error_log("Logout error: " . $e->getMessage());
    }
}

// Cookieの消去
$hostDomain = isset($_SERVER['HTTP_HOST']) ? preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST']) : '2025.eie.jp';
setcookie('auth_session', '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'domain'   => $hostDomain,
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'Lax'
]);

echo json_encode(['success' => true, 'message' => 'ログアウトしました。']);
