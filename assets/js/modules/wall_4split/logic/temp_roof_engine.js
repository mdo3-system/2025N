/**
 * logic/RoofEngine.js - Roof Property & Calculation Engine
 * v2.7.17_seg Refactoring (Z-Segment Method)
 */

window.RoofEngine = {
    getFloorLevels: function(state) {
        const s = state || window.AppState;
        const c = s.config || {};
        const fl1 = parseFloat(c.floorHeight1F ?? 0);
        const fl2 = parseFloat(c.floorHeight2F ?? 2700) + fl1;
        return { fl1, fl2, cut1: fl1 + 1350, cut2: fl2 + 1350 };
    },

    /**
     * Zセグメント法: 特定のU座標における壁・屋根の有効なZ範囲を抽出し、結合(Union)する
     */
    getMergedZSegments: function(u, direction, state, lvl, eavesZ1F, eavesZ2F) {
        let segments = [];
        const c = state.config || {};
        
        // 1. 壁セグメントの取得
        const walls = state.walls || [];
        walls.forEach(w => {
            if (!w.p1 || !w.p2 || w.isDeleted) return;
            // 壁の線分としての有効範囲
            const v1 = direction === 'X' ? w.p1.y : w.p1.x;
            const v2 = direction === 'X' ? w.p2.y : w.p2.x;
            const minU = Math.min(v1, v2);
            const maxU = Math.max(v1, v2);
            const thick = 100; // 壁厚による余裕
            
            if (u >= minU - thick && u <= maxU + thick) {
                let zBot = w.floor === '1F' ? lvl.fl1 : lvl.fl2;
                let zTop = w.floor === '1F' ? eavesZ1F : eavesZ2F;
                segments.push([zBot, zTop]);
            }
        });

        // 2. 屋根セグメントの取得
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

        // 3. Z軸上のUnion（結合）
        if (segments.length === 0) return [];
        segments.sort((a, b) => a[0] - b[0]);
        let merged = [segments[0]];
        for (let i = 1; i < segments.length; i++) {
            let last = merged[merged.length - 1];
            let curr = segments[i];
            // 許容誤差(10mm)で結合
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

        // Eaves Z Calculation
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
        const profileAll = []; // 描画用の簡略プロファイル

        const uSegmentsData = [];

        for (let i = 0; i <= STEPS; i++) {
            const u = uMin + (i / STEPS) * W;
            const segs = this.getMergedZSegments(u, direction, s, lvl, eavesZ1F, eavesZ2F);
            uSegmentsData.push({ u, segs });

            if (segs.length > 0) {
                // 描画用のプロファイルとしては、最も外側の輪郭を登録する
                const zAll = segs[segs.length - 1][1];
                const zbAll = segs[0][0];
                profileAll.push({ u, z: zAll, zBottom: zbAll });
            } else {
                profileAll.push({ u, z: 0, zBottom: 0 });
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

        // 連続する Zセグメントから区画ポリゴン（帳票出力用）を構築・積分する関数
        const extractAndCalculateSegments = (uData, cutTop, cutBot, floorStr, dirStr, key, areaRef, formulaRef) => {
            let activeBlocks = []; // 現在追跡中のブロック群
            const completedPolys = [];

            // ブロックの確定と面積追加
            const commitBlock = (block, endU) => {
                const w = endU - block.startU;
                if (w < 10) return; // 10mm未満のノイズは無視
                
                const w_m = w / 1000;
                // 区画の中央での平均的な高さを代表値とする（厳密な面積は台形積分）
                const hL = Math.max(0, Math.min(block.zTopStart, cutTop) - Math.max(block.zBotStart, cutBot));
                const hR = Math.max(0, Math.min(block.lastZTop, cutTop) - Math.max(block.lastZBot, cutBot));
                const hL_m = hL / 1000;
                const hR_m = hR / 1000;
                
                if (hL_m < 0.01 && hR_m < 0.01) return;

                const minH_m = Math.min(hL_m, hR_m);
                const diffH_m = Math.abs(hL_m - hR_m);

                if (minH_m > 0.001) {
                    const area = w_m * minH_m;
                    const zId = globalZoneIndex++;
                    formulaRef.push({
                        id: zId, name: `${dirStr}方向 ${floorStr}見附 区画${numberCircle(zId)}`,
                        w: w_m, h: minH_m, area: area, formula: `${w_m.toFixed(2)} × ${minH_m.toFixed(2)}`,
                        shape: { type: 'rect', uStart: block.startU, w, hL: minH_m*1000, hR: minH_m*1000, zBot: Math.max(block.zBotStart, cutBot) }
                    });
                    areaRef.val += area;
                }

                if (diffH_m > 0.001) {
                    const area = w_m * diffH_m / 2;
                    const zId = globalZoneIndex++;
                    formulaRef.push({
                        id: zId, name: `${dirStr}方向 ${floorStr}見附 区画${numberCircle(zId)}`,
                        w: w_m, h: diffH_m, area: area, formula: `${w_m.toFixed(2)} × ${diffH_m.toFixed(2)} ÷ 2`,
                        shape: { 
                            type: 'tri', uStart: block.startU, w, 
                            hL: hL_m > hR_m ? diffH_m*1000 : 0, 
                            hR: hR_m > hL_m ? diffH_m*1000 : 0, 
                            zBot: Math.max(block.zBotStart, cutBot) + minH_m*1000 
                        }
                    });
                    areaRef.val += area;
                }
            };

            for (let i = 0; i < uData.length; i++) {
                const { u, segs } = uData[i];
                // 対象となるセグメント（カットラインの範囲内にあるもの）だけを抽出
                const validSegs = [];
                segs.forEach(s => {
                    const top = Math.max(Math.min(s[1], cutTop), cutBot);
                    const bot = Math.max(Math.min(s[0], cutTop), cutBot);
                    if (top - bot > 10) validSegs.push([bot, top]); // 10mm以上の有効高さ
                });

                // 新しい u において、activeBlocks を継続できるか判定
                let nextActive = [];
                for (let v of validSegs) {
                    let matched = false;
                    for (let j = 0; j < activeBlocks.length; j++) {
                        let ab = activeBlocks[j];
                        if (ab.matched) continue;
                        
                        // 下端・上端が近い、または勾配通りに推移しているか（簡易判定：重なりがあるか）
                        if (v[0] <= ab.lastZTop + 100 && v[1] >= ab.lastZBot - 100) {
                            ab.lastZBot = v[0];
                            ab.lastZTop = v[1];
                            ab.matched = true;
                            nextActive.push(ab);
                            matched = true;
                            break;
                        }
                    }
                    if (!matched) {
                        // 新規ブロック
                        nextActive.push({ startU: u, zBotStart: v[0], zTopStart: v[1], lastZBot: v[0], lastZTop: v[1], matched: true });
                    }
                }

                // マッチしなかった古いブロックは終了(Commit)
                activeBlocks.forEach(ab => {
                    if (!ab.matched) commitBlock(ab, u);
                });

                // 状態更新
                activeBlocks = nextActive;
                activeBlocks.forEach(ab => ab.matched = false);
            }

            // 最後に残ったブロックを終了
            const lastU = uData[uData.length - 1].u;
            activeBlocks.forEach(ab => commitBlock(ab, lastU));
        };

        ['X', 'Y'].forEach(dir => {
            const scan = this.getScanlineProfile(dir, s);
            if (!scan) return;
            
            let area2F_total = { val: 0 };
            let area1F_total = { val: 0 };
            const key = dir === 'X' ? 'x' : 'y';

            // Zセグメント法に基づく積分と区画抽出
            extractAndCalculateSegments(scan.uSegmentsData, 100000, lvl.cut2, '2F', dir, key, area2F_total, formulaAreas['2F'][key]);
            extractAndCalculateSegments(scan.uSegmentsData, lvl.cut2, lvl.cut1, '1F', dir, key, area1F_total, formulaAreas['1F'][key]);

            areas['2F'][key] = area2F_total.val;
            areas['1F'][key] = area1F_total.val;
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
        const s = window.AppState;
        const c = (s && s.config) ? s.config : {};
        const lvl = this.getFloorLevels(s);
        const floor = face.floor || '2F';
        const slope = face.slope || 0;
        const baseDelta = face.baseHeightDelta || 0;
        
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
                if (z > relZMax2F) relZMax2F = z;
            });
        });

        const maxH = parseFloat(c.maxHeight ?? 8000);
        const eavesZ2F = has2FRoof ? (maxH - relZMax2F) : (lvl.fl2 + (parseFloat(c.floorHeight2F ?? 2.7)) * 1000);
        const eavesZ1F = lvl.fl2;

        const zBase = (floor === '2F' ? eavesZ2F : eavesZ1F) + baseDelta;

        let ux = 0, uy = 1;
        const pA = face.slopeLine ? face.slopeLine[0] : { x: 0, y: 0 };
        if (face.slopeLine && face.slopeLine.length >= 3) {
            const pB = face.slopeLine[1], pC = face.slopeLine[2];
            const dx = pB.x - pA.x, dy = pB.y - pA.y;
            let nx = -dy, ny = dx;
            const vx = pC.x - pA.x, vy = pC.y - pA.y;
            if (nx * vx + ny * vy < 0) { nx = -nx; ny = -ny; }
            const len = Math.hypot(nx, ny);
            ux = len > 0 ? nx / len : 0; uy = len > 0 ? ny / len : 1;
        } else if (face.slopeLine && face.slopeLine.length === 2) {
            const p2 = face.slopeLine[1];
            const dx = p2.x - pA.x, dy = p2.y - pA.y, len = Math.hypot(dx, dy);
            ux = len > 0 ? dx / len : 0; uy = len > 0 ? ny / len : 1;
        }

        const slopeVal = slope / 10;
        const dist = (v.x - pA.x) * ux + (v.y - pA.y) * uy;
        return zBase + dist * slopeVal;
    },

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

    syncToDOM: function(areas) {
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val.toFixed(2); };
        setVal('a-wx1', areas['1F'].x); setVal('a-wy1', areas['1F'].y);
        setVal('a-wx2', areas['2F'].x); setVal('a-wy2', areas['2F'].y);
    }
};
