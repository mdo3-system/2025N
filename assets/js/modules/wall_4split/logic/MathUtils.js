/**
 * logic/MathUtils.js - Geometric and Structural Utility Functions
 * v2.3.25 Refactoring
 */

window.MathUtils = {
    /**
     * [v2.5.0] 指定された軸（通り芯名）に沿った1次元の射影位置（ローカル座標）を計算する関数を返す
     * 斜め軸（DA1等）の場合は、その斜めベクトル上への投影座標を返す。
     * 直交軸（X1, Y1等）の場合は、そのまま x または y を返す。
     */
    getAxisProjectionFn: function(axisName, state) {
        const s = state || window.AppState;
        if (!axisName) return (pt) => pt.x;
        
        // 1. 斜め通り芯の判定
        if (s.manualGridAngle) {
            const diag = s.manualGridAngle.find(g => g.name === axisName);
            if (diag && diag.p1 && diag.p2) {
                const vX = diag.p2.x - diag.p1.x;
                const vY = diag.p2.y - diag.p1.y;
                const len = Math.hypot(vX, vY);
                if (len > 0) {
                    const uX = vX / len;
                    const uY = vY / len;
                    // p1を原点とした、ベクトルu方向への投影距離
                    return (pt) => (pt.x - diag.p1.x) * uX + (pt.y - diag.p1.y) * uY;
                }
            }
        }
        
        // 2. 既存の直交軸の判定（"Y"を含むなら横方向=x座標基準, "X"を含むなら縦方向=y座標基準）
        if (axisName.toUpperCase().includes('Y')) {
            return (pt) => pt.x;
        } else if (axisName.toUpperCase().includes('X')) {
            return (pt) => pt.y;
        }
        
        return (pt) => pt.x;
    },

    /**
     * [v2.5.0] 壁または部材の、指定軸における投影情報を取得する
     * 左右加力の判定(isLeftEnd)や、1次元座標化に使用
     */
    getWallProjectionInfo: function(w, currentPoint, axisName, state) {
        const s = state || window.AppState;
        
        // 斜め軸かどうかを確認
        if (s.manualGridAngle) {
            const diag = s.manualGridAngle.find(g => g.name === axisName);
            if (diag) {
                const fn = this.getAxisProjectionFn(axisName, s);
                if (fn) {
                    const p1c = fn(w.p1);
                    const p2c = fn(w.p2);
                    const cc = fn(currentPoint);
                    return {
                        getPos: fn,
                        isLeftEnd: Math.abs(cc - Math.min(p1c, p2c)) < 5
                    };
                }
            }
        }
        
        // 通常の直交軸の場合は、壁の dx/dy の大きさで判定（既存ロジック互換）
        const dx = w.p2.x - w.p1.x;
        const dy = w.p2.y - w.p1.y;
        const isXAxis = Math.abs(dx) > Math.abs(dy); // X軸と平行（横方向）なら true
        
        const fn = (pt) => isXAxis ? pt.x : pt.y;
        const p1c = fn(w.p1);
        const p2c = fn(w.p2);
        const cc = fn(currentPoint);
        
        return {
            getPos: fn,
            isLeftEnd: Math.abs(cc - Math.min(p1c, p2c)) < 5
        };
    },

    /**
     * [v2.5.0] 点が指定された通り芯上にあるかを判定します（斜め軸対応）
     */
    isPointOnAxis: function(p, axisName, state) {
        const s = state || window.AppState;
        if (!p || !axisName) return false;

        // 1. 斜め軸の判定
        if (s.manualGridAngle) {
            const diag = s.manualGridAngle.find(g => g.name === axisName);
            if (diag && diag.p1 && diag.p2) {
                const A = diag.p2.y - diag.p1.y;
                const B = diag.p1.x - diag.p2.x;
                const C = diag.p1.y * diag.p2.x - diag.p1.x * diag.p2.y;
                const len = Math.hypot(A, B);
                if (len > 0) {
                    const dist = Math.abs(A * p.x + B * p.y + C) / len;
                    if (dist < 15) return true; // [v2.5.21 堅牢化] 100mmは広すぎるため隣の軸を誤認識する恐れあり。1mmの座標ズレを十分吸収できる極めて安全な「15mm」に制限。
                }
            }
        }

        // 2. 直交軸の判定 (旧来の getPillarName との後方互換)
        if (window.GridEngine && window.GridEngine.getPillarName) {
            const nm = window.GridEngine.getPillarName(p, s);
            return nm && (nm.startsWith(axisName) || nm.endsWith(axisName));
        }
        return false;
    },

    /**
     * Get numeric value from AppState or DOM (Standardization Bridge)
     */
    getVal: function(id) {
        const state = window.AppState;
        if (state && state.config) {
            const c = state.config;
            // Map common IDs to state config
            if (id === 'global-triangle-mult') return c.triangleMultiplier;
            if (id === 'attic-height') return c.atticHeight;
            if (id === 'n-h1') return c.floorHeight1F;
            if (id === 'n-h2') return c.floorHeight2F;
            if (id === 'p-d1') return c.pillarDepth1F;
            if (id === 'p-d2') return c.pillarDepth2F;
            if (id === 'prop-ext-wall') return c.weights.exteriorWall;
            if (id === 'prop-roof-type') return c.weights.roof;
            if (id === 'prop-solar') return c.weights.solar;
            if (id === 'prop-ceiling-ins') return c.weights.ceilingIns;
            if (id === 'prop-wall-ins') return c.weights.wallIns;
            if (id === 'prop-eaves-len') return c.eavesLen;

            // Area Mappings
            if (id === 'a-f1') return c.floorAreas['1F'];
            if (id === 'a-f2') return c.floorAreas['2F'];
            if (id === 'a-attic1') return c.floorAreas['1F_attic'];
            if (id === 'a-attic2') return c.floorAreas['2F_attic'];
            if (id === 'a-balcony1') return c.floorAreas['1F_balcony'];
            if (id === 'a-balcony2') return c.floorAreas['2F_balcony'];

            if (id === 'e-x-t1') return c.div4Areas['1F'].xt;
            if (id === 'e-x-b1') return c.div4Areas['1F'].xb;
            if (id === 'e-y-l1') return c.div4Areas['1F'].yl;
            if (id === 'e-y-r1') return c.div4Areas['1F'].yr;
            if (id === 'e-x-t2') return c.div4Areas['2F'].xt;
            if (id === 'e-x-b2') return c.div4Areas['2F'].xb;
            if (id === 'e-y-l2') return c.div4Areas['2F'].yl;
            if (id === 'e-y-r2') return c.div4Areas['2F'].yr;

            if (id === 'a-wx1') return c.projectedAreas['1F'].x;
            if (id === 'a-wy1') return c.projectedAreas['1F'].y;
            if (id === 'a-wx2') return c.projectedAreas['2F'].x;
            if (id === 'a-wy2') return c.projectedAreas['2F'].y;

            if (id === 'c-q1') return c.reqWallCoeffs['1F'].seismic;
            if (id === 'c-w1') return c.reqWallCoeffs['1F'].wind;
            if (id === 'c-q2') return c.reqWallCoeffs['2F'].seismic;
            if (id === 'c-w2') return c.reqWallCoeffs['2F'].wind;
        }

        // Fallback for legacy or untracked IDs
        const el = document.getElementById(id);
        if (!el) return 0;
        const val = el.value;
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

    /**
     * Triangulate a polygon using Ear Clipping algorithm
     */
    triangulate: function(verts) {
        const pts = [];
        for (let i = 0; i < verts.length; i++) {
            const p = verts[i];
            if (pts.length === 0 || Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y) > 1e-3) pts.push({ x: p.x, y: p.y });
        }
        if (pts.length > 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-3) pts.pop();
        if (pts.length < 3) return [];
        let a = 0;
        for (let i = 0; i < pts.length; i++) { let j = (i + 1) % pts.length; a += pts[i].x * pts[j].y - pts[j].x * pts[i].y; }
        if (a < 0) pts.reverse();
        const indices = pts.map((_, idx) => idx);
        let limit = pts.length * 3;
        const isEar = (u, v, w, n, pts, indices) => {
            const pA = pts[indices[u]], pB = pts[indices[v]], pC = pts[indices[w]];
            if ((pB.x - pA.x) * (pC.y - pA.y) - (pB.y - pA.y) * (pC.x - pA.x) <= 1e-6) return false;
            for (let i = 0; i < n; i++) {
                if (i === u || i === v || i === w) continue;
                const p = pts[indices[i]];
                const c1 = (pB.x - pA.x) * (p.y - pA.y) - (pB.y - pA.y) * (p.x - pA.x);
                const c2 = (pC.x - pB.x) * (p.y - pB.y) - (pC.y - pB.y) * (p.x - pB.x);
                const c3 = (pA.x - pC.x) * (p.y - pC.y) - (pA.y - pC.y) * (p.x - pC.x);
                if (c1 >= -1e-6 && c2 >= -1e-6 && c3 >= -1e-6) return false;
            }
            return true;
        };
        const triangles = [];
        while (indices.length > 2 && limit > 0) {
            limit--;
            let earFound = false;
            for (let i = 0; i < indices.length; i++) {
                const u = (i - 1 + indices.length) % indices.length;
                const v = i;
                const w = (i + 1) % indices.length;
                if (isEar(u, v, w, indices.length, pts, indices)) {
                    triangles.push([pts[indices[u]], pts[indices[v]], pts[indices[w]]]);
                    indices.splice(v, 1);
                    earFound = true;
                    break;
                }
            }
            if (!earFound) { triangles.push([pts[indices[0]], pts[indices[1]], pts[indices[2]]]); indices.splice(1, 1); }
        }
        return triangles;
    },

    /**
     * Get a human-readable area calculation formula (Requested by user)
     */
    getAreaFormula: function(vertices) {
        if (!vertices || vertices.length < 3) return "0.000";
        const n = vertices.length;
        const area = this.polygonArea(vertices) / 1000000;

        // Rectangle detection: 4 vertices, axis-aligned check
        if (n === 4) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            vertices.forEach(v => {
                if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
                if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
            });
            const w = (maxX - minX) / 1000;
            const h = (maxY - minY) / 1000;
            // Allow small epsilon for floating point
            if (Math.abs(w * h - area) < 0.001) {
                return `${w.toFixed(3)}m × ${h.toFixed(3)}m = ${area.toFixed(3)}㎡`;
            }
        }

        // Triangle detection: 3 vertices
        if (n === 3) {
            // Find longest edge as base
            let maxEdge = -1;
            for(let i=0; i<3; i++) {
                let d = Math.hypot(vertices[(i+1)%3].x - vertices[i].x, vertices[(i+1)%3].y - vertices[i].y);
                if(d > maxEdge) maxEdge = d;
            }
            const base = maxEdge / 1000;
            const height = (area * 2) / base;
            return `1/2 × ${base.toFixed(3)}m × ${height.toFixed(3)}m = ${area.toFixed(3)}㎡`;
        }

        // Generic fallback (coordinates) -> Use Triangulation!
        const triangles = this.triangulate(vertices);
        if (triangles.length === 0) return `面積 = ${area.toFixed(3)}㎡`;
        let formulaStr = [];
        let total = 0;
        triangles.forEach((tri, idx) => {
            let tc = window.MathUtils.polygonCentroid(tri);
            if (!tc) return;
            let subArea = Math.abs(tc.area / 1000000);
            let minX = Math.min(...tri.map(v => v.x)), maxX = Math.max(...tri.map(v => v.x));
            let minY = Math.min(...tri.map(v => v.y)), maxY = Math.max(...tri.map(v => v.y));
            let w = (maxX - minX) / 1000, h_dim = (maxY - minY) / 1000;
            formulaStr.push(`1/2 × ${w.toFixed(3)}m × ${h_dim.toFixed(3)}m = ${subArea.toFixed(3)}㎡`);
            total += subArea;
        });
        return formulaStr.join(" +<br>") + `<br><b>合計 = ${total.toFixed(3)}㎡</b>`;
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
            // Inside of CCW polygon is nx*x + ny*y - d >= 0, 
            // but clipPolygonStrict uses a*x + b*y + c <= 0 as inside.
            // So we pass -nx, -ny, d to get (-nx)x + (-ny)y + d <= 0  => nx*x + ny*y - d >= 0.
            result = this.clipPolygonStrict(result, -nx, -ny, d);
        }
        return result;
    }
};

window.MathUtils.Geometry = {
    polygonArea: (v) => window.MathUtils.polygonArea(v),
    polygonCentroid: (v) => window.MathUtils.polygonCentroid(v),
    getAreaFormula: (v) => window.MathUtils.getAreaFormula(v),
    triangulate: (v) => window.MathUtils.triangulate(v)
};
window.Geometry = window.MathUtils.Geometry;

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
