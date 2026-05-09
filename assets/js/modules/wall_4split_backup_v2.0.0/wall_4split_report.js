// ==========================================
// wall_4split_report.js - 計算制御・DOM出力ユーティリティ (Phase 3.5)
// triggerUpdate, renderAll, getVal/getStr/getMode, getHardwareList, updateWallSelects,
// analyzeGrids, showPillarProps/hidePillarProps
// データは window.AppState / グローバル変数から参照します。
// ==========================================

// --- ここから下は既存のコードそのまま ---
const fw = (v, d = 3) => (v != null && isFinite(v)) ? Number(v).toFixed(d) : '—';

function getVal(id) { let el = document.getElementById(id); return el ? parseFloat(el.value) || 0 : 0; }
function getStr(id) { let el = document.getElementById(id); return el ? el.value : ''; }
function getMode() { let el = document.querySelector('input[name="mode"]:checked'); return el ? el.value : 'wall'; }

function triggerUpdate() {
    requestAnimationFrame(() => {
        updateCalculations();
        renderAll();

        // [基礎計算追加 Phase4] 基礎梁が選択されている場合、レポート表示を最新の状態に更新する
        if (window.AppState && window.AppState.currentAppMode === 'foundation' && window.AppState.selectedFoundationBeam) {
            const panel = document.getElementById('beam-props');
            if (panel && typeof getFoundationBeamReportHtml === 'function') {
                panel.innerHTML = getFoundationBeamReportHtml(window.AppState.selectedFoundationBeam);
            }
        }
    });
}
function renderAll() { updateReport(); draw(); }

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

// ★ 無制限に追加されたリストから取得するよう修正
function getHardwareList() {
    let list = [
        { name: "L", n: 0.65 }, { name: "V", n: 1.0 }, { name: "Is", n: 1.4 }, { name: "Ps", n: 1.6 },
        { name: "2", n: 1.8 }, { name: "3", n: 2.8 }, { name: "4", n: 3.7 }, { name: "5", n: 4.7 }, { name: "32", n: 5.6 }
    ];
    document.querySelectorAll('.cust-hw-row').forEach(row => {
        let nEl = row.querySelector('.cust-h-n');
        let vEl = row.querySelector('.cust-h-v');
        if (nEl && vEl && nEl.value && !isNaN(parseFloat(vEl.value))) {
            list.push({ name: nEl.value, n: parseFloat(vEl.value) / 5.3, isCust: true });
        }
    });
    list.sort((a, b) => a.n - b.n);
    return list;
}

// ★ 面材selectの倍率取得（value属性はopt0等の一意IDのためdata-valを使用）
function getPanelVal(id) {
    let el = document.getElementById(id);
    if (!el || el.selectedIndex < 0) return 0;
    let opt = el.options[el.selectedIndex];
    return parseFloat(opt ? (opt.dataset.val || 0) : 0) || 0;
}

// ★ 無制限に追加された面材リストから取得するよう修正
function updateWallSelects() {
    // 1. 面材プルダウンの更新（カスタム面材を動的に反映）
    let customWalls = getCustomWallList();
    ['wall-p1', 'wall-p2'].forEach(id => {
        let sel = document.getElementById(id);
        if (!sel) return;
        let prevVal = sel.value;
        
        // 標準面材（⑧まで）
        let baseOptions = [
            { id: "opt0", val: 0, text: "なし" },
            { id: "opt1", val: 2.5, text: "①構造用面材 大壁・受材共 N50＠150 (2.5倍)" },
            { id: "opt2", val: 3.7, text: "②構造用合板 大壁・受材共 CN50＠75 (3.7倍)" },
            { id: "opt3", val: 2.5, text: "③構造用面材 真壁 N50＠150 (2.5倍)" },
            { id: "opt4", val: 3.3, text: "④構造用合板 真壁 CN50@75 (3.3倍)" },
            { id: "opt5", val: 3.7, text: "⑤OSB 大壁・受材共 N50＠75 (3.7倍)" },
            { id: "opt6", val: 3.3, text: "⑥OSB 真壁 N50＠75 (3.3倍)" },
            { id: "opt7", val: 4.3, text: "⑦MDF/パーティクルボード 大壁・受材共 N50＠75 (4.3倍)" },
            { id: "opt8", val: 4.0, text: "⑧MDF/パーティクルボード 真壁 N50＠75 (4.0倍)" }
        ];

        let html = '';
        baseOptions.forEach(opt => {
            html += `<option value="${opt.id}" data-val="${opt.val}">${opt.text}</option>`;
        });

        // カスタム面材（⑨以降を自動付与）
        const circles = ["⑨","⑩","⑪","⑫","⑬","⑭","⑮","⑯","⑰","⑱","⑲","⑳"];
        customWalls.forEach((cw, idx) => {
            let cid = `cust-${idx}`;
            let mark = (idx < circles.length) ? circles[idx] : `(${idx + 9})`;
            html += `<option value="${cid}" data-val="${cw.val}">${mark}${cw.name} (${cw.val}倍)</option>`;
        });
        sel.innerHTML = html;
        
        // 以前の選択状態を復元（なければデフォルト）
        if (Array.from(sel.options).some(o => o.value === prevVal)) {
            sel.value = prevVal;
        } else {
            sel.value = "opt0";
        }
    });

    // 2. 金物リストの更新（維持）
    let hwList = getHardwareList();
    let sel = document.getElementById('prop-mark');
    if (sel) {
        let cv = sel.value; let html = `<option value="">自動計算</option>`;
        hwList.forEach(hw => { html += `<option value="${hw.name}">${hw.isCust ? '[任意] ' : ''}${hw.name} (${hw.n.toFixed(2)}以下)</option>`; });
        html += `<option value="別途検討">別途検討 (5.6超)</option>`;
        sel.innerHTML = html;
        if (Array.from(sel.options).some(o => o.value === cv)) sel.value = cv; else sel.value = "";
    }

    // 3. 合計倍率の計算と上限警告（維持）
    let p1Val = getPanelVal('wall-p1');
    let p2Val = getPanelVal('wall-p2');
    let bVal = getVal('wall-b');
    let t = p1Val + p2Val + bVal;
    let el = document.getElementById('total-val');
    if (el) {
        if (t > 7.0) { el.style.color = "red"; el.innerText = `${t.toFixed(1)} (上限超過)`; }
        else { el.style.color = "#0056b3"; el.innerText = t.toFixed(1); }
    }
    currentTotalVal = t;
}

