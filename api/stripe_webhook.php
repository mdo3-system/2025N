<?php
/**
 * api/stripe_webhook.php - Stripe Webhook 受信・DB同期 API
 */

header('Content-Type: application/json; charset=UTF-8');

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/stripe.php';

$payload = file_get_contents('php://input');
$sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

if (empty($payload)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Empty payload']);
    exit;
}

$event = json_decode($payload, true);

if (!$event || !isset($event['type'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON event']);
    exit;
}

try {
    $pdo = getPDOConnection();
    $eventType = $event['type'];
    $dataObject = $event['data']['object'] ?? [];

    switch ($eventType) {
        case 'checkout.session.completed':
            $userId     = $dataObject['metadata']['user_id'] ?? $dataObject['client_reference_id'] ?? null;
            $planKey    = $dataObject['metadata']['plan_key'] ?? 'monthly_std';
            $customerId = $dataObject['customer'] ?? '';
            $subId      = $dataObject['subscription'] ?? '';

            if ($userId) {
                // サブスクリプションレコードの登録/更新
                $stmt = $pdo->prepare("
                    INSERT INTO subscriptions (user_id, plan_key, stripe_customer_id, stripe_subscription_id, status, current_period_end)
                    VALUES (?, ?, ?, ?, 'active', DATE_ADD(NOW(), INTERVAL 1 MONTH))
                    ON DUPLICATE KEY UPDATE 
                        plan_key = VALUES(plan_key),
                        stripe_customer_id = VALUES(stripe_customer_id),
                        stripe_subscription_id = VALUES(stripe_subscription_id),
                        status = 'active',
                        updated_at = NOW()
                ");
                $stmt->execute([$userId, $planKey, $customerId, $subId]);
            }
            break;

        case 'customer.subscription.updated':
            $subId      = $dataObject['id'] ?? '';
            $status     = $dataObject['status'] ?? 'active'; // active, past_due, canceled
            $periodEnd  = isset($dataObject['current_period_end']) ? date('Y-m-d H:i:s', $dataObject['current_period_end']) : null;

            if ($subId) {
                $stmt = $pdo->prepare("
                    UPDATE subscriptions 
                    SET status = ?, current_period_end = ?, updated_at = NOW() 
                    WHERE stripe_subscription_id = ?
                ");
                $stmt->execute([$status, $periodEnd, $subId]);
            }
            break;

        case 'customer.subscription.deleted':
            $subId = $dataObject['id'] ?? '';

            if ($subId) {
                $stmt = $pdo->prepare("
                    UPDATE subscriptions 
                    SET status = 'canceled', updated_at = NOW() 
                    WHERE stripe_subscription_id = ?
                ");
                $stmt->execute([$subId]);
            }
            break;

        case 'invoice.payment_succeeded':
            $subId     = $dataObject['subscription'] ?? '';
            $periodEnd = isset($dataObject['lines']['data'][0]['period']['end']) ? date('Y-m-d H:i:s', $dataObject['lines']['data'][0]['period']['end']) : null;

            if ($subId && $periodEnd) {
                $stmt = $pdo->prepare("
                    UPDATE subscriptions 
                    SET status = 'active', current_period_end = ?, updated_at = NOW() 
                    WHERE stripe_subscription_id = ?
                ");
                $stmt->execute([$periodEnd, $subId]);
            }
            break;

        case 'payment_intent.succeeded':
            $customerId = $dataObject['customer'] ?? '';
            if ($customerId) {
                $stmt = $pdo->prepare("
                    UPDATE subscriptions 
                    SET status = 'active', updated_at = NOW() 
                    WHERE stripe_customer_id = ?
                ");
                $stmt->execute([$customerId]);
            }
            break;
    }

    // 販売管理ポータル (pr.eie.tokyo) への方式B リアルタイム Webhook 転送処理
    forwardToSalesPortal($eventType, $dataObject, $pdo);

    http_response_code(200);
    echo json_encode(['status' => 'success', 'event' => $eventType]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

/**
 * 販売管理ポータル (pr.eie.tokyo) への Webhook イベント転送関数 (方式B)
 * X-API-KEY ヘッダー認証 ＆ 最大3回リトライ ＆ エラーログ保存
 */
function forwardToSalesPortal($eventType, $dataObject, $pdo) {
    $targetUrl = SALES_PORTAL_WEBHOOK_URL;
    $apiKey    = API_SECRET_KEY;

    if (empty($targetUrl)) return;

    // ユーザー情報等の補完
    $customerId = $dataObject['customer'] ?? '';
    $userEmail  = $dataObject['customer_email'] ?? '';
    $userId     = $dataObject['metadata']['user_id'] ?? null;

    if (empty($userEmail) && $customerId && $pdo) {
        $stmt = $pdo->prepare("
            SELECT u.id, u.email 
            FROM subscriptions sub 
            JOIN users u ON sub.user_id = u.id 
            WHERE sub.stripe_customer_id = ? 
            LIMIT 1
        ");
        $stmt->execute([$customerId]);
        $u = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($u) {
            $userEmail = $u['email'];
            $userId    = $u['id'];
        }
    }

    $payload = [
        'event_type' => $eventType,
        'timestamp'  => date('c'),
        'data'       => [
            'user_id'                => $userId,
            'email'                  => $userEmail,
            'plan_key'               => $dataObject['metadata']['plan_key'] ?? null,
            'status'                 => $dataObject['status'] ?? 'active',
            'stripe_customer_id'     => $customerId,
            'stripe_subscription_id' => $dataObject['subscription'] ?? $dataObject['id'] ?? null,
            'current_period_end'     => isset($dataObject['current_period_end']) ? date('Y-m-d H:i:s', $dataObject['current_period_end']) : null,
            'raw_event'              => $dataObject
        ]
    ];

    $jsonPayload = json_encode($payload);
    $maxRetries  = 3;
    $success     = false;

    for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
        $ch = curl_init($targetUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'X-API-KEY: ' . $apiKey
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300) {
            $success = true;
            break;
        }

        usleep(500000); // 0.5秒待機後リトライ
    }

    if (!$success) {
        $logDir = __DIR__ . '/../logs';
        if (!is_dir($logDir)) {
            @mkdir($logDir, 0755, true);
        }
        $logFile = $logDir . '/webhook_forward_error.log';
        $logMessage = sprintf(
            "[%s] ERROR Forwarding event '%s' for email '%s' (HTTP Code: %s)\nPayload: %s\n\n",
            date('Y-m-d H:i:s'),
            $eventType,
            $userEmail,
            $httpCode ?? '0',
            $jsonPayload
        );
        @file_put_contents($logFile, $logMessage, FILE_APPEND);
    }
}
