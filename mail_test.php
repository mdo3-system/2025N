<?php
mb_language("Japanese");
mb_internal_encoding("UTF-8");
$to = "eie@ymail.ne.jp";
$subject = mb_encode_mimeheader("【テスト】マジックリンク送信テスト", "ISO-2022-JP", "B");
$body = mb_convert_encoding("これはメール送信テストです。\r\n正常に届いていれば mail() 関数は動作しています。", "ISO-2022-JP", "UTF-8");
$headers = implode("\r\n", [
    "From: noreply@2025.eie.jp",
    "Reply-To: noreply@2025.eie.jp",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=ISO-2022-JP",
    "Content-Transfer-Encoding: 7bit",
]);
$r = mail($to, $subject, $body, $headers, "-f noreply@2025.eie.jp");
echo $r ? "MAIL_OK: 送信成功\n" : "MAIL_FAIL: 送信失敗\n";
