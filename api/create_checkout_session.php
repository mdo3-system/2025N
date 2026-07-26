<?php
/**
 * api/create_checkout_session.php - Stripe Checkout Session 発行 API
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

$planKey = $_GET['plan'] ?? $_POST['plan'] ?? 'monthly_std';
global $STRIPE_PLANS;

if (!isset($STRIPE_PLANS[$planKey])) {
    echo json_encode(['success' => false, 'error' => 'invalid_plan', 'message' => '無効な料金プランが指定されました。']);
    exit;
}

$targetPlan = $STRIPE_PLANS[$planKey];

try {
    $pdo = getPDOConnection();

    // ログイン中ユーザーの検索
    $stmt = $pdo->prepare("
        SELECT u.id, u.email 
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.session_token = ? AND s.expires_at > NOW() 
        LIMIT 1
    ");
    $stmt->execute([$sessionToken]);
    $user = $stmt->fetch();

    if (!$user) {
        echo json_encode(['success' => false, 'error' => 'unauthorized', 'message' => 'セッションが無効です。再ログインしてください。']);
        exit;
    }

    $secretKey = STRIPE_SECRET_KEY;

    // cURL を用いた Stripe API 呼び出し (Checkout Session 作成)
    $ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, $secretKey . ':');
    curl_setopt($ch, CURLOPT_POST, true);

    $postData = [
        'mode' => 'subscription',
        'customer_email' => $user['email'],
        'client_reference_id' => $user['id'],
        'success_url' => 'https://2025.eie.jp/portal.php?session_id={CHECKOUT_SESSION_ID}&payment=success',
        'cancel_url'  => 'https://2025.eie.jp/pricing.html?payment=canceled',
        'line_items[0][price]' => $targetPlan['price_id'],
        'line_items[0][quantity]' => 1,
        'metadata[user_id]' => $user['id'],
        'metadata[plan_key]' => $planKey
    ];

    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $resData = json_decode($response, true);

    if ($httpCode === 200 && isset($resData['url'])) {
        echo json_encode([
            'success'     => true,
            'url'         => $resData['url'],
            'session_id'  => $resData['id']
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error'   => 'stripe_api_error',
            'details' => $resData['error']['message'] ?? 'Stripe Session作成に失敗しました。'
        ]);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'server_error', 'message' => $e->getMessage()]);
}
