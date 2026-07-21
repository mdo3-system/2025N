# STRIPE_REBUILD_MEMO.md - Stripeサブスク再構築および決済連携 引継ぎメモ

本ドキュメントは、本アプリケーション（`2025.eie.jp`）におけるStripe決済・サブスクリプション機能の将来的な再構築時に必要となる設定項目および実装要件をまとめたメモである。

---

## 1. 概要
- **現状**: Stripe連携は一度クリアし、マジックリンクによるユーザー認証および手動無料/無償利用が可能な状態となっている。
- **目的**: 将来的にStripeアカウントの再申請完了後、月額・年額サブスクリプションおよびカスタマーポータル機能を本システムに接続する。

---

## 2. 再構築時に必要なStripe側設定項目

1. **Stripe API キー発行**:
   - `STRIPE_PUBLISHABLE_KEY` (公開可能キー: `pk_live_...` または `pk_test_...`)
   - `STRIPE_SECRET_KEY` (シークレットキー: `sk_live_...` または `sk_test_...`)
   - `STRIPE_WEBHOOK_SECRET` (Webhook署名ヘッダー検証キー: `whsec_...`)

2. **商品および価格 (Products & Prices)**:
   - 月額プラン Price ID (例: `price_1N...`)
   - 年額プラン Price ID (例: `price_1N...`)

3. **Webhook エンドポイント設定**:
   - URL: `https://2025.eie.jp/api/stripe_webhook.php`
   - イベント一覧:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

4. **Stripe Customer Portal（カスタマーポータル）**:
   - リダイレクト設定: `https://2025.eie.jp/portal.php` からStripe側ポータルへリダイレクト
   - ポータル機能: クレジットカード変更、解約、領収書ダウンロードの許可設定

---

## 3. システム側必要テーブル拡張 (subscriptions)

`setup_database.php` に以下テーブルを追加・拡張する：

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    stripe_customer_id VARCHAR(255) NOT NULL,
    stripe_subscription_id VARCHAR(255) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'inactive', -- active, trialing, canceled, past_due
    current_period_end DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 4. 認証チェックAPI (`api/check_auth.php`) の拡張要件

サブスク有料チェックを有効化する際は、`api/check_auth.php` および各計算API (`api_wall_4split.php`) にて：

```php
// 例: アクティブなサブスクリプションを保有しているか確認
$stmt = $pdo->prepare("SELECT status FROM subscriptions WHERE user_id = ? AND status IN ('active', 'trialing')");
```

上記チェックを挟むことで、サブスク未契約ユーザーを支払い画面（`checkout.php`）へ誘導する仕組みが完成する。
