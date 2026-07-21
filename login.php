<?php
/**
 * login.php - マジックリンクトークン検証・セッション発行スクリプト
 */

require_once __DIR__ . '/config/db.php';

$token = trim($_GET['token'] ?? '');

if (empty($token)) {
    header('Location: /index.html?auth_error=missing_token');
    exit;
}

try {
    $pdo = getPDOConnection();

    // トークンの検索
    $stmt = $pdo->prepare("SELECT * FROM magic_tokens WHERE token = ? AND used = 0 AND expires_at > NOW() LIMIT 1");
    $stmt->execute([$token]);
    $tokenRow = $stmt->fetch();

    if (!$tokenRow) {
        header('Location: /index.html?auth_error=invalid_or_expired_token');
        exit;
    }

    $email = $tokenRow['email'];

    // 1. トークンを使用済みにマーク
    $stmt = $pdo->prepare("UPDATE magic_tokens SET used = 1 WHERE id = ?");
    $stmt->execute([$tokenRow['id']]);

    // 2. ユーザーの存在確認 / 新規作成
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        $stmt = $pdo->prepare("INSERT INTO users (email, last_login_at) VALUES (?, NOW())");
        $stmt->execute([$email]);
        $userId = $pdo->lastInsertId();
    } else {
        $userId = $user['id'];
        $stmt = $pdo->prepare("UPDATE users SET last_login_at = NOW() WHERE id = ?");
        $stmt->execute([$userId]);
    }

    // 3. セッションの作成 (30日間有効)
    $sessionToken = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));

    $stmt = $pdo->prepare("INSERT INTO sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)");
    $stmt->execute([$sessionToken, $userId, $expiresAt]);

    // 4. Cookie の発行 (30日間)
    setcookie('auth_session', $sessionToken, [
        'expires'  => time() + (86400 * 30),
        'path'     => '/',
        'domain'   => '', // 2025.eie.jp
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    // 5. ログイン完了でトップページ (index.html) へリダイレクト
    header('Location: /index.html?auth=success');
    exit;

} catch (Exception $e) {
    header('Location: /index.html?auth_error=server_error');
    exit;
}
