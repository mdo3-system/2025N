/**
 * view/ReportAreaView.js - Area & Mitsuke Calculation Document Section Component
 * v3.2.1 Refactoring: Single Responsibility Principle & Pure View Component
 */

window.ReportAreaView = {
    /**
     * 1F/2F/RF床面積求積表および算定根拠HTMLブロックの生成
     */
    generateAreaSectionHtml: function(floor, areaLines, imgUrl, basisStr) {
        const fAreas = areaLines.filter(a => a.floor === floor);
        if (!imgUrl && fAreas.length === 0) return '';

        const calcModeStr = document.getElementById('calc-mode-select')?.value === 'seinou' ? '性能表示(見上げ面積)' : '建築基準法(見下げ面積)';
        let h = `<div class="doc-section">
            <h3>■ ${floor} 床面積図・表 ＆ 必要壁量算定</h3>
            <div style="display:flex;gap:15px;flex-wrap:wrap;justify-content:center;margin-bottom:15px;">
                <div style="width:100%; text-align:left; background:#fafafa; border:1px solid #ddd; padding:8px; margin-bottom:15px; font-size:12px; line-height:1.4;">
                    <b>【${floor}階 床面積の算定根拠】</b><br>
                    対象モード: <b>${calcModeStr}</b><br>
                    加算式: ${basisStr || ''}
                </div>`;

        if (imgUrl) {
            h += `<div style="text-align:center;width:100%;"><img src="${imgUrl}" style="width:95%;max-width:800px;border:1px solid #ccc;padding:5px;margin-bottom:10px;"></div>`;
        }

        if (fAreas.length > 0) {
            h += `<div style="width:100%; margin-top:10px;"><div style="background:#27ae60;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px;">${floor} 床面積 求積表</div>`;
            h += `<table class="report-table" style="font-size:11px; width:100%; text-align:center;"><tr><th>No.</th><th>底辺(m)</th><th>高さ(m)</th><th>計算式</th><th>面積(㎡)</th></tr>`;
            let totalA = 0;
            fAreas.forEach((area, i) => {
                const getAreaRowsHtml = window.getAreaRowsHtml || (() => ({ html: '', area: 0 }));
                const rowData = getAreaRowsHtml(area, i);
                h += rowData.html;
                totalA += rowData.area;
            });
            h += `<tr style="font-weight:bold;"><td colspan="4" style="text-align:right;">合計床面積：</td><td style="color:#d35400;">${totalA.toFixed(2)} ㎡</td></tr></table></div>`;
        }
        h += `</div></div><div class="page-break"></div>`;
        return h;
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('ReportAreaView', window.ReportAreaView);
}
