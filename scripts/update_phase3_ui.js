const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const PREMIUM_MODAL_HTML = `
    <!-- ========================================== -->
    <!-- プレミアム機能案内・認証モーダル (フェーズ3) -->
    <!-- ========================================== -->
    <div id="modal-premium-required" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.65); z-index:25000; align-items:center; justify-content:center; backdrop-filter:blur(3px);">
        <div class="modal-content" style="max-width:540px; width:92%; background:#fff; border-radius:14px; padding:25px; box-shadow:0 15px 40px rgba(0,0,0,0.4); text-align:center; position:relative; font-family:sans-serif;">
            <button class="btn-close-modal" onclick="document.getElementById('modal-premium-required').style.display='none'" style="position:absolute; top:12px; right:15px; font-size:20px; background:none; border:none; cursor:pointer; color:#888;">✕</button>
            <div style="font-size:42px; margin-bottom:10px;">🔒</div>
            <h3 id="premium-feature-title" style="margin:0 0 8px 0; color:#2c3e50; font-size:18px;">プレミアム機能のご案内</h3>
            <p id="premium-feature-desc" style="font-size:13px; color:#64748b; line-height:1.6; margin-bottom:20px;">
                この機能のご利用には、有料サブスクリプションのご契約またはログインが必要です。
            </p>

            <div id="premium-upgrade-section" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-bottom:15px;">
                <div style="font-size:13px; font-weight:bold; color:#0f172a; margin-bottom:5px;">✨ 有料プランのご案内（週額1,650円〜）</div>
                <div style="font-size:11px; color:#64748b; margin-bottom:14px; line-height:1.5;">確認申請提出用PDFの一括印刷・出力、柱N値詳細根拠、手動金物選定などが使い放題となります。</div>
                <a href="pricing.html" target="_blank" style="display:inline-block; background:linear-gradient(135deg, #0ea5e9, #2563eb); color:#fff; text-decoration:none; padding:10px 24px; border-radius:8px; font-size:13px; font-weight:bold; box-shadow:0 4px 12px rgba(37,99,235,0.25);">💳 料金プラン・お申し込みを見る</a>
            </div>

            <div id="premium-login-section" style="border-top:1px dashed #cbd5e1; padding-top:15px;">
                <div style="font-size:12px; font-weight:bold; color:#334155; margin-bottom:8px;">ご契約済みの方はこちら（ログイン）</div>
                <form id="premium-auth-form" onsubmit="handleSendMagicLinkPremium(event)" style="display:flex; gap:6px; max-width:400px; margin:0 auto;">
                    <input type="email" id="premium-auth-email" placeholder="登録メールアドレス" required style="flex:1; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">
                    <button type="submit" id="premium-auth-btn" style="background:#27ae60; color:#fff; border:none; border-radius:6px; padding:8px 14px; font-size:12px; font-weight:bold; cursor:pointer; white-space:nowrap;">✉️ ログイン</button>
                </form>
                <div id="premium-auth-status-msg" style="display:none; font-size:11px; margin-top:8px; padding:6px; border-radius:4px;"></div>
            </div>
        </div>
    </div>
`;

const SCRIPT_LOGIC = `
    <!-- マジックリンク認証・ライセンス制御JS (フェーズ3) -->
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // URLパラメータ ?auth=success のハンドリング
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('auth') === 'success') {
                alert('✅ ログインが完了しました！プレミアム機能がアンロックされました。');
                window.history.replaceState({}, document.title, window.location.pathname);
            } else if (urlParams.get('auth_error')) {
                alert('⚠️ ログインエラー: 有効期限が切れたか、無効なトークンです。再度ログインリンクを発行してください。');
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        });

        async function handleSendMagicLinkPremium(e) {
            e.preventDefault();
            const emailInput = document.getElementById('premium-auth-email');
            const submitBtn = document.getElementById('premium-auth-btn');
            const msgBox = document.getElementById('premium-auth-status-msg');

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
                    msgBox.style.background = '#d4edda';
                    msgBox.style.color = '#155724';
                    msgBox.style.border = '1px solid #c3e6cb';
                    msgBox.textContent = data.message;
                    emailInput.value = '';
                } else {
                    msgBox.style.background = '#f8d7da';
                    msgBox.style.color = '#721c24';
                    msgBox.style.border = '1px solid #f5c6cb';
                    msgBox.textContent = data.message || '送信に失敗しました。';
                }
            } catch (err) {
                msgBox.style.display = 'block';
                msgBox.style.background = '#f8d7da';
                msgBox.style.color = '#721c24';
                msgBox.style.border = '1px solid #f5c6cb';
                msgBox.textContent = '通信エラーが発生しました。';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '✉️ ログイン';
            }
        }
    </script>
`;

function processFile(filename, isDev) {
    const filePath = path.resolve(ROOT_DIR, filename);
    let html = fs.readFileSync(filePath, 'utf8');

    // 1. h1 内に #header-user-status がなければ追加
    if (!html.includes('id="header-user-status"')) {
        const h1Pattern = /<span>上善如水 <span style="font-size:12px; color:#7f8c8d;">壁量計算WEB <span id="app-version-title">[^<]+<\/span><\/span><\/span>/;
        html = html.replace(h1Pattern, (match) => {
            return match + '\n            <div id="header-user-status"></div>';
        });
    }

    // 2. modal-premium-required の追加
    if (!html.includes('id="modal-premium-required"')) {
        const authModalEnd = '</div>\n    </div>\n    <!-- 免責事項・利用条件 同意モーダル -->';
        if (html.includes(authModalEnd)) {
            html = html.replace(authModalEnd, '</div>\n    </div>\n' + PREMIUM_MODAL_HTML + '\n    <!-- 免責事項・利用条件 同意モーダル -->');
        } else {
            const bodyStart = '<body>';
            html = html.replace(bodyStart, bodyStart + '\n' + PREMIUM_MODAL_HTML);
        }
    }

    // 3. マジックリンク認証制御JSの置換
    const scriptStartMarker = '<!-- マジックリンク認証制御JS -->';
    const scriptStartIndex = html.indexOf(scriptStartMarker);
    if (scriptStartIndex !== -1) {
        const scriptEndIndex = html.indexOf('</body>', scriptStartIndex);
        if (scriptEndIndex !== -1) {
            html = html.substring(0, scriptStartIndex) + SCRIPT_LOGIC + '\n' + html.substring(scriptEndIndex);
        }
    }

    // 4. index.dev.html の場合の個別 script タグ追加
    if (isDev && !html.includes('AuthLicenseManager.js')) {
        const wasmTag = '<script src="assets/js/modules/wall_4split/logic/WasmBridge.js';
        html = html.replace(wasmTag, '<script src="assets/js/modules/wall_4split/logic/AuthLicenseManager.js?v=3.13.31"></script>\n    ' + wasmTag);
    }

    // 5. バージョン文字列とキャッシュバスターの更新
    html = html.replace(/\?v=v?[0-9\.]+/g, '?v=3.13.31');
    html = html.replace(/v3\.13\.30/g, 'v3.13.31');
    html = html.replace(/v3\.12\.56/g, 'v3.13.31');

    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`✅ Successfully updated ${filename} with Phase 3 UI & v3.13.31!`);
}

processFile('index.html', false);
processFile('index.dev.html', true);
