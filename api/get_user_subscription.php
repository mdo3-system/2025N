<?php
/**
 * api/get_user_subscription.php - 【方式A】販売管理ポータル用 顧客契約照会 API
 */

header('Content-Type: application/json; charset=UTF-8');
header("Access-Control-Allow-Origin: *");

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/stripe.php';

// X-API-KEY 認証チェック
$providedApiKey = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['api_key'] ?? '';
$expectedApiKey = API_SECRET_KEY;

if (empty($providedApiKey) || !hash_equals($expectedApiKey, $providedApiKey)) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error'   => 'unauthorized',
        'message' => 'Invalid or missing API Secret Key (X-API-KEY).'
    ]);
    exit;
}

try {
    $pdo = getPDOConnection();
    $email = trim($_GET['email'] ?? '');
    $list  = trim($_GET['list'] ?? '');

    // 全顧客一覧の同期取得 (?list=all)
    if ($list === 'all') {
        $stmt = $pdo->query("
            SELECT u.id AS user_id, u.email, sub.plan_key, sub.status, sub.stripe_customer_id, sub.stripe_subscription_id, sub.current_period_end, sub.updated_at
            FROM users u
            LEFT JOIN subscriptions sub ON u.id = sub.user_id
            ORDER BY u.id DESC
        ");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $resultList = array_map(function($row) {
            $row['has_active_subscription'] = !empty($row['status']) && in_array($row['status'], ['active', 'trialing']);
            return $row;
        }, $users);

        echo json_encode([
            'success' => true,
            'count'   => count($resultList),
            'data'    => $resultList
        ]);
        exit;
    }

    // 単一顧客の契約照会 (?email=user@example.com)
    if (empty($email)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'invalid_request',
            'message' => 'Parameter "email" or "list=all" is required.'
        ]);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT u.id AS user_id, u.email, sub.plan_key, sub.status, sub.stripe_customer_id, sub.stripe_subscription_id, sub.current_period_end, sub.updated_at
        FROM users u
        LEFT JOIN subscriptions sub ON u.id = sub.user_id
        WHERE u.email = ?
        LIMIT 1
    ");
    $stmt->execute([$email]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        $hasActive = !empty($row['status']) && in_array($row['status'], ['active', 'trialing']);
        echo json_encode([
            'success'                 => true,
            'user_id'                 => (int)$row['user_id'],
            'email'                   => $row['email'],
            'has_active_subscription' => $hasActive,
            'plan_key'                => $row['plan_key'] ?? null,
            'status'                  => $row['status'] ?? 'inactive',
            'stripe_customer_id'      => $row['stripe_customer_id'] ?? null,
            'stripe_subscription_id'  => $row['stripe_subscription_id'] ?? null,
            'current_period_end'      => $row['current_period_end'] ?? null,
            'updated_at'              => $row['updated_at'] ?? null
        ]);
    } else {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'user_not_found',
            'message' => "User with email '{$email}' was not found."
        ]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'server_error',
        'message' => $e->getMessage()
    ]);
}
