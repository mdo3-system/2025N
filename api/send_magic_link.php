<?php
/**
 * api/send_magic_link.php - マジックリンク生成＆メール送信API
 * 送信元: noreply@2025.eie.jp
 */

header('Content-Type: application/json; charset=UTF-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

require_once __DIR__ . '/../config/db.php';

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);

$email = trim($data['email'] ?? '');

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => '有効なメールアドレスを入力してください。']);
    exit;
}

try {
    $pdo = getPDOConnection();

    // トークン生成 (64文字)
    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+15 minutes'));

    // DBへ保存
    $stmt = $pdo->prepare("INSERT INTO magic_tokens (email, token, expires_at) VALUES (?, ?, ?)");
    $stmt->execute([$email, $token, $expiresAt]);

    // ログインURL
    $loginUrl = "https://2025.eie.jp/login.php?token=" . urlencode($token);

    // メール送信 (noreply@2025.eie.jp)
    $subject = "【上善如水 構造計算WEB】ログインマジックリンクのご案内";
    $message = "上善如水 構造計算WEB をご利用いただきありがとうございます。\n\n";
    $message .= "以下のリンクをクリックしてログインを完了してください。（有効期限: 15分）\n\n";
    $message .= $loginUrl . "\n\n";
    $message .= "※本メールに心当たりがない場合は破棄してください。\n";

    $headers = [];
    $headers[] = 'From: 上善如水 事務局 <noreply@2025.eie.jp>';
    $headers[] = 'Reply-To: noreply@2025.eie.jp';
    $headers[] = 'X-Mailer: PHP/' . phpversion();
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';

    // 日本語メール送信処理
    mb_language("Japanese");
    mb_internal_encoding("UTF-8");
    
    $sent = mb_send_mail($email, $subject, $message, implode("\r\n", $headers));

    echo json_encode([
        'success' => true,
        'message' => 'ログイン用マジックリンクを ' . $email . ' へ送信いたしました。メールをご確認ください。'
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'エラーが発生しました: ' . $e->getMessage()]);
}
