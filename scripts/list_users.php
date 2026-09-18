<?php
require_once __DIR__ . '/../config/db.php';

$pdo = getPDOConnection();
$stmt = $pdo->query("
    SELECT u.id, u.email, u.status AS user_status, sub.plan_key, sub.status AS sub_status, sub.current_period_end 
    FROM users u 
    LEFT JOIN subscriptions sub ON u.id = sub.user_id 
    ORDER BY u.id ASC
");

echo "=== 登録ユーザー一覧 ===\n";
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
