// [バグ修正 文字化け完全掃討]
// [バグ修正 文字化けの物理的修復]
// ==========================================
// wall_4split_render.js - 描画エンジン (Phase 3)
// draw(), resizeCanvas(), initViewForce(), renderLayerPanel(), _drawCADEntities, getBraceLabel()
// データは window.AppState / グローバル変数から参照します。
// ==========================================

function resizeCanvas() {
    if (!canvas) return;
    const container = document.getElementById('cad-container');
    if (container) { canvas.width = container.clientWidth; canvas.height = container.clientHeight; }
}
function initViewForce() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const accumVtx = (ent) => {
        if (ent.vertices) ent.vertices.forEach(v => { if (v.x != null && !isNaN(v.x)) { if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x; if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y; } });
        else if (ent.type === 'CIRCLE' || ent.type === 'ARC') { if (ent.center.x - ent.radius < minX) minX = ent.center.x - ent.radius; if (ent.center.x + ent.radius > maxX) maxX = ent.center.x + ent.radius; if (ent.center.y - ent.radius < minY) minY = ent.center.y - ent.radius; if (ent.center.y + ent.radius > maxY) maxY = ent.center.y + ent.radius; }
    };

    pillars.filter(p => p.floor === currentFloor && !p.isDeleted).forEach(p => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });

    if (minX === Infinity) {
        bgLinesOriginal.filter(e => e.floor === currentFloor).forEach(accumVtx);
        areaLines.filter(e => e.floor === currentFloor).forEach(accumVtx);
    }
    if (minX === Infinity) { bgLinesOriginal.filter(e => e.floor === 'ALL').forEach(accumVtx); }
    if (minX === Infinity) { minX = 0; minY = 0; maxX = 1000; maxY = 1000; }

    let cx = (minX + maxX) / 2;
    let cy = (minY + maxY) / 2;
    let dx = maxX - minX; if (dx <= 0) dx = 1000;
    let dy = maxY - minY; if (dy <= 0) dy = 1000;

    dx *= 1.2; dy *= 1.2;
    minX = cx - dx / 2;
    minY = cy - dy / 2;

    let cw = canvas ? (canvas.width || 800) : 800;
    let ch = canvas ? (canvas.height || 600) : 600;
    scale = Math.min((cw - 100) / dx, (ch - 100) / dy) || 1;
    offsetX = -minX * scale + (cw - dx * scale) / 2;
    offsetY = -minY * scale + (ch - dy * scale) / 2;

    pillars.forEach(p => { p.isCornerAuto = (Math.abs(p.x - minX) < 100 || Math.abs(p.x - maxX) < 100) && (Math.abs(p.y - minY) < 100 || Math.abs(p.y - maxY) < 100); });
}
function renderLayerPanel() {
    let panel = document.getElementById('dxf-layer-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'dxf-layer-panel';
        panel.style.cssText = `
            position: absolute; top: 10px; right: 10px; width: 200px; max-height: 80%;
            background: rgba(255,255,255,0.9); border: 1px solid #ccc; border-radius: 8px;
            padding: 10px; overflow-y: auto; z-index: 1000; font-family: sans-serif;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2); font-size: 11px;
        `;
        document.getElementById('cad-container').appendChild(panel);
    }

    let layers = Object.keys(layerVisibility).sort();
    if (layers.length === 0) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'block';

    let html = `<div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #ddd; padding-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
        <span>DXFレイヤ表示設定</span>
        <button onclick="this.parentElement.parentElement.style.display='none'" style="border:none; background:none; cursor:pointer; font-size:14px;">×</button>
    </div>`;

    layers.forEach(ln => {
        let checked = layerVisibility[ln] ? 'checked' : '';
        html += `<label style="display:flex; align-items:center; margin-bottom:4px; cursor:pointer; font-weight:normal; color:#333;">
            <input type="checkbox" data-layer="${ln}" ${checked} style="margin-right:6px;">
            ${ln}
        </label>`;
    });

    panel.innerHTML = html;

    // イベント委譲 (Event Delegation) によるリスナー設定
    if (!panel.dataset.listener) {
        panel.addEventListener('change', (e) => {
            const cb = e.target.closest('input[type="checkbox"]');
            if (!cb) return;
            const ln = cb.getAttribute('data-layer');
            layerVisibility[ln] = cb.checked;
            if (typeof draw === 'function') draw();
        });
        panel.dataset.listener = "true";
    }
}
const _drawCADEntities = (ctx, ents, toC, isBg, sfFinal, isPrint = false) => {
    ctx.save();
    if (isBg) {
        if (isPrint) {
            ctx.strokeStyle = '#cccccc';
            ctx.fillStyle = '#cccccc';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 1.0;
        } else {
            ctx.strokeStyle = '#aaaaaa';
            ctx.fillStyle = '#aaaaaa';
            ctx.lineWidth = 0.5;
            ctx.globalAlpha = 0.8;
        }
        ctx.setLineDash([]);
    } else {
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1.0;
        ctx.setLineDash([]);
    }
    ctx.fillStyle = isBg ? '#f0f0f0' : '#333333';

    ents.forEach(ent => {
        // ◆�  レイヤ表示判定�
        if (layerVisibility[ent.layer] === false) return;

        if (ent.isGridLine) return; // GRID線の�描画をスキップ��
        if (ent.type === 'LINE' && ent.vertices) {
            ctx.beginPath();
            let p1 = toC(ent.vertices[0].x, ent.vertices[0].y), p2 = toC(ent.vertices[1].x, ent.vertices[1].y);
            if (p1.cx != null && !isNaN(p1.cx) && p2.cx != null && !isNaN(p2.cx)) { ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke(); }
        } else if (['LWPOLYLINE', 'POLYLINE'].includes(ent.type) && ent.vertices) {
            ctx.beginPath();
            ent.vertices.forEach((v, i) => { let p = toC(v.x, v.y); if (p.cx != null && !isNaN(p.cx)) { i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy); } });
            if (ent.closed) ctx.closePath();
            ctx.stroke();
        } else if (ent.type === 'CIRCLE') {
            let p = toC(ent.center.x, ent.center.y);
            if (p.cx != null && !isNaN(p.cx)) { ctx.beginPath(); ctx.arc(p.cx, p.cy, ent.radius * sfFinal, 0, 2 * Math.PI); ctx.stroke(); }
        } else if (ent.type === 'ARC') {
            let p = toC(ent.center.x, ent.center.y);
            if (p.cx != null && !isNaN(p.cx)) { ctx.beginPath(); ctx.arc(p.cx, p.cy, ent.radius * sfFinal, -ent.endAngle * Math.PI / 180, -ent.startAngle * Math.PI / 180); ctx.stroke(); }
        } else if (['TEXT', 'MTEXT'].includes(ent.type)) {
            let txt = ent.text || ent.string || "";
            const pos = ent.startPoint || ent.position || ent.insertionPoint || ent.insert || {};
            let p = toC(pos.x ?? 0, pos.y ?? 0);
            if (p.cx != null && !isNaN(p.cx)) {
                let pxHeight = (ent.height || 250) * sfFinal;
                ctx.font = `${isBg ? 'normal' : 'bold'} ${Math.max(pxHeight, 10)}px sans-serif`;
                ctx.textAlign = "left"; ctx.textBaseline = "bottom";
                ctx.fillText(txt, p.cx, p.cy);
            }
        }
    });

    // 描画後、背景レイヤがオンの場合、キャンパス全体を白の半透明で「ぼやけ」させて強調箇所を浮き立たせる
    // 描画後、背景レイヤがオンの場合、キャンパス全体を白の半透明で「ぼやけ」させて馴染ませる
    // ※印刷時は物理色で調整されるため、画面表示時のみ適用される
    if (isBg && !isPrint) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
    }

    ctx.restore();
    ctx.setLineDash([]);
};
function getBraceLabel(braceName, braceVal, wall) {
    if (braceVal <= 0) return '';
    if (braceName) {
        if (braceName.includes('たすき') || braceName.includes('X')) return `筋 ${braceVal.toFixed(1)}(X)`;
        if (braceName.includes('◣') || braceName.includes('◣')) return `筋 ${braceVal.toFixed(1)}(◣)`;
        if (braceName.includes('／')) return `筋 ${braceVal.toFixed(1)}(／)`;
    }
    // 旧データ互換フォールバック: isTasukiフラグ or 倍率で判定
    if (wall && wall.isTasuki) return `筋 ${braceVal.toFixed(1)}(X)`;
    if (braceVal >= 4.0) return `筋 ${braceVal.toFixed(1)}(X)`;
    // 座標から方向を推定（ワールド座標系でY軸上向きが正）
    if (wall && wall.p1 && wall.p2) {
        let sdx = wall.p2.x - wall.p1.x;
        let sdy = wall.p2.y - wall.p1.y;
        // 蟇ｾ隗堤ｷ壼｣�ｼ域万繧∝｣�ｼ峨�蝣ｴ蜷�: 螢∵婿蜷代→蜷御ｸ
        let absDx = Math.abs(sdx), absDy = Math.abs(sdy);
        if (absDx > 100 && absDy > 100) {
            // 同符号（右上がり or 左下がり） // ◣
            return (sdx * sdy > 0) ? `筋 ${braceVal.toFixed(1)}(◣)` : `筋 ${braceVal.toFixed(1)}(／)`;
        }
    }
    // 水平・垂直壁の旧データは方向不詳
    return `筋 ${braceVal.toFixed(1)}`;
}
function draw() {
    if (!ctx) return;

    // [基礎計算追加 Phase1] 現在のアプリモードを取得
    const _appMode = (typeof getAppMode === 'function') ? getAppMode() : 'wall';
    // Phase1: 基礎モード時は既存要素（柱・耐力壁）を透過表示するための不透明度値
    const _existingAlpha = (_appMode === 'foundation') ? 0.5 : 1.0;

    let bgC = isPrintMode ? '#fff' : '#1e1e1e', lineC = isPrintMode ? '#ddd' : '#555', txtC = isPrintMode ? '#333' : '#aaaaaa', w1C = isPrintMode ? '#27ae60' : '#2ecc71', w2C = isPrintMode ? '#d35400' : '#f39c12', winC = isPrintMode ? 'rgba(52,152,219,0.2)' : 'rgba(52,152,219,0.4)';
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = bgC; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ◆ Canvas描画時に都度凡例のマッピングキャッシュを最新化する
    if (window.buildWallLegendData) {
        window._currentLegendDic = window.buildWallLegendData().panelDic;
    }

    // [バグ修正 NaNカスケード防止と描画復旧] 描画座標の数値安全化 (NaN/Infinityガード)
    const toCanvas = (x, y) => {
        // [バグ修正 基礎梁 サイレント描画失敗を解消：引数がオブジェクト ({x, y}) の場合にも対応できるよう頑健化
        let tx = x, ty = y;
        if (typeof x === 'object' && x !== null) {
            tx = x.x;
            ty = x.y;
        }
        // [バグ修正 基礎梁 非表示の完全修正] 文字列・数値 (e.g. "100") が isFinite を通過しなかったため、Number() で強制キャスト
        tx = Number(tx); ty = Number(ty);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return { cx: null, cy: null };
        return { cx: tx * scale + offsetX, cy: canvas.height - (ty * scale + offsetY) };
    };

    let cb = document.getElementById('show-4div'), b = get4DivBounds(currentFloor);

    if (cb && cb.checked && b && !isPrintMode) {
        let dR = (bb, cc) => {
            let p1 = toCanvas(bb.minX, bb.minY), p2 = toCanvas(bb.maxX, bb.maxY);
            if (p1.cx != null && !isNaN(p1.cx)) {
                let w = p2.cx - p1.cx, h = p1.cy - p2.cy;
                if (w > 0 && h > 0) { ctx.fillStyle = cc; ctx.fillRect(p1.cx, p2.cy, w, h); }
            }
        };
        dR({ minX: b.minX, maxX: b.xLeft, minY: b.minY, maxY: b.maxY }, 'rgba(52,152,219,0.25)');
        dR({ minX: b.xRight, maxX: b.maxX, minY: b.minY, maxY: b.maxY }, 'rgba(52,152,219,0.25)');
        dR({ minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.yBottom }, 'rgba(231,76,60,0.25)');
        dR({ minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.yTop }, 'rgba(231,76,60,0.25)');
    }

    // ◆ パッチ適用: 画面上の背景描画を視認できる適正な濃度に調整 // GRID線は除外
    ctx.lineWidth = 1.0; ctx.strokeStyle = isPrintMode ? '#aaa' : 'rgba(170, 170, 170, 0.5)'; ctx.setLineDash([]);
    bgLinesOriginal.filter(e => e.isUnderlay && ((e.layer && e.layer.includes('BG_')) || e.floor === currentFloor || e.floor === 'ALL')).forEach(e => {
        // ◆ 修正3: レイヤ表示設定をリアルタイム連動
        if (layerVisibility[e.layer] === false) return;
        if (e.isGridLine) return; // スナップ用GRID線の描画をスキップ（二重描画防止）
        ctx.beginPath();
        if (e.type === 'LINE' && e.vertices) { let p1 = toCanvas(e.vertices[0].x, e.vertices[0].y), p2 = toCanvas(e.vertices[1].x, e.vertices[1].y); if (p1.cx != null && !isNaN(p1.cx)) { ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); } }
        else if (['LWPOLYLINE', 'POLYLINE'].includes(e.type) && e.vertices) { e.vertices.forEach((v, i) => { let p = toCanvas(v.x, v.y); if (p.cx != null && !isNaN(p.cx)) { i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy); } }); if (e.closed) ctx.closePath(); }
        else if (e.type === 'CIRCLE') { let p = toCanvas(e.center.x, e.center.y); if (p.cx != null && !isNaN(p.cx)) { ctx.arc(p.cx, p.cy, e.radius * scale, 0, 2 * Math.PI); } }
        else if (e.type === 'ARC') { let p = toCanvas(e.center.x, e.center.y); if (p.cx != null && !isNaN(p.cx)) { ctx.arc(p.cx, p.cy, e.radius * scale, -e.endAngle * Math.PI / 180, -e.startAngle * Math.PI / 180); } }
        ctx.stroke();
    });

    ctx.lineWidth = 2;
    // [機能改善 要素レイヤ切替] areas
    areaLines.filter(a => a.floor === currentFloor && window.AppState.elementVisibility.areas).forEach((a, index) => {
        ctx.beginPath();
        a.vertices.forEach((v, i) => { let p = toCanvas(v.x, v.y); if (p.cx != null && !isNaN(p.cx)) { i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy); } });
        if (a.closed) ctx.closePath();

        // エリア種別に応じた色分け
        if (a.areaType === 'attic') {
            ctx.fillStyle = 'rgba(155, 89, 182, 0.3)'; ctx.strokeStyle = '#8e44ad';
        } else if (a.areaType === 'balcony') {
            ctx.fillStyle = 'rgba(230, 126, 34, 0.3)'; ctx.strokeStyle = '#e67e22';
        } else if (a.areaType === 'void') {
            ctx.fillStyle = 'rgba(127, 140, 141, 0.3)'; ctx.strokeStyle = '#7f8c8d';
        } else if (a.areaType === 'porch') {
            ctx.fillStyle = 'rgba(241, 196, 15, 0.3)'; ctx.strokeStyle = '#f39c12';
        } else {
            ctx.fillStyle = 'rgba(46, 204, 113, 0.2)'; ctx.strokeStyle = 'rgba(46, 204, 113, 0.8)';
        }
        ctx.fill(); ctx.stroke();

        let cx = 0, cy = 0;
        a.vertices.forEach(v => { let p = toCanvas(v.x, v.y); if (p.cx != null && !isNaN(p.cx)) { cx += p.cx; cy += p.cy; } });
        cx /= a.vertices.length; cy /= a.vertices.length;

        let typeName = '床面積';
        if (a.areaType === 'attic') typeName = '小屋裏';
        else if (a.areaType === 'balcony') typeName = 'バルコニー';
        else if (a.areaType === 'void') typeName = '吹き抜け';
        else if (a.areaType === 'porch') typeName = 'ポーチ・屋根';

        let labelText = `${index + 1}. ${typeName}`;
        ctx.save();
        ctx.font = isPrintMode ? 'bold 16px sans-serif' : 'bold 16px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = isPrintMode ? '#ffffff' : '#ffffff';
        ctx.strokeText(labelText, cx, cy);
        ctx.fillStyle = isPrintMode ? '#2c3e50' : '#2c3e50';
        ctx.fillText(labelText, cx, cy);
        ctx.restore();
    });

    ctx.strokeStyle = isPrintMode ? '#555' : '#8e44ad'; ctx.setLineDash([5, 5]); ctx.fillStyle = isPrintMode ? '#2c3e50' : '#2ecc71';
    // [讖溯�謾ｹ蝟� 要素�レイヤ蛻�崛] grids
    if (window.AppState.elementVisibility.grids && gridXCoords.length > 0 && gridYCoords.length > 0) {
        let gMinX = Math.min(...gridXCoords), gMaxX = Math.max(...gridXCoords);
        let gMinY = Math.min(...gridYCoords), gMaxY = Math.max(...gridYCoords);

        let pTop = toCanvas(0, gMaxY);
        let pBot = toCanvas(0, gMinY);
        let pLeft = toCanvas(gMinX, 0);
        let pRight = toCanvas(gMaxX, 0);

        // ◆� 薙Ηｼ昴�郁ｿｽ蠕�: 画面端のワールド座標を計算�
        const visibleLeft = -offsetX / scale;
        const visibleRight = (canvas.width - offsetX) / scale;
        const visibleTop = (canvas.height - offsetY) / scale;  // Y軸反転のため
        const visibleBottom = -offsetY / scale;                 // Y軸反転のため

        // 通り芯名阪�フォント医し繧､繧ｺ�(スケールに反比例して)がｦ逕ｻ髱｢贋ｸ螳壹し繧､繧ｺ繧剃ｿ昴▽��
        const labelFontSize = Math.max(10, Math.min(20, 14 / scale));
        const dimFontSize = Math.max(8, Math.min(16, 12 / scale));
        const labelPad = 10 / scale;  // 薙Ηｼ昴�育ｫｯからのパディング�医Ρｼｫ牙ｺｧ讓呻ｼ�

        gridXCoords.forEach((x, i) => {
            let cx = toCanvas(x, 0).cx;
            if (cx != null && !isNaN(cx)) {
                ctx.beginPath(); ctx.moveTo(cx, pTop.cy - 30); ctx.lineTo(cx, pBot.cy + 30); ctx.stroke();
                // ◆� X譁ｹ蜷鷹壹ｊ闃ｯ蜷�: 蟶ｸに薙Ηｼ昴�井ｸ顔ｫｯ付近に表示
                let labelY = toCanvas(0, visibleTop - labelPad).cy;
                // 繧ｰｪ�ラ遽�峇の上端より上にはみ出さないが�ｈが�↓繧ｯｩｳ�
                labelY = Math.max(labelY, 15);
                ctx.save();
                ctx.font = `bold ${labelFontSize}px sans-serif`; ctx.textAlign = "center";
                // 白アウトラインで隕冶ｪ肴ｧ遒ｺ菫�
                ctx.strokeStyle = isPrintMode ? '#fff' : 'rgba(30,30,30,0.7)'; ctx.lineWidth = 3;
                ctx.strokeText(gridXNames[i] || '', cx, labelY);
                ctx.fillStyle = isPrintMode ? '#2c3e50' : '#2ecc71';
                ctx.fillText(gridXNames[i] || '', cx, labelY);
                ctx.restore();
                ctx.strokeStyle = isPrintMode ? '#555' : '#8e44ad'; // restore grid line color
                if (i < gridXCoords.length - 1) {
                    let d = gridXCoords[i + 1] - x;
                    let midCx = toCanvas(x + d / 2, 0).cx;
                    ctx.font = `${dimFontSize}px sans-serif`; ctx.fillStyle = isPrintMode ? '#2c3e50' : '#2ecc71';
                    ctx.fillText(d.toFixed(0), midCx, pBot.cy + 40);
                }
            }
        });
        gridYCoords.forEach((y, i) => {
            let cy = toCanvas(0, y).cy;
            if (cy != null && !isNaN(cy)) {
                ctx.beginPath(); ctx.moveTo(pLeft.cx - 30, cy); ctx.lineTo(pRight.cx + 30, cy); ctx.stroke();
                // ◆� Y譁ｹ蜷鷹壹ｊ闃ｯ蜷�: 蟶ｸに薙Ηｼ昴�亥ｷｦ遶ｯ付近に表示
                let labelX = toCanvas(visibleLeft + labelPad, 0).cx;
                // 画面左端より左にはみ出さないが�ｈが�↓繧ｯｩｳ�
                labelX = Math.max(labelX, 5);
                ctx.save();
                ctx.font = `bold ${labelFontSize}px sans-serif`; ctx.textAlign = "left";
                // 白アウトラインで隕冶ｪ肴ｧ遒ｺ菫�
                ctx.strokeStyle = isPrintMode ? '#fff' : 'rgba(30,30,30,0.7)'; ctx.lineWidth = 3;
                ctx.strokeText(gridYNames[i] || '', labelX, cy + 5);
                ctx.fillStyle = isPrintMode ? '#2c3e50' : '#2ecc71';
                ctx.fillText(gridYNames[i] || '', labelX, cy + 5);
                ctx.restore();
                ctx.strokeStyle = isPrintMode ? '#555' : '#8e44ad'; // restore grid line color
                if (i < gridYCoords.length - 1) {
                    let d = gridYCoords[i + 1] - y;
                    let midCy = toCanvas(0, y + d / 2).cy;
                    ctx.font = `${dimFontSize}px sans-serif`; ctx.fillStyle = isPrintMode ? '#2c3e50' : '#2ecc71';
                    ctx.fillText(d.toFixed(0), pLeft.cx - 35, midCy + 4);
                }
            }
        });
    }
    ctx.setLineDash([]);

    ctx.fillStyle = txtC; ctx.font = "14px sans-serif"; ctx.textAlign = "left";
    bgTextsOriginal.filter(t => !t.isUnderlay && (t.floor === currentFloor || t.floor === 'ALL')).forEach(t => {
        if (layerVisibility[t.layer] === false) return;
        let p = toCanvas(t.x, t.y); if (p.cx != null && !isNaN(p.cx)) { ctx.fillText(t.text, p.cx, p.cy); }
    });
    ctx.fillStyle = '#666';
    bgTextsOriginal.filter(t => t.isUnderlay && ((t.layer && t.layer.includes('BG_')) || t.floor === currentFloor || t.floor === 'ALL')).forEach(t => {
        if (layerVisibility[t.layer] === false) return;
        let p = toCanvas(t.x, t.y); if (p.cx != null && !isNaN(p.cx)) { ctx.fillText(t.text, p.cx, p.cy); }
    });

    let m = getMode();
    let modeStr = isPrintMode ? 'wall' : m;

    if (m === 'draw-area' && areaDrawPoints.length > 0) {
        ctx.lineWidth = 2; ctx.strokeStyle = '#e74c3c'; ctx.setLineDash([5, 5]); ctx.beginPath();
        areaDrawPoints.forEach((pt, i) => { let p = toCanvas(pt.x, pt.y); if (p.cx != null && !isNaN(p.cx)) { i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy); } });
        let hx = hoveredPillar ? toCanvas(hoveredPillar.x, hoveredPillar.y).cx : mouseX, hy = hoveredPillar ? toCanvas(hoveredPillar.x, hoveredPillar.y).cy : mouseY;
        ctx.lineTo(hx, hy); ctx.stroke(); ctx.setLineDash([]);
        let p0 = toCanvas(areaDrawPoints[0].x, areaDrawPoints[0].y);
        if (p0.cx != null && !isNaN(p0.cx)) { ctx.fillStyle = '#e74c3c'; ctx.fillRect(p0.cx - 5, p0.cy - 5, 10, 10); }
    }

    // [基礎計算追加� Phase1] 基礎モード時は開口・耐力壁を透過�(ガイド用))として描画
    ctx.save();
    ctx.globalAlpha = _existingAlpha;
    if (modeStr !== 'area') {
        // [讖溯�謾ｹ蝟� 要素�レイヤ蛻�崛] windows
        windowsArr.filter(w => w.floor === currentFloor && window.AppState.elementVisibility.windows).forEach(w => {
            let p1 = toCanvas(w.p1.x, w.p1.y), p2 = toCanvas(w.p2.x, w.p2.y);
            if (p1.cx != null && !isNaN(p1.cx) && p2.cx != null && !isNaN(p2.cx)) {
                ctx.lineWidth = 15; ctx.strokeStyle = winC; ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
                ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = isPrintMode ? '#333' : '#fff'; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("開口", (p1.cx + p2.cx) / 2, (p1.cy + p2.cy) / 2); ctx.textBaseline = "alphabetic";
            }
        });

        // [讖溯�謾ｹ蝟� 要素�レイヤ蛻�崛] walls
        walls.filter(w => w.floor === currentFloor && window.AppState.elementVisibility.walls).forEach(w => {
            let p1 = toCanvas(w.p1.x, w.p1.y), p2 = toCanvas(w.p2.x, w.p2.y);
            if (p1.cx != null && !isNaN(p1.cx) && p2.cx != null && !isNaN(p2.cx)) {
                ctx.lineWidth = 5; ctx.strokeStyle = currentFloor === '1F' ? w1C : w2C; ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();

                if (!isPrintMode && (m === 'edit-wall' || m === 'del-wall') && !isDragging) {
                    let l2 = (p2.cx - p1.cx) ** 2 + (p2.cy - p1.cy) ** 2, t = Math.max(0, Math.min(1, ((mouseX - p1.cx) * (p2.cx - p1.cx) + (mouseY - p1.cy) * (p2.cy - p1.cy)) / (l2 || 1)));
                    if (Math.sqrt((mouseX - (p1.cx + t * (p2.cx - p1.cx))) ** 2 + (mouseY - (p1.cy + t * (p2.cy - p1.cy))) ** 2) < 10) { ctx.strokeStyle = '#f1c40f'; ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke(); }
                }
            }
        });
    }
    // [基礎計算追加� Phase1] 譟ｱ描画蜑阪↓騾乗�蠎ｦ繧帝←逕ｨ (ctx.save貂医∩の悶Ο�け蜀�)

    if (cb && cb.checked && b && !isPrintMode) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(231,76,60,0.8)';
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        let ptLTop = toCanvas(b.xLeft, b.maxY), ptLBot = toCanvas(b.xLeft, b.minY);
        let ptRTop = toCanvas(b.xRight, b.maxY), ptRBot = toCanvas(b.xRight, b.minY);
        if (ptLTop.cx != null && !isNaN(ptLTop.cx) && ptRTop.cx > ptLTop.cx) {
            ctx.moveTo(ptLTop.cx, ptLTop.cy); ctx.lineTo(ptLBot.cx, ptLBot.cy);
            ctx.moveTo(ptRTop.cx, ptRTop.cy); ctx.lineTo(ptRBot.cx, ptRBot.cy);
        }
        let pLTop = toCanvas(b.minX, b.yTop), pRTop = toCanvas(b.maxX, b.yTop);
        let pLBot = toCanvas(b.minX, b.yBottom), pRBot = toCanvas(b.maxX, b.yBottom);
        if (pLTop.cx != null && !isNaN(pLTop.cx) && pLBot.cy > pLTop.cy) {
            ctx.moveTo(pLTop.cx, pLTop.cy); ctx.lineTo(pRTop.cx, pRTop.cy);
            ctx.moveTo(pLBot.cx, pLBot.cy); ctx.lineTo(pRBot.cx, pRBot.cy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (!isPrintMode && m === 'area') {
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#27ae60'; ctx.setLineDash([5, 5]);
        pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === currentFloor).forEach(p => {
            if (p.tributaryPolygon && p.tributaryPolygon.length >= 3) {
                ctx.fillStyle = 'rgba(46, 204, 113, 0.1)';
                ctx.beginPath();
                p.tributaryPolygon.forEach((ptPoly, i) => {
                    // [バグ修正 render.js描画エラー解消�
                    if (!ptPoly) return;
                    let c = toCanvas(ptPoly.x, ptPoly.y);
                    if (i === 0) ctx.moveTo(c.cx, c.cy); else ctx.lineTo(c.cx, c.cy);
                });
                ctx.closePath();
                ctx.fill(); ctx.stroke();
            }
        });
        ctx.setLineDash([]);
    }

    if (!isPrintMode && m === 'add-pillar' && snapPoint) { let p = toCanvas(snapPoint.x, snapPoint.y); if (p.cx != null && !isNaN(p.cx)) { ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(p.cx, p.cy, 8, 0, Math.PI * 2); ctx.fill(); } }

    // [讖溯�謾ｹ蝟� 要素�レイヤ蛻�崛] pillars
    pillars.filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === currentFloor || p.floor === 'ALL') && window.AppState.elementVisibility.pillars).forEach(p => {
        if (p.layer && layerVisibility[p.layer] === false) return;
        let pt = toCanvas(p.x, p.y);
        if (pt.cx != null && !isNaN(pt.cx)) {
            ctx.fillStyle = isPrintMode ? '#333' : ((selectedPillar === p) ? '#e74c3c' : (hoveredPillar === p) ? '#e67e22' : (p.isManual ? '#2ecc71' : '#3498db'));
            let isC = p.isManualCorner !== null ? p.isManualCorner : p.isCornerAuto;
            if (isC) { ctx.beginPath(); ctx.arc(pt.cx, pt.cy, 8, 0, Math.PI * 2); ctx.fill(); } else { ctx.fillRect(pt.cx - 7, pt.cy - 7, 14, 14); }

            // ◆� 柱のハイライト描画 (螟ｪが�ｵ､譫� + パルスアニメーション)
            if (!isPrintMode && selectedPillar === p) {
                ctx.save();
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 3;
                if (isC) {
                    ctx.beginPath();
                    ctx.arc(pt.cx, pt.cy, 12, 0, Math.PI * 2);
                    ctx.stroke();
                    // パルス効果�
                    let time = Date.now() / 400;
                    let radius = 12 + Math.abs(Math.sin(time)) * 8;
                    ctx.beginPath();
                    ctx.globalAlpha = 0.4;
                    ctx.arc(pt.cx, pt.cy, radius, 0, Math.PI * 2);
                    ctx.stroke();
                } else {
                    ctx.strokeRect(pt.cx - 11, pt.cy - 11, 22, 22);
                    // パルス効果�
                    let time = Date.now() / 400;
                    let grow = Math.abs(Math.sin(time)) * 12;
                    ctx.globalAlpha = 0.4;
                    ctx.strokeRect(pt.cx - 11 - grow / 2, pt.cy - 11 - grow / 2, 22 + grow, 22 + grow);
                }
                ctx.restore();
            }

            // [讖溯�謾ｹ蝟� 要素�レイヤ蛻�崛] pillarNValues
            if (window.AppState.elementVisibility.pillarNValues && modeStr === 'n-value' && p.nValue !== undefined && p.nMark !== "不要�" && p.nMark !== "-") {
                ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 12px sans-serif";
                let textWidth = ctx.measureText(p.nMark).width;
                ctx.fillStyle = isPrintMode ? '#fff' : 'rgba(255,255,255,0.9)';
                ctx.fillRect(pt.cx - textWidth / 2 - 4, pt.cy - 8, textWidth + 8, 16);
                if (isPrintMode) { ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(pt.cx - textWidth / 2 - 4, pt.cy - 8, textWidth + 8, 16); }

                let hw = getHardwareList().find(h => h.name === p.nMark), isNg = p.manualMark && hw && p.nValue > hw.n;
                ctx.fillStyle = isNg ? '#e74c3c' : '#c0392b';
                ctx.fillText(p.nMark, pt.cx, pt.cy);
                ctx.textBaseline = "alphabetic";
            }
        }
    });

    if (!isPrintMode && m === 'area') {
        // [機能改善 要素・レイヤ切替] areas (pillars)
        pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === currentFloor && window.AppState.elementVisibility.areas).forEach(p => {
            let pt = toCanvas(p.x, p.y);
            if (pt.cx != null && !isNaN(pt.cx)) {
                let areaVal = p.usedArea != null ? p.usedArea : (p.autoArea || 0);
                if (areaVal > 0) {
                    let txt = areaVal.toFixed(2) + "㎡";
                    ctx.font = "bold 12px sans-serif";
                    let tw = ctx.measureText(txt).width;
                    let OFFSET_Y = 24;
                    let PAD = 4, TH = 16;

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                    ctx.fillRect(pt.cx - tw / 2 - PAD, pt.cy + OFFSET_Y - TH + 2, tw + PAD * 2, TH + 2);
                    ctx.strokeStyle = 'rgba(30,132,73,0.8)'; ctx.lineWidth = 1;
                    ctx.strokeRect(pt.cx - tw / 2 - PAD, pt.cy + OFFSET_Y - TH + 2, tw + PAD * 2, TH + 2);

                    ctx.fillStyle = '#1e8449'; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
                    ctx.fillText(txt, pt.cx, pt.cy + OFFSET_Y);
                }
            }
        });
    }

    // ◆ 最前面に関数移動: 耐力壁記号と筋交いアイコン（座標マスク付き）
    if (modeStr !== 'area') {
        // [機能改善 要素・レイヤ切替] walls
        walls.filter(w => w.floor === currentFloor && window.AppState.elementVisibility.walls).forEach(w => {
            // [バグ修正 render.js描画エラー解消 座標データの欠損ガード
            if (!w.p1 || !w.p2) return;

            let p1 = toCanvas(w.p1.x, w.p1.y), p2 = toCanvas(w.p2.x, w.p2.y);
            if (p1.cx != null && !isNaN(p1.cx) && p2.cx != null && !isNaN(p2.cx)) {
                let mX = (p1.cx + p2.cx) / 2, mY = (p1.cy + p2.cy) / 2;

                // 1. 筋交いアイコン
                if (w.braceVal > 0) {
                    ctx.save(); ctx.translate(mX, mY); ctx.rotate(Math.atan2(p2.cy - p1.cy, p2.cx - p1.cx));
                    ctx.fillStyle = isPrintMode ? '#333' : '#e74c3c';
                    if (w.isTasuki) {
                        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(12, -12); ctx.closePath(); ctx.fill();
                        ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-20, 0); ctx.lineTo(-20, -20); ctx.closePath(); ctx.fill();
                    } else {
                        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(12, -12); ctx.closePath(); ctx.fill();
                    }
                    ctx.restore();
                }

                // 2. 面材記号 (ID優先、名称フォールバック)
                let p1Spec = window.getWallSpec(w.outPanelId);
                let p2Spec = window.getWallSpec(w.inPanelId);

                let mark1 = "";
                if (w.outPanelId && p1Spec.id !== "opt0") {
                    mark1 = p1Spec.text.charAt(0);
                } else if (!w.outPanelId && w.outPanelName && !w.outPanelName.includes('なし')) {
                    mark1 = w.outPanelName.charAt(0);
                }

                let mark2 = "";
                if (w.inPanelId && p2Spec.id !== "opt0") {
                    mark2 = p2Spec.text.charAt(0);
                } else if (!w.inPanelId && w.inPanelName && !w.inPanelName.includes('なし')) {
                    mark2 = w.inPanelName.charAt(0);
                }

                let marks = []; if (mark1) marks.push(mark1); if (mark2) marks.push(mark2);
                let mark = marks.join('+');

                if (!mark && (window.getWallTotalVal(w) - (w.braceVal || 0) > 0)) {
                    let panelSum = (w.outPanelVal || 0) + (w.inPanelVal || 0);
                    mark = window._currentLegendDic ? window._currentLegendDic[panelSum.toFixed(2)] || '' : '';
                }

                if (mark) {
                    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = "center";
                    let tw = ctx.measureText(mark).width;

                    let dxLine = Math.abs(p1.cx - p2.cx), dyLine = Math.abs(p1.cy - p2.cy);
                    let isVertical = dyLine > dxLine;
                    let offX = isVertical ? 15 : 0, offY = isVertical ? 0 : -8;

                    // 背景マスクで視認性確保
                    ctx.fillStyle = isPrintMode ? 'rgba(255,255,255,0.9)' : 'rgba(30,30,30,0.8)';
                    ctx.fillRect(mX - tw / 2 - offX - 3, mY + offY - 11, tw + 6, 16);
                    ctx.fillStyle = isPrintMode ? '#2c3e50' : '#f1c40f';
                    ctx.fillText(mark, mX + offX, mY + offY);
                }
            }
        });
    }
    ctx.restore();

    if (!isPrintMode && selectedElement) {
        drawSelectionHighlight(toCanvas);
    }

    // [バグ修正 基礎レイヤ描画呼び出しの復活] 基礎モード時に基礎レイヤを描画
    if (_appMode === 'foundation') {
        if (typeof drawFoundationLayer === 'function') {
            drawFoundationLayer(toCanvas);
        }
    }
}

