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
        const isGridLayer = (l) => /(GRID|GLID|通り芯|軸線|軸|芯|GL)/i.test(l);
        const isPillarLayer = (l) => /(COL|COLUMN|柱|柱心)/i.test(l);

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

        const isGridLayer = (l, name = "") => /(GRID|GLID|通り芯|軸線|軸|芯|GL)/i.test(l) || /(GRID|GLID|通り芯)/i.test(name);
        const isPillarLayer = (l, name = "") => /(COL|COLUMN|柱|柱心|HASHIRA|HASIRA|角柱|管柱|通し柱|S-COL|H-COL|C105|C120)/i.test(l) || /(COL|COLUMN|柱|柱心|角柱|管柱|通し柱|HASHIRA|HASIRA|C105|C120)/i.test(name);
        const isAreaLayer = (l, name = "") => /(AREA|面積|求積)/i.test(l) || /(AREA|面積)/i.test(name);

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
                            const xs = e.vertices.map(v => v.x);
                            const ys = e.vertices.map(v => v.y);
                            const minX = Math.min(...xs), maxX = Math.max(...xs);
                            const minY = Math.min(...ys), maxY = Math.max(...ys);
                            const w = maxX - minX, h = maxY - minY;

                            // 木造柱の一般的なサイズ範囲（40mm〜450mm、正方形・□表記の柱）
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
                        } else if (e.type === 'LINE') {
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

        const uniquePillars = [];
        const pillarGroups = [];

        // 柱枠を構成する複数のLINE要素の中心点 (150mm以内) をクラスタリングして真の中心を算出
        pillars.forEach(p => {
            let group = pillarGroups.find(g => g.floor === p.floor && g.points.some(pt => Math.abs(pt.x - p.x) <= 150 && Math.abs(pt.y - p.y) <= 150));
            if (!group) {
                group = { floor: p.floor, layer: p.layer, points: [] };
                pillarGroups.push(group);
            }
            group.points.push(p);
        });

        pillarGroups.forEach(g => {
            const xs = g.points.map(pt => pt.x);
            const ys = g.points.map(pt => pt.y);
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            const minY = Math.min(...ys), maxY = Math.max(...ys);
            const cx = roundCoord((minX + maxX) / 2);
            const cy = roundCoord((minY + maxY) / 2);
            uniquePillars.push({ id: `P${pIdCounter++}`, x: cx, y: cy, floor: g.floor, layer: g.layer });
        });

        return { newBgLines, newBgTexts, newBubbles, pillars: uniquePillars, areaLines, detectedOrigin: currentOrigin, shiftApplied: { x: shiftX, y: shiftY } };
    }
};
