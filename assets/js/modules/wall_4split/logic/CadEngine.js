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
    detectGridOrigin: function(entities, blocks) {
        let gridLines = [];
        const isGridLayer = (l) => /(GRID|GLID|通り芯|軸線|軸|芯|GL)/i.test(l);
        const isPillarLayer = (l) => /(COL|COLUMN|柱|柱心)/i.test(l);

        const collectGrids = (ents, blks, transformStack = []) => {
            ents.forEach(ent => {
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
                    gridLines.push(ent);
                }
            });
        };
        collectGrids(entities || [], blocks || {});

        let minX = Infinity, minY = Infinity;
        let xCoords = [], yCoords = [];

        gridLines.forEach(ent => {
            if (ent.type === 'LINE' && ent.start && ent.end) {
                xCoords.push(ent.start.x, ent.end.x);
                yCoords.push(ent.start.y, ent.end.y);
            } else if (ent.vertices && Array.isArray(ent.vertices)) {
                ent.vertices.forEach(v => { xCoords.push(v.x); yCoords.push(v.y); });
            } else if (ent.center) {
                xCoords.push(ent.center.x);
                yCoords.push(ent.center.y);
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

        const isGridLayer = (l) => /(GRID|GLID|通り芯|軸線|軸|芯|GL)/i.test(l);
        const isPillarLayer = (l) => /(COL|COLUMN|柱|柱心)/i.test(l);
        const isAreaLayer = (l) => /(AREA|面積|求積)/i.test(l);

        const collect = (ents, blks, parentLayer = "", transformStack = []) => {
            ents.forEach(ent => {
                let L = (ent.layer || "").toUpperCase().trim();
                if (!L || L === "0") L = (parentLayer || "0").toUpperCase().trim();
                if (L === 'AREA_D_X') L = 'AREA_X';
                if (L === 'AREA_D_Y') L = 'AREA_Y';

                if (ent.type === 'INSERT') {
                    const block = blks ? blks[ent.name] : null;
                    if (block && block.entities) {
                        const currentTransform = {
                            position: ent.position || { x: ent.x || 0, y: ent.y || 0 },
                            rotation: ent.rotation || 0,
                            xScale: ent.xScale !== undefined ? ent.xScale : (ent.scale ? ent.scale.x : 1),
                            yScale: ent.yScale !== undefined ? ent.yScale : (ent.scale ? ent.scale.y : 1)
                        };
                        collect(block.entities, blks, L, [...transformStack, currentTransform]);
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

                    const isGrid = isGridLayer(L);
                    const isPillar = isPillarLayer(L);
                    const isArea = isAreaLayer(L);

                    // 階指定オプションの決定
                    let floor = targetFloor;
                    if (!floor || floor === 'ALL') {
                        floor = L.includes('2F') || L.includes('RF') ? (L.includes('RF') ? 'RF' : '2F') : (L.includes('1F') ? '1F' : 'ALL');
                    }

                    if (isPillar) {
                        const f = targetFloor || ((L.includes('2F') || L.includes('RF')) ? '2F' : '1F');
                        let px = 0, py = 0, found = false;

                        if (e.type === 'POINT') {
                            const pos = e.position || { x: e.x, y: e.y };
                            px = pos.x; py = pos.y; found = true;
                        } else if (e.type === 'CIRCLE' && (e.radius || 0) < 500) {
                            px = e.center.x; py = e.center.y; found = true;
                            e.floor = f;
                            newBgLines.push(e);
                        } else if (['LWPOLYLINE', 'POLYLINE'].includes(e.type) && e.vertices && e.vertices.length > 0) {
                            px = e.vertices.reduce((s, v) => s + v.x, 0) / e.vertices.length;
                            py = e.vertices.reduce((s, v) => s + v.y, 0) / e.vertices.length;
                            found = true;
                            e.floor = f;
                            newBgLines.push(e);
                        } else if (e.type === 'LINE' && e.start && e.end) {
                            px = (e.start.x + e.end.x) / 2;
                            py = (e.start.y + e.end.y) / 2;
                            found = true;
                            e.vertices = [{ x: e.start.x, y: e.start.y }, { x: e.end.x, y: e.end.y }];
                            e.floor = f;
                            newBgLines.push(e);
                        }

                        if (found) {
                            pillars.push({ id: `P${pIdCounter++}`, x: roundCoord(px), y: roundCoord(py), floor: f, layer: L });
                        }
                    } else if (isArea) {
                        let f = targetFloor || (L.includes('2F') || L.includes('RF') ? (L.includes('RF') ? 'RF' : '2F') : '1F');
                        if (['LWPOLYLINE', 'POLYLINE'].includes(e.type) && e.vertices && e.vertices.length >= 3) {
                            e.vertices.forEach(v => { v.x = roundCoord(v.x); v.y = roundCoord(v.y); });
                            areaLines.push({ ...e, layer: L, floor: f, id: Date.now() + Math.random() });
                        } else {
                            if (e.type === 'LINE' && e.start && e.end) {
                                e.vertices = [{ x: e.start.x, y: e.start.y }, { x: e.end.x, y: e.end.y }];
                            }
                            e.floor = f;
                            newBgLines.push(e);
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
                        let f = targetFloor || (L.includes('1F') ? '1F' : (L.includes('2F') || L.includes('RF') ? '2F' : 'ALL'));
                        e.floor = f; e.isUnderlay = true;
                        if (e.type === 'LINE') {
                            if (e.start && e.end) e.vertices = [{ x: e.start.x, y: e.start.y }, { x: e.end.x, y: e.end.y }];
                            newBgLines.push(e);
                        } else if (['LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'ARC'].includes(e.type)) {
                            newBgLines.push(e);
                        } else if (['TEXT', 'MTEXT'].includes(e.type)) {
                            const pos = e.startPoint || e.position || e.insertionPoint || {};
                            newBgTexts.push({ text: e.text || e.string || "", x: pos.x || 0, y: pos.y || 0, layer: L, floor: f });
                        }
                    }
                }
            });
        };

        collect(entities, blocks || {});
        return { newBgLines, newBgTexts, newBubbles, pillars, areaLines, detectedOrigin: currentOrigin, shiftApplied: { x: shiftX, y: shiftY } };
    }
};
