<?php
/**
 * setup_database.php - Xサーバー用 データベース自動初期化・テーブル構築スクリプト
 * 実行コマンド: php setup_database.php
 */

require_once __DIR__ . '/config/db.php';

try {
    $pdo = getPDOConnection();
    echo "Database connection successful.\n";

    // 1. users テーブル
    $sqlUsers = "
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        status VARCHAR(50) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME NULL,
        INDEX idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ";
    $pdo->exec($sqlUsers);
    echo "Table 'users' verified/created.\n";

    // 2. magic_tokens テーブル
    $sqlMagicTokens = "
    CREATE TABLE IF NOT EXISTS magic_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(128) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token (token),
        INDEX idx_email_expires (email, expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ";
    $pdo->exec($sqlMagicTokens);
    echo "Table 'magic_tokens' verified/created.\n";

    // 3. sessions テーブル
    $sqlSessions = "
    CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_token VARCHAR(128) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_session_token (session_token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ";
    $pdo->exec($sqlSessions);
    echo "Table 'sessions' verified/created.\n";

    echo "ALL TABLES SET UP SUCCESSFULLY.\n";

} catch (Exception $e) {
    echo "Error setting up database: " . $e->getMessage() . "\n";
    exit(1);
}
