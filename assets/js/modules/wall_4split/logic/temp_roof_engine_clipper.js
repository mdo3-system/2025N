/**
 * logic/RoofEngine.js - Roof Property & Calculation Engine
 * v2.8.0 - Clipper.js Boolean Polygon Method
 */

window.RoofEngine = {
    getFloorLevels: function(state) {
        const s = state || window.AppState;
        const c = s.config || {};
        const fl1 = parseFloat(c.floorHeight1F ?? 0);
        const fl2 = parseFloat(c.floorHeight2F ?? 2700) + fl1;
        return { fl1, fl2, cut1: fl1 + 1350, cut2: fl2 + 1350 };
    },

    getProjectedPolygons: function(direction, state) {
        const s = state || window.AppState;
        const c = s.config || {};
        const roofFaces = s.roofFaces || [];
        const lvl = this.getFloorLevels(s);
        
        let polygons = [];

        // 1. 外壁の2D投影（階層全体）
        const bbox1F = this.getFloorBoundingBox('1F', s);
        const bbox2F = this.getFloorBoundingBox('2F', s);
        
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
        const eavesZ2F = has2FRoof ? (maxH - relZMax2F) : (lvl.fl2 + (parseFloat(c.floorHeight2F ?? 2.7)) * 1000);
        const eavesZ1F = lvl.fl2;

        const uMin1F = direction === 'X' ? bbox1F.minY : bbox1F.minX;
        const uMax1F = direction === 'X' ? bbox1F.maxY : bbox1F.maxX;
        if (uMax1F > uMin1F) {
            polygons.push([
                {u: uMin1F, z: lvl.fl1}, {u: uMax1F, z: lvl.fl1},
                {u: uMax1F, z: eavesZ1F}, {u: uMin1F, z: eavesZ1F}
            ]);
        }
        
        const uMin2F = direction === 'X' ? bbox2F.minY : bbox2F.minX;
        const uMax2F = direction === 'X' ? bbox2F.maxY : bbox2F.maxX;
        if (uMax2F > uMin2F) {
            polygons.push([
                {u: uMin2F, z: lvl.fl2}, {u: uMax2F, z: lvl.fl2},
                {u: uMax2F, z: eavesZ2F}, {u: uMin2F, z: eavesZ2F}
            ]);
        }

        // 2. 屋根の2D投影
        roofFaces.forEach(face => {
            if (!face.vertices || face.vertices.length < 3) return;
            const slopeVal = parseFloat(face.slope ?? 0) / 10;
            const thickness = parseFloat(face.roofThickness ?? c.roofThickness ?? 150);
            const tVertical = thickness * Math.sqrt(1 + slopeVal * slopeVal);
            const baseDelta = parseFloat(face.baseHeightDelta ?? 0);
            const zBase = (face.floor === '1F' ? eavesZ1F : eavesZ2F) + baseDelta;

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
            
            face.vertices.forEach(v => {
                const u = direction === 'X' ? v.y : v.x;
                const dist = (v.x - pA.x)*ux + (v.y - pA.y)*uy;
                const zTop = zBase + dist * slopeVal + tVertical;
                topPts.push({u: u, z: zTop});
                botPts.push({u: u, z: zTop - tVertical});
            });

            // 頂点を外周順に結合する（投影方向による反転を考慮）
            // 簡易的に上面と下面を繋ぐ
            let poly = [];
            for (let j = 0; j < topPts.length; j++) poly.push(topPts[j]);
            for (let j = botPts.length - 1; j >= 0; j--) poly.push(botPts[j]);
            polygons.push(poly);
        });

        // 共通 bounding box の計算
        let uMinAll = Infinity, uMaxAll = -Infinity;
        polygons.forEach(poly => {
            poly.forEach(p => {
                if (p.u < uMinAll) uMinAll = p.u;
                if (p.u > uMaxAll) uMaxAll = p.u;
            });
        });

        return { polygons, lvl, uMin: uMinAll, uMax: uMaxAll };
    },

    updateProjectedAreas: function(state) {
        if (typeof ClipperLib === 'undefined') {
            console.error("ClipperLib is not loaded. Cannot calculate projected areas.");
            return;
        }

        const s = state || window.AppState;
        const c = s.config;
        const lvl = this.getFloorLevels(s);

        const areas = { '1F': { x: 0, y: 0 }, '2F': { x: 0, y: 0 } };
        const formulaAreas = { '1F': { x: [], y: [] }, '2F': { x: [], y: [] } };
        let globalZoneIndex = 1;
        const numberCircle = (num) => num <= 20 ? String.fromCharCode(0x245F + num) : `(${num})`;

        // 台形を長方形・直角三角形に分解して計算式として登録する関数
        const processTrapezoids = (trapezoids, floorStr, dirStr, resultsArray, areaRef) => {
            trapezoids.forEach(poly => {
                const w_m = poly.w / 1000;
                const hL_m = poly.hL / 1000;
                const hR_m = poly.hR / 1000;
                const minH_m = Math.min(hL_m, hR_m);
                const diffH_m = Math.abs(hL_m - hR_m);

                // 10mm未満の幅の微小ポリゴン（ゴミ）は無視
                if (poly.w < 10) return;

                if (minH_m > 0.001) {
                    const area = w_m * minH_m;
                    const zId = globalZoneIndex++;
                    resultsArray.push({
                        id: zId, name: `${dirStr}方向 ${floorStr}見附 区画${numberCircle(zId)}`,
                        w: w_m, h: minH_m, area: area, formula: `${w_m.toFixed(2)} × ${minH_m.toFixed(2)}`,
                        shape: { type: 'rect', uStart: poly.uStart, w: poly.w, hL: minH_m*1000, hR: minH_m*1000, zBot: poly.zBotL }
                    });
                    areaRef.val += area;
                }
                if (diffH_m > 0.001) {
                    const area = w_m * diffH_m / 2;
                    const zId = globalZoneIndex++;
                    const zBotTri = poly.zBotL + minH_m*1000;
                    resultsArray.push({
                        id: zId, name: `${dirStr}方向 ${floorStr}見附 区画${numberCircle(zId)}`,
                        w: w_m, h: diffH_m, area: area, formula: `${w_m.toFixed(2)} × ${diffH_m.toFixed(2)} ÷ 2`,
                        shape: { type: 'tri', uStart: poly.uStart, w: poly.w, hL: hL_m > hR_m ? diffH_m*1000 : 0, hR: hR_m > hL_m ? diffH_m*1000 : 0, zBot: zBotTri }
                    });
                    areaRef.val += area;
                }
            });
        };

        ['X', 'Y'].forEach(dir => {
            const proj = this.getProjectedPolygons(dir, s);
            if (!proj || proj.polygons.length === 0) return;
            const key = dir === 'X' ? 'x' : 'y';

            const scale = 1000; // ClipperLib のスケールファクタ
            const cpr = new ClipperLib.Clipper();
            const subj = new ClipperLib.Paths();
            
            proj.polygons.forEach(poly => {
                const path = new ClipperLib.Path();
                poly.forEach(p => {
                    path.push(new ClipperLib.IntPoint(Math.round(p.u * scale), Math.round(p.z * scale)));
                });
                subj.push(path);
            });

            // 全部材の Union を計算（最外郭シルエットの生成）
            cpr.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
            const silhouette = new ClipperLib.Paths();
            cpr.Execute(ClipperLib.ClipType.ctUnion, silhouette, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

            // 階ごとの Clipping と台形分割を行うヘルパー関数
            const sliceFloor = (cutBot, cutTop) => {
                const clipPoly = new ClipperLib.Paths();
                const pathClip = new ClipperLib.Path();
                pathClip.push(new ClipperLib.IntPoint(-100000 * scale, cutBot * scale));
                pathClip.push(new ClipperLib.IntPoint( 100000 * scale, cutBot * scale));
                pathClip.push(new ClipperLib.IntPoint( 100000 * scale, cutTop * scale));
                pathClip.push(new ClipperLib.IntPoint(-100000 * scale, cutTop * scale));
                clipPoly.push(pathClip);

                const cprFloor = new ClipperLib.Clipper();
                cprFloor.AddPaths(silhouette, ClipperLib.PolyType.ptSubject, true);
                cprFloor.AddPaths(clipPoly, ClipperLib.PolyType.ptClip, true);
                const floorPolys = new ClipperLib.Paths();
                cprFloor.Execute(ClipperLib.ClipType.ctIntersection, floorPolys, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

                // 全頂点の u (X座標) を収集してソート
                let uSet = new Set();
                floorPolys.forEach(path => {
                    path.forEach(pt => uSet.add(pt.X));
                });
                let uList = Array.from(uSet).sort((a, b) => a - b);

                const trapezoids = [];

                // 各 u の間隔で縦にスライス (Trapezoidal Decomposition)
                for (let i = 0; i < uList.length - 1; i++) {
                    const u1_scaled = uList[i];
                    const u2_scaled = uList[i+1];
                    const w_scaled = u2_scaled - u1_scaled;
                    if (w_scaled < 10 * scale) continue; // 10mm未満の幅のゴミは足切り

                    const u1 = u1_scaled / scale;
                    const u2 = u2_scaled / scale;

                    const clipBand = new ClipperLib.Paths();
                    const bandPath = new ClipperLib.Path();
                    bandPath.push(new ClipperLib.IntPoint(u1_scaled, -100000 * scale));
                    bandPath.push(new ClipperLib.IntPoint(u2_scaled, -100000 * scale));
                    bandPath.push(new ClipperLib.IntPoint(u2_scaled,  100000 * scale));
                    bandPath.push(new ClipperLib.IntPoint(u1_scaled,  100000 * scale));
                    clipBand.push(bandPath);

                    const cprBand = new ClipperLib.Clipper();
                    cprBand.AddPaths(floorPolys, ClipperLib.PolyType.ptSubject, true);
                    cprBand.AddPaths(clipBand, ClipperLib.PolyType.ptClip, true);
                    const bandResult = new ClipperLib.Paths();
                    cprBand.Execute(ClipperLib.ClipType.ctIntersection, bandResult, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

                    bandResult.forEach(path => {
                        let maxZ1 = -Infinity, minZ1 = Infinity;
                        let maxZ2 = -Infinity, minZ2 = Infinity;
                        let found1 = false, found2 = false;

                        // 頂点のZ座標を u1側 と u2側 で集める
                        path.forEach(pt => {
                            const u = pt.X / scale;
                            const z = pt.Y / scale;
                            if (Math.abs(u - u1) < 1.0) {
                                if (z > maxZ1) maxZ1 = z;
                                if (z < minZ1) minZ1 = z;
                                found1 = true;
                            } else if (Math.abs(u - u2) < 1.0) {
                                if (z > maxZ2) maxZ2 = z;
                                if (z < minZ2) minZ2 = z;
                                found2 = true;
                            }
                        });

                        // 正常な台形であれば左右にエッジがある
                        if (found1 && found2 && maxZ1 >= minZ1 && maxZ2 >= minZ2) {
                            trapezoids.push({
                                uStart: u1,
                                w: u2 - u1,
                                hL: maxZ1 - minZ1,
                                hR: maxZ2 - minZ2,
                                zBotL: minZ1,
                                zBotR: minZ2
                            });
                        }
                    });
                }
                return trapezoids;
            };

            let area1Ref = { val: 0 };
            let area2Ref = { val: 0 };

            const traps2F = sliceFloor(lvl.cut2, 100000);
            processTrapezoids(traps2F, '2F', dir, formulaAreas['2F'][key], area2Ref);

            const traps1F = sliceFloor(lvl.cut1, lvl.cut2);
            processTrapezoids(traps1F, '1F', dir, formulaAreas['1F'][key], area1Ref);

            areas['2F'][key] = area2Ref.val;
            areas['1F'][key] = area1Ref.val;
        });

        c.projectedAreas['1F'].x = areas['1F'].x;
        c.projectedAreas['1F'].y = areas['1F'].y;
        c.projectedAreas['2F'].x = areas['2F'].x;
        c.projectedAreas['2F'].y = areas['2F'].y;
        c.elevationFormulaAreas = formulaAreas;

        this.syncToDOM(areas);
    },

    getFloorBoundingBox: function(floor, state) {
        const s = state || window.AppState;
        const c = s.config || {};
        const wallThick = c.wallThickness !== undefined ? parseFloat(c.wallThickness) : 150;
        let points = [];
        const activeExtWalls = (s.exteriorWalls || []).filter(ew => ew.floor === floor && ew.vertices && ew.vertices.length >= 3);
        if (activeExtWalls.length > 0) {
            activeExtWalls.forEach(ew => { points = points.concat(this.offsetPolygon(ew.vertices, wallThick)); });
        } else {
            const boundary = window.WallEngine ? window.WallEngine.extractOuterBoundary(floor, s) : null;
            if (boundary && boundary.length >= 3) { points = points.concat(this.offsetPolygon(boundary, wallThick)); }
        }
        if (points.length === 0) {
            const areas = (s.areaLines || []).filter(a => a.floor === floor);
            areas.forEach(a => { if (a.vertices) { a.vertices.forEach(v => { points.push({ x: v.x, y: v.y }); }); } });
        }
        if (points.length === 0) {
            const coordsX = s.gridXCoords || [];
            const coordsY = s.gridYCoords || [];
            if (coordsX.length > 0) {
                const minX = Math.min(...coordsX), maxX = Math.max(...coordsX);
                const minY = Math.min(...coordsY), maxY = Math.max(...coordsY);
                return { minX: minX - wallThick, maxX: maxX + wallThick, minY: minY - wallThick, maxY: maxY + wallThick };
            }
            return { minX: 0, maxX: 10000, minY: 0, maxY: 10000 };
        }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        points.forEach(v => {
            if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
        });
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
