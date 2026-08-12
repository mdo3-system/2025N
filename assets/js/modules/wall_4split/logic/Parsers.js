/**
 * logic/Parsers.js - DXF and JSON Data Parsing Engine
 * v2.3.21 Refactoring
 */

window.Parsers = {
    /**
     * Parse raw DXF string and update state
     */
    parseDxf: function(rawTxt, state, isSub = false, skipEntities = false, layerMapping = null) {
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

                    if (layerMapping) {
                        // モーダルで指定された明示的レイヤーマッピング
                        if (layerMapping.gridLayer && L === layerMapping.gridLayer.toUpperCase().trim()) isGrid = true;
                        if (layerMapping.col1FLayer && L === layerMapping.col1FLayer.toUpperCase().trim()) { isCol = true; floor = '1F'; }
                        if (layerMapping.col2FLayer && L === layerMapping.col2FLayer.toUpperCase().trim()) { isCol = true; floor = '2F'; }
                        if (layerMapping.back1FLayer && L === layerMapping.back1FLayer.toUpperCase().trim()) { floor = '1F'; }
                        if (layerMapping.back2FLayer && L === layerMapping.back2FLayer.toUpperCase().trim()) { floor = '2F'; }
                        if (layerMapping.roof1FLayer && L === layerMapping.roof1FLayer.toUpperCase().trim()) { floor = '1F'; ent.isRoof = true; }
                        if (layerMapping.roof2FLayer && L === layerMapping.roof2FLayer.toUpperCase().trim()) { floor = '2F'; ent.isRoof = true; }
                    } else {
                        // 自動レイヤー判定フォールバック
                        const isBgLayer = /(BACK|Rｸﾞﾙｰﾌﾟ|グループ|背景|下図|UNDER)/i.test(L);
                        isCol = /(COL|COLUMN|柱)/i.test(L) && !isBgLayer;
                        isGrid = /(GRID|GLID|通り芯|軸線)/i.test(L) && !isBgLayer && !isCol;
                        floor = L.includes('2F') ? '2F' : (L.includes('1F') ? '1F' : 'ALL');
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
                            rawPillarCandidates.push({ x: cx, y: cy, floor, layer: L });
                        }
                    } else if (['TEXT', 'MTEXT'].includes(ent.type)) {
                        const txt = ent.text || ent.string || "";
                        const pos = ent.startPoint || ent.position || ent.insertionPoint || {};
                        newBgTexts.push({ text: txt, x: pos.x || 0, y: pos.y || 0, floor, layer: L, isUnderlay: true, isGridText: false });
                    } else {
                        newBgLines.push({ ...ent, floor, isUnderlay: true, isGridLine: isGrid });
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
        } else {
            s.bgLinesOriginal = newBgLines;
            s.bgTextsOriginal = newBgTexts;
            if (!skipEntities) {
                s.pillars = [...s.pillars.filter(p => p.isManual), ...newPillars]; // Keep manual pillars
            }
            s.docDrawings.floor = docData;
            s.docDrawings.div4 = docData;
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
