/**
 * logic/DocumentEngine.js - Report Data Preparation Engine
 * v2.2.0 Refactoring
 */

window.DocumentEngine = {
    /**
     * Filter entities based on layer target/background rules
     */
    filterEntities: function(entities, targetLayers, bgLayers, isPrint) {
        let entsToDraw = [];
        entities.forEach(ent => {
            if (!isPrint && window.AppState.layerVisibility[ent.layer] === false) return;

            let L = (ent.layer || "").normalize("NFKC").toUpperCase().trim();
            let isTarget = targetLayers.some(tl => L.includes(tl.toUpperCase().trim()));
            let isBg = false;
            
            if (isPrint) {
                isBg = bgLayers.some(bl => L.includes(bl.toUpperCase().trim()));
            } else {
                isBg = L.includes('BG_') || bgLayers.some(bl => L.includes(bl.toUpperCase().trim()));
            }

            if (isTarget || isBg) {
                entsToDraw.push({ ...ent, isBg: isBg, isTarget: isTarget });
            }
        });
        return entsToDraw;
    },

    /**
     * Calculate Bounding Box for a set of entities
     */
    calculateBoundingBox: function(entities, floorStr, areaLines) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        entities.forEach(ent => {
            if (!ent.isTarget) return;

            if (ent.type === 'LINE' && ent.vertices) {
                ent.vertices.forEach(v => {
                    if (v.x != null && !isNaN(v.x)) {
                        if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
                        if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
                    }
                });
            } else if (['LWPOLYLINE', 'POLYLINE'].includes(ent.type) && ent.vertices) {
                ent.vertices.forEach(v => {
                    if (v.x != null && !isNaN(v.x)) {
                        if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
                        if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
                    }
                });
            } else if (ent.type === 'ARC' || ent.type === 'CIRCLE') {
                if (ent.center.x - ent.radius < minX) minX = ent.center.x - ent.radius;
                if (ent.center.x + ent.radius > maxX) maxX = ent.center.x + ent.radius;
                if (ent.center.y - ent.radius < minY) minY = ent.center.y - ent.radius;
                if (ent.center.y + ent.radius > maxY) maxY = ent.center.y + ent.radius;
            } else if (['TEXT', 'MTEXT'].includes(ent.type)) {
                const pos = ent.startPoint || ent.position || ent.insertionPoint || ent.insert || {};
                const tx = pos.x ?? 0, ty = pos.y ?? 0;
                if (tx != null && !isNaN(tx)) {
                    if (tx < minX) minX = tx; if (tx > maxX) maxX = tx;
                    if (ty < minY) minY = ty; if (ty > maxY) maxY = ty;
                }
            }
        });

        // Consider area lines
        if (floorStr) {
            areaLines.filter(a => a.floor === floorStr && a.vertices).forEach(a => {
                a.vertices.forEach(v => {
                    if (v.x != null && !isNaN(v.x)) {
                        if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
                        if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
                    }
                });
            });
        }

        return { minX, minY, maxX, maxY };
    },

    /**
     * Generate Full Structural Report (Bridge to PDF Engine)
     */
    generateFullReport: function() {
        if (typeof generateDoc === 'function') {
            return generateDoc();
        } else {
            console.error("Document Engine Error: generateDoc (legacy) is not defined.");
            alert("帳票生成エンジン(generateDoc)が見つかりません。");
        }
    }
};
