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
        SELECT u.id, u.email, sub.plan_key, sub.status AS sub_status, sub.current_period_end 
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        LEFT JOIN subscriptions sub ON u.id = sub.user_id 
        WHERE s.session_token = ? AND s.expires_at > NOW() 
        LIMIT 1
    ");
    $stmt->execute([$sessionToken]);
    $user = $stmt->fetch();

    if ($user) {
        $hasActiveSub = !empty($user['sub_status']) && in_array($user['sub_status'], ['active', 'trialing']);
        echo json_encode([
            'authenticated' => true,
            'user' => [
                'id'    => $user['id'],
                'email' => $user['email']
            ],
            'subscription' => [
                'has_active'         => $hasActiveSub,
                'plan_key'           => $user['plan_key'] ?? null,
                'status'             => $user['sub_status'] ?? 'inactive',
                'current_period_end' => $user['current_period_end'] ?? null
            ]
        ]);
    } else {
        echo json_encode(['authenticated' => false]);
    }

} catch (Exception $e) {
    echo json_encode(['authenticated' => false, 'error' => $e->getMessage()]);
}
