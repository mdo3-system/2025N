$path = "d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\wall_4split_renew\mdo3_local\app\assets\js\modules\wall_4split\wall_4split_report.js"
$text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

$regex1 = '(?s)function showCenterCalc\(\) \{.*?\}\s*// ★ 左パネル用のシンプルな必要壁量表示（計算根拠なし）'
$replacement1 = 'function showCenterCalc() {
    let html = '''';
    [''1F'', ''2F''].forEach(f => {
        let cr = window.AppState.calcResults ? window.AppState.calcResults[`cog_${f}`] : null;
        let wa = window.AppState.calcResults ? window.AppState.calcResults[`wallAmount_${f}`] : null;
        
        let Gx = cr ? cr.Gx : 0;
        let Gy = cr ? cr.Gy : 0;
        let gText = cr && cr.isApproximation 
            ? `<p style="color:#e74c3c;"><b>【略算 重心】</b> 床面積ポリゴンがないため、柱座標の平均で略算。<br>Gx = <b>${Gx.toFixed(2)}</b>, Gy = <b>${Gy.toFixed(2)}</b></p>`
            : `<p><b>【正確な重心】</b> 面積ポリゴンの図心より算出。<br>Gx = <b>${Gx.toFixed(2)}</b>, Gy = <b>${Gy.toFixed(2)}</b></p>`;
            
        let Cx = wa ? wa.Cx : Gx;
        let Cy = wa ? wa.Cy : Gy;
        let sx = wa ? wa.sx : 0;
        let sy = wa ? wa.sy : 0;
        let ky_t = wa ? wa.existY : 0;
        let kx_t = wa ? wa.existX : 0;
        
        let xW = [], yW = [];
        if (wa && wa.details) {
            wa.details.forEach(d => {
                if (d.kx > 0) xW.push(`<li>[X壁] Kx=${d.kx.toFixed(2)} , Y=${d.cy.toFixed(2)} → Kx*Y=${(d.kx * d.cy).toFixed(2)}</li>`);
                if (d.ky > 0) yW.push(`<li>[Y壁] Ky=${d.ky.toFixed(2)} , X=${d.cx.toFixed(2)} → Ky*X=${(d.ky * d.cx).toFixed(2)}</li>`);
            });
        }

        html += `<h3>■ ${f} 重心・剛心 算出根拠</h3>${gText}
        <p><b>【剛心】</b><br>Cx = ${sx.toFixed(2)} / ${ky_t.toFixed(2)} = <b>${Cx.toFixed(2)}</b></p><ul style="max-height:100px;overflow-y:auto;border:1px solid #ccc;padding:5px;font-size:11px;">${yW.join('''')}</ul>
        <p>Cy = ${sy.toFixed(2)} / ${kx_t.toFixed(2)} = <b>${Cy.toFixed(2)}</b></p><ul style="max-height:100px;overflow-y:auto;border:1px solid #ccc;padding:5px;font-size:11px;">${xW.join('''')}</ul>`;
    });
    let cc = document.getElementById(''center-calc-container'');
    if (cc) { cc.innerHTML = html; document.getElementById(''modal-center'').style.display = ''flex''; }
}

// ★ 左パネル用のシンプルな必要壁量表示（計算根拠なし）'

$text = [System.Text.RegularExpressions.Regex]::Replace($text, $regex1, $replacement1)

$regex2 = '(?s)function updateReport\(\) \{.*?(?=// ==========================================)'
$replacement2 = 'function updateReport() {
    let h1 = '''', h2 = ''''; currentG = null; currentC = null;
    [''2F'', ''1F''].forEach(f => {
        let cr = window.AppState.calcResults ? window.AppState.calcResults[`cog_${f}`] : null;
        let wa = window.AppState.calcResults ? window.AppState.calcResults[`wallAmount_${f}`] : null;
        let db = window.AppState.calcResults ? window.AppState.calcResults[`div4Balance_${f}`] : null;

        let rX = reqWall[f]?.qX || 0, rY = reqWall[f]?.qY || 0;
        let basisText = reqWall[f]?.basis || '''';
        
        let kxt = wa ? wa.existX : 0;
        let kyt = wa ? wa.existY : 0;

        if (f === currentFloor) {
            if (cr) currentG = { x: cr.Gx, y: cr.Gy };
            if (wa) currentC = { x: wa.Cx, y: wa.Cy };
        }

        let calcModeStr = document.getElementById(''calc-mode-select'')?.value === ''seinou'' ? ''性能表示(見上げ面積)'' : ''建築基準法(見下げ面積)'';
        let h = `<div style="background:#555;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px;margin-top:5px">${f} 壁量</div>
                 <div style="font-size:10px; color:#555; margin:3px 0 5px 0; line-height:1.3; border:1px solid #ddd; padding:4px; background:#fafafa;">
                    <b>【${calcModeStr}】床面積の算定根拠:</b><br>${basisText}
                 </div>
                 <table class="report-table"><tr><th>方向</th><th>必要(m)</th><th>存在(m)</th><th>判定</th></tr><tr><td>X</td><td>${rX.toFixed(2)}</td><td>${kxt.toFixed(2)}</td><td class="${kxt >= rX ? ''bg-ok'' : ''bg-ng''}">${kxt >= rX ? ''OK'' : ''NG''}</td></tr><tr><td>Y</td><td>${rY.toFixed(2)}</td><td>${kyt.toFixed(2)}</td><td class="${kyt >= rY ? ''bg-ok'' : ''bg-ng''}">${kyt >= rY ? ''OK'' : ''NG''}</td></tr></table>`;
        
        if (db) {
            let req_xt = db.req_xt, req_xb = db.req_xb, req_yl = db.req_yl, req_yr = db.req_yr;
            let vxt = wa.div4.vxt, vxb = wa.div4.vxb, vyl = wa.div4.vyl, vyr = wa.div4.vyr;
            let rxt = db.rt_xt, rxb = db.rt_xb, ryl = db.rt_yl, ryr = db.rt_yr;
            let rx = db.rx, ry = db.ry;
            let isXOk = db.isXOk, isYOk = db.isYOk;
            
            h += `<div style="background:#0056b3;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px">4分割 壁釣り合い</div><table class="report-table"><tr><th>向</th><th>側端</th><th>必要(m)</th><th>存在(m)</th><th>充足</th><th>率比</th><th>判定</th></tr><tr><td rowspan="2">X</td><td>上</td><td>${req_xt.toFixed(2)}</td><td>${vxt.toFixed(2)}</td><td>${rxt.toFixed(2)}</td><td rowspan="2">${rx.toFixed(2)}</td><td rowspan="2" class="${isXOk ? ''bg-ok'' : ''bg-ng''}">${isXOk ? ''OK'' : ''NG''}</td></tr><tr><td>下</td><td>${req_xb.toFixed(2)}</td><td>${vxb.toFixed(2)}</td><td>${rxb.toFixed(2)}</td></tr><tr><td rowspan="2">Y</td><td>左</td><td>${req_yl.toFixed(2)}</td><td>${vyl.toFixed(2)}</td><td>${ryl.toFixed(2)}</td><td rowspan="2">${ry.toFixed(2)}</td><td rowspan="2" class="${isYOk ? ''bg-ok'' : ''bg-ng''}">${isYOk ? ''OK'' : ''NG''}</td></tr><tr><td>右</td><td>${req_yr.toFixed(2)}</td><td>${vyr.toFixed(2)}</td><td>${ryr.toFixed(2)}</td></tr></table>`;
        }
        if (f === ''2F'') h2 = h; else h1 = h;
    });

    let lambdaNgRows = '''';
    [''2F'', ''1F''].forEach(f => {
        pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === f && p.lambda != null && !p.lambdaOK).forEach(p => {
            lambdaNgRows += `<tr><td>${f[0]}</td><td>${window.getPillarName(p) || ''-''}</td><td>${p.d != null ? p.d : ''—''}</td><td class="bg-ng" style="font-weight:bold;">${p.lambda.toFixed(1)}</td></tr>`;
        });
    });
    let lambdaBlock = lambdaNgRows
        ? `<div style="background:#c0392b;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px;margin-top:10px;">⚠️ 有効細長比 NG柱 (${lambdaNgRows.split(''<tr>'').length - 1}本)</div><table class="report-table"><tr><th>階</th><th>位置</th><th>小径</th><th>λ</th></tr>${lambdaNgRows}</table>`
        : '''';

    let lc = document.getElementById(''left-report-container''); if (lc) lc.innerHTML = h1 + h2 + lambdaBlock;
}
'

$text = [System.Text.RegularExpressions.Regex]::Replace($text, $regex2, $replacement2)

[System.IO.File]::WriteAllText($path, $text, [System.Text.Encoding]::UTF8)
