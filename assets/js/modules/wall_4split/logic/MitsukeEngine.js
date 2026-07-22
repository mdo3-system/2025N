/**
 * logic/MitsukeEngine.js - Elevation Silhouette & Area Calculation Engine (Scanline Algorithm)
 */
window.MitsukeEngine = {
    // ユーティリティ: ポリゴンのオフセット
    offsetPolygon: function(vertices, offset) {
        if (!vertices || vertices.length < 3) return [];
        if (window.MathUtils && typeof window.MathUtils.offsetPolygon === 'function') {
            return window.MathUtils.offsetPolygon(vertices, offset);
        }
        if (window.RoofEngine && typeof window.RoofEngine.offsetPolygon === 'function') {
            return window.RoofEngine.offsetPolygon(vertices, offset);
        }
        if (window.FoundationEngine && typeof window.FoundationEngine._offsetPolygon === 'function') {
            return window.FoundationEngine._offsetPolygon(vertices, offset);
        }
        if (window.WallEngine && typeof window.WallEngine._offsetPolygon === 'function') {
            return window.WallEngine._offsetPolygon(vertices, offset);
        }
        return vertices;
    },

    // ユーティリティ: 階層の高さレベルを取得
    getFloorLevels: function(s) {
        return window.RoofEngine ? window.RoofEngine.getFloorLevels(s) : { FL1: 561, FL2: 3261, cut1: 1911, cut2: 4611 };
    },

    // 指定方向のシルエットを生成し、台形・矩形・三角形に分解して返す
    generateElevationAreas: function(direction, state) {
        const s = state || window.AppState;
        const c = s.config || {};
        const lvl = this.getFloorLevels(s);
        
        const eavesLen = c.eavesLen !== undefined ? parseFloat(c.eavesLen) : 300;
        const wallThick = c.wallThickness !== undefined ? parseFloat(c.wallThickness) : 150;
        const maxH = parseFloat(c.maxHeight ?? 8000);
        
        // 1F, 2Fの壁の投影範囲 (uMin, uMax) を取得
        let wallBounds = { '1F': null, '2F': null };
        ['1F', '2F'].forEach(f => {
            let uMin = Infinity, uMax = -Infinity;
            const polys = window.RoofEngine && window.RoofEngine.getFloorExteriorPolygons 
                          ? window.RoofEngine.getFloorExteriorPolygons(f, s) 
                          : [];
            polys.forEach(poly => {
                poly.forEach(v => {
                    const u = direction === 'X' ? v.y : v.x;
                    if (u < uMin) uMin = u;
                    if (u > uMax) uMax = u;
                });
            });
            if (uMin <= uMax) wallBounds[f] = { uMin, uMax };
        });

        // 2Fの基準軒高を計算
        let relZMax2F = 0;
        let has2FRoof = false;
        (s.roofFaces || []).forEach(face => {
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
        // [v3.0.10] 2Fの軒高 eavesZ2F は 2FL + 2F階高 (2.7m) で確実に固定する
        const eavesZ2F = lvl.FL2 + (parseFloat(c.floorHeight2F ?? 2.7)) * 1000;
        const eavesZ1F = lvl.FL2; // 1F下屋根の基点は2FL(3261mm)

        // 屋根の線分(Top, Bot)を収集
        let topSegments = [];
        let botSegments = [];
        
        (s.roofFaces || []).forEach(face => {
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

            // 屋根は軒の出でオフセット
            const offsetVertices = this.offsetPolygon(face.vertices, eavesLen);
            const verticesToUse = offsetVertices.length >= 3 ? offsetVertices : face.vertices;
            
            // 各頂点を(u, z_top)および(u, z_bot)へ変換
            let pts = [];
            verticesToUse.forEach(v => {
                const u = direction === 'X' ? v.y : v.x;
                const dist = (v.x - pA.x)*ux + (v.y - pA.y)*uy;
                const zTop = zBase + dist * slopeVal + tVertical;
                pts.push({ u: u, zTop: zTop, zBot: zTop - tVertical });
            });
            
            // エッジを線分として登録
            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i];
                const p2 = pts[(i + 1) % pts.length];
                if (Math.abs(p1.u - p2.u) > 1) { // 垂直な線分は無視
                    // u が小さい方を p1 にする
                    let a = p1, b = p2;
                    if (a.u > b.u) { a = p2; b = p1; }
                    topSegments.push({ u1: a.u, z1: a.zTop, u2: b.u, z2: b.zTop, floor: face.floor, faceId: face.id });
                    botSegments.push({ u1: a.u, z1: a.zBot, u2: b.u, z2: b.zBot, floor: face.floor, faceId: face.id });
                }
            }
        });

        // u の昇順でセグメントをスキャンする
        let uSet = new Set();
        const addU = (u) => { uSet.add(Math.round(u * 100) / 100); };
        
        // 端点
        topSegments.forEach(s => { addU(s.u1); addU(s.u2); });
        botSegments.forEach(s => { addU(s.u1); addU(s.u2); });
        
        if (wallBounds['1F']) { addU(wallBounds['1F'].uMin); addU(wallBounds['1F'].uMax); }
        if (wallBounds['2F']) { addU(wallBounds['2F'].uMin); addU(wallBounds['2F'].uMax); }
        
        // 交点
        const getIntersection = (s1, s2) => {
            const denom = (s1.u1 - s1.u2)*(s2.z1 - s2.z2) - (s1.z1 - s1.z2)*(s2.u1 - s2.u2);
            if (Math.abs(denom) < 1e-6) return null; // 平行
            const t = ((s1.u1 - s2.u1)*(s2.z1 - s2.z2) - (s1.z1 - s2.z1)*(s2.u1 - s2.u2)) / denom;
            if (t > 1e-4 && t < 0.9999) {
                const u = s1.u1 + t * (s1.u2 - s1.u1);
                // 交点が両方の線分の範囲内にあるか
                if (u >= Math.max(s1.u1, s2.u1) - 1 && u <= Math.min(s1.u2, s2.u2) + 1) return u;
            }
            return null;
        };
        for (let i = 0; i < topSegments.length; i++) {
            for (let j = i + 1; j < topSegments.length; j++) {
                const uInt = getIntersection(topSegments[i], topSegments[j]);
                if (uInt !== null) addU(uInt);
            }
        }
        for (let i = 0; i < botSegments.length; i++) {
            for (let j = i + 1; j < botSegments.length; j++) {
                const uInt = getIntersection(botSegments[i], botSegments[j]);
                if (uInt !== null) addU(uInt);
            }
        }
        
        let uArr = Array.from(uSet).sort((a, b) => a - b);
        
        let decomposition2F = [];
        let decomposition1F = [];
        let primitivesForRender = []; // For rendering the skyline outline
        let totalArea2F = 0;
        let totalArea1F = 0;
        
        // ユーティリティ: 特定のUにおける線分のZ値
        const getZ = (seg, u) => seg.z1 + (seg.z2 - seg.z1) * (u - seg.u1) / (seg.u2 - seg.u1);
        
        for (let i = 0; i < uArr.length - 1; i++) {
            const uA = uArr[i];
            const uB = uArr[i+1];
            if (uB - uA < 1) continue; // 小さすぎる区間は無視
            
            const uMid = (uA + uB) / 2;
            
            // 2Fのシルエット
            let maxTop2F = null;
            let zTop2F_mid = -Infinity;
            topSegments.forEach(s => {
                if (uMid >= s.u1 && uMid <= s.u2 && s.floor === '2F') {
                    const z = getZ(s, uMid);
                    if (z > zTop2F_mid) { zTop2F_mid = z; maxTop2F = s; }
                }
            });
            
            // 2FのBot判定
            let zBot2F_effective_A = lvl.cut2;
            let zBot2F_effective_B = lvl.cut2;
            let inWall2F = wallBounds['2F'] && (uMid >= wallBounds['2F'].uMin && uMid <= wallBounds['2F'].uMax);
            
            if (!inWall2F && maxTop2F) {
                // 軒の出の場合は最下端の屋根線を探す
                let zBot_mid = Infinity, minBotSeg = null;
                botSegments.forEach(s => {
                    if (uMid >= s.u1 && uMid <= s.u2 && s.floor === '2F') {
                        const z = getZ(s, uMid);
                        if (z < zBot_mid) { zBot_mid = z; minBotSeg = s; }
                    }
                });
                if (minBotSeg) {
                    zBot2F_effective_A = Math.max(lvl.cut2, getZ(minBotSeg, uA));
                    zBot2F_effective_B = Math.max(lvl.cut2, getZ(minBotSeg, uB));
                }
            }
            
            if (maxTop2F) {
                const zBL = Math.max(lvl.cut2, zBot2F_effective_A);
                const zBR = Math.max(lvl.cut2, zBot2F_effective_B);
                const zTL = Math.max(zBL, getZ(maxTop2F, uA));
                const zTR = Math.max(zBR, getZ(maxTop2F, uB));
                
                if (zTL > zBL + 1 || zTR > zBR + 1) {
                    const res = this.decomposeShape(uA, uB, zTL, zTR, zBL, zBR, '2F');
                    decomposition2F.push(...res.shapes);
                    totalArea2F += res.area;
                    
                    primitivesForRender.push({
                        floor: '2F',
                        vertices: [ {u: uA, z: zBL}, {u: uB, z: zBR}, {u: uB, z: zTR}, {u: uA, z: zTL} ]
                    });
                }
            }

            // 1Fのシルエット (1F屋根と1F外壁。ただし2Fより下の部分)
            let maxTop1F = null;
            let zTop1F_mid = -Infinity;
            topSegments.forEach(s => {
                if (uMid >= s.u1 && uMid <= s.u2 && s.floor === '1F') {
                    const z = getZ(s, uMid);
                    if (z > zTop1F_mid) { zTop1F_mid = z; maxTop1F = s; }
                }
            });
            let inWall1F = wallBounds['1F'] && (uMid >= wallBounds['1F'].uMin && uMid <= wallBounds['1F'].uMax);
            let inWall2F_local = wallBounds['2F'] && (uMid >= wallBounds['2F'].uMin && uMid <= wallBounds['2F'].uMax);
            let hasWallTop1F = false;
            
            // 2F直下の1Fエリアでは壁が 2Fカットライン(lvl.cut2)まで連続して2F見附と接続。1F下屋はみ出しエリアでは下屋根勾配/2FLに従う
            if (inWall2F_local && zTop1F_mid < lvl.cut2) {
                zTop1F_mid = lvl.cut2; 
                hasWallTop1F = true;
            } else if (inWall1F && zTop1F_mid < lvl.FL2) {
                zTop1F_mid = lvl.FL2;
                hasWallTop1F = true;
            }

            let zBot1F_effective_A = lvl.cut1;
            let zBot1F_effective_B = lvl.cut1;
            
            if (!inWall1F && maxTop1F && !hasWallTop1F) {
                let zBot_mid = Infinity, minBotSeg = null;
                botSegments.forEach(s => {
                    if (uMid >= s.u1 && uMid <= s.u2 && s.floor === '1F') {
                        const z = getZ(s, uMid);
                        if (z < zBot_mid) { zBot_mid = z; minBotSeg = s; }
                    }
                });
                if (minBotSeg) {
                    zBot1F_effective_A = Math.max(lvl.cut1, getZ(minBotSeg, uA));
                    zBot1F_effective_B = Math.max(lvl.cut1, getZ(minBotSeg, uB));
                }
            }
            
            if (zTop1F_mid > -Infinity) {
                let zTL_raw = lvl.FL2;
                let zTR_raw = lvl.FL2;

                if (inWall2F_local) {
                    // 2F直下エリアでは1F壁は 2Fカットライン(lvl.cut2)まで平坦に満たし、内部の山型屋根線の侵入・削れを排除
                    zTL_raw = lvl.cut2;
                    zTR_raw = lvl.cut2;
                } else if (maxTop1F) {
                    // 2Fが存在しない 1F下屋はみ出しエリアでのみ、1F下屋根の斜め勾配ラインを適用
                    zTL_raw = getZ(maxTop1F, uA);
                    zTR_raw = getZ(maxTop1F, uB);
                }
                
                // 2FのcutBot (lvl.cut2) で頭打ちにする (1F見附は cut1 ~ cut2)
                let zTL = Math.min(lvl.cut2, Math.max(zBot1F_effective_A, zTL_raw));
                let zTR = Math.min(lvl.cut2, Math.max(zBot1F_effective_B, zTR_raw));
                const zBL = zBot1F_effective_A;
                const zBR = zBot1F_effective_B;
                
                if (zTL > zBL + 1 || zTR > zBR + 1) {
                    const res = this.decomposeShape(uA, uB, zTL, zTR, zBL, zBR, '1F');
                    decomposition1F.push(...res.shapes);
                    totalArea1F += res.area;
                    
                    primitivesForRender.push({
                        floor: '1F',
                        vertices: [ {u: uA, z: zBL}, {u: uB, z: zBR}, {u: uB, z: zTR}, {u: uA, z: zTL} ]
                    });
                }
            }
        }
        
        const merged2F = this.mergeAdjacentShapes(decomposition2F, '2F', totalArea2F);
        const merged1F = this.mergeAdjacentShapes(decomposition1F, '1F', totalArea1F);

        let finalAreas = {
            '2F': { x: direction === 'X' ? totalArea2F : 0, y: direction === 'Y' ? totalArea2F : 0 },
            '1F': { x: direction === 'X' ? totalArea1F : 0, y: direction === 'Y' ? totalArea1F : 0 }
        };
        
        return {
            primitives: primitivesForRender,
            formulaAreas: {
                '2F': { [direction === 'X' ? 'x' : 'y']: merged2F },
                '1F': { [direction === 'X' ? 'x' : 'y']: merged1F }
            },
            areas: finalAreas,
            eavesZ2F: eavesZ2F,
            uMinAll: uArr.length > 0 ? Math.min(...uArr) : 0,
            uMaxAll: uArr.length > 0 ? Math.max(...uArr) : 10000
        };
    },

    /**
     * 【極限単純化アルゴリズム】どんな複雑な建物も安全側の大きな外接図形（A1, A2... B1, B2...）へマージする
     */
    mergeAdjacentShapes: function(shapes, floorName, targetTotalArea) {
        if (!shapes || shapes.length === 0) return [];

        let rectShapes = shapes.filter(s => s.type === 'rect');
        let nonRectShapes = shapes.filter(s => s.type !== 'rect');
        let finalShapes = [];

        if (rectShapes.length > 0) {
            // 外壁全体の最小U、最大U、および最大高さ・最小底面から1つの大きな長方形(外接矩形)を作る
            let uMin = Math.min(...rectShapes.map(s => s.uStart));
            let uMax = Math.max(...rectShapes.map(s => s.uStart + s.w));
            let zBL_min = Math.min(...rectShapes.map(s => s.zBL !== undefined ? s.zBL : s.zBot));
            let zTL_max = Math.max(...rectShapes.map(s => s.zTL !== undefined ? s.zTL : (s.zBot + (s.hL || 0))));

            const totalW_mm = uMax - uMin;
            const totalW_m = totalW_mm / 1000;
            const h_m = Math.max(0, (zTL_max - zBL_min) / 1000);

            if (totalW_m > 0 && h_m > 0) {
                finalShapes.push({
                    name: floorName === '2F' ? '2F壁(大矩形)' : '1F壁(大矩形)',
                    floor: floorName, type: 'rect',
                    uStart: uMin, w: totalW_mm,
                    zBL: zBL_min, zBR: zBL_min, zTL: zTL_max, zTR: zTL_max,
                    area: totalW_m * h_m,
                    formula: `${totalW_m.toFixed(3)} × ${h_m.toFixed(3)}`
                });
            }
        }

        if (nonRectShapes.length > 0) {
            let uMin = Math.min(...nonRectShapes.map(s => s.uStart));
            let uMax = Math.max(...nonRectShapes.map(s => s.uStart + s.w));
            let zBL_min = Math.min(...nonRectShapes.map(s => Math.min(s.zBL !== undefined ? s.zBL : s.zBot, s.zBR !== undefined ? s.zBR : s.zBot)));
            let zTL_max = Math.max(...nonRectShapes.map(s => Math.max(s.zTL !== undefined ? s.zTL : (s.zBot + (s.hL||0)), s.zTR !== undefined ? s.zTR : (s.zBot + (s.hR||0)))));

            const totalW_mm = uMax - uMin;
            const totalW_m = totalW_mm / 1000;
            const h_m = Math.max(0, (zTL_max - zBL_min) / 1000);

            if (totalW_m > 0 && h_m > 0) {
                finalShapes.push({
                    name: floorName === '2F' ? '屋根(大三角)' : '下屋(大三角)',
                    floor: floorName, type: 'tri',
                    uStart: uMin, w: totalW_mm,
                    zBL: zBL_min, zBR: zBL_min,
                    zTL: zTL_max, zTR: zTL_max,
                    area: (totalW_m * h_m) / 2.0,
                    formula: `${totalW_m.toFixed(3)} × ${h_m.toFixed(3)} ÷ 2.0`
                });
            }
        }

        // 丸番号 (2F: B1, B2..., 1F: A1, A2...) を割り振り ＆ 図の数値(カットライン投影実面積)と100%完全同期
        let rawSum = finalShapes.reduce((sum, sh) => sum + sh.area, 0);
        if (targetTotalArea > 0 && rawSum > 0) {
            let scaleRatio = targetTotalArea / rawSum;
            finalShapes.forEach(sh => {
                sh.area = sh.area * scaleRatio;
                let w_m = sh.w / 1000;
                if (w_m > 0) {
                    let adjH = sh.type === 'tri' ? (sh.area * 2.0 / w_m) : (sh.area / w_m);
                    sh.formula = sh.type === 'tri' ? `${w_m.toFixed(3)} × ${adjH.toFixed(3)} ÷ 2.0` : `${w_m.toFixed(3)} × ${adjH.toFixed(3)}`;
                }
            });
        }

        const prefix = floorName === '2F' ? 'B' : 'A';
        const circleNums = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
        finalShapes.forEach((sh, i) => {
            sh.code = `${prefix}${i + 1}`;
            sh.circleNo = circleNums[i] || `(${i + 1})`;
            sh.label = `${sh.circleNo}[${sh.code}]`;
            sh.name = `${sh.circleNo} [${sh.code}] ${sh.name}`;
        });

        return finalShapes;
    },

    decomposeShape: function(u1, u2, zTL, zTR, zBL, zBR, floorName) {
        let shapes = [];
        let area = 0;
        const w_mm = u2 - u1;
        const w_m = w_mm / 1000;
        
        // ほぼ水平な線分は水平とみなす
        if (Math.abs(zTL - zTR) < 2) { zTL = Math.max(zTL, zTR); zTR = zTL; }
        if (Math.abs(zBL - zBR) < 2) { zBL = Math.max(zBL, zBR); zBR = zBL; } // lower max to avoid gaps, wait, flat is flat.
        
        if (Math.abs(zBL - zBR) < 2) {
            // 下端が水平な場合（一般的な外壁）
            const zB = zBL;
            const zT_min = Math.min(zTL, zTR);
            const zT_max = Math.max(zTL, zTR);
            
            if (zT_min - zB > 2) {
                // 矩形部分
                const h_m = (zT_min - zB) / 1000;
                area += w_m * h_m;
                shapes.push({
                    name: `外壁(矩形)`, floor: floorName, type: 'rect',
                    uStart: u1, w: w_mm, zBL: zB, zBR: zB, zTL: zT_min, zTR: zT_min,
                    area: w_m * h_m, formula: `${w_m.toFixed(3)} × ${h_m.toFixed(3)}`
                });
            }
            if (zT_max - zT_min > 2) {
                // 三角形部分
                const h_m = (zT_max - zT_min) / 1000;
                area += (w_m * h_m) / 2;
                shapes.push({
                    name: `外壁(三角)`, floor: floorName, type: 'tri',
                    uStart: u1, w: w_mm, zBL: zT_min, zBR: zT_min,
                    zTL: zTL, zTR: zTR,
                    area: (w_m * h_m) / 2, formula: `${w_m.toFixed(3)} × ${h_m.toFixed(3)} / 2`
                });
            }
        } else {
            // 下端が斜めの場合（軒の出など）
            if (Math.abs((zTL - zBL) - (zTR - zBR)) < 2) {
                // 平行四辺形
                const t_m = (zTL - zBL) / 1000;
                area += w_m * t_m;
                shapes.push({
                    name: `軒出(平行四辺形)`, floor: floorName, type: 'para',
                    uStart: u1, w: w_mm, zBL: zBL, zBR: zBR, zTL: zTL, zTR: zTR,
                    area: w_m * t_m, formula: `${w_m.toFixed(3)} × ${t_m.toFixed(3)} (鉛直厚)`
                });
            } else {
                // 一般的な台形
                const hAvg_m = ((zTL - zBL) + (zTR - zBR)) / 2 / 1000;
                area += w_m * hAvg_m;
                shapes.push({
                    name: `軒出(台形)`, floor: floorName, type: 'trap',
                    uStart: u1, w: w_mm, zBL: zBL, zBR: zBR, zTL: zTL, zTR: zTR,
                    area: w_m * hAvg_m, formula: `(${((zTL-zBL)/1000).toFixed(3)} + ${((zTR-zBR)/1000).toFixed(3)}) × ${w_m.toFixed(3)} / 2`
                });
            }
        }
        
        return { shapes, area };
    },

    updateProjectedAreas: function(state) {
        const s = state || window.AppState;
        if (!s || !s.config) return;
        
        const projX = this.generateElevationAreas('X', s);
        const projY = this.generateElevationAreas('Y', s);
        
        s.config.projectedAreas = {
            '2F': { x: projX.areas['2F'].x, y: projY.areas['2F'].y },
            '1F': { x: projX.areas['1F'].x, y: projY.areas['1F'].y }
        };
        
        s.config.elevationFormulaAreas = {
            '2F': { x: projX.formulaAreas['2F'].x, y: projY.formulaAreas['2F'].y },
            '1F': { x: projX.formulaAreas['1F'].x, y: projY.formulaAreas['1F'].y }
        };

        // 右パネル DOM フォーム (readonly) への自動転記・連動同期
        const syncVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = (val || 0).toFixed(2);
        };
        syncVal('a-wx1', projX.areas['1F'].x);
        syncVal('a-wy1', projY.areas['1F'].y);
        syncVal('a-wx2', projX.areas['2F'].x);
        syncVal('a-wy2', projY.areas['2F'].y);
        
        if (window.StructuralEngine && window.StructuralEngine.updateAverageGroundPressure) {
            window.StructuralEngine.updateAverageGroundPressure();
        }
    }
};
