/**
 * logic/CadEngine.js - DXF Parsing and CAD Logic
 * v2.3.13 Refactoring
 */

window.CadEngine = {
    /**
     * Parse DXF and process entities
     */
    processDxf: function(rawTxt) {
        const parser = new window.DxfParser();
        try {
            const dxf = parser.parseSync(rawTxt);
            return dxf;
        } catch (e) {
            console.error("DXF Parse Error:", e);
            return null;
        }
    },

    /**
     * Detect base grid origin (e.g. bottom-left intersection of GRID lines or bounding box)
     */
    /**
     * Detect base grid origin (e.g. bottom-left intersection of main GRID lines or bounding box)
     */
    detectGridOrigin: function(entities, blocks) {
        let gridLines = [];
        const isBackLayer = (l) => /(BACK|Rｸﾞﾙｰﾌﾟ|グループ|背景|下図|UNDER)/i.test(l);
        const isPillarLayer = (l) => !isBackLayer(l) && /(1F_COL|2F_COL|COL|COLUMN|柱|柱心|HASHIRA|HASIRA|角柱|管柱|通し柱|S-COL|H-COL|C105|C120)/i.test(l);
        const isGridLayer = (l) => !isBackLayer(l) && !isPillarLayer(l) && /(GRID|GLID|通り芯|軸線)/i.test(l) && !/^GL([_-]|$)/i.test(l.trim());

        const transformPoint = (pt, tf) => {
            if (!pt || !tf) return pt || { x: 0, y: 0 };
            let x = (pt.x || 0) * (tf.xScale !== undefined ? tf.xScale : 1);
            let y = (pt.y || 0) * (tf.yScale !== undefined ? tf.yScale : 1);
            if (tf.rotation) {
                const rad = (tf.rotation * Math.PI) / 180;
                const cos = Math.cos(rad), sin = Math.sin(rad);
                const rx = x * cos - y * sin, ry = x * sin + y * cos;
                x = rx; y = ry;
            }
            return {
                x: x + (tf.position ? (tf.position.x || 0) : 0),
                y: y + (tf.position ? (tf.position.y || 0) : 0)
            };
        };

        const collectGrids = (ents, blks, transformStack = []) => {
            (ents || []).forEach(ent => {
                let L = (ent.layer || "").toUpperCase().trim();
                if (ent.type === 'INSERT') {
                    const block = blks ? blks[ent.name] : null;
                    if (block && block.entities) {
                        const tf = {
                            position: ent.position || { x: ent.x || 0, y: ent.y || 0 },
                            rotation: ent.rotation || 0,
                            xScale: ent.xScale !== undefined ? ent.xScale : (ent.scale ? ent.scale.x : 1),
                            yScale: ent.yScale !== undefined ? ent.yScale : (ent.scale ? ent.scale.y : 1)
                        };
                        collectGrids(block.entities, blks, [...transformStack, tf]);
                    }
                } else if (isGridLayer(L)) {
                    let e = JSON.parse(JSON.stringify(ent));
                    transformStack.forEach(tf => {
                        if (e.start) e.start = transformPoint(e.start, tf);
                        if (e.end) e.end = transformPoint(e.end, tf);
                        if (e.vertices) e.vertices = e.vertices.map(v => transformPoint(v, tf));
                    });
                    gridLines.push(e);
                }
            });
        };
        collectGrids(entities || [], blocks || {});

        let vertXs = [];
        let horizYs = [];

        const addSegment = (p1, p2) => {
            if (!p1 || !p2) return;
            let dx = Math.abs(p1.x - p2.x);
            let dy = Math.abs(p1.y - p2.y);
            let len = Math.hypot(dx, dy);
            // 通り芯主線（長さ 2000mm 以上の長尺直線）のみをグリッド基準軸として抽出（引き出し小線分や記号を除外）
            if (len > 2000) {
                if (dx < 10) vertXs.push((p1.x + p2.x) / 2);
                if (dy < 10) horizYs.push((p1.y + p2.y) / 2);
            }
        };

        gridLines.forEach(ent => {
            if (ent.type === 'LINE') {
                const v1 = ent.start || (ent.vertices ? ent.vertices[0] : null);
                const v2 = ent.end || (ent.vertices ? ent.vertices[1] : null);
                addSegment(v1, v2);
            } else if (['LWPOLYLINE', 'POLYLINE'].includes(ent.type) && ent.vertices && ent.vertices.length >= 2) {
                for (let i = 0; i < ent.vertices.length - 1; i++) {
                    addSegment(ent.vertices[i], ent.vertices[i + 1]);
                }
            }
        });

        if (vertXs.length > 0 && horizYs.length > 0) {
            let minX = Math.min(...vertXs);
            let minY = Math.min(...horizYs);
            return { x: Math.round(minX * 10) / 10, y: Math.round(minY * 10) / 10 };
        }

        // Fallback: 2000mm以上の長尺線がない場合は旧ロジック（LINE/Polylineの最左下座標）
        let minX = Infinity, minY = Infinity;
        let xCoords = [], yCoords = [];
        gridLines.forEach(ent => {
            if (ent.type === 'LINE' && ent.start && ent.end) {
                xCoords.push(ent.start.x, ent.end.x);
                yCoords.push(ent.start.y, ent.end.y);
            } else if (ent.vertices && Array.isArray(ent.vertices)) {
                ent.vertices.forEach(v => { xCoords.push(v.x); yCoords.push(v.y); });
            }
        });

        if (xCoords.length > 0 && yCoords.length > 0) {
            minX = Math.min(...xCoords);
            minY = Math.min(...yCoords);
        } else {
            // Fallback to pillar locations or bounding box of all entities
            (entities || []).forEach(e => {
                let L = (e.layer || "").toUpperCase().trim();
                if (isPillarLayer(L) || e.type === 'POINT' || e.type === 'LINE') {
                    if (e.position) { minX = Math.min(minX, e.position.x); minY = Math.min(minY, e.position.y); }
                    if (e.center) { minX = Math.min(minX, e.center.x); minY = Math.min(minY, e.center.y); }
                    if (e.start) { minX = Math.min(minX, e.start.x); minY = Math.min(minY, e.start.y); }
                }
            });
        }

        if (minX === Infinity || minY === Infinity) {
            return { x: 0, y: 0 };
        }

        return { x: Math.round(minX * 10) / 10, y: Math.round(minY * 10) / 10 };
    },

    mapEntitiesToBackground: function(entities, blocks, state, options = {}) {
        const newBgLines = [];
        const newBgTexts = [];
        const newBubbles = [];
        const pillars = [];
        const areaLines = [];
        let pIdCounter = Date.now();

        const targetFloor = options.targetFloor || null;
        const currentOrigin = this.detectGridOrigin(entities, blocks);
        let shiftX = 0;
        let shiftY = 0;

        if (options.baseOrigin) {
            // 基準階 (1F) の原点が存在する場合、通り芯基準点を1階の原点位置に一致させる自動相対アライメント
            shiftX = options.baseOrigin.x - currentOrigin.x;
            shiftY = options.baseOrigin.y - currentOrigin.y;
        } else {
            // 初回読み込み時は、検出された最左下通り芯原点を (0, 0) に正規化
            shiftX = -currentOrigin.x;
            shiftY = -currentOrigin.y;
        }

        // 精密なモジュール丸め（0.1mm単位の四捨五入）
        const roundCoord = (val) => Math.round((val) * 10) / 10;

        // 座標変換ヘルパー (INSERTブロックの移動・回転・拡大縮小＋基準原点シフト)
        const transformPoint = (pt, transform) => {
            if (!pt) return { x: 0, y: 0 };
            let x = pt.x || 0;
            let y = pt.y || 0;
            if (transform) {
                const sx = transform.xScale !== undefined ? transform.xScale : 1;
                const sy = transform.yScale !== undefined ? transform.yScale : 1;
                x *= sx;
                y *= sy;

                if (transform.rotation) {
                    const rad = (transform.rotation * Math.PI) / 180;
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);
                    const rx = x * cos - y * sin;
                    const ry = x * sin + y * cos;
                    x = rx;
                    y = ry;
                }

                x += transform.position ? (transform.position.x || 0) : 0;
                y += transform.position ? (transform.position.y || 0) : 0;
            }
            return { x, y };
        };

        const applyShift = (pt) => {
            if (!pt) return { x: 0, y: 0 };
            return { x: pt.x + shiftX, y: pt.y + shiftY };
        };

        const isBackLayer = (l) => {
            if (state && state.back1FLayer && (l === state.back1FLayer.toUpperCase() || l.includes(state.back1FLayer.toUpperCase()))) return true;
            if (state && state.back2FLayer && (l === state.back2FLayer.toUpperCase() || l.includes(state.back2FLayer.toUpperCase()))) return true;
            return /(BACK|Rｸﾞﾙｰﾌﾟ|グループ|背景|下図|UNDER|1F_BACK|2F_BACK|_BACK$)/i.test(l);
        };
        const isPillarLayer = (l, name = "") => {
            if (isBackLayer(l)) return false;
            if (state && state.col1FLayer && (l === state.col1FLayer.toUpperCase() || l.includes(state.col1FLayer.toUpperCase()))) return true;
            if (state && state.col2FLayer && (l === state.col2FLayer.toUpperCase() || l.includes(state.col2FLayer.toUpperCase()))) return true;
            return /(1F_COL|2F_COL|COL|COLUMN|柱|柱心|HASHIRA|HASIRA|角柱|管柱|通し柱|S-COL|H-COL|C105|C120)/i.test(l) || /(1F_COL|2F_COL|COL|COLUMN|柱|柱心)/i.test(name);
        };
        const isGridLayer = (l, name = "") => {
            if (isBackLayer(l)) return false;
            if (state && state.gridLayer && (l === state.gridLayer.toUpperCase() || l.includes(state.gridLayer.toUpperCase()))) return true;
            return !isPillarLayer(l, name) && ((/(GRID|GLID|通り芯|軸線)/i.test(l) || /(GRID|GLID|通り芯)/i.test(name)) && !/^GL([_-]|$)/i.test(l.trim()));
        };
        const isAreaLayer = (l, name = "") => /(AREA|面積|求積)/i.test(l) || /(AREA|面積)/i.test(name);
        const isRoofLayer = (l) => {
            if (state && state.roof1FLayer && (l === state.roof1FLayer.toUpperCase() || l.includes(state.roof1FLayer.toUpperCase()))) return true;
            if (state && state.roof2FLayer && (l === state.roof2FLayer.toUpperCase() || l.includes(state.roof2FLayer.toUpperCase()))) return true;
            return /(1F_R|2F_R|_R$)/i.test(l);
        };

        const collect = (ents, blks, parentLayer = "", transformStack = []) => {
            ents.forEach(ent => {
                let L = (ent.layer || "").toUpperCase().trim();
                if (!L || L === "0") L = (parentLayer || "0").toUpperCase().trim();
                if (L === 'AREA_D_X') L = 'AREA_X';
                if (L === 'AREA_D_Y') L = 'AREA_Y';

                if (ent.type === 'INSERT') {
                    const blockName = ent.name || "";
                    const currentTransform = {
                        position: ent.position || { x: ent.x || 0, y: ent.y || 0 },
                        rotation: ent.rotation || 0,
                        xScale: ent.xScale !== undefined ? ent.xScale : (ent.scale ? ent.scale.x : 1),
                        yScale: ent.yScale !== undefined ? ent.yScale : (ent.scale ? ent.scale.y : 1)
                    };
                    const newStack = [...transformStack, currentTransform];
                    const effectiveLayer = isPillarLayer(L, blockName) ? (isPillarLayer(L) ? L : `COL_${blockName}`) : L;

                    const block = blks ? blks[ent.name] : null;
                    if (block && block.entities) {
                        collect(block.entities, blks, effectiveLayer, newStack);
                    }
                } else {
                    // クローンエンティティの作成
                    const e = JSON.parse(JSON.stringify(ent));
                    e.layer = L;

                    // 積層された全変換行列を順に適用
                    transformStack.forEach(tf => {
                        if (e.position) e.position = transformPoint(e.position, tf);
                        if (e.startPoint) e.startPoint = transformPoint(e.startPoint, tf);
                        if (e.insertionPoint) e.insertionPoint = transformPoint(e.insertionPoint, tf);
                        if (e.center) e.center = transformPoint(e.center, tf);
                        if (e.start) e.start = transformPoint(e.start, tf);
                        if (e.end) e.end = transformPoint(e.end, tf);
                        if (e.vertices && Array.isArray(e.vertices)) {
                            e.vertices = e.vertices.map(v => transformPoint(v, tf));
                        }
                    });

                    // 通り芯原点差分 (shiftX, shiftY) のシフト適用
                    if (shiftX !== 0 || shiftY !== 0) {
                        if (e.position) e.position = applyShift(e.position);
                        if (e.startPoint) e.startPoint = applyShift(e.startPoint);
                        if (e.insertionPoint) e.insertionPoint = applyShift(e.insertionPoint);
                        if (e.center) e.center = applyShift(e.center);
                        if (e.start) e.start = applyShift(e.start);
                        if (e.end) e.end = applyShift(e.end);
                        if (e.vertices && Array.isArray(e.vertices)) {
                            e.vertices = e.vertices.map(v => applyShift(v));
                        }
                    }

                    const normL = L.normalize('NFKC').toUpperCase().trim();
                    let isGrid = false;
                    let isPillar = false;
                    let isBack = false;
                    let isRoof = false;

                    let isBack1F = false, isBack2F = false, isRoof1F = false, isRoof2F = false, isCol1F = false, isCol2F = false;

                    const lm = (typeof layerMapping !== 'undefined' && layerMapping) ? layerMapping : (state.layerMapping || null);
                    if (lm) {
                        const normMap = (v) => (v || "").normalize('NFKC').toUpperCase().trim();
                        const gridL  = normMap(lm.gridLayer);
                        const col1L  = normMap(lm.col1FLayer);
                        const col2L  = normMap(lm.col2FLayer);
                        const back1L = normMap(lm.back1FLayer);
                        const back2L = normMap(lm.back2FLayer);
                        const roof1L = normMap(lm.roof1FLayer);
                        const roof2L = normMap(lm.roof2FLayer);

                        if (gridL && normL === gridL) isGrid = true;
                        else if ((col1L && normL === col1L) || (col2L && normL === col2L)) isPillar = true;
                        else if ((back1L && normL === back1L) || (back2L && normL === back2L)) isBack = true;
                        else if ((roof1L && normL === roof1L) || (roof2L && normL === roof2L)) isRoof = true;

                        isBack1F = (back1L && normL === back1L) || normL.startsWith('1F_BACK') || normL.startsWith('1_BACK');
                        isBack2F = (back2L && normL === back2L) || normL.startsWith('2F_BACK') || normL.startsWith('2_BACK');
                        isRoof1F = (roof1L && normL === roof1L) || normL.includes('1F_R') || normL.includes('1R');
                        isRoof2F = (roof2L && normL === roof2L) || normL.includes('2F_R') || normL.includes('2R') || normL.includes('RF');
                        isCol1F  = (col1L && normL === col1L);
                        isCol2F  = (col2L && normL === col2L);
                    } else {
                        isBack = isBackLayer(L);
                        isPillar = isPillarLayer(L);
                        isGrid = isGridLayer(L);
                        isRoof = isRoofLayer(L);

                        isBack1F = normL.includes('1F_BACK') || normL.includes('1_BACK');
                        isBack2F = normL.includes('2F_BACK') || normL.includes('2_BACK');
                        isRoof1F = normL.includes('1F_R') || normL.includes('1R');
                        isRoof2F = normL.includes('2F_R') || normL.includes('2R') || normL.includes('RF');
                    }

                    // 階指定オプションの決定 (layerMappingからの判別を最優先)
                    let floor = 'ALL';
                    if (isRoof1F) floor = '1R';
                    else if (isRoof2F) floor = '2R';
                    if (isPillar && !isRoof && !isBack && !isGrid) {
                        const f = isCol2F ? '2F' : (isCol1F ? '1F' : (floor === 'ALL' ? (normL.includes('2F') ? '2F' : '1F') : floor));
                        let px = 0, py = 0, found = false;

                        // 1. 点 (POINT)
                        if (e.type === 'POINT') {
                            const pos = e.position || { x: e.x, y: e.y };
                            px = pos.x; py = pos.y; found = true;
                        } 
                        // 2. 円 (CIRCLE)
                        else if (e.type === 'CIRCLE' && (e.radius || 0) < 500) {
                            px = e.center.x; py = e.center.y; found = true;
                            e.floor = f;
                            newBgLines.push(e);
                        } 
                        // 3. 四角形 (LWPOLYLINE / POLYLINE - 4頂点矩形)
                        else if (['LWPOLYLINE', 'POLYLINE'].includes(e.type) && e.vertices && e.vertices.length > 0) {
                            const xs = e.vertices.map(v => v.x);
                            const ys = e.vertices.map(v => v.y);
                            const minX = Math.min(...xs), maxX = Math.max(...xs);
                            const minY = Math.min(...ys), maxY = Math.max(...ys);
                            const w = maxX - minX, h = maxY - minY;

                            // 木造柱の一般的なサイズ範囲（40mm〜450mm、正方形・長方形柱）
                            if (w >= 40 && w <= 450 && h >= 40 && h <= 450) {
                                px = (minX + maxX) / 2;
                                py = (minY + maxY) / 2;
                                found = true;
                            } else {
                                px = xs.reduce((s, v) => s + v, 0) / xs.length;
                                py = ys.reduce((s, v) => s + v, 0) / ys.length;
                                found = true;
                            }
                            e.floor = f;
                            newBgLines.push(e);
                        } 
                        // 4. 四角形内のバツ印線 (LINE 対角線)
                        else if (e.type === 'LINE') {
                            const v1 = e.start || (e.vertices ? e.vertices[0] : null);
                            const v2 = e.end || (e.vertices ? e.vertices[1] : null);
                            if (v1 && v2) {
                                px = (v1.x + v2.x) / 2;
                                py = (v1.y + v2.y) / 2;
                                found = true;
                                e.vertices = [{ x: v1.x, y: v1.y }, { x: v2.x, y: v2.y }];
                                e.floor = f;
                                newBgLines.push(e);
                            }
                        }

                        if (found) {
                            pillars.push({ id: `P${pIdCounter++}`, x: roundCoord(px), y: roundCoord(py), floor: f, layer: L });
                        }
                    } else if (isGrid) {
                        e.isGridLine = true; e.floor = 'ALL';
                        if (e.type === 'LINE') {
                            if (e.start && e.end) e.vertices = [{ x: e.start.x, y: e.start.y }, { x: e.end.x, y: e.end.y }];
                            newBgLines.push(e);
                        } else if (['CIRCLE', 'ARC'].includes(e.type)) {
                            if (e.center) {
                                newBubbles.push({ x: e.center.x, y: e.center.y, r: e.radius || 0, floor: 'ALL', layer: L });
                            }
                            newBgLines.push(e);
                        } else if (['TEXT', 'MTEXT'].includes(e.type)) {
                            const pos = e.startPoint || e.position || e.insertionPoint || {};
                            newBgTexts.push({ text: e.text || e.string || "", x: pos.x || 0, y: pos.y || 0, layer: L, floor: 'ALL', isGridText: true });
                        } else if (['LWPOLYLINE', 'POLYLINE'].includes(e.type)) {
                            newBgLines.push(e);
                        }
                    } else {
                        // 通り芯・柱・屋根として選ばれていないすべての未割り当てCAD要素（畳、記号、部屋、仕上、データ001等）は「背景図面 (1F_BACK / 2F_BACK)」に一括集約
                        const backGroupLayer = (floor === '2F' || floor === '2R') ? '2F_BACK' : '1F_BACK';
                        e.layer = backGroupLayer;
                        e.floor = (floor === 'ALL') ? '1F' : floor; 
                        e.isUnderlay = true;
                        
                        if (e.type === 'LINE') {
                            if (e.start && e.end) e.vertices = [{ x: e.start.x, y: e.start.y }, { x: e.end.x, y: e.end.y }];
                            newBgLines.push(e);
                        } else if (['LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'ARC'].includes(e.type)) {
                            newBgLines.push(e);
                        } else if (['TEXT', 'MTEXT'].includes(e.type)) {
                            const pos = e.startPoint || e.position || e.insertionPoint || {};
                            newBgTexts.push({ text: e.text || e.string || "", x: pos.x || 0, y: pos.y || 0, layer: backGroupLayer, floor: e.floor });
                        }
                    }
                }
            });
        };

        collect(entities, blocks || {});

        // 通り芯線 (isGridLine) から垂直・水平軸の座標を収集
        const gridXs = [];
        const gridYs = [];
        const addGridSegment = (p1, p2) => {
            if (!p1 || !p2) return;
            let dx = Math.abs(p1.x - p2.x), dy = Math.abs(p1.y - p2.y);
            let len = Math.hypot(dx, dy);
            if (len > 500) {
                if (dx < 15) gridXs.push((p1.x + p2.x) / 2);
                if (dy < 15) gridYs.push((p1.y + p2.y) / 2);
            }
        };

        newBgLines.forEach(l => {
            if (l.isGridLine) {
                if (l.type === 'LINE' && l.vertices && l.vertices.length === 2) {
                    addGridSegment(l.vertices[0], l.vertices[1]);
                } else if (['LWPOLYLINE', 'POLYLINE'].includes(l.type) && l.vertices && l.vertices.length >= 2) {
                    for (let i = 0; i < l.vertices.length - 1; i++) {
                        addGridSegment(l.vertices[i], l.vertices[i + 1]);
                    }
                }
            }
        });

        const uniquePillars = [];
        const pillarGroups = [];

        // 柱枠・バツ印対角線を構成する複数要素の中心点 (150mm以内) をクラスタリング
        pillars.forEach(p => {
            let group = pillarGroups.find(g => g.floor === p.floor && g.points.some(pt => Math.abs(pt.x - p.x) <= 150 && Math.abs(pt.y - p.y) <= 150));
            if (!group) {
                group = { floor: p.floor, layer: p.layer, points: [] };
                pillarGroups.push(group);
            }
            group.points.push(p);
        });

        // 柱の「通り芯交点判定アルゴリズム」 (本システムの核心)
        const SNAP_TOL = 350; // 通り芯交点スナップ許容距離 (mm)

        pillarGroups.forEach(g => {
            const xs = g.points.map(pt => pt.x);
            const ys = g.points.map(pt => pt.y);
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            const minY = Math.min(...ys), maxY = Math.max(...ys);
            let cx = roundCoord((minX + maxX) / 2);
            let cy = roundCoord((minY + maxY) / 2);

            // 通り芯（GRID/GLID）交点との距離判定
            let nearestX = cx, minDx = Infinity;
            gridXs.forEach(gx => {
                let d = Math.abs(gx - cx);
                if (d < minDx) { minDx = d; nearestX = gx; }
            });

            let nearestY = cy, minDy = Infinity;
            gridYs.forEach(gy => {
                let d = Math.abs(gy - cy);
                if (d < minDy) { minDy = d; nearestY = gy; }
            });

            // 通り芯交点が近くに存在する場合は交点へ厳密吸着
            if (minDx <= SNAP_TOL) cx = roundCoord(nearestX);
            if (minDy <= SNAP_TOL) cy = roundCoord(nearestY);

            // 通り芯交点または有効位置にある柱を確定
            uniquePillars.push({ id: `P${pIdCounter++}`, x: cx, y: cy, floor: g.floor, layer: g.layer });
        });

        return { newBgLines, newBgTexts, newBubbles, pillars: uniquePillars, areaLines, detectedOrigin: currentOrigin, shiftApplied: { x: shiftX, y: shiftY } };
    }
};
