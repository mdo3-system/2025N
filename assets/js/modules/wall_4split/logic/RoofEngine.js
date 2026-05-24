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
            const coordsX = s.gridXCoords || [];
            const coordsY = s.gridYCoords || [];
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

    _getProjectedWallSegments: function(polys, direction) {
        let segments = [];
        polys.forEach(poly => {
            const n = poly.length;
            for (let i = 0; i < n; i++) {
                const v1 = poly[i], v2 = poly[(i+1)%n];
                const u1 = direction === 'X' ? v1.y : v1.x;
                const u2 = direction === 'X' ? v2.y : v2.x;
                const uMin = Math.min(u1, u2);
                const uMax = Math.max(u1, u2);
                if (uMax - uMin > 10) { // 幅10mm以上を抽出
                    segments.push({ uMin, uMax });
                }
            }
        });
        
        if (segments.length === 0) return [];
        segments.sort((a, b) => a.uMin - b.uMin);
        
        // 区間のマージ (Union)
        let merged = [segments[0]];
        for (let i = 1; i < segments.length; i++) {
            const last = merged[merged.length - 1];
            const curr = segments[i];
            if (curr.uMin <= last.uMax + 10) { // 10mmの隙間はマージ
                last.uMax = Math.max(last.uMax, curr.uMax);
            } else {
                merged.push({...curr});
            }
        }
        return merged;
    },

    getProjectedPrimitives: function(direction, state) {
        const s = state || window.AppState;
        const c = s.config || {};
        const lvl = this.getFloorLevels(s);
        const roofFaces = s.roofFaces || [];
        const wallThick = c.wallThickness !== undefined ? parseFloat(c.wallThickness) : 150;
        
        let primitives = [];
        let roof1FPrimitives = []; // 2F外壁の切り上げ用

        // 1. 屋根の最大高さを計算して 2Fの桁高(eavesZ2F) を決める
        let relZMax2F = 0;
        let has2FRoof = false;
        roofFaces.forEach(face => {
            if (!face.vertices || face.floor !== '2F') return;
            has2FRoof = true;
            const slope = parseFloat(face.slope ?? 4.5) / 10;
            const thickness = parseFloat(face.roofThickness ?? c.roofThickness ?? 150);
            const tVertical = thickness * Math.sqrt(1 + slope * slope);
            const baseDelta = parseFloat(face.baseHeightDelta ?? 0);

            let ux = 0, uy = 1;
            const pA = (face.slopeLine && face.slopeLine.length > 0) ? face.slopeLine[0] : face.vertices[0];
            if (!pA) return;
            if (face.slopeLine && face.slopeLine.length >= 3) {
                const pB = face.slopeLine[1], pC = face.slopeLine[2];
                const dx = pB.x - pA.x, dy = pB.y - pA.y;
                let nx = -dy, ny = dx;
                if ((nx*(pC.x-pA.x) + ny*(pC.y-pA.y)) < 0) { nx = -nx; ny = -ny; }
                const len = Math.hypot(nx, ny);
                ux = len > 0 ? nx/len : 0; uy = len > 0 ? ny/len : 1;
            } else if (face.slopeLine && face.slopeLine.length === 2) {
                const p2 = face.slopeLine[1];
                const dx=p2.x-pA.x, dy=p2.y-pA.y, len=Math.hypot(dx,dy); 
                ux=len>0?dx/len:0; uy=len>0?dy/len:1;
            }

            face.vertices.forEach(v => {
                const dist = (v.x - pA.x)*ux + (v.y - pA.y)*uy;
                const z = dist * slope + tVertical + baseDelta;
                if (z > relZMax2F) relZMax2F = z;
            });
        });

        const maxH = parseFloat(c.maxHeight ?? 8000);
        const eavesZ2F = has2FRoof ? (maxH - relZMax2F) : (lvl.FL2 + (parseFloat(c.floorHeight2F ?? 2.7)) * 1000);

        // 2. 屋根のプリミティブ抽出 (意味論的)
        roofFaces.forEach((face, idx) => {
            if (!face.vertices || face.vertices.length < 3) return;
            const slopeVal = parseFloat(face.slope ?? 0) / 10;
            const thickness = parseFloat(face.roofThickness ?? c.roofThickness ?? 150);
            const tVertical = thickness * Math.sqrt(1 + slopeVal * slopeVal);
            const baseDelta = parseFloat(face.baseHeightDelta ?? 0);
            const zBase = (face.floor === '1F' ? lvl.FL2 : eavesZ2F) + baseDelta;

            let ux = 0, uy = 1;
            const pA = (face.slopeLine && face.slopeLine.length > 0) ? face.slopeLine[0] : face.vertices[0];
            if (pA) {
                if (face.slopeLine && face.slopeLine.length >= 3) {
                    const pB = face.slopeLine[1], pC = face.slopeLine[2];
                    const dx = pB.x - pA.x, dy = pB.y - pA.y;
                    let nx = -dy, ny = dx;
                    if ((nx*(pC.x-pA.x) + ny*(pC.y-pA.y)) < 0) { nx=-nx; ny=-ny; }
                    const len = Math.hypot(nx, ny);
                    ux = len > 0 ? nx/len : 0; uy = len > 0 ? ny/len : 1;
                } else if (face.slopeLine && face.slopeLine.length === 2) {
                    const p2 = face.slopeLine[1];
                    const dx=p2.x-pA.x, dy=p2.y-pA.y, len=Math.hypot(dx,dy); 
                    ux=len>0?dx/len:0; uy=len>0?dy/len:1;
                }
            }

            let topPts = [];
            let botPts = [];
            const offsetVertices = this.offsetPolygon(face.vertices, wallThick);
            const verticesToUse = offsetVertices.length >= 3 ? offsetVertices : face.vertices;

            verticesToUse.forEach(v => {
                const u = direction === 'X' ? v.y : v.x;
                const dist = (v.x - pA.x)*ux + (v.y - pA.y)*uy;
                const zTop = zBase + dist * slopeVal + tVertical;
                topPts.push({u: u, z: zTop});
                botPts.push({u: u, z: zTop - tVertical});
            });

            let poly = [];
            for (let j = 0; j < topPts.length; j++) poly.push(topPts[j]);
            for (let j = botPts.length - 1; j >= 0; j--) poly.push(botPts[j]);

            // バウンディングボックスと上端/下端の幅から図形を判定
            let uMin = Infinity, uMax = -Infinity, zMin = Infinity, zMax = -Infinity;
            poly.forEach(p => {
                if (p.u < uMin) uMin = p.u; if (p.u > uMax) uMax = p.u;
                if (p.z < zMin) zMin = p.z; if (p.z > zMax) zMax = p.z;
            });
            const w_mm = uMax - uMin;
            if (w_mm < 10) return;

            let topUmin = Infinity, topUmax = -Infinity;
            poly.forEach(p => {
                if (Math.abs(p.z - zMax) < 100) { // 上端付近の幅
                    if (p.u < topUmin) topUmin = p.u; if (p.u > topUmax) topUmax = p.u;
                }
            });
            const topW = (topUmax !== -Infinity) ? topUmax - topUmin : 0;
            const isTri = topW < 100; // 上辺がほぼないなら三角形として扱う

            let isLeftHigh = true;
            if (isTri) {
                const maxZ_U = (topUmax !== -Infinity) ? (topUmin + topUmax) / 2 : (uMin + uMax) / 2;
                isLeftHigh = (maxZ_U - uMin) <= (uMax - maxZ_U);
            }

            const hL_val = isTri ? (isLeftHigh ? (zMax - zMin) : 0) : (zMax - zMin);
            const hR_val = isTri ? (isLeftHigh ? 0 : (zMax - zMin)) : (zMax - zMin);

            const prim = {
                type: isTri ? 'tri' : 'rect',
                floor: face.floor,
                name: `屋根`,
                uMin: uMin, uMax: uMax, zMin: zMin, zMax: zMax,
                shape: {
                    type: isTri ? 'tri' : 'rect',
                    uStart: uMin, w: w_mm,
                    hL: hL_val, hR: hR_val,
                    zBot: zMin
                },
                vertices: isTri 
                    ? (isLeftHigh 
                        ? [ { u: uMin, z: zMin }, { u: uMax, z: zMin }, { u: uMin, z: zMax } ]
                        : [ { u: uMin, z: zMin }, { u: uMax, z: zMin }, { u: uMax, z: zMax } ])
                    : [ { u: uMin, z: zMin }, { u: uMax, z: zMin }, { u: uMax, z: zMax }, { u: uMin, z: zMax } ]
            };

            // 手前と奥の屋根面が完全に重なる場合の重複排除
            const isDuplicate = primitives.some(p => 
                p.name === '屋根' && p.floor === prim.floor && p.type === prim.type &&
                Math.abs(p.uMin - prim.uMin) < 10 && Math.abs(p.uMax - prim.uMax) < 10 &&
                Math.abs(p.zMin - prim.zMin) < 10 && Math.abs(p.zMax - prim.zMax) < 10
            );

            if (!isDuplicate) {
                primitives.push(prim);
                if (face.floor === '1F') roof1FPrimitives.push(prim);
            }
        });

        // 1F屋根と2F外壁の干渉回避用ヘルパー
        const getRoof1FZMax = (uMin, uMax) => {
            let maxZ = lvl.FL2;
            roof1FPrimitives.forEach(rp => {
                // 重なり判定
                if (Math.max(uMin, rp.uMin) < Math.min(uMax, rp.uMax)) {
                    maxZ = Math.max(maxZ, rp.zMax);
                }
            });
            return maxZ;
        };

        // 3. 外壁 (1F, 2F) の大区画抽出
        ['1F', '2F'].forEach(f => {
            const zTop = f === '1F' ? lvl.FL2 : eavesZ2F;
            const polys = this.getFloorExteriorPolygons(f, s);
            const segments = this._getProjectedWallSegments(polys, direction);
            
            segments.forEach(seg => {
                const w_mm = seg.uMax - seg.uMin;
                if (w_mm < 10) return;
                
                let zBot = f === '1F' ? lvl.FL1 : lvl.FL2;
                if (f === '2F') {
                    // 2F外壁の下端を、直下の1F屋根の最高点まで切り上げる (重なり防止)
                    const roofZ = getRoof1FZMax(seg.uMin, seg.uMax);
                    if (roofZ > zBot) zBot = roofZ;
                }
                
                if (zTop - zBot > 10) { // 高さが十分ある場合のみ
                    primitives.push({
                        type: 'rect', floor: f, name: `外壁`,
                        uMin: seg.uMin, uMax: seg.uMax, zMin: zBot, zMax: zTop,
                        shape: {
                            type: 'rect', uStart: seg.uMin, w: w_mm,
                            hL: zTop - zBot, hR: zTop - zBot, zBot: zBot
                        },
                        vertices: [
                            { u: seg.uMin, z: zBot },
                            { u: seg.uMax, z: zBot },
                            { u: seg.uMax, z: zTop },
                            { u: seg.uMin, z: zTop }
                        ]
                    });
                }
            });
        });

        return { primitives, lvl, eavesZ2F };
    },

    updateProjectedAreas: function(state) {
        if (typeof ClipperLib === 'undefined') {
            console.error("ClipperLib is not loaded.");
            return;
        }

        const s = state || window.AppState;
        const c = s.config || {};
        
        const areas = { '1F': { x: 0, y: 0 }, '2F': { x: 0, y: 0 } };
        const formulaAreas = { '1F': { x: [], y: [] }, '2F': { x: [], y: [] } };
        
        const numberCircle = (num) => num <= 20 ? String.fromCharCode(0x245F + num) : `(${num})`;

        ['X', 'Y'].forEach(dir => {
            const key = dir === 'X' ? 'x' : 'y';
            const { primitives, lvl } = this.getProjectedPrimitives(dir, s);
            
            let zoneIdx = 1;

            ['1F', '2F'].forEach(f => {
                const cutBot = f === '1F' ? lvl.cut1 : lvl.cut2;
                const cutTop = f === '1F' ? lvl.cut2 : 100000; // 2Fは無限大
                
                let floorTotalAreaSqM = 0;
                
                // 階ごとのプリミティブを取り出し、カットラインで上下をクリップする
                primitives.forEach(prim => {
                    if (prim.floor !== f) return;
                    if (prim.zMax <= cutBot) return; // 完全にカットラインより下
                    
                    const sh = prim.shape;
                    // クリッピング計算
                    let cZBot = Math.max(sh.zBot, cutBot);
                    let cZTopL = Math.min(sh.zBot + sh.hL, cutTop);
                    let cZTopR = Math.min(sh.zBot + sh.hR, cutTop);
                    
                    if (sh.type === 'tri') {
                        // 三角形の高さクリップによる台形化を簡易的に矩形+三角にする等あるが、
                        // 審査用としては元の大きな三角形の式を出した方が綺麗な場合が多い。
                        // 今回は単純な面積合計を合わせるため、クリップ後の高さで再計算する。
                        // 厳密なクリッピングは台形を生むが、Constructive方針に従い、
                        // 頂点がカットされない前提とする（屋根は基本的にカットラインより上にある）。
                        cZBot = Math.max(sh.zBot, cutBot);
                    }
                    
                    const hL_c = Math.max(0, cZTopL - cZBot);
                    const hR_c = Math.max(0, cZTopR - cZBot);
                    if (hL_c < 10 && hR_c < 10) return; // 潰れた
                    
                    const w_m = sh.w / 1000;
                    let area = 0;
                    let formula = "";
                    
                    if (sh.type === 'rect') {
                        const h_m = hL_c / 1000;
                        area = w_m * h_m;
                        formula = `${w_m.toFixed(3)} × ${h_m.toFixed(3)}`;
                    } else if (sh.type === 'tri') {
                        const h_m = Math.max(hL_c, hR_c) / 1000;
                        area = (w_m * h_m) / 2;
                        formula = `${w_m.toFixed(3)} × ${h_m.toFixed(3)} / 2`;
                    }
                    
                    if (area > 0.01) {
                        floorTotalAreaSqM += area;
                        formulaAreas[f][key].push({
                            id: zoneIdx++,
                            name: numberCircle(zoneIdx - 1),
                            formula: formula,
                            area: area,
                            shape: { type: sh.type, uStart: sh.uStart, w: sh.w, hL: hL_c, hR: hR_c, zBot: cZBot }
                        });
                    }
                });
                
                areas[f][key] = floorTotalAreaSqM;
            });
        });

        c.projectedAreas = c.projectedAreas || { '1F': {x:0, y:0}, '2F': {x:0, y:0} };
        c.projectedAreas['1F'].x = areas['1F'].x;
        c.projectedAreas['1F'].y = areas['1F'].y;
        c.projectedAreas['2F'].x = areas['2F'].x;
        c.projectedAreas['2F'].y = areas['2F'].y;
        c.elevationFormulaAreas = formulaAreas;
        this.syncToDOM(areas);
    },

    syncToDOM: function(areas) {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val.toFixed(2);
        };
        setVal('a-wx1', areas['1F'].x);
        setVal('a-wy1', areas['1F'].y);
        setVal('a-wx2', areas['2F'].x);
        setVal('a-wy2', areas['2F'].y);
    }
};
