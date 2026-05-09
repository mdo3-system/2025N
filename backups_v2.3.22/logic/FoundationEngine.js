/**
 * logic/FoundationEngine.js - Consolidated Foundation Analysis Engine
 * v2.3.21 Refactoring
 */

window.FoundationEngine = {
    /**
     * Master Orchestrator for Foundation Analysis
     */
    runAnalysis: function(state) {
        const s = state || window.AppState;
        console.log("🏗️ [v2.3.21] Running Foundation Analysis...");

        // 1. Reconstruct continuous beams if the logic exists
        if (typeof reconstructContinuousBeams === 'function') {
            reconstructContinuousBeams();
        }

        // 2. Update Average Ground Pressure (Initial pass)
        this.updateGroundPressure(s);

        // 3. Slab Cross-section Verification
        this.calculateSlabAnalysis(s.foundationSlabs, s.averageBuildingPressure);

        // 4. Slab Tributary (Geometric Kikkou Division)
        this.calculateSlabTributary(s.foundationSlabs, s.foundationBeams, s);

        // 5. Beam Stress Analysis & Verification
        this.runFoundationBeamAnalysis(s.foundationBeams, s.foundationSlabs, s);

        // 6. Final Ground Pressure Update
        this.updateGroundPressure(s);

        console.log("✅ Foundation Analysis Complete.");
    },

    /**
     * Update average ground pressure (Building weight / Slab area)
     */
    updateGroundPressure: function(state) {
        const s = state;
        const config = s.config;
        const a1 = window.AreaEngine.getFloorArea('1F', s) || window.MathUtils.getVal('a-f1') || 0;
        const a2 = window.AreaEngine.getFloorArea('2F', s) || window.MathUtils.getVal('a-f2') || 0;
        const aRoof = Math.max(a1, a2);
        
        const wRoof = (s.roofWeight + s.solarWeight + s.ceilingInsWeight) / 1000;
        const wFloor = 2.4; 
        const wWallSpec = (s.exteriorWallWeight + s.wallInsWeight) / 1000;
        const aWallEst = (a1 + a2) * 1.0; 
        
        const buildingW = (a1 * wFloor) + (a2 * wFloor) + (aRoof * wRoof) + (aWallEst * wWallSpec);
        
        const totalSlabArea = (s.foundationSlabs || []).reduce((sum, sl) => {
            return sum + (window.MathUtils.Geometry.polygonArea(sl.vertices) / 1000000);
        }, 0);
        
        const foundationW = totalSlabArea * 5.0; // 5.0 kN/m2 estimate
        const totalW = buildingW + foundationW;
        
        if (totalSlabArea > 0) {
            s.averageBuildingPressure = buildingW / totalSlabArea;
            s.averageGroundPressure = totalW / totalSlabArea;
        } else {
            s.averageBuildingPressure = 0;
            s.averageGroundPressure = 0;
        }
    },

    /**
     * Slab Tributary Analysis (Geometric Division)
     */
    calculateSlabTributary: function(slabs, beams, state) {
        const triMult = state.config.triangleMultiplier || 1.33;
        const gPressure = state.averageGroundPressure || 15.0;

        (beams || []).forEach(b => {
            b.slabLoad = 0;
            b.tributaryArea = 0;
            b.tributaryWidth = 0;
        });

        (slabs || []).forEach(slab => {
            let pts = slab.vertices.map(v => ({ x: v.x, y: v.y }));
            if (pts.length < 3) return;
            window.MathUtils.Geometry.ensureCCW(pts);

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
                    if (Math.abs(cA) > 1e-7 || Math.abs(cB) > 1e-7) {
                        poly = this._clipByLine(poly, cA, cB, cC);
                    }
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

    /**
     * Slab Sectional Analysis
     */
    calculateSlabAnalysis: function(slabs, avgBuildingPressure) {
        if (!slabs) return;
        slabs.forEach(slab => {
            const p = slab.props || {};
            const D = p.slabThickness || 150;
            const dt = p.coverDepth || 70;
            const topH = p.slabTopHeight || 50;
            
            const bp = Number(avgBuildingPressure) || 0;
            const wSelf = ((Number(D) + Number(topH)) / 1000) * 24.0;
            const wLive = 1.3; 
            const qTotal = bp + wSelf + wLive;
            p.groundPressure = qTotal;

            // Geometry (Simplified bounds)
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            slab.vertices.forEach(v => {
                minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
                minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
            });
            const lx = Math.min(maxX - minX, maxY - minY) / 1000;
            const ly = Math.max(maxX - minX, maxY - minY) / 1000;
            const lambda = ly / (lx || 1);

            const d = D - dt;
            const j = d * (7/8);
            const steelShort = this.getSteelStrength(p.rebarShort?.type);
            const Ma_short = steelShort.ft * (p.rebarShort?.at || 0) * j / 1e6;

            if (p.support === '片持ち') {
                const L = Number(p.cantileverLength) || 0.9;
                const Mx = 0.5 * qTotal * (L ** 2);
                slab.fdStress = { qTotal, wSelf, wLive, cantileverLength: L, Mx_center: Mx, Ma_short, ratioShort: Mx / (Ma_short || 1), isNG: (Mx / (Ma_short || 1) > 1.0) };
            } else {
                // Simplified coefficient-based check
                const Mx = 0.045 * qTotal * (lx ** 2);
                slab.fdStress = { qTotal, lx, ly, lambda, Mx_center: Mx, Ma_short, ratioShort: Mx / (Ma_short || 1), isNG: (Mx / (Ma_short || 1) > 1.0) };
            }
        });
    },

    /**
     * Beam Stress & Analysis Execution
     */
    runFoundationBeamAnalysis: function(beams, slabs, state) {
        if (!beams) return;
        const h1 = window.MathUtils.getVal('n-h1') || 2.7;
        const walls = state.walls || [];

        beams.forEach(beam => {
            // 1. Long-term stress
            const lt = this.analyzeLongTermStress(beam, slabs, state);
            if (!lt) return;
            
            // 2. Sectional verification
            const cap = this.calculateBeamCapacity(beam, lt);
            const ratioM = lt.M_max_Nmm / cap.lMa_b;
            const ratioQ = lt.Q_max_N / cap.lQa;
            
            beam.fdStress = { ...lt, cap, ratioM_L: ratioM, ratioQ_L: ratioQ, isNG: (ratioM > 1.0 || ratioQ > 1.0) };
        });
    },

    /**
     * Long-term stress analysis for foundation beams
     */
    analyzeLongTermStress: function(beam, slabs, state) {
        const p = beam.props || {};
        const dx = beam.p2.x - beam.p1.x, dy = beam.p2.y - beam.p1.y, L_mm = Math.hypot(dx, dy);
        if (L_mm < 1) return null;

        let beamTotalLoad_kN = 0;
        (slabs || []).forEach(slab => {
            const qSlab = slab.fdStress ? slab.fdStress.qTotal : 12.0;
            (slab.tributaryPolygons || []).forEach(tp => {
                if (tp.beamId === beam.id) beamTotalLoad_kN += qSlab * (tp.area / 1e6);
            });
        });

        const spanM = L_mm / 1000;
        let wL = spanM > 0 ? beamTotalLoad_kN / spanM : 0;
        wL += (p.width || 150) * ((p.height || 640) - (p.slabTopHeight || 50)) / 1e6 * 24;

        const M_mid = (wL * spanM * spanM) / 8;
        const M_end = (wL * spanM * spanM) / 12;
        const Q_max = (wL * spanM) / 2;

        return { spanM, wL_kN_m: wL, M_mid_kNm: M_mid, M_end_kNm: M_end, Q_max_kN: Q_max, M_max_Nmm: Math.max(M_mid, M_end) * 1e6, Q_max_N: Q_max * 1e3 };
    },

    /**
     * Calculate allowable beam capacity
     */
    calculateBeamCapacity: function(beam, stressData) {
        const p = beam.props || {};
        const b = p.width || 150, h = p.height || 640, d = h - (p.coverDepth || 70), j = d * 7 / 8;
        const fcVal = window.AppState.concreteFc || 21;
        const conc = { fwk_L: fcVal / 3 / Math.sqrt(3) };
        
        const botRebar = this.parseRebar(p.bottomRebar || '1-D13');
        const st = this.parseStirrups(p.stirrup || '1-D10@200');
        const botSteel = this.getSteelStrength(p.bottomRebar);
        const stSteel = this.getSteelStrength(p.stirrup);

        const lMa_b = botRebar.area * botSteel.ft * j;
        const Qa_steel_L = st.area * (stSteel.fts / 1.5) * j / (st.pitch || 200);
        const lQa = (1.0 * conc.fwk_L * b * j) + Qa_steel_L; // Simplified alpha=1.0

        return { b, h, d, j, lMa_b, lQa, At: botRebar.area, pw: st.area / (b * st.pitch) };
    },

    /**
     * Utilities
     */
    getConcreteAllowable: function(fc) { return { fc, fck_L: fc / 3, ftk_L: 0.49 * Math.pow(fc, 1/3), fwk_L: fc / 3 / Math.sqrt(3) }; },
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
    getSteelStrength: function(str) {
        return /19|22/.test(str || '') ? { ft: 215, fts: 345 } : { ft: 195, fts: 295 };
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
