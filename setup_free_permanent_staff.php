<?php
/**
 * setup_free_permanent_staff.php - 社内スタッフ用 永久無償アカウント一括登録スクリプト
 * 実行方法: php setup_free_permanent_staff.php
 */

require_once __DIR__ . '/config/db.php';

// 社内スタッフ3名様のメールアドレス一覧 (環境変数 STAFF_EMAILS または本配列で指定)
$staffEmailsEnv = getenv('STAFF_EMAILS');
if (!empty($staffEmailsEnv)) {
    $staffEmails = array_map('trim', explode(',', $staffEmailsEnv));
} else {
    $staffEmails = [
        'staff1@eie.jp',
        'staff2@eie.jp',
        'info@2025.eie.jp'
    ];
}

echo "=== 社内スタッフ用 永久無償アカウント一括登録開始 ===\n";

try {
    $pdo = getPDOConnection();

    foreach ($staffEmails as $email) {
        $email = trim($email);
        if (empty($email)) continue;

        // 1. users テーブルへの登録/更新
        $stmt = $pdo->prepare("
            INSERT INTO users (email, status, created_at, last_login_at)
            VALUES (?, 'active', NOW(), NOW())
            ON DUPLICATE KEY UPDATE status = 'active'
        ");
        $stmt->execute([$email]);

        // user_id の取得
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            echo "❌ Failed to fetch user_id for {$email}\n";
            continue;
        }

        $userId = $user['id'];
        $customerPlaceholder = 'cus_staff_permanent_' . $userId;
        $subPlaceholder      = 'sub_staff_permanent_' . $userId;

        // 2. subscriptions テーブルへの永久無償権限付与 (2099年まで有効)
        $stmt = $pdo->prepare("
            INSERT INTO subscriptions (user_id, plan_key, stripe_customer_id, stripe_subscription_id, status, current_period_end, created_at, updated_at)
            VALUES (?, 'free_permanent', ?, ?, 'active', '2099-12-31 23:59:59', NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                plan_key = 'free_permanent',
                status = 'active',
                current_period_end = '2099-12-31 23:59:59',
                updated_at = NOW()
        ");
        $stmt->execute([$userId, $customerPlaceholder, $subPlaceholder]);

        echo "✅ 社内スタッフ登録完了: {$email} (User ID: {$userId} | Plan: free_permanent | 有効期限: 2099-12-31)\n";
    }

    echo "=== 全社内スタッフの永久無償設定が完了しました ===\n";

} catch (Exception $e) {
    echo "❌ エラーが発生しました: " . $e->getMessage() . "\n";
    exit(1);
}
