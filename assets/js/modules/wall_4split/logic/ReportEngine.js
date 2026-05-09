/**
 * logic/ReportEngine.js - DOM Report Generation Engine
 * v2.3.21 Refactoring
 */

window.ReportEngine = {
    /**
     * 左パネルの壁量計算レポートを更新します
     */
    updateReport: function(state) {
        const s = state || window.AppState;
        const reqWall = s.reqWall;
        const currentFloor = s.currentFloor;
        const pillars = s.pillars;
        const walls = s.walls;
        const areaLines = s.areaLines;
        const getVal = window.MathUtils.getVal || ((id) => parseFloat(document.getElementById(id)?.value) || 0);
        const fw = window.MathUtils.formatValue;

        let h1 = '', h2 = '';
        s.currentG = null;
        s.currentC = null;

        ['2F', '1F'].forEach(f => {
            if (!reqWall[f]) return;
            
            const rX = reqWall[f].qX || 0;
            const rY = reqWall[f].qY || 0;
            const suffix = f[0];
            const cq = getVal(`c-q${suffix}`);
            const ext = getVal(`e-x-t${suffix}`), exb = getVal(`e-x-b${suffix}`), eyl = getVal(`e-y-l${suffix}`), eyr = getVal(`e-y-r${suffix}`);
            
            const b = window.GridEngine.get4DivisionBounds ? window.GridEngine.get4DivisionBounds(f, s) : null;
            const d4 = s.reqWall[f].div4 || { vxt: 0, vxb: 0, vyl: 0, vyr: 0, rxt: 0, rxb: 0, ryl: 0, ryr: 0, isXOk: true, isYOk: true };
            let kxt = 0, kyt = 0, sx = 0, sy = 0;

            walls.filter(w => w.floor === f).forEach(w => {
                const dx = Math.abs(w.p2.x - w.p1.x) / 1000;
                const dy = Math.abs(w.p2.y - w.p1.y) / 1000;
                const tv = window.WallEngine.getTotalMultiplier(w);

                const cx = (w.p1.x + w.p2.x) / 2;
                const cy = (w.p1.y + w.p2.y) / 2;

                const kx = dx * tv;
                const ky = dy * tv;

                kxt += kx; sy += kx * cy; kyt += ky; sx += ky * cx;
            });

            if (f === currentFloor) {
                let polys = areaLines.filter(a => a.floor === f);
                if (polys.length > 0) {
                    let totalArea = 0, sumCx = 0, sumCy = 0;
                    polys.forEach(poly => {
                        let c = window.MathUtils.polygonCentroid(poly.vertices);
                        if (c && c.area > 0) { totalArea += c.area; sumCx += c.x * c.area; sumCy += c.y * c.area; }
                    });
                    if (totalArea > 0) s.currentG = { x: sumCx / totalArea, y: sumCy / totalArea };
                }
                if (!s.currentG) {
                    let ap = pillars.filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === f || p.floor === 'ALL'));
                    if (ap.length > 0) s.currentG = { x: ap.reduce((sum, p) => sum + p.x, 0) / ap.length, y: ap.reduce((sum, p) => sum + p.y, 0) / ap.length };
                }
                if (kyt > 0 && kxt > 0) s.currentC = { x: sx / kyt, y: sy / kxt }; else s.currentC = s.currentG;
            }

            const basisText = reqWall[f].basis || '';
            const calcModeStr = document.getElementById('calc-mode-select')?.value === 'seinou' ? '性能表示(見上げ面積)' : '建築基準法(見下げ面積)';
            
            let h = `<div style="background:#555;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px;margin-top:5px">${f} 壁量</div>
                     <div style="font-size:10px; color:#555; margin:3px 0 5px 0; line-height:1.3; border:1px solid #ddd; padding:4px; background:#fafafa;">
                        <b>【${calcModeStr}】床面積の算定根拠:</b><br>${basisText}
                     </div>
                     <table class="report-table">
                        <tr><th>方向</th><th>必要(m)</th><th>存在(m)</th><th>判定</th></tr>
                        <tr><td>X</td><td>${rX.toFixed(2)}</td><td>${kxt.toFixed(2)}</td><td class="${kxt >= rX ? 'bg-ok' : 'bg-ng'}">${kxt >= rX ? 'OK' : 'NG'}</td></tr>
                        <tr><td>Y</td><td>${rY.toFixed(2)}</td><td>${kyt.toFixed(2)}</td><td class="${kyt >= rY ? 'bg-ok' : 'bg-ng'}">${kyt >= rY ? 'OK' : 'NG'}</td></tr>
                     </table>`;

            h += `<div style="background:#0056b3;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px">4分割 壁釣り合い</div>
                  <table class="report-table">
                    <tr><th>向</th><th>側端</th><th>必要(m)</th><th>存在(m)</th><th>充足</th><th>率比</th><th>判定</th></tr>
                    <tr><td rowspan="2">X</td><td>上</td><td>${(ext * cq).toFixed(2)}</td><td>${d4.vxt.toFixed(2)}</td><td>${d4.rxt.toFixed(2)}</td><td rowspan="2">${(Math.min(d4.rxt, d4.rxb) / (Math.max(d4.rxt, d4.rxb) || 1)).toFixed(2)}</td><td rowspan="2" class="${d4.isXOk ? 'bg-ok' : 'bg-ng'}">${d4.isXOk ? 'OK' : 'NG'}</td></tr>
                    <tr><td>下</td><td>${(exb * cq).toFixed(2)}</td><td>${d4.vxb.toFixed(2)}</td><td>${d4.rxb.toFixed(2)}</td></tr>
                    <tr><td rowspan="2">Y</td><td>左</td><td>${(eyl * cq).toFixed(2)}</td><td>${d4.vyl.toFixed(2)}</td><td>${d4.ryl.toFixed(2)}</td><td rowspan="2">${(Math.min(d4.ryl, d4.ryr) / (Math.max(d4.ryl, d4.ryr) || 1)).toFixed(2)}</td><td rowspan="2" class="${d4.isYOk ? 'bg-ok' : 'bg-ng'}">${d4.isYOk ? 'OK' : 'NG'}</td></tr>
                    <tr><td>右</td><td>${(eyr * cq).toFixed(2)}</td><td>${d4.vyr.toFixed(2)}</td><td>${d4.ryr.toFixed(2)}</td></tr>
                  </table>`;
            
            if (f === '2F') h2 = h; else h1 = h;
        });

        let lambdaNgRows = '';
        ['2F', '1F'].forEach(f => {
            pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === f && p.lambda != null && !p.lambdaOK).forEach(p => {
                const pName = window.GridEngine.getPillarName(p, s);
                lambdaNgRows += `<tr><td>${f[0]}</td><td>${pName || '-'}</td><td>${p.d != null ? p.d : '—'}</td><td class="bg-ng" style="font-weight:bold;">${p.lambda.toFixed(1)}</td></tr>`;
            });
        });

        const lambdaBlock = lambdaNgRows
            ? `<div style="background:#c0392b;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px;margin-top:10px;">⚠️ 有効細長比 NG柱 (${lambdaNgRows.split('<tr>').length - 1}本)</div>
               <table class="report-table"><tr><th>階</th><th>位置</th><th>小径</th><th>λ</th></tr>${lambdaNgRows}</table>`
            : '';

        // Alignment Ratio Summary (v2.3.33)
        let ratioBlock = '';
        if (window.StructuralEngine && window.StructuralEngine.calculateDirectSupportRatio) {
            const r = window.StructuralEngine.calculateDirectSupportRatio(s);
            const getJText = (val, th1, th2) => {
                if (val < th1) return '<span style="color:#e74c3c;font-weight:bold;">NG</span>';
                if (val < th2) return '<span style="color:#f1c40f;font-weight:bold;">!</span>';
                return '<span style="color:#2ecc71;font-weight:bold;">OK</span>';
            };
            ratioBlock = `<div style="background:#e67e22;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px;margin-top:10px">📐 直下率</div>
                          <table class="report-table">
                            <tr><th>項目</th><th>割合</th><th>判定</th></tr>
                            <tr><td>柱 直下率</td><td>${r.pRatio.toFixed(1)}%</td><td>${getJText(r.pRatio, 50, 60)}</td></tr>
                            <tr><td>壁 総合直下率</td><td>${r.wRatioTotal.toFixed(1)}%</td><td>${getJText(r.wRatioTotal, 40, 60)}</td></tr>
                          </table>`;
        }

        const lc = document.getElementById('left-report-container');
        if (lc) lc.innerHTML = h1 + h2 + lambdaBlock;
    },

    /**
     * 凡例表示用のデータを構築します
     */
    buildWallLegendData: function(state) {
        const s = state || window.AppState;
        const panelDic = {};
        const wallMaster = s.getMasterWallList ? s.getMasterWallList() : [];
        
        wallMaster.forEach(m => {
            if (m.val > 0) {
                panelDic[m.val.toFixed(2)] = m.text.charAt(0);
            }
        });
        
        return { panelDic };
    }
};
