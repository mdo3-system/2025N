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

    mapEntitiesToBackground: function(entities, blocks, state) {
        const newBgLines = [];
        const newBgTexts = [];
        const newBubbles = [];
        const pillars = [];
        const areaLines = [];
        let pIdCounter = Date.now();

        // 精密なモジュール丸め（極端な強制補正を行わず、0.1mm単位の四捨五入に留める）
        const roundCoord = (val) => Math.round(val * 10) / 10;

        // 座標変換ヘルパー (INSERTブロックの移動・回転・拡大縮小を変換)
        const transformPoint = (pt, transform) => {
            if (!pt) return { x: 0, y: 0 };
            let x = pt.x || 0;
            let y = pt.y || 0;
            if (!transform) return { x, y };

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
            return { x, y };
        };

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

                    const isGrid = /(GRID|GLID)/i.test(L);

                    if (L.includes('COL')) {
                        const f = (L.includes('2F') || L.includes('RF')) ? '2F' : '1F';
                        let px = 0, py = 0, found = false;

                        if (e.type === 'POINT') {
                            const pos = e.position || { x: e.x, y: e.y };
                            px = pos.x; py = pos.y; found = true;
                        } else if (e.type === 'CIRCLE' && (e.radius || 0) < 500) {
                            px = e.center.x; py = e.center.y; found = true;
                            newBgLines.push(e);
                        } else if (['LWPOLYLINE', 'POLYLINE'].includes(e.type) && e.vertices && e.vertices.length > 0) {
                            px = e.vertices.reduce((s, v) => s + v.x, 0) / e.vertices.length;
                            py = e.vertices.reduce((s, v) => s + v.y, 0) / e.vertices.length;
                            found = true;
                            newBgLines.push(e);
                        } else if (e.type === 'LINE' && e.start && e.end) {
                            px = (e.start.x + e.end.x) / 2;
                            py = (e.start.y + e.end.y) / 2;
                            found = true;
                            e.vertices = [{ x: e.start.x, y: e.start.y }, { x: e.end.x, y: e.end.y }];
                            newBgLines.push(e);
                        }

                        if (found) {
                            pillars.push({ id: `P${pIdCounter++}`, x: roundCoord(px), y: roundCoord(py), floor: f, layer: L });
                        }
                    } else if (L.includes('AREA')) {
                        let f = L.includes('2F') || L.includes('RF') ? (L.includes('RF') ? 'RF' : '2F') : '1F';
                        if (['LWPOLYLINE', 'POLYLINE'].includes(e.type) && e.vertices && e.vertices.length >= 3) {
                            e.vertices.forEach(v => { v.x = roundCoord(v.x); v.y = roundCoord(v.y); });
                            areaLines.push({ ...e, layer: L, floor: f, id: Date.now() + Math.random() });
                        } else {
                            if (e.type === 'LINE' && e.start && e.end) {
                                e.vertices = [{ x: e.start.x, y: e.start.y }, { x: e.end.x, y: e.end.y }];
                            }
                            newBgLines.push(e);
                        }
                    } else if (isGrid) {
                        e.isGridLine = true; e.floor = 'ALL';
                        if (e.type === 'LINE') {
                            if (e.start && e.end) e.vertices = [{ x: e.start.x, y: e.start.y }, { x: e.end.x, y: e.end.y }];
                            newBgLines.push(e);
                        } else if (['CIRCLE', 'ARC'].includes(e.type)) {
                            newBubbles.push({ x: e.center.x, y: e.center.y, r: e.radius, floor: 'ALL', layer: L });
                            newBgLines.push(e);
                        } else if (['TEXT', 'MTEXT'].includes(e.type)) {
                            const pos = e.startPoint || e.position || e.insertionPoint || {};
                            newBgTexts.push({ text: e.text || e.string || "", x: pos.x || 0, y: pos.y || 0, layer: L, floor: 'ALL', isGridText: true });
                        } else if (['LWPOLYLINE', 'POLYLINE'].includes(e.type)) {
                            newBgLines.push(e);
                        }
                    } else {
                        let f = L.includes('1F') ? '1F' : (L.includes('2F') || L.includes('RF') ? '2F' : 'ALL');
                        e.floor = f; e.isUnderlay = true;
                        if (e.type === 'LINE') {
                            if (e.start && e.end) e.vertices = [{ x: e.start.x, y: e.start.y }, { x: e.end.x, y: e.end.y }];
                            newBgLines.push(e);
                        } else if (['LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'ARC'].includes(e.type)) {
                            newBgLines.push(e);
                        } else if (['TEXT', 'MTEXT'].includes(e.type)) {
                            const pos = e.startPoint || e.position || e.insertionPoint || {};
                            newBgTexts.push({ text: e.text || e.string || "", x: pos.x || 0, y: pos.y || 0, floor: f, layer: L });
                        }
                    }
                }
            });
        };

        collect(entities, blocks || {});
        return { newBgLines, newBgTexts, newBubbles, pillars, areaLines };
    }
};