function analyzeGrids() {
    let validPillars = pillars.filter(p => !p.isDeleted);
    // ★修正点1：柱が0本でも early return せずに処理を続行する
    // if (validPillars.length === 0) return;

    let gridLineXs = [], gridLineYs = [];
    const TOL_SNAP = 2; // ★近接グリッドのマージ制限を2mmに縮小
    const TEXT_GRID_TOL_WIDE = 300; // ★文字検索の許容誤差

    bgLinesOriginal.forEach(e => {
        if (e.isGridLine && e.type === 'LINE' && e.vertices && e.vertices.length === 2) {
            let p1 = e.vertices[0], p2 = e.vertices[1];
            let dx = Math.abs(p1.x - p2.x), dy = Math.abs(p1.y - p2.y);
            // 短いグリッド線も拾えるように緩和
            if (Math.max(dx, dy) > 100) {
                if (dx < TOL_SNAP) gridLineXs.push((p1.x + p2.x) / 2);
                if (dy < TOL_SNAP) gridLineYs.push((p1.y + p2.y) / 2);
            }
        }
    });

    // 柱をグリッド線にスナップ
    validPillars.forEach(p => {
        let gx = gridLineXs.find(x => Math.abs(x - p.x) < TOL_SNAP);
        if (gx !== undefined) p.x = gx;
        let gy = gridLineYs.find(y => Math.abs(y - p.y) < TOL_SNAP);
        if (gy !== undefined) p.y = gy;
    });

    // 通り芯の座標リスト（master）を作成
    let masterXs = [], masterYs = [];

    // ① ★修正点2：グリッド線からマスター座標を登録（柱が0本でもグリッドを描画するため）
    gridLineXs.forEach(x => { if (!masterXs.some(mx => Math.abs(mx - x) < TOL_SNAP)) masterXs.push(x); });
    gridLineYs.forEach(y => { if (!masterYs.some(my => Math.abs(my - y) < TOL_SNAP)) masterYs.push(y); });

    // ② 柱からの座標登録（グリッド線が引かれていない箇所の柱を救済）
    validPillars.forEach(p => {
        if (!masterXs.some(x => Math.abs(x - p.x) < TOL_SNAP)) masterXs.push(p.x);
        if (!masterYs.some(y => Math.abs(y - p.y) < TOL_SNAP)) masterYs.push(p.y);
    });

    // ③ 手動追加グリッドの登録
    manualGridX.forEach(m => { if (!masterXs.some(x => Math.abs(x - m.coord) < TOL_SNAP)) masterXs.push(m.coord); });
    manualGridY.forEach(m => { if (!masterYs.some(y => Math.abs(y - m.coord) < TOL_SNAP)) masterYs.push(m.coord); });

    masterXs.sort((a, b) => a - b); masterYs.sort((a, b) => a - b);
    
    // ★ 課題2：ブラックリスト(deletedGridX/Y)に含まれる座標を除明する
    masterXs = masterXs.filter(mx => !deletedGridX.some(dx => Math.abs(dx - mx) < TOL_SNAP));
    masterYs = masterYs.filter(my => !deletedGridY.some(dy => Math.abs(dy - my) < TOL_SNAP));

    window.masterXs = masterXs; window.masterYs = masterYs; // 他ファイル（cad.js等）から参照可能にする

    // 柱の座標を統合したマスター座標で揃える
    validPillars.forEach(p => {
        let mx = masterXs.find(x => Math.abs(x - p.x) < TOL_SNAP);
        if (mx !== undefined) p.x = mx;
        let my = masterYs.find(y => Math.abs(y - p.y) < TOL_SNAP);
        if (my !== undefined) p.y = my;
    });

    ['1F', '2F'].forEach(targetFloor => {
        let cfPillars = validPillars.filter(p => p.floor === targetFloor);

        // ★修正点3：柱が0本でも表示に必要なので return せず続行
        // if (cfPillars.length === 0) return;

        // ★ 通り芯名の完全マッピングルール
        // 推測（isNear階層判別など）を一切排除し、GRIDレイヤの文字だけを完全一致として扱う
        let availableGridTexts = bgTextsOriginal.filter(t => t.isGridText);

        let nameMapX = {}, nameMapY = {};

        manualGridX.forEach(m => { nameMapX[m.coord] = m.name; });
        manualGridY.forEach(m => { nameMapY[m.coord] = m.name; });

        // X軸（横方向に対するマッピング：X座標が近い文字を探す）
        masterXs.forEach(x => {
            if (nameMapX[x]) return;
            let possibleTexts = availableGridTexts.filter(t => Math.abs(t.x - x) < TEXT_GRID_TOL_WIDE);
            if (possibleTexts.length > 0) {
                possibleTexts.sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));
                nameMapX[x] = possibleTexts[0].text.trim().normalize("NFKC").toUpperCase();
                // 採用されたテキストはY軸など他へ再利用されないようリストから省く
                availableGridTexts = availableGridTexts.filter(at => at !== possibleTexts[0]);
            }
        });

        // Y軸（縦方向に対するマッピング：Y座標が近い文字を探す）
        masterYs.forEach(y => {
            if (nameMapY[y]) return;
            let possibleTexts = availableGridTexts.filter(t => Math.abs(t.y - y) < TEXT_GRID_TOL_WIDE);
            if (possibleTexts.length > 0) {
                possibleTexts.sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y));
                nameMapY[y] = possibleTexts[0].text.trim().normalize("NFKC").toUpperCase();
                availableGridTexts = availableGridTexts.filter(at => at !== possibleTexts[0]);
            }
        });

        // 📝 ユーザー手動上書きがあれば優先、なければ直近のGRID文字、それもなければ自動連番X1, Y1...
        let nx = masterXs.map((x, i) => (window.userEditedGridX && window.userEditedGridX[x]) || nameMapX[x] || `X${i + 1}`);
        let ny = masterYs.map((y, i) => (window.userEditedGridY && window.userEditedGridY[y]) || nameMapY[y] || `Y${i + 1}`);

        // ★ 柱の座標から動的に最新の通り芯名称を取得する関数
        window.getPillarName = function (p) {
            if (!p) return '位置不明';
            let xi = gridXCoords.indexOf(p.x); let yi = gridYCoords.indexOf(p.y);
            let gx = xi >= 0 ? gridXNames[xi] : (p.gx || '?');
            let gy = yi >= 0 ? gridYNames[yi] : (p.gy || '?');
            if (window.userEditedGridX && window.userEditedGridX[p.x]) gx = window.userEditedGridX[p.x];
            if (window.userEditedGridY && window.userEditedGridY[p.y]) gy = window.userEditedGridY[p.y];
            if (gx === '?' && gy === '?') return '位置不明';
            return `${gx}${gy}`;
        };

        cfPillars.forEach(p => {
            let xi = masterXs.indexOf(p.x);
            let yi = masterYs.indexOf(p.y);
            if (xi >= 0 && yi >= 0) {
                p.gx = nx[xi]; p.gy = ny[yi]; p.gName = `${p.gx}${p.gy}`;
                p.isInvalidPos = false;
            } else {
                p.gx = '?'; p.gy = '?'; p.gName = '位置不明';
                p.isInvalidPos = true;
            }
        });

        if (targetFloor === currentFloor) {
            gridXCoords = masterXs; gridXNames = nx;
            gridYCoords = masterYs; gridYNames = ny;
        }
    });
}

