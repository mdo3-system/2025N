// ==========================================
// cad_engine_v2.js - DXF解析・描画エンジン
// 上善如水 - 壁量計算WEB Ver 1.14ベース (背景線幅・挿絵統合パッチ版)
// ==========================================

let layerVisibility = {};
// deletedGridX/Y は wall_4split_main.js でグローバル宣言されているため、ここでは宣言しない


// ★ 統合版 DXF読込関数 (スマートリロード・R階対応・ブロック警告・バラバラ線対応)
function loadDxf(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        try {
            const rawTxt = new TextDecoder('UTF-8').decode(ev.target.result);
            window_currentDxfRaw = rawTxt.includes('\uFFFD') ? new TextDecoder('Shift_JIS').decode(ev.target.result) : rawTxt;

            const parser = new window.DxfParser();
            const dxf = parser.parseSync(window_currentDxfRaw);

            // ==========================================
            // ★ 新機能：スマートリロード（既存データの整理と保持）
            // ==========================================
            if (pillars && pillars.length > 0) {
                const confirmMsg = "既に配置済みの柱や壁のデータが存在します。\n\n" +
                                   "・[OK] 新しい図面に適合しない柱や壁を整理して読み込む\n" +
                                   "・[キャンセル] 既存データを全消去して新規に読み込む";

                if (confirm(confirmMsg)) {
                    // --- OK時：背景を更新し、新しいグリッドに合わないデータをクリーンアップ ---
                    const newBgLines = [], newBgTexts = [], newBubbles = [];
                    function collectBgOnly(entities, blocks, parentLayer = "") {
                        entities.forEach(ent => {
                            let layerName = (ent.layer || "").toUpperCase().trim();
                            if (layerName === 'AREA_D_X') layerName = 'AREA_X';
                            if (layerName === 'AREA_D_Y') layerName = 'AREA_Y';
                            if (!(layerName in layerVisibility)) layerVisibility[layerName] = true;
                            ent.layer = layerName;

                            if (ent.type === 'INSERT') {
                                const block = blocks ? blocks[ent.name] : null;
                                if (block && block.entities) collectBgOnly(block.entities, blocks, layerName);
                            } else {
                                const L = layerName;
                                if (L.includes('COL')) return;
                                if (L.includes('GRID') || L.includes('GLID')) {
                                    const f_layer = 'ALL';
                                    if (ent.type === 'LINE') {
                                        if (ent.start && ent.end) { ent.vertices = [{ x: ent.start.x, y: ent.start.y }, { x: ent.end.x, y: ent.end.y }]; }
                                        if (ent.vertices && ent.vertices.length >= 2) newBgLines.push({ ...ent, layer: L, floor: f_layer, isUnderlay: true, isGridLine: true });
                                    } else if (['CIRCLE', 'ARC'].includes(ent.type)) {
                                        newBubbles.push({ x: ent.center.x, y: ent.center.y, r: ent.radius, floor: f_layer, layer: L });
                                        newBgLines.push({ ...ent, layer: L, floor: f_layer, isUnderlay: true });
                                    } else if (['TEXT', 'MTEXT'].includes(ent.type)) {
                                        const txt = ent.text || ent.string || "";
                                        if (txt) {
                                            const pos = ent.startPoint || ent.position || ent.insertionPoint || ent.insert || {};
                                            newBgTexts.push({ text: txt, x: pos.x ?? 0, y: pos.y ?? 0, layer: L, floor: f_layer, isUnderlay: true, isGridText: true });
                                        }
                                    }
                                } else {
                                    let f_layer = 'ALL';
                                    if (L.includes('1F')) f_layer = '1F';
                                    else if (L.includes('2F') || L.includes('RF') || L.includes('R階')) f_layer = '2F';
                                    ent.isUnderlay = true; ent.floor = f_layer; ent.layer = L;
                                    if (ent.type === 'LINE') {
                                        if (ent.start && ent.end) { ent.vertices = [{ x: ent.start.x, y: ent.start.y }, { x: ent.end.x, y: ent.end.y }]; }
                                        if (ent.vertices && ent.vertices.length >= 2) newBgLines.push(ent);
                                    } else if (['LWPOLYLINE', 'POLYLINE', 'ARC', 'CIRCLE'].includes(ent.type)) {
                                        newBgLines.push(ent);
                                    } else if (['TEXT', 'MTEXT'].includes(ent.type)) {
                                        const txt = ent.text || ent.string || "";
                                        if (txt) {
                                            const pos = ent.startPoint || ent.position || ent.insertionPoint || ent.insert || {};
                                            newBgTexts.push({ text: txt, x: pos.x ?? 0, y: pos.y ?? 0, floor: f_layer, isUnderlay: true, layer: L });
                                        }
                                    }
                                }
                            }
                        });
                    }
                    collectBgOnly(dxf.entities, dxf.blocks || {});
                    
                    // 背景データを差し替え
                    bgLinesOriginal = newBgLines;
                    bgTextsOriginal = newBgTexts;
                    gridBubbles = newBubbles;
                    
                    // グリッドを再解析（masterXs, masterYs を更新）
                    if (typeof analyzeGrids === 'function') analyzeGrids();

                    // --- 孤立データの自動クリーンアップ ---
                    const TOL_RELOAD = 2.0;
                    const isOnGrid = (v) => {
                        const onX = window.masterXs && window.masterXs.some(mx => Math.abs(mx - v.x) < TOL_RELOAD);
                        const onY = window.masterYs && window.masterYs.some(my => Math.abs(my - v.y) < TOL_RELOAD);
                        return onX && onY; // 柱や頂点は交点にあるべき
                    };

                    // 1. 柱の整理 (交点にない柱を削除)
                    const oldPillarCount = pillars.length;
                    pillars = pillars.filter(p => p.isManual || isOnGrid(p));
                    // 2. 壁・開口部の整理 (接続先の柱が消えたら削除)
                    const isPillarExist = (p) => pillars.some(existP => existP.id === p.id);
                    walls = walls.filter(w => isPillarExist(w.p1) && isPillarExist(w.p2));
                    windowsArr = windowsArr.filter(w => isPillarExist(w.p1) && isPillarExist(w.p2));

                    // 3. 面積データの整理 (不正な頂点を持つ手動面積を削除)
                    areaLines = areaLines.filter(a => {
                        if (!a.isManualArea) return true;
                        // 全ての頂点が新しいグリッド交点に乗っているか確認
                        return a.vertices.every(v => isOnGrid(v));
                    });

                    renderLayerPanel(); resizeCanvas(); initViewForce(); triggerUpdate();
                    let msgEl = document.getElementById('action-msg');
                    if (msgEl) msgEl.innerText = "✅ 図面に適合しないデータを整理し、背景を更新しました。";
                    return; 
                }
            }

            // ==========================================
            // ★ 新規読み込み（または全リセットして読み込み）
            // ==========================================
            const newBgLines = [], newBgTexts = [], newBubbles = [];
            let newPillars1F = [], newPillars2F = [];
            const newAreaLines = [];

            function collectEntities(entities, blocks, parentLayer = "") {
                entities.forEach(ent => {
                    let layerName = (ent.layer || "").toUpperCase().trim();
                    if (!layerName || layerName === "0") layerName = (parentLayer || "0").toUpperCase().trim(); 

                    if (layerName === 'AREA_D_X') layerName = 'AREA_X';
                    if (layerName === 'AREA_D_Y') layerName = 'AREA_Y';
                    if (!(layerName in layerVisibility)) {
                        layerVisibility[layerName] = true;
                    }
                    ent.layer = layerName;

                    if (ent.type === 'INSERT') {
                        const block = blocks ? blocks[ent.name] : null;
                        if (block && block.entities) {
                            collectEntities(block.entities, blocks, layerName);
                        }
                    } else {
                        const L = layerName;
                        if (L.includes('COL')) {
                            const f = (L.includes('2F') || L.includes('RF') || L.includes('R階')) ? '2F' : '1F';
                            const targetArr = f === '1F' ? newPillars1F : newPillars2F;
                            if (ent.type === 'POINT') {
                                const px = ent.position ? ent.position.x : ent.x, py = ent.position ? ent.position.y : ent.y;
                                if (px !== undefined) targetArr.push({ id: `P${pIdCounter++}`, x: px, y: py, isManual: false, isDeleted: false, floor: f, isInvalidPos: false, layer: L });
                            } else if (ent.type === 'CIRCLE' && ent.radius < 500) {
                                targetArr.push({ id: `P${pIdCounter++}`, x: ent.center.x, y: ent.center.y, isManual: false, isDeleted: false, floor: f, isInvalidPos: false, layer: L });
                                newBgLines.push({ ...ent, layer: L, floor: f, isUnderlay: false });
                            } else if (['LWPOLYLINE', 'POLYLINE'].includes(ent.type) && ent.vertices && ent.vertices.length > 0) {
                                let px = ent.vertices.reduce((s, v) => s + v.x, 0) / ent.vertices.length;
                                let py = ent.vertices.reduce((s, v) => s + v.y, 0) / ent.vertices.length;
                                targetArr.push({ id: `P${pIdCounter++}`, x: px, y: py, isManual: false, isDeleted: false, floor: f, isInvalidPos: false, layer: L });
                                newBgLines.push({ ...ent, layer: L, floor: f, isUnderlay: false });
                            } else if (ent.type === 'LINE' && ent.start && ent.end) {
                                let px = (ent.start.x + ent.end.x) / 2;
                                let py = (ent.start.y + ent.end.y) / 2;
                                targetArr.push({ id: `P${pIdCounter++}`, x: px, y: py, isManual: false, isDeleted: false, floor: f, isInvalidPos: false, layer: L });
                                ent.vertices = [{ x: ent.start.x, y: ent.start.y }, { x: ent.end.x, y: ent.end.y }];
                                newBgLines.push({ ...ent, layer: L, floor: f, isUnderlay: false });
                            }
                        } else if (L.includes('AREA')) {
                            let f_layer = '1F';
                            if (L.includes('2F') || L.includes('RF') || L.includes('R階')) f_layer = L.includes('1F') ? '1F' : ((L.includes('RF') || L.includes('R階')) ? 'RF' : '2F'); 
                            
                            if (['LWPOLYLINE', 'POLYLINE'].includes(ent.type) && ent.vertices && ent.closed) {
                                newAreaLines.push({ ...ent, layer: L, floor: f_layer, isManualArea: false, id: Date.now() + Math.random() });
                            }
                            if (ent.vertices) newBgLines.push({ ...ent, layer: L, floor: f_layer, isUnderlay: false });
                        } else {
                            let f_layer = 'ALL';
                            if (L.includes('1F')) f_layer = '1F';
                            else if (L.includes('2F') || L.includes('RF') || L.includes('R階')) f_layer = '2F';

                            ent.isUnderlay = true; ent.floor = f_layer; ent.layer = L;
                            const isLGrid = L.includes('GRID') || L.includes('GLID');

                            if (ent.type === 'LINE') {
                                if (ent.start && ent.end) { ent.vertices = [{ x: ent.start.x, y: ent.start.y }, { x: ent.end.x, y: ent.end.y }]; }
                                if (ent.vertices && ent.vertices.length >= 2) newBgLines.push({ ...ent, isGridLine: isLGrid });
                            } else if (['LWPOLYLINE', 'POLYLINE', 'ARC', 'CIRCLE'].includes(ent.type)) {
                                newBgLines.push({ ...ent, isGridLine: isLGrid });
                            } else if (['TEXT', 'MTEXT'].includes(ent.type)) {
                                const txt = ent.text || ent.string || "";
                                if (txt) {
                                    const pos = ent.startPoint || ent.position || ent.insertionPoint || ent.insert || {};
                                    newBgTexts.push({ text: txt, x: pos.x ?? 0, y: pos.y ?? 0, floor: f_layer, isUnderlay: true, layer: L, isGridText: isLGrid });
                                }
                            }
                        }
                    }
                });
            }

            collectEntities(dxf.entities, dxf.blocks || {});
            renderLayerPanel(); 

            const allExtracted = [
                ...newBgLines.map(e => ({ ...e })),
                ...newBgTexts.map(t => ({ ...t, type: 'TEXT' })),
                ...newBubbles.map(b => ({ type: 'CIRCLE', center: { x: b.x, y: b.y }, radius: b.r, floor: b.floor, isUnderlay: true, layer: b.layer }))
            ];
            const docData = { entities: allExtracted, loaded: true, rawDxf: window_currentDxfRaw };
            docDrawings.floor = docData;
            docDrawings.div4 = docData;
            if (!docDrawings.elev || !docDrawings.elev.loaded) {
                docDrawings.elev = docData;
            }

            const dedupePillars = (arr) => {
                return arr.filter((p, index, self) =>
                    index === self.findIndex((t) => Math.hypot(t.x - p.x, t.y - p.y) < 10)
                );
            };
            newPillars1F = dedupePillars(newPillars1F);
            newPillars2F = dedupePillars(newPillars2F);

            if (newPillars1F.length === 0 && newPillars2F.length === 0) {
                alert('⚠️ DXFから柱データ（COL_1F等）が見つかりませんでした。\n図面が「ブロック（グループ化）」されている場合は、CADで分解(EXPLODE)してから保存し直してください。');
            }

            bgLinesOriginal = newBgLines;
            bgTextsOriginal = newBgTexts;
            gridBubbles = newBubbles;
            pillars = [...newPillars1F, ...newPillars2F];
            areaLines = newAreaLines;
            walls = []; windowsArr = []; historyStack = [];
            manualGridX = []; manualGridY = [];
            deletedGridX = []; deletedGridY = []; 

            showAreaInputModal();

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            const parseV = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };

            bgLinesOriginal.forEach(e => {
                if (layerVisibility[e.layer] === false) return;
                if (e.type === 'LINE' && e.vertices) { parseV(e.vertices[0].x, e.vertices[0].y); parseV(e.vertices[1].x, e.vertices[1].y); }
                else if (['LWPOLYLINE', 'POLYLINE'].includes(e.type) && e.vertices) { e.vertices.forEach(v => parseV(v.x, v.y)); }
                else if (['CIRCLE', 'ARC'].includes(e.type)) { parseV(e.center.x - e.radius, e.center.y - e.radius); parseV(e.center.x + e.radius, e.center.y + e.radius); }
            });
            gridBubbles.forEach(b => {
                if (layerVisibility[b.layer] === false) return;
                parseV(b.x - b.r, b.y - b.r); parseV(b.x + b.r, b.y + b.r);
            });
            pillars.forEach(p => {
                if (layerVisibility[p.layer] === false) return;
                parseV(p.x, p.y);
            });

            if (minX === Infinity) {
                minX = 0; maxX = 10000; minY = 0; maxY = 10000;
            }

            if (minX < Infinity && maxX > -Infinity && minY < Infinity && maxY > -Infinity) {
                let dx = maxX - minX, dy = maxY - minY;
                if (dx > 0 && dy > 0 && canvas) {
                    let padding = 100;
                    let scaleX = (canvas.width - padding * 2) / dx;
                    let scaleY = (canvas.height - padding * 2) / dy;
                    scale = Math.min(scaleX, scaleY);

                    let cx = (minX + maxX) / 2;
                    let cy = (minY + maxY) / 2;
                    offsetX = (canvas.width / 2) - (cx * scale);
                    offsetY = (canvas.height / 2) - ((maxY - cy) * scale) - (minY * scale);
                }
            }

            resizeCanvas();
            analyzeGrids();
            initViewForce();
            triggerUpdate();

            let msgEl = document.getElementById('action-msg');
            if (msgEl) msgEl.innerText = "✅ 平面図DXFを読み込みました。";

        } catch (err) { alert("❌ 平面図DXF解析エラー: " + err.message); }
    };
    reader.readAsArrayBuffer(file);
}

