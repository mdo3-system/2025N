// ==========================================
// main_v2.js - グローバル変数・ユーティリティ・UIコントローラ
// ==========================================

// ★ 定数エイリアス (AppConfigから)
const GRID_SNAP_TOL = window.AppConfig.TOLERANCE.GRID_SNAP;
const MANUAL_GRID_TOL = window.AppConfig.TOLERANCE.MANUAL_GRID;
const TEXT_GRID_TOL = window.AppConfig.TOLERANCE.TEXT_GRID;

// ★ 状態エイリアス (AppStateから)
// ※配列・オブジェクトは参照渡しのため、push等でAppState本体も更新されます。
// ※プリミティブ(数値・文字列・真偽値)は、フェーズ2で `AppState.xxx = ` への一括置換を行います。
// ★ 状態ブリッジ (AppStateへの透過的アクセス)
// プリミティブ値のコピーによる不整合を防ぐため、windowオブジェクトのプロパティとして定義します。
Object.defineProperties(window, {
    currentFloor: { get: () => window.AppState.currentFloor, set: (v) => window.AppState.currentFloor = v, enumerable: true },
    isPrintMode: { get: () => window.AppState.isPrintMode, set: (v) => window.AppState.isPrintMode = v, enumerable: true },
    reqWall: { get: () => window.AppState.reqWall, set: (v) => window.AppState.reqWall = v, enumerable: true },
    currentTotalVal: { get: () => window.AppState.currentTotalVal, set: (v) => window.AppState.currentTotalVal = v, enumerable: true },
    bgLinesOriginal: { get: () => window.AppState.bgLinesOriginal, set: (v) => window.AppState.bgLinesOriginal = v, enumerable: true },
    bgTextsOriginal: { get: () => window.AppState.bgTextsOriginal, set: (v) => window.AppState.bgTextsOriginal = v, enumerable: true },
    gridBubbles: { get: () => window.AppState.gridBubbles, set: (v) => window.AppState.gridBubbles = v, enumerable: true },
    pillars: { get: () => window.AppState.pillars, set: (v) => window.AppState.pillars = v, enumerable: true },
    walls: { get: () => window.AppState.walls, set: (v) => window.AppState.walls = v, enumerable: true },
    windowsArr: { get: () => window.AppState.windowsArr, set: (v) => window.AppState.windowsArr = v, enumerable: true },
    historyStack: { get: () => window.AppState.historyStack, set: (v) => window.AppState.historyStack = v, enumerable: true },
    redoStack: { get: () => window.AppState.redoStack, set: (v) => window.AppState.redoStack = v, enumerable: true },
    areaLines: { get: () => window.AppState.areaLines, set: (v) => window.AppState.areaLines = v, enumerable: true },
    gridXNames: { get: () => window.AppState.gridXNames, set: (v) => window.AppState.gridXNames = v, enumerable: true },
    gridYNames: { get: () => window.AppState.gridYNames, set: (v) => window.AppState.gridYNames = v, enumerable: true },
    gridXCoords: { get: () => window.AppState.gridXCoords, set: (v) => window.AppState.gridXCoords = v, enumerable: true },
    gridYCoords: { get: () => window.AppState.gridYCoords, set: (v) => window.AppState.gridYCoords = v, enumerable: true },
    userEditedGridX: { get: () => window.AppState.userEditedGridX, set: (v) => window.AppState.userEditedGridX = v, enumerable: true },
    userEditedGridY: { get: () => window.AppState.userEditedGridY, set: (v) => window.AppState.userEditedGridY = v, enumerable: true },
    manualGridX: { get: () => window.AppState.manualGridX, set: (v) => window.AppState.manualGridX = v, enumerable: true },
    manualGridY: { get: () => window.AppState.manualGridY, set: (v) => window.AppState.manualGridY = v, enumerable: true },
    areaDrawPoints: { get: () => window.AppState.areaDrawPoints, set: (v) => window.AppState.areaDrawPoints = v, enumerable: true },
    deletedGridX: { get: () => window.AppState.deletedGridX, set: (v) => window.AppState.deletedGridX = v, enumerable: true },
    deletedGridY: { get: () => window.AppState.deletedGridY, set: (v) => window.AppState.deletedGridY = v, enumerable: true },
    scale: { get: () => window.AppState.scale, set: (v) => window.AppState.scale = v, enumerable: true },
    offsetX: { get: () => window.AppState.offsetX, set: (v) => window.AppState.offsetX = v, enumerable: true },
    offsetY: { get: () => window.AppState.offsetY, set: (v) => window.AppState.offsetY = v, enumerable: true },
    isDragging: { get: () => window.AppState.isDragging, set: (v) => window.AppState.isDragging = v, enumerable: true },
    lastMouseX: { get: () => window.AppState.lastMouseX, set: (v) => window.AppState.lastMouseX = v, enumerable: true },
    lastMouseY: { get: () => window.AppState.lastMouseY, set: (v) => window.AppState.lastMouseY = v, enumerable: true },
    mouseX: { get: () => window.AppState.mouseX, set: (v) => window.AppState.mouseX = v, enumerable: true },
    mouseY: { get: () => window.AppState.mouseY, set: (v) => window.AppState.mouseY = v, enumerable: true },
    hoveredPillar: { get: () => window.AppState.hoveredPillar, set: (v) => window.AppState.hoveredPillar = v, enumerable: true },
    selectedPillar: { get: () => window.AppState.selectedPillar, set: (v) => window.AppState.selectedPillar = v, enumerable: true },
    snapPoint: { get: () => window.AppState.snapPoint, set: (v) => window.AppState.snapPoint = v, enumerable: true },
    currentG: { get: () => window.AppState.currentG, set: (v) => window.AppState.currentG = v, enumerable: true },
    currentC: { get: () => window.AppState.currentC, set: (v) => window.AppState.currentC = v, enumerable: true },
    // [機能改善 外壁仕様追加]
    exteriorWallWeight: { get: () => window.AppState.exteriorWallWeight, set: (v) => window.AppState.exteriorWallWeight = v, enumerable: true },
    // [機能改善 荷重仕様拡充]
    roofWeight: { get: () => window.AppState.roofWeight, set: (v) => window.AppState.roofWeight = v, enumerable: true },
    solarWeight: { get: () => window.AppState.solarWeight, set: (v) => window.AppState.solarWeight = v, enumerable: true },
    ceilingInsWeight: { get: () => window.AppState.ceilingInsWeight, set: (v) => window.AppState.ceilingInsWeight = v, enumerable: true },
    wallInsWeight: { get: () => window.AppState.wallInsWeight, set: (v) => window.AppState.wallInsWeight = v, enumerable: true },
    
    // [機能改善 要素レイヤ切替]
    elementVisibility: { get: () => window.AppState.elementVisibility, set: (v) => window.AppState.elementVisibility = v, enumerable: true },

    pIdCounter: { get: () => window.AppState.pIdCounter, set: (v) => window.AppState.pIdCounter = v, enumerable: true },
    window_currentDxfRaw: { get: () => window.AppState.window_currentDxfRaw, set: (v) => window.AppState.window_currentDxfRaw = v, enumerable: true },
    docDrawings: { get: () => window.AppState.docDrawings, set: (v) => window.AppState.docDrawings = v, enumerable: true },
    canvas: { get: () => window.AppState.canvas, set: (v) => window.AppState.canvas = v, enumerable: true },
    ctx: { get: () => window.AppState.ctx, set: (v) => window.AppState.ctx = v, enumerable: true },
    // [基礎計算追加 Phase1] アプリモードのブリッジ
    currentAppMode: { get: () => window.AppState.currentAppMode, set: (v) => window.AppState.currentAppMode = v, enumerable: true },
    // [基礎計算追加 Phase1] 基礎データ配列のブリッジ
    exteriorWalls: { get: () => window.AppState.exteriorWalls, set: (v) => window.AppState.exteriorWalls = v, enumerable: true },
    foundationBeams: { get: () => window.AppState.foundationBeams, set: (v) => window.AppState.foundationBeams = v, enumerable: true },
    foundationSlabs: { get: () => window.AppState.foundationSlabs, set: (v) => window.AppState.foundationSlabs = v, enumerable: true },
    manholes: { get: () => window.AppState.manholes, set: (v) => window.AppState.manholes = v, enumerable: true },
    // [基礎計算追加 Phase2] サブモードとバッファのブリッジ
    foundationMode: { get: () => window.AppState.foundationMode, set: (v) => window.AppState.foundationMode = v, enumerable: true },
    fdDrawPoints: { get: () => window.AppState.fdDrawPoints, set: (v) => window.AppState.fdDrawPoints = v, enumerable: true },
    fdSelectedPillarLike: { get: () => window.AppState.fdSelectedPillarLike, set: (v) => window.AppState.fdSelectedPillarLike = v, enumerable: true },
    // [基礎計算追加 Phase4] 選択基礎梁のブリッジ
    selectedFoundationBeam: { get: () => window.AppState.selectedFoundationBeam, set: (v) => window.AppState.selectedFoundationBeam = v, enumerable: true },
    selectedElement: { get: () => window.AppState.selectedElement, set: (v) => window.AppState.selectedElement = v, enumerable: true }
});

function handleModeChange() { selectedPillar = null; areaDrawPoints = []; snapPoint = null; hidePillarProps(); triggerUpdate(); }

