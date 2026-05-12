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

        const snapToModule = (val) => {
            const mod = 455;
            const nearest = Math.round(val / mod) * mod;
            if (Math.abs(val - nearest) < 10) return nearest;
            return Math.round(val);
        };

        const collect = (ents, blks) => {
            ents.forEach(ent => {
                let L = (ent.layer || "").toUpperCase().trim();
                if (L === 'AREA_D_X') L = 'AREA_X';
                if (L === 'AREA_D_Y') L = 'AREA_Y';
                ent.layer = L;

                if (ent.type === 'INSERT') {
                    const block = blks ? blks[ent.name] : null;
                    if (block && block.entities) collect(block.entities, blks);
                } else {
                    if (L.includes('COL')) {
                        const f = (L.includes('2F') || L.includes('RF')) ? '2F' : '1F';
                        if (ent.type === 'POINT') {
                            const px = snapToModule(ent.position ? ent.position.x : ent.x);
                            const py = snapToModule(ent.position ? ent.position.y : ent.y);
                            pillars.push({ id: `P${pIdCounter++}`, x: px, y: py, floor: f, layer: L });
                        } else if (ent.type === 'CIRCLE' && ent.radius < 500) {
                            pillars.push({ id: `P${pIdCounter++}`, x: snapToModule(ent.center.x), y: snapToModule(ent.center.y), floor: f, layer: L });
                            newBgLines.push(ent);
                        } else if (['LWPOLYLINE', 'POLYLINE'].includes(ent.type) && ent.vertices && ent.vertices.length > 0) {
                            let px = ent.vertices.reduce((s, v) => s + v.x, 0) / ent.vertices.length;
                            let py = ent.vertices.reduce((s, v) => s + v.y, 0) / ent.vertices.length;
                            pillars.push({ id: `P${pIdCounter++}`, x: snapToModule(px), y: snapToModule(py), floor: f, layer: L });
                            newBgLines.push(ent);
                        } else if (ent.type === 'LINE' && ent.start && ent.end) {
                            let px = (ent.start.x + ent.end.x) / 2;
                            let py = (ent.start.y + ent.end.y) / 2;
                            pillars.push({ id: `P${pIdCounter++}`, x: snapToModule(px), y: snapToModule(py), floor: f, layer: L });
                            newBgLines.push(ent);
                        }
                    } else if (L.includes('AREA')) {
                        let f = '1F';
                        if (L.includes('2F') || L.includes('RF')) f = (L.includes('RF') ? 'RF' : '2F');
                        if (['LWPOLYLINE', 'POLYLINE'].includes(ent.type) && ent.vertices && ent.closed) {
                            // 面積ポリゴンの頂点も丸める
                            ent.vertices.forEach(v => { v.x = snapToModule(v.x); v.y = snapToModule(v.y); });
                            areaLines.push({ ...ent, layer: L, floor: f, id: Date.now() + Math.random() });
                        } else {
                            // 面積ポリゴンとして認識されない不正な線分のみ、背景線として登録
                            newBgLines.push(ent);
                        }
                    } else if (L.includes('GRID')) {
                        ent.isGridLine = true; ent.floor = 'ALL';
                        if (ent.type === 'LINE') {
                            if (ent.start && ent.end) ent.vertices = [{x: ent.start.x, y: ent.start.y}, {x: ent.end.x, y: ent.end.y}];
                            newBgLines.push(ent);
                        } else if (['CIRCLE', 'ARC'].includes(ent.type)) {
                            newBubbles.push({x: ent.center.x, y: ent.center.y, r: ent.radius, floor: 'ALL', layer: L});
                            newBgLines.push(ent);
                        } else if (['TEXT', 'MTEXT'].includes(ent.type)) {
                            const pos = ent.startPoint || ent.position || {};
                            newBgTexts.push({text: ent.text || ent.string || "", x: pos.x || 0, y: pos.y || 0, layer: L, floor: 'ALL', isGridText: true});
                        }
                    } else {
                        let f = L.includes('1F') ? '1F' : (L.includes('2F') || L.includes('RF') ? '2F' : 'ALL');
                        ent.floor = f; ent.isUnderlay = true;
                        if (ent.type === 'LINE') {
                            if (ent.start && ent.end) ent.vertices = [{x: ent.start.x, y: ent.start.y}, {x: ent.end.x, y: ent.end.y}];
                            newBgLines.push(ent);
                        } else if (['LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'ARC'].includes(ent.type)) {
                            newBgLines.push(ent);
                        } else if (['TEXT', 'MTEXT'].includes(ent.type)) {
                            const pos = ent.startPoint || ent.position || {};
                            newBgTexts.push({text: ent.text || ent.string || "", x: pos.x || 0, y: pos.y || 0, floor: f, layer: L});
                        }
                    }
                }
            });
        };

        collect(entities, blocks || {});
        return { newBgLines, newBgTexts, newBubbles, pillars, areaLines };
    }
};
