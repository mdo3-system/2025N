/**
 * logic/FoundationEngine.js - Consolidated Foundation Analysis Engine
 * v2.4.2
 */

window.FoundationEngine = {
    COEFFS: {
        '4辺固定':                     { mcx: 0.025, max: 0.045, mcy: 0.015, may: 0.035 },
        '3辺固定1辺ピン（長辺ピン）':  { mcx: 0.035, max: 0.055, mcy: 0.020, may: 0.040 },
        '3辺固定1辺ピン（短辺ピン）':  { mcx: 0.040, max: 0.065, mcy: 0.025, may: 0.050 },
        '2隣辺固定2隣辺ピン':          { mcx: 0.045, max: 0.075, mcy: 0.035, may: 0.065 },
        '長辺2辺固定短辺2辺ピン':      { mcx: 0.060, max: 0.090, mcy: 0.030, may: 0.000 },
        '短辺2辺固定長辺2辺ピン':      { mcx: 0.030, max: 0.000, mcy: 0.060, may: 0.090 },
        '1辺固定3辺ピン（長辺固定）':  { mcx: 0.065, max: 0.100, mcy: 0.040, may: 0.000 },
        '1辺固定3辺ピン（短辺固定）':  { mcx: 0.050, max: 0.000, mcy: 0.075, may: 0.110 },
        '4辺ピン':                     { mcx: 0.080, max: 0.000, mcy: 0.050, may: 0.000 }
    },

    /**
     * Master Orchestrator for Foundation Analysis
     */
    runAnalysis: function(state) {
        const s = state || window.AppState;
        console.log(`🏗️ [${window.APP_VERSION || 'v2.4.2'}] Running Foundation Analysis...`);

        if (window.AxialEngine) window.AxialEngine.calculateAllAxialForces(s);
        if (typeof reconstructContinuousBeams === 'function') reconstructContinuousBeams();

        this.updateGroundPressure(s);
        this.calculateSlabAnalysis(s.foundationSlabs, s.averageBuildingPressure);
        this.calculateSlabTributary(s.foundationSlabs, s.foundationBeams, s);
        this.runFoundationBeamAnalysis(s.foundationBeams, s.foundationSlabs, s);
        this.updateGroundPressure(s);
        
        console.log("✅ Foundation Analysis Complete.");
    },

    updateGroundPressure: function(state) {
        const s = state;
        const a1 = window.AreaEngine ? window.AreaEngine.getFloorArea('1F', s) : 0;
        const a2 = window.AreaEngine ? window.AreaEngine.getFloorArea('2F', s) : 0;
        const aRoof = Math.max(a1, a2);
        
        const wRoof = ( (s.config?.weights?.roof || 500) + (s.config?.weights?.solar || 0) + (s.config?.weights?.ceilingIns || 100) ) / 1000;
        const wFloor = 2.4; 
        const wWallSpec = ( (s.config?.weights?.exteriorWall || 600) + (s.config?.weights?.wallIns || 70) ) / 1000;
        const aWallEst = (a1 + a2) * 1.0; 
        
        const buildingW = (a1 * wFloor) + (a2 * wFloor) + (aRoof * wRoof) + (aWallEst * wWallSpec);
        const totalSlabArea = (s.foundationSlabs || []).reduce((sum, sl) => sum + (window.MathUtils.Geometry.polygonArea(sl.vertices) / 1000000), 0);
        const foundationW = totalSlabArea * 5.0; 
        const totalW = buildingW + foundationW;
        
        if (totalSlabArea > 0) {
            s.averageBuildingPressure = buildingW / totalSlabArea;
            s.averageGroundPressure = totalW / totalSlabArea;
        } else {
            s.averageBuildingPressure = 0; s.averageGroundPressure = 0;
        }
    },

    calculateSlabTributary: function(slabs, beams, state) {
        const triMult = state.config?.triangleMultiplier || 1.33;
        const gPressure = state.averageGroundPressure || 15.0;
        (beams || []).forEach(b => { b.slabLoad = 0; b.tributaryArea = 0; b.tributaryWidth = 0; });

        (slabs || []).forEach(slab => {
            let pts = slab.vertices.map(v => ({ x: v.x, y: v.y }));
            if (pts.length < 3) return;
            window.MathUtils.ensureCCW(pts);

            const edges = [];
            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
                const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
                const nx = -dy / (L || 1), ny = dx / (L || 1);
                edges.push({ p1, p2, nx, ny, d: nx * p1.x + ny * p1.y, L });
            }

            slab.tributaryPolygons = [];
            for (let i = 0; i < edges.length; i++) {
                let poly = [...pts];
                const Ei = edges[i];
                for (let j = 0; j < edges.length; j++) {
                    if (i === j) continue;
                    const Ej = edges[j];
                    const cA = Ei.nx - Ej.nx, cB = Ei.ny - Ej.ny, cC = Ej.d - Ei.d;
                    if (Math.abs(cA) > 1e-7 || Math.abs(cB) > 1e-7) poly = this._clipByLine(poly, cA, cB, cC);
                }
                
                const area = window.MathUtils.Geometry.polygonArea(poly);
                if (area > 100) {
                    let width = area / Ei.L;
                    if (poly.length === 3) width = (area * triMult) / Ei.L;
                    const trib = { beamId: null, polygon: poly, area, width };
                    slab.tributaryPolygons.push(trib);

                    const mx = (Ei.p1.x + Ei.p2.x) / 2, my = (Ei.p1.y + Ei.p2.y) / 2;
                    let bestBeam = null, minDist = 50;
                    (beams || []).forEach(b => {
                        const d = this._distToSegment(mx, my, b.p1, b.p2);
                        if (d < minDist) { minDist = d; bestBeam = b; }
                    });
                    if (bestBeam) {
                        trib.beamId = bestBeam.id;
                        bestBeam.tributaryArea += area;
                        bestBeam.tributaryWidth += width;
                        bestBeam.slabLoad += (area / 1000000) * gPressure;
                    }
                }
            }
        });
    },

    calculateSlabAnalysis: function(slabs, avgBuildingPressure) {
        if (!slabs) return;
        const s = window.AppState;
        const pillars = (s.pillars || []).filter(p => !p.isDeleted);
        const beams = (s.foundationBeams || []).filter(b => !b.isDeleted);
        const M = window.MathUtils;

        // 1. Pre-calculate beam adjacency to handle 1/2 shared weight
        const beamAdjacency = {};
        beams.forEach(b => beamAdjacency[b.id] = 0);
        slabs.forEach(slab => {
            const pts = slab.vertices;
            beams.forEach(b => {
                if (this._isBeamOnSlabBoundary(b, pts)) beamAdjacency[b.id]++;
            });
        });

        slabs.forEach(slab => {
            const p = slab.props || {};
            const area = M.polygonArea(slab.vertices) / 1000000;
            const D = Number(p.slabThickness) || 150;
            const topH = Number(p.slabTopHeight) || 50;

            // --- 画像ロジックに基づく集計 ---
            
            // (1) 軸力 (kN) 集計
            let totalAxial_kN = 0;
            pillars.forEach(pill => {
                const isInside = M.isPointInPolygon(pill, slab.vertices);
                const isOnBoundary = this._isPointOnBoundary(pill, slab.vertices);
                if (isInside || isOnBoundary) {
                    // 共有判定: 他のスラブの境界上にもあるか
                    let sharedCount = 0;
                    slabs.forEach(other => {
                        if (M.isPointInPolygon(pill, other.vertices) || this._isPointOnBoundary(pill, other.vertices)) sharedCount++;
                    });
                    totalAxial_kN += (pill.seismicAxial || 0) / (sharedCount || 1);
                }
            });

            // (2) 立上り重量 (kN) 集計
            let stemWeight_kN = 0;
            beams.forEach(b => {
                if (this._isBeamOnSlabBoundary(b, slab.vertices)) {
                    const bp = b.props || {};
                    const bW = (bp.width || 150) / 1000;
                    const bH = ((bp.height || 640) - (bp.slabTopHeight || 50)) / 1000;
                    const bL = Math.hypot(b.p2.x - b.p1.x, b.p2.y - b.p1.y) / 1000;
                    const weight = bW * bH * bL * 24.0;
                    const factor = 1 / (beamAdjacency[b.id] || 1);
                    stemWeight_kN += weight * factor;
                }
            });

            // (3) 均し荷重 (kN/m2)
            const deadLoad = area > 0 ? (totalAxial_kN + stemWeight_kN) / area : 0;

            // (4) 床荷重 (kN/m2) - 画像では 1.740 等
            const floorLoad = 1.740; 
            
            // (5) 接地圧 σe (kN/m2)
            const qTotal = deadLoad + floorLoad;
            p.groundPressure = qTotal;

            // --- モーメント計算 (既存ロジック維持) ---
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            slab.vertices.forEach(v => {
                minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
                minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
            });
            const lx = Math.min(maxX - minX, maxY - minY) / 1000;
            const ly = Math.max(maxX - minX, maxY - minY) / 1000;
            const lambda = ly / (lx || 1);

            const dt = Number(p.coverDepth) || 70;
            const d = D - dt;
            const j = d * (7/8);
            const steelShort = this.getSteelStrength(p.rebarShort?.type || 'D13');
            const steelLong  = this.getSteelStrength(p.rebarLong?.type || 'D13');
            const Ma_short = steelShort.ft * (p.rebarShort?.at || 0) * j / 1e6;
            const Ma_long  = steelLong.ft  * (p.rebarLong?.at || 0)  * j / 1e6;

            if (p.support === '片持ち') {
                const L_cant = Number(p.cantileverLength) || 0.9;
                const Mx = 0.5 * qTotal * (L_cant ** 2);
                slab.fdStress = { 
                    qTotal, deadLoad, floorLoad, totalAxial_kN, stemWeight_kN, area,
                    cantileverLength: L_cant, Mx_center: Mx, Ma_short, 
                    ratioShort: Mx / (Ma_short || 1), supportName: '片持ち',
                    isNG: (Mx / (Ma_short || 1) > 1.0) 
                };
            } else {
                const coeffs = this.COEFFS[p.support] || this.COEFFS['4辺固定'];
                const lambdaFactor = Math.min(1.0, 1.5 / (lambda || 1)); 
                const Mx_center = coeffs.mcx * qTotal * (lx ** 2);
                const Mx_end    = coeffs.max * qTotal * (lx ** 2);
                const My_center = coeffs.mcy * qTotal * (lx ** 2) * lambdaFactor;
                const My_end    = coeffs.may * qTotal * (lx ** 2) * lambdaFactor;

                const ratioShort = Math.max(Mx_center, Mx_end) / (Ma_short || 1);
                const ratioLong  = Math.max(My_center, My_end) / (Ma_long || 1);

                slab.fdStress = {
                    qTotal, deadLoad, floorLoad, totalAxial_kN, stemWeight_kN, area,
                    lx, ly, lambda,
                    Mx_center, Mx_end, My_center, My_end,
                    Ma_short, Ma_long, ratioShort, ratioLong,
                    alpha_mcx: coeffs.mcx, alpha_max: coeffs.max,
                    alpha_mcy: coeffs.mcy, alpha_may: coeffs.may,
                    supportName: p.support,
                    isNG: (ratioShort > 1.0 || ratioLong > 1.0)
                };
            }
        });
    },

    _isPointOnBoundary: function(p, poly) {
        const tol = 10;
        for (let i = 0; i < poly.length; i++) {
            const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
            const d = window.MathUtils.distToBeamLine(p.x, p.y, p1.x, p1.y, p2.x, p2.y);
            if (d < tol) return true;
        }
        return false;
    },

    _isBeamOnSlabBoundary: function(b, poly) {
        const tol = 50;
        // 梁の両端がポリゴンの境界上にあるか、かつ梁の中点が境界上にあるか
        if (!this._isPointOnBoundary(b.p1, poly) || !this._isPointOnBoundary(b.p2, poly)) return false;
        const mx = (b.p1.x + b.p2.x) / 2, my = (b.p1.y + b.p2.y) / 2;
        return this._isPointOnBoundary({ x: mx, y: my }, poly);
    },

    runFoundationBeamAnalysis: function(beams, slabs, state) {
        if (!beams) return;
        const s = state || window.AppState;
        beams.forEach(beam => {
            const lt = this.analyzeLongTermStress(beam, slabs, s);
            if (!lt) return;
            const st = this.analyzeShortTermStress(beam, s);
            const cap = this.calculateBeamCapacity(beam, lt, st);
            
            const ratioM_L = lt.M_max_Nmm / cap.lMa_b;
            const ratioQ_L = lt.Q_max_N / cap.lQa;
            const ratioM_S = st ? (st.M_max_Nmm / (cap.lMa_b * 1.5)) : 0;
            const ratioQ_S = st ? (st.Q_max_N / (cap.lQa * 1.5)) : 0;
            const ratioN_S = st ? (st.Ne_N / (cap.sNa || 1e9)) : 0;
            const ratioCombined_S = ratioN_S + ratioM_S;

            const stInfo = { ...lt, st, cap, ratioM_L, ratioQ_L, ratioM_S, ratioQ_S, ratioN_S, ratioCombined_S, isNG: (ratioM_L > 1.0 || ratioQ_L > 1.0 || ratioCombined_S > 1.0 || ratioQ_S > 1.0) };
            beam.fdStress = stInfo;
            if (beam.spans) beam.spans.forEach(span => { span.fdStress = stInfo; span.isNG = stInfo.isNG; });
        });
    },

    analyzeShortTermStress: function(beam, state) {
        const s = state;
        const B = 0.5;
        const findSigmaN = (pt) => {
            const p = s.pillars.find(p => !p.isDeleted && Math.hypot(p.x - pt.x, p.y - pt.y) < 10);
            return p ? (p.seismicAxial || 0) : 0;
        };
        const n1 = findSigmaN(beam.p1), n2 = findSigmaN(beam.p2);
        const maxSigmaN = Math.max(n1, n2);
        const Ne_N = maxSigmaN * B * 1000; // Convert kN to N
        const lt = this.analyzeLongTermStress(beam, s.foundationSlabs, s);
        return { Ne_N, M_max_Nmm: lt.M_max_Nmm, Q_max_N: lt.Q_max_N, B_val: B };
    },

    analyzeLongTermStress: function(beam, slabs, state) {
        const p = beam.props || {};
        const L_mm = Math.hypot(beam.p2.x - beam.p1.x, beam.p2.y - beam.p1.y);
        if (L_mm < 1) return null;
        let beamTotalLoad_kN = 0;
        (slabs || []).forEach(slab => {
            const qSlab = slab.fdStress ? slab.fdStress.qTotal : 12.0;
            (slab.tributaryPolygons || []).forEach(tp => { if (tp.beamId === beam.id) beamTotalLoad_kN += qSlab * (tp.area / 1e6); });
        });
        const spanM = L_mm / 1000;
        let wL = spanM > 0 ? beamTotalLoad_kN / spanM : 0;
        wL += (p.width || 150) * ((p.height || 640) - (p.slabTopHeight || 50)) / 1e6 * 24;
        const M_mid = (wL * spanM * spanM) / 8, M_end = (wL * spanM * spanM) / 12, Q_max = (wL * spanM) / 2;
        return { spanM, wL_kN_m: wL, M_mid_kNm: M_mid, M_end_kNm: M_end, Q_max_kN: Q_max, M_max_Nmm: Math.max(M_mid, M_end) * 1e6, Q_max_N: Q_max * 1e3 };
    },

    calculateBeamCapacity: function(beam, ltStress, stStress) {
        const p = beam.props || {}, b = p.width || 150, h = p.height || 640, d = h - (p.coverDepth || 70), j = d * 7 / 8;
        const fcVal = window.AppState.concreteFc || 21;
        const botRebar = this.parseRebar(p.bottomRebar || '1-D13'), st = this.parseStirrups(p.stirrup || '1-D10@200');
        const botSteel = this.getSteelStrength(p.bottomRebar), stSteel = this.getSteelStrength(p.stirrup);
        const lMa_b = botRebar.area * botSteel.ft * j, Qa_steel_L = st.area * (stSteel.fts / 1.5) * j / (st.pitch || 200);
        const lQa = (1.0 * (fcVal / 3 / Math.sqrt(3)) * b * j) + Qa_steel_L;
        const sNa = b * h * (fcVal * (2/3));
        return { b, h, d, j, lMa_b, lQa, sNa, At: botRebar.area, pw: st.area / (b * st.pitch) };
    },

    getSteelStrength: function(str) { return /19|22/.test(str || '') ? { ft: 215, fts: 345 } : { ft: 195, fts: 295 }; },
    parseRebar: function(str) {
        const m = (str || '').match(/^(\d+)-D(\d+)/i);
        if (!m) return { count: 0, dia: 0, area: 0 };
        const diaTbl = { 10: 71.33, 13: 126.7, 16: 198.6, 19: 286.5, 22: 387.1 };
        return { count: parseInt(m[1]), dia: parseInt(m[2]), area: parseInt(m[1]) * (diaTbl[m[2]] || 0) };
    },
    parseStirrups: function(str) {
        const m = (str || '').match(/^(\d+)-D(\d+)@(\d+)/i);
        if (!m) return { count: 1, dia: 10, pitch: 200, area: 71.33 };
        const diaTbl = { 10: 71.33, 13: 126.7, 16: 198.6 };
        return { count: parseInt(m[1]), dia: parseInt(m[2]), pitch: parseInt(m[3]), area: parseInt(m[1]) * (diaTbl[m[2]] || 0) };
    },
    _clipByLine: function(poly, a, b, c) {
        const out = []; const isInside = (p) => a * p.x + b * p.y + c <= 1e-6;
        for (let i = 0; i < poly.length; i++) {
            const p1 = poly[i === 0 ? poly.length - 1 : i - 1], p2 = poly[i];
            if (isInside(p2)) { if (!isInside(p1)) out.push(this._intersect(p1, p2, a, b, c)); out.push(p2); }
            else if (isInside(p1)) out.push(this._intersect(p1, p2, a, b, c));
        }
        return out;
    },
    _intersect: function(p1, p2, a, b, c) { const d1 = a * p1.x + b * p1.y + c, d2 = a * p2.x + b * p2.y + c, t = d1 / (d1 - d2 || 1e-9); return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }; },
    _distToSegment: function(px, py, p1, p2) { const dx = p2.x - p1.x, dy = p2.y - p1.y, l2 = dx * dx + dy * dy; if (l2 === 0) return Math.hypot(px - p1.x, py - p1.y); let t = Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / l2)); return Math.hypot(px - (p1.x + t * dx), py - (p1.y + t * dy)); }
};

// Legacy Bridge
window.FD_SLAB_COEFFS = window.FoundationEngine.COEFFS;