// [基礎計算追加 Phase1] アプリモードの切替関数
// mode: 'wall' | 'foundation'
function switchAppMode(mode) {
    currentAppMode = mode;

    // 壁量モード専用パネルの表示/非表示
    const wallPanel = document.getElementById('wall-mode-panel');
    const foundPanel = document.getElementById('foundation-mode-panel');
    if (wallPanel)  wallPanel.style.display  = (mode === 'wall')       ? '' : 'none';
    if (foundPanel) foundPanel.style.display = (mode === 'foundation') ? '' : 'none';

    // [機能追加 立面軸力図ビューア] 基礎モード時のみボタンを表示
    const elCtrl = document.getElementById('elevation-viewer-ctrl');
    if (elCtrl) elCtrl.style.display = (mode === 'foundation') ? 'block' : 'none';

    // [基礎UI改善 タスク1] モード切替時に詳細パネル・ポップアップを閉じる
    hideFdPropertyPopup();
    hidePillarProps();

    // [UI改修 基礎タブ移動] 中央ヘッダーのタブのハイライトを更新
    const tf = document.getElementById('tab-foundation');
    const t1 = document.getElementById('tab-1f');
    const t2 = document.getElementById('tab-2f');

    if (mode === 'foundation') {
        if (tf) tf.className = 'tab-btn active';
        if (t1) t1.className = 'tab-btn';
        if (t2) t2.className = 'tab-btn';

        // [機能改善 基礎モード初期設定] 基礎に不要な表示をOFFにし、操作をN値モードへ強制
        const visWall = document.getElementById('vis-wall');
        const visDiaph = document.getElementById('vis-diaph');
        if (visWall) { visWall.checked = false; window.AppState.elementVisibility.walls = false; }
        if (visDiaph) { visDiaph.checked = false; window.AppState.elementVisibility.areas = false; }

        const nValueTool = document.querySelector('input[name="mode"][value="n-value"]');
        if (nValueTool) {
            nValueTool.checked = true;
            if (typeof handleModeChange === 'function') handleModeChange();
        }
    } else {
        // 壁量モードの場合は setFloor 内でハイライトを維持するため、ここでは基礎タブのみ消灯
        if (tf) tf.className = 'tab-btn';
    }

    // 描画を再トリガー
    triggerUpdate();
    console.log('[UI改修 基礎タブ移動] アプリモードを切替:', mode);
}

// [基礎計算追加 Phase1] 現在のアプリモードを取得
function getAppMode() { return window.AppState.currentAppMode || 'wall'; }

// [基礎計算追加 Phase2] 基礎サブモード取得
function getFdMode() { return window.AppState.foundationMode || 'f_beam'; }

// [基礎計算追加 Phase2] 基礎モードのUIビジュアル更新
function updateFdModeUI(mode) {
    window.AppState.foundationMode = mode;
    window.AppState.fdDrawPoints = [];
    window.AppState.fdSelectedPillarLike = null;
    // [バグ修正 スラブ吸着・削除ツール] 選択状態をリセットしポップアップを閉じる
    window.AppState.fdSelection = { type: null, item: null };
    if (typeof hideFdPropertyPopup === 'function') hideFdPropertyPopup();

    // ラベルのビジュアルハイライト
    const labels = document.querySelectorAll('.fd-mode-label');
    labels.forEach(lbl => {
        const rad = lbl.querySelector('input');
        if (rad && rad.value === mode) {
            lbl.style.background = '#6c3483';
            lbl.style.fontWeight = 'bold';
        } else {
            lbl.style.background = '#4a235a';
            lbl.style.fontWeight = 'normal';
        }
    });

    triggerUpdate();
    console.log('[基礎計算追加 Phase2] 基礎サブモード切替:', mode);
}

// [基礎計算追加 Phase2] 基礎用グリッドスナップ（基礎梁端点・グリッド交点）
function getFdSnapPoint(mx, my) {
    const toW = (cx, cy) => ({ x: (cx - offsetX) / scale, y: (canvas.height - cy - offsetY) / scale });
    // [バグ修正 スラブ吸着・削除ツール] 吸着判定半径をスクリーン基準(20px)のワールド座標系に設定
    let snapRadius = 20 / scale;
    let best = null, bestD = snapRadius; 
    const wp = toW(mx, my);

    // グリッド交点へのスナップ
    gridXCoords.forEach(gx => gridYCoords.forEach(gy => {
        const d = Math.hypot(wp.x - gx, wp.y - gy);
        if (d < bestD) { bestD = d; best = { x: gx, y: gy }; }
    }));
    // 基礎梁端点へのスナップ
    foundationBeams.forEach(b => {
        [b.p1, b.p2].forEach(p => {
            const d = Math.hypot(wp.x - p.x, wp.y - p.y);
            if (d < bestD) { bestD = d; best = { x: p.x, y: p.y }; }
        });
    });
    // 吸着なしならマウス座標をワールド変換
    return best || wp;
}

// [基礎UI改善 タスク1] ポリゴン判定（点が含まれるか）
function isPointInPolygon(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > p.y) !== (yi > p.y)) // typo in logic, fixing below
    }
    // Correct Winding Number or Ray Casting:
    let x = p.x, y = p.y;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        if (((poly[i].y > y) !== (poly[j].y > y)) && (x < (poly[j].x - poly[i].x) * (y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)) inside = !inside;
    }
    return inside;
}

// [機能追加 上部データ連携と一括UI] 直前のポップアップ位置を保持
let lastPopupMx = 0, lastPopupMy = 0;