function drawSelectionHighlight(toCanvas) {
    if (!selectedElement) return;
    const type = selectedElement.type;
    const item = selectedElement.item;

    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#f1c40f'; // ゴールド/イエローのハイライト
    ctx.setLineDash([5, 3]);

    if (type === 'pillar') {
        let pt = toCanvas(item.x, item.y);
        ctx.beginPath();
        if (item.isManualCorner !== null ? item.isManualCorner : item.isCornerAuto) {
            ctx.arc(pt.cx, pt.cy, 15, 0, Math.PI * 2);
        } else {
            ctx.rect(pt.cx - 12, pt.cy - 12, 24, 24);
        }
        ctx.stroke();
    } else if (type === 'wall' || type === 'window') {
        let p1 = toCanvas(item.p1.x, item.p1.y), p2 = toCanvas(item.p2.x, item.p2.y);
        ctx.beginPath();
        ctx.moveTo(p1.cx, p1.cy);
        ctx.lineTo(p2.cx, p2.cy);
        ctx.stroke();
        // 両端にポインター
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(p1.cx - 5, p1.cy - 5, 10, 10);
        ctx.fillRect(p2.cx - 5, p2.cy - 5, 10, 10);
    } else if (type === 'area') {
        ctx.beginPath();
        item.vertices.forEach((v, i) => {
            let p = toCanvas(v.x, v.y);
            i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = 'rgba(241, 196, 15, 0.2)';
        ctx.fill();
    }
    ctx.restore();
}

function drawFoundationLayer(toCanvas) {
    if (!ctx) return;

    // [バグ修正 基礎レイヤ描画呼び出しの復活] 選択状態の安全な参照
    const _fdSel = window.AppState.fdSelection || { type: null, item: null };

    // ---- べた基礎スラブ描画 ----
    // [機能追加 山場Step1: スパン別プロパティとレポート枠] 表示フィルタバグの修正（未定義時は表示）
    (window.AppState.foundationSlabs || []).filter(s => !window.AppState.elementVisibility || window.AppState.elementVisibility.f_slabs !== false).forEach((slab, si) => {
        if (!slab.vertices || slab.vertices.length < 3) return;
        ctx.save();
        // [バグ修正 基礎レイヤ描画呼び出しの復活] 選択判定の安全化とスタイル適用
        const isSelected = (_fdSel.type === 'slab' && _fdSel.item?.id === slab.id) || (window.highlightedSlabIndex === si);
        if (isSelected) {
            ctx.fillStyle = 'rgba(255, 105, 180, 0.3)'; ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 4;
        } else {
            ctx.fillStyle = 'rgba(52, 152, 219, 0.15)'; ctx.strokeStyle = '#2980b9'; ctx.lineWidth = 2;
        }
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        slab.vertices.forEach((v, i) => {
            const p = toCanvas(v.x, v.y);
            if (p.cx == null || isNaN(p.cx)) return;
            i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy);
        });
        ctx.closePath();

        // [機能改善 スラブ悶強調表示] 選択ハイライト
        // 旧ハイライトロジック削除 (先頭で判定済み)


        ctx.fill();
        ctx.stroke();

        // ラベル [バグ修正 render.js描画エラー解消
        const validSlabVertices = (slab.vertices || []).filter(v => v && typeof v.x !== 'undefined');
        if (validSlabVertices.length === 0) return;

        const cx = validSlabVertices.reduce((s, v) => s + v.x, 0) / validSlabVertices.length;
        const cy = validSlabVertices.reduce((s, v) => s + v.y, 0) / validSlabVertices.length;
        const lp = toCanvas(cx, cy);
        if (lp.cx != null && !isNaN(lp.cx)) {
            ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#1460a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('スラブ�', lp.cx, lp.cy - 10);

            if (window.AppState.averageGroundPressure) {
                ctx.font = 'bold 12px sans-serif';
                ctx.fillStyle = '#e67e22';
                ctx.fillText(`${window.AppState.averageGroundPressure.toFixed(2)} kN/m2`, lp.cx, lp.cy + 10);
            }
        }
        ctx.restore();
    });

    // ---- [基礎計算追加� Phase3] 莠逕ｲ蛻�牡邱壹�描画 ----
    // calculateSlabTributary() 各スラブの� tributaryPolygons を計算済みの場合に描画する縲�
    // [讖溯�謾ｹ蝟� 要素�レイヤ蛻�崛] f_slabs
    (window.AppState.foundationSlabs || []).filter(() => window.AppState.elementVisibility.f_slabs).forEach(slab => {
        if (!slab.tributaryPolygons || slab.tributaryPolygons.length === 0) return;
        slab.tributaryPolygons.forEach((tribEntry, i) => {
            const poly = tribEntry.polygon;
            if (!poly || poly.length < 3) return;
            ctx.save();

            // [讖溯�霑ｽ蜉� 莠逕ｲ蛻�牡邱壹�繧ｭ｣ｳ舌せ描画] 蛻�牡邱壹�描画 (破線�)
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 1.0;
            ctx.beginPath();
            poly.forEach((v, idx) => {
                if (!v) return;
                const p = toCanvas(v.x, v.y);
                if (p.cx == null || isNaN(p.cx)) return;
                idx === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy);
            });
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]); // ｪ繧ｻ�ヨ

            // [讖溯�霑ｽ蜉� 莠逕ｲ蛻�牡邱壹�繧ｭ｣ｳ舌せ描画] 驥榊ｿ��邂怜�と�く繧ｹ郁｡ｨ遉ｺ
            let cxSum = 0, cySum = 0;
            poly.forEach(v => {
                if (v) { cxSum += v.x; cySum += v.y; }
            });
            const pC = toCanvas(cxSum / poly.length, cySum / poly.length);

            if (pC.cx != null && !isNaN(pC.cx)) {
                let areaA = (slab.edgeAreas && slab.edgeAreas[i] !== undefined) ? slab.edgeAreas[i] : (tribEntry.area / 1e6 || 0);
                let widthB = (slab.edgeLs && slab.edgeLs[i] !== undefined) ? slab.edgeLs[i] : (tribEntry.width || 0);

                if (widthB === 0 && tribEntry.edgeLength > 0 && areaA > 0) widthB = areaA / (tribEntry.edgeLength / 1000);

                if (areaA > 0) {
                    ctx.font = 'bold 11px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const textA = `A = ${areaA.toFixed(2)} ㎡`;
                    const textB = widthB > 0 ? `B = ${widthB.toFixed(2)} m` : '';
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 3;
                    ctx.strokeText(textA, pC.cx, pC.cy - 7);
                    if (textB) ctx.strokeText(textB, pC.cx, pC.cy + 7);
                    ctx.fillStyle = '#2980b9';
                    ctx.fillText(textA, pC.cx, pC.cy - 7);
                    if (textB) ctx.fillText(textB, pC.cx, pC.cy + 7);
                }
            }
            ctx.restore();
        });
    });

    // ---- 外壁線描画�育樟蝨ｨの髫弱�がｿ�� ----
    // [讖溯�謾ｹ蝟� 要素�レイヤ蛻�崛] f_ext_walls
    (window.AppState.exteriorWalls || []).filter(ew => ew.floor === currentFloor && (window.AppState.elementVisibility.f_ext_walls)).forEach(ew => {
        if (!ew.vertices || ew.vertices.length < 2) return;
        ctx.save();
        ctx.strokeStyle = '#e67e22';
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 6]);
        ctx.beginPath();
        ew.vertices.forEach((v, i) => {
            const p = toCanvas(v.x, v.y);
            if (p.cx == null || isNaN(p.cx)) return;
            i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy);
        });
        if (ew.closed) ctx.closePath();

        const isSelected = window.AppState.fdSelection.type === 'ext_wall' && window.AppState.fdSelection.item?.id === ew.id;
        if (isSelected) {
            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff00ff';
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 8;
            ctx.setLineDash([]);
            ctx.stroke();
            ctx.restore();
        }

        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    });

    // [バグ修正 _fdSel重複宣言の解消] 関数の先頭で既に安全に宣言済み
    const _fBeams = window.AppState.foundationBeams || [];
    // [バグ修正 基礎梁描画の絶対可視化] 險ｺ譁ｭ励Ο�ヨ: ��繧ｿの蟄伜惠遒ｺ隱�
    if (_fBeams.length > 0) {
        console.log(`[基礎梁描画デバッグ] Beams found: ${_fBeams.length}`);
    } else {
        console.log(`[基礎梁描画デバッグ] Beams list is empty!`);
    }

    // [機能追加 山場Step1: スパン別プロパティとレポート枠] 表示フィルタバグの修正（未定義時は表示）
    _fBeams.filter(b => !window.AppState.elementVisibility || window.AppState.elementVisibility.f_beams !== false).forEach(b => {
        // [機能改善 スパン単位UI対応 描画ヘルパー関数
        const drawBeamSegment = (p1Obj, p2Obj, props, isSelected, isNGStatus = false) => {
            // [バグ修正 座標欠損の特定と修復] .x/.y 繧明示的に抽出が Number() でキャスト
            const px1 = Number(p1Obj?.x), py1 = Number(p1Obj?.y);
            const px2 = Number(p2Obj?.x), py2 = Number(p2Obj?.y);

            const p1 = toCanvas(px1, py1);
            const p2 = toCanvas(px2, py2);

            // [バグ修正 蠎ｧ讓咏�ｴ謳阪�特定と修復] 描画キャンセル逅�罰の蠑ｷ蛻ｶｭ繧ｰ蜃ｺ蜉�
            if (p1.cx == null || isNaN(p1.cx) || p2.cx == null || isNaN(p2.cx)) {
                console.error("�圷 描画キャンセル逋ｺ逕�! 蜈�ｺｧ讓吶ョｼ繧ｿ逡ｰ蟶ｸ:", { p1Obj, p2Obj }, " -> toCanvas結果:", { p1, p2 });
                return;
            }

            // [バグ修正 基礎梁描画の絶対可視化] 蜴ｳ譬ｼがｪ描画鬆�ｺ上〒譴∵悽菴薙ｒ描画
            ctx.beginPath();
            ctx.moveTo(p1.cx, p1.cy);
            ctx.lineTo(p2.cx, p2.cy);

            // 濶ｲ繧�､ｪが輔�謖�ｮ�
            // [機能改善 スパン別検定とUI調整] 視認性向上のための色指定・透過率リセット
            // [バグ修正 基礎レイヤ視認性と選択ハイライト修復] 視認性向上のための不透明化とハイライト適用
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = isSelected ? '#ff00ff' : '#7f8c8d';
            ctx.lineWidth = isSelected ? 8 : 6;
            ctx.lineCap = 'round';
            ctx.setLineDash([]);
            ctx.stroke();

            // [バグ修正 基礎梁描画の絶対可視化] 逕溷ｭ倡｢ｺ隱阪�ｼ繧ｫｼ: 端点に邱代�ｸ繧呈緒逕ｻ (蜊雁ｾ�5px)
            // Debug markers removed

            // 梁名ラベル�(中点付近)�
            const mx2 = (p1.cx + p2.cx) / 2, my2 = (p1.cy + p2.cy) / 2;
            const lstr = `${props?.width || 150}x${props?.height || 640}`;
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = isSelected ? '#ff00ff' : '#2c3e50';
            ctx.fillText(lstr, mx2, my2);

            // [機能改善 スパン別検定とUI調整] NG表示を引数isNGStatus判定に変更
            if (isNGStatus) {
                ctx.font = 'bold 10px sans-serif';
                ctx.fillStyle = '#e74c3c';
                ctx.fillText('判定� NG', mx2, my2 - 14);
            }
        };

        if (b.spans && b.spans.length > 0) {
            // スパンごとに個別に描画
            b.spans.forEach((span, idx) => {
                // [バグ修正 スパン描画エラー解消� 不完全な�がｪ繧ｹ代Φ��繧ｿのガード�
                if (!span || !span.startNode || !span.endNode) return;

                const isSelected = _fdSel.type === 'beam_span' && _fdSel.item?.id === b.id && _fdSel.spanIndex === idx;
                // [バグ修正 基礎梁描画の絶対可視化] 譏守､ｺ逧�↑オブジェクト渡し�
                drawBeamSegment(span.startNode, span.endNode, span.props || b.props, isSelected, span.isNG);
            });
        } else {
            // 繧ｹ代Φ��繧ｿが後↑が��ｴ蜷医�輔かｼｫ舌ャ繧ｯ�域立蠖｢蠑擾ｼ�
            if (!b.p1 || !b.p2) return;
            const isSelected = _fdSel.type === 'beam' && _fdSel.item?.id === b.id;
            drawBeamSegment(b.p1, b.p2, b.props, isSelected, b.isNG);
        }
    });


    // ---- 人通口描画�暗怜魂縲∫區謚懊″遏ｩ蠖｢�� ----
    // [讖溯�謾ｹ蝟� 要素�レイヤ蛻�崛] f_manholes
    (window.AppState.manholes || []).filter(() => window.AppState.elementVisibility.f_manholes).forEach(mh => {
        const mp = toCanvas(mh.x, mh.y);
        if (mp.cx == null || isNaN(mp.cx)) return;
        const beam = (window.AppState.foundationBeams || []).find(b => b.id === mh.parentBeamId);
        const beamWidthPx = Math.max(8, (beam?.props?.width || 150) * scale);
        const mhHalfW = (mh.width / 2) * scale;
        const mhHalfH = beamWidthPx / 2;
        ctx.save();
        // 白抜き矩形
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(mp.cx - mhHalfW, mp.cy - mhHalfH, mhHalfW * 2, mhHalfH * 2);

        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.strokeRect(mp.cx - mhHalfW, mp.cy - mhHalfH, mhHalfW * 2, mhHalfH * 2);
        // ×印
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mp.cx - mhHalfW, mp.cy - mhHalfH); ctx.lineTo(mp.cx + mhHalfW, mp.cy + mhHalfH);
        ctx.moveTo(mp.cx + mhHalfW, mp.cy - mhHalfH); ctx.lineTo(mp.cx - mhHalfW, mp.cy + mhHalfH);
        ctx.stroke();
        // ラベル
        ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#e74c3c'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('人通口', mp.cx, mp.cy - mhHalfH - 2);

        // [基礎UI改善]� タスク1] 選択ハイライト�
        const isSelected = window.AppState.fdSelection.type === 'manhole' && window.AppState.fdSelection.item?.id === mh.id;
        if (isSelected) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(mp.cx, mp.cy, mhHalfW + 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    });

    // ---- 作図中プレビュー ----
    const fm = (typeof getFdMode === 'function') ? getFdMode() : 'f_beam';
    const fdPts = window.AppState.fdDrawPoints || [];
    const fdSel = window.AppState.fdSelectedPillarLike;

    // f_beam: 蟋狗せ槭�繧ｫｼとラバー�バンド�
    if (fm === 'f_beam' && fdSel) {
        const sp = toCanvas(fdSel.x, fdSel.y);
        if (sp.cx != null && !isNaN(sp.cx)) {
            ctx.save();
            ctx.fillStyle = '#f39c12';
            ctx.beginPath(); ctx.arc(sp.cx, sp.cy, 8, 0, Math.PI * 2); ctx.fill();
            // ラバー�バンド会ｼ医せ翫ャ礼せがｾが溘�槭え繧ｹ菴咲ｽｮがｾで��
            const ep = snapPoint ? toCanvas(snapPoint.x, snapPoint.y) : { cx: mouseX, cy: mouseY };
            ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
            ctx.beginPath(); ctx.moveTo(sp.cx, sp.cy); ctx.lineTo(ep.cx, ep.cy); ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    }

    // f_ext_wall / f_slab: 螟夊ｧ貞ｽ｢ラバー�バンド�
    if ((fm === 'f_ext_wall' || fm === 'f_slab') && fdPts.length > 0) {
        ctx.save();
        ctx.strokeStyle = fm === 'f_ext_wall' ? '#e67e22' : '#2980b9';
        ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
        ctx.beginPath();
        fdPts.forEach((pt, i) => {
            const p = toCanvas(pt.x, pt.y);
            if (p.cx == null || isNaN(p.cx)) return;
            i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy);
        });
        const ep = snapPoint ? toCanvas(snapPoint.x, snapPoint.y) : { cx: mouseX, cy: mouseY };
        ctx.lineTo(ep.cx, ep.cy);
        ctx.stroke();
        ctx.setLineDash([]);
        // 蟋狗せ槭�繧ｫｼ�郁ｿ代￥にが�ｋと髢峨§繧九ヲｳ茨ｼ�
        const fp = toCanvas(fdPts[0].x, fdPts[0].y);
        ctx.fillStyle = fm === 'f_ext_wall' ? '#e67e22' : '#2980b9';
        ctx.beginPath(); ctx.arc(fp.cx, fp.cy, 6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // スナップカーソル�亥香蟄暦ｼ�
    if (snapPoint) {
        const sp = toCanvas(snapPoint.x, snapPoint.y);
        if (sp.cx != null && !isNaN(sp.cx)) {
            ctx.save();
            ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sp.cx - 10, sp.cy); ctx.lineTo(sp.cx + 10, sp.cy);
            ctx.moveTo(sp.cx, sp.cy - 10); ctx.lineTo(sp.cx, sp.cy + 10);
            ctx.stroke();
            ctx.restore();
        }
    }
}

