/**
 * logic/RoofEngine.js - Roof Property & Semantic Primitive Projection Engine
 * v2.8.0 - Semantic Primitive Generation with Absolute Z Levels
 */

window.RoofEngine = {
    getFloorLevels: function(state) {
        const s = state || window.AppState;
        const c = s.config || {};
        
        // All values in absolute Z (mm) from GL(0)
        const GL = 0;
        
        // 基礎高、パッキン、土台、床厚
        const baseH = parseFloat(c.baseHeight ?? 400);
        const basePack = parseFloat(c.basePack ?? 20);
        const baseSill = parseFloat(c.baseSill ?? 105);
        
        const foundationTop = GL + baseH;
        const sillTop = foundationTop + basePack + baseSill; // 土台天端
        
        const floorThick1F = parseFloat(c.floorThick1F ?? 36);
        const FL1 = sillTop + floorThick1F; // 1FL = 基礎高さ＋基礎パッキン+土台高さ+床厚
        
        const floorHeight1F = parseFloat(c.floorHeight1F ?? 2.7) * 1000; // 軸組階高
        const floorThick2F = parseFloat(c.floorThick2F ?? 36);
        const FL2 = sillTop + floorHeight1F + floorThick2F; // 2FL = 基礎高＋基礎パッキン＋土台+1Ｆ軸組階高+2階の床厚
        
        // 見附面積カットライン (FL + 1350)
        const cut1 = FL1 + 1350;
        const cut2 = FL2 + 1350;
        
        return { GL, foundationTop, sillTop, FL1, FL2, fl1: FL1, fl2: FL2, cut1, cut2 };
    },

    getFloorExteriorPolygons: function(floor, state) {
        const s = state || window.AppState;
        const c = s.config || {};
        const wallThick = c.wallThickness !== undefined ? parseFloat(c.wallThickness) : 150;
        let polys = [];
        
        const activeExtWalls = (s.exteriorWalls || []).filter(ew => ew.floor === floor && ew.vertices && ew.vertices.length >= 3);
        if (activeExtWalls.length > 0) {
            activeExtWalls.forEach(ew => { 
                const oPoly = this.offsetPolygon(ew.vertices, wallThick);
                if (oPoly.length >= 3) polys.push(oPoly);
            });
        } else {
            const boundary = window.WallEngine ? window.WallEngine.extractOuterBoundary(floor, s) : null;
            if (boundary && boundary.length >= 3) { 
                const oPoly = this.offsetPolygon(boundary, wallThick);
                if (oPoly.length >= 3) polys.push(oPoly);
            }
        }
        
        if (polys.length === 0) {
            const areas = (s.areaLines || []).filter(a => a.floor === floor);
            areas.forEach(a => {
                if (a.vertices && a.vertices.length >= 3) {
                    const oPoly = this.offsetPolygon(a.vertices, wallThick);
                    if (oPoly.length >= 3) polys.push(oPoly);
                }
            });
        }

        if (polys.length === 0) {
            // [v3.0.9] 絶対ルールに基づき、通り芯座標がロードされていない場合は、配置された柱・壁のグリッド座標から自動構築
            const coordsX = (s.gridXCoords && s.gridXCoords.length > 0) ? s.gridXCoords : [...new Set((s.pillars || []).filter(p => !p.isDeleted).map(p => p.x))];
            const coordsY = (s.gridYCoords && s.gridYCoords.length > 0) ? s.gridYCoords : [...new Set((s.pillars || []).filter(p => !p.isDeleted).map(p => p.y))];
            if (coordsX.length > 0 && coordsY.length > 0) {
                const minX = Math.min(...coordsX), maxX = Math.max(...coordsX);
                const minY = Math.min(...coordsY), maxY = Math.max(...coordsY);
                polys.push([
                    { x: minX - wallThick, y: minY - wallThick },
                    { x: maxX + wallThick, y: minY - wallThick },
                    { x: maxX + wallThick, y: maxY + wallThick },
                    { x: minX - wallThick, y: maxY + wallThick }
                ]);
            }
        }
        
        return polys;
    },

    getFloorBoundingBox: function(floor, state) {
        const polys = this.getFloorExteriorPolygons(floor, state);
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let hasPts = false;
        polys.forEach(poly => {
            poly.forEach(v => {
                if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
                if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
                hasPts = true;
            });
        });
        if (!hasPts) {
            return { minX: 0, maxX: 10000, minY: 0, maxY: 10000 };
        }
        return { minX, maxX, minY, maxY };
    },

    offsetPolygon: function(poly, d) {
        if (!poly || poly.length < 3) return [];
        let pts = poly.map(v => ({ x: v.x, y: v.y }));
        let sum = 0;
        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
            sum += (p2.x - p1.x) * (p2.y + p1.y);
        }
        if (sum > 0) pts.reverse();
        const n = pts.length;
        const normals = [];
        for (let i = 0; i < n; i++) {
            const p1 = pts[i], p2 = pts[(i + 1) % n];
            const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
            if (L < 1e-6) normals.push({ x: 0, y: 0 });
            else normals.push({ x: dy / L, y: -dx / L });
        }
        const offsetPts = [];
        for (let i = 0; i < n; i++) {
            const p = pts[i], n_prev = normals[(i - 1 + n) % n], n_curr = normals[i];
            const denom = 1 + (n_prev.x * n_curr.x + n_prev.y * n_curr.y);
            const factor = denom > 1e-4 ? 1 / denom : 1;
            const vx = (n_prev.x + n_curr.x) * factor, vy = (n_prev.y + n_curr.y) * factor;
            offsetPts.push({ x: p.x + d * vx, y: p.y + d * vy });
        }
        return offsetPts;
    },

    /**
     * 2D多角形（頂点配列）の水平投影面積(㎡)を計算する
     */
    calculatePolygonArea2D: function(vertices) {
        if (!vertices || vertices.length < 3) return 0;
        let sum = 0;
        for (let i = 0; i < vertices.length; i++) {
            const p1 = vertices[i];
            const p2 = vertices[(i + 1) % vertices.length];
            const u1 = p1.u !== undefined ? p1.u : p1.x;
            const v1 = p1.v !== undefined ? p1.v : p1.y;
            const u2 = p2.u !== undefined ? p2.u : p2.x;
            const v2 = p2.v !== undefined ? p2.v : p2.y;
            sum += (u1 * v2) - (u2 * v1);
        }
        let area = Math.abs(sum) / 2;
        if (area > 1000) {
            area = area / 1000000;
        }
        return area;
    }
};
