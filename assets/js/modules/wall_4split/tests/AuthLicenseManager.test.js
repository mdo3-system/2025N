/**
 * tests/AuthLicenseManager.test.js - Unit Tests for Freemium Auth and License Guard
 */

window.TestRunner.describe('AuthLicenseManager (フリーミアム課金・ライセンス制御)', () => {

    window.TestRunner.it('AuthLicenseManager が存在し、未契約時の有料機能実行をブロックすること', () => {
        window.TestRunner.expect(typeof window.AuthLicenseManager).toBe('object');

        // 未契約状態をセット
        window.AuthLicenseManager.isSubscribed = false;
        window.AuthLicenseManager.isAuthenticated = false;

        // 計算書出力の権限チェック -> false でブロックされること
        const pdfAllowed = window.AuthLicenseManager.checkPermission('pdf_report');
        window.TestRunner.expect(pdfAllowed).toBe(false);

        // 柱詳細根拠の権限チェック -> false でブロックされること
        const pillarAllowed = window.AuthLicenseManager.checkPermission('pillar_detail');
        window.TestRunner.expect(pillarAllowed).toBe(false);
    });

    window.TestRunner.it('有効なサブスクリプション（または社内無償）保有時に有料機能が許可されること', () => {
        // 有料契約（または社内永久無償）状態をセット
        window.AuthLicenseManager.isSubscribed = true;
        window.AuthLicenseManager.isAuthenticated = true;
        window.AuthLicenseManager.subscription = {
            has_active: true,
            plan_key: 'free_permanent'
        };

        // 計算書出力の権限チェック -> true で許可されること
        const pdfAllowed = window.AuthLicenseManager.checkPermission('pdf_report');
        window.TestRunner.expect(pdfAllowed).toBe(true);

        // 柱詳細根拠の権限チェック -> true で許可されること
        const pillarAllowed = window.AuthLicenseManager.checkPermission('pillar_detail');
        window.TestRunner.expect(pillarAllowed).toBe(true);
    });

    window.TestRunner.it('WasmBridge にライセンス状態が同期されること', () => {
        if (window.WasmBridge) {
            window.WasmBridge.setLicenseState({
                isAuthenticated: true,
                isSubscribed: true,
                planKey: 'monthly_std'
            });

            window.TestRunner.expect(window.WasmBridge.isLicenseActive()).toBe(true);

            // 未契約状態へ戻す
            window.WasmBridge.setLicenseState({
                isAuthenticated: false,
                isSubscribed: false,
                planKey: null
            });
            window.TestRunner.expect(window.WasmBridge.isLicenseActive()).toBe(false);
        }
    });
});
