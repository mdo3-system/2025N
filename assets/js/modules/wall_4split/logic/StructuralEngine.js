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
        // console.log(`📐 [${window.APP_VERSION || 'v2.x'}] Running Structural Analysis...`);
        
        // 0. Preliminary Analysis
        if (window.GridEngine) window.GridEngine.analyzeGrids(state);

        // 1. Core Structural Logic
        if (typeof updateWallSelects === 'function') updateWallSelects();
        
        // Area Calculations (v2.3.13 Modularized)
        // Area & Wall Requirement Calculations (v2.3.48 Refactoring)
        if (window.WallEngine) {
            state.requiredAreas = null; // Clear legacy/AreaEngine calculation results
            window.WallEngine.calculateRequirements(state);
            if (window.AreaEngine) {
                const subSelect = document.getElementById('area-calc-sub-select');
                const override = (subSelect && subSelect.value !== 'auto') ? subSelect.value : null;
                window.AreaEngine.calculatePillarLoadAreas(state, override);
            }
        } else if (window.AreaEngine) {
            state.requiredAreas = window.AreaEngine.calculateRequiredWallAreas(state);
            window.AreaEngine.calculatePillarLoadAreas(state);
        }

        if (window.NValueEngine) window.NValueEngine.calculateNValues(state);

        // 2. 重心・剛心計算 (v2.3.0 新設)
        state.centerData = {
            '1F': this.calculateCenterOfMass('1F', state),
            '2F': this.calculateCenterOfMass('2F', state)
        };

        // 3. 必要壁量(m)の算出 (seismic/wind)
        this.calculateRequiredWallAmounts(state);

        // 3.1. 4分割 存在壁量の集計と判定
        this.calculate4DivisionPresence(state);

        // 4. Foundation Logic (if applicable)
        if (state.currentAppMode === 'foundation') {
            this.runFoundationAnalysis();
        }

        // 5. 4-Division Sync
        this.sync4DivisionBounds();
    },

    /**
     * 地震力・風圧力による必要壁量を算出します (m)
     */
    calculateRequiredWallAmounts: function(state) {
        const s = state || window.AppState;
        const c = s.config;
        const r = s.requiredAreas;

        ['1F', '2F'].forEach(f => {
            const cq = c.reqWallCoeffs[f].seismic;
            const cw = c.reqWallCoeffs[f].wind; // AppState.initで共通化済み
            const triMult = c.triangleMultiplier || 1.33;

            // 見付面積 (1階は2階の見付も加算)
            const awx = c.projectedAreas[f].x + (f === '1F' ? c.projectedAreas['2F'].x : 0);
            const awy = c.projectedAreas[f].y + (f === '1F' ? c.projectedAreas['2F'].y : 0);

            const rawArea = (r && r[f] && r[f].seismic != null) ? r[f].seismic : (s.reqWall[f].a_eff || 0);
            const eq = rawArea * cq;
            const wx = awx * cw * triMult;
            const wy = awy * cw * triMult;

            const rw = s.reqWall[f];
            rw.qX = Math.max(eq, wx);
            rw.qY = Math.max(eq, wy);
            rw.eq = eq;
            rw.wx = wx;
            rw.wy = wy;
            // rw.a_eff and rw.basis are preserved from WallEngine if called
            if (r && r[f]) rw.a_eff = r[f].seismic;
        });
    },

    runFoundationAnalysis: function() {
        if (window.FoundationEngine && typeof window.FoundationEngine.runAnalysis === 'function') {
            window.FoundationEngine.runAnalysis(window.AppState);
        } else {
            // Fallback for safety during transition
            if (typeof reconstructContinuousBeams === 'function') reconstructContinuousBeams();
            if (typeof calculateFoundationSlabAnalysis === 'function') {
                calculateFoundationSlabAnalysis(window.AppState.foundationSlabs, window.AppState.averageBuildingPressure);
            }
        }
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
    },

    /**
     * 4分割の側端部存在壁量を集計し、判定結果をAppStateに保存します
     */
    calculate4DivisionPresence: function(state) {
        const s = state || window.AppState;
        const cq = (f) => s.config.reqWallCoeffs[f].seismic;
        const getVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;

        ['1F', '2F'].forEach(f => {
            const walls = s.walls.filter(w => w.floor === f);
            const b = window.GridEngine.get4DivisionBounds(f, s);
            const lv = f.charAt(0);
            
            // UIから側端面積を取得 (AreaEngineによって自動入力済み)
            const ext = getVal(`e-x-t${lv}`), exb = getVal(`e-x-b${lv}`), eyl = getVal(`e-y-l${lv}`), eyr = getVal(`e-y-r${lv}`);
            const q = cq(f);

            let vxt = 0, vxb = 0, vyl = 0, vyr = 0;

            walls.forEach(w => {
                const dx = Math.abs(w.p2.x - w.p1.x) / 1000;
                const dy = Math.abs(w.p2.y - w.p1.y) / 1000;
                const tv = window.WallEngine.getTotalMultiplier(w);

                const cx = (w.p1.x + w.p2.x) / 2;
                const cy = (w.p1.y + w.p2.y) / 2;

                const kx = dx * tv;
                const ky = dy * tv;

                if (b) {
                    if (cy >= b.yLineT - 0.5) vxt += kx;
                    if (cy <= b.yLineB + 0.5) vxb += kx;
                    if (cx <= b.xLineL + 0.5) vyl += ky;
                    if (cx >= b.xLineR - 0.5) vyr += ky;
                }
            });

            const rxt = vxt / (ext * q || 1), rxb = vxb / (exb * q || 1), ryl = vyl / (eyl * q || 1), ryr = vyr / (eyr * q || 1);
            const rx = Math.min(rxt, rxb) / (Math.max(rxt, rxb) || 1), ry = Math.min(ryl, ryr) / (Math.max(ryl, ryr) || 1);
            const isXOk = (rx >= 0.5) || (rxt >= 1.0 && rxb >= 1.0);
            const isYOk = (ry >= 0.5) || (ryl >= 1.0 && ryr >= 1.0);

            // AppStateへ保存 (存在しない場合は初期化)
            if (!s.reqWall[f].div4) {
                s.reqWall[f].div4 = { vxt: 0, vxb: 0, vyl: 0, vyr: 0, rxt: 0, rxb: 0, ryl: 0, ryr: 0, isXOk: true, isYOk: true };
            }
            const d4 = s.reqWall[f].div4;
            d4.vxt = vxt; d4.vxb = vxb; d4.vyl = vyl; d4.vyr = vyr;
            d4.rxt = rxt; d4.rxb = rxb; d4.ryl = ryl; d4.ryr = ryr;
            d4.isXOk = isXOk; d4.isYOk = isYOk;
        });
    }
};