function showPillarProps(p) {
    let pp = document.getElementById('pillar-props'); if (!pp) return;
    pp.style.display = 'block';
    let pid = document.getElementById('prop-id'); if (pid) pid.innerText = getPillarName(p) || '-';

    let cb = document.getElementById('prop-corner');
    if (cb) { cb.checked = p.isManualCorner !== null ? p.isManualCorner : p.isCornerAuto; cb.onchange = function () { p.isManualCorner = this.checked; triggerUpdate(); showPillarProps(p); }; }

    let ph = document.getElementById('prop-h');
    if (ph) { ph.value = p.manualH ? p.manualH : ""; ph.onchange = function () { p.manualH = this.value === "" ? null : parseFloat(this.value); triggerUpdate(); showPillarProps(p); }; }

    let pd = document.getElementById('prop-d');
    if (pd) { pd.value = p.manualD ? p.manualD : ""; pd.onchange = function () { p.manualD = this.value === "" ? null : parseFloat(this.value); triggerUpdate(); showPillarProps(p); }; }

    let pa = document.getElementById('prop-area');
    if (pa) { pa.value = p.manualArea !== null && p.manualArea !== undefined ? p.manualArea : ""; pa.onchange = function () { p.manualArea = this.value === "" ? null : parseFloat(this.value); triggerUpdate(); showPillarProps(p); }; }

    let pl = document.getElementById('prop-lcalc');
    if (pl) { pl.value = p.lCalcMode || "auto"; pl.onchange = function () { p.lCalcMode = this.value; triggerUpdate(); showPillarProps(p); }; }

    let sel = document.getElementById('prop-mark');
    if (sel) { sel.value = p.manualMark ? p.manualMark : ""; sel.onchange = function () { p.manualMark = this.value === "" ? null : this.value; triggerUpdate(); showPillarProps(p); }; }

    let alertBox = document.getElementById('prop-hw-alert');
    if (alertBox) {
        alertBox.innerText = "";
        if (p.manualMark) { let hw = getHardwareList().find(h => h.name === p.manualMark); if (hw && p.nValue > hw.n) { alertBox.innerText = `⚠️ NG! 指定金物の耐力不足`; } }
    }

    let pdText = document.getElementById('prop-detail');
    if (pdText) {
        const isC = p.isManualCorner !== null ? p.isManualCorner : p.isCornerAuto;
        const Nx = fw(p.nCalcX, 2), Ny = fw(p.nCalcY, 2), N = fw(p.nValue, 2);
        let L_str = p.lCalcMode === 'detail' ? `詳細(面積 ${p.usedArea?.toFixed(2)}㎡×荷重)` : `告示(${isC ? '角' : '一般'})`;
        let detail = '';
        if (p.nValue === undefined) { detail = '接続壁なし（計算未実行）'; }
        else {
            const areaWarn = (p.lCalcMode === 'detail' && !(p.usedArea > 0)) ? '\n⚠️ 負担面積=0: 隣接柱が未検出です。手動で面積を入力してください。' : '';
            detail = ['【N値計算 - Ｎ値計算法（斜め壁はグレー本準拠）】', `柱: ${getPillarName(p) || '-'}  (${p.floor})`, `押さえ効果L: ${L_str} = ${p.L_val?.toFixed(2)}`, '', '─ X方向地震（Y方向壁 左右差）─', `  計算式: ${p.cStrX || '-'}`, `  Nx = ${Nx}`, '', '─ Y方向地震（X方向壁 上下差）─', `  計算式: ${p.cStrY || '-'}`, `  Ny = ${Ny}`, '', `採用N値 = max(Nx, Ny, 0) = ${N}`, `判定金物: ${p.nMark || '-'}`, p.manualMark ? `※手動指定: ${p.manualMark}` : '', areaWarn].filter(s => s !== null).join('\n');
        }
        pdText.innerText = detail;
    }
}

