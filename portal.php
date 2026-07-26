<?php
/**
 * portal.php - 契約管理・マイページ ＆ Stripe Customer Portal 連携
 */
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>契約管理・マイページ | MDO3 木造構造計算システム</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #2563eb;
            --primary-dark: #1d4ed8;
            --primary-light: #eff6ff;
            --success: #16a34a;
            --warning: #d97706;
            --text-main: #0f172a;
            --text-muted: #475569;
            --bg-main: #f8fafc;
            --bg-card: #ffffff;
            --border: #e2e8f0;
            --radius: 12px;
            --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', 'Noto Sans JP', sans-serif; background: var(--bg-main); color: var(--text-main); line-height: 1.6; }

        .navbar { background: #ffffff; border-bottom: 1px solid var(--border); padding: 1rem 1.5rem; }
        .nav-container { max-width: 1000px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        .brand-logo { font-size: 1.25rem; font-weight: 700; color: var(--primary); text-decoration: none; }

        .container { max-width: 800px; margin: 3rem auto; padding: 0 1.5rem; }
        .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 2rem; box-shadow: var(--shadow); margin-bottom: 1.5rem; }

        .card-header { border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; }
        .card-title { font-size: 1.35rem; font-weight: 700; }

        .status-badge { padding: 0.35rem 0.8rem; border-radius: 999px; font-size: 0.85rem; font-weight: 700; }
        .status-active { background: #dcfce7; color: var(--success); }
        .status-inactive { background: #fef3c7; color: var(--warning); }

        .info-row { display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px dashed var(--border); font-size: 0.95rem; }
        .info-label { color: var(--text-muted); font-weight: 500; }
        .info-value { font-weight: 600; color: var(--text-main); }

        .btn { display: inline-block; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 700; text-decoration: none; border: none; cursor: pointer; transition: all 0.2s; text-align: center; }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-dark); }
        .btn-outline { background: transparent; color: var(--primary); border: 2px solid var(--primary); }
        .btn-outline:hover { background: var(--primary-light); }

        .actions-wrap { margin-top: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap; }
        .alert-success { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.95rem; }
    </style>
</head>
<body>

    <header class="navbar">
        <div class="nav-container">
            <a href="index.html" class="brand-logo">上善如水 構造計算WEB</a>
            <div>
                <a href="index.html" style="color: var(--text-muted); text-decoration: none; font-weight: 500; font-size: 0.9rem;">← アプリに戻る</a>
            </div>
        </div>
    </header>

    <main class="container">
        <div id="payment-notice" style="display: none;" class="alert-success">
            🎉 決済手続きが完了いたしました！契約情報がアカウントに反映されています。
        </div>

        <div class="card">
            <div class="card-header">
                <h1 class="card-title">⚙️ ご契約状態・アカウント情報</h1>
                <span id="sub-badge" class="status-badge status-inactive">確認中...</span>
            </div>

            <div id="loading-spinner">契約情報を取得中...</div>

            <div id="portal-content" style="display: none;">
                <div class="info-row">
                    <span class="info-label">ログインアカウント (Email)</span>
                    <span id="user-email" class="info-value">-</span>
                </div>
                <div class="info-row">
                    <span class="info-label">現在のご契約プラン</span>
                    <span id="plan-name" class="info-value">未契約 / フリープラン</span>
                </div>
                <div class="info-row">
                    <span class="info-label">契約ステータス</span>
                    <span id="sub-status-text" class="info-value">inactive</span>
                </div>
                <div class="info-row">
                    <span class="info-label">次回更新日 / 有効期限</span>
                    <span id="sub-period-end" class="info-value">-</span>
                </div>

                <div class="actions-wrap">
                    <button id="btn-stripe-portal" class="btn btn-primary" onclick="openStripePortal()">
                        🧾 請求書・領収書取得 / カード変更 / 解約 (Stripe Customer Portal)
                    </button>
                    <button class="btn btn-outline" style="border-color: #0ea5e9; color: #0ea5e9;" onclick="fetchBankTransferInfo()">
                        🏦 銀行振込専用口座を確認・発行
                    </button>
                    <a href="pricing.html" class="btn btn-outline">💳 料金プラン一覧を見る</a>
                </div>
                <div id="bank-info-box" style="display:none; margin-top:1.5rem; background:#f0f9ff; border:1px solid #bae6fd; padding:1rem; border-radius:8px; font-size:0.9rem;">
                    <strong>🏦 お客様専用 振込口座 (Stripeバーチャル口座):</strong>
                    <div id="bank-info-content" style="margin-top:0.5rem; white-space:pre-wrap;"></div>
                </div>
            </div>
        </div>
    </main>

    <script>
        // URLパラメータのチェック
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('payment') === 'success') {
            document.getElementById('payment-notice').style.display = 'block';
        }

        // Plan Name Mapping
        const PLAN_NAMES = {
            'weekly': '週額スポット (¥1,650/週)',
            'monthly_std': '月額スタンダード (¥5,500/月)',
            'annual': '年額プラン (¥55,000/年)',
            'monthly_prem': '月額プレミアム サポート付 (¥10,000/月)'
        };

        async function fetchAuthAndSub() {
            try {
                const res = await fetch('api/check_auth.php', { credentials: 'include' });
                const data = await res.json();

                document.getElementById('loading-spinner').style.display = 'none';
                document.getElementById('portal-content').style.display = 'block';

                if (data.authenticated) {
                    document.getElementById('user-email').innerText = data.user.email;
                    
                    const sub = data.subscription || {};
                    if (sub.has_active) {
                        document.getElementById('sub-badge').innerText = '有効 (Active)';
                        document.getElementById('sub-badge').className = 'status-badge status-active';
                        document.getElementById('plan-name').innerText = PLAN_NAMES[sub.plan_key] || sub.plan_key || '有料プラン';
                        document.getElementById('sub-status-text').innerText = '契約中 (' + sub.status + ')';
                        document.getElementById('sub-period-end').innerText = sub.current_period_end || '有効期限内';
                    } else {
                        document.getElementById('sub-badge').innerText = '未契約';
                        document.getElementById('sub-badge').className = 'status-badge status-inactive';
                    }
                } else {
                    document.getElementById('user-email').innerHTML = '<span style="color:red;">未ログイン (要ログイン)</span>';
                    document.getElementById('btn-stripe-portal').disabled = true;
                }
            } catch (err) {
                console.error(err);
                document.getElementById('loading-spinner').innerText = '通信エラーが発生しました。';
            }
        }

        async function openStripePortal() {
            const btn = document.getElementById('btn-stripe-portal');
            btn.disabled = true;
            btn.innerText = 'ポータルへ移動中...';

            try {
                const res = await fetch('api/create_portal_session.php', { method: 'POST', credentials: 'include' });
                const data = await res.json();

                if (data.success && data.url) {
                    window.location.href = data.url;
                } else {
                    alert(data.message || 'カスタマーポータルの作成に失敗しました。');
                    btn.disabled = false;
                    btn.innerText = '🧾 請求書・領収書取得 / カード変更 / 解約';
                }
            } catch (err) {
                alert('エラーが発生しました。');
                btn.disabled = false;
            }
        }

        async function fetchBankTransferInfo() {
            const box = document.getElementById('bank-info-box');
            const content = document.getElementById('bank-info-content');
            box.style.display = 'block';
            content.innerText = '振込専用口座情報を取得中...';

            try {
                const res = await fetch('api/create_bank_transfer_account.php', { method: 'POST', credentials: 'include' });
                const data = await res.json();

                if (data.success && data.bank_details) {
                    const b = data.bank_details;
                    content.innerText = `金融機関名: ${b.bank_name || 'GMOあおぞらネット銀行 / 住信SBIネット銀行'}\n支店名: ${b.branch_name || '法人営業部'}\n口座種別: 普通預金\n口座番号: ${b.account_number || '-'}\n口座名義: ${b.account_holder_name || 'Stripe / MDO3'}\n\n※お客様専用の振込口座です。振込完了後、システムに自動で着金検知・反映されます。`;
                } else {
                    content.innerText = data.message || '振込口座の自動取得には決済画面（Stripe Checkout）での銀行振込指定またはStripe設定が必要です。';
                }
            } catch (err) {
                content.innerText = '通信エラーが発生しました。';
            }
        }

        fetchAuthAndSub();
    </script>

</body>
</html>
