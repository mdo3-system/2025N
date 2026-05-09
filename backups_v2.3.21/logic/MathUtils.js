/**
 * logic/MathUtils.js - Geometric and Structural Utility Functions
 * v2.3.15 Refactoring
 */

window.MathUtils = {
    /**
     * Get numeric value from DOM element
     */
    getVal: function(id) {
        const el = document.getElementById(id);
        if (!el) return 0;
        const val = el.value;
        // Legacy: Support for brace IDs starting with 'b'
        if (val && typeof val === 'string' && val.startsWith('b')) {
            return (typeof window.getBraceSpec === 'function') ? window.getBraceSpec(val).val : 0;
        }
        return parseFloat(val) || 0;
    },

    /**
     * Get string value from DOM element
     */
    getStr: function(id) {
        const el = document.getElementById(id);
        return el ? el.value : '';
    },

    /**
     * Format a numeric value for display
     */
    formatValue: function(v, d = 3) {
        return (v != null && isFinite(v)) ? Number(v).toFixed(d) : '—';
    },

    /**
     * Snap a point to the nearest grid intersection or point
     */
    snapToGrid: function(point, gridX, gridY, tolerance) {
        let snapped = { x: point.x, y: point.y };
        let minDX = tolerance, minDY = tolerance;

        gridX.forEach(gx => {
            let dx = Math.abs(point.x - gx);
            if (dx < minDX) { minDX = dx; snapped.x = gx; }
        });
        gridY.forEach(gy => {
            let dy = Math.abs(point.y - gy);
            if (dy < minDY) { minDY = dy; snapped.y = gy; }
        });

        return snapped;
    },

    /**
     * Check if a point is inside a polygon
     */
    isPointInPolygon: function(p, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            if (((poly[i].y > p.y) !== (poly[j].y > p.y)) && 
                (p.x < (poly[j].x - poly[i].x) * (p.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)) {
                inside = !inside;
            }
        }
        return inside;
    },

    /**
     * Calculate Polygon Centroid and Area
     */
    polygonCentroid: function(pts) {
        let cx = 0, cy = 0, area = 0, n = pts.length;
        if (n < 3) return null;
        for (let i = 0; i < n; i++) {
            let j = (i + 1) % n;
            let cross = pts[i].x * pts[j].y - pts[j].x * pts[i].y;
            area += cross;
            cx += (pts[i].x + pts[j].x) * cross;
            cy += (pts[i].y + pts[j].y) * cross;
        }
        area /= 2;
        if (area === 0) return { x: pts[0].x, y: pts[0].y, area: 0 };
        return { x: cx / (6 * area), y: cy / (6 * area), area: Math.abs(area) };
    },

    signedPolygonArea: function(poly) {
        if (!poly || poly.length < 3) return 0;
        let a = 0;
        for (let i = 0; i < poly.length; i++) {
            let j = (i + 1) % poly.length;
            a += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
        }
        return a / 2;
    },

    polygonArea: function(poly) {
        return Math.abs(this.signedPolygonArea(poly));
    },

    ensureCCW: function(poly) {
        if (this.signedPolygonArea(poly) < 0) {
            poly.reverse();
        }
    },

    clipPolygonByHalfPlane: function(poly, A, B) {
        let mx = (A.x + B.x) / 2;
        let my = (A.y + B.y) / 2;
        let nx = B.x - A.x;
        let ny = B.y - A.y;

        let isInside = (p) => (p.x - mx) * nx + (p.y - my) * ny <= 1e-6;

        let intersect = (S, E) => {
            let num = (mx - S.x) * nx + (my - S.y) * ny;
            let den = (E.x - S.x) * nx + (E.y - S.y) * ny;
            let t = num / den;
            return { x: S.x + t * (E.x - S.x), y: S.y + t * (E.y - S.y) };
        };

        let outputList = [];
        if (poly.length === 0) return [];

        let S = poly[poly.length - 1];
        for (let i = 0; i < poly.length; i++) {
            let E = poly[i];
            if (isInside(E)) {
                if (!isInside(S)) outputList.push(intersect(S, E));
                outputList.push(E);
            } else if (isInside(S)) {
                outputList.push(intersect(S, E));
            }
            S = E;
        }
        return outputList;
    },

    clipByVoronoi: function(subjectPolygon, clipPolygon) {
        let outputList = subjectPolygon;
        for (let i = 0; i < clipPolygon.length; i++) {
            let cp1 = clipPolygon[i];
            let cp2 = clipPolygon[(i + 1) % clipPolygon.length];
            let inputList = outputList;
            outputList = [];
            if (inputList.length === 0) break;

            let S = inputList[inputList.length - 1];
            for (let j = 0; j < inputList.length; j++) {
                let E = inputList[j];
                let isInside = (p) => (cp2.x - cp1.x) * (p.y - cp1.y) - (cp2.y - cp1.y) * (p.x - cp1.x) >= -1e-6;

                let intersection = () => {
                    let A1 = cp2.y - cp1.y, B1 = cp1.x - cp2.x, C1 = A1 * cp1.x + B1 * cp1.y;
                    let A2 = E.y - S.y, B2 = S.x - E.x, C2 = A2 * S.x + B2 * S.y;
                    let det = A1 * B2 - A2 * B1;
                    if (Math.abs(det) < 1e-6) return { x: S.x, y: S.y };
                    return { x: (B2 * C1 - B1 * C2) / det, y: (A1 * C2 - A2 * C1) / det };
                };

                if (isInside(E)) {
                    if (!isInside(S)) outputList.push(intersection());
                    outputList.push(E);
                } else if (isInside(S)) {
                    outputList.push(intersection());
                }
                S = E;
            }
        }
        return outputList;
    },

    clipPolygonByRect: function(poly, minX, maxX, minY, maxY) {
        let result = poly;
        const clipEdge = (pts, edge, sign, val) => {
            let out = [];
            if (pts.length === 0) return out;
            let p1 = pts[pts.length - 1];
            let p1_in = (edge === 'x') ? (sign * p1.x >= sign * val) : (sign * p1.y >= sign * val);
            for (let i = 0; i < pts.length; i++) {
                let p2 = pts[i];
                let p2_in = (edge === 'x') ? (sign * p2.x >= sign * val) : (sign * p2.y >= sign * val);
                if (p1_in !== p2_in) {
                    let dx = p2.x - p1.x, dy = p2.y - p1.y;
                    let t = (edge === 'x') ? (val - p1.x) / dx : (val - p1.y) / dy;
                    out.push({ x: p1.x + t * dx, y: p1.y + t * dy });
                }
                if (p2_in) out.push(p2);
                p1 = p2; p1_in = p2_in;
            }
            return out;
        };
        result = clipEdge(result, 'x', 1, minX);
        result = clipEdge(result, 'x', -1, maxX);
        result = clipEdge(result, 'y', 1, minY);
        result = clipEdge(result, 'y', -1, maxY);
        return result;
    },

    clipPolygonStrict: function(poly, a, b, c) {
        const out = [];
        if (!poly || poly.length === 0) return out;
        const isInside = (p) => a * p.x + b * p.y + c <= 1e-6;
        const intersect = (p1, p2) => {
            const d1 = a * p1.x + b * p1.y + c;
            const d2 = a * p2.x + b * p2.y + c;
            const t = d1 / (d1 - d2);
            return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
        };
        for (let i = 0; i < poly.length; i++) {
            const p1 = poly[i === 0 ? poly.length - 1 : i - 1];
            const p2 = poly[i];
            if (isInside(p2)) {
                if (!isInside(p1)) out.push(intersect(p1, p2));
                out.push(p2);
            } else if (isInside(p1)) {
                out.push(intersect(p1, p2));
            }
        }
        return out;
    },

    dedupPolygon: function(poly, eps = 5) {
        if (!poly || poly.length < 2) return poly;
        const out = [poly[0]];
        for (let i = 1; i < poly.length; i++) {
            const p1 = out[out.length - 1];
            const p2 = poly[i];
            if (Math.hypot(p1.x - p2.x, p1.y - p2.y) > eps) out.push(p2);
        }
        if (out.length > 2) {
            if (Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < eps) out.pop();
        }
        return out;
    },

    distToBeamLine: function(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay;
        const l2 = dx * dx + dy * dy;
        if (l2 === 0) return Math.hypot(px - ax, py - ay);
        let t = ((px - ax) * dx + (py - ay) * dy) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    },

    clipPolygonByPolygon: function(subject, clip) {
        let result = subject;
        for (let i = 0; i < clip.length; i++) {
            const p1 = clip[i], p2 = clip[(i + 1) % clip.length];
            const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
            if (L < 1e-6) continue;
            const nx = -dy / L, ny = dx / L, d = nx * p1.x + ny * p1.y;
            result = this.clipPolygonStrict(result, nx, ny, -d);
        }
        return result;
    }
};

