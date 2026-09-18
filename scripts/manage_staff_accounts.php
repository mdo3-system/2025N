<?php
/**
 * scripts/manage_staff_accounts.php
 * - ダミーアドレスの削除
 * - 社内スタッフ用 永久無償アカウント（eie@ymail.ne.jp, sato@t-smile.co.jp）の登録・設定
 */

require_once __DIR__ . '/../config/db.php';

$pdo = getPDOConnection();

echo "=== アカウント整理・社内永久無償設定 開始 ===\n\n";

// 1. ダミーアドレスの削除
$dummyEmails = [
    'staff1@eie.jp',
    'staff2@eie.jp',
    'info@2025.eie.jp'
];

foreach ($dummyEmails as $email) {
    // 該当ユーザーIDの取得
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $u = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($u) {
        $uid = $u['id'];
        $pdo->prepare("DELETE FROM subscriptions WHERE user_id = ?")->execute([$uid]);
        $pdo->prepare("DELETE FROM sessions WHERE user_id = ?")->execute([$uid]);
        $pdo->prepare("DELETE FROM magic_tokens WHERE email = ?")->execute([$email]);
        $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$uid]);
        echo "🗑️ ダミーアカウント削除完了: {$email} (User ID: {$uid})\n";
    } else {
        echo "ℹ️ ダミーアカウント未検出（すでに削除済み）: {$email}\n";
    }
}

echo "\n--- 社内スタッフ永久無償権限の付与 ---\n";

// 2. 社内スタッフ用アカウントの設定
$targetStaffEmails = [
    'eie@ymail.ne.jp',
    'sato@t-smile.co.jp'
];

foreach ($targetStaffEmails as $email) {
    $email = trim($email);

    // users テーブルの登録/更新
    $stmt = $pdo->prepare("
        INSERT INTO users (email, status, created_at, last_login_at)
        VALUES (?, 'active', NOW(), NOW())
        ON DUPLICATE KEY UPDATE status = 'active'
    ");
    $stmt->execute([$email]);

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    $userId = $user['id'];

    $customerPlaceholder = 'cus_staff_permanent_' . $userId;
    $subPlaceholder      = 'sub_staff_permanent_' . $userId;

    // 既存サブスクリプションを一旦整理して永久無償を確実に設定
    $stmt = $pdo->prepare("DELETE FROM subscriptions WHERE user_id = ?");
    $stmt->execute([$userId]);

    $stmt = $pdo->prepare("
        INSERT INTO subscriptions (user_id, plan_key, stripe_customer_id, stripe_subscription_id, status, current_period_end, created_at, updated_at)
        VALUES (?, 'free_permanent', ?, ?, 'active', '2099-12-31 23:59:59', NOW(), NOW())
    ");
    $stmt->execute([$userId, $customerPlaceholder, $subPlaceholder]);

    echo "✅ 社内永久無償アカウント設定完了: {$email} (User ID: {$userId} | Plan: free_permanent | 有効期限: 2099-12-31)\n";
}

echo "\n=== 現在の登録ユーザー一覧 ===\n";
$stmt = $pdo->query("
    SELECT u.id, u.email, u.status AS user_status, sub.plan_key, sub.status AS sub_status, sub.current_period_end 
    FROM users u 
    LEFT JOIN subscriptions sub ON u.id = sub.user_id 
    ORDER BY u.id ASC
");
while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo sprintf(
        "ID: %d | Email: %s | User: %s | Plan: %s | SubStatus: %s | Expire: %s\n",
        $r['id'],
        $r['email'],
        $r['user_status'],
        $r['plan_key'] ?? 'none',
        $r['sub_status'] ?? 'none',
        $r['current_period_end'] ?? 'none'
    );
}

echo "\n=== 処理が正常に完了しました ===\n";
