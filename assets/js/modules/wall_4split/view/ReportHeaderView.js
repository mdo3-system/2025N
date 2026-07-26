/**
 * view/ReportHeaderView.js - Calculation Report Header & Cover Page Component
 * v3.5.0 Refactoring: Single Responsibility Principle (SRP)
 */

window.ReportHeaderView = {
    /**
     * 各計算書ページの共通ヘッダー（黒地角丸タイトルバッジ＋工事名称・設計者名・日付）のHTMLを生成
     * @param {string} title - ページのタイトル名
     * @returns {string} HTMLマークアップ
     */
    generatePageHeaderHtml: function(title) {
        const getStr = window.MathUtils ? window.MathUtils.getStr : ((id) => document.getElementById(id)?.value || '');
        const prjName = getStr('info-prj') || '〇〇邸 新築工事';
        const officeName = getStr('info-office') || '上善如水 建築設計';
        const licenseInfo = getStr('info-license') || '';
        const designerName = getStr('info-name') || '上善 如水';
        const d = new Date();
        const dateStr = `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`;

        const designerStr = licenseInfo ? `${designerName} (${licenseInfo} / ${officeName})` : `${designerName} (${officeName})`;

        return `
        <div class="doc-page-header" style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #2c3e50; padding-bottom:6px; margin-bottom:15px; font-family:'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif;">
            <div style="font-size:11px; color:#555; font-weight:bold; line-height:1.2;">
                建築基準法＜2025年基準＞<br>
                <span style="font-size:10px; color:#7f8c8d; font-weight:normal;">木造軸組工法 構造計算書</span>
            </div>
            <div style="text-align:center;">
                <div style="background:#2c3e50; color:#ffffff; font-weight:bold; font-size:15px; padding:4px 18px; border-radius:18px; letter-spacing:1px; display:inline-block; box-shadow:0 2px 4px rgba(0,0,0,0.15);">
                    ${title}
                </div>
            </div>
            <div style="text-align:right; font-size:11px; color:#333; line-height:1.3;">
                <div><span style="color:#7f8c8d;">日付：</span><span style="font-weight:bold;">${dateStr}</span></div>
                <div><span style="color:#7f8c8d;">工事名称：</span><span style="font-weight:bold; color:#16a085;">${prjName}</span></div>
                <div><span style="color:#7f8c8d;">設計者：</span><span>${designerStr}</span></div>
            </div>
        </div>`;
    },

    /**
     * 計算書の表紙および基本情報サマリーのHTMLブロックを生成
     * @param {Object} state - AppStateへの参照
     * @returns {string} HTMLマークアップ
     */
    generateReportCoverHtml: function(state) {
        const getStr = window.MathUtils ? window.MathUtils.getStr : ((id) => document.getElementById(id)?.value || '');
        const prjName = getStr('info-prj') || '〇〇邸 新築工事';
        const officeName = getStr('info-office') || '上善如水 建築設計';
        const licenseInfo = getStr('info-license') || '一級 第00000号';
        const designerName = getStr('info-name') || '上善 如水';
        const dateStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        return `
        <div class="report-cover" style="text-align:center; padding:40px 20px; page-break-after:always;">
            <div style="font-size:14px; color:#555; letter-spacing:2px; margin-bottom:20px;">木造軸組工法 構造計算書（告示1460号・壁量・N値算定・基礎検定）</div>
            <h1 style="font-size:28px; color:#2c3e50; margin-bottom:40px; border-bottom:3px double #2c3e50; padding-bottom:15px; display:inline-block; padding-left:30px; padding-right:30px;">
                ${prjName} 構造計算書
            </h1>
            
            <div style="max-width:520px; margin:50px auto 40px auto; border:1px solid #bdc3c7; border-radius:6px; padding:22px; background:#fdfdfd; text-align:left; font-size:13px; line-height:1.9; box-shadow:0 3px 6px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #ccc; padding-bottom:6px; margin-bottom:10px;">
                    <span style="color:#7f8c8d; font-weight:bold;">工事名称:</span>
                    <span style="font-weight:bold; color:#2c3e50; font-size:14px;">${prjName}</span>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #ccc; padding-bottom:6px; margin-bottom:10px;">
                    <span style="color:#7f8c8d; font-weight:bold;">設計事務所:</span>
                    <span style="font-weight:bold; color:#2c3e50;">${officeName}</span>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #ccc; padding-bottom:6px; margin-bottom:10px;">
                    <span style="color:#7f8c8d; font-weight:bold;">建築士資格:</span>
                    <span style="font-weight:bold; color:#2c3e50;">${licenseInfo}</span>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #ccc; padding-bottom:6px; margin-bottom:10px;">
                    <span style="color:#7f8c8d; font-weight:bold;">設計者名:</span>
                    <span style="font-weight:bold; color:#2c3e50;">${designerName}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#7f8c8d; font-weight:bold;">作成年月日:</span>
                    <span style="font-weight:bold; color:#2c3e50;">${dateStr}</span>
                </div>
            </div>

            <div style="margin-top:70px; font-size:11px; color:#95a5a6;">
                システム: 上善如水 壁量・N値計算WEB [${window.APP_VERSION || 'v3.9.1'}]
            </div>
        </div>`;
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('ReportHeaderView', window.ReportHeaderView);
}
