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
            let kxt = 0, kyt = 0, sx = 0, sy = 0, vxt = 0, vxb = 0, vyl = 0, vyr = 0;

            walls.filter(w => w.floor === f).forEach(w => {
                const dx = Math.abs(w.p2.x - w.p1.x) / 1000;
                const dy = Math.abs(w.p2.y - w.p1.y) / 1000;
                const tv = window.WallEngine.getTotalMultiplier(w);

                const cx = (w.p1.x + w.p2.x) / 2;
                const cy = (w.p1.y + w.p2.y) / 2;

                const kx = dx * tv;
                const ky = dy * tv;

                kxt += kx; sy += kx * cy; kyt += ky; sx += ky * cx;
                if (b && cy >= b.yTop) vxt += kx;
                if (b && cy <= b.yBottom) vxb += kx;
                if (b && cx <= b.xLeft) vyl += ky;
                if (b && cx >= b.xRight) vyr += ky;
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

            const rxt = vxt / (ext * cq || 1), rxb = vxb / (exb * cq || 1), ryl = vyl / (eyl * cq || 1), ryr = vyr / (eyr * cq || 1);
            const rx = Math.min(rxt, rxb) / (Math.max(rxt, rxb) || 1), ry = Math.min(ryl, ryr) / (Math.max(ryl, ryr) || 1);
            const isXOk = (rx >= 0.5) || (rxt >= 1.0 && rxb >= 1.0);
            const isYOk = (ry >= 0.5) || (ryl >= 1.0 && ryr >= 1.0);

            h += `<div style="background:#0056b3;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px">4分割 壁釣り合い</div>
                  <table class="report-table">
                    <tr><th>向</th><th>側端</th><th>必要(m)</th><th>存在(m)</th><th>充足</th><th>率比</th><th>判定</th></tr>
                    <tr><td rowspan="2">X</td><td>上</td><td>${(ext * cq).toFixed(2)}</td><td>${vxt.toFixed(2)}</td><td>${rxt.toFixed(2)}</td><td rowspan="2">${rx.toFixed(2)}</td><td rowspan="2" class="${isXOk ? 'bg-ok' : 'bg-ng'}">${isXOk ? 'OK' : 'NG'}</td></tr>
                    <tr><td>下</td><td>${(exb * cq).toFixed(2)}</td><td>${vxb.toFixed(2)}</td><td>${rxb.toFixed(2)}</td></tr>
                    <tr><td rowspan="2">Y</td><td>左</td><td>${(eyl * cq).toFixed(2)}</td><td>${vyl.toFixed(2)}</td><td>${ryl.toFixed(2)}</td><td rowspan="2">${ry.toFixed(2)}</td><td rowspan="2" class="${isYOk ? 'bg-ok' : 'bg-ng'}">${isYOk ? 'OK' : 'NG'}</td></tr>
                    <tr><td>右</td><td>${(eyr * cq).toFixed(2)}</td><td>${vyr.toFixed(2)}</td><td>${ryr.toFixed(2)}</td></tr>
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
