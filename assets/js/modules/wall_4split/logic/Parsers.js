/**
 * logic/Parsers.js - DXF and JSON Data Parsing Engine
 * v2.3.21 Refactoring
 */

window.Parsers = {
    /**
     * Parse raw DXF string and update state
     */
    parseDxf: function(rawTxt, state, isSub = false, skipEntities = false, layerMapping = null, appendMode = false) {
        const s = state || window.AppState;
        const parser = new window.DxfParser();
        const dxf = parser.parseSync(rawTxt);
        if (!dxf || !dxf.entities) throw new Error("Invalid DXF data");

        const newBgLines = [];
        const newBgTexts = [];
        const newBubbles = [];
        const newPillars = [];
        const newAreaLines = [];

        const rawPillarCandidates = [];

        function collect(entities, blocks, parentLayer = "") {
            entities.forEach(ent => {
                let L = (ent.layer || "").toUpperCase().trim();
                if (!L || L === "0") L = (parentLayer || "0").toUpperCase().trim();
                ent.layer = L;

                if (ent.type === 'INSERT') {
                    const block = blocks[ent.name];
                    if (block && block.entities) collect(block.entities, blocks, L);
                } else {
                    let isGrid = false, isCol = false, floor = 'ALL';

                    const normMap = (v) => (v || "").normalize('NFKC').toUpperCase().trim();
                    const normL = normMap(L);

                    let isRoof = false;
                    let isCol1F = false, isCol2F = false;
                    let isRoof1F = false, isRoof2F = false;
                    let isBack1F = false, isBack2F = false;

                    if (layerMapping) {
                        // モーダルで指定された明示的レイヤーマッピング
                        const gridL  = normMap(layerMapping.gridLayer);
                        const col1L  = normMap(layerMapping.col1FLayer);
                        const col2L  = normMap(layerMapping.col2FLayer);
                        const back1L = normMap(layerMapping.back1FLayer);
                        const back2L = normMap(layerMapping.back2FLayer);
                        const roof1L = normMap(layerMapping.roof1FLayer);
                        const roof2L = normMap(layerMapping.roof2FLayer);

                        if (gridL && normL === gridL) isGrid = true;
                        if (col1L && normL === col1L) isCol1F = true;
                        if (col2L && normL === col2L) isCol2F = true;
                        if (!isCol1F && !isCol2F && (normL.includes('COL') || normL.includes('柱'))) {
                            isCol1F = true; isCol2F = true;
                        }
                        if (isCol1F || isCol2F) isCol = true;

                        if (roof1L && (roof1L === '__ALL_LAYERS__' || normL === roof1L)) { isRoof1F = true; ent.isRoof = true; isRoof = true; }
                        if (roof2L && (roof2L === '__ALL_LAYERS__' || normL === roof2L)) { isRoof2F = true; ent.isRoof = true; isRoof = true; }
                        if (back1L && (back1L === '__ALL_LAYERS__' || normL === back1L)) { isBack1F = true; }
                        if (back2L && (back2L === '__ALL_LAYERS__' || normL === back2L)) { isBack2F = true; }
                    } else {
                        // 自動レイヤー判定フォールバック
                        const isBgLayer = /(BACK|Rｸﾞﾙｰﾌﾟ|グループ|背景|下図|UNDER)/i.test(L);
                        isCol = /(COL|COLUMN|柱)/i.test(L) && !isBgLayer;
                        isCol1F = isCol;
                        isCol2F = isCol;
                        isGrid = /(GRID|GLID|通り芯|軸線)/i.test(L) && !isBgLayer && !isCol;
                        isRoof1F = (normL.includes('1F_R') || normL.includes('1R'));
                        isRoof2F = (normL.includes('2F_R') || normL.includes('2R') || normL.includes('RF'));
                        isRoof = isRoof1F || isRoof2F;
                        isBack1F = !isGrid && !isCol && !isRoof && !normL.includes('2F');
                        isBack2F = !isGrid && !isCol && !isRoof && normL.includes('2F');
                    }
                    
                    if (isCol && !isSub) {
                        // 柱レイヤーの幾何要素のみから柱候補を抽出（通り芯は作らない）
                        let cx = null, cy = null;
                        if (ent.type === 'POINT') { cx = ent.position.x; cy = ent.position.y; }
                        else if (ent.type === 'CIRCLE') { cx = ent.center.x; cy = ent.center.y; }
                        else if (ent.vertices && ent.vertices.length > 0) {
                            cx = ent.vertices.reduce((sum, v) => sum + v.x, 0) / ent.vertices.length;
                            cy = ent.vertices.reduce((sum, v) => sum + v.y, 0) / ent.vertices.length;
                        }
                        if (cx != null && cy != null && !isNaN(cx) && !isNaN(cy)) {
                            if (isCol1F) rawPillarCandidates.push({ x: cx, y: cy, floor: '1F', layer: '1F_COL' });
                            if (isCol2F) rawPillarCandidates.push({ x: cx, y: cy, floor: '2F', layer: '2F_COL' });
                        }
                    } else if (isGrid) {
                        if (['TEXT', 'MTEXT'].includes(ent.type)) {
                            const txt = ent.text || ent.string || "";
                            const pos = ent.startPoint || ent.position || ent.insertionPoint || {};
                            newBgTexts.push({ text: txt, x: pos.x || 0, y: pos.y || 0, floor: 'ALL', layer: 'GRID', isUnderlay: false, isGridText: true });
                        } else {
                            newBgLines.push({ ...ent, layer: 'GRID', floor: 'ALL', isUnderlay: false, isGridLine: true });
                        }
                    } else if (isRoof) {
                        const roofLayerName = isRoof2F ? '2F_ROOF' : '1F_ROOF';
                        const roofFloor = isRoof2F ? '2R' : '1R';
                        if (['TEXT', 'MTEXT'].includes(ent.type)) {
                            const txt = ent.text || ent.string || "";
                            const pos = ent.startPoint || ent.position || ent.insertionPoint || {};
                            newBgTexts.push({ text: txt, x: pos.x || 0, y: pos.y || 0, floor: roofFloor, layer: roofLayerName, isUnderlay: false, isGridText: false });
                        } else {
                            newBgLines.push({ ...ent, layer: roofLayerName, floor: roofFloor, isUnderlay: false, isGridLine: false });
                        }
                    } else {
                        // 通り芯・柱・屋根として指定されていない余剰CAD要素は1F_BACK / 2F_BACKの該当階のみに非重複登録
                        if (isBack2F) {
                            if (['TEXT', 'MTEXT'].includes(ent.type)) {
                                const txt = ent.text || ent.string || "";
                                const pos = ent.startPoint || ent.position || ent.insertionPoint || {};
                                newBgTexts.push({ text: txt, x: pos.x || 0, y: pos.y || 0, floor: '2F', layer: '2F_BACK', isUnderlay: true, isGridText: false });
                            } else {
                                newBgLines.push({ ...ent, layer: '2F_BACK', floor: '2F', isUnderlay: true, isGridLine: false });
                            }
                        } else {
                            // デフォルトは1階背景へ登録
                            if (['TEXT', 'MTEXT'].includes(ent.type)) {
                                const txt = ent.text || ent.string || "";
                                const pos = ent.startPoint || ent.position || ent.insertionPoint || {};
                                newBgTexts.push({ text: txt, x: pos.x || 0, y: pos.y || 0, floor: '1F', layer: '1F_BACK', isUnderlay: true, isGridText: false });
                            } else {
                                newBgLines.push({ ...ent, layer: '1F_BACK', floor: '1F', isUnderlay: true, isGridLine: false });
                            }
                        }
                    }
                }
            });
        }

        collect(dxf.entities, dxf.blocks || {});

        // 柱要素のクラスタリング（近接する200mm以内の幾何要素群を1本の柱に集約）
        const pillarClusters = [];
        rawPillarCandidates.forEach(cand => {
            let found = null;
            for (const cl of pillarClusters) {
                if (cl.floor === cand.floor && Math.hypot(cl.x - cand.x, cl.y - cand.y) < 200) {
                    found = cl;
                    break;
                }
            }
            if (found) {
                found.items.push(cand);
                found.x = found.items.reduce((s, item) => s + item.x, 0) / found.items.length;
                found.y = found.items.reduce((s, item) => s + item.y, 0) / found.items.length;
            } else {
                pillarClusters.push({
                    x: cand.x,
                    y: cand.y,
                    floor: cand.floor,
                    layer: cand.layer,
                    items: [cand]
                });
            }
        });

        pillarClusters.forEach(cl => {
            newPillars.push({
                id: `P${s.pIdCounter++}`,
                x: cl.x,
                y: cl.y,
                floor: cl.floor,
                layer: cl.layer,
                isManual: false,
                isDeleted: false
            });
        });

        const docData = { entities: [...newBgLines, ...newBgTexts], loaded: true, rawDxf: rawTxt };

        if (isSub) {
            s.docDrawings.elev = docData;
        } else if (appendMode) {
            // appendMode: 上書きせず既存データに累積追記
            s.bgLinesOriginal = [...(s.bgLinesOriginal || []), ...newBgLines];
            s.bgTextsOriginal = [...(s.bgTextsOriginal || []), ...newBgTexts];
            if (!skipEntities) {
                s.pillars = [...(s.pillars || []), ...newPillars];
            }
            const prevEnts = (s.docDrawings && s.docDrawings.floor && s.docDrawings.floor.entities) || [];
            const accDocData = { entities: [...prevEnts, ...newBgLines, ...newBgTexts], loaded: true };
            s.docDrawings.floor = accDocData;
            s.docDrawings.div4  = accDocData;
        } else {
            s.bgLinesOriginal = newBgLines;
            s.bgTextsOriginal = newBgTexts;
            if (!skipEntities) {
                s.pillars = [...s.pillars.filter(p => p.isManual), ...newPillars]; // Keep manual pillars
            }
            s.docDrawings.floor = docData;
            s.docDrawings.div4 = docData;
        }

        if (layerMapping) {
            // layerVisibility: appendMode では累積（上書きしない）
            if (!appendMode) {
                s.layerMapping = layerMapping;
                s.layerVisibility = {};
            }
            if (!s.layerVisibility) s.layerVisibility = {};
            const allExtracted = new Set();
            newBgLines.forEach(l => { if (l.layer) allExtracted.add(l.layer.toUpperCase().trim()); });
            newBgTexts.forEach(t => { if (t.layer) allExtracted.add(t.layer.toUpperCase().trim()); });
            rawPillarCandidates.forEach(p => { if (p.layer) allExtracted.add(p.layer.toUpperCase().trim()); });
            allExtracted.forEach(l => {
                s.layerVisibility[l] = true; // 抽出済み内部レイヤーは常に表示
            });
        }

        return s;
    },

    /**
     * Parse JSON project data and restore AppState
     */
    parseJson: function(jsonTxt, state) {
        const d = JSON.parse(jsonTxt);
        const s = state || window.AppState;

        console.log("📂 [Parsers] Restoring project data...", d);

        // 1. Core data (Handle property name variations)
        s.rawDxf = d.rawDxf || s.rawDxf || "";
        s.pillars = d.pillars || [];
        s.walls = d.walls || [];
        s.windowsArr = d.windowsArr || d.windows || [];
        s.areaLines = d.areaLines || [];
        s.bgLinesOriginal = d.bgLinesOriginal || d.bgLines || [];
        s.bgTextsOriginal = d.bgTextsOriginal || d.texts || [];
        s.gridBubbles = d.gridBubbles || [];
        s.roofFaces = d.roofFaces || []; // [v2.7.0]
        s.roofGridManualX = d.roofGridManualX || []; // [v2.7.0]
        s.roofGridManualY = d.roofGridManualY || []; // [v2.7.0]

        // 2. Grid & Coordinates
        if (d.gx) s.gridXNames = d.gx;
        if (d.gy) s.gridYNames = d.gy;
        if (d.gxc) s.gridXCoords = d.gxc;
        if (d.gyc) s.gridYCoords = d.gyc;
        if (d.mgX) s.manualGridX = d.mgX;
        if (d.mgY) s.manualGridY = d.mgY;
        if (d.mgAngle) s.manualGridAngle = d.mgAngle;
        if (d.ueGX) s.userEditedGridX = d.ueGX;
        if (d.ueGY) s.userEditedGridY = d.ueGY;
        if (d.deletedGX) s.deletedGridX = d.deletedGX;
        if (d.deletedGY) s.deletedGridY = d.deletedGY;

        // 3. Foundation data
        s.foundationBeams = d.foundationBeams || [];
        s.foundationSlabs = d.foundationSlabs || [];
        s.exteriorWalls = d.exteriorWalls || [];
        s.manholes = d.manholes || [];
        if (d.concreteFc !== undefined) s.concreteFc = d.concreteFc;
        if (d.averageGroundPressure !== undefined) s.averageGroundPressure = d.averageGroundPressure;
        
        // 4. Custom Specs [v2.5.22 構造の正規化]
        // 保存時のキー {n, v} とメモリ上のキー {name, val} の不一致をここで安全に吸収・統一します
        // [v2.5.23] 過去のバグでJSONに保存された "undefined", "null", "NaN" という文字列ゴミを完全に空文字へクレンジング
        const sanitizeLegacyStr = (str) => {
            if (str === undefined || str === null) return "";
            const sStr = String(str).trim();
            if (sStr === "undefined" || sStr === "null" || sStr === "NaN") return "";
            return sStr;
        };

        if (d.customWalls && Array.isArray(d.customWalls)) {
            s.customWalls = d.customWalls.map(cw => {
                const rawName = cw.name !== undefined ? cw.name : (cw.n !== undefined ? cw.n : "");
                const rawVal = cw.val !== undefined ? cw.val : (cw.v !== undefined ? parseFloat(cw.v) : null);
                return {
                    name: sanitizeLegacyStr(rawName),
                    val: isNaN(rawVal) || rawVal === null ? null : rawVal
                };
            });
        }
        if (d.customHws && Array.isArray(d.customHws)) {
            // AppState.js 側で利用される customHardware と、互換配列の両方に正規化して格納
            s.customHardware = d.customHws.map(ch => {
                const rawName = ch.name !== undefined ? ch.name : (ch.n !== undefined ? ch.n : "");
                const rawVal = ch.val !== undefined ? ch.val : (ch.v !== undefined ? parseFloat(ch.v) : null);
                return {
                    name: sanitizeLegacyStr(rawName),
                    val: isNaN(rawVal) || rawVal === null ? null : rawVal
                };
            });
            s.customHws = s.customHardware;
        }
        
        // 4. App State / Settings
        s.scale = d.scale || s.scale;
        s.offsetX = d.offsetX || s.offsetX;
        s.offsetY = d.offsetY || s.offsetY;
        s.pIdCounter = d.pIdCounter || (s.pillars.length + 100);
        s.currentAppMode = d.currentAppMode || 'structural';
        
        // 5. Restore DOM Inputs
        if (d.inputs) {
            Object.keys(d.inputs).forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const val = d.inputs[id];
                    if (val !== undefined && val !== null) {
                        el.value = val;
                    }
                }
            });
        }

        // 6. Config Synchronization
        s.config = { ...s.config, ...(d.config || {}) };
        
        // 7. Layer Visibility & Layer Mapping & Element Visibility
        if (d.layerVisibility) {
            s.layerVisibility = d.layerVisibility;
            if (typeof appLayerVisibility !== 'undefined') {
                window.appLayerVisibility = d.layerVisibility;
            }
        }
        if (d.layerMapping) {
            s.layerMapping = d.layerMapping;
        }
        if (d.elementVisibility) {
            s.elementVisibility = { ...s.elementVisibility, ...d.elementVisibility };
            // DOMの表示切替チェックボックスに反映
            const mapping = {
                'v-layer-grids': 'grids',
                'v-layer-pillars': 'pillars',
                'v-layer-pillarNValues': 'pillarNValues',
                'vis-wall': 'walls',
                'v-layer-windows': 'windows',
                'vis-diaph': 'areas',
                'v-layer-f_beams': 'f_beams',
                'v-layer-f_slabs': 'f_slabs',
                'v-layer-f_ext_walls': 'f_ext_walls',
                'v-layer-f_manholes': 'f_manholes'
            };
            Object.entries(mapping).forEach(([id, key]) => {
                const el = document.getElementById(id);
                if (el) el.checked = !!s.elementVisibility[key];
            });
        }
        
        // 8. Recreate Custom Spec DOM rows [v2.5.22 正規化された値によるDOM復元]
        // [v2.5.23] UIView.js の実装に合わせ、変更リスナー onchange と ❌削除ボタンを完全復元
        if (s.customWalls && Array.isArray(s.customWalls)) {
            const container = document.getElementById('custom-wall-container');
            if (container) {
                container.innerHTML = s.customWalls.map(cw => `
                    <div class="calc-row cust-wall-row" style="margin-bottom:5px;">
                        <input type="text" class="cust-w-n" value="${cw.name || ''}" placeholder="名称" style="width:130px; margin:0;" onchange="window.updateWallSelects()">
                        <input type="number" class="cust-w-v" value="${(cw.val !== undefined && cw.val !== null) ? cw.val : ''}" placeholder="倍率" step="0.1" style="width:60px; margin:0;" onchange="window.updateWallSelects()">
                        <button onclick="this.parentElement.remove(); window.updateWallSelects();" style="border:none; background:none; cursor:pointer;">❌</button>
                    </div>
                `).join('');
            }
        }
        if (s.customHardware && Array.isArray(s.customHardware)) {
            const container = document.getElementById('custom-hw-container');
            if (container) {
                container.innerHTML = s.customHardware.map(ch => `
                    <div class="calc-row cust-hw-row" style="margin-bottom:5px;">
                        <input type="text" class="cust-h-n" value="${ch.name || ''}" placeholder="記号" style="width:130px; margin:0;" onchange="window.updateWallSelects()">
                        <input type="number" class="cust-h-v" value="${(ch.val !== undefined && ch.val !== null) ? ch.val : ''}" placeholder="耐力(kN)" step="0.1" style="width:60px; margin:0;" onchange="window.updateWallSelects()">
                        <button onclick="this.parentElement.remove(); window.updateWallSelects();" style="border:none; background:none; cursor:pointer;">❌</button>
                    </div>
                `).join('');
            }
        }

        // 8. Restore raw DXF if available (Skip re-extracting pillars/areas as they are already restored)
        if (d.docDrawingsRaw && d.docDrawingsRaw.floor) {
            try {
                this.parseDxf(d.docDrawingsRaw.floor, s, false, true);
            } catch (e) {
                console.warn("Failed to re-parse raw DXF:", e);
            }
        }

        // 9. Migrate legacy data (Add IDs if missing)
        this.migrateLegacyData(s);
        if (typeof renderLayerPanel === 'function') renderLayerPanel();

        return s;
    },

    migrateLegacyData: function(state) {
        if (!state.walls) return;
        const fullWallList = state.getMasterWallList ? state.getMasterWallList() : null;
        const fullBraceList = state.getMasterBraceList ? state.getMasterBraceList() : null;

        state.walls.forEach(w => {
            // 1. 面材IDの補完 (カスタム壁も含むリストで検索)
            if (!w.outPanelId && w.outPanelName && window.Specs) {
                w.outPanelId = window.Specs.findWallIdByName(w.outPanelName, fullWallList);
            }
            if (!w.inPanelId && w.inPanelName && window.Specs) {
                w.inPanelId = window.Specs.findWallIdByName(w.inPanelName, fullWallList);
            }
            // デフォルト値の保証
            if (!w.outPanelId) w.outPanelId = "opt0";
            if (!w.inPanelId) w.inPanelId = "opt0";

            // 2. 筋交いIDの補完
            if (!w.braceId && w.braceName && window.Specs) {
                w.braceId = window.Specs.findBraceIdByName(w.braceName, fullBraceList);
            }
            if (!w.braceId) w.braceId = "b0";
        });
        console.log("🛠️ [Parsers] Legacy wall data migrated (including custom checks).");
    }
};
