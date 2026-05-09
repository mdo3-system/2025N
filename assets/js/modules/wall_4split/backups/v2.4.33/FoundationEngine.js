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

        if (window.AxialEngine) {
            window.AxialEngine.calculateAllAxialForces(s);
            window.AxialEngine.calculateLongTermAxialForces(s);
        }
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

        // 各階の実外壁線（s.exteriorWalls）の総延長（m）を算出
        let len1F = 0, len2F = 0;
        (s.exteriorWalls || []).forEach(ew => {
            if (!ew.vertices || ew.vertices.length < 2) return;
            let len = 0;
            const vts = ew.closed ? [...ew.vertices, ew.vertices[0]] : ew.vertices;
            for (let i = 0; i < vts.length - 1; i++) {
                len += Math.hypot(vts[i + 1].x - vts[i].x, vts[i + 1].y - vts[i].y);
            }
            if (ew.floor === '1F') len1F += len / 1000;
            if (ew.floor === '2F') len2F += len / 1000;
        });

        const h1 = s.config.floorHeight1F || 2.7;
        const h2 = s.config.floorHeight2F || 2.7;

        // 実外壁面積、未作図の場合は従来デフォルト (a1 + a2) * 1.0 にフォールバック
        let aWallEst = (len1F * h1) + (len2F * h2);
        if (aWallEst === 0) {
            aWallEst = (a1 + a2) * 1.0;
        }
        
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
            
            // (1) 軸力 (kN) 集計 - 標準等分布建物荷重モデルに基づき整合
            const axialPressure = s.averageBuildingPressure || 3.67;
            const totalAxial_kN = area * axialPressure;

            // (2) 立上り重量 (kN) 集計
            let stemWeight_kN = 0;
            const d_m = s.fdThicknessM !== undefined ? s.fdThicknessM : 0.15;
            beams.forEach(b => {
                if (this._isBeamOnSlabBoundary(b, slab.vertices)) {
                    const bp = b.props || {};
                    const bW = (bp.width || 150) / 1000;
                    const bH = Math.max(0, (bp.height || 640) / 1000 - d_m);
                    const bL = Math.hypot(b.p2.x - b.p1.x, b.p2.y - b.p1.y) / 1000;
                    const weight = bW * bH * bL * 24.0;
                    const factor = 1 / (beamAdjacency[b.id] || 1);
                    stemWeight_kN += weight * factor;
                }
            });

            // (3) 均し荷重 (kN/m2) の構成要素
            const D_val = p.slabThickness || 150;
            const topH_val = p.slabTopHeight || 50;
            const slabMatWeight = 0; // 画像およびユーザーのご要望に基づきスラブ自重は拾わない
            
            const stemPressure = area > 0 ? (stemWeight_kN / area) : 0;
            
            // 均し荷重 = (軸力/面積) + (立上り/面積) + スラブ自重
            const deadLoad = axialPressure + stemPressure + slabMatWeight;

            // (4) 床荷重 (kN/m2)
            // 積載荷重 1.30 + 仕上げ 0.44 = 1.74 (住宅)
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
                    qTotal, deadLoad, floorLoad, axialPressure, stemPressure, slabMatWeight,
                    totalAxial_kN, stemWeight_kN, area,
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
                    qTotal, deadLoad, floorLoad, axialPressure, stemPressure, slabMatWeight,
                    totalAxial_kN, stemWeight_kN, area,
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

    getBeamPillars: function(beam, state) {
        const s = state || window.AppState;
        const p1 = beam.p1;
        const p2 = beam.p2;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const L_beam = Math.hypot(dx, dy);
        if (L_beam < 1) return [];

        // Find all pillars along this beam line within 500mm tolerance
        const pillarsOnBeam = (s.pillars || []).filter(p => {
            if (p.isDeleted) return false;
            const dist = window.MathUtils.distToBeamLine(p.x, p.y, p1.x, p1.y, p2.x, p2.y);
            if (dist > 500) return false;
            const minX = Math.min(p1.x, p2.x) - 100, maxX = Math.max(p1.x, p2.x) + 100;
            const minY = Math.min(p1.y, p2.y) - 100, maxY = Math.max(p1.y, p2.y) + 100;
            return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
        });

        const pillarsWithX = pillarsOnBeam.map(p => {
            const vx = p.x - p1.x, vy = p.y - p1.y;
            const t = (vx * dx + vy * dy) / (L_beam * L_beam || 1);
            const x = Math.max(0, Math.min(L_beam, t * L_beam)) / 1000;
            const gridName = window.getGridNameAt ? window.getGridNameAt(p.x, p.y) : null;
            const isDefaultName = !p.name || 
                                 /^(P|M)_?(P|M)?\d+$/i.test(p.name) || 
                                 p.name.toLowerCase().startsWith('pillar') || 
                                 p.name === `P_${p.id}` || 
                                 p.name === p.id;
            const displayName = isDefaultName ? (gridName || p.name || `P_${p.id}`) : p.name;
            return {
                id: p.id,
                name: displayName,
                x: x,
                globalX: p.x,
                globalY: p.y,
                seismicAxial: (p.seismicAxial || 0) / 1000
            };
        });

        const hasStart = pillarsWithX.some(p => p.x < 0.1);
        const hasEnd = pillarsWithX.some(p => Math.abs(p.x - L_beam / 1000) < 0.1);
        const nameStart = window.getGridNameAt ? window.getGridNameAt(p1.x, p1.y) : '支点1';
        const nameEnd = window.getGridNameAt ? window.getGridNameAt(p2.x, p2.y) : '支点2';
        if (!hasStart) pillarsWithX.push({ id: 'support_p1', name: nameStart, x: 0, globalX: p1.x, globalY: p1.y, seismicAxial: 0 });
        if (!hasEnd) pillarsWithX.push({ id: 'support_p2', name: nameEnd, x: L_beam / 1000, globalX: p2.x, globalY: p2.y, seismicAxial: 0 });

        pillarsWithX.sort((a, b) => a.x - b.x);

        const uniquePillars = [];
        pillarsWithX.forEach(p => {
            if (uniquePillars.length === 0) {
                uniquePillars.push(p);
            } else {
                const prev = uniquePillars[uniquePillars.length - 1];
                if (Math.abs(p.x - prev.x) > 0.1) {
                    uniquePillars.push(p);
                } else if (p.seismicAxial > prev.seismicAxial) {
                    uniquePillars[uniquePillars.length - 1] = p;
                }
            }
        });

        return uniquePillars;
    },

    calculateSeismicForces: function(beam, pillars, state) {
        const B_val = 0.5;
        const L_beam = Math.hypot(beam.p2.x - beam.p1.x, beam.p2.y - beam.p1.y) / 1000;

        const calculateDirection = (isLeftward) => {
            const T_d_list = [];
            const N_pillars = pillars.length;

            pillars.forEach((p, idx) => {
                const sign = idx < N_pillars / 2 ? 1 : -1;
                const dirSign = isLeftward ? sign : -sign;
                T_d_list.push(p.seismicAxial * B_val * dirSign);
            });

            const x_center = L_beam / 2;
            let sum_M_overturn = 0;
            T_d_list.forEach((Td, idx) => {
                sum_M_overturn += Td * (pillars[idx].x - x_center);
            });

            const R_left = -sum_M_overturn / (L_beam || 1);
            const R_right = sum_M_overturn / (L_beam || 1);

            const Qe_list = [];
            const M_f_list = [];
            let current_Qe = 0;
            let current_M_f = 0;

            pillars.forEach((p, idx) => {
                let R = 0;
                if (idx === 0) R = R_left;
                if (idx === N_pillars - 1) R = R_right;

                current_Qe += T_d_list[idx] + R;
                Qe_list.push(current_Qe);

                if (idx > 0) {
                    const prev_p = pillars[idx - 1];
                    const dx = p.x - prev_p.x;
                    current_M_f += Qe_list[idx - 1] * dx;
                }
                M_f_list.push(current_M_f);
            });

            return {
                Td: T_d_list,
                R_left,
                R_right,
                Qe: Qe_list,
                Mf: M_f_list
            };
        };

        const leftward = calculateDirection(true);
        const rightward = calculateDirection(false);

        return {
            leftward,
            rightward,
            B_val
        };
    },

    runFoundationBeamAnalysis: function(beams, slabs, state) {
        if (!beams) return;
        const s = state || window.AppState;
        const fcVal = s.concreteFc || 21;

        beams.forEach(beam => {
            const p = beam.props || {};
            const pillars = this.getBeamPillars(beam, s);
            const seismic = this.calculateSeismicForces(beam, pillars, s);

            const L_beam_m = Math.hypot(beam.p2.x - beam.p1.x, beam.p2.y - beam.p1.y) / 1000;
            const w_self = (p.width || 150) * ((p.height || 640) - (p.slabTopHeight || 50)) / 1e6 * 24.0;

            let beamTotalSlabLoad_kN = 0;
            (slabs || []).forEach(slab => {
                const qSlab = slab.fdStress ? slab.fdStress.qTotal : 12.0;
                (slab.tributaryPolygons || []).forEach(tp => {
                    if (tp.beamId === beam.id) beamTotalSlabLoad_kN += qSlab * (tp.area / 1e6);
                });
            });

            const avgSlabLoad_kN_m = L_beam_m > 0 ? (beamTotalSlabLoad_kN / L_beam_m) : 0;
            const totalW = avgSlabLoad_kN_m + w_self;

            // Generate spans between adjacent pillars
            const spans = [];
            let isNG = false;

            for (let i = 0; i < pillars.length - 1; i++) {
                const p1 = pillars[i];
                const p2 = pillars[i + 1];
                const spanL = p2.x - p1.x;
                if (spanL < 0.1) continue;

                // Long term
                const M_mid = (totalW * spanL * spanL) / 8;
                const M_end = (totalW * spanL * spanL) / 12;
                const Q_L = (totalW * spanL) / 2;

                const M_end_left = (i === 0) ? 0 : M_end;
                const M_end_right = (i === pillars.length - 2) ? 0 : M_end;

                // Short term combination
                const n_coef = 2.0;
                const M_combo_L_left = M_end_left + seismic.leftward.Mf[i];
                const M_combo_L_right = M_end_right + seismic.leftward.Mf[i + 1];
                const Q_combo_L = Q_L + n_coef * seismic.leftward.Qe[i];

                const M_combo_R_left = M_end_left + seismic.rightward.Mf[i];
                const M_combo_R_right = M_end_right + seismic.rightward.Mf[i + 1];
                const Q_combo_R = Q_L + n_coef * seismic.rightward.Qe[i];

                // Span-specific custom properties support
                const existingSpan = (beam.spans && beam.spans[i]);
                const spanProps = (existingSpan && existingSpan.props) ? existingSpan.props : {};

                const b = spanProps.width !== undefined ? parseFloat(spanProps.width) : (p.width || 150);
                const h = spanProps.height !== undefined ? parseFloat(spanProps.height) : (p.height || 640);
                const d = h - (p.coverDepth || 70);
                const j = d * 7 / 8;

                const tRebarStr = spanProps.topRebar || p.topRebar || '1-D13';
                const bRebarStr = spanProps.bottomRebar || p.bottomRebar || '1-D13';
                const stRebarStr = spanProps.stirrup || p.stirrup || '1-D10@200';

                const topRebar = this.parseRebar(tRebarStr);
                const botRebar = this.parseRebar(bRebarStr);
                const stRebar  = this.parseStirrups(stRebarStr);

                const topSteel = this.getSteelStrength(tRebarStr);
                const botSteel = this.getSteelStrength(bRebarStr);
                const stSteel  = this.getSteelStrength(stRebarStr);

                const lMa_top = topRebar.area * topSteel.ft * j * 1e-6;
                const lMa_bot = botRebar.area * botSteel.ft * j * 1e-6;

                const sMa_top = lMa_top * 1.5;
                const sMa_bot = lMa_bot * 1.5;

                const pw = stRebar.area / (b * stRebar.pitch);
                const fs = fcVal / 30;

                // Shear Span Ratio
                const alpha_L = Math.max(1.0, Math.min(2.0, 4.0 / ((M_end / (Q_L * d / 1000 || 1)) + 1)));
                const Qa_steel_L = stRebar.area * (stSteel.fts / 1.5) * j / (stRebar.pitch || 200) * 1e-3;
                const lQa = (alpha_L * fs * b * j * 1e-3) + Qa_steel_L;

                const alpha_S_L = Math.max(1.0, Math.min(2.0, 4.0 / ((Math.max(Math.abs(M_combo_L_left), Math.abs(M_combo_L_right)) / (Q_combo_L * d / 1000 || 1)) + 1)));
                const sQa_L = lQa * 1.5;

                const alpha_S_R = Math.max(1.0, Math.min(2.0, 4.0 / ((Math.max(Math.abs(M_combo_R_left), Math.abs(M_combo_R_right)) / (Q_combo_R * d / 1000 || 1)) + 1)));
                const sQa_R = lQa * 1.5;

                // Ratios
                const rM_L = Math.max(M_mid, M_end) / (lMa_bot || 1);
                const rQ_L = Q_L / (lQa || 1);

                const rM_S_L_left = Math.abs(M_combo_L_left) / (sMa_top || 1);
                const rM_S_L_right = Math.abs(M_combo_L_right) / (sMa_bot || 1);
                const rQ_S_L = Math.abs(Q_combo_L) / (sQa_L || 1);

                const rM_S_R_left = Math.abs(M_combo_R_left) / (sMa_top || 1);
                const rM_S_R_right = Math.abs(M_combo_R_right) / (sMa_bot || 1);
                const rQ_S_R = Math.abs(Q_combo_R) / (sQa_R || 1);

                const spanNG = (rM_L > 1.0 || rQ_L > 1.0 || rM_S_L_left > 1.0 || rM_S_L_right > 1.0 || rQ_S_L > 1.0 || rM_S_R_left > 1.0 || rM_S_R_right > 1.0 || rQ_S_R > 1.0);
                if (spanNG) isNG = true;

                let b_trib = (beam.tributaryWidth || 0) / 1000;
                if (b_trib > 10.0) b_trib /= 1000; // Defensive self-healing for tributary width scale issues

                spans.push({
                    spanName: `${p1.name}-${p2.name}`,
                    props: spanProps, // Preserve custom properties
                    startNode: { x: p1.globalX, y: p1.globalY, type: 'pillar', name: p1.name },
                    endNode: { x: p2.globalX, y: p2.globalY, type: 'pillar', name: p2.name },
                    L: spanL,
                    sigma_e: s.averageGroundPressure || 12.0,
                    B_trib: b_trib,
                    w: totalW,
                    M_mid,
                    M_end,
                    M_end_left,
                    M_end_right,
                    Q_L,
                    leftward: {
                        M_left: M_combo_L_left,
                        M_right: M_combo_L_right,
                        Q: Q_combo_L,
                        rM_left: rM_S_L_left,
                        rM_right: rM_S_L_right,
                        rQ: rQ_S_L
                    },
                    rightward: {
                        M_left: M_combo_R_left,
                        M_right: M_combo_R_right,
                        Q: Q_combo_R,
                        rM_left: rM_S_R_left,
                        rM_right: rM_S_R_right,
                        rQ: rQ_S_R
                    },
                    cap: {
                        b, h, d, j, pw,
                        lMa_top, lMa_bot, sMa_top, sMa_bot,
                        lQa, sQa_L, sQa_R
                    },
                    rM_L,
                    rQ_L,
                    isNG: spanNG
                });
            }

            beam.spans = spans;
            beam.fdStress = {
                pillars,
                seismic,
                spans,
                isNG
            };
        });
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
