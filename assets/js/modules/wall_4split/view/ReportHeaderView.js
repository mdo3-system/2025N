/**
 * view/ReportHeaderView.js - Calculation Report Header & Cover Page Component
 * v3.5.0 Refactoring: Single Responsibility Principle (SRP)
 */

window.ReportHeaderView = {
    /**
     * 計算書の表紙および基本情報サマリーのHTMLブロックを生成
     * @param {Object} state - AppStateへの参照
     * @returns {string} HTMLマークアップ
     */
    generateReportCoverHtml: function(state) {
        const getStr = window.MathUtils ? window.MathUtils.getStr : ((id) => document.getElementById(id)?.value || '');
        const prjName = getStr('info-prj') || '木造軸組住宅';
        const officeName = getStr('info-office') || '建築設計事務所';
        const designerName = getStr('info-name') || '設計 太郎';
        const dateStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        return `
        <div class="report-cover" style="text-align:center; padding:40px 20px; page-break-after:always;">
            <div style="font-size:14px; color:#555; letter-spacing:2px; margin-bottom:20px;">木造軸組工法 構造計算書（告示1460号・壁量・N値算定）</div>
            <h1 style="font-size:28px; color:#2c3e50; margin-bottom:40px; border-bottom:3px double #2c3e50; padding-bottom:15px; display:inline-block; padding-left:30px; padding-right:30px;">
                ${prjName} 構造計算書
            </h1>
            
            <div style="max-width:500px; margin:60px auto 40px auto; border:1px solid #bdc3c7; border-radius:6px; padding:20px; background:#fdfdfd; text-align:left; font-size:13px; line-height:1.8;">
                <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #ccc; padding-bottom:5px; margin-bottom:8px;">
                    <span style="color:#7f8c8d;">工事名称:</span>
                    <span style="font-weight:bold; color:#2c3e50;">${prjName}</span>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #ccc; padding-bottom:5px; margin-bottom:8px;">
                    <span style="color:#7f8c8d;">設計事務所:</span>
                    <span style="font-weight:bold; color:#2c3e50;">${officeName}</span>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #ccc; padding-bottom:5px; margin-bottom:8px;">
                    <span style="color:#7f8c8d;">設計者名:</span>
                    <span style="font-weight:bold; color:#2c3e50;">${designerName}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#7f8c8d;">作成年月日:</span>
                    <span style="font-weight:bold; color:#2c3e50;">${dateStr}</span>
                </div>
            </div>

            <div style="margin-top:80px; font-size:11px; color:#95a5a6;">
                システム: 上善如水 壁量・N値計算WEB [${window.APP_VERSION || 'v3.5.0'}]
            </div>
        </div>`;
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('ReportHeaderView', window.ReportHeaderView);
}