// ★ 追加: 挿絵用 DXF 読込専用関数（メインデータを破壊しない）
function loadSubDxf(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        try {
            const rawTxt = new TextDecoder('UTF-8').decode(ev.target.result);
            const dxfRaw = rawTxt.includes('\uFFFD') ? new TextDecoder('Shift_JIS').decode(ev.target.result) : rawTxt;

            const parser = new window.DxfParser();
            const dxf = parser.parseSync(dxfRaw);
            if (!dxf || !dxf.entities) { alert('❌ 挿絵DXFの解析に失敗しました。'); return; }

            const extractedEnts = [];
            function collectSubEntities(entities, blocks, parentLayer = "") {
                entities.forEach(ent => {
                    let layerName = (ent.layer || "").toUpperCase().trim();
                    if (!layerName || layerName === "0") layerName = (parentLayer || "0").toUpperCase().trim(); 
                    if (layerName === 'AREA_D_X') layerName = 'AREA_X';
                    if (layerName === 'AREA_D_Y') layerName = 'AREA_Y';
                    if (!(layerName in layerVisibility)) {
                        layerVisibility[layerName] = /(GLID|GRID|COL|BG)/i.test(layerName);
                    }
                    ent.layer = layerName;
                    if (ent.type === 'INSERT') {
                        const block = blocks[ent.name];
                        if (block && block.entities) collectSubEntities(block.entities, blocks, layerName);
                    } else {
                        let f = layerName.includes('2F') ? '2F' : (layerName.includes('1F') ? '1F' : 'ALL');
                        extractedEnts.push({ ...ent, layer: layerName, floor: f, isUnderlay: true });
                    }
                });
            }
            collectSubEntities(dxf.entities, dxf.blocks || {});
            renderLayerPanel(); 
            const docData = { entities: extractedEnts, loaded: true, rawDxf: dxfRaw };

            docDrawings.elev = docData;

            let msgEl = document.getElementById('action-msg');
            if (msgEl) msgEl.innerText = "✅ 挿絵用DXFを読み込みました。";

            const modal = document.getElementById('modal-area');
            if (modal && modal.style.display !== 'none') {
                if (typeof showAreaPreview === 'function') showAreaPreview();
            }

        } catch (err) { alert("❌ 挿絵DXF解析エラー: " + err.message); }
    };
    reader.readAsArrayBuffer(file);
}