function hidePillarProps() { let pp = document.getElementById('pillar-props'); if (pp) pp.style.display = 'none'; }

// ==========================================
// 以下は calc.js (Phase 3.8) より移動: DOM出力関数
// showCenterCalc() - 重心・剛心モーダル
// updateReport()   - 左パネル壁量レポート更新
// ==========================================

function showCenterCalc() {
    let html = '';
    ['1F', '2F'].forEach(f => {
        let polys = areaLines.filter(a => a.floor === f);
        let Gx = 0, Gy = 0, gText = "";

        if (polys.length > 0) {
            let totalArea = 0, sumCx = 0, sumCy = 0;
            polys.forEach(poly => {
                let c = Geometry.polygonCentroid(poly.vertices);
                if (c && c.area > 0) { totalArea += c.area; sumCx += c.x * c.area; sumCy += c.y * c.area; }
            });
            if (totalArea > 0) { Gx = sumCx / totalArea; Gy = sumCy / totalArea; gText = `<p><b>【正確な重心】</b> 面積ポリゴンの図心より算出。<br>Gx = <b>${Gx.toFixed(2)}</b>, Gy = <b>${Gy.toFixed(2)}</b></p>`; }
        }

        if (Gx === 0 && Gy === 0) {
            let ap = pillars.filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === f || p.floor === 'ALL'));
            let spx = 0, spy = 0, pc = ap.length;
            ap.forEach(p => { spx += p.x; spy += p.y; });
            Gx = pc > 0 ? spx / pc : 0; Gy = pc > 0 ? spy / pc : 0;
            gText = `<p style="color:#e74c3c;"><b>【略算 重心】</b> 床面積ポリゴンがないため、柱座標の平均で略算。<br>Gx = ${spx.toFixed(2)} / ${pc} = <b>${Gx.toFixed(2)}</b>, Gy = ${spy.toFixed(2)} / ${pc} = <b>${Gy.toFixed(2)}</b></p>`;
        }

        let kx_t = 0, ky_t = 0, sx = 0, sy = 0, xW = [], yW = [];
        walls.filter(w => w.floor === f).forEach(w => {
            // ★修正2：剛心計算（壁量）での作用位置中点化と成分ごとのベクトル乗算
            let dx = Math.abs(w.p2.x - w.p1.x) / 1000; // X方向の長さ(m)
            let dy = Math.abs(w.p2.y - w.p1.y) / 1000; // Y方向の長さ(m)
            let tv = w.totalVal || 0;

            // 作用位置は両端の柱の中点
            let cx = (w.p1.x + w.p2.x) / 2;
            let cy = (w.p1.y + w.p2.y) / 2;

            // 各成分ごとの壁量（長さ×倍率）
            let kx = dx * tv;
            let ky = dy * tv;

            kx_t += kx; sy += kx * cy; ky_t += ky; sx += ky * cx;
            if (kx > 0) xW.push(`<li>[X壁] Kx=${kx.toFixed(2)} , Y=${cy.toFixed(2)} → Kx*Y=${(kx * cy).toFixed(2)}</li>`);
            if (ky > 0) yW.push(`<li>[Y壁] Ky=${ky.toFixed(2)} , X=${cx.toFixed(2)} → Ky*X=${(ky * cx).toFixed(2)}</li>`);
        });
        let Cx = ky_t > 0 ? sx / ky_t : Gx, Cy = kx_t > 0 ? sy / kx_t : Gy;

        html += `<h3>■ ${f} 重心・剛心 算出根拠</h3>${gText}
        <p><b>【剛心】</b><br>Cx = ${sx.toFixed(2)} / ${ky_t.toFixed(2)} = <b>${Cx.toFixed(2)}</b></p><ul style="max-height:100px;overflow-y:auto;border:1px solid #ccc;padding:5px;font-size:11px;">${yW.join('')}</ul>
        <p>Cy = ${sy.toFixed(2)} / ${kx_t.toFixed(2)} = <b>${Cy.toFixed(2)}</b></p><ul style="max-height:100px;overflow-y:auto;border:1px solid #ccc;padding:5px;font-size:11px;">${xW.join('')}</ul>`;
    });
    let cc = document.getElementById('center-calc-container');
    if (cc) { cc.innerHTML = html; document.getElementById('modal-center').style.display = 'flex'; }
}

