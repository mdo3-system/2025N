/**
 * wall_4split_cad.js - Bridge between CadEngine and UI
 * v2.3.33 Refactoring - Restored missing DXF features
 */

function loadDxf(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const floorSelect = document.getElementById('dxf-target-floor');
    const targetFloor = floorSelect ? floorSelect.value : 'ALL';

    const fileList = [];
    let readCount = 0;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(ev) {
            try {
                const buffer = new Uint8Array(ev.target.result);
                let dxfRaw = "";

                if (typeof window.Encoding !== 'undefined' && window.Encoding.detect) {
                    const detected = window.Encoding.detect(buffer);
                    dxfRaw = window.Encoding.convert(buffer, { to: 'UNICODE', from: detected || 'AUTO', type: 'STRING' });
                } else {
                    const utf8Txt = new TextDecoder('UTF-8').decode(buffer);
                    if (utf8Txt.includes('\uFFFD')) {
                        dxfRaw = new TextDecoder('Shift_JIS').decode(buffer);
                    } else {
                        dxfRaw = utf8Txt;
                    }
                }

                fileList.push({ name: file.name, rawTxt: dxfRaw });
            } catch (err) {
                console.error("Error reading DXF file:", file.name, err);
            } finally {
                readCount++;
                if (readCount === files.length) {
                    if (fileList.length === 0) {
                        alert("❌ DXFの解析に失敗しました。ファイル形式を確認してください。");
                        return;
                    }

                    window.DxfLayerMapperController.openMapper(fileList, (layerMapping, loadedFilesArg) => {
                            // loadedFilesArg は Array<{name, rawTxt}> (BUG-5修正後) または後方互換で string
                            const loadedFiles = Array.isArray(loadedFilesArg)
                                ? loadedFilesArg
                                : [{ rawTxt: loadedFilesArg || (fileList[0] && fileList[0].rawTxt) || '' }];

                            const s = window.AppState;

                            // ① AppState をリセット（手動入力データのみ保持）
                            s.bgLinesOriginal = [];
                            s.bgTextsOriginal = [];
                            s.pillars = (s.pillars || []).filter(p => p.isManual);
                            if (s.docDrawings) {
                                s.docDrawings.floor = { entities: [], loaded: false };
                                s.docDrawings.div4  = { entities: [], loaded: false };
                            }
                            s.layerVisibility = {};

                            // ② スロット定義（通り芯を最初に処理し基準座標を先行確立）
                            const slotDefs = [
                                { key: 'grid',   layerProp: 'gridLayer'   },
                                { key: 'col1F',  layerProp: 'col1FLayer'  },
                                { key: 'col2F',  layerProp: 'col2FLayer'  },
                                { key: 'back1F', layerProp: 'back1FLayer' },
                                { key: 'back2F', layerProp: 'back2FLayer' },
                                { key: 'roof1F', layerProp: 'roof1FLayer' },
                                { key: 'roof2F', layerProp: 'roof2FLayer' },
                            ];

                            // ③ スロット別ループ: 各スロットを指定ファイル・指定レイヤーでパース
                            if (window.Parsers && window.Parsers.parseDxf) {
                                slotDefs.forEach(({ key, layerProp }) => {
                                    const layerVal = layerMapping[layerProp];
                                    if (!layerVal) return; // 未選択スロットはスキップ

                                    const slotInfo = layerMapping.slots && layerMapping.slots[key];
                                    const fileIdx  = slotInfo ? Math.max(0, parseInt(slotInfo.fileIdx || 0, 10)) : 0;
                                    const fileObj  = loadedFiles[fileIdx] || loadedFiles[0];
                                    if (!fileObj || !fileObj.rawTxt) return;

                                    // このスロット専用の単一レイヤーマッピング（他スロットは空文字で無効化）
                                    const singleMapping = {
                                        gridLayer:   key === 'grid'   ? layerVal : '',
                                        col1FLayer:  key === 'col1F'  ? layerVal : '',
                                        col2FLayer:  key === 'col2F'  ? layerVal : '',
                                        back1FLayer: key === 'back1F' ? layerVal : '',
                                        back2FLayer: key === 'back2F' ? layerVal : '',
                                        roof1FLayer: key === 'roof1F' ? layerVal : '',
                                        roof2FLayer: key === 'roof2F' ? layerVal : '',
                                        slots: layerMapping.slots
                                    };

                                    try {
                                        window.Parsers.parseDxf(
                                            fileObj.rawTxt,
                                            s,
                                            false,  // isSub
                                            false,  // skipEntities
                                            singleMapping,
                                            true    // appendMode: 各スロット結果を AppState に累積
                                        );
                                        console.log(`✅ [Slot:${key}] fileIdx=${fileIdx} layer="${layerVal}" → parsed from "${fileObj.name || 'file#'+fileIdx}"`);
                                    } catch(e) {
                                        console.error(`❌ [parseDxf] Slot "${key}" 解析エラー:`, e);
                                    }
                                });
                            }

                            // ④ 柱の重複除去（同座標・同階の重複を 10mm 以内で除去）
                            if (s.pillars) {
                                s.pillars = s.pillars.filter((p, idx, self) =>
                                    idx === self.findIndex(t => t.floor === p.floor && Math.hypot(t.x - p.x, t.y - p.y) < 10)
                                );
                            }

                            // ⑤ layerMapping 最終書込 & グリッド再解析
                            s.layerMapping = layerMapping;

                            if (window.GridEngine && window.GridEngine.analyzeGrids) {
                                window.GridEngine.analyzeGrids(s);
                            }

                            if (window.AppController && window.AppController.refreshAll) {
                                window.AppController.refreshAll();
                            }
                        });

                }
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

function processDxfData(dxf, isIncremental, rawDxf, targetFloor = 'ALL') {
    const state = window.AppState;
    
    // [v3.10.7] 新規読込・全体再読込時は、過去のメモリ原点をクリアして最新の通り芯原点に補正
    if (state && !isIncremental && targetFloor === 'ALL') {
        state.baseGridOrigin = null;
    }

    // 基準通芯原点の保持と自動アライメント
    const baseOrigin = state ? state.baseGridOrigin : null;
    const result = window.CadEngine.mapEntitiesToBackground(dxf.entities, dxf.blocks, state, {
        targetFloor: targetFloor,
        baseOrigin: baseOrigin
    });

    // 最初の読み込みで基準原点を保存
    if (state && !state.baseGridOrigin && result.detectedOrigin) {
        state.baseGridOrigin = result.detectedOrigin;
    }

    if (!isIncremental && targetFloor === 'ALL') {
        pillars = [];
        walls = [];
        windowsArr = [];
        areaLines = [];
        bgLinesOriginal = [];
        bgTextsOriginal = [];
        gridBubbles = [];
        if (state) {
            state.pillars = [];
            state.walls = [];
            state.windowsArr = [];
            state.areaLines = [];
            state.bgLinesOriginal = [];
            state.bgTextsOriginal = [];
            state.gridBubbles = [];
        }
    }

    // 既存の作図データ（柱や壁など）が存在する場合、または追加入力（isIncremental）時
    const hasExistingData = isIncremental || (pillars && pillars.length > 0) || (walls && walls.length > 0);

    if (hasExistingData) {
        // 既存の入力データ（柱・壁・求積・通り芯バブル）は一切削除・上書きせず完全に保持
        bgLinesOriginal = [...bgLinesOriginal.filter(l => l.floor !== targetFloor), ...result.newBgLines];
        bgTextsOriginal = [...bgTextsOriginal.filter(t => t.floor !== targetFloor), ...result.newBgTexts];
    } else {
        // 初回読込時のみ新規抽出された柱・求積・バブルをセット
        bgLinesOriginal = [...bgLinesOriginal, ...result.newBgLines];
        bgTextsOriginal = [...bgTextsOriginal, ...result.newBgTexts];
        if (result.newBubbles && result.newBubbles.length > 0) gridBubbles = result.newBubbles;
        if (result.pillars) pillars = [...pillars, ...result.pillars];
        if (result.areaLines) areaLines = [...areaLines, ...result.areaLines];
    }

    // Deduplicate pillars
    pillars = pillars.filter((p, index, self) =>
        index === self.findIndex((t) => Math.hypot(t.x - p.x, t.y - p.y) < 10)
    );

    // Deduplicate grid lines and bubbles
    if (window.deduplicateGridElements) window.deduplicateGridElements();

    if (state) {
        state.bgLinesOriginal = bgLinesOriginal;
        state.bgTextsOriginal = bgTextsOriginal;
        state.gridBubbles = gridBubbles;
        state.pillars = pillars;
        state.areaLines = areaLines;
    }

    // Update drawings container for PDF/Reports
    const docData = { entities: [...bgLinesOriginal, ...bgTextsOriginal], loaded: true, rawDxf: rawDxf };
    if (typeof docDrawings !== 'undefined') {
        docDrawings.floor = docData;
        docDrawings.div4 = docData;
    }
    if (state && state.docDrawings) {
        state.docDrawings.floor = docData;
        state.docDrawings.div4 = docData;
    }

    // DXF読込完了時は常に通り芯解析を再実行し、最新の物理座標配列と4分割枠を構築
    if (window.GridEngine && typeof window.GridEngine.analyzeGrids === 'function') {
        window.GridEngine.analyzeGrids(state || window.AppState);
    } else if (typeof analyzeGrids === 'function') {
        analyzeGrids();
    }
    if (typeof initViewForce === 'function') initViewForce();
    if (window.AppController) window.AppController.refreshAll();
}

function showAreaInputModal() {
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

    // Populate modal if fields are empty
    if (autoA['1F'] > 0) {
        let el = document.getElementById('aim-a-f1');
        if (el && (!el.value || el.value == "0" || el.value == "0.00")) el.value = autoA['1F'].toFixed(2);
    }
    const total2F = autoA['2F'] + autoA['RF'];
    if (total2F > 0) {
        let el = document.getElementById('aim-a-f2');
        if (el && (!el.value || el.value == "0" || el.value == "0.00")) el.value = total2F.toFixed(2);
    }

    if (window.AppController && window.AppController.zoomFit) window.AppController.zoomFit();
    const aiM = document.getElementById('modal-area-input');
    if (aiM) aiM.style.display = 'flex';
}

function applyAreaInputModal() {
    const ids = ['a-f1', 'a-attic1', 'a-balcony1', 'a-wx1', 'a-wy1', 'e-x-t1', 'e-x-b1', 'e-y-l1', 'e-y-r1',
        'a-f2', 'a-attic2', 'a-balcony2', 'a-wx2', 'a-wy2', 'e-x-t2', 'e-x-b2', 'e-y-l2', 'e-y-r2'];
    ids.forEach(id => {
        const modalEl = document.getElementById(`aim-${id}`);
        if (modalEl) {
            const v = modalEl.value;
            const mainEl = document.getElementById(id);
            if (v !== "" && mainEl) mainEl.value = v;
        }
    });
    document.getElementById('modal-area-input').style.display = 'none';
    if (window.AppController) window.AppController.refreshAll();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const dxfUp = document.getElementById('dxf-upload');
    if (dxfUp) dxfUp.addEventListener('change', loadDxf);

    const btnApplyArea = document.getElementById('btn-apply-area-input');
    if (btnApplyArea) btnApplyArea.addEventListener('click', applyAreaInputModal);
});

window.shiftFloorOffset = function(targetFloor, deltaX, deltaY) {
    if (!targetFloor || (deltaX === 0 && deltaY === 0)) return;

    const shiftPt = (pt) => {
        if (!pt) return;
        if (pt.x !== undefined) pt.x += deltaX;
        if (pt.y !== undefined) pt.y += deltaY;
    };

    const shiftEnt = (ent) => {
        if (ent.position) shiftPt(ent.position);
        if (ent.startPoint) shiftPt(ent.startPoint);
        if (ent.insertionPoint) shiftPt(ent.insertionPoint);
        if (ent.center) shiftPt(ent.center);
        if (ent.start) shiftPt(ent.start);
        if (ent.end) shiftPt(ent.end);
        if (ent.vertices && Array.isArray(ent.vertices)) {
            ent.vertices.forEach(v => shiftPt(v));
        }
    };

    if (typeof bgLinesOriginal !== 'undefined' && Array.isArray(bgLinesOriginal)) {
        bgLinesOriginal.filter(l => l.floor === targetFloor || targetFloor === 'ALL').forEach(shiftEnt);
    }
    if (typeof bgTextsOriginal !== 'undefined' && Array.isArray(bgTextsOriginal)) {
        bgTextsOriginal.filter(t => t.floor === targetFloor || targetFloor === 'ALL').forEach(shiftPt);
    }
    if (typeof pillars !== 'undefined' && Array.isArray(pillars)) {
        pillars.filter(p => p.floor === targetFloor || targetFloor === 'ALL').forEach(shiftPt);
    }
    if (typeof areaLines !== 'undefined' && Array.isArray(areaLines)) {
        areaLines.filter(a => a.floor === targetFloor || targetFloor === 'ALL').forEach(shiftEnt);
    }

    const state = window.AppState;
    if (state) {
        state.bgLinesOriginal = bgLinesOriginal;
        state.bgTextsOriginal = bgTextsOriginal;
        state.pillars = pillars;
        state.areaLines = areaLines;
    }

    if (window.AppController) window.AppController.refreshAll();
};

window.setFloorOriginByClick = function(targetFloor, clickX, clickY) {
    if (clickX === undefined || clickY === undefined) return;
    const floor = targetFloor || (window.AppState ? window.AppState.currentFloor : '1F');

    const shiftPt = (pt) => {
        if (!pt) return;
        if (pt.x !== undefined) pt.x = Math.round((pt.x - clickX) * 10) / 10;
        if (pt.y !== undefined) pt.y = Math.round((pt.y - clickY) * 10) / 10;
    };

    const shiftEnt = (ent) => {
        if (ent.position) shiftPt(ent.position);
        if (ent.startPoint) shiftPt(ent.startPoint);
        if (ent.insertionPoint) shiftPt(ent.insertionPoint);
        if (ent.center) shiftPt(ent.center);
        if (ent.start) shiftPt(ent.start);
        if (ent.end) shiftPt(ent.end);
        if (ent.vertices && Array.isArray(ent.vertices)) {
            ent.vertices.forEach(v => shiftPt(v));
        }
    };

    // 共通通り芯・グリッド要素は1階設定時にのみアライメント。2階以降は2階自階の要素のみをシフトする
    const isFirstFloorSetup = (floor === '1F' || floor === 'ALL');

    if (typeof bgLinesOriginal !== 'undefined' && Array.isArray(bgLinesOriginal)) {
        bgLinesOriginal.filter(l => l.floor === floor || (isFirstFloorSetup && (l.isGridLine || l.floor === 'ALL'))).forEach(shiftEnt);
    }
    if (typeof bgTextsOriginal !== 'undefined' && Array.isArray(bgTextsOriginal)) {
        bgTextsOriginal.filter(t => t.floor === floor || (isFirstFloorSetup && (t.isGridText || t.floor === 'ALL'))).forEach(shiftPt);
    }
    if (typeof pillars !== 'undefined' && Array.isArray(pillars)) {
        pillars.filter(p => p.floor === floor).forEach(shiftPt);
    }
    if (typeof areaLines !== 'undefined' && Array.isArray(areaLines)) {
        areaLines.filter(a => a.floor === floor).forEach(shiftEnt);
    }
    if (typeof walls !== 'undefined' && Array.isArray(walls)) {
        walls.filter(w => w.floor === floor).forEach(shiftEnt);
    }
    if (isFirstFloorSetup && typeof gridBubbles !== 'undefined' && Array.isArray(gridBubbles)) {
        gridBubbles.forEach(shiftPt);
    }

    // Deduplicate grid lines and bubbles
    if (window.deduplicateGridElements) window.deduplicateGridElements();

    const state = window.AppState;
    if (state) {
        if (isFirstFloorSetup) {
            // シフト前の旧手動・カスタム編集グリッドデータをシフト更新して重複増殖を防止
            if (Array.isArray(state.manualGridX)) {
                state.manualGridX.forEach(m => { m.coord = Math.round((m.coord - clickX) * 10) / 10; });
            }
            if (Array.isArray(state.manualGridY)) {
                state.manualGridY.forEach(m => { m.coord = Math.round((m.coord - clickY) * 10) / 10; });
            }
            state.deletedGridX = [];
            state.deletedGridY = [];
            state.userEditedGridX = {};
            state.userEditedGridY = {};

            if (window.GridEngine && typeof window.GridEngine.analyzeGrids === 'function') {
                window.GridEngine.analyzeGrids(state);
            }
        }
        state.bgLinesOriginal = bgLinesOriginal;
        state.bgTextsOriginal = bgTextsOriginal;
        state.pillars = pillars;
        state.areaLines = areaLines;
        state.walls = walls;
        state.gridBubbles = gridBubbles;
    }

    if (window.AppController) window.AppController.refreshAll();
    else if (typeof draw === 'function') draw();
};

window.deduplicateGridElements = function() {
    if (typeof bgLinesOriginal !== 'undefined' && Array.isArray(bgLinesOriginal)) {
        const uniqueLines = [];
        bgLinesOriginal.forEach(line => {
            if (!line.isGridLine && line.floor !== 'ALL') {
                uniqueLines.push(line);
                return;
            }
            const isDup = uniqueLines.some(ul => {
                if (ul.type !== line.type) return false;
                if (line.type === 'LINE' && line.vertices && ul.vertices && line.vertices.length >= 2 && ul.vertices.length >= 2) {
                    const dStart = Math.hypot(ul.vertices[0].x - line.vertices[0].x, ul.vertices[0].y - line.vertices[0].y);
                    const dEnd = Math.hypot(ul.vertices[1].x - line.vertices[1].x, ul.vertices[1].y - line.vertices[1].y);
                    const dStartRev = Math.hypot(ul.vertices[1].x - line.vertices[0].x, ul.vertices[1].y - line.vertices[0].y);
                    const dEndRev = Math.hypot(ul.vertices[0].x - line.vertices[1].x, ul.vertices[0].y - line.vertices[1].y);
                    return (dStart < 20 && dEnd < 20) || (dStartRev < 20 && dEndRev < 20);
                }
                return false;
            });
            if (!isDup) uniqueLines.push(line);
        });
        bgLinesOriginal = uniqueLines;
    }

    if (typeof gridBubbles !== 'undefined' && Array.isArray(gridBubbles)) {
        const uniqueBubbles = [];
        gridBubbles.forEach(b => {
            const isDup = uniqueBubbles.some(ub => Math.hypot(ub.x - b.x, ub.y - b.y) < 20);
            if (!isDup) uniqueBubbles.push(b);
        });
        gridBubbles = uniqueBubbles;
    }

    const state = window.AppState;
    if (state) {
        state.bgLinesOriginal = bgLinesOriginal;
        state.gridBubbles = gridBubbles;
    }
};