function showAreaInputModal() {
    // 各階の面積をリセット
    let autoA = { '1F': 0, '2F': 0, 'RF': 0 };

    areaLines.forEach(a => {
        if (!a.vertices || a.vertices.length < 3) return;
        let area = 0;
        for (let i = 0; i < a.vertices.length; i++) {
            let j = (i + 1) % a.vertices.length;
            area += a.vertices[i].x * a.vertices[j].y;
            area -= a.vertices[j].x * a.vertices[i].y;
        }
        let finalAreaSqM = Math.abs(area / 2) / 1000000; 

        let f = a.floor;
        if (f === '1F') autoA['1F'] += finalAreaSqM;
        if (f === '2F') autoA['2F'] += finalAreaSqM;
        if (f === 'RF') autoA['RF'] += finalAreaSqM;
    });

    if (autoA['1F'] > 0) {
        let el = document.getElementById('aim-a-f1');
        if (el && (!el.value || el.value == "0" || el.value == "0.00")) el.value = autoA['1F'].toFixed(2);
    }
    if (autoA['2F'] > 0 || autoA['RF'] > 0) {
        let el = document.getElementById('aim-a-f2');
        let total2F = autoA['2F'] + autoA['RF'];
        if (el && (!el.value || el.value == "0" || el.value == "0.00")) el.value = total2F.toFixed(2);
    }

    const aiM = document.getElementById('modal-area-input');
    if (aiM) aiM.style.display = 'flex';
}

function applyAreaInputModal() {
    const ids = ['a-f1', 'a-attic1', 'a-balcony1', 'a-wx1', 'a-wy1', 'e-x-t1', 'e-x-b1', 'e-y-l1', 'e-y-r1',
        'a-f2', 'a-attic2', 'a-balcony2', 'a-wx2', 'a-wy2', 'e-x-t2', 'e-x-b2', 'e-y-l2', 'e-y-r2'];
    ids.forEach(id => {
        const v = document.getElementById(`aim-${id}`).value;
        if (v !== "") document.getElementById(id).value = v;
    });
    document.getElementById('modal-area-input').style.display = 'none';
    triggerUpdate();
}




