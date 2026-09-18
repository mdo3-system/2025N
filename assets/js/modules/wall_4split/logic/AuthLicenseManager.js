/**
 * logic/AuthLicenseManager.js - 会員認証・サブスクリプションライセンス制御マネージャー
 * フリーミアムモデル（基本無料・計算書一括出力および柱N値詳細を有料化）
 */

(function(global) {
    'use strict';

    const AuthLicenseManager = {
        isAuthenticated: false,
        isSubscribed: false,
        user: null,
        subscription: null,
        isInitialized: false,

        /**
         * 認証・ライセンス情報の初期化チェック
         */
        init: async function() {
            if (this.isInitialized) return this.isSubscribed;

            try {
                // ローカル開発環境の特別バイパス（必要に応じて）
                const isLocal = (typeof window !== 'undefined' && (
                    window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.protocol === 'file:'
                ));

                if (typeof fetch === 'undefined') {
                    // Node.js テスト環境
                    this.isInitialized = true;
                    return false;
                }

                const res = await fetch('api/check_auth.php', {
                    method: 'GET',
                    credentials: 'include'
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data && data.authenticated) {
                        this.isAuthenticated = true;
                        this.user = data.user || null;
                        this.subscription = data.subscription || null;
                        this.isSubscribed = !!(this.subscription && this.subscription.has_active);
                    } else {
                        this.isAuthenticated = false;
                        this.isSubscribed = false;
                    }
                }
            } catch (err) {
                console.warn('[AuthLicenseManager] check_auth failed or offline:', err);
                this.isAuthenticated = false;
                this.isSubscribed = false;
            }

            this.isInitialized = true;

            // WasmBridge にライセンス状態を同期
            if (global.WasmBridge && typeof global.WasmBridge.setLicenseState === 'function') {
                global.WasmBridge.setLicenseState({
                    isAuthenticated: this.isAuthenticated,
                    isSubscribed: this.isSubscribed,
                    planKey: this.subscription ? this.subscription.plan_key : null
                });
            }

            // ヘッダーUIを更新
            this.updateHeaderUI();

            return this.isSubscribed;
        },

        /**
         * 有料機能の権限チェック
         * @param {string} feature 'pdf_report' | 'pillar_detail' | 'foundation'
         * @returns {boolean} true: 利用可能, false: ロック（モーダル表示）
         */
        checkPermission: function(feature) {
            // 有効なサブスクリプションまたは社内無償契約を保有している場合
            if (this.isSubscribed) {
                return true;
            }

            // 未契約または未ログインの場合は案内モーダルを表示
            this.openUpgradeModal(feature);
            return false;
        },

        /**
         * プレミアム案内・ログインモーダルを開く
         * @param {string} feature
         */
        openUpgradeModal: function(feature) {
            if (typeof document === 'undefined') return;

            const modal = document.getElementById('modal-premium-required');
            const titleEl = document.getElementById('premium-feature-title');
            const descEl = document.getElementById('premium-feature-desc');

            let titleText = '🔒 プレミアム限定機能のご案内';
            let descText = 'この機能のご利用には、有料サブスクリプションのご契約またはログインが必要です。';

            if (feature === 'pdf_report') {
                titleText = '📑 壁量計算書の一括印刷・PDF出力';
                descText = '確認申請にそのまま提出可能な完成版壁量計算書（A4判一括印刷・PDF出力）は、有料プラン専用の機能となっております。';
            } else if (feature === 'pillar_detail') {
                titleText = '📐 柱N値計算根拠詳細・金物表示';
                descText = '柱ごとのN値詳細計算式・負担面積・選定金物の詳細根拠の閲覧は、有料プラン専用の機能となっております。';
            } else if (feature === 'foundation') {
                titleText = '🏗️ 基礎構造計算（基礎梁・基礎スラブ解析）';
                descText = '基礎スラブ・基礎梁の断面検定、人通口補強筋、NMQ応力図解析などの基礎構造計算機能は、有料プラン（Stripe決済後）専用の機能となっております。';
            }

            if (titleEl) titleEl.textContent = titleText;
            if (descEl) descEl.textContent = descText;

            // ログイン中だが未契約の場合と、未ログインの場合でUI切り替え
            const loginSection = document.getElementById('premium-login-section');
            const upgradeSection = document.getElementById('premium-upgrade-section');

            if (this.isAuthenticated) {
                if (loginSection) loginSection.style.display = 'none';
                if (upgradeSection) upgradeSection.style.display = 'block';
            } else {
                if (loginSection) loginSection.style.display = 'block';
                if (upgradeSection) upgradeSection.style.display = 'block';
            }

            if (modal) {
                modal.style.display = 'flex';
            }
        },

        /**
         * ログアウト処理
         */
        logout: async function() {
            try {
                if (typeof fetch !== 'undefined') {
                    await fetch('api/logout.php', {
                        method: 'POST',
                        credentials: 'include'
                    });
                }
            } catch (e) {
                console.error('Logout error:', e);
            }
            if (typeof window !== 'undefined') {
                window.location.href = 'index.html';
            }
        },

        /**
         * ヘッダーのユーザー状態表示を更新
         */
        updateHeaderUI: function() {
            if (typeof document === 'undefined') return;

            const container = document.getElementById('header-user-status');
            if (!container) return;

            if (this.isAuthenticated && this.user) {
                const planName = (this.subscription && this.subscription.plan_key === 'free_permanent') 
                    ? '社内永久無償' 
                    : (this.isSubscribed ? '有効会員' : '無料プラン');

                const badgeBg = this.isSubscribed ? '#27ae60' : '#e67e22';

                container.innerHTML = `
                    <div style="display:inline-flex; align-items:center; gap:8px; font-size:11px; background:rgba(255,255,255,0.15); padding:4px 10px; border-radius:20px;">
                        <span style="color:#fff;">👤 ${this.user.email}</span>
                        <span style="background:${badgeBg}; color:#fff; font-size:10px; padding:2px 6px; border-radius:10px; font-weight:bold;">${planName}</span>
                        ${!this.isSubscribed ? '<a href="pricing.html" target="_blank" style="color:#f1c40f; text-decoration:none; font-weight:bold; margin-left:4px;">[プラン契約]</a>' : ''}
                        <button onclick="window.AuthLicenseManager.logout()" style="background:transparent; border:none; color:#ff7675; cursor:pointer; font-size:11px; margin-left:4px; padding:0;">🚪ログアウト</button>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <button onclick="window.AuthLicenseManager.openUpgradeModal('general')" style="background:#27ae60; color:#fff; border:none; border-radius:14px; padding:4px 12px; font-size:11px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:4px; box-shadow:0 2px 4px rgba(0,0,0,0.2);">
                        🔑 ログイン / 有料プラン
                    </button>
                `;
            }
        }
    };

    if (typeof window !== 'undefined') {
        window.AuthLicenseManager = AuthLicenseManager;
    }
    if (typeof global !== 'undefined') {
        global.AuthLicenseManager = AuthLicenseManager;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AuthLicenseManager;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