// [基礎UI改善 タスク1] 基礎要素プロパティポップアップの表示
function showFdPropertyPopup(type, item, mx, my) {
    if (mx !== undefined) lastPopupMx = mx;
    if (my !== undefined) lastPopupMy = my;

    // 前回の選択を継承するガード（引数なし呼び出し対応）
    if (!type && !item) {
        type = window.AppState.fdSelection.type;
        item = window.AppState.fdSelection.item;
    }
    if (!type || !item) return;

    window.AppState.fdSelection = { type, item };
    const popup = document.getElementById('fd-property-popup');
    const title = document.getElementById('fd-popup-title');
    const content = document.getElementById('fd-popup-content');
    if (!popup || !title || !content) return;

    // [UI改善 ポップアップの移動と閉じるボタン] 画面外見切れの防止（クランプ処理）
    let px = mx + 20;
    let py = my + 20;
    const popW = 320, popH = 450; // 推定最大サイズ
    if (px + popW > window.innerWidth) px = window.innerWidth - popW - 20;
    if (py + popH > window.innerHeight) py = window.innerHeight - popH - 20;
    if (px < 10) px = 10;
    if (py < 10) py = 10;

    popup.style.left = px + 'px';
    popup.style.top = py + 'px';
    popup.style.display = 'block';

    // [UI改善 ポップアップの移動と閉じるボタン] ドラッグ移動の実装
    const header = document.getElementById('fd-popup-header');
    if (header && !header.dataset.dragInit) {
        let isDragging = false, startX, startY, initX, initY;
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            initX = parseInt(popup.style.left, 10) || 0;
            initY = parseInt(popup.style.top, 10) || 0;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let nx = initX + (e.clientX - startX);
            let ny = initY + (e.clientY - startY);
            // 画面外クランプ
            if (nx < 0) nx = 0;
            if (ny < 0) ny = 0;
            if (nx + popup.offsetWidth > window.innerWidth) nx = window.innerWidth - popup.offsetWidth;
            if (ny + popup.offsetHeight > window.innerHeight) ny = window.innerHeight - popup.offsetHeight;
            popup.style.left = nx + 'px';
            popup.style.top = ny + 'px';
        });
        document.addEventListener('mouseup', () => { isDragging = false; });
        header.dataset.dragInit = 'true';
    }

    // コンテンツ生成
    let html = '';
    if (type === 'beam') {
        const beam = item;
        // [機能追加 上部データ連携と一括UI] 通り芯名の特定
        let axisName = "";
        const span0 = beam.spans[0];
        if (span0) {
            const dx = Math.abs(span0.startNode.x - span0.endNode.x);
            const dy = Math.abs(span0.startNode.y - span0.endNode.y);
            if (dx > dy) {
                const idx = gridYCoords.findIndex(y => Math.abs(y - span0.startNode.y) < 10);
                axisName = idx >= 0 ? `${gridYNames[idx]}通り` : "水平梁";
            } else {
                const idx = gridXCoords.findIndex(x => Math.abs(x - span0.startNode.x) < 10);
                axisName = idx >= 0 ? `${gridXNames[idx]}通り` : "垂直梁";
            }
        }

        title.innerText = `🏗 基礎梁 一括プロパティ (${axisName})`;
        
        // 全スパンの情報をテーブル形式で構築
        let tableHtml = `
            <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:5px;">
                <thead>
                    <tr style="background:#f2f2f2; border-bottom:1px solid #ddd;">
                        <th style="padding:4px; text-align:left;">No. / 長さ</th>
                        <th style="padding:4px; text-align:left;">幅/成/配筋</th>
                        <th style="padding:4px; text-align:center;">判定</th>
                    </tr>
                </thead>
                <tbody>
        `;

        beam.spans.forEach((span, idx) => {
            const p = span.props || beam.props;
            const badge = span.isNG ? '<span style="color:#e74c3c; font-weight:bold;">NG</span>' : '<span style="color:#27ae60; font-weight:bold;">OK</span>';
            const sLen = span.spanLength ? Math.round(span.spanLength) : '-';

            tableHtml += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px 4px; vertical-align:top;">
                        <div style="font-weight:bold; color:#e67e22;">スパン${idx+1}</div>
                        <div style="color:#666;">${sLen}mm</div>
                    </td>
                    <td style="padding:8px 4px;">
                        <div style="display:flex; gap:5px; margin-bottom:4px;">
                            <input type="number" value="${p.width}" onchange="updateFdItemProp('beam', ${beam.id}, 'width', this.value, ${idx})" style="width:45px; font-size:10px;">
                            ×
                            <input type="number" value="${p.height}" onchange="updateFdItemProp('beam', ${beam.id}, 'height', this.value, ${idx})" style="width:45px; font-size:10px;">
                        </div>
                        <div style="margin-bottom:2px;"><input type="text" value="${p.topRebar}" onchange="updateFdItemProp('beam', ${beam.id}, 'topRebar', this.value, ${idx})" style="width:100px; font-size:10px;" placeholder="上端筋"></div>
                        <div style="margin-bottom:2px;"><input type="text" value="${p.bottomRebar}" onchange="updateFdItemProp('beam', ${beam.id}, 'bottomRebar', this.value, ${idx})" style="width:100px; font-size:10px;" placeholder="下端筋"></div>
                        <div><input type="text" value="${p.stirrup}" onchange="updateFdItemProp('beam', ${beam.id}, 'stirrup', this.value, ${idx})" style="width:100px; font-size:10px;" placeholder="あばら筋"></div>
                    </td>
                    <td style="padding:8px 4px; text-align:center; vertical-align:middle;">
                        ${badge}
                    </td>
                </tr>
            `;
        });

        tableHtml += `</tbody></table>`;
        
        html = `
            <div class="calc-box" style="padding:10px; max-height:450px; overflow-y:auto;">
                <div style="background:#fff3cd; color:#856404; padding:6px; font-size:10px; border-radius:3px; margin-bottom:10px;">
                    ※ 変更内容は全ての計算に即時反映されます。
                </div>
                ${tableHtml}
                <button onclick='showFoundationBeamReportModal(${JSON.stringify(beam)})' style="width:100%; margin-top:12px; padding:8px; background:#2980b9; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;">
                    📊 通り別 計算書プレビュー
                </button>
            </div>
        `;
    } else if (type === 'slab') {
        title.innerText = '🟦 基礎スラブ プロパティ';

        const p = item.props || {};
        // 配筋・断面積の初期計算を確実に行う
        if (!p.rebarShort) p.rebarShort = { type: 'D13', pitch: 200, at: 0 };
        if (!p.rebarLong)  p.rebarLong  = { type: 'D13', pitch: 200, at: 0 };
        p.rebarShort.at = calculateSlabAt(p.rebarShort.type, p.rebarShort.pitch);
        p.rebarLong.at  = calculateSlabAt(p.rebarLong.type, p.rebarLong.pitch);

        const supportOpts = [
            '4辺固定', '3辺固定1辺ピン（長辺ピン）', '3辺固定1辺ピン（短辺ピン）',
            '2隣辺固定2隣辺ピン', '長辺2辺固定短辺2辺ピン', '短辺2辺固定長辺2辺ピン',
            '1辺固定3辺ピン（長辺固定）', '1辺固定3辺ピン（短辺固定）', '4辺ピン', '片持ち' // [機能改善 片持ちスラブ対応]
        ];
        const typeOpts = ['D10', 'D10/D13', 'D13', 'D16', 'D13/D16'];
        const pitchOpts = [75, 100, 150, 200, 300];

        const row = (label, html, id = '') => `<div class="calc-row" ${id ? `id="${id}"` : ''} style="display:flex; align-items:center; margin-bottom:5px;"><label style="font-size:11px;width:100px;">${label}</label>${html}</div>`;
        const sel = (key, current, opts, path = '') => {
            const pathStr = path ? `${path}.${key}` : key;
            return `<select onchange="updateFdItemProp('slab', ${item.id}, '${pathStr}', this.value)" style="flex:1; padding:2px; font-size:11px;">
                ${opts.map(o => `<option value="${o}" ${o == current ? 'selected' : ''}>${o}</option>`).join('')}
            </select>`;
        };

        html = `<div class="calc-box" style="padding:10px;">
            <div style="font-size:11px; margin-bottom:10px; font-weight:bold; color:#8e44ad; border-bottom:1px solid #ddd; padding-bottom:5px;">■ 設計情報</div>
            ${row('スラブ名', `<input type="text" value="${p.name || 'S1'}" onchange="updateFdItemProp('slab', ${item.id}, 'name', this.value)" style="flex:1;">`)}
            ${row('支持条件', sel('support', p.support || '4辺固定', supportOpts))}
            
            <!-- [機能改善 片持ちスラブ対応] 支持条件が片持ちの場合のみ表示 -->
            <div id="row-cantilever-length" style="display: ${p.support === '片持ち' ? 'flex' : 'none'}; align-items:center; margin-bottom:5px;">
                <label style="font-size:11px; width:100px;">片持ち長さ L (m)</label>
                <input type="number" step="0.1" value="${p.cantileverLength || 0.9}" onchange="updateFdItemProp('slab', ${item.id}, 'cantileverLength', this.value)" style="width:60px;">
            </div>

            ${row('板厚 D (mm)', `<input type="number" value="${p.slabThickness || 150}" onchange="updateFdItemProp('slab', ${item.id}, 'slabThickness', this.value)" style="width:60px;">`)}
            ${row('天端高 (mm)', `<input type="number" id="prop-slab-top-height" value="${p.slabTopHeight || 50}" onchange="updateFdItemProp('slab', ${item.id}, 'slabTopHeight', this.value)" style="width:60px;">`)}
            ${row('かぶり dt (mm)', `<input type="number" id="prop-slab-dt" value="${p.coverDepth || 70}" onchange="updateFdItemProp('slab', ${item.id}, 'coverDepth', this.value)" style="width:60px;">`)}

            <div style="font-size:11px; margin:10px 0 5px 0; font-weight:bold; color:#8e44ad; border-bottom:1px solid #ddd; padding-bottom:5px;">■ 短辺方向 配筋</div>
            ${row('種別', sel('type', p.rebarShort.type, typeOpts, 'rebarShort'))}
            ${row('ピッチ (@)', sel('pitch', p.rebarShort.pitch, pitchOpts, 'rebarShort'))}
            <div style="text-align:right; font-size:11px; color:#2c3e50; font-weight:bold; margin-top:2px;">at = <span id="popup-at-short">${(p.rebarShort.at || 0).toFixed(1)}</span> mm²/m</div>

            <div style="font-size:11px; margin:10px 0 5px 0; font-weight:bold; color:#8e44ad; border-bottom:1px solid #ddd; padding-bottom:5px;">■ 長辺方向 配筋</div>
            ${row('種別', sel('type', p.rebarLong.type, typeOpts, 'rebarLong'))}
            ${row('ピッチ (@)', sel('pitch', p.rebarLong.pitch, pitchOpts, 'rebarLong'))}
            <div style="text-align:right; font-size:11px; color:#2c3e50; font-weight:bold; margin-top:2px;">at = <span id="popup-at-long">${(p.rebarLong.at || 0).toFixed(1)}</span> mm²/m</div>

            <!-- [機能改善 スラブ検定の即時反映] 結果表示コンテナの明確化 -->
            <div id="slab-calc-result-container" style="margin-top:10px;">
                ${(typeof getFoundationSlabReportHtml === 'function') ? getFoundationSlabReportHtml(item) : ''}
            </div>
        </div>`;
    } else if (type === 'ext_wall') {
        title.innerText = '🧱 外壁線 プロパティ';
        html = `<div class="calc-box">
            <div style="font-size:12px; margin-bottom:10px;">ID: ${item.id} (階: ${item.floor})</div>
            <p style="font-size:11px; color:#666;">外壁線は多角形範囲として荷重算出に使用されます。</p>
        </div>`;
    } else if (type === 'manhole') {
        title.innerText = '⭕ 人通口 プロパティ';
        html = `<div class="calc-box">
            <div class="calc-row"><label>開口幅(mm)</label><input type="number" value="${item.width}" onchange="updateFdItemProp('manhole', ${item.id}, 'width', this.value)"></div>
        </div>`;
    } else if (type === 'beam_span') {
        // [機能改善 スパン単位UI対応] スパン専用ポップアップUI
        const beam = item.beam;
        const spanIndex = item.spanIndex;
        // 内部的に選択状態を正規化
        window.AppState.fdSelection = { type, item: beam, spanIndex };
        
        const span = beam.spans[spanIndex];
        const p = span.props || beam.props; // 未設定なら親梁の設定を参照

        // 通り芯名を特定（水平・垂直判定）
        let axisName = "";
        const dx = Math.abs(span.startNode.x - span.endNode.x);
        const dy = Math.abs(span.startNode.y - span.endNode.y);
        if (dx > dy) { // 水平梁
            const yCoord = span.startNode.y;
            const idx = gridYCoords.findIndex(y => Math.abs(y - yCoord) < 10);
            axisName = idx >= 0 ? `${gridYNames[idx]}通り` : "水平梁";
        } else { // 垂直梁
            const xCoord = span.startNode.x;
            const idx = gridXCoords.findIndex(x => Math.abs(x - xCoord) < 10);
            axisName = idx >= 0 ? `${gridXNames[idx]}通り` : "垂直梁";
        }

        title.innerText = `🏗 基礎梁スパン プロパティ`;
        const row = (label, html) => `<div class="calc-row" style="display:flex; align-items:center; margin-bottom:5px;"><label style="font-size:11px;width:100px;">${label}</label>${html}</div>`;

        // [機能改善 スパン別検定とUI調整] 検定結果のHTML組み立て
        let calcHtml = '';
        if (span.fdStress) {
            const fs = span.fdStress;
            const fmt = (v) => v != null ? (v).toFixed(2) : '-';
            const badge = span.isNG ? '<span style="background:#e74c3c;color:#fff;padding:2px 4px;border-radius:3px;font-size:10px;">NG</span>' : '<span style="background:#27ae60;color:#fff;padding:2px 4px;border-radius:3px;font-size:10px;">OK</span>';
            calcHtml = `
            <div style="font-size:11px; margin-top:10px; font-weight:bold; color:#2980b9; border-bottom:1px solid #ddd; padding-bottom:5px;">■ 検定結果 ${badge}</div>
            <div style="display:flex; font-size:10px; margin-top:5px;">
                <div style="flex:1;">
                    <div style="color:#666;">長期 M/Ma</div>
                    <div style="font-weight:bold; ${fs.ratioM_L > 1.0 ? 'color:#e74c3c;' : 'color:#333;'}">${fmt(fs.ratioM_L)}</div>
                </div>
                <div style="flex:1;">
                    <div style="color:#666;">長期 Q/Qa</div>
                    <div style="font-weight:bold; ${fs.ratioQ_L > 1.0 ? 'color:#e74c3c;' : 'color:#333;'}">${fmt(fs.ratioQ_L)}</div>
                </div>
                <div style="flex:1;">
                    <div style="color:#666;">短期 M/Ma</div>
                    <div style="font-weight:bold; ${fs.ratioM_S > 1.0 ? 'color:#e74c3c;' : 'color:#333;'}">${fmt(fs.ratioM_S)}</div>
                </div>
            </div>`;
        }

        html = `<div class="calc-box" style="padding:10px;">
            <div style="font-size:12px; margin-bottom:10px; font-weight:bold; color:#e67e22; border-bottom:1px solid #ddd; padding-bottom:5px;">
                ${axisName} - スパン ${spanIndex + 1}
            </div>
            <div style="font-size:11px; margin-bottom:10px; color:#666;">
                長さ: ${span.spanLength ? Math.round(span.spanLength) : '-'} mm
            </div>
            ${row('梁幅 (mm)', `<input type="number" value="${p.width}" onchange="updateFdItemProp('beam_span', ${beam.id}, 'width', this.value)" style="width:60px;">`)}
            ${row('梁成 (mm)', `<input type="number" value="${p.height}" onchange="updateFdItemProp('beam_span', ${beam.id}, 'height', this.value)" style="width:60px;">`)}
            ${row('上端筋', `<input type="text" value="${p.topRebar}" onchange="updateFdItemProp('beam_span', ${beam.id}, 'topRebar', this.value)" style="flex:1;">`)}
            ${row('下端筋', `<input type="text" value="${p.bottomRebar}" onchange="updateFdItemProp('beam_span', ${beam.id}, 'bottomRebar', this.value)" style="flex:1;">`)}
            ${row('あばら筋', `<input type="text" value="${p.stirrup}" onchange="updateFdItemProp('beam_span', ${beam.id}, 'stirrup', this.value)" style="flex:1;">`)}
            ${calcHtml}
            <!-- [機能追加 山場Step1: スパン別プロパティとレポート枠] 通り別レポート表示ボタン -->
            <button onclick='showFoundationBeamReportModal(${JSON.stringify(beam)})' style="width:100%; margin-top:12px; padding:10px; background:#2980b9; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; transition:0.2s; display:flex; align-items:center; justify-content:center; gap:5px;" onmouseover="this.style.background='#3498db'" onmouseout="this.style.background='#2980b9'">
                📊 通り別 計算書プレビュー
            </button>
        </div>`;
    }


    content.innerHTML = html;
    requestAnimationFrame(draw);
}

function hideFdPropertyPopup() {
    window.AppState.fdSelection = { type: null, item: null };
    const popup = document.getElementById('fd-property-popup');
    if (popup) popup.style.display = 'none';
    requestAnimationFrame(draw);
}

// [機能拡張 スラブ設計条件と自動判定] スラブ断面積 at の計算
function calculateSlabAt(typeStr, pitch) {
    const diaTbl = { 'D10': 71.3, 'D13': 126.7, 'D16': 198.6 };
    let area = 0;
    if (typeStr === 'D10/D13') area = (diaTbl['D10'] + diaTbl['D13']) / 2;
    else if (typeStr === 'D13/D16') area = (diaTbl['D13'] + diaTbl['D16']) / 2;
    else area = diaTbl[typeStr] || 0;
    
    if (!pitch || pitch <= 0) return 0;
    return area * (1000 / pitch);
}

// [機能追加 上部データ連携と一括UI] 動的プロパティ更新用ヘルパー
window.updateFdItemProp = function(type, id, keyPath, val, spanIndex = null) {
    let item = null;
    if (type === 'slab') item = foundationSlabs.find(s => s.id === id);
    if (type === 'manhole') item = manholes.find(m => m.id === id);
    if (type === 'beam' || type === 'beam_span') item = (foundationBeams || []).find(b => b.id === id);
    if (!item) return;

    let finalVal = (isNaN(val) || val === '' || val.includes('-') || keyPath.includes('name') || keyPath.includes('type') || keyPath.includes('support') || keyPath.includes('Rebar') || keyPath.includes('stirrup')) ? val : parseFloat(val);

    // ネストされたプロパティの更新
    const keys = keyPath.split('.');
    let target = (type === 'slab') ? item.props : item;

    if ((type === 'beam' || type === 'beam_span') && spanIndex !== null) {
        // [機能追加 上部データ連携と一括UI] 特定スパンのプロパティ更新
        const span = item.spans[spanIndex];
        if (span) {
            if (!span.props) {
                span.props = JSON.parse(JSON.stringify(item.props));
            }
            span.props[keyPath] = finalVal;
        }

        if (typeof updateCalculations === 'function') updateCalculations();
        // UIの再描画（一括リストを維持するため位置を固定して再表示）
        setTimeout(() => showFdPropertyPopup('beam', item, lastPopupMx, lastPopupMy), 0); 
    } else {
        for (let i = 0; i < keys.length - 1; i++) {
            if (!target[keys[i]]) target[keys[i]] = {};
            target = target[keys[i]];
        }
        target[keys[keys.length - 1]] = finalVal;
    }

    // スラブ配筋修正時は at を再計算
    if (type === 'slab' && keyPath.includes('rebar')) {
        const p = item.props;
        p.rebarShort.at = calculateSlabAt(p.rebarShort.type, p.rebarShort.pitch);
        p.rebarLong.at = calculateSlabAt(p.rebarLong.type, p.rebarLong.pitch);
        
        // ポップアップが開いていればUIを即時更新
        const elShort = document.getElementById('popup-at-short');
        const elLong  = document.getElementById('popup-at-long');
        if (elShort) elShort.innerText = p.rebarShort.at.toFixed(1);
        if (elLong)  elLong.innerText  = p.rebarLong.at.toFixed(1);
    }

    // [機能改善 スラブ検定の即時反映] リアルタイム計算の実行とUI更新
    if (type === 'slab') {
        // ① 更新・保存は既に完了済み
        // ② at の更新も既に完了済み (322-332行目)
        
        // ③ 再計算の実行 (確実に最新値を反映させるため同期的に呼び出し)
        if (typeof updateCalculations === 'function') {
            updateCalculations();
        }
        
        // 全体の描画更新
        if (typeof renderAll === 'function') {
            renderAll();
        } else {
            requestAnimationFrame(draw);
        }

        // ④ ポップアップ内の検定結果表示（OK/NGや検定比）を最新の状態に即時書き換える
        const reportCont = document.getElementById('slab-calc-result-container');
        if (reportCont && typeof getFoundationSlabReportHtml === 'function') {
            reportCont.innerHTML = getFoundationSlabReportHtml(item);
        }

        // [機能改善 片持ちスラブ対応] 支持条件変更時に長さ入力の表示/非表示を切り替える
        if (keyPath === 'support') {
            const rowCant = document.getElementById('row-cantilever-length');
            if (rowCant) {
                rowCant.style.display = (val === '片持ち' ? 'flex' : 'none');
            }
        }
    } else {
        triggerUpdate();
    }
};

// [基礎UI改善 タスク1] 全基礎要素のヒットテスト
function trySelectFoundationElement(mx, my) {
    const toC = (x, y) => ({ cx: x * scale + offsetX, cy: canvas.height - (y * scale + offsetY) });
    const toW = (cx, cy) => ({ x: (cx - offsetX) / scale, y: (canvas.height - cy - offsetY) / scale });
    const wp = toW(mx, my);
    const HIT = 25; // px

    // 1. 人通口 (点)
    for (const mh of (manholes || [])) {
        const mc = toC(mh.x, mh.y);
        if (Math.hypot(mx - mc.cx, my - mc.cy) < HIT) {
            showFdPropertyPopup('manhole', mh, mx, my);
            return true;
        }
    }

    // 2. 基礎梁 (線) -> [機能改善 スパン単位UI対応] スパン単位の判定
    for (const b of (foundationBeams || [])) {
        if (b.spans && b.spans.length > 0) {
            for (let i = 0; i < b.spans.length; i++) {
                const span = b.spans[i];
                // [バグ修正 スパン判定エラー解消] 不完全なデータのガード
                if (!span || !span.startNode || !span.endNode) continue;

                const p1c = toC(span.startNode.x, span.startNode.y);
                const p2c = toC(span.endNode.x, span.endNode.y);
                const l2 = (p2c.cx - p1c.cx) ** 2 + (p2c.cy - p1c.cy) ** 2;
                const t = l2 > 0 ? Math.max(0, Math.min(1, ((mx - p1c.cx) * (p2c.cx - p1c.cx) + (my - p1c.cy) * (p2c.cy - p1c.cy)) / l2)) : 0;
                const dist = Math.hypot(mx - (p1c.cx + t * (p2c.cx - p1c.cx)), my - (p1c.cy + t * (p2c.cy - p1c.cy)));
                if (dist < HIT) {
                    // [機能追加 上部データ連携と一括UI] スパン個別ではなく連続梁全体を選択するように変更
                    showFdPropertyPopup('beam', b, mx, my);
                    return true;
                }
            }
        } else {
            // スパンがない場合のフォールバック [バグ修正 スパン判定エラー解消]
            if (!b || !b.p1 || !b.p2) continue;

            const p1c = toC(b.p1.x, b.p1.y), p2c = toC(b.p2.x, b.p2.y);
            const l2 = (p2c.cx - p1c.cx) ** 2 + (p2c.cy - p1c.cy) ** 2;
            const t = l2 > 0 ? Math.max(0, Math.min(1, ((mx - p1c.cx) * (p2c.cx - p1c.cx) + (my - p1c.cy) * (p2c.cy - p1c.cy)) / l2)) : 0;
            const dist = Math.hypot(mx - (p1c.cx + t * (p2c.cx - p1c.cx)), my - (p1c.cy + t * (p2c.cy - p1c.cy)));
            if (dist < HIT) {
                showFdPropertyPopup('beam', b, mx, my);
                return true;
            }
        }
    }

    // 3. スラブ (多角形)
    for (const s of (foundationSlabs || [])) {
        if (isPointInPolygon(wp, s.vertices)) {
            showFdPropertyPopup('slab', s, mx, my);
            return true;
        }
    }

    // 4. 外壁線 (多角形)
    for (const ew of (exteriorWalls || [])) {
        if (isPointInPolygon(wp, ew.vertices)) {
            showFdPropertyPopup('ext_wall', ew, mx, my);
            return true;
        }
    }

    hideFdPropertyPopup();
    return false;
}

// [基礎計算追加 Phase2] 基礎モードのmousedownハンドラ（壁量側イベントから呼ばれる）
function handleFoundationMouseDown(e) {
    // [バグ修正 スラブ吸着・削除ツール] 座標の正規化
    let rect = canvas.getBoundingClientRect();
    let mx = e.clientX - rect.left;
    let my = e.clientY - rect.top;

    const fm = getFdMode();
    const snap = getFdSnapPoint(mx, my);
    const toC = (x, y) => ({ cx: x * scale + offsetX, cy: canvas.height - (y * scale + offsetY) });

    // [基礎UI改善 タスク1] 選択モードの処理
    if (fm === 'f_select') {
        trySelectFoundationElement(mx, my);
        return;
    }

    // [基礎UI改善 タスク1] 作図中に入力を優先するため、選択判定は最初に行わない
    // ただし、削除モード以外で作図中でないなら選択判定を試みる
    if (fm !== 'f_delete' && fm !== 'f_select') {
        // 梁の始点が決まっていない、または多角形入力中でない場合のみ選択可能
        if (!fdSelectedPillarLike && fdDrawPoints.length === 0) {
            // ここでの選択は、作図を阻害しないように配慮
            // (今回は明示的な f_select モードがあるため、自動選択は限定的に)
        }
    }

    // ---- f_beam: 基礎梁の2点入力 ----
    if (fm === 'f_beam') {
        if (!fdSelectedPillarLike) {
            fdSelectedPillarLike = { x: snap.x, y: snap.y };
        } else {
            const p1 = fdSelectedPillarLike;
            const p2 = { x: snap.x, y: snap.y };
            if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 10) {
                const w  = parseFloat(document.getElementById('fd-beam-width')?.value)  || 150;
                const h  = parseFloat(document.getElementById('fd-beam-height')?.value) || 640;
                const ed = parseFloat(document.getElementById('fd-embed-depth')?.value) || 240;
                const tr = document.getElementById('fd-top-rebar')?.value  || '1-D13';
                const br = document.getElementById('fd-bot-rebar')?.value  || '1-D13';
                const st = document.getElementById('fd-stirrup')?.value    || '1-D10@200';
                const nb = { id: Date.now(), p1, p2, props: { width: w, height: h, embedDepth: ed, topRebar: tr, bottomRebar: br, stirrup: st } };
                foundationBeams.push(nb);
            }
            fdSelectedPillarLike = null;
            triggerUpdate();
        }
        return;
    }

    // ---- f_ext_wall / f_slab: 多角形入力（面積ツール流用）----
    if (fm === 'f_ext_wall' || fm === 'f_slab') {
        const pt = { x: snap.x, y: snap.y };
        // [バグ修正 スラブ吸着・削除ツール] 始点クリックで閉じる判定距離を 20px 相当に修正
        if (fdDrawPoints.length > 2 &&
            Math.hypot(pt.x - fdDrawPoints[0].x, pt.y - fdDrawPoints[0].y) < 20 / scale) {
            const vts = fdDrawPoints.map(p => ({ x: p.x, y: p.y }));
            if (fm === 'f_ext_wall') {
                exteriorWalls.push({ id: Date.now(), floor: currentFloor, vertices: vts, closed: true });
            } else {
                const sth = parseFloat(document.getElementById('fd-slab-top-height')?.value) || 50;
                const stk = parseFloat(document.getElementById('fd-slab-thickness')?.value) || 150;
                const newSlab = { id: Date.now(), vertices: vts, closed: true, props: { slabTopHeight: sth, slabThickness: stk } };
                foundationSlabs.push(newSlab);

                // [機能補完 最終調整] スラブを閉じるときに基礎梁を自動生成
                for (let i = 0; i < vts.length; i++) {
                    const p1 = vts[i];
                    const p2 = vts[(i + 1) % vts.length];
                    // 重複チェック（近傍に既存の梁があるか）
                    const exists = foundationBeams.some(b => 
                        (Math.hypot(b.p1.x - p1.x, b.p1.y - p1.y) < 100 && Math.hypot(b.p2.x - p2.x, b.p2.y - p2.y) < 100) ||
                        (Math.hypot(b.p1.x - p2.x, b.p1.y - p2.y) < 100 && Math.hypot(b.p2.x - p1.x, b.p2.y - p1.y) < 100)
                    );
                    if (!exists) {
                        const w  = parseFloat(document.getElementById('fd-beam-width')?.value)  || 150;
                        const h  = parseFloat(document.getElementById('fd-beam-height')?.value) || 640;
                        const ed = parseFloat(document.getElementById('fd-embed-depth')?.value) || 240;
                        const tr = document.getElementById('fd-top-rebar')?.value  || '1-D13';
                        const br = document.getElementById('fd-bot-rebar')?.value  || '1-D13';
                        const st = document.getElementById('fd-stirrup')?.value    || '1-D10@200';
                        foundationBeams.push({
                            id: Date.now() + i,
                            p1: { x: p1.x, y: p1.y },
                            p2: { x: p2.x, y: p2.y },
                            props: { width: w, height: h, embedDepth: ed, topRebar: tr, bottomRebar: br, stirrup: st }
                        });
                    }
                }
            }
            fdDrawPoints = [];
            triggerUpdate();
            return;
        }
        // 直前点と同じならスキップ
        if (fdDrawPoints.length > 0 &&
            fdDrawPoints[fdDrawPoints.length - 1].x === pt.x &&
            fdDrawPoints[fdDrawPoints.length - 1].y === pt.y) return;
        fdDrawPoints.push(pt);
        triggerUpdate();
        return;
    }

    // ---- f_manhole: 最近傍基礎梁へスナップして人通口配置 ----
    if (fm === 'f_manhole') {
        const wx = snap.x, wy = snap.y;
        let bestBeam = null, bestT = 0, bestDist = Infinity;
        foundationBeams.forEach(b => {
            const dx = b.p2.x - b.p1.x, dy = b.p2.y - b.p1.y;
            const len2 = dx * dx + dy * dy;
            if (len2 < 1) return;
            const t = Math.max(0, Math.min(1, ((wx - b.p1.x) * dx + (wy - b.p1.y) * dy) / len2));
            const nx = b.p1.x + t * dx, ny = b.p1.y + t * dy;
            const d = Math.hypot(wx - nx, wy - ny);
            if (d < bestDist) { bestDist = d; bestBeam = b; bestT = t; }
        });
        const SNAP_TOL_W = 500; // 500mm以内の梁にスナップ
        if (bestBeam && bestDist < SNAP_TOL_W) {
            const dx = bestBeam.p2.x - bestBeam.p1.x, dy = bestBeam.p2.y - bestBeam.p1.y;
            const px = bestBeam.p1.x + bestT * dx, py = bestBeam.p1.y + bestT * dy;
            manholes.push({ id: Date.now(), parentBeamId: bestBeam.id, x: px, y: py, width: 600, t: bestT });
            triggerUpdate();
        } else {
            alert('クリック位置の近くに基礎梁が見つかりません。基礎梁上をクリックしてください。');
        }
        return;
    }

    // ---- f_delete: 要素の削除 ----
    // [バグ修正 スラブ吸着・削除ツール] ロジックを簡素化し、クリックした要素を常に削除
    if (fm === 'f_delete') {
        // trySelectFoundationElement を利用してクリックされた要素を判定
        if (trySelectFoundationElement(mx, my)) {
            const sel = window.AppState.fdSelection;
            if (sel.type && sel.item) {
                if (sel.type === 'beam') {
                    foundationBeams = foundationBeams.filter(b => b.id !== sel.item.id);
                    manholes = manholes.filter(m => m.parentBeamId !== sel.item.id);
                } else if (sel.type === 'slab') {
                    foundationSlabs = foundationSlabs.filter(s => s.id !== sel.item.id);
                } else if (sel.type === 'ext_wall') {
                    exteriorWalls = exteriorWalls.filter(ew => ew.id !== sel.item.id);
                } else if (sel.type === 'manhole') {
                    manholes = manholes.filter(m => m.id !== sel.item.id);
                }
                hideFdPropertyPopup();
                triggerUpdate();
            }
        }
        return;
    }
}

// [基礎計算追加 Phase2] 基礎モードのmousemoveハンドラ
function handleFoundationMouseMove(mx, my) {
    // スナップ点の計算（基礎梁端点・グリッド交点）
    snapPoint = getFdSnapPoint(mx, my);
    requestAnimationFrame(draw);
}

// ★ 動的リストのDOM生成関数 (面材・金物)
function addCustomWallRow(name = '', val = '') {
    let container = document.getElementById('custom-wall-container');
    if (!container) return;
    let div = document.createElement('div');
    div.className = 'calc-row cust-wall-row';
    div.style.marginBottom = '5px';
    div.innerHTML = `<input type="text" class="cust-w-n" placeholder="名称" value="${name}" style="width:130px; margin:0;"><input type="number" class="cust-w-v" placeholder="倍率" step="0.1" value="${val}" style="width:60px; margin:0;"><button class="btn-del-item" style="background:#dc3545;color:#fff;border:none;border-radius:3px;cursor:pointer;padding:2px 5px;margin-left:5px;">✖</button>`;
    div.querySelector('.btn-del-item').onclick = () => { div.remove(); triggerUpdate(); };
    div.querySelectorAll('input').forEach(i => i.addEventListener('input', triggerUpdate));
    container.appendChild(div);
}

function addCustomHwRow(name = '', val = '') {
    let container = document.getElementById('custom-hw-container');
    if (!container) return;
    let div = document.createElement('div');
    div.className = 'calc-row cust-hw-row';
    div.style.marginBottom = '5px';
    div.innerHTML = `<input type="text" class="cust-h-n" placeholder="記号" value="${name}" style="width:130px; margin:0;"><input type="number" class="cust-h-v" placeholder="耐力(kN)" step="0.1" value="${val}" style="width:60px; margin:0;"><button class="btn-del-item" style="background:#dc3545;color:#fff;border:none;border-radius:3px;cursor:pointer;padding:2px 5px;margin-left:5px;">✖</button>`;
    div.querySelector('.btn-del-item').onclick = () => { div.remove(); triggerUpdate(); };
    div.querySelectorAll('input').forEach(i => i.addEventListener('input', triggerUpdate));
    container.appendChild(div);
}

// ★ 履歴管理
function pushHistory(action) {
    historyStack.push(action);
    redoStack = []; // 上記のブリッジにより AppState.redoStack も空になります
    if (historyStack.length > 100) historyStack.shift();
}


function setFloor(floor) {
    // [UI改修 基礎タブ移動] 階切り替え時は壁量モードへ移行
    if (getAppMode() !== 'wall') {
        switchAppMode('wall');
    }

    currentFloor = floor;
    let t1 = document.getElementById('tab-1f'); if (t1) t1.className = (floor === '1F' && getAppMode() === 'wall') ? 'tab-btn active' : 'tab-btn';
    let t2 = document.getElementById('tab-2f'); if (t2) t2.className = (floor === '2F' && getAppMode() === 'wall') ? 'tab-btn active' : 'tab-btn';
    
    // 基礎タブの消灯
    let tf = document.getElementById('tab-foundation'); if (tf) tf.className = 'tab-btn';

    selectedPillar = null; areaDrawPoints = []; hidePillarProps();
    analyzeGrids();
    initViewForce();
    triggerUpdate();
}




function loadData(event) {
    let f = event.target.files[0]; if (!f) return;
    let msg = document.getElementById('action-msg'); let reader = new FileReader();
    reader.onload = function (ev) {
        try {
            let d = JSON.parse(ev.target.result);
            if (d.inputs) { for (let id in d.inputs) { let el = document.getElementById(id); if (el) el.value = d.inputs[id]; } }
            pillars = d.pillars || []; bgTextsOriginal = d.texts || []; pIdCounter = d.pIdCounter || 1000;
            walls = d.walls || []; windowsArr = d.windowsArr || d.windows || [];
            bgLinesOriginal = d.bgLines || []; areaLines = d.areaLines || [];
            gridBubbles = d.gridBubbles || []; manualGridX = d.mgX || []; manualGridY = d.mgY || [];
            gridXNames = d.gx || []; gridYNames = d.gy || []; gridXCoords = d.gxc || []; gridYCoords = d.gyc || [];
            window.userEditedGridX = d.ueGX || {}; window.userEditedGridY = d.ueGY || {};
            deletedGridX = d.deletedGX || []; deletedGridY = d.deletedGY || []; // ★ 課題2：ブラックリスト復元

            // [バグ修正 基礎データのセーブ・ロード対応] 基礎モードデータの復元と空配列フォールバック
            if (window.AppState) {
                window.AppState.foundationSlabs = d.foundationSlabs || [];
                window.AppState.exteriorWalls = d.exteriorWalls || [];
                window.AppState.foundationBeams = d.foundationBeams || [];
                window.AppState.manholes = d.manholes || [];
                window.AppState.concreteFc = d.concreteFc || 21;
                window.AppState.averageGroundPressure = d.averageGroundPressure || 0;
            }


            // ★ 課題3: レイヤ表示設定を復元し、パネルUIを更新
            if (d.layerVisibility) {
                layerVisibility = d.layerVisibility;
            }

            // ★ バグ修正: bgLines/bgTexts全要素を走査してlayerVisibilityを再構築
            // JSONに保存されていないレイヤや、layerが未定義の要素もここで補完する
            bgLinesOriginal.forEach(e => {
                if (!e.layer) e.layer = 'BG_UNASSIGNED'; // レイヤ名がない場合はデフォルト付与
                if (!(e.layer in layerVisibility)) layerVisibility[e.layer] = true;
            });
            bgTextsOriginal.forEach(t => {
                if (!t.layer) t.layer = 'BG_UNASSIGNED';
                if (!(t.layer in layerVisibility)) layerVisibility[t.layer] = true;
            });

            // ★ パネルを最新のlayerVisibilityで再描画
            if (typeof renderLayerPanel === 'function') renderLayerPanel();

            // ★ 追加: JSON復元後のキャンバス描画とUI同期を確実に行う
            setTimeout(() => {
                if (typeof renderLayerPanel === 'function') renderLayerPanel();
                triggerUpdate();
            }, 100);

            // ★ パッチ適用: JSONの壁データにfloor属性がなければ1Fを付与（過去データ救済）
            walls.forEach(w => {
                w.p1 = pillars.find(p => p.id === w.p1.id) || w.p1;
                w.p2 = pillars.find(p => p.id === w.p2.id) || w.p2;
                if (!w.floor) w.floor = w.p1.floor || '1F';
            });
            windowsArr.forEach(w => {
                w.p1 = pillars.find(p => p.id === w.p1.id) || w.p1;
                w.p2 = pillars.find(p => p.id === w.p2.id) || w.p2;
                if (!w.floor) w.floor = w.p1.floor || '1F';
            });

            // 動的リストの復元
            let cwc = document.getElementById('custom-wall-container');
            if (cwc) {
                cwc.innerHTML = '';
                if (d.customWalls && d.customWalls.length > 0) d.customWalls.forEach(cw => addCustomWallRow(cw.n, cw.v));
                else addCustomWallRow();
            }
            let chc = document.getElementById('custom-hw-container');
            if (chc) {
                chc.innerHTML = '';
                if (d.customHws && d.customHws.length > 0) d.customHws.forEach(ch => addCustomHwRow(ch.n, ch.v));
                else addCustomHwRow();
            }

            if (d.dxfRaw) window_currentDxfRaw = d.dxfRaw;

            // ★ 追加: 新方式の生DXFテキストからの docDrawings 復元
            if (d.docDrawingsRaw) {
                const p = new window.DxfParser();
                if (d.docDrawingsRaw.floor) {
                    let res = p.parseSync(d.docDrawingsRaw.floor);
                    if (res && res.entities) docDrawings.floor = { entities: res.entities, loaded: true, rawDxf: d.docDrawingsRaw.floor };
                }
                if (d.docDrawingsRaw.elev) {
                    let res = p.parseSync(d.docDrawingsRaw.elev);
                    if (res && res.entities) docDrawings.elev = { entities: res.entities, loaded: true, rawDxf: d.docDrawingsRaw.elev };
                }
                if (d.docDrawingsRaw.div4) {
                    let res = p.parseSync(d.docDrawingsRaw.div4);
                    if (res && res.entities) docDrawings.div4 = { entities: res.entities, loaded: true, rawDxf: d.docDrawingsRaw.div4 };
                }
            } else if (d.docDxf) {
                const p = new window.DxfParser();
                if (d.docDxf.floor) { let res = p.parseSync(d.docDxf.floor); if (res && res.entities) { docDrawings.floor.rawDxf = d.docDxf.floor; docDrawings.floor.entities = res.entities; docDrawings.floor.loaded = true; } }
                if (d.docDxf.elev) { let res = p.parseSync(d.docDxf.elev); if (res && res.entities) { docDrawings.elev.rawDxf = d.docDxf.elev; docDrawings.elev.entities = res.entities; docDrawings.elev.loaded = true; } }
                if (d.docDxf.div4) { let res = p.parseSync(d.docDxf.div4); if (res && res.entities) { docDrawings.div4.rawDxf = d.docDxf.div4; docDrawings.div4.entities = res.entities; docDrawings.div4.loaded = true; } }
            } else if (bgLinesOriginal.length > 0) {
                // JSONにdocDxfプロパティが含まれていない場合、復元した背景線から帳票用の仮想DXFを再構築する（挿絵表示バグの修正）
                const virtualEntities = bgLinesOriginal.map(l => {
                    let e = { type: l.type };
                    if (l.type === 'LINE' && l.vertices) { e.start = l.vertices[0]; e.end = l.vertices[1]; }
                    else if (['LWPOLYLINE', 'POLYLINE'].includes(l.type)) { e.vertices = l.vertices; }
                    else if (['CIRCLE', 'ARC'].includes(l.type)) { e.center = l.center; e.radius = l.radius; e.startAngle = l.startAngle || 0; e.endAngle = l.endAngle || 360; }
                    return e;
                });
                const docData = { entities: virtualEntities, loaded: true, rawDxf: '' };
                docDrawings.floor = docData; docDrawings.elev = docData; docDrawings.div4 = docData;
            }

            resizeCanvas(); analyzeGrids(); initViewForce(); triggerUpdate();

            // ★ JSON復元直後に各種再計算とレポート描画を強制トリガーさせる（床面積や判定等の表示用）
            if (typeof updateCalculations === 'function') updateCalculations();
            if (typeof updateReport === 'function') updateReport();

            alert("✅ データを復元しました。\n計算書用の挿絵は背景図形から再構築されました。");
            if (msg) msg.innerText = "📂 データを復元しました。";
        } catch (err) { alert("❌ JSON復元失敗: \n" + err.message); }
    };
    reader.readAsText(f);
    event.target.value = '';
}





function undoLastAction() {
    if (historyStack.length === 0) return;
    let last = historyStack.pop();
    redoStack.push(last);
    applyUndo(last);
    triggerUpdate();
}

function redoLastAction() {
    if (redoStack.length === 0) return;
    let last = redoStack.pop();
    historyStack.push(last);
    applyRedo(last);
    triggerUpdate();
}

function applyUndo(last) {
    if (last.type === 'add_wall') walls = walls.filter(w => w.id !== last.obj.id);
    else if (last.type === 'del_wall') walls.push(last.obj);
    else if (last.type === 'add_win') windowsArr = windowsArr.filter(w => w.id !== last.obj.id);
    else if (last.type === 'del_win') windowsArr.push(last.obj);
    else if (last.type === 'edit_wall') {
        let currentStatus = { tv: last.obj.totalVal, ov: last.obj.outPanelVal, iv: last.obj.inPanelVal, bv: last.obj.braceVal, on: last.obj.outPanelName, in: last.obj.inPanelName, bN: last.obj.braceName, iT: last.obj.isTasuki };
        last.redoData = currentStatus;
        last.obj.totalVal = last.oldObj.totalVal; last.obj.outPanelVal = last.oldObj.outPanelVal; last.obj.inPanelVal = last.oldObj.inPanelVal; last.obj.braceVal = last.oldObj.braceVal;
        last.obj.outPanelName = last.oldObj.outPanelName; last.obj.inPanelName = last.oldObj.inPanelName; last.obj.braceName = last.oldObj.braceName; last.obj.isTasuki = last.oldObj.isTasuki;
    }
    else if (last.type === 'edit_text') { last.oldRedo = last.obj.text; last.obj.text = last.oldStr; analyzeGrids(); }
    else if (last.type === 'add_pillar') pillars = pillars.filter(p => p.id !== last.obj.id);
    else if (last.type === 'del_pillar') { last.obj.isDeleted = false; if (last.connectedWalls) last.connectedWalls.forEach(w => walls.push(w)); }
    else if (last.type === 'add_grid') { if (last.isX) manualGridX = manualGridX.filter(m => m !== last.obj); else manualGridY = manualGridY.filter(m => m !== last.obj); analyzeGrids(); }
    else if (last.type === 'del_grid') { if (last.isX) manualGridX.push(last.obj); else manualGridY.push(last.obj); analyzeGrids(); }
    else if (last.type === 'edit_grid_name_x') { let current = gridXNames[last.idx]; gridXNames[last.idx] = last.oldName; last.oldName = current; }
    else if (last.type === 'edit_grid_name_y') { let current = gridYNames[last.idx]; gridYNames[last.idx] = last.oldName; last.oldName = current; }
    else if (last.type === 'add_area') areaLines = areaLines.filter(a => a.id !== last.obj.id);
    else if (last.type === 'del_area') areaLines.push(last.obj);
    else if (last.type === 'blacklist_grid') {
        if (last.isX) deletedGridX = deletedGridX.filter(x => Math.abs(x - last.coord) > 2);
        else deletedGridY = deletedGridY.filter(y => Math.abs(y - last.coord) > 2);
        analyzeGrids();
    }
}

function applyRedo(last) {
    if (last.type === 'add_wall') walls.push(last.obj);
    else if (last.type === 'del_wall') walls = walls.filter(w => w.id !== last.obj.id);
    else if (last.type === 'add_win') windowsArr.push(last.obj);
    else if (last.type === 'del_win') windowsArr = windowsArr.filter(w => w.id !== last.obj.id);
    else if (last.type === 'edit_wall' && last.redoData) {
        last.obj.totalVal = last.redoData.tv; last.obj.outPanelVal = last.redoData.ov; last.obj.inPanelVal = last.redoData.iv; last.obj.braceVal = last.redoData.bv;
        last.obj.outPanelName = last.redoData.on; last.obj.inPanelName = last.redoData.in; last.obj.braceName = last.redoData.bN; last.obj.isTasuki = last.redoData.iT;
    }
    else if (last.type === 'edit_text') { last.obj.text = last.oldRedo; analyzeGrids(); }
    else if (last.type === 'add_pillar') pillars.push(last.obj);
    else if (last.type === 'del_pillar') { last.obj.isDeleted = true; if (last.connectedWalls) { let ids = last.connectedWalls.map(w=>w.id); walls = walls.filter(w=>!ids.includes(w.id)); } }
    else if (last.type === 'add_grid') { if (last.isX) manualGridX.push(last.obj); else manualGridY.push(last.obj); analyzeGrids(); }
    else if (last.type === 'del_grid') { if (last.isX) manualGridX = manualGridX.filter(m => m !== last.obj); else manualGridY = manualGridY.filter(m => m !== last.obj); analyzeGrids(); }
    else if (last.type === 'edit_grid_name_x') { let current = gridXNames[last.idx]; gridXNames[last.idx] = last.oldName; last.oldName = current; }
    else if (last.type === 'edit_grid_name_y') { let current = gridYNames[last.idx]; gridYNames[last.idx] = last.oldName; last.oldName = current; }
    else if (last.type === 'add_area') areaLines.push(last.obj);
    else if (last.type === 'del_area') areaLines = areaLines.filter(a => a.id !== last.obj.id);
    else if (last.type === 'blacklist_grid') {
        if (last.isX) deletedGridX.push(last.coord);
        else deletedGridY.push(last.coord);
        analyzeGrids();
    }
}



async function checkPermissionAndGenerate(e) {
    // 🌟 追記: ローカル環境（127.0.0.1 または localhost）ならAPIチェックをスキップ
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.hostname === '';
    if (isLocal) {
        console.log("🛠️ テスト環境のため、課金権限チェックをスキップします。");
        // APIが成功したとみなして、本来の書類生成処理を直接呼び出す
        generateDoc();
        return; 
    }

    try {
        // バックエンドの権限チェックAPIを叩く
        const response = await fetch('../../api/permissions', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        // 未ログインの場合
        if (response.status === 401) {
            alert('セッションが切れました。再度ログインしてください。');
            window.location.href = '../../login';
            return;
        }

        if (!response.ok) {
            throw new Error('API通信エラーが発生しました。');
        }

        const result = await response.json();
        const data = result.data;

        // サブスク権限チェック
        if (!data.is_subscribed) {
            const msg = "計算書の一括出力（PDF）は有料プラン限定の機能です。\n" +
                        "決済画面へ移動してプランを契約しますか？\n" +
                        "（※画面上での計算や安全性の確認は、引き続き無料でご利用いただけます）";
            if (confirm(msg)) {
                window.location.href = '../../subscribe';
            }
            return;
        }

        // 全ての権限クリア：既存のPDF生成処理を開始
        generateDoc();

    } catch (error) {
        console.error('権限チェックに失敗しました:', error);
        alert('システムエラーが発生しました。時間をおいて再度お試しください。');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        // ★ Fix4: DOM読み込み完了後に canvas コンテキストを安全に取得
        canvas = document.getElementById('cad-canvas');
        ctx = canvas ? canvas.getContext('2d') : null;

        document.querySelectorAll('input:not([type="file"]), select').forEach(el => {
            if (el.name !== 'mode' && el.id !== 'show-4div') el.addEventListener('input', triggerUpdate);
        });

        // [機能改善 外壁仕様追加] 外壁仕様プルダウンの変更イベント
        let extWallSel = document.getElementById('prop-ext-wall');
        if (extWallSel) {
            extWallSel.addEventListener('change', (e) => {
                exteriorWallWeight = parseFloat(e.target.value);
                triggerUpdate();
            });
        }

        // [機能改善 荷重仕様拡充] 荷重仕様の変更イベント
        const bindState = (id, propVar) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    window[propVar] = parseFloat(e.target.value);
                    triggerUpdate();
                });
            }
        };

        bindState('prop-roof-type', 'roofWeight');
        bindState('prop-solar', 'solarWeight');
        bindState('prop-ceiling-ins', 'ceilingInsWeight');
        // [機能改善 UI整理と断熱材調整] 直接入力に変更
        bindState('prop-wall-ins', 'wallInsWeight');

        // [機能補完 最終調整] 三角形状割増係数
        const triMultEl = document.getElementById('prop-tri-mult');
        if (triMultEl) {
            triMultEl.addEventListener('change', (e) => {
                window.AppState.triangleMultiplier = parseFloat(e.target.value) || 1.0;
                triggerUpdate();
            });
        }

        // [機能改善 要素レイヤ切替] 表示切替イベント
        const bindLayerToggle = (id, key) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    elementVisibility[key] = e.target.checked;
                    triggerUpdate();
                });
            }
        };
        bindLayerToggle('v-layer-grids', 'grids');
        bindLayerToggle('v-layer-pillars', 'pillars');
        bindLayerToggle('v-layer-pillarNValues', 'pillarNValues');
        bindLayerToggle('vis-wall', 'walls'); // [機能改善 基礎モード初期設定] ID変更
        bindLayerToggle('v-layer-windows', 'windows');
        bindLayerToggle('vis-diaph', 'areas'); // [機能改善 基礎モード初期設定] ID変更
        bindLayerToggle('v-layer-f_beams', 'f_beams');
        bindLayerToggle('v-layer-f_slabs', 'f_slabs');
        bindLayerToggle('v-layer-f_ext_walls', 'f_ext_walls');
        bindLayerToggle('v-layer-f_manholes', 'f_manholes');

        // [機能拡張 スラブ設計条件と自動判定] 全体設計条件のバインド
        const fcEl = document.getElementById('global-fc');
        if (fcEl) {
            fcEl.addEventListener('change', (e) => {
                window.AppState.concreteFc = parseInt(e.target.value, 10) || 21;
                triggerUpdate();
            });
        }
        
        // [機能追加 三角形状割増しの全体設定化] 
        const tmEl = document.getElementById('global-triangle-mult');
        if (tmEl) {
            tmEl.addEventListener('input', (e) => {
                window.AppState.triangleMultiplier = parseFloat(e.target.value) || 1.33;
                if (typeof updateCalculations === 'function') updateCalculations();
                if (typeof triggerUpdate === 'function') triggerUpdate();
            });
        }
        
        // [機能追加 立面軸力図ビューア] 起動ボタンのバインド
        const btnElView = document.getElementById('btn-elevation-viewer');
        if (btnElView) {
            btnElView.addEventListener('click', () => {
                if (window.openElevationViewer) window.openElevationViewer();
            });
        }

        document.querySelectorAll('input[name="mode"]').forEach(el => { el.addEventListener('change', handleModeChange); });
        let show4 = document.getElementById('show-4div'); if (show4) show4.addEventListener('change', () => { requestAnimationFrame(draw); });

        const bC = (id, fn) => { let el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
        bC('btn-gen-doc', checkPermissionAndGenerate);
        bC('btn-show-ratio', window.AppExport.showRatioModal);
        bC('btn-show-center', showCenterCalc); bC('btn-show-area', showAreaPreview);
        bC('btn-export-csv', window.AppExport.exportCSV); 
        bC('btn-export-dxf', window.AppExport.exportDXF);
        bC('btn-save', window.AppExport.saveData); bC('btn-undo', undoLastAction); bC('btn-redo', redoLastAction);
        bC('btn-toggle-layer', () => {
            const panel = document.getElementById('dxf-layer-panel');
            if (!panel) { if (typeof renderLayerPanel === 'function') renderLayerPanel(); return; }
            panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
        });

        // [UI改修 基礎タブ移動] タブイベント設定
        bC('tab-foundation', () => switchAppMode('foundation'));
        bC('tab-1f', () => setFloor('1F'));
        bC('tab-2f', () => setFloor('2F'));

        // [基礎UI改善 タスク1] ポップアップ背景クリックで閉じる（任意）
        canvas.addEventListener('mousedown', (e) => {
            if (getAppMode() === 'foundation' && getFdMode() !== 'f_select') {
                // セレクトモード以外でクリックした際、一時的なポップアップは閉じるのが一般的
                // ただし、作図を邪魔しないように注意
            }
        });

        bC('btn-add-cust-wall', () => addCustomWallRow());
        bC('btn-add-cust-hw', () => addCustomHwRow());

        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', function () { this.closest('.modal-overlay').style.display = 'none'; });
        });

        const bF = (id, fn) => {
            let el = document.getElementById(id);
            if (el) { el.addEventListener('click', e => { e.target.value = ''; }); el.addEventListener('change', fn); }
        };
        bF('json-upload', loadData);
        bF('dxf-upload', loadDxf);
        bF('upload-doc-sub', loadSubDxf); // 挿絵専用関数に変更（データ破壊を防止）

        // [機能追加] 統合プロパティモーダルの「反映」ボタン
        const btnPropApply = document.getElementById('btn-prop-apply');
        if (btnPropApply) {
            btnPropApply.onclick = () => {
                if (typeof applyPropertyChanges === 'function') applyPropertyChanges();
            };
        }

        if (typeof initCanvasInput === 'function') {
            initCanvasInput(canvas);
        } else {
            console.error("initCanvasInput is not defined. wall_4split_input.js might not be loaded.");
        }

    } catch (e) { console.error("Initialize error:", e); alert("初期化エラー: " + e.message); }
});

// ★ アニメーション専用ループ (パルス表示用)
// draw() 内から requestAnimationFrame を排除したため、ここで管理します。
function animationLoop() {
    if (window.selectedPillar && !window.isPrintMode) {
        if (typeof draw === 'function') draw();
    }
    requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

// ==========================================
// [機能追加 立面軸力図ビューア] 制御ロジック
// ==========================================
let currentElevationAxis = "";

window.openElevationViewer = function() {
    const axes = window.getAxesToReport ? window.getAxesToReport() : [];
    const tabCont = document.getElementById('elevation-axis-tabs');
    if (!tabCont) return;
    
    tabCont.innerHTML = "";
    axes.forEach((axis, idx) => {
        const btn = document.createElement('button');
        btn.innerText = axis;
        btn.style.cssText = "padding:6px 15px; border:1px solid #bdc3c7; border-bottom:none; background:#ecf0f1; cursor:pointer; font-size:12px; border-radius:4px 4px 0 0; margin-right:2px; white-space:nowrap;";
        btn.onclick = () => window.selectElevationAxis(axis, btn);
        tabCont.appendChild(btn);
        if (idx === 0) window.selectElevationAxis(axis, btn);
    });
    
    const modal = document.getElementById('modal-elevation-viewer');
    if (modal) {
        modal.style.display = 'flex';
        window.updateElevationViewer();
    }
};

window.selectElevationAxis = function(axis, btn) {
    currentElevationAxis = axis;
    const tabs = document.querySelectorAll('#elevation-axis-tabs button');
    tabs.forEach(t => {
        t.style.background = "#ecf0f1";
        t.style.fontWeight = "normal";
        t.style.borderBottom = "1px solid #bdc3c7";
    });
    btn.style.background = "#fff";
    btn.style.fontWeight = "bold";
    btn.style.borderBottom = "1px solid #fff";
    window.updateElevationViewer();
};

window.updateElevationViewer = function() {
    const container = document.getElementById('elevation-svg-container');
    if (!container || !currentElevationAxis) return;
    
    // 加力方向の取得
    const dirEl = document.querySelector('input[name="el-dir"]:checked');
    const dir = dirEl ? dirEl.value : 'left';
    
    if (window.generateEnlargedAxialDiagramSvg) {
        // SVGの生成と流し込み
        container.innerHTML = window.generateEnlargedAxialDiagramSvg(currentElevationAxis, dir);
    } else {
        container.innerHTML = "<div style='padding:20px; color:red;'>エラー: SVG生成関数が見つかりません。</div>";
    }
};

// [機能追加 山場Step1: スパン別プロパティとレポート枠] 通り別 計算書プレビュー モーダルの実装
window.showFoundationBeamReportModal = function(beam) {
    if (!beam) return;

    // 既存のモーダルがあれば削除
    const oldModal = document.getElementById('fd-beam-report-modal');
    if (oldModal) oldModal.remove();

    // モーダルコンテナの作成
    const overlay = document.createElement('div');
    overlay.id = 'fd-beam-report-modal';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;
        z-index: 10000; backdrop-filter: blur(5px); transition: 0.3s;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: #fff; width: 90vw; height: 90vh; border-radius: 12px;
        display: flex; flex-direction: column; overflow: hidden;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    `;

    // ヘッダー
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 15px 25px; background: #2c3e50; color: #fff;
        display: flex; justify-content: space-between; align-items: center;
    `;
    header.innerHTML = `
        <h3 style="margin:0; font-size:18px;">📊 基礎梁 計算書プレビュー - ${beam.id} (通り接続)</h3>
        <button onclick="document.getElementById('fd-beam-report-modal').remove()" style="background:#e74c3c; color:#fff; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">✖ 閉じる</button>
    `;

    // コンテンツエリア
    const content = document.createElement('div');
    content.style.cssText = `flex: 1; overflow-y: auto; padding: 30px; background: #fdfdfd;`;
    
    // 大枠の構成
    content.innerHTML = `
        <div style="max-width: 1000px; margin: 0 auto;">
            <div style="margin-bottom: 30px; border-bottom: 2px solid #34495e; padding-bottom: 10px;">
                <div style="font-size: 24px; font-weight: bold; color: #2c3e50;">基礎梁 断面検定明細 (通り別統合レポート)</div>
                <div style="color: #7f8c8d; font-size: 14px; margin-top: 5px;">ID: ${beam.id} | 指定通り名: ${beam.props?.name || '未設定'}</div>
            </div>

            <!-- [機能追加 山場Step2: 連続梁図表の完全実装] 連続梁統合レポートの流し込み -->
            ${generateContinuousBeamReportHtml(beam)}
        </div>
    `;

    modal.appendChild(header);
    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ESCキーで閉じる
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
};

// ==========================================
// [機能追加] 統合プロパティエディタ・ロジック
// ==========================================

window.openPropertyModal = function(hit) {
    const body = document.getElementById("modal-prop-body");
    if (!body) return;
    body.innerHTML = "";

    const type = hit.type;
    const item = hit.item;
    let html = "";

    if (type === "pillar") {
        html = `
            <div class="prop-edit-row">
                <label>柱ID</label>
                <input type="text" value="${item.id}" disabled>
            </div>
            <div class="prop-edit-row">
                <label>出隅として強制計算</label>
                <input type="checkbox" id="edit-pillar-corner" ${item.isManualCorner ? "checked" : ""} style="width:auto;">
            </div>
            <div class="prop-edit-row">
                <label>金物指定</label>
                <select id="edit-pillar-mark">
                    <option value="">自動計算</option>
                    ${(window.getHardwareList ? window.getHardwareList() : []).map(h => `<option value="${h}" ${item.manualMark === h ? "selected" : ""}>${h}</option>`).join("")}
                </select>
            </div>
        `;
    } else if (type === "wall") {
        html = `
            <div class="prop-edit-row">
                <label>壁ID</label>
                <input type="text" value="${item.id}" disabled>
            </div>
            <div class="prop-edit-row">
                <label>面材1 (外)</label>
                <select id="edit-wall-p1">
                    ${Array.from(document.getElementById("wall-p1")?.options || []).map(o => `<option value="${o.value}" ${item.outPanelName === o.text ? "selected" : ""}>${o.text}</option>`).join("")}
                </select>
            </div>
            <div class="prop-edit-row">
                <label>面材2 (内)</label>
                <select id="edit-wall-p2">
                    ${Array.from(document.getElementById("wall-p2")?.options || []).map(o => `<option value="${o.value}" ${item.inPanelName === o.text ? "selected" : ""}>${o.text}</option>`).join("")}
                </select>
            </div>
            <div class="prop-edit-row">
                <label>筋交い</label>
                <select id="edit-wall-b">
                    ${Array.from(document.getElementById("wall-b")?.options || []).map(o => `<option value="${o.value}" ${item.braceName === o.text ? "selected" : ""}>${o.text}</option>`).join("")}
                </select>
            </div>
        `;
    } else if (type === "window") {
        html = `
            <div class="prop-edit-row">
                <label>開口ID</label>
                <input type="text" value="${item.id}" disabled>
            </div>
            <div class="prop-edit-row">
                <label>幅 (mm)</label>
                <input type="number" id="edit-win-width" value="${item.length}">
            </div>
        `;
    } else if (type === "area") {
        html = `
            <div class="prop-edit-row">
                <label>面積の種類</label>
                <select id="edit-area-type">
                    <option value="floor" ${item.type === "floor" ? "selected" : ""}>床面積</option>
                    <option value="attic" ${item.type === "attic" ? "selected" : ""}>小屋裏</option>
                    <option value="balcony" ${item.type === "balcony" ? "selected" : ""}>バルコニー</option>
                    <option value="void" ${item.type === "void" ? "selected" : ""}>吹き抜け</option>
                    <option value="porch" ${item.type === "porch" ? "selected" : ""}>ポーチ</option>
                </select>
            </div>
        `;
    }

    body.innerHTML = html;
    document.getElementById("modal-property-editor").style.display = "flex";
};

window.applyPropertyChanges = function() {
    if (!selectedElement) return;
    const type = selectedElement.type;
    const item = selectedElement.item;

    if (type === "pillar") {
        item.isManualCorner = document.getElementById("edit-pillar-corner").checked;
        item.manualMark = document.getElementById("edit-pillar-mark").value || null;
    } else if (type === "wall") {
        const p1 = document.getElementById("edit-wall-p1");
        const p2 = document.getElementById("edit-wall-p2");
        const b = document.getElementById("edit-wall-b");
        item.outPanelVal = parseFloat(p1.value);
        item.outPanelName = p1.options[p1.selectedIndex].text;
        item.inPanelVal = parseFloat(p2.value);
        item.inPanelName = p2.options[p2.selectedIndex].text;
        item.braceVal = parseFloat(b.value);
        item.braceName = b.options[b.selectedIndex].text;
        item.totalVal = item.outPanelVal + item.inPanelVal + item.braceVal;
    } else if (type === "window") {
        item.length = parseInt(document.getElementById("edit-win-width").value, 10);
    } else if (type === "area") {
        item.type = document.getElementById("edit-area-type").value;
    }

    document.getElementById("modal-property-editor").style.display = "none";
    if (typeof triggerUpdate === "function") triggerUpdate();
};
