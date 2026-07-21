<?php
/**
 * api/send_magic_link.php - マジックリンク生成＆メール送信API
 * 送信元: noreply@2025.eie.jp
 * 文字化け防止対策 (MIME Header & ISO-2022-JP / UTF-8 エンコーディング適用)
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

    // 件名と本文の定義
    $subjectText = "【上善如水 構造計算WEB】ログインマジックリンクのご案内";
    $messageText = "上善如水 構造計算WEB をご利用いただきありがとうございます。\r\n\r\n";
    $messageText .= "以下のリンクをクリックしてログインを完了してください。（有効期限: 15分）\r\n\r\n";
    $messageText .= $loginUrl . "\r\n\r\n";
    $messageText .= "※本メールに心当たりがない場合は破棄してください。\r\n";

    // 文字エンコーディング環境の設定 (ISO-2022-JP 日本標準メール規格)
    mb_language("Japanese");
    mb_internal_encoding("UTF-8");

    // 件名・差出人名の MIME ヘッダーエンコード (JIS)
    $subjectEncoded = mb_encode_mimeheader($subjectText, "ISO-2022-JP", "B");
    $fromNameEncoded = mb_encode_mimeheader("上善如水 事務局", "ISO-2022-JP", "B");

    // 本文を ISO-2022-JP へ変換
    $messageBody = mb_convert_encoding($messageText, "ISO-2022-JP", "UTF-8");

    $headers = [];
    $headers[] = "From: {$fromNameEncoded} <noreply@2025.eie.jp>";
    $headers[] = "Reply-To: noreply@2025.eie.jp";
    $headers[] = "MIME-Version: 1.0";
    $headers[] = "Content-Type: text/plain; charset=ISO-2022-JP";
    $headers[] = "Content-Transfer-Encoding: 7bit";
    $headers[] = "X-Mailer: PHP/" . phpversion();

    // エンベロープFrom (-f パラメータ) を指定して mail() で確実に送信
    $mailSent = mail($email, $subjectEncoded, $messageBody, implode("\r\n", $headers), "-f noreply@2025.eie.jp");

    if ($mailSent) {
        echo json_encode([
            'success' => true,
            'message' => 'ログイン用マジックリンクを ' . $email . ' へ送信いたしました。メールをご確認ください。'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'メール送信に失敗しました。サーバー設定をご確認ください。']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'エラーが発生しました: ' . $e->getMessage()]);
}