// Global Aliases for backward compatibility
window.getVal = window.MathUtils.getVal;
window.getStr = window.MathUtils.getStr;
window.fw = window.MathUtils.formatValue;

// Structural Geometry Aliases
window.signedPolygonArea = window.MathUtils.signedPolygonArea;
window.polygonArea = window.MathUtils.polygonArea;
window.ensureCCW = window.MathUtils.ensureCCW;
window.clipPolygonByHalfPlane = window.MathUtils.clipPolygonByHalfPlane;
window.clipByVoronoi = window.MathUtils.clipByVoronoi;
window.clipPolygonByRect = window.MathUtils.clipPolygonByRect;
window.isPointInPolygon = window.MathUtils.isPointInPolygon;
window.distToBeamLine = window.MathUtils.distToBeamLine;

// Structural Specific Helpers
window.getPillarName = function(p, state) {
    const s = state || window.AppState;
    if (!p || !s) return "不明";
    const gx = s.gridXCoords || [], gy = s.gridYCoords || [];
    const gxn = s.gridXNames || [], gyn = s.gridYNames || [];
    let ix = -1, iy = -1;
    for (let i = 0; i < gx.length; i++) if (Math.abs(gx[i] - p.x) < 10) ix = i;
    for (let i = 0; i < gy.length; i++) if (Math.abs(gy[i] - p.y) < 10) iy = i;
    if (ix !== -1 && iy !== -1) return (gxn[ix] || '?') + (gyn[iy] || '?');
    return "位置不明";
};

window.getWallTotalVal = function(w) {
    if (!w) return 0;
    const s = window.AppState;
    const p1 = window.getWallSpec(w.outPanelId).val || w.outPanelVal || 0;
    const p2 = window.getWallSpec(w.inPanelId).val || w.inPanelVal || 0;
    const b = window.getBraceSpec(w.braceId).val || w.braceVal || 0;
    return p1 + p2 + b;
};

window.getWallSpec = function(id) {
    const list = window.AppState.getMasterWallList ? window.AppState.getMasterWallList() : [];
    return list.find(l => l.id === id) || { id: "opt0", val: 0, text: "なし" };
};

window.getBraceSpec = function(id) {
    const list = window.AppState.getMasterBraceList ? window.AppState.getMasterBraceList() : [];
    return list.find(l => l.id === id) || { id: "b0", val: 0, text: "なし" };
};

window.getWallSpecList = () => window.AppState.getMasterWallList ? window.AppState.getMasterWallList() : [];
window.getBraceSpecList = () => window.AppState.getMasterBraceList ? window.AppState.getMasterBraceList() : [];

// Hardware Alias
window.getHardwareList = () => (window.NValueEngine && window.NValueEngine.getHardwareList) ? window.NValueEngine.getHardwareList() : [];
