<?php
require_once __DIR__ . '/config/db.php';
try {
    $pdo = getPDOConnection();
    // 有効セッション一覧
    $r = $pdo->query("SELECT s.session_token, u.email, s.expires_at FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.expires_at > NOW() ORDER BY s.expires_at DESC LIMIT 10");
    echo "=== 有効セッション ===\n";
    foreach ($r as $row) {
        echo "email: " . $row['email'] . " | token(先頭8): " . substr($row['session_token'], 0, 8) . "... | 有効期限: " . $row['expires_at'] . "\n";
    }
    // 最新magic_tokens
    $r2 = $pdo->query("SELECT email, token, expires_at, used FROM magic_tokens ORDER BY id DESC LIMIT 5");
    echo "\n=== 最新マジックトークン ===\n";
    foreach ($r2 as $row) {
        echo "email: " . $row['email'] . " | used: " . $row['used'] . " | 有効期限: " . $row['expires_at'] . "\n";
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
