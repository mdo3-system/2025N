window.RoofEngine = {

    /**
     * [v2.7.9] GL基準の絶対床高さを計算して返す
     * @returns {object} { fl1, fl2, cut1, cut2 } (すべてmm)
     *   fl1  = 1FL (GL + 基礎高 + パッキン + 土台 + 1F床厚)
     *   fl2  = 2FL (GL + 基礎高 + パッキン + 土台 + 1F軸組高 + 2F床厚)
     *   cut1 = 1F見附 下端カットライン (fl1 + 1350)
     *   cut2 = 2F見附 下端カットライン (fl2 + 1350)
     */
    getFloorLevels: function(state) {
        const s = state || window.AppState;
        const c = (s && s.config) ? s.config : {};
        const baseH       = parseFloat(c.baseHeight    ?? 400);
        const basePack    = parseFloat(c.basePack       ?? 20);
        const baseSill    = parseFloat(c.baseSill       ?? 105);
        const flTk1       = parseFloat(c.floorThick1F   ?? 36);
        const flTk2       = parseFloat(c.floorThick2F   ?? 36);
        const axH1        = (parseFloat(c.floorHeight1F ?? 2.7)) * 1000; // mm
        const axH2        = (parseFloat(c.floorHeight2F ?? 2.7)) * 1000; // mm

        const fl1 = baseH + basePack + baseSill + flTk1;          // 1FL (mm)
        const fl2 = baseH + basePack + baseSill + axH1 + flTk2;   // 2FL (mm)
        return {
            fl1,
            fl2,
            cut1: fl1 + 1350,   // 1F見附 下端
            cut2: fl2 + 1350,   // 2F見附 下端
        };
    },

    /**
     * [v2.7.9] GL基準・スキャンライン法による見附面積計算
     * 壁部: 外壁多角形(壁厚オフセット)のX/Y方向幅 × (軒高 - カットライン)
     * 屋根部: 各面のスキャンライン投影から1.35mカット以上の面積を積分
     */
    updateProjectedAreas: function(state) {
        const s = state || window.AppState;
        const c = s.config;
        const lvl = this.getFloorLevels(s);
        const wallThick = parseFloat(c.wallThickness ?? 150); // mm

        // --- 外壁バウンディング ---
        const bbox1F = this.getFloorBoundingBox('1F', s);
        const bbox2F = this.getFloorBoundingBox('2F', s);

        // 2F軒高 (GL絶対値mm)
        const eavesZ2F = lvl.fl2 + (parseFloat(c.floorHeight2F ?? 2.7)) * 1000;
        // 1F軒高 (= 2FL, GL絶対値mm)
        const eavesZ1F = lvl.fl2;

        // 各高さをm単位でも用意 (面積計算はすべてm²)
        const eavesZ2F_m = eavesZ2F / 1000;
        const eavesZ1F_m = eavesZ1F / 1000;
        const cut2_m     = lvl.cut2 / 1000;
        const cut1_m     = lvl.cut1 / 1000;

        // 壁面の有効高さ mm (カットライン以上)
        const wallH2_mm  = Math.max(0, eavesZ2F - lvl.cut2); // 2F壁高さ (mm)
        // 1F追加分 = (cut1〜cut2間の2FL未満の高さ)
        const add1F_mm   = Math.max(0, Math.min(eavesZ1F, lvl.cut2) - lvl.cut1); // mm

        // 2F壁面見附 (m²)
        const wall2F_widthY = (bbox2F.maxY - bbox2F.minY) / 1000; // X方向受圧面の幅 (m)
        const wall2F_widthX = (bbox2F.maxX - bbox2F.minX) / 1000; // Y方向受圧面の幅 (m)
        const wall_ax2 = wall2F_widthY * (wallH2_mm / 1000);      // m²
        const wall_ay2 = wall2F_widthX * (wallH2_mm / 1000);      // m²

        // 1F追加壁面見附 (2FL以下、cut1以上の部分) (m²)
        const wall1F_widthY = (bbox1F.maxY - bbox1F.minY) / 1000;
        const wall1F_widthX = (bbox1F.maxX - bbox1F.minX) / 1000;
        const wall_ax1add = wall1F_widthY * (add1F_mm / 1000);    // m²
        const wall_ay1add = wall1F_widthX * (add1F_mm / 1000);    // m²

        const areas = {
            '1F': { x: wall_ax1add, y: wall_ay1add },
            '2F': { x: wall_ax2,   y: wall_ay2   }
        };

        // --- 屋根面の投影面積 (スキャンライン法) ---
        const roofFaces = s.roofFaces || [];
        roofFaces.forEach(face => {
            if (!face.vertices || face.vertices.length < 3) return;

            const floor = face.floor || '2F';
            const slope = parseFloat(face.slope ?? 0);
            const slopeVal = slope / 10;                         // 寸勾配 (無次元)
            const thickness = parseFloat(face.roofThickness ?? c.roofThickness ?? 150) / 1000; // m
            const baseDelta = parseFloat(face.baseHeightDelta ?? 0); // mm

            // このフェースの軒高 (m単位)
            const zBase_m = (floor === '2F' ? eavesZ2F_m : eavesZ1F_m) + baseDelta / 1000;
            // カットライン (m単位)
            const cutZ_m = floor === '2F' ? cut2_m : cut1_m;

            // 勾配方向ベクトルの計算
            let ux = 0, uy = 1;
            const pA = (face.slopeLine && face.slopeLine.length > 0) ? face.slopeLine[0] : face.vertices[0];
            if (!pA) return;
            if (face.slopeLine && face.slopeLine.length >= 3) {
                const pB = face.slopeLine[1], pC = face.slopeLine[2];
                if (pB && pC) {
                    const dx = pB.x - pA.x, dy = pB.y - pA.y;
                    let nx = -dy, ny = dx;
                    if ((nx*(pC.x-pA.x) + ny*(pC.y-pA.y)) < 0) { nx = -nx; ny = -ny; }
                    const len = Math.hypot(nx, ny);
                    ux = len > 0 ? nx/len : 0;
                    uy = len > 0 ? ny/len : 1;
                }
            } else if (face.slopeLine && face.slopeLine.length === 2) {
                const p2 = face.slopeLine[1];
                if (p2) {
                    const dx = p2.x - pA.x, dy = p2.y - pA.y;
                    const len = Math.hypot(dx, dy);
                    ux = len > 0 ? dx/len : 0;
                    uy = len > 0 ? dy/len : 1;
                }
            }

            // 各頂点の3D座標 (すべてm単位に統一)
            // slopeVal (寸勾配) × dist(m) → 高さ増分(m)
            const pts3D = face.vertices.map(v => {
                const vx_m = v.x / 1000, vy_m = v.y / 1000;
                const pAx_m = pA.x / 1000, pAy_m = pA.y / 1000;
                const dist_m = (vx_m - pAx_m)*ux + (vy_m - pAy_m)*uy;
                return { x: vx_m, y: vy_m, z: zBase_m + dist_m * slopeVal }; // z: m
            });

            // スキャンライン法 (X/Y各方向へ投影した有効面積) — すべてm単位
            // Y方向投影 (X方向力を受ける面積): u=y座標(m), v=高さ(m)
            const ptsYZ = pts3D.map(p => ({ u: p.y, v: p.z }));
            const roof_ax = this.calcCutPolygonArea2D(ptsYZ, cutZ_m, null);
            // X方向投影 (Y方向力を受ける面積): u=x座標(m), v=高さ(m)
            const ptsXZ = pts3D.map(p => ({ u: p.x, v: p.z }));
            const roof_ay = this.calcCutPolygonArea2D(ptsXZ, cutZ_m, null);

            // 屋根厚さ補正 (垂直投影) — m単位
            const cosTheta = 1 / Math.sqrt(1 + slopeVal*slopeVal);
            const vThick_m = thickness / cosTheta; // m
            const ys = pts3D.map(p => p.y);
            const xs = pts3D.map(p => p.x);
            const thickCorr_ax = (Math.max(...ys) - Math.min(...ys)) * vThick_m;
            const thickCorr_ay = (Math.max(...xs) - Math.min(...xs)) * vThick_m;

            areas[floor].x += roof_ax + thickCorr_ax;
            areas[floor].y += roof_ay + thickCorr_ay;
        });

        // State反映
        c.projectedAreas['1F'].x = areas['1F'].x;
        c.projectedAreas['1F'].y = areas['1F'].y;
        c.projectedAreas['2F'].x = areas['2F'].x;
        c.projectedAreas['2F'].y = areas['2F'].y;

        this.syncToDOM(areas);
    },

    /**
     * [v2.7.9] カットライン以上の部分だけを積分する2D面積計算
     * vertices: [{u, v}] の多角形  vMin: m単位カット下限  vMax: m単位カット上限(nullで上限なし)
     */
    calcCutPolygonArea2D: function(vertices, vMin, vMax) {
        if (!vertices || vertices.length < 2) return 0;
        // スキャンライン: uの範囲をN分割して各スライスで上下端を求めて積分
        const us = vertices.map(p => p.u);
        const uMin = Math.min(...us);
        const uMax = Math.max(...us);
        if (uMax <= uMin) return 0;

        const STEPS = 200;
        const du = (uMax - uMin) / STEPS;
        let area = 0;
        const n = vertices.length;

        for (let i = 0; i < STEPS; i++) {
            const u = uMin + (i + 0.5) * du;
            let vLow = Infinity, vHigh = -Infinity;
            for (let j = 0; j < n; j++) {
                const v1 = vertices[j], v2 = vertices[(j+1)%n];
                if ((v1.u <= u && v2.u > u) || (v2.u <= u && v1.u > u)) {
                    const t = (u - v1.u) / (v2.u - v1.u);
                    const v = v1.v + t*(v2.v - v1.v);
                    if (v < vLow)  vLow  = v;
                    if (v > vHigh) vHigh = v;
                }
            }
            if (vHigh > vLow) {
                const bottom = Math.max(vLow,  vMin ?? -Infinity);
                const top    = Math.min(vHigh, vMax ?? Infinity);
                if (top > bottom) area += (top - bottom) * du;
            }
        }
        return area;
    },



    /**
     * Get floor bounding box including wall thickness offset in mm
     */
    getFloorBoundingBox: function(floor, state) {
        const s = state || window.AppState;
        const c = s.config || {};
        const wallThick = c.wallThickness !== undefined ? parseFloat(c.wallThickness) : 150; // mm

        let points = [];
        
        // 1. 手動外壁線を取得
        const activeExtWalls = (s.exteriorWalls || []).filter(ew => ew.floor === floor && ew.vertices && ew.vertices.length >= 3);
        if (activeExtWalls.length > 0) {
            activeExtWalls.forEach(ew => {
                const offsetPts = this.offsetPolygon(ew.vertices, wallThick);
                points = points.concat(offsetPts);
            });
        } else {
            // 2. 自動抽出外壁を取得
            const boundary = window.WallEngine ? window.WallEngine.extractOuterBoundary(floor, s) : null;
            if (boundary && boundary.length >= 3) {
                const offsetPts = this.offsetPolygon(boundary, wallThick);
                points = points.concat(offsetPts);
            }
        }

        // フォールバック（部屋領域や通り芯から bounding box を得る）
        if (points.length === 0) {
            const areas = (s.areaLines || []).filter(a => a.floor === floor);
            areas.forEach(a => {
                if (a.vertices) {
                    a.vertices.forEach(v => {
                        points.push({ x: v.x, y: v.y });
                    });
                }
            });
        }

        if (points.length === 0) {
            const coordsX = s.gridXCoords || [];
            const coordsY = s.gridYCoords || [];
            if (coordsX.length > 0) {
                const minX = Math.min(...coordsX);
                const maxX = Math.max(...coordsX);
                const minY = Math.min(...coordsY);
                const maxY = Math.max(...coordsY);
                return { 
                    minX: minX - wallThick, 
                    maxX: maxX + wallThick, 
                    minY: minY - wallThick, 
                    maxY: maxY + wallThick 
                };
            }
            return { minX: 0, maxX: 10000, minY: 0, maxY: 10000 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        points.forEach(v => {
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
        });

        return { minX, maxX, minY, maxY };
    },

    /**
     * 多角形を外側に指定距離だけオフセットして膨らませる幾何学メソッド
     */
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
            const p1 = pts[i];
            const p2 = pts[(i + 1) % n];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const L = Math.hypot(dx, dy);
            if (L < 1e-6) {
                normals.push({ x: 0, y: 0 });
            } else {
                normals.push({ x: dy / L, y: -dx / L });
            }
        }
        const offsetPts = [];
        for (let i = 0; i < n; i++) {
            const p = pts[i];
            const n_prev = normals[(i - 1 + n) % n];
            const n_curr = normals[i];
            
            const denom = 1 + (n_prev.x * n_curr.x + n_prev.y * n_curr.y);
            const factor = denom > 1e-4 ? 1 / denom : 1;
            const vx = (n_prev.x + n_curr.x) * factor;
            const vy = (n_prev.y + n_curr.y) * factor;
            
            offsetPts.push({
                x: p.x + d * vx,
                y: p.y + d * vy
            });
        }
        return offsetPts;
    },

    /**
     * Calculate 3D height at coordinates in mm
     */
    calculate3DHeightAtCoordinate: function(v, face) {
        const floor = face.floor || '2F';
        const slope = face.slope || 0; // 寸
        const baseDelta = face.baseHeightDelta || 0; // mm

        // Ceiling baseline height (桁高) in mm
        let zBase = 3000;
        if (floor === '2F') {
            zBase = 6000;
        }
        zBase += baseDelta;

        let ux = 0, uy = 1;
        const pA = face.slopeLine ? face.slopeLine[0] : { x: 0, y: 0 };
        if (face.slopeLine && face.slopeLine.length >= 3) {
            const pB = face.slopeLine[1];
            const pC = face.slopeLine[2];
            const dx = pB.x - pA.x;
            const dy = pB.y - pA.y;
            let nx = -dy;
            let ny = dx;
            const vx = pC.x - pA.x;
            const vy = pC.y - pA.y;
            const dot = nx * vx + ny * vy;
            if (dot < 0) {
                nx = -nx;
                ny = -ny;
            }
            const len = Math.hypot(nx, ny);
            ux = len > 0 ? nx / len : 0;
            uy = len > 0 ? ny / len : 1;
        } else if (face.slopeLine && face.slopeLine.length === 2) {
            const p2 = face.slopeLine[1];
            const dx = p2.x - pA.x;
            const dy = p2.y - pA.y;
            const len = Math.hypot(dx, dy);
            ux = len > 0 ? dx / len : 0;
            uy = len > 0 ? dy / len : 1;
        }

        const slopeVal = slope / 10;
        const dist = (v.x - pA.x) * ux + (v.y - pA.y) * uy;
        return zBase + dist * slopeVal;
    },

    /**
     * Calculate 2D polygon area using Shoelace formula
     */
    calculatePolygonArea2D: function(vertices) {
        let area = 0;
        const n = vertices.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += vertices[i].u * vertices[j].v;
            area -= vertices[j].u * vertices[i].v;
        }
        return Math.abs(area / 2);
    },

    /**
     * Synchronize calculated values with DOM input fields (a-wx1, a-wy1, a-wx2, a-wy2)
     */
    syncToDOM: function(areas) {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = val.toFixed(2);
            }
        };
        setVal('a-wx1', areas['1F'].x);
        setVal('a-wy1', areas['1F'].y);
        setVal('a-wx2', areas['2F'].x);
        setVal('a-wy2', areas['2F'].y);
    }
};