// ★ 左パネル用のシンプルな必要壁量表示（計算根拠なし）
function updateReport() {
    let h1 = '', h2 = ''; currentG = null; currentC = null;
    ['2F', '1F'].forEach(f => {
        let rX = reqWall[f].qX, rY = reqWall[f].qY;
        let cq = getVal(`c-q${f[0]}`);
        let ext = getVal(`e-x-t${f[0]}`), exb = getVal(`e-x-b${f[0]}`), eyl = getVal(`e-y-l${f[0]}`), eyr = getVal(`e-y-r${f[0]}`);
        let b = get4DivBounds(f), kxt = 0, kyt = 0, sx = 0, sy = 0, vxt = 0, vxb = 0, vyl = 0, vyr = 0;

        walls.filter(w => w.floor === f).forEach(w => {
            // ★修正3：4分割壁量集計での作用位置中点化と成分ごとのベクトル乗算
            let dx = Math.abs(w.p2.x - w.p1.x) / 1000;
            let dy = Math.abs(w.p2.y - w.p1.y) / 1000;
            let tv = w.totalVal || 0;

            let cx = (w.p1.x + w.p2.x) / 2;
            let cy = (w.p1.y + w.p2.y) / 2;

            let kx = dx * tv;
            let ky = dy * tv;

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
                polys.forEach(poly => { let c = Geometry.polygonCentroid(poly.vertices); if (c && c.area > 0) { totalArea += c.area; sumCx += c.x * c.area; sumCy += c.y * c.area; } });
                if (totalArea > 0) currentG = { x: sumCx / totalArea, y: sumCy / totalArea };
            }
            if (!currentG) {
                let ap = pillars.filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === f || p.floor === 'ALL'));
                if (ap.length > 0) currentG = { x: ap.reduce((s, p) => s + p.x, 0) / ap.length, y: ap.reduce((s, p) => s + p.y, 0) / ap.length };
            }
            if (kyt > 0 && kxt > 0) currentC = { x: sx / kyt, y: sy / kxt }; else currentC = currentG;
        }

        let basisText = reqWall[f].basis || '';
        let calcModeStr = document.getElementById('calc-mode-select')?.value === 'seinou' ? '性能表示(見上げ面積)' : '建築基準法(見下げ面積)';
        let h = `<div style="background:#555;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px;margin-top:5px">${f} 壁量</div>
                 <div style="font-size:10px; color:#555; margin:3px 0 5px 0; line-height:1.3; border:1px solid #ddd; padding:4px; background:#fafafa;">
                    <b>【${calcModeStr}】床面積の算定根拠:</b><br>${basisText}
                 </div>
                 <table class="report-table"><tr><th>方向</th><th>必要(m)</th><th>存在(m)</th><th>判定</th></tr><tr><td>X</td><td>${rX.toFixed(2)}</td><td>${kxt.toFixed(2)}</td><td class="${kxt >= rX ? 'bg-ok' : 'bg-ng'}">${kxt >= rX ? 'OK' : 'NG'}</td></tr><tr><td>Y</td><td>${rY.toFixed(2)}</td><td>${kyt.toFixed(2)}</td><td class="${kyt >= rY ? 'bg-ok' : 'bg-ng'}">${kyt >= rY ? 'OK' : 'NG'}</td></tr></table>`;
        let rxt = vxt / (ext * cq || 1), rxb = vxb / (exb * cq || 1), ryl = vyl / (eyl * cq || 1), ryr = vyr / (eyr * cq || 1);
        let rx = Math.min(rxt, rxb) / (Math.max(rxt, rxb) || 1), ry = Math.min(ryl, ryr) / (Math.max(ryl, ryr) || 1);
        let isXOk = (rx >= 0.5) || (rxt >= 1.0 && rxb >= 1.0);
        let isYOk = (ry >= 0.5) || (ryl >= 1.0 && ryr >= 1.0);
        h += `<div style="background:#0056b3;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px">4分割 壁釣り合い</div><table class="report-table"><tr><th>向</th><th>側端</th><th>必要(m)</th><th>存在(m)</th><th>充足</th><th>率比</th><th>判定</th></tr><tr><td rowspan="2">X</td><td>上</td><td>${(ext * cq).toFixed(2)}</td><td>${vxt.toFixed(2)}</td><td>${rxt.toFixed(2)}</td><td rowspan="2">${rx.toFixed(2)}</td><td rowspan="2" class="${isXOk ? 'bg-ok' : 'bg-ng'}">${isXOk ? 'OK' : 'NG'}</td></tr><tr><td>下</td><td>${(exb * cq).toFixed(2)}</td><td>${vxb.toFixed(2)}</td><td>${rxb.toFixed(2)}</td></tr><tr><td rowspan="2">Y</td><td>左</td><td>${(eyl * cq).toFixed(2)}</td><td>${vyl.toFixed(2)}</td><td>${ryl.toFixed(2)}</td><td rowspan="2">${ry.toFixed(2)}</td><td rowspan="2" class="${isYOk ? 'bg-ok' : 'bg-ng'}">${isYOk ? 'OK' : 'NG'}</td></tr><tr><td>右</td><td>${(eyr * cq).toFixed(2)}</td><td>${vyr.toFixed(2)}</td><td>${ryr.toFixed(2)}</td></tr></table>`;
        if (f === '2F') h2 = h; else h1 = h;
    });

    let lambdaNgRows = '';
    ['2F', '1F'].forEach(f => {
        pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === f && p.lambda != null && !p.lambdaOK).forEach(p => {
            lambdaNgRows += `<tr><td>${f[0]}</td><td>${window.getPillarName(p) || '-'}</td><td>${p.d != null ? p.d : '—'}</td><td class="bg-ng" style="font-weight:bold;">${p.lambda.toFixed(1)}</td></tr>`;
        });
    });
    let lambdaBlock = lambdaNgRows
        ? `<div style="background:#c0392b;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px;margin-top:10px;">⚠️ 有効細長比 NG柱 (${lambdaNgRows.split('<tr>').length - 1}本)</div><table class="report-table"><tr><th>階</th><th>位置</th><th>小径</th><th>λ</th></tr>${lambdaNgRows}</table>`
        : '';

    let lc = document.getElementById('left-report-container'); if (lc) lc.innerHTML = h1 + h2 + lambdaBlock;
}

