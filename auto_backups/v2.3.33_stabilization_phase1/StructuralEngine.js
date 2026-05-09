/**
 * logic/StructuralEngine.js - Structural Calculation Engine
 * v2.3.25 Refactoring
 */

window.StructuralEngine = {
    /**
     * Master calculation trigger
     */
    runAnalysis: function() {
        const state = window.AppState;
        console.log(`📐 [${window.APP_VERSION || 'v2.x'}] Running Structural Analysis...`);
        
        // 0. Preliminary Analysis
        if (window.GridEngine) window.GridEngine.analyzeGrids(state);

        // 1. Core Structural Logic
        if (typeof updateWallSelects === 'function') updateWallSelects();
        
        // Area Calculations (v2.3.13 Modularized)
        if (window.AreaEngine) {
            state.requiredAreas = window.AreaEngine.calculateRequiredWallAreas(state);
            window.AreaEngine.calculatePillarLoadAreas(state);
        }

        if (window.NValueEngine) window.NValueEngine.calculateNValues(state);

        // 2. 重心・剛心計算 (v2.3.0 新設)
        state.centerData = {
            '1F': this.calculateCenterOfMass('1F', state),
            '2F': this.calculateCenterOfMass('2F', state)
        };

        // 3. Foundation Logic (if applicable)
        if (state.currentAppMode === 'foundation') {
            this.runFoundationAnalysis();
        }

        // 4. 4-Division Sync
        this.sync4DivisionBounds();
    },

    runFoundationAnalysis: function() {
        if (typeof reconstructContinuousBeams === 'function') reconstructContinuousBeams();
        this.updateAverageGroundPressure();
        if (typeof calculateFoundationSlabAnalysis === 'function') {
            calculateFoundationSlabAnalysis(window.AppState.foundationSlabs, window.AppState.averageBuildingPressure);
        }
        this.calculateSlabTributary(window.AppState.foundationSlabs, window.AppState.foundationBeams);
        if (typeof runFoundationBeamAnalysis === 'function') {
            runFoundationBeamAnalysis(window.AppState.foundationBeams, window.AppState.foundationSlabs);
        }
        this.updateAverageGroundPressure();
    },

    calculateSlabTributary: function(slabs, beams) {
        if (!slabs || slabs.length === 0) return;
        const M = window.MathUtils;
        const state = window.AppState;

        (beams || []).forEach(b => {
            b.slabLoad = 0; b.tributaryArea = 0; b.tributaryWidth = 0;
        });

        const triMult = state.config.triangleMultiplier || 1.33;
        const gPressure = state.averageGroundPressure || 15.0;

        slabs.forEach(slab => {
            if (!slab.vertices || slab.vertices.length < 3) return;

            let pts = slab.vertices.map(v => ({ x: v.x, y: v.y }));
            M.ensureCCW(pts);
            
            const n = pts.length;
            const edges = [];
            for (let i = 0; i < n; i++) {
                const p1 = pts[i], p2 = pts[(i + 1) % n];
                const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
                const nx = -dy / (L || 1), ny = dx / (L || 1);
                edges.push({ p1, p2, nx, ny, d: nx * p1.x + ny * p1.y, L });
            }

            const tributaryPolygons = [];
            for (let i = 0; i < n; i++) {
                let poly = [...pts];
                const Ei = edges[i];
                for (let j = 0; j < n; j++) {
                    if (i === j) continue;
                    const Ej = edges[j];
                    const cA = Ei.nx - Ej.nx, cB = Ei.ny - Ej.ny, cC = Ej.d - Ei.d;
                    if (Math.abs(cA) > 1e-7 || Math.abs(cB) > 1e-7) {
                        poly = M.clipPolygonStrict(poly, cA, cB, cC);
                    }
                }

                poly = M.dedupPolygon(poly, 5);
                const area = M.polygonArea(poly);
                const L = Ei.L || 1;
                
                if (area > 100) {
                    let currentWidth = area / L;
                    if (poly.length === 3) currentWidth = (area * triMult) / L;

                    const tribEntry = { beamId: null, polygon: poly, area: area, width: currentWidth, edgeLength: L };
                    tributaryPolygons.push(tribEntry);

                    const mx = (Ei.p1.x + Ei.p2.x) / 2, my = (Ei.p1.y + Ei.p2.y) / 2;
                    let bestBeam = null, minDist = 50; 
                    (beams || []).forEach(b => {
                        if (!b.p1 || !b.p2) return;
                        const d = M.distToBeamLine(mx, my, b.p1.x, b.p1.y, b.p2.x, b.p2.y);
                        if (d < minDist) { minDist = d; bestBeam = b; }
                    });

                    if (bestBeam) {
                        tribEntry.beamId = bestBeam.id;
                        bestBeam.tributaryArea += area;
                        bestBeam.tributaryWidth += currentWidth;
                        bestBeam.slabLoad += (area / 1000000) * gPressure;
                    }
                }
            }
            slab.tributaryPolygons = tributaryPolygons;
        });
    },

    updateAverageGroundPressure: function() {
        const state = window.AppState;
        const c = state.config;
        const a1 = c.floorAreas['1F'] || 0;
        const a2 = c.floorAreas['2F'] || 0;
        const aRoof = Math.max(a1, a2);
        
        const wRoof = (Number(c.weights.roof) + Number(c.weights.solar) + Number(c.weights.ceilingIns)) / 1000;
        const wFloor = 2.4; 
        const wWallSpec = (Number(c.weights.exteriorWall) + Number(c.weights.wallIns)) / 1000;
        const aWallEst = (a1 + a2) * 1.0; 
        
        const buildingW = (a1 * wFloor) + (a2 * wFloor) + (aRoof * wRoof) + (aWallEst * wWallSpec);
        const totalSlabArea = (state.foundationSlabs || []).reduce((sum, s) => {
            const area = window.MathUtils.polygonArea(s.vertices);
            return sum + (Number(area) / 1000000);
        }, 0) || 0;
        
        const foundationW = totalSlabArea * 5.0;
        const totalW = buildingW + foundationW;
        
        if (totalSlabArea > 0) {
            state.averageBuildingPressure = buildingW / totalSlabArea;
            state.averageGroundPressure = totalW / totalSlabArea;
        } else {
            state.averageBuildingPressure = 0;
            state.averageGroundPressure = 0;
        }
    },

    sync4DivisionBounds: function() {
        const state = window.AppState;
        ['1F', '2F'].forEach(f => {
            if (window.GridEngine && window.GridEngine.get4DivisionBounds) {
                window.GridEngine.get4DivisionBounds(f, state);
            }
        });
    },

    /**
     * 重心と剛心を計算します
     * @param {string} floor - 階 ('1F' or '2F')
     * @param {Object} state - アプリケーション状態
     * @returns {Object} { G: {x,y}, C: {x,y}, totalArea, xWalls, yWalls, kxt, kyt }
     */
    calculateCenterOfMass: function(floor, state) {
        const M = window.MathUtils;
        let polys = state.areaLines.filter(a => a.floor === floor);
        let Gx = 0, Gy = 0, totalArea = 0;

        // 1. 重心計算
        if (polys.length > 0) {
            let sumCx = 0, sumCy = 0;
            polys.forEach(poly => {
                let c = M.polygonCentroid(poly.vertices);
                if (c && c.area > 0) { 
                    totalArea += c.area; 
                    sumCx += c.x * c.area; 
                    sumCy += c.y * c.area; 
                }
            });
            if (totalArea > 0) { 
                Gx = sumCx / totalArea; 
                Gy = sumCy / totalArea; 
            }
        }

        // 床面積がない場合の略算
        if (Gx === 0 && Gy === 0) {
            let ap = state.pillars.filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === floor || p.floor === 'ALL'));
            if (ap.length > 0) {
                Gx = ap.reduce((s, p) => s + p.x, 0) / ap.length;
                Gy = ap.reduce((s, p) => s + p.y, 0) / ap.length;
            }
        }

        // 2. 剛心計算
        let kxt = 0, kyt = 0, sx = 0, sy = 0;
        let xWalls = [], yWalls = [];
        
        state.walls.filter(w => w.floor === floor).forEach(w => {
            let dx = Math.abs(w.p2.x - w.p1.x) / 1000;
            let dy = Math.abs(w.p2.y - w.p1.y) / 1000;
            let tv = (typeof window.getWallTotalVal === 'function') ? window.getWallTotalVal(w) : (w.totalVal || 0);

            let cx = (w.p1.x + w.p2.x) / 2;
            let cy = (w.p1.y + w.p2.y) / 2;

            let kx = dx * tv;
            let ky = dy * tv;

            kxt += kx; sy += kx * cy; 
            kyt += ky; sx += ky * cx;
            
            if (kx > 0) xWalls.push({ val: kx, pos: cy });
            if (ky > 0) yWalls.push({ val: ky, pos: cx });
        });

        let Cx = kyt > 0 ? sx / kyt : Gx;
        let Cy = kxt > 0 ? sy / kxt : Gy;

        return {
            G: { x: Gx, y: Gy },
            C: { x: Cx, y: Cy },
            totalArea: totalArea,
            kxt: kxt,
            kyt: kyt,
            xWalls: xWalls,
            yWalls: yWalls,
            sx: sx,
            sy: sy
        };
    },

    /**
     * 柱・壁の直下率を計算します
     * @param {Object} state - アプリケーション状態
     * @returns {Object} 直下率データ
     */
    calculateDirectSupportRatio: function(state) {
        const s = state || window.AppState;
        const p2F = s.pillars.filter(p => p.floor === '2F' && !p.isDeleted && !p.isInvalidPos);
        const p1F = s.pillars.filter(p => p.floor === '1F' && !p.isDeleted && !p.isInvalidPos);

        let pCount2F = p2F.length;
        let pMatch = 0;
        p2F.forEach(p2 => {
            if (p1F.some(p1 => Math.abs(p1.x - p2.x) < 10 && Math.abs(p1.y - p2.y) < 10)) pMatch++;
        });
        let pRatio = pCount2F > 0 ? (pMatch / pCount2F) * 100 : 0;

        const w2F = s.walls.filter(w => w.floor === '2F');
        const w1F = s.walls.filter(w => w.floor === '1F');

        let wLen2FX = 0, wLen2FY = 0;
        let wMatchX = 0, wMatchY = 0;

        const getOverlap = (min2, max2, s1List) => {
            let overlaps = [];
            s1List.forEach(s1 => {
                let start = Math.max(min2, s1.min);
                let end = Math.min(max2, s1.max);
                if (start < end) overlaps.push({ start, end });
            });
            overlaps.sort((a, b) => a.start - b.start);
            let merged = [];
            for (let o of overlaps) {
                if (merged.length === 0) merged.push(o);
                else {
                    let last = merged[merged.length - 1];
                    if (o.start <= last.end) last.end = Math.max(last.end, o.end);
                    else merged.push(o);
                }
            }
            return merged.reduce((sum, o) => sum + (o.end - o.start), 0);
        };

        w2F.forEach(w2 => {
            let dx = Math.abs(w2.p2.x - w2.p1.x);
            let dy = Math.abs(w2.p2.y - w2.p1.y);
            let len = Math.sqrt(dx * dx + dy * dy) / 1000;
            if (len === 0) return;

            if (dx > dy) {
                wLen2FX += len;
                let cy2 = (w2.p1.y + w2.p2.y) / 2;
                let target1F = w1F.filter(w1 => {
                    let dx1 = Math.abs(w1.p2.x - w1.p1.x), dy1 = Math.abs(w1.p2.y - w1.p1.y);
                    if (dy1 >= dx1) return false;
                    let cy1 = (w1.p1.y + w1.p2.y) / 2;
                    return Math.abs(cy2 - cy1) < 100;
                }).map(w1 => ({ min: Math.min(w1.p1.x, w1.p2.x), max: Math.max(w1.p1.x, w1.p2.x) }));
                let min2 = Math.min(w2.p1.x, w2.p2.x), max2 = Math.max(w2.p1.x, w2.p2.x);
                wMatchX += getOverlap(min2, max2, target1F) / 1000;
            } else {
                wLen2FY += len;
                let cx2 = (w2.p1.x + w2.p2.x) / 2;
                let target1F = w1F.filter(w1 => {
                    let dx1 = Math.abs(w1.p2.x - w1.p1.x), dy1 = Math.abs(w1.p2.y - w1.p1.y);
                    if (dx1 > dy1) return false;
                    let cx1 = (w1.p1.x + w1.p2.x) / 2;
                    return Math.abs(cx2 - cx1) < 100;
                }).map(w1 => ({ min: Math.min(w1.p1.y, w1.p2.y), max: Math.max(w1.p1.y, w1.p2.y) }));
                let min2 = Math.min(w2.p1.y, w2.p2.y), max2 = Math.max(w2.p1.y, w2.p2.y);
                wMatchY += getOverlap(min2, max2, target1F) / 1000;
            }
        });

        let wRatioX = wLen2FX > 0 ? (wMatchX / wLen2FX) * 100 : 0;
        let wRatioY = wLen2FY > 0 ? (wMatchY / wLen2FY) * 100 : 0;
        let wRatioTotal = (wLen2FX + wLen2FY) > 0 ? ((wMatchX + wMatchY) / (wLen2FX + wLen2FY)) * 100 : 0;

        return {
            pRatio, pCount2F, pMatch,
            wRatioX, wLen2FX, wMatchX,
            wRatioY, wLen2FY, wMatchY,
            wRatioTotal, wLenTotal: wLen2FX + wLen2FY, wMatchTotal: wMatchX + wMatchY
        };
    }
};
