/**
 * view/ReportNValueView.js - N-Value Calculation Table Document Section Component
 * v3.5.0 Refactoring: Single Responsibility Principle (SRP)
 */

window.ReportNValueView = {
    /**
     * N値計算結果表・金物選定リストのHTMLブロックを生成
     * @param {Object} state - AppStateへの参照
     * @returns {string} HTMLマークアップ
     */
    generateNValueTableSectionHtml: function(state) {
        const s = state || window.AppState;
        const pillars = s.pillars || [];
        const floorPillars = (f) => pillars.filter(p => p.floor === f && !p.isDeleted && !p.isInvalidPos);
        const getStr = window.MathUtils ? window.MathUtils.getStr : ((id) => document.getElementById(id)?.value || '');

        let html = '';

        ['1F', '2F'].forEach(f => {
            const list = floorPillars(f);
            if (list.length === 0) return;

            html += `<div style="margin-top:20px; margin-bottom:20px;">
                <div style="background:#0056b3; color:#fff; padding:6px 12px; font-weight:bold; font-size:13px; border-radius:4px 4px 0 0; display:flex; justify-content:space-between; align-items:center;">
                    <span>📐 ${f} 柱 N値計算 ＆ 柱頭柱脚金物選定一覧表</span>
                    <span style="font-size:11px;">(告示1460号第2号・N値計算)</span>
                </div>
                <table class="report-table" style="font-size:11px; width:100%; text-align:center; border:1px solid #ddd; border-top:none;">
                    <tr style="background:#f8f9fa; font-weight:bold;">
                        <th style="width:5%;">No.</th>
                        <th style="width:8%;">通り芯</th>
                        <th style="width:6%;">出隅</th>
                        <th>X方向 計算式</th>
                        <th style="width:8%;">X_N値</th>
                        <th>Y方向 計算式</th>
                        <th style="width:8%;">Y_N値</th>
                        <th style="width:8%;">採用N値</th>
                        <th style="width:14%;">選定金物</th>
                    </tr>`;

            let validCount = 0;
            list.forEach((p, i) => {
                if (p.nValue > 0 || p.Ax > 0 || p.Ay > 0 || p.isC) {
                    validCount++;
                    const isCorner = p.isC ? '<span style="color:#d35400; font-weight:bold;">〇</span>' : '×';
                    const mark = p.manualMark || p.nMark || '-';
                    const isDanger = (p.nValue > 0 && (!p.nMark || p.nMark === '要検討'));
                    const markStyle = isDanger ? 'color:#e74c3c; font-weight:bold;' : 'color:#27ae60; font-weight:bold;';

                    html += `<tr>
                        <td>${validCount}</td>
                        <td><b>${p.gx}-${p.gy}</b></td>
                        <td>${isCorner}</td>
                        <td style="text-align:left; font-size:10px; padding-left:5px;">${p.cStrX || '-'}</td>
                        <td>${(p.nCalcX || 0).toFixed(2)}</td>
                        <td style="text-align:left; font-size:10px; padding-left:5px;">${p.cStrY || '-'}</td>
                        <td>${(p.nCalcY || 0).toFixed(2)}</td>
                        <td style="font-weight:bold; color:#0056b3;">${(p.nValue || 0).toFixed(2)}</td>
                        <td style="${markStyle}">${mark}</td>
                    </tr>`;
                }
            });

            if (validCount === 0) {
                html += `<tr><td colspan="9" style="color:#777; padding:15px;">対象の柱データがありません</td></tr>`;
            }

            html += `</table></div>`;
        });

        return html;
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('ReportNValueView', window.ReportNValueView);
}
