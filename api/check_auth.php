<?php
/**
 * api/check_auth.php - ログイン状態確認API
 */

header('Content-Type: application/json; charset=UTF-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Credentials: true");

require_once __DIR__ . '/../config/db.php';

$sessionToken = $_COOKIE['auth_session'] ?? '';

if (empty($sessionToken)) {
    echo json_encode(['authenticated' => false]);
    exit;
}

try {
    $pdo = getPDOConnection();

    $stmt = $pdo->prepare("
        SELECT u.id, u.email 
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.session_token = ? AND s.expires_at > NOW() 
        LIMIT 1
    ");
    $stmt->execute([$sessionToken]);
    $user = $stmt->fetch();

    if ($user) {
        echo json_encode([
            'authenticated' => true,
            'user' => [
                'id'    => $user['id'],
                'email' => $user['email']
            ]
        ]);
    } else {
        echo json_encode(['authenticated' => false]);
    }

} catch (Exception $e) {
    echo json_encode(['authenticated' => false, 'error' => $e->getMessage()]);
}
