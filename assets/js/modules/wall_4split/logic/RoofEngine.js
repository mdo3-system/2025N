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
     * [v2.7.15] GL基準・スキャンラインプロファイルの生成
     * @param {string} direction 'X' or 'Y'
     * @param {object} state AppState
     * @returns {object} { uMin, uMax, profile, eavesZ1F, eavesZ2F, maxH, bbox1F, bbox2F, bboxAll, W }
     */
    getScanlineProfile: function(direction, state) {
        const s = state || window.AppState;
        if (!s || !s.config) return null;
        const config = s.config;
        const lvl = this.getFloorLevels(s);
        const roofFaces = s.roofFaces || [];
        const wallThick = parseFloat(config.wallThickness ?? 150);

        const bbox1F = this.getFloorBoundingBox('1F', s);
        const bbox2F = this.getFloorBoundingBox('2F', s);
        const bboxAll = {
            minX: Math.min(bbox1F.minX, bbox2F.minX),
            maxX: Math.max(bbox1F.maxX, bbox2F.maxX),
            minY: Math.min(bbox1F.minY, bbox2F.minY),
            maxY: Math.max(bbox1F.maxY, bbox2F.maxY)
        };

        // スキャン範囲を屋根の全頂点も含めて拡張する
        let roofMinX = bboxAll.minX;
        let roofMaxX = bboxAll.maxX;
        let roofMinY = bboxAll.minY;
        let roofMaxY = bboxAll.maxY;

        roofFaces.forEach(face => {
            if (!face.vertices) return;
            face.vertices.forEach(v => {
                if (v.x < roofMinX) roofMinX = v.x;
                if (v.x > roofMaxX) roofMaxX = v.x;
                if (v.y < roofMinY) roofMinY = v.y;
                if (v.y > roofMaxY) roofMaxY = v.y;
            });
        });

        const uMin = (direction === 'X') ? roofMinY : roofMinX;
        const uMax = (direction === 'X') ? roofMaxY : roofMaxX;
        const uMin1F = direction === 'X' ? bbox1F.minY : bbox1F.minX;
        const uMax1F = direction === 'X' ? bbox1F.maxY : bbox1F.maxX;
        const uMin2F = direction === 'X' ? bbox2F.minY : bbox2F.minX;
        const uMax2F = direction === 'X' ? bbox2F.maxY : bbox2F.maxX;

        let relZMax2F = 0;
        let has2FRoof = false;

        roofFaces.forEach(face => {
            if (!face.vertices || face.floor !== '2F') return;
            has2FRoof = true;
            const slope = parseFloat(face.slope ?? 4.5);
            const slopeVal = slope / 10;
            const thickness = parseFloat(face.roofThickness ?? config.roofThickness ?? 150);
            const tVertical = thickness * Math.sqrt(1 + slopeVal * slopeVal);
            const baseDelta = parseFloat(face.baseHeightDelta ?? 0);

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
                    ux = len > 0 ? nx/len : 0; uy = len > 0 ? ny/len : 1;
                }
            } else if (face.slopeLine && face.slopeLine.length === 2) {
                const p2 = face.slopeLine[1];
                if (p2) { const dx=p2.x-pA.x, dy=p2.y-pA.y, len=Math.hypot(dx,dy); ux=len>0?dx/len:0; uy=len>0?dy/len:1; }
            }

            face.vertices.forEach(v => {
                const dist = (v.x - pA.x)*ux + (v.y - pA.y)*uy;
                const z = dist * slopeVal + tVertical + baseDelta;
                if (z > relZMax2F) {
                    relZMax2F = z;
                }
            });
        });

        const maxH = parseFloat(config.maxHeight ?? 8000);
        const eavesZ2F = has2FRoof ? (maxH - relZMax2F) : (lvl.fl2 + (parseFloat(config.floorHeight2F ?? 2.7)) * 1000);
        const eavesZ1F = lvl.fl2;

        const STEPS = 200;
        const profile = [];
        const W = uMax - uMin;

        for (let i = 0; i <= STEPS; i++) {
            const u = uMin + (i / STEPS) * (uMax - uMin);
            let maxZ = 0;
            let minZ = Infinity;

            if (u >= uMin1F && u <= uMax1F) {
                maxZ = Math.max(maxZ, eavesZ1F);
                minZ = Math.min(minZ, 0);
            }
            if (u >= uMin2F && u <= uMax2F) {
                maxZ = Math.max(maxZ, eavesZ2F);
                minZ = Math.min(minZ, lvl.fl2);
            }

            roofFaces.forEach(face => {
                if (!face.vertices) return;
                const floor = face.floor || '2F';
                const baseDelta = parseFloat(face.baseHeightDelta ?? 0);
                const zBase = (floor === '2F' ? eavesZ2F : eavesZ1F) + baseDelta;
                const slope = parseFloat(face.slope ?? 0);
                const slopeVal = slope / 10;
                const thickness = parseFloat(face.roofThickness ?? config.roofThickness ?? 150);
                const tVertical = thickness * Math.sqrt(1 + slopeVal * slopeVal);

                let ux = 0, uy = 1;
                const pA = (face.slopeLine && face.slopeLine.length > 0) ? face.slopeLine[0] : face.vertices[0];
                if (!pA) return;
                if (face.slopeLine && face.slopeLine.length >= 3) {
                    const pB = face.slopeLine[1], pC = face.slopeLine[2];
                    if (pB && pC) {
                        const dx = pB.x - pA.x, dy = pB.y - pA.y;
                        let nx = -dy, ny = dx;
                        if ((nx*(pC.x-pA.x) + ny*(pC.y-pA.y)) < 0) { nx=-nx; ny=-ny; }
                        const len = Math.hypot(nx, ny);
                        ux = len > 0 ? nx/len : 0;
                        uy = len > 0 ? ny/len : 1;
                    }
                } else if (face.slopeLine && face.slopeLine.length === 2) {
                    const p2 = face.slopeLine[1];
                    if (p2) { const dx=p2.x-pA.x, dy=p2.y-pA.y, len=Math.hypot(dx,dy); ux=len>0?dx/len:0; uy=len>0?dy/len:1; }
                }

                const numV = face.vertices.length;
                for (let j = 0; j < numV; j++) {
                    const v1 = face.vertices[j], v2 = face.vertices[(j+1)%numV];
                    const val1 = (direction === 'X') ? v1.y : v1.x;
                    const val2 = (direction === 'X') ? v2.y : v2.x;
                    if ((val1 <= u && val2 >= u) || (val2 <= u && val1 >= u)) {
                        if (Math.abs(val2-val1) < 0.01) continue;
                        const t = (u-val1)/(val2-val1);
                        const ix = v1.x + t*(v2.x-v1.x), iy = v1.y + t*(v2.y-v1.y);
                        const dist = (ix-pA.x)*ux + (iy-pA.y)*uy;
                        const z = zBase + dist*slopeVal + tVertical;
                        if (z > maxZ) {
                            maxZ = z;
                        }
                        const zBottomRoof = z - tVertical;
                        if (zBottomRoof < minZ) {
                            minZ = zBottomRoof;
                        }
                    }
                }
            });
            if (minZ === Infinity) minZ = 0;
            profile.push({ u, z: maxZ, zBottom: minZ });
        }

        return { uMin, uMax, profile, eavesZ1F, eavesZ2F, maxH, bbox1F, bbox2F, bboxAll, W };
    },

    /**
     * [v2.7.15] GL基準・スキャンライン積分による見附面積計算
     * 1Fの追加見附＝lvl.cut1〜lvl.cut2の範囲で、zBottomとzの間のプロファイル高さ
     * 2F見附＝lvl.cut2以上の範囲で、zBottomとzの間のプロファイル高さ
     */
    updateProjectedAreas: function(state) {
        const s = state || window.AppState;
        const c = s.config;
        const lvl = this.getFloorLevels(s);

        const areas = {
            '1F': { x: 0, y: 0 },
            '2F': { x: 0, y: 0 }
        };

        const formulaAreas = { '1F': { x: [], y: [] }, '2F': { x: [], y: [] } };

        ['X', 'Y'].forEach(dir => {
            const scan = this.getScanlineProfile(dir, s);
            if (!scan) return;
            const profile = scan.profile;
            const STEPS = profile.length - 1;
            const du = (scan.uMax - scan.uMin) / STEPS / 1000; // m単位

            let sum2F = 0;
            let sum1F = 0;

            for (let i = 0; i < STEPS; i++) {
                const p1 = profile[i];
                const p2 = profile[i+1];
                const zMid = (p1.z + p2.z) / 2;
                const zbMid = (p1.zBottom + p2.zBottom) / 2;

                // 2F 見附高さ (cut2以上)
                const top2F = Math.max(zMid, lvl.cut2);
                const bot2F = Math.max(zbMid, lvl.cut2);
                if (top2F > bot2F) {
                    sum2F += (top2F - bot2F) * du; // mm * m
                }

                // 1F 追加見附高さ (cut1〜cut2)
                const top1F = Math.min(zMid, lvl.cut2);
                const bot1F = Math.max(zbMid, lvl.cut1);
                if (top1F > bot1F) {
                    sum1F += (top1F - bot1F) * du; // mm * m
                }
            }

            const area2F = sum2F / 1000; // mm*m -> m²
            const area1F = sum1F / 1000; // mm*m -> m²

            const key = dir === 'X' ? 'x' : 'y';
            areas['2F'][key] = area2F;
            areas['1F'][key] = area1F;

            // 求積表用データ
            if (area2F > 0.01) {
                const w_m = scan.W / 1000;
                const h_eq = area2F / w_m;
                formulaAreas['2F'][key].push({
                    name: `${dir}方向 2F見附 (2FL+1350以上)`,
                    w: w_m,
                    h: h_eq,
                    formula: 'スキャンライン法積分値 (全幅×換算高)',
                    area: area2F
                });
            }
            if (area1F > 0.01) {
                const w_m = scan.W / 1000;
                const h_eq = area1F / w_m;
                formulaAreas['1F'][key].push({
                    name: `${dir}方向 1F追加見附 (1FL+1350〜2FL+1350)`,
                    w: w_m,
                    h: h_eq,
                    formula: 'スキャンライン法積分値 (全幅×換算高)',
                    area: area1F
                });
            }
        });

        // State反映
        c.projectedAreas['1F'].x = areas['1F'].x;
        c.projectedAreas['1F'].y = areas['1F'].y;
        c.projectedAreas['2F'].x = areas['2F'].x;
        c.projectedAreas['2F'].y = areas['2F'].y;

        c.elevationFormulaAreas = formulaAreas;

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
        const s = window.AppState;
        const c = (s && s.config) ? s.config : {};
        const lvl = this.getFloorLevels(s);
        const floor = face.floor || '2F';
        const slope = face.slope || 0; // 寸
        const baseDelta = face.baseHeightDelta || 0; // mm

        // Calculate eavesZ2F dynamically
        const roofFaces = s.roofFaces || [];
        let relZMax2F = 0;
        let has2FRoof = false;

        roofFaces.forEach(f => {
            if (!f.vertices || f.floor !== '2F') return;
            has2FRoof = true;
            const sl = parseFloat(f.slope ?? 4.5);
            const slVal = sl / 10;
            const thick = parseFloat(f.roofThickness ?? c.roofThickness ?? 150);
            const tVert = thick * Math.sqrt(1 + slVal * slVal);
            const bd = parseFloat(f.baseHeightDelta ?? 0);

            let ux = 0, uy = 1;
            const pA = (f.slopeLine && f.slopeLine.length > 0) ? f.slopeLine[0] : f.vertices[0];
            if (!pA) return;
            if (f.slopeLine && f.slopeLine.length >= 3) {
                const pB = f.slopeLine[1], pC = f.slopeLine[2];
                if (pB && pC) {
                    const dx = pB.x - pA.x, dy = pB.y - pA.y;
                    let nx = -dy, ny = dx;
                    if ((nx*(pC.x-pA.x) + ny*(pC.y-pA.y)) < 0) { nx = -nx; ny = -ny; }
                    const len = Math.hypot(nx, ny);
                    ux = len > 0 ? nx/len : 0; uy = len > 0 ? ny/len : 1;
                }
            } else if (f.slopeLine && f.slopeLine.length === 2) {
                const p2 = f.slopeLine[1];
                if (p2) { const dx=p2.x-pA.x, dy=p2.y-pA.y, len=Math.hypot(dx,dy); ux=len>0?dx/len:0; uy=len>0?dy/len:1; }
            }

            f.vertices.forEach(vt => {
                const dist = (vt.x - pA.x)*ux + (vt.y - pA.y)*uy;
                const z = dist * slVal + tVert + bd;
                if (z > relZMax2F) {
                    relZMax2F = z;
                }
            });
        });

        const maxH = parseFloat(c.maxHeight ?? 8000);
        const eavesZ2F = has2FRoof ? (maxH - relZMax2F) : (lvl.fl2 + (parseFloat(c.floorHeight2F ?? 2.7)) * 1000);
        const eavesZ1F = lvl.fl2;

        const zBase = (floor === '2F' ? eavesZ2F : eavesZ1F) + baseDelta;

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
            uy = len > 0 ? ny / len : 1;
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
