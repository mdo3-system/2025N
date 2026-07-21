<?php
/**
 * config/db.php - PDO データベース接続設定
 * 2025.eie.jp 運用用
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'mdo3_2025');
define('DB_USER', 'mdo3_toolapp0001');
define('DB_PASS', 'koki2656@');
define('DB_CHARSET', 'utf8mb4');

function getPDOConnection() {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    try {
        return new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (\PDOException $e) {
        throw new \PDOException($e->getMessage(), (int)$e->getCode());
    }
}
