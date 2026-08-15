<?php
require_once __DIR__ . '/config/db.php';
try {
    $pdo = getPDOConnection();
    echo "DB_OK\n";
    $r = $pdo->query("SELECT email FROM users LIMIT 5");
    foreach ($r as $row) { echo "USER: " . $row['email'] . "\n"; }
    $s = $pdo->query("SELECT COUNT(*) as cnt FROM sessions WHERE expires_at > NOW()");
    $sc = $s->fetch();
    echo "ACTIVE_SESSIONS: " . $sc['cnt'] . "\n";
    $m = $pdo->query("SELECT COUNT(*) as cnt FROM magic_tokens WHERE used=0 AND expires_at > NOW()");
    $mc = $m->fetch();
    echo "ACTIVE_TOKENS: " . $mc['cnt'] . "\n";
} catch (Exception $e) {
    echo "DB_ERROR: " . $e->getMessage() . "\n";
}
