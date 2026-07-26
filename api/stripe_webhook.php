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
    }

    http_response_code(200);
    echo json_encode(['status' => 'success', 'event' => $eventType]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
