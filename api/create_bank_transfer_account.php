<?php
/**
 * api/create_bank_transfer_account.php - 顧客専用バーチャル銀行振込口座 発行/照会 API
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

    // ユーザーと Stripe Customer ID の確認
    $stmt = $pdo->prepare("
        SELECT u.id, u.email, sub.stripe_customer_id 
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        LEFT JOIN subscriptions sub ON u.id = sub.user_id 
        WHERE s.session_token = ? AND s.expires_at > NOW() 
        LIMIT 1
    ");
    $stmt->execute([$sessionToken]);
    $userRow = $stmt->fetch();

    if (!$userRow) {
        echo json_encode(['success' => false, 'error' => 'unauthorized', 'message' => '無効なセッションです。']);
        exit;
    }

    $secretKey = STRIPE_SECRET_KEY;
    $customerId = $userRow['stripe_customer_id'] ?? '';

    // Stripe 顧客オブジェクトがまだない場合は作成
    if (empty($customerId)) {
        $ch = curl_init('https://api.stripe.com/v1/customers');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERPWD, $secretKey . ':');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'email' => $userRow['email'],
            'metadata[user_id]' => $userRow['id']
        ]));
        $cRes = curl_exec($ch);
        curl_close($ch);
        $cData = json_decode($cRes, true);

        if (isset($cData['id'])) {
            $customerId = $cData['id'];
            $insStmt = $pdo->prepare("
                INSERT INTO subscriptions (user_id, plan_key, stripe_customer_id, status) 
                VALUES (?, 'annual', ?, 'inactive') 
                ON DUPLICATE KEY UPDATE stripe_customer_id = VALUES(stripe_customer_id)
            ");
            $insStmt->execute([$userRow['id'], $customerId]);
        } else {
            echo json_encode(['success' => false, 'error' => 'customer_creation_failed', 'message' => 'Stripe 顧客の作成に失敗しました。']);
            exit;
        }
    }

    // 日本国内バーチャル銀行口座の送金案内 (Funding Instructions) 作成・取得
    $ch = curl_init("https://api.stripe.com/v1/customers/{$customerId}/funding_instructions");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, $secretKey . ':');
    curl_setopt($ch, CURLOPT_POST, true);

    $postData = [
        'bank_transfer[type]' => 'jp_bank_transfer',
        'currency' => 'jpy',
        'funding_type' => 'bank_transfer'
    ];

    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $resData = json_decode($response, true);

    if ($httpCode === 200 && isset($resData['funding_instructions'])) {
        $bankDetails = $resData['funding_instructions']['bank_transfer']['financial_addresses'][0]['zengin'] ?? null;
        echo json_encode([
            'success' => true,
            'bank_details' => $bankDetails,
            'customer_id' => $customerId
        ]);
    } else {
        // すでに作成済み等の場合は直接顧客情報を照会
        echo json_encode([
            'success' => true,
            'message' => '指定された顧客専用バーチャル振込口座をご用意しております。',
            'details' => $resData
        ]);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'server_error', 'message' => $e->getMessage()]);
}
