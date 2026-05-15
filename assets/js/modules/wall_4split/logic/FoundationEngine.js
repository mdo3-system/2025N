/**
 * logic/FoundationEngine.js - 基礎構造計算エンジン
 * v2.4.73 Refactoring: Unified Coordinate & Physical Match
 */

window.FoundationEngine = {
    COEFFS: {
        '4辺固定':                     { mcx: 0.024, max: 0.052, mcy: 0.048, may: 0.082 },
        '4辺ピン':                     { mcx: 0.080, max: 0.000, mcy: 0.050, may: 0.000 },
        '片持ち':                      { mcx: 0.500, max: 0.000, mcy: 0.000, may: 0.000 },
        '長辺2辺固定短辺2辺ピン':      { mcx: 0.040, max: 0.080, mcy: 0.025, may: 0.000 },
        '短辺2辺固定長辺2辺ピン':      { mcx: 0.030, max: 0.000, mcy: 0.060, may: 0.090 },
        '1辺固定3辺ピン（長辺固定）':  { mcx: 0.065, max: 0.100, mcy: 0.040, may: 0.000 },
        '1辺固定3辺ピン（短辺固定）':  { mcx: 0.050, max: 0.000, mcy: 0.075, may: 0.110 },
        '4辺固定(ピン扱い)':           { mcx: 0.080, max: 0.000, mcy: 0.050, may: 0.000 }
    },

    runAnalysis: function(state) {
        const s = state || window.AppState;
        if (!s.config) s.config = {};
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
        // [v2.5.7] Re-run Slab Analysis AFTER Beam Analysis to capture freshly materialized overrides perfectly.
        this.calculateSlabAnalysis(s.foundationSlabs, s.averageBuildingPressure);
    },

    updateGroundPressure: function(state) {
        const s = state;
        const a1 = window.AreaEngine ? window.AreaEngine.getFloorArea('1F', s) : 0;
        const a2 = window.AreaEngine ? window.AreaEngine.getFloorArea('2F', s) : 0;
        const aRoof = Math.max(a1, a2);
        const wR = ((s.config?.weights?.roof || 500) + (s.config?.weights?.solar || 0) + (s.config?.weights?.ceilingIns || 100)) / 1000;
        const wF = 2.4; 
        const wW = ((s.config?.weights?.exteriorWall || 600) + (s.config?.weights?.wallIns || 70)) / 1000;
        let len1F = 0, len2F = 0;
        (s.exteriorWalls || []).forEach(ew => {
            if (!ew.vertices || ew.vertices.length < 2) return;
            let len = 0; const vts = ew.closed ? [...ew.vertices, ew.vertices[0]] : ew.vertices;
            for (let i = 0; i < vts.length - 1; i++) len += Math.hypot(vts[i + 1].x - vts[i].x, vts[i + 1].y - vts[i].y);
            if (ew.floor === '1F') len1F += len / 1000;
            if (ew.floor === '2F') len2F += len / 1000;
        });
        const h1 = s.config.floorHeight1F || 2.7, h2 = s.config.floorHeight2F || 2.7;
        let aWallEst = (len1F * h1) + (len2F * h2);
        if (aWallEst === 0) aWallEst = (a1 + a2) * 1.0;
        const buildingW = (a1 * wF) + (a2 * wF) + (aRoof * wR) + (aWallEst * wW);
        const totalSlabArea = (s.foundationSlabs || []).reduce((sum, sl) => sum + (window.MathUtils.Geometry.polygonArea(sl.vertices) / 1000000), 0);
        if (totalSlabArea > 0) { s.averageBuildingPressure = buildingW / totalSlabArea; s.averageGroundPressure = (buildingW + totalSlabArea * 5.0) / totalSlabArea; }
    },

    calculateSlabTributary: function(slabs, beams, state) {
        const triMult = state.config?.triangleMultiplier || 1.33;
        (beams || []).forEach(b => { b.slabLoad = 0; b.tributaryArea = 0; b.tributaryWidth = 0; });
        (slabs || []).forEach(slab => {
            let pts = slab.vertices.map(v => ({ x: v.x, y: v.y })); if (pts.length < 3) return; window.MathUtils.ensureCCW(pts);
            const edges = [];
            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
                const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
                const nx = -dy / (L || 1), ny = dx / (L || 1);
                edges.push({ p1, p2, nx, ny, d: nx * p1.x + ny * p1.y, L });
            }
            slab.tributaryPolygons = [];
            for (let i = 0; i < edges.length; i++) {
                let poly = [...pts]; const Ei = edges[i];
                for (let j = 0; j < edges.length; j++) {
                    if (i === j) continue; const Ej = edges[j];
                    const cA = Ei.nx - Ej.nx, cB = Ei.ny - Ej.ny, cC = Ej.d - Ei.d;
                    if (Math.abs(cA) > 1e-7 || Math.abs(cB) > 1e-7) poly = this._clipByLine(poly, cA, cB, cC);
                }
                const area = window.MathUtils.Geometry.polygonArea(poly);
                if (area > 100) {
                    let width = area / Ei.L / 1000; if (this._isTriangle(poly)) width = (area * triMult) / Ei.L / 1000;
                    const mx = (Ei.p1.x + Ei.p2.x) / 2, my = (Ei.p1.y + Ei.p2.y) / 2;
                    const trib = { beamId: null, polygon: poly, area, width, mx, my }; slab.tributaryPolygons.push(trib);
                    let bestBeam = null, minDist = 300;
                    (beams || []).forEach(b => { const d = this._distToSegment(mx, my, b.p1, b.p2); if (d < minDist) { minDist = d; bestBeam = b; } });
                    if (bestBeam) { trib.beamId = bestBeam.id; bestBeam.tributaryArea += area; bestBeam.tributaryWidth += width; bestBeam.slabLoad += (area / 1000000) * ((slab.fdStress && slab.fdStress.qTotal != null) ? slab.fdStress.qTotal : state.averageGroundPressure); }
                }
            }
        });
    },

    calculateSlabAnalysis: function(slabs, avgBuildingPressure) {
        if (!slabs) return;
        const s = window.AppState, M = window.MathUtils;
        const beams = (s.foundationBeams || []).filter(b => !b.isDeleted);
        // Step 1: Highly granular pre-aggregation determining exactly how many slabs share each DISCRETE span boundary.
        const spanAdjacency = {};
        beams.forEach(b => {
            const spans = b.spans || [];
            spans.forEach((sp, idx) => {
                const key = `${b.id}_${idx}`; spanAdjacency[key] = 0;
                const p1 = { x: sp.startNode?.globalX ?? b.p1.x, y: sp.startNode?.globalY ?? b.p1.y };
                const p2 = { x: sp.endNode?.globalX ?? b.p2.x, y: sp.endNode?.globalY ?? b.p2.y };
                const spanObj = { p1, p2 };
                slabs.forEach(slab => {
                    if (this._isBeamOnSlabBoundary(spanObj, slab.vertices)) spanAdjacency[key]++;
                });
            });
        });

        slabs.forEach(slab => {
            const area = M.polygonArea(slab.vertices) / 1000000;
            const a1Polys = (s.areaLines || []).filter(al => al.floor === '1F' && !['attic','balcony'].includes(al.areaType));
            const a2Polys = (s.areaLines || []).filter(al => al.floor === '2F' && !['attic','balcony'].includes(al.areaType));
            const intersectArea = (p, areaPolys) => {
                let total = 0; areaPolys.forEach(ap => {
                    let clipped = [...p]; const apVts = ap.vertices;
                    for (let i = 0; i < apVts.length; i++) {
                        const p1 = apVts[i], p2 = apVts[(i + 1) % apVts.length], dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
                        if (L < 1) continue; clipped = this._clipByLine(clipped, dy/L, -dx/L, -((dy/L)*p1.x + (-dx/L)*p1.y));
                    }
                    total += M.polygonArea(clipped) / 1000000;
                }); return total;
            };
            const poly = slab.vertices.map(v => ({ x: v.x, y: v.y }));
            const sArea1F = intersectArea(poly, a1Polys), sArea2F = intersectArea(poly, a2Polys);
            const wR = ((s.config?.weights?.roof || 500) + (s.config?.weights?.solar || 0) + (s.config?.weights?.ceilingIns || 100)) / 1000;
            const wW = ((s.config?.weights?.exteriorWall || 600) + (s.config?.weights?.wallIns || 70)) / 1000;
            const wF = 2.4;
            const axial_kN = (sArea1F * (wF + wW)) + (sArea2F * wF) + (Math.max(sArea1F, sArea2F) * wR);
            let stem_kN = 0; 
            
            beams.forEach(b => {
                const spans = b.spans || [];
                if (spans.length > 0) {
                    spans.forEach((sp, idx) => {
                        const key = `${b.id}_${idx}`;
                        const p1 = { x: sp.startNode?.globalX ?? b.p1.x, y: sp.startNode?.globalY ?? b.p1.y };
                        const p2 = { x: sp.endNode?.globalX ?? b.p2.x, y: sp.endNode?.globalY ?? b.p2.y };
                        const spanObj = { p1, p2 };
                        
                        const involve = this._isBeamInvolvedInSlab(spanObj, slab.vertices);
                        if (involve > 0) {
                            const sp_b = sp.props?.width !== undefined ? parseFloat(sp.props.width) : (b.props?.width || 150);
                            const sp_h = sp.props?.height !== undefined ? parseFloat(sp.props.height) : (b.props?.height || 640);
                            const sp_emb = sp.props?.embedDepth !== undefined ? parseFloat(sp.props.embedDepth) : (b.props?.embedDepth ?? 250);
                            const sp_L = sp.L || Math.hypot(p2.x - p1.x, p2.y - p1.y) / 1000;
                            
                            const spanWeight = (sp_b / 1000) * (Math.max(0, sp_h - sp_emb) / 1000 + 0.01) * sp_L * 24.0;
                            const divisor = (involve === 1) ? (spanAdjacency[key] || 1) : 1;
                            stem_kN += spanWeight / divisor;
                        }
                    });
                } else {
                    // Fallback for initial load prior to span materialization using raw continuous geometry safely.
                    const involve = this._isBeamInvolvedInSlab(b, slab.vertices);
                    if (involve > 0) {
                        const def_b = b.props?.width || 150, def_h = b.props?.height || 640, def_emb = b.props?.embedDepth ?? 250;
                        const geomLen = Math.hypot(b.p2.x - b.p1.x, b.p2.y - b.p1.y) / 1000;
                        const rawWeight = (def_b / 1000) * (Math.max(0, def_h - def_emb) / 1000 + 0.01) * geomLen * 24.0;
                        stem_kN += rawWeight;
                    }
                }
            });
            const topH = (slab.props?.slabTopHeight !== undefined) ? parseFloat(slab.props.slabTopHeight) : 50;
            const slabTopLoad = (topH / 1000) * 24.0;
            const qTotal = (area > 0 ? (axial_kN + stem_kN) / area : 0) + 1.740 + slabTopLoad;
            slab.props = slab.props || {}; slab.props.groundPressure = qTotal;
            // [v2.5.0] Use actual geometric edge lengths instead of orthogonal bounding boxes for accurate diagonal slab lx/ly
            let edgeLengths = [];
            for (let i = 0; i < slab.vertices.length; i++) {
                const p1 = slab.vertices[i], p2 = slab.vertices[(i + 1) % slab.vertices.length];
                edgeLengths.push(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 1000);
            }
            edgeLengths.sort((a, b) => a - b);
            
            let lx = edgeLengths[0] || 0;
            let ly = edgeLengths[edgeLengths.length - 1] || 0;
            if (edgeLengths.length >= 4) {
                // For rotated rectangles, median of the shortest 2 is lx, median of longest 2 is ly
                lx = (edgeLengths[0] + edgeLengths[1]) / 2;
                ly = (edgeLengths[edgeLengths.length - 1] + edgeLengths[edgeLengths.length - 2]) / 2;
            }
            const dt = (slab.props.coverDepth || 70), D = (slab.props.slabThickness || 150), d = D - dt, j = d * 0.875;
            const Ma_short = 195 * (slab.props.rebarShort?.at || 0) * j / 1e6;
            const Ma_long  = 195 * (slab.props.rebarLong?.at || 0)  * j / 1e6;
            if (slab.props.support === '片持ち') {
                const Mx = 0.5 * qTotal * ((slab.props.cantileverLength || 0.9) ** 2);
                slab.fdStress = { qTotal, axialPressure: axial_kN/area, stemPressure: stem_kN/area, totalAxial_kN: axial_kN, stemWeight_kN: stem_kN, floorLoad: 1.740, deadLoad: qTotal - 1.740, area, supportName: '片持ち', Mx_center: Mx, Ma_short, ratioShort: Mx / (Ma_short || 1), isNG: Mx > Ma_short, cantileverLength: slab.props.cantileverLength || 0.9 };
            } else {
                const c = this.COEFFS[slab.props.support] || this.COEFFS['4辺固定'];
                const Mx_center = c.mcx * qTotal * (lx ** 2), My_center = c.mcy * qTotal * (lx ** 2) * Math.min(1.0, 1.5 / (ly/lx || 1));
                const Mx_end = c.max * qTotal * (lx ** 2), My_end = c.may * qTotal * (lx ** 2) * Math.min(1.0, 1.5 / (ly/lx || 1));
                slab.fdStress = { qTotal, axialPressure: axial_kN/area, stemPressure: stem_kN/area, totalAxial_kN: axial_kN, stemWeight_kN: stem_kN, floorLoad: 1.740, deadLoad: qTotal - 1.740, area, supportName: slab.props.support, lx, ly, Mx_center, Mx_end, My_center, My_end, Ma_short, Ma_long, ratioShort: Math.max(Mx_center, Mx_end) / (Ma_short || 1), ratioLong: Math.max(My_center, My_end) / (Ma_long || 1), isNG: Math.max(Mx_center, Mx_end) > Ma_short || Math.max(My_center, My_end) > Ma_long };
            }
            slab.fdStress.detailedLoads = { wR, wW, wF, sArea1F, sArea2F };
        });
    },

    getBeamPillars: function(beam, state) {
        const s = state || window.AppState;
        const p1 = beam.p1, p2 = beam.p2;
        const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
        if (L < 1) return [];

        // [根本修正1] 1F の柱のみを対象にする（基礎は地面の要素）
        // 1F と 2F が同じXY座標に存在する場合、両方を拾うと spans が2倍になり選択ロジックが破綻する
        const targetFloorPillars = (s.pillars || []).filter(p =>
            !p.isDeleted && (p.floor === '1F' || p.floor === 'ALL') &&
            window.MathUtils.distToBeamLine(p.x, p.y, p1.x, p1.y, p2.x, p2.y) < 50
        );

        const mapped = targetFloorPillars.map(p => {
            const t = Math.max(0, Math.min(1, ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / (L * L)));
            const gx = p1.x + t * dx, gy = p1.y + t * dy;
            const nm = window.getGridNameAt ? window.getGridNameAt(gx, gy) : p.name;
            return {
                id: p.id,
                name: nm || p.name,
                x: (t * L) / 1000,     // 梁始点からの距離(m)
                globalX: gx,            // ワールド座標(mm) - キャンバス描画・名称取得に使用
                globalY: gy,
                seismicAxial: (p.seismicAxial || 0) / 1000
            };
        });

        // 梁の始点・終点に実柱がない場合のみ仮支点を追加（二重追加を防止）
        if (!mapped.some(p => p.x < 0.1)) {
            mapped.push({ id: 's1', name: window.getGridNameAt ? window.getGridNameAt(p1.x, p1.y) : '支点1', x: 0, globalX: p1.x, globalY: p1.y, seismicAxial: 0 });
        }
        if (!mapped.some(p => Math.abs(p.x - L / 1000) < 0.1)) {
            mapped.push({ id: 's2', name: window.getGridNameAt ? window.getGridNameAt(p2.x, p2.y) : '支点2', x: L / 1000, globalX: p2.x, globalY: p2.y, seismicAxial: 0 });
        }
        return mapped.sort((a, b) => a.x - b.x);
    },

    calculateSeismicForces: function(beam, pillars, state) {
        const s = state || window.AppState, bp = beam.props || {};
        const axisName = window.GridEngine ? window.GridEngine.getLineAxisName(beam.p1, beam.p2, s) : '';
        
        const calculateDir = (isLeft) => {
            const Td = pillars.map(p => {
                // [根本修正2] IDで検索（s1/s2の仮IDは実在しないので必ず0）
                // → globalX/Y 座標で近傍の実柱を探して荷重を取得する
                const op = s.pillars.find(o =>
                    !o.isDeleted && (o.floor === '1F' || o.floor === 'ALL') &&
                    Math.hypot(o.x - p.globalX, o.y - p.globalY) < 10
                );
                if (!op || !op.axisSeismicAxial) return 0;

                let val = 0;
                const axisKeys = Object.keys(op.axisSeismicAxial);
                const targetKey = axisName.replace(/[^a-zA-Z0-9]/g, '');

                if (op.axisSeismicAxial[axisName] !== undefined) {
                    val = op.axisSeismicAxial[axisName];
                } else {
                    const matchKey = axisKeys.find(k =>
                        k.replace(/[^a-zA-Z0-9]/g, '') === targetKey ||
                        k === targetKey ||
                        targetKey.endsWith(k) ||
                        k.endsWith(targetKey)
                    );
                    if (matchKey) val = op.axisSeismicAxial[matchKey];
                }
                return (isLeft ? val : -val) * (bp.modelType === 'pillar_supported' ? 1.0 : (bp.B_val || 0.5)) / 1000;
            });
            const L = Math.max(0.001, pillars[pillars.length - 1].x - pillars[0].x);
            let sumM = 0, sumT = 0;
            Td.forEach((t, i) => { sumM += t * (pillars[i].x - pillars[0].x); sumT += t; });
            const R_r = -sumM / L, R_l = -sumT - R_r;
            const Qe = [], Mf = []; let currQ = 0, currM = 0;
            Td.forEach((t, i) => {
                currQ += t + (i === 0 ? R_l : (i === pillars.length - 1 ? R_r : 0));
                Qe.push(currQ);
                if (i > 0) currM += Qe[i - 1] * (pillars[i].x - pillars[i - 1].x);
                Mf.push(currM);
            });
            return { Td, Qe, Mf, R_left: R_l, R_right: R_r, supportIdx1: 0, supportIdx2: pillars.length - 1 };
        };
        return { leftward: calculateDir(true), rightward: calculateDir(false), axisName };
    },

    runFoundationBeamAnalysis: function(beams, slabs, state) {
        const s = state || window.AppState;
        (beams || []).forEach(beam => {
            const pillars = this.getBeamPillars(beam, s);
            const seismic = this.calculateSeismicForces(beam, pillars, s);
            
            // --- (変更) スパン個別プロパティの継承と自重算出の動的化 ---
            const spans = [];
            let isNG = false;
            
            if (pillars.length < 2) {
                beam.fdStress = { pillars, seismic, spans: [], isNG: false };
                return;
            }

            for (let i = 0; i < pillars.length - 1; i++) {
                const p1 = pillars[i], p2 = pillars[i+1], L = Math.max(0.1, p2.x - p1.x);
                
                // 1. 既存の個別スパン設定(props)を継承
                const existingSpan = (beam.spans && beam.spans[i]) ? beam.spans[i] : null;
                const sp = existingSpan?.props ? JSON.parse(JSON.stringify(existingSpan.props)) : {};
                
                // 2. スパン別次元の確定 (個別指定が無ければ全体デフォルト)
                const b_val = sp.width !== undefined ? parseFloat(sp.width) : (beam.props?.width || 150);
                const h_val = sp.height !== undefined ? parseFloat(sp.height) : (beam.props?.height || 640);
                const embed_val = sp.embedDepth !== undefined ? parseFloat(sp.embedDepth) : (beam.props?.embedDepth ?? 250);
                
                // 3. 自重(w_self)をスパンごとに再算出して分布荷重へ加算 ( mandates + 0.01m additive buffer )
                const w_self_span = (b_val * (Math.max(0, h_val - embed_val) + 10.0) / 1e6) * 24.0;

                const load = (window.SlabBeamSynchronizer && typeof window.SlabBeamSynchronizer.calculateSpanSlabLoad === 'function')
                    ? window.SlabBeamSynchronizer.calculateSpanSlabLoad(slabs, beam, { p1, p2 }, s)
                    : { sigma: 12.0, B: 1.0 };
                
                const w = (load.sigma * load.B) + w_self_span;
                
                const M_mid = (w * L * L) / 8;
                const M_end = (w * L * L) / 12;
                const Q_L = (w * L) / 2;
                
                const check = (isLeft) => {
                    const res = isLeft ? seismic.leftward : seismic.rightward;
                    const M_s_l = (i === 0 ? 0 : M_end) + (res.Mf[i] || 0);
                    const M_s_r = (i === pillars.length - 2 ? 0 : M_end) + (res.Mf[i + 1] || 0);
                    const Q_s = Q_L + Math.abs(res.Qe[i] || 0);
                    
                    // スパン別断面検定 (b_val, h_valを使用)
                    const d = Math.max(10, h_val - 70);
                    const j = d * 0.875;
                    
                    // 鉄筋もスパン別上書きに対応
                    const topRebarStr = sp.topRebar || beam.props?.topRebar || '1-D13';
                    const botRebarStr = sp.bottomRebar || beam.props?.bottomRebar || '1-D13';
                    const stirrupStr = sp.stirrup || beam.props?.stirrup || '1-D10@200';
                    
                    const topRebar = this.parseRebar(topRebarStr);
                    const botRebar = this.parseRebar(botRebarStr);
                    const st = this.parseStirrups(stirrupStr);
                    
                    const lMa_top = (topRebar.area * 195 * j) / 1e6;
                    const lMa_bot = (botRebar.area * 195 * j) / 1e6;
                    const sMa_top = lMa_top * 1.5;
                    const sMa_bot = lMa_bot * 1.5;
                    
                    const fs = (s.config?.concreteFc || 21) / 30;
                    const Qa_conc_L = 1.0 * fs * b_val * j / 1000;
                    const Qa_steel_L = (st.area * 295 * j / (st.pitch || 200)) / 1000;
                    const lQa = Qa_conc_L + Qa_steel_L;
                    
                    const M_ratio = Math.max(Math.abs(M_end), 1e-6);
                    const alpha_L = Math.max(1.0, Math.min(2.0, 4.0 / ((M_ratio / (Q_L * d / 1000 || 1)) + 1)));
                    const alpha_S = Math.max(1.0, Math.min(2.0, 4.0 / ((M_ratio / (Q_s * d / 1000 || 1)) + 1)));
                    const sQa = (alpha_S * fs * b_val * j * 1.5 / 1000) + Qa_steel_L;
                    
                    return {
                        M_left: M_s_l, M_right: M_s_r, Q: Q_s,
                        lMa_top, lMa_bot, sMa_top, sMa_bot, lQa, sQa,
                        alpha_L, alpha_S, pw: st.area / (b_val * (st.pitch || 200)),
                        ok: Math.abs(M_s_l) < sMa_top && Math.abs(M_s_r) < sMa_bot && Q_s < sQa
                    };
                };
                
                const resL = check(true);
                const resR = check(false);
                if (!resL.ok || !resR.ok) isNG = true;
                
                const rM_L = Math.max(Math.abs(M_mid), Math.abs(M_end)) / (resL.lMa_bot || 1);
                const rQ_L = Q_L / (resL.lQa || 1);
                
                spans.push({
                    spanName: `${p1.name}-${p2.name}`,
                    startNode: p1, endNode: p2,
                    L, sigma_e: load.sigma, B_trib: load.B, w,
                    M_mid, M_end, Q_L, rM_L, rQ_L,
                    ratioM_L: rM_L, ratioQ_L: rQ_L,
                    ratioM_S: Math.max(Math.abs(resL.M_left)/resL.sMa_top, Math.abs(resL.M_right)/resL.sMa_bot, Math.abs(resR.M_left)/resR.sMa_top, Math.abs(resR.M_right)/resR.sMa_bot),
                    ratioQ_S: Math.max(resL.Q/resL.sQa, resR.Q/resR.sQa),
                    leftward: { ...resL, rM_left: Math.abs(resL.M_left)/(resL.sMa_top || 1), rM_right: Math.abs(resL.M_right)/(resL.sMa_bot || 1), rQ: resL.Q/(resL.sQa || 1) },
                    rightward: { ...resR, rM_left: Math.abs(resR.M_left)/(resR.sMa_top || 1), rM_right: Math.abs(resR.M_right)/(resR.sMa_bot || 1), rQ: resR.Q/(resR.sQa || 1) },
                    cap: { 
                        ...resL, 
                        alpha_S_L: resL.alpha_S, 
                        alpha_S_R: resR.alpha_S,
                        sQa_L: resL.sQa,
                        sQa_R: resR.sQa,
                        b: b_val,
                        h: h_val
                    },
                    isNG: !resL.ok || !resR.ok,
                    props: sp // 4. 個別スパン設定を永続化するために格納
                });
            }
            beam.fdStress = { pillars, seismic, spans, isNG };
            beam.spans = spans;
        });
    },

    _clipByLine: function(poly, a, b, c) {
        const out = []; const isInside = (p) => a * p.x + b * p.y + c <= 1e-6;
        for (let i = 0; i < poly.length; i++) {
            const p1 = poly[i === 0 ? poly.length - 1 : i - 1], p2 = poly[i];
            if (isInside(p2)) { if (!isInside(p1)) out.push(this._intersect(p1, p2, a, b, c)); out.push(p2); }
            else if (isInside(p1)) out.push(this._intersect(p1, p2, a, b, c));
        } return out;
    },
    _intersect: function(p1, p2, a, b, c) { const d1 = a * p1.x + b * p1.y + c, d2 = a * p2.x + b * p2.y + c, t = d1 / (d1 - d2 || 1e-9); return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }; },
    _distToSegment: function(px, py, p1, p2) { const dx = p2.x - p1.x, dy = p2.y - p1.y, l2 = dx * dx + dy * dy; if (l2 === 0) return Math.hypot(px - p1.x, py - p1.y); let t = Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / l2)); return Math.hypot(px - (p1.x + t * dx), py - (p1.y + t * dy)); },
    _isBeamInvolvedInSlab: function(b, poly) {
        if (this._isBeamOnSlabBoundary(b, poly)) return 1; // Boundary
        const mid = { x: (b.p1.x + b.p2.x)/2, y: (b.p1.y + b.p2.y)/2 };
        if (window.MathUtils && window.MathUtils.isPointInPolygon && window.MathUtils.isPointInPolygon(mid, poly)) return 2; // Internal
        return 0; // None
    },
    _isBeamOnSlabBoundary: function(b, poly) {
        const onBound = (p) => { for (let i = 0; i < poly.length; i++) { if (window.MathUtils.distToBeamLine(p.x, p.y, poly[i].x, poly[i].y, poly[(i+1)%poly.length].x, poly[(i+1)%poly.length].y) < 10) return true; } return false; };
        return onBound(b.p1) && onBound(b.p2) && onBound({ x: (b.p1.x + b.p2.x)/2, y: (b.p1.y + b.p2.y)/2 });
    },
    _isTriangle: function(poly) {
        if (!poly || poly.length < 3) return false;
        // [v2.5.19 堅牢化] 多角形クリッピング(Sutherland-Hodgman)により発生する、
        // 重複頂点および同一直線上（Collinear）の頂点を厳密に排除した上で三角形判定を行う。
        
        // 1. 連続する重複頂点を排除 (許容誤差 1e-4)
        const unique = [];
        for (let i = 0; i < poly.length; i++) {
            const curr = poly[i];
            if (unique.length === 0) {
                unique.push(curr);
            } else {
                const prev = unique[unique.length - 1];
                if (Math.hypot(curr.x - prev.x, curr.y - prev.y) > 1e-4) {
                    unique.push(curr);
                }
            }
        }
        // 始点と終点の重複（ループ）チェック
        if (unique.length > 2) {
            const first = unique[0], last = unique[unique.length - 1];
            if (Math.hypot(first.x - last.x, first.y - last.y) <= 1e-4) {
                unique.pop();
            }
        }
        if (unique.length < 3) return false;

        // 2. 同一直線上の頂点（Collinear）を排除 (外積の正規化判定)
        const nonCollinear = [];
        for (let i = 0; i < unique.length; i++) {
            const p1 = unique[i === 0 ? unique.length - 1 : i - 1];
            const p2 = unique[i];
            const p3 = unique[(i + 1) % unique.length];
            
            const dx1 = p2.x - p1.x, dy1 = p2.y - p1.y;
            const dx2 = p3.x - p2.x, dy2 = p3.y - p2.y;
            const L1 = Math.hypot(dx1, dy1), L2 = Math.hypot(dx2, dy2);
            
            if (L1 < 1e-4 || L2 < 1e-4) continue; // 微小エッジはスキップ
            
            // 外積（行列式）による回転面積
            const cross = Math.abs(dx1 * dy2 - dy1 * dx2);
            // sinθ による正規化判定
            const sinTheta = cross / (L1 * L2);
            
            // sinθが極めて小さい（直線上）でなければ、幾何学的な頂点として採用
            if (sinTheta > 1e-4) {
                nonCollinear.push(p2);
            }
        }
        return nonCollinear.length === 3;
    },
    parseRebar: function(str) { 
        const m = (str || '').match(/(\d+)-D(\d+)/); 
        if (!m) return { area: 127 };
        const count = parseInt(m[1]) || 1;
        const dia = m[2];
        const table = { '10': 71, '13': 127, '16': 199, '19': 287, '22': 387 };
        return { area: count * (table[dia] || 127) };
    },
    parseStirrups: function(str) { 
        const m = (str || '').match(/(\d+)-D(\d+)@(\d+)/); 
        if (!m) return { area: 71, pitch: 200 };
        return { area: (parseInt(m[1]) || 1) * 71, pitch: parseInt(m[3]) || 200 };
    }
};

