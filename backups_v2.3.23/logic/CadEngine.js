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
     * Map DXF entities to application background data
     */
    mapEntitiesToBackground: function(entities, blocks, state) {
        const newBgLines = [];
        const newBgTexts = [];
        const newBubbles = [];

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
                    if (L.includes('GRID')) {
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
        return { newBgLines, newBgTexts, newBubbles };
    }
};
