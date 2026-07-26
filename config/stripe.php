<?php
/**
 * config/stripe.php - Stripe 決済・サブスクリプション 設定ファイル
 */

// Stripe API キー (環境変数または本ファイルで直接設定)
define('STRIPE_PUBLISHABLE_KEY', getenv('STRIPE_PUBLISHABLE_KEY') ?: 'pk_live_placeholder');
define('STRIPE_SECRET_KEY',      getenv('STRIPE_SECRET_KEY')      ?: 'sk_live_placeholder');
define('STRIPE_WEBHOOK_SECRET', getenv('STRIPE_WEBHOOK_SECRET')  ?: 'whsec_placeholder');

// Stripe 料金プラン Price ID 設定 (4プラン対応)
$STRIPE_PLANS = [
    'weekly' => [
        'name'     => '週額スポット',
        'price_id' => getenv('STRIPE_PRICE_WEEKLY') ?: 'price_weekly_spot_placeholder',
        'price'    => 1650,
        'interval' => 'week'
    ],
    'monthly_std' => [
        'name'     => '月額スタンダード',
        'price_id' => getenv('STRIPE_PRICE_MONTHLY_STD') ?: 'price_monthly_std_placeholder',
        'price'    => 5500,
        'interval' => 'month'
    ],
    'annual' => [
        'name'     => '年額プラン',
        'price_id' => getenv('STRIPE_PRICE_ANNUAL') ?: 'price_annual_placeholder',
        'price'    => 55000,
        'interval' => 'year'
    ],
    'monthly_prem' => [
        'name'     => '月額プレミアム(サポート付)',
        'price_id' => getenv('STRIPE_PRICE_MONTHLY_PREM') ?: 'price_monthly_prem_placeholder',
        'price'    => 10000,
        'interval' => 'month'
    ]
];
