<?php
/**
 * api/create_portal_session.php - Stripe Customer Portal Session 発行 API
 */

header('Content-Type: application/json; charset=UTF-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Credentials: true");

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/stripe.php';

$sessionToken = $_COOKIE['auth_session'] ?? '';

if (empty($sessionToken)) {
    echo json_encode(['success' => false, 'error' => 'unauthorized', 'message' => 'ログインが必要です。']);
    exit;
}

try {
    $pdo = getPDOConnection();

    // ユーザーおよび Stripe Customer ID の取得
    $stmt = $pdo->prepare("
        SELECT u.id, u.email, sub.stripe_customer_id 
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        LEFT JOIN subscriptions sub ON u.id = sub.user_id 
        WHERE s.session_token = ? AND s.expires_at > NOW() 
        LIMIT 1
    ");
    $stmt->execute([$sessionToken]);
    $row = $stmt->fetch();

    if (!$row) {
        echo json_encode(['success' => false, 'error' => 'unauthorized', 'message' => 'セッションが無効です。']);
        exit;
    }

    $customerId = $row['stripe_customer_id'] ?? '';

    if (empty($customerId)) {
        echo json_encode(['success' => false, 'error' => 'no_customer', 'message' => '有効な Stripe 顧客情報が見つかりません。料金プランをご購入ください。']);
        exit;
    }

    $secretKey = STRIPE_SECRET_KEY;

    // Stripe Customer Portal Session の発行
    $ch = curl_init('https://api.stripe.com/v1/billing_portal/sessions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, $secretKey . ':');
    curl_setopt($ch, CURLOPT_POST, true);

    $postData = [
        'customer'   => $customerId,
        'return_url' => 'https://2025.eie.jp/portal.php'
    ];

    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $resData = json_decode($response, true);

    if ($httpCode === 200 && isset($resData['url'])) {
        echo json_encode([
            'success' => true,
            'url'     => $resData['url']
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error'   => 'stripe_api_error',
            'details' => $resData['error']['message'] ?? 'Customer Portalの作成に失敗しました。'
        ]);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'server_error', 'message' => $e->getMessage()]);
}