// ==========================================
// [機能追加 立面軸力図ビューア] 帳票出力用・立面軸力図生成ロジック
// ==========================================

/**
 * 帳票出力対象の通り名リストを取得する
 * 現在のプロジェクト (wall_4split) の gridXNames, gridYNames をベースにする
 */
window.getAxesToReport = function() {
    const axes = new Set();
    // グリッド定義から取得
    if (window.gridXNames) window.gridXNames.forEach(n => { if (n && n !== '?' && !n.startsWith('X')) axes.add(n); else if(n && n!=='?') axes.add(n); });
    if (window.gridYNames) window.gridYNames.forEach(n => { if (n && n !== '?' && !n.startsWith('Y')) axes.add(n); else if(n && n!=='?') axes.add(n); });
    
    // 定義済みの通り芯名 (X1, X2... Y1, Y2...) を整理
    if (window.gridXNames) window.gridXNames.forEach(n => { if(n && n !== '?') axes.add(n); });
    if (window.gridYNames) window.gridYNames.forEach(n => { if(n && n !== '?') axes.add(n); });

    return Array.from(axes).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
};

/**
 * 特定の通りの拡大軸力図（立面）を SVG で生成する
 * データの参照先を AppState および global variables に適合
 */
window.generateEnlargedAxialDiagramSvg = function(axisName, loadDirection = 'left') {
    const floorsDesc = ['2F', '1F'];
    const floorDataMap = [];
    const h1 = parseFloat(document.getElementById('n-h1')?.value) * 1000 || 2730;
    const h2 = parseFloat(document.getElementById('n-h2')?.value) * 1000 || 2730;

    floorsDesc.forEach(f => {
        const h = (f === '2F') ? h2 : h1;
        const wallsOnAxis = (window.walls || []).filter(w => {
            if (w.floor !== f) return false;
            const n1 = window.getPillarName(w.p1);
            const n2 = window.getPillarName(w.p2);
            // 通り名が含まれるか判定
            return (n1 && (n1.startsWith(axisName) || n1.endsWith(axisName))) && 
                   (n2 && (n2.startsWith(axisName) || n2.endsWith(axisName)));
        });

        const pillarsOnAxis = (window.pillars || []).filter(p => {
            if (p.floor !== f && p.floor !== 'ALL') return false;
            if (p.isDeleted) return false;
            const nm = window.getPillarName(p);
            return nm && (nm.startsWith(axisName) || nm.endsWith(axisName));
        });

        if (wallsOnAxis.length > 0 || pillarsOnAxis.length > 0) {
            floorDataMap.push({ floor: f, walls: wallsOnAxis, columns: pillarsOnAxis, floorHeight: h });
        }
    });

    if (floorDataMap.length === 0) return `<div style="padding:20px; color:#666;">通りのデータが見つかりません: ${axisName}</div>`;

    const allP = floorDataMap.flatMap(fm => [
        ...fm.walls.flatMap(w => [w.p1, w.p2]),
        ...fm.columns
    ]);
    const minX = Math.min(...allP.map(p => p.x)), maxX = Math.max(...allP.map(p => p.x));
    const minY = Math.min(...allP.map(p => p.y)), maxY = Math.max(...allP.map(p => p.y));
    const dx = maxX - minX, dy = maxY - minY;
    
    const isXHorizontal = dx >= dy;
    const getPos = (p) => isXHorizontal ? p.x : p.y;
    const startPos = isXHorizontal ? minX : minY;
    const totalW = Math.max(isXHorizontal ? dx : dy, 100);

    const padding = 60;
    const svgW = 800;
    const totalH_val = floorDataMap.reduce((sum, fm) => sum + fm.floorHeight, 0);
    const scaleVal = Math.min((svgW - padding * 2) / totalW, 500 / (totalH_val || 1));
    const W = svgW;
    const H = totalH_val * scaleVal + padding * 2;
    const getX = (pos) => padding + (pos - startPos) * scaleVal + (W - totalW * scaleVal - padding * 2) / 2;

    const floorYMap_Top = {};
    const floorYMap_Bot = {};
    const groundY = H - padding;
    let accH = 0;
    const sortedMap = [...floorDataMap].reverse(); 
    sortedMap.forEach(fm => {
        floorYMap_Bot[fm.floor] = groundY - (accH * scaleVal);
        accH += fm.floorHeight;
        floorYMap_Top[fm.floor] = groundY - (accH * scaleVal);
    });

    let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family: sans-serif;">`;
    
    sortedMap.forEach(fm => {
        const y = floorYMap_Bot[fm.floor];
        svg += `<line x1="${padding/2}" y1="${y}" x2="${W-padding/2}" y2="${y}" stroke="#ccc" stroke-width="1" />`;
        svg += `<text x="5" y="${y+4}" font-size="12" fill="#666">${fm.floor}${fm.floor==='1F'?'/GL':''}</text>`;
    });
    const topFloorY = floorYMap_Top[floorDataMap[0].floor];
    svg += `<line x1="${padding/2}" y1="${topFloorY}" x2="${W-padding/2}" y2="${topFloorY}" stroke="#ccc" stroke-width="1" />`;
    svg += `<text x="5" y="${topFloorY+4}" font-size="12" fill="#666">R/屋根</text>`;
    svg += `<line x1="${padding/2}" y1="${groundY}" x2="${W-padding/2}" y2="${groundY}" stroke="#333" stroke-width="2" />`;

    floorDataMap.forEach(fm => {
        const yTop = floorYMap_Top[fm.floor];
        const yBot = floorYMap_Bot[fm.floor];
        const Hi = fm.floorHeight / 1000;

        fm.walls.forEach(w => {
            const x1 = getX(getPos(w.p1)), x2 = getX(getPos(w.p2));
            const xL = Math.min(x1, x2), xR = Math.max(x1, x2), width = xR - xL;
            const tv = w.totalVal || 0;
            const fill = tv > 0 ? "rgba(91,138,254,0.08)" : "none";
            const stroke = tv > 0 ? "#5b8afe" : "#999";
            
            svg += `<rect x="${xL}" y="${yTop}" width="${width}" height="${yBot - yTop}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />`;
            if (tv > 0) {
                svg += `<line x1="${xL}" y1="${yTop}" x2="${xR}" y2="${yBot}" stroke="${stroke}" stroke-width="0.5" opacity="0.5" />`;
                svg += `<line x1="${xR}" y1="${yTop}" x2="${xL}" y2="${yBot}" stroke="${stroke}" stroke-width="0.5" opacity="0.5" />`;
                
                // [機能改善 立面図表示項目修正(精度・記号)] 単位をNへ統一、整数表示化。倍率記号を α へ。
                const wallL = (xR - xL) / scaleVal / 1000; // m
                const wallH = fm.floorHeight / 1000;       // m
                const Pa = tv * 1.96 * wallL * 1000;       // N
                const wallN = tv * 1.96 * wallH * 1000;    // N (軸力成分)
                
                svg += `<text x="${(xL+xR)/2}" y="${(yTop+yBot)/2 - 12}" font-size="9" fill="#2c3e50" font-weight="bold" text-anchor="middle">
                            <tspan x="${(xL+xR)/2}" dy="0">α = ${tv.toFixed(3)}</tspan>
                            <tspan x="${(xL+xR)/2}" dy="11">Pa = ${Pa.toFixed(0)} N</tspan>
                            <tspan x="${(xL+xR)/2}" dy="11">N = ${wallN.toFixed(0)} N</tspan>
                        </text>`;
            }
        });

        const axisPosSet = new Set();
        fm.walls.forEach(w => { axisPosSet.add(getPos(w.p1)); axisPosSet.add(getPos(w.p2)); });
        fm.columns.forEach(p => { axisPosSet.add(getPos(p)); });

        Array.from(axisPosSet).sort((a,b)=>a-b).forEach((pPos, pIdx) => {
            const x = getX(pPos);
            svg += `<line x1="${x}" y1="${yTop}" x2="${x}" y2="${yBot}" stroke="#666" stroke-width="1" stroke-dasharray="2,2" />`;
            
            const col = fm.columns.find(c => Math.abs(getPos(c) - pPos) < 5);
            if (col && col.nValue !== undefined) {
                const nVal = col.nValue || 0;
                // [機能改善 立面図表示項目修正(精度・記号)] 単位を N (kN * 1000) 整数表示へ
                const nValN = nVal * 1000;
                const color = nValN > 0 ? '#e74c3c' : '#3498db';
                const anchor = (loadDirection === 'left') ? 'end' : 'start';
                const dx = (loadDirection === 'left') ? -5 : 5;
                const offY = (pIdx % 2 === 0) ? 12 : 24;
                svg += `<text x="${x + dx}" y="${yTop + offY}" font-size="9" fill="${color}" font-weight="bold" text-anchor="${anchor}">Ni:${nValN.toFixed(0)} N</text>`;
                
                if (fm.floor === '1F') {
                    const T = nVal; 
                    const TN = T * 1000;
                    const tColor = TN > 0 ? '#e74c3c' : '#3498db';
                    const tText = TN > 0 ? `(+) ${TN.toFixed(0)} N` : `- ${Math.abs(TN).toFixed(0)} N`;
                    const tx = (loadDirection === 'left') ? x - 6 : x + 6;
                    const ta = (loadDirection === 'left') ? 'end' : 'start';
                    const ty = (pIdx % 2 === 0) ? 12 : -8;
                    svg += `<text x="${tx}" y="${yBot + ty}" font-size="11" fill="${tColor}" font-weight="bold" text-anchor="${ta}">${tText}</text>`;
                    svg += `<text x="${tx}" y="${yBot + ty + 12}" font-size="9" fill="#7f8c8d" text-anchor="${ta}">${col.nMark || '-'}</text>`;
                }
            }
        });
    });

    svg += `</svg>`;
    return svg;
};

