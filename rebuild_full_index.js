const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, 'temp_wall_4split_53a6f8e.html');
const outputPath = path.join(__dirname, 'index.html');

let html = fs.readFileSync(sourcePath, 'utf8');

// 1. 相対パスを直下用に変換
html = html.replace(/src="\.\.\/\.\.\//g, 'src="');
html = html.replace(/href="\.\.\/\.\.\//g, 'href="');
html = html.replace(/manual\/index\.html/g, 'manual/index.html');
html = html.replace(/portal/g, 'portal.php');

// 2. バージョン更新
html = html.replace(/\?v=[v0-9\.]+/g, '?v=3.0.3');
html = html.replace(/壁量計算WEB \(v[0-9\.]+\)/g, '壁量計算WEB (v3.0.3)');
html = html.replace(/<span id="app-version-title">v[0-9\.]+<\/span>/g, '<span id="app-version-title">v3.0.3</span>');

// 3. 認証CSSの追記
const authCss = `
        /* ログイン認証モーダル用スタイル */
        #modal-auth-login {
            display: flex;
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.95);
            z-index: 999999;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(8px);
        }

        .auth-card {
            background: #ffffff;
            border-radius: 16px;
            padding: 40px;
            width: 100%;
            max-width: 440px;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3), 0 10px 10px -5px rgba(0,0,0,0.2);
            text-align: center;
        }

        .auth-title {
            font-size: 22px;
            font-weight: 800;
            color: #1e293b;
            margin-top: 0;
            margin-bottom: 8px;
        }

        .auth-subtitle {
            font-size: 13px;
            color: #64748b;
            margin-bottom: 24px;
            line-height: 1.5;
        }

        .auth-input {
            width: 100%;
            padding: 12px 16px;
            font-size: 14px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 16px;
            box-sizing: border-box;
            transition: all 0.2s;
            outline: none;
        }

        .auth-input:focus {
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37,99,235,0.15);
        }

        .auth-btn {
            width: 100%;
            background: #2563eb;
            color: #ffffff;
            border: none;
            padding: 14px;
            font-size: 15px;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .auth-btn:hover {
            background: #1d4ed8;
        }

        .auth-msg {
            margin-top: 16px;
            font-size: 13px;
            line-height: 1.5;
            padding: 10px;
            border-radius: 6px;
        }

        .auth-msg.success {
            background: #dcfce7;
            color: #166534;
            border: 1px solid #bbf7d0;
        }

        .auth-msg.error {
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fecaca;
        }
`;
html = html.replace('</style>', authCss + '\n    </style>');

// 4. 認証モーダルHTMLの追加
const authModalHtml = `
    <!-- ========================================== -->
    <!-- ログイン認証モーダル (マジックリンク) -->
    <!-- ========================================== -->
    <div id="modal-auth-login">
        <div class="auth-card">
            <div style="font-size:40px; margin-bottom:10px;">📐</div>
            <div class="auth-title">上善如水 構造計算WEB</div>
            <div class="auth-subtitle">
                登録済みメールアドレスを入力してください。<br>ログイン用マジックリンクを送信いたします。
            </div>
            
            <form id="auth-form" onsubmit="handleSendMagicLink(event)">
                <input type="email" id="auth-email" class="auth-input" placeholder="example@domain.com" required>
                <button type="submit" id="auth-submit-btn" class="auth-btn">✉️ ログインリンクを送信</button>
            </form>

            <div id="auth-status-msg" style="display:none;" class="auth-msg"></div>

            <div style="margin-top:20px; font-size:11px; color:#94a3b8;">
                送信元: <code>noreply@2025.eie.jp</code>
            </div>
        </div>
    </div>
`;
html = html.replace('<body>', '<body>\n' + authModalHtml);

// 5. 認証JSコードの追加
const authJs = `
    <!-- マジックリンク認証制御クライアントスクリプト -->
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            checkAuth();
        });

        async function checkAuth() {
            try {
                const res = await fetch('api/check_auth.php', { cache: 'no-store' });
                const data = await res.json();
                const authModal = document.getElementById('modal-auth-login');

                if (data.authenticated) {
                    if (authModal) authModal.style.display = 'none';
                    console.log('Logged in as:', data.user.email);
                } else {
                    if (authModal) authModal.style.display = 'flex';
                }
            } catch (e) {
                console.error('Auth check error:', e);
            }
        }

        async function handleSendMagicLink(e) {
            e.preventDefault();
            const emailInput = document.getElementById('auth-email');
            const submitBtn = document.getElementById('auth-submit-btn');
            const msgBox = document.getElementById('auth-status-msg');

            const email = emailInput.value.trim();
            if (!email) return;

            submitBtn.disabled = true;
            submitBtn.textContent = '送信中...';
            msgBox.style.display = 'none';

            try {
                const res = await fetch('api/send_magic_link.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });

                const data = await res.json();
                msgBox.style.display = 'block';

                if (data.success) {
                    msgBox.className = 'auth-msg success';
                    msgBox.textContent = data.message;
                    emailInput.value = '';
                } else {
                    msgBox.className = 'auth-msg error';
                    msgBox.textContent = data.message || '送信に失敗しました。';
                }
            } catch (err) {
                msgBox.style.display = 'block';
                msgBox.className = 'auth-msg error';
                msgBox.textContent = '通信エラーが発生しました。';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '✉️ ログインリンクを送信';
            }
        }
    </script>
`;
html = html.replace('</body>', authJs + '\n</body>');

fs.writeFileSync(outputPath, html, 'utf8');
console.log('Full rebuild of index.html from commit 53a6f8e successful.');
