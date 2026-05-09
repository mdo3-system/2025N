/**
 * wall_4split_report.js - レガシー互換ブリッジ
 * v2.3.12 Refactoring
 */

// --- レガシー関数へのエイリアスは MathUtils.js で定義済み ---

function getMode() { return (window.AppState && window.AppState.currentAppMode) ? window.AppState.currentAppMode : 'wall'; }

function triggerUpdate() {
    requestAnimationFrame(() => {
        if (window.AppController && window.AppController.refreshAll) {
            window.AppController.refreshAll();
        }
    });
}

function renderAll() {
    if (window.AppController && window.AppController.refreshAll) {
        window.AppController.refreshAll();
    }
}

function updateReport() {
    if (window.ReportEngine && window.ReportEngine.updateReport) {
        window.ReportEngine.updateReport(window.AppState);
    }
}

function getCustomWallList() {
    let list = [];
    document.querySelectorAll('.cust-wall-row').forEach(row => {
        let nEl = row.querySelector('.cust-w-n');
        let vEl = row.querySelector('.cust-w-v');
        if (nEl && vEl && nEl.value && !isNaN(parseFloat(vEl.value))) {
            list.push({ name: nEl.value, val: parseFloat(vEl.value) });
        }
    });
    return list;
}

// ------------------------------------------
// プロパティ表示 (UIView等への移行推奨)
// ------------------------------------------

function showPillarProps(p) {
    let pp = document.getElementById('pillar-props');
    if (!pp) return;
    pp.style.display = 'block';
    
    let html = `<h3>柱情報 (${p.floor})</h3>
                <div class="prop-row"><label>位置:</label><span>${window.getPillarName(p) || '-'}</span></div>
                <div class="prop-row"><label>N値:</label><span>${p.nValue != null ? p.nValue.toFixed(2) : '-'}</span></div>
                <div class="prop-row"><label>金物:</label><span>${p.nMark || '-'}</span></div>`;
    
    html += `<button onclick="showPillarDetail('${p.id}')" style="margin-top:10px; width:100%; padding:5px;">計算根拠を表示</button>`;
    pp.innerHTML = html;
}

function showPillarDetail(id) {
    const p = window.AppState.pillars.find(p => p.id == id);
    if (!p) return;
    const pdText = document.getElementById('pillar-detail-text');
    if (!pdText) return;

    let Nx = p.Ax != null ? p.Ax.toFixed(2) : '—';
    let Ny = p.Ay != null ? p.Ay.toFixed(2) : '—';
    let N = p.nValue != null ? p.nValue.toFixed(2) : '—';
    let isC = p.isManualCorner !== null ? p.isManualCorner : p.isCornerAuto;
    let L_str = p.lCalcMode === 'detail' ? `詳細(面積 ${p.usedArea?.toFixed(2)}㎡×荷重)` : `告示(${isC ? '角' : '一般'})`;
    
    let detail = '';
    if (p.nValue === undefined) {
        detail = '接続壁なし（計算未実行）';
    } else {
        const areaWarn = (p.lCalcMode === 'detail' && !(p.usedArea > 0)) ? '\n⚠️ 負担面積=0: 隣接柱が未検出です。手動で面積を入力してください。' : '';
        detail = [
            '【N値計算 - Ｎ値計算法（斜め壁はグレー本準拠）】',
            `柱: ${window.getPillarName(p) || '-'}  (${p.floor})`,
            `押さえ効果L: ${L_str} = ${p.L_val?.toFixed(2)}`,
            '',
            '─ X方向地震（Y方向壁 左右差）─',
            `  計算式: ${p.cStrX || '-'}`,
            `  Nx = ${Nx}`,
            '',
            '─ Y方向地震（X方向壁 上下差）─',
            `  計算式: ${p.cStrY || '-'}`,
            `  Ny = ${Ny}`,
            '',
            `採用N値 = max(Nx, Ny, 0) = ${N}`,
            `判定金物: ${p.nMark || '-'}`,
            p.manualMark ? `※手動指定: ${p.manualMark}` : '',
            areaWarn
        ].filter(s => s !== null).join('\n');
    }
    pdText.innerText = detail;
    document.getElementById('modal-pillar-detail').style.display = 'flex';
}

function hidePillarProps() {
    let pp = document.getElementById('pillar-props');
    if (pp) pp.style.display = 'none';
}

function showCenterCalc() {
    let html = '';
    ['2F', '1F'].forEach(f => {
        let b = window.GridEngine.get4DivisionBounds(f, window.AppState);
        if (!b) return;
        html += `<div style="margin-top:15px; border-top:2px solid #333; padding-top:10px;">
                    <h3 style="margin:0 0 10px 0; background:#f0f0f0; padding:5px;">${f} 4分割境界情報</h3>
                    <table class="report-table">
                        <tr><th>項目</th><th>X方向 (縦分割)</th><th>Y方向 (横分割)</th></tr>
                        <tr><td>全体スパン</td><td>${(b.maxX - b.minX).toFixed(0)} mm</td><td>${(b.maxY - b.minY).toFixed(0)} mm</td></tr>
                        <tr><td>1/4ライン</td><td>左:${b.xLeft.toFixed(0)} / 右:${b.xRight.toFixed(0)}</td><td>上:${b.yTop.toFixed(0)} / 下:${b.yBottom.toFixed(0)}</td></tr>
                    </table>
                 </div>`;
    });
    let cc = document.getElementById('center-calc-container');
    if (cc) {
        cc.innerHTML = html;
        document.getElementById('modal-center').style.display = 'flex';
    }
}

// ------------------------------------------
// 立面軸力図 (ReportEngine等へ移行検討)
// ------------------------------------------

window.getAxesToReport = function() {
    const axes = new Set();
    const s = window.AppState;
    if (s.gridXNames) s.gridXNames.forEach(n => { if(n && n !== '?') axes.add(n); });
    if (s.gridYNames) s.gridYNames.forEach(n => { if(n && n !== '?') axes.add(n); });

    return Array.from(axes).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
};

window.generateEnlargedAxialDiagramSvg = function(axisName, loadDirection = 'left') {
    if (window.ElevationRenderer && window.ElevationRenderer.generateAxialDiagramSvg) {
        return window.ElevationRenderer.generateAxialDiagramSvg(axisName, loadDirection, window.AppState);
    }
    return "Renderer not loaded";
};
