/**
 * view/ReportNValueView.js - N-Value Calculation & Pillar Hardware Document Section Component
 * v3.2.1 Refactoring: Single Responsibility Principle & Pure View Component
 */

window.ReportNValueView = {
    /**
     * 柱 N値計算・金物判定リストHTMLの生成
     */
    generateNValueSectionHtml: function(pillars, state) {
        const s = state || window.AppState;
        const getPillarName = window.getPillarName || ((p) => `(${p.gx}-${p.gy})`);
        let h = `<div class="doc-section" id="sec-nval">
            <h3>■ N値法 柱金物算定 ＆ 判定一覧表</h3>
            <table class="report-table" style="font-size:10px; width:100%; text-align:center;">
                <tr style="background:#f1f2f6;">
                    <th>階</th><th>柱番号</th><th>位置</th><th>出隅/中間</th><th>N値算定式</th><th>算定N値</th><th>選定金物</th><th>許容耐力(kN)</th><th>判定</th>
                </tr>`;

        pillars.filter(p => !p.isDeleted && !p.isInvalidPos).forEach(p => {
            const pName = getPillarName(p);
            const cornerStr = p.isCorner ? '出隅(0.8)' : '中間(0.5)';
            const nValStr = (p.nValue !== undefined) ? p.nValue.toFixed(2) : '-';
            const hwMark = p.nMark || '-';
            const hwN = p.hwCap !== undefined ? p.hwCap.toFixed(1) : '-';
            const statusClass = p.isNG ? 'bg-ng' : 'bg-ok';
            const statusText = p.isNG ? 'NG' : 'OK';

            h += `<tr>
                <td>${p.floor}</td>
                <td>P_${p.id}</td>
                <td>${pName}</td>
                <td>${cornerStr}</td>
                <td style="font-size:9px; text-align:left;">${p.nFormula || '-'}</td>
                <td style="font-weight:bold; color:#2c3e50;">${nValStr}</td>
                <td style="font-weight:bold; color:#0056b3;">${hwMark}</td>
                <td>${hwN}</td>
                <td class="${statusClass}">${statusText}</td>
            </tr>`;
        });

        h += `</table></div><div class="page-break"></div>`;
        return h;
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('ReportNValueView', window.ReportNValueView);
}
