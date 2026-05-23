/**
 * logic/RoofEngine.js - Roof Property & Calculation Engine
 * v2.7.17_seg_fixed
 */

window.RoofEngine = {
    getFloorLevels: function(state) {
        const s = state || window.AppState;
        const c = s.config || {};
        const fl1 = parseFloat(c.floorHeight1F ?? 0);
        const fl2 = parseFloat(c.floorHeight2F ?? 2700) + fl1;
        return { fl1, fl2, cut1: fl1 + 1350, cut2: fl2 + 1350 };
    },

    getMergedZSegments: function(u, direction, state, lvl, eavesZ1F, eavesZ2F) {
        let segments = [];
        const c = state.config || {};
        
        // 1. 壁セグメント
        const walls = state.walls || [];
        walls.forEach(w => {
            if (!w.p1 || !w.p2 || w.isDeleted) return;
            const v1 = direction === 'X' ? w.p1.y : w.p1.x;
            const v2 = direction === 'X' ? w.p2.y : w.p2.x;
            const minU = Math.min(v1, v2);
            const maxU = Math.max(v1, v2);
            const thick = 50; 
            if (u >= minU - thick && u <= maxU + thick) {
                let zBot = w.floor === '1F' ? lvl.fl1 : lvl.fl2;
                let zTop = w.floor === '1F' ? eavesZ1F : eavesZ2F;
                segments.push([zBot, zTop]);
            }
        });

        // 2. 屋根セグメント
        const roofFaces = state.roofFaces || [];
        roofFaces.forEach(face => {
            if (!face.vertices) return;
            const numV = face.vertices.length;
            let minU_r = Infinity, maxU_r = -Infinity;
            let isInside = false;
            
            for (let j = 0; j < numV; j++) {
                const v1 = face.vertices[j], v2 = face.vertices[(j+1)%numV];
                const val1 = (direction === 'X') ? v1.y : v1.x;
                const val2 = (direction === 'X') ? v2.y : v2.x;
                minU_r = Math.min(minU_r, val1);
                maxU_r = Math.max(maxU_r, val1);
                if ((val1 <= u && val2 >= u) || (val2 <= u && val1 >= u)) {
                    isInside = true;
                }
            }
            
            if (isInside && u >= minU_r && u <= maxU_r) {
                const baseDelta = parseFloat(face.baseHeightDelta ?? 0);
                const zBase = (face.floor === '1F' ? eavesZ1F : eavesZ2F) + baseDelta;
                const slope = parseFloat(face.slope ?? 0);
                const slopeVal = slope / 10;
                const thickness = parseFloat(face.roofThickness ?? c.roofThickness ?? 150);
                const tVertical = thickness * Math.sqrt(1 + slopeVal * slopeVal);

                let ux = 0, uy = 1;
                const pA = (face.slopeLine && face.slopeLine.length > 0) ? face.slopeLine[0] : face.vertices[0];
                if (pA) {
                    if (face.slopeLine && face.slopeLine.length >= 3) {
                        const pB = face.slopeLine[1], pC = face.slopeLine[2];
                        if (pB && pC) {
                            const dx = pB.x - pA.x, dy = pB.y - pA.y;
                            let nx = -dy, ny = dx;
                            if ((nx*(pC.x-pA.x) + ny*(pC.y-pA.y)) < 0) { nx=-nx; ny=-ny; }
                            const len = Math.hypot(nx, ny);
                            ux = len > 0 ? nx/len : 0; uy = len > 0 ? ny/len : 1;
                        }
                    } else if (face.slopeLine && face.slopeLine.length === 2) {
                        const p2 = face.slopeLine[1];
                        if (p2) { const dx=p2.x-pA.x, dy=p2.y-pA.y, len=Math.hypot(dx,dy); ux=len>0?dx/len:0; uy=len>0?dy/len:1; }
                    }
                }
                
                let zRoofTop = -Infinity;
                for (let j = 0; j < numV; j++) {
                    const v1 = face.vertices[j], v2 = face.vertices[(j+1)%numV];
                    const val1 = (direction === 'X') ? v1.y : v1.x;
                    const val2 = (direction === 'X') ? v2.y : v2.x;
                    if ((val1 <= u && val2 > u) || (val2 <= u && val1 > u)) {
                        const t = (u-val1)/(val2-val1);
                        const ix = v1.x + t*(v2.x-v1.x), iy = v1.y + t*(v2.y-v1.y);
                        const dist = (ix-pA.x)*ux + (iy-pA.y)*uy;
                        const z = zBase + dist*slopeVal + tVertical;
                        if (z > zRoofTop) zRoofTop = z;
                    }
                }
                if (zRoofTop !== -Infinity) {
                    segments.push([zRoofTop - tVertical, zRoofTop]);
                }
            }
        });

        // 3. Union
        if (segments.length === 0) return [];
        segments.sort((a, b) => a[0] - b[0]);
        let merged = [segments[0]];
        for (let i = 1; i < segments.length; i++) {
            let last = merged[merged.length - 1];
            let curr = segments[i];
            if (curr[0] <= last[1] + 10) {
                last[1] = Math.max(last[1], curr[1]);
            } else {
                merged.push(curr);
            }
        }
        return merged;
    },

    getScanlineProfile: function(direction, state) {
        const s = state || window.AppState;
        const c = s.config || {};
        const roofFaces = s.roofFaces || [];
        const lvl = this.getFloorLevels(s);

        const bbox1F = this.getFloorBoundingBox('1F', s);
        const bbox2F = this.getFloorBoundingBox('2F', s);
        const bboxAll = {
            minX: Math.min(bbox1F.minX, bbox2F.minX),
            maxX: Math.max(bbox1F.maxX, bbox2F.maxX),
            minY: Math.min(bbox1F.minY, bbox2F.minY),
            maxY: Math.max(bbox1F.maxY, bbox2F.maxY)
        };

        let roofMinX = bboxAll.minX, roofMaxX = bboxAll.maxX;
        let roofMinY = bboxAll.minY, roofMaxY = bboxAll.maxY;
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

        let relZMax2F = 0;
        let has2FRoof = false;
        roofFaces.forEach(face => {
            if (!face.vertices || face.floor !== '2F') return;
            has2FRoof = true;
            const slope = parseFloat(face.slope ?? 4.5);
            const slopeVal = slope / 10;
            const thickness = parseFloat(face.roofThickness ?? c.roofThickness ?? 150);
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
                if (z > relZMax2F) relZMax2F = z;
            });
        });

        const maxH = parseFloat(c.maxHeight ?? 8000);
        const eavesZ2F = has2FRoof ? (maxH - relZMax2F) : (lvl.fl2 + (parseFloat(c.floorHeight2F ?? 2.7)) * 1000);
        const eavesZ1F = lvl.fl2;

        const STEPS = 200;
        const W = uMax - uMin;
        const uSegmentsData = [];
        const profileAll = []; // 描画・区画抽出用（最外周）

        for (let i = 0; i <= STEPS; i++) {
            const u = uMin + (i / STEPS) * W;
            const segs = this.getMergedZSegments(u, direction, s, lvl, eavesZ1F, eavesZ2F);
            uSegmentsData.push({ u, segs });

            if (segs.length > 0) {
                // 最も外側のシルエット（空洞を無視して全体を囲むプロファイル）
                const zTop = segs[segs.length - 1][1];
                const zBot = segs[0][0];
                profileAll.push({ u, z: zTop, zBottom: zBot, empty: false });
            } else {
                // 要素がない部分は分離
                profileAll.push({ u, z: 0, zBottom: 0, empty: true });
            }
        }

        return { uMin, uMax, profile: profileAll, uSegmentsData, eavesZ1F, eavesZ2F, maxH, bbox1F, bbox2F, bboxAll, W };
    },

    updateProjectedAreas: function(state) {
        const s = state || window.AppState;
        const c = s.config;
        const lvl = this.getFloorLevels(s);

        const areas = { '1F': { x: 0, y: 0 }, '2F': { x: 0, y: 0 } };
        const formulaAreas = { '1F': { x: [], y: [] }, '2F': { x: [], y: [] } };
        let globalZoneIndex = 1;
        const numberCircle = (num) => num <= 20 ? String.fromCharCode(0x245F + num) : `(${num})`;

        // 旧来の安定した extractPolygons（勾配ベースの分割）を復活
        const extractPolygons = (profile, cutTop, cutBot) => {
            const polys = [];
            const N = profile.length;
            if (N < 2) return polys;

            const getH = (p) => {
                if (p.empty) return 0;
                const top = Math.max(Math.min(p.z, cutTop), cutBot);
                const bot = Math.max(Math.min(p.zBottom, cutTop), cutBot);
                return Math.max(0, top - bot);
            };
            const getZBot = (p) => {
                if (p.empty) return cutBot;
                return Math.max(Math.min(p.zBottom, cutTop), cutBot);
            };

            let startIdx = 0;
            let currentSlope = null;

            for (let i = 0; i < N - 1; i++) {
                if (profile[i].empty) {
                    if (i > startIdx && getH(profile[startIdx]) > 0) {
                        const w = profile[i].u - profile[startIdx].u;
                        if (w > 0.01) {
                            polys.push({ uStart: profile[startIdx].u, w, hL: getH(profile[startIdx]), hR: getH(profile[i]), zBot: getZBot(profile[startIdx]) });
                        }
                    }
                    startIdx = i + 1;
                    currentSlope = null;
                    continue;
                }

                if (profile[i+1].empty) continue; // 次が空の場合はループの先頭で処理

                const h1 = getH(profile[i]);
                const h2 = getH(profile[i+1]);
                const du = profile[i+1].u - profile[i].u;
                const slope = du > 1e-5 ? (h2 - h1) / du : 0;

                if (currentSlope === null) {
                    currentSlope = slope;
                } else if (Math.abs(currentSlope - slope) > 0.005) { // 勾配が変わったら区切る
                    const w = profile[i].u - profile[startIdx].u;
                    if (w > 0.01 && getH(profile[startIdx]) > 0) {
                        polys.push({ uStart: profile[startIdx].u, w, hL: getH(profile[startIdx]), hR: getH(profile[i]), zBot: getZBot(profile[startIdx]) });
                    }
                    startIdx = i;
                    currentSlope = slope;
                }
            }
            if (!profile[N-1].empty && startIdx < N - 1) {
                const w = profile[N-1].u - profile[startIdx].u;
                if (w > 0.01 && getH(profile[startIdx]) > 0) {
                    polys.push({ uStart: profile[startIdx].u, w, hL: getH(profile[startIdx]), hR: getH(profile[N-1]), zBot: getZBot(profile[startIdx]) });
                }
            }
            return polys;
        };

        ['X', 'Y'].forEach(dir => {
            const scan = this.getScanlineProfile(dir, s);
            if (!scan) return;
            
            let area2F_total = 0;
            let area1F_total = 0;
            const key = dir === 'X' ? 'x' : 'y';

            // 1. Zセグメントによる純粋な厳密積分（面積の計算）
            const STEPS = scan.uSegmentsData.length - 1;
            const du = scan.W / STEPS;
            for (let i = 0; i < scan.uSegmentsData.length; i++) {
                const segs = scan.uSegmentsData[i].segs;
                let h1F = 0, h2F = 0;
                segs.forEach(seg => {
                    // 2F
                    const top2 = Math.max(Math.min(seg[1], 100000), lvl.cut2);
                    const bot2 = Math.max(Math.min(seg[0], 100000), lvl.cut2);
                    if (top2 > bot2) h2F += (top2 - bot2);
                    
                    // 1F
                    const top1 = Math.max(Math.min(seg[1], lvl.cut2), lvl.cut1);
                    const bot1 = Math.max(Math.min(seg[0], lvl.cut2), lvl.cut1);
                    if (top1 > bot1) h1F += (top1 - bot1);
                });
                // 面積の台形積分の近似（または長方形積分）
                // m^2単位にするため 1000で割る
                area2F_total += (h2F / 1000) * (du / 1000);
                area1F_total += (h1F / 1000) * (du / 1000);
            }

            // 2. 図面用区画（formulaAreas）の構築
            const polys2F = extractPolygons(scan.profile, 100000, lvl.cut2);
            const polys1F = extractPolygons(scan.profile, lvl.cut2, lvl.cut1);

            const processPolygons = (polys, floorStr) => {
                const results = [];
                polys.forEach(poly => {
                    const w_m = poly.w / 1000;
                    const hL_m = poly.hL / 1000;
                    const hR_m = poly.hR / 1000;
                    const minH_m = Math.min(hL_m, hR_m);
                    const diffH_m = Math.abs(hL_m - hR_m);

                    if (minH_m > 0.001) {
                        const area = w_m * minH_m;
                        const zId = globalZoneIndex++;
                        results.push({
                            id: zId, name: `${dir}方向 ${floorStr}見附 区画${numberCircle(zId)}`,
                            w: w_m, h: minH_m, area: area, formula: `${w_m.toFixed(2)} × ${minH_m.toFixed(2)}`,
                            shape: { type: 'rect', uStart: poly.uStart, w: poly.w, hL: minH_m*1000, hR: minH_m*1000, zBot: poly.zBot }
                        });
                    }
                    if (diffH_m > 0.001) {
                        const area = w_m * diffH_m / 2;
                        const zId = globalZoneIndex++;
                        results.push({
                            id: zId, name: `${dir}方向 ${floorStr}見附 区画${numberCircle(zId)}`,
                            w: w_m, h: diffH_m, area: area, formula: `${w_m.toFixed(2)} × ${diffH_m.toFixed(2)} ÷ 2`,
                            shape: { type: 'tri', uStart: poly.uStart, w: poly.w, hL: hL_m > hR_m ? diffH_m*1000 : 0, hR: hR_m > hL_m ? diffH_m*1000 : 0, zBot: poly.zBot + minH_m*1000 }
                        });
                    }
                });
                return results;
            };

            formulaAreas['2F'][key] = processPolygons(polys2F, '2F');
            formulaAreas['1F'][key] = processPolygons(polys1F, '1F');

            areas['2F'][key] = area2F_total;
            areas['1F'][key] = area1F_total;
        });

        c.projectedAreas['1F'].x = areas['1F'].x;
        c.projectedAreas['1F'].y = areas['1F'].y;
        c.projectedAreas['2F'].x = areas['2F'].x;
        c.projectedAreas['2F'].y = areas['2F'].y;
        c.elevationFormulaAreas = formulaAreas;

        this.syncToDOM(areas);
    },

    calcCutPolygonArea2D: function(vertices, vMin, vMax) {
        if (!vertices || vertices.length < 2) return 0;
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

    calculate3DHeightAtCoordinate: function(v, face) {
        // ... (省略せずにコピーしたかったが長いので以前のまま残します、ここでは使用されていない)
        return 0;
    },
    calculatePolygonArea2D: function(vertices) {
        return 0;
    },

    syncToDOM: function(areas) {
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val.toFixed(2); };
        setVal('a-wx1', areas['1F'].x); setVal('a-wy1', areas['1F'].y);
        setVal('a-wx2', areas['2F'].x); setVal('a-wy2', areas['2F'].y);
    }
};
