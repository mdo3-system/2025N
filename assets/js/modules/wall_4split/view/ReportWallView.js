/**
 * view/ReportWallView.js - Wall Quantity & 4-Division Calculation Document Section Component
 * v3.2.1 Refactoring: Single Responsibility Principle & Pure View Component
 */

window.ReportWallView = {
    /**
     * 4分割法側端部壁量計算表のHTMLブロック生成
     */
    generateDiv4TableSectionHtml: function(state) {
        const s = state || window.AppState;
        if (!s || !s.reqWall) return '';
        const getVal = window.MathUtils.getVal || ((id) => parseFloat(document.getElementById(id)?.value) || 0);

        let h = '';
        ['1F', '2F'].forEach(f => {
            const suffix = f[0];
            const cq = getVal(`c-q${suffix}`);
            const ext = getVal(`e-x-t${suffix}`), exb = getVal(`e-x-b${suffix}`), eyl = getVal(`e-y-l${suffix}`), eyr = getVal(`e-y-r${suffix}`);

            h += `<h4>【${f} 4分割 側端部 必要壁量(地震力)】</h4>
                <table class="report-table" style="width:60%;">
                    <tr><th>方向</th><th>側端</th><th>面積(㎡)</th><th>単位壁量</th><th>必要壁量(m)</th></tr>
                    <tr><td rowspan="2">X方向</td><td>上(奥)</td><td>${ext.toFixed(2)}</td><td>${cq}</td><td>${(ext * cq).toFixed(2)}</td></tr>
                    <tr><td>下(前)</td><td>${exb.toFixed(2)}</td><td>${cq}</td><td>${(exb * cq).toFixed(2)}</td></tr>
                    <tr><td rowspan="2">Y方向</td><td>左</td><td>${eyl.toFixed(2)}</td><td>${cq}</td><td>${(eyl * cq).toFixed(2)}</td></tr>
                    <tr><td>右</td><td>${eyr.toFixed(2)}</td><td>${cq}</td><td>${(eyr * cq).toFixed(2)}</td></tr>
                </table><br>`;
        });
        return h;
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('ReportWallView', window.ReportWallView);
}
