/**
 * logic/FoundationEngine.js - 基礎構造計算エンジン
 * v2.4.73 Refactoring: Unified Coordinate & Physical Match
 */

window.FoundationEngine = {
    _mathUtils: null,
    _slabBeamSynchronizer: null,
    _axialEngine: null,
    _areaEngine: null,
    _appState: null,

    inject: function(dependencies) {
        if (dependencies.mathUtils) this._mathUtils = dependencies.mathUtils;
        if (dependencies.slabBeamSynchronizer) this._slabBeamSynchronizer = dependencies.slabBeamSynchronizer;
        if (dependencies.axialEngine) this._axialEngine = dependencies.axialEngine;
        if (dependencies.areaEngine) this._areaEngine = dependencies.areaEngine;
        if (dependencies.appState) this._appState = dependencies.appState;
    },

    get M() {
        return this._mathUtils || window.MathUtils;
    },

    get synchronizer() {
        return this._slabBeamSynchronizer || window.SlabBeamSynchronizer;
    },

    get axial() {
        return this._axialEngine || window.AxialEngine;
    },

    get area() {
        return this._areaEngine || window.AreaEngine;
    },

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

    getConcreteAllowable: function(fc) {
        return {
            fc: fc,
            fck_L: fc / 3,
            ftk_L: 0.49 * Math.pow(fc, 1/3),
            fwk_L: fc / 3 / Math.sqrt(3)
        };
    },

    parseRebar: function(str) {
        if (!str || typeof str !== 'string') return { count: 0, dia: 0, area: 0 };
        const m = str.trim().match(/^(\d+)-D([A-Za-z0-9]+)/i);
        if (!m) return { count: 0, dia: 0, area: 0 };
        const count = parseInt(m[1], 10);
        const typeStr = m[2].toUpperCase();
        
        const diaTbl = { 10: 71.33, 13: 126.7, 16: 198.6, 19: 286.5, 22: 387.1, 25: 506.7, 29: 642.4, 32: 794.2 };
        
        let area1 = 0;
        let dia = 0;
        if (typeStr === '13D16') {
            area1 = diaTbl[13] + diaTbl[16];
            dia = 16;
        } else if (typeStr === '13D19') {
            area1 = diaTbl[13] + diaTbl[19];
            dia = 19;
        } else if (typeStr === '16D19') {
            area1 = diaTbl[16] + diaTbl[19];
            dia = 19;
        } else {
            dia = parseInt(typeStr, 10);
            area1 = diaTbl[dia] || (Math.PI * dia * dia / 4);
        }
        
        return { count, dia, area: count * area1 };
    },

    getSteelStrength: function(str) {
        if (!str) return { ft: 195, fts: 295, type: 'SD295' };
        const isSD345 = /19|22/.test(str);
        if (isSD345) {
            return { ft: 215, fts: 345, type: 'SD345' };
        }
        return { ft: 195, fts: 295, type: 'SD295' };
    },

    parseStirrups: function(str) {
        if (!str || typeof str !== 'string') return { count: 1, dia: 10, pitch: 200, area: 71.33 };
        const m = str.trim().match(/^(\d+)-D(\d+)@(\d+)/i);
        if (!m) return { count: 1, dia: 10, pitch: 200, area: 71.33 };
        const count = parseInt(m[1], 10);
        const dia   = parseInt(m[2], 10);
        const pitch = parseInt(m[3], 10);
        const diaTbl = { 10: 71.33, 13: 126.7, 16: 198.6 };
        const area1 = diaTbl[dia] || (Math.PI * dia * dia / 4);
        return { count, dia, pitch, area: count * area1 };
    },

    runAnalysis: function(state) {
        const s = state || this._appState || window.AppState;
        
        // [本質的解決] 実行開始時に前回のスパン解析結果を完全にクリア・初期化し、
        // 状態が次回の計算に蓄積・リークして接地圧が不当に変動・増幅するバグを完璧に根絶する。
        (s.foundationBeams || []).forEach(b => {
            b.spans = null;
            b.fdStress = null;
        });

        if (!s.config) s.config = {};
        const axial = this.axial;
        if (axial) {
            axial.calculateAllAxialForces(s);
            axial.calculateLongTermAxialForces(s);
        }
        if (typeof reconstructContinuousBeams === 'function') reconstructContinuousBeams();
        this.updateGroundPressure(s);

        // [v2.6.14] ２パス解析（幾何スパン先行生成）の導入
        // 1. スラブ解析の前に、まずスパン分割（geometry）を先行して確定させる
        this.runFoundationBeamAnalysis(s.foundationBeams, s.foundationSlabs, s);

        // 2. 完璧に spans が生成された状態の beams を用いて、スラブ解析を一発で正確に実行する（divisorも完璧に効く！）
        this.calculateSlabAnalysis(s.foundationSlabs, s.averageBuildingPressure);

        // 3. 正確に分配されたスラブ接地圧を用いて、基礎梁の荷重と応力を最終確定させる
        this.calculateSlabTributary(s.foundationSlabs, s.foundationBeams, s);
        this.runFoundationBeamAnalysis(s.foundationBeams, s.foundationSlabs, s);
        this.updateGroundPressure(s);
    },

    updateGroundPressure: function(state) {
        const s = state;
        const area = this.area;
        const a1 = area ? area.getFloorArea('1F', s) : 0;
        const a2 = area ? area.getFloorArea('2F', s) : 0;
        
        const roofPoly = this._getCombinedRoofPolygon(s);
        const M = this.M;
        let roofArea_m2 = roofPoly.length >= 3 ? M.polygonArea(roofPoly) / 1000000 : 0;
        const aRoof = roofArea_m2 > 0 ? roofArea_m2 : Math.max(a1, a2);
        
        const wR = ((s.config?.weights?.roof || 500) + (s.config?.weights?.solar || 0) + (s.config?.weights?.ceilingIns || 100)) / 1000;
        const wF = 2.4; 
        const wW = ((s.config?.weights?.exteriorWall || 600) + (s.config?.weights?.wallIns || 70)) / 1000;
        let len1F = 0, len2F = 0;
        const activeExtWalls = (s.exteriorWalls || []).filter(ew => ew.vertices && ew.vertices.length >= 2);
        if (activeExtWalls.length > 0) {
            activeExtWalls.forEach(ew => {
                let len = 0; const vts = ew.closed ? [...ew.vertices, ew.vertices[0]] : ew.vertices;
                for (let i = 0; i < vts.length - 1; i++) len += Math.hypot(vts[i + 1].x - vts[i].x, vts[i + 1].y - vts[i].y);
                if (ew.floor === '1F') len1F += len / 1000;
                if (ew.floor === '2F') len2F += len / 1000;
            });
        } else {
            // 壁データから自動抽出するフォールバック
            ['1F', '2F'].forEach(f => {
                const boundary = window.WallEngine ? window.WallEngine.extractOuterBoundary(f, s) : null;
                if (boundary && boundary.length >= 2) {
                    let len = 0;
                    const vts = [...boundary, boundary[0]];
                    for (let i = 0; i < vts.length - 1; i++) {
                        len += Math.hypot(vts[i + 1].x - vts[i].x, vts[i + 1].y - vts[i].y);
                    }
                    if (f === '1F') len1F = len / 1000;
                    if (f === '2F') len2F = len / 1000;
                }
            });
        }
        const h1 = s.config.floorHeight1F || 2.7, h2 = s.config.floorHeight2F || 2.7;
        let aWallEst = (len1F * h1) + (len2F * h2);
        if (aWallEst === 0) aWallEst = (a1 + a2) * 1.0;
        const buildingW = (a1 * wF) + (a2 * wF) + (aRoof * wR) + (aWallEst * wW);
        const totalSlabArea = (s.foundationSlabs || []).reduce((sum, sl) => sum + (this.M.Geometry.polygonArea(sl.vertices) / 1000000), 0);
        if (totalSlabArea > 0) { s.averageBuildingPressure = buildingW / totalSlabArea; s.averageGroundPressure = (buildingW + totalSlabArea * 5.0) / totalSlabArea; }
    },

    calculateSlabTributary: function(slabs, beams, state) {
        const triMult = state.config?.triangleMultiplier || 1.33;
        (beams || []).forEach(b => { b.slabLoad = 0; b.tributaryArea = 0; b.tributaryWidth = 0; });
        (slabs || []).forEach(slab => {
            let pts = slab.vertices.map(v => ({ x: v.x, y: v.y })); if (pts.length < 3) return; this.M.ensureCCW(pts);
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
                const area = this.M.Geometry.polygonArea(poly);
                if (area > 100) {
                    let width = area / Ei.L / 1000; if (this._isTriangle(poly)) width = (area * triMult) / Ei.L / 1000;
                    const mx = (Ei.p1.x + Ei.p2.x) / 2, my = (Ei.p1.y + Ei.p2.y) / 2;
                    const trib = { beamId: null, polygon: poly, area, width, mx, my }; slab.tributaryPolygons.push(trib);
                    let bestBeam = null;
                    let bestOverlap = 0;
                    
                    // 1. 共線・重なり優先チェック（第1優先: グリッド大原則の保証）
                    (beams || []).forEach(b => {
                        const dLine = (px, py, x1, y1, x2, y2) => {
                            const l2 = (x2 - x1)**2 + (y2 - y1)**2;
                            if (l2 === 0) return Math.hypot(px - x1, py - y1);
                            const t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
                            return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
                        };
                        const dist1 = dLine(Ei.p1.x, Ei.p1.y, b.p1.x, b.p1.y, b.p2.x, b.p2.y);
                        const dist2 = dLine(Ei.p2.x, Ei.p2.y, b.p1.x, b.p1.y, b.p2.x, b.p2.y);
                        
                        if (dist1 <= 15 && dist2 <= 15) {
                            const L_beam = Math.hypot(b.p2.x - b.p1.x, b.p2.y - b.p1.y);
                            if (L_beam > 0.1) {
                                const uX = (b.p2.x - b.p1.x) / L_beam;
                                const uY = (b.p2.y - b.p1.y) / L_beam;
                                const t1 = (Ei.p1.x - b.p1.x) * uX + (Ei.p1.y - b.p1.y) * uY;
                                const t2 = (Ei.p2.x - b.p1.x) * uX + (Ei.p2.y - b.p1.y) * uY;
                                const minT = Math.min(t1, t2);
                                const maxT = Math.max(t1, t2);
                                const overlap = Math.max(0, Math.min(maxT, L_beam) - Math.max(minT, 0));
                                if (overlap > 10 && overlap > bestOverlap) {
                                    bestOverlap = overlap;
                                    bestBeam = b;
                                }
                            }
                        }
                    });

                    // 2. 従来通り重心距離チェック（第2優先フォールバック）
                    if (!bestBeam) {
                        let minDist = 300;
                        (beams || []).forEach(b => {
                            const d = this._distToSegment(mx, my, b.p1, b.p2);
                            if (d < minDist) {
                                minDist = d;
                                bestBeam = b;
                            }
                        });
                    }

                    if (bestBeam) { trib.beamId = bestBeam.id; bestBeam.tributaryArea += area; bestBeam.tributaryWidth += width; bestBeam.slabLoad += (area / 1000000) * ((slab.fdStress && slab.fdStress.qTotal != null) ? slab.fdStress.qTotal : state.averageGroundPressure); }
                }
            }
        });
    },

    // [v3.4.0] calculateSlabAnalysis -> delegated to FoundationSlabAnalysisEngine (SRP)
    calculateSlabAnalysis: function(slabs, avgBuildingPressure) {
        if (window.FoundationSlabAnalysisEngine) {
            return window.FoundationSlabAnalysisEngine.calculateSlabAnalysis(slabs, avgBuildingPressure, this);
        }
    },

    getBeamPillars: function(beam, state) {
        const s = state || this._appState || window.AppState;
        const p1 = beam.p1, p2 = beam.p2;
        const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
        if (L < 1) return [];

        // [根本修正1] 1F の柱のみを対象にする（基礎は地面の要素）
        // 1F と 2F が同じXY座標に存在する場合、両方を拾うと spans が2倍になり選択ロジックが破綻する
        const targetFloorPillars = (s.pillars || []).filter(p =>
            !p.isDeleted && (p.floor === '1F' || p.floor === 'ALL') &&
            this.M.distToBeamLine(p.x, p.y, p1.x, p1.y, p2.x, p2.y) < 50
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
                // globalX/Y 座標で近傍の実柱を探して荷重を取得する (許容誤差 250mm)
                const op = (s.pillars || []).find(o =>
                    !o.isDeleted && (o.floor === '1F' || o.floor === 'ALL') &&
                    Math.hypot(Number(o.x) - Number(p.globalX), Number(o.y) - Number(p.globalY)) < 250
                );
                
                let val = 0;
                if (op && op.axisSeismicAxial && axisName) {
                    const axisKeys = Object.keys(op.axisSeismicAxial);
                    const targetKey = axisName.replace(/[^a-zA-Z0-9]/g, '');

                    if (op.axisSeismicAxial[axisName] !== undefined) {
                        val = op.axisSeismicAxial[axisName];
                    } else if (targetKey) {
                        const matchKey = axisKeys.find(k =>
                            k.replace(/[^a-zA-Z0-9]/g, '') === targetKey ||
                            k === targetKey ||
                            targetKey.endsWith(k) ||
                            k.endsWith(targetKey)
                        );
                        if (matchKey) val = op.axisSeismicAxial[matchKey];
                    }
                }
                // 【確定仕様】当該基礎梁の通り芯上に耐力壁が存在しない場合は厳密に val = 0（直交方向の軸力は一切混入させない）
                const B_val = bp.B_val !== undefined ? parseFloat(bp.B_val) : 0.5;
                return (isLeft ? val : -val) * B_val / 1000;
            });
            const modelType = bp.modelType || 'both_ends';

            if (modelType === 'simple_beam') {
                return this.calculateSimpleBeamModel(Td, pillars);
            } else if (modelType === 'pillar_supported') {
                return this.calculatePillarSupportedContinuous(Td, pillars);
            } else {
                return this.calculateBothEndsContinuous(Td, pillars);
            }
        };
        return { leftward: calculateDir(true), rightward: calculateDir(false), axisName };
    },

    /**
     * 【単一責任】両端支点連続梁モデルの地震時応力算定
     */
    calculateBothEndsContinuous: function(Td, pillars) {
        const n = pillars.length;
        const L = Math.max(0.001, pillars[n - 1].x - pillars[0].x);
        let sumM = 0, sumT = 0;
        Td.forEach((t, i) => { sumM += t * (pillars[i].x - pillars[0].x); sumT += t; });
        const R_r = -sumM / L;
        const R_l = -sumT - R_r;
        const R = Td.map((_, i) => {
            if (i === 0) return R_l;
            if (i === n - 1) return R_r;
            return 0;
        });

        const Qe = [], Mf = []; let currQ = 0;
        Td.forEach((t, i) => {
            currQ += t + R[i];
            Qe.push(currQ);

            const xi = pillars[i].x - pillars[0].x;
            let m = 0;
            for (let k = 0; k < i; k++) {
                const xk = pillars[k].x - pillars[0].x;
                m += (Td[k] + R[k]) * (xi - xk);
            }
            Mf.push(m);
        });

        const sumTd = Td.reduce((s, t) => s + t, 0);
        const sumR  = R.reduce((s, r) => s + r, 0);
        return { Td, Qe, Mf, R, R_left: R_l, R_right: R_r, supportIdx1: 0, supportIdx2: n - 1, sumTd, sumR, simpleBeamSpans: [] };
    },

    /**
     * 【単一責任】柱直下支点連続梁モデルの地震時応力算定
     */
    calculatePillarSupportedContinuous: function(Td, pillars) {
        const n = pillars.length;
        const x = pillars.map(p => p.x);
        const Sx = x.reduce((sum, xi) => sum + xi, 0);
        const Sxx = x.reduce((sum, xi) => sum + xi * xi, 0);
        const ST = Td.reduce((sum, ti) => sum + ti, 0);
        const STx = Td.reduce((sum, ti, idx) => sum + ti * x[idx], 0);

        const det = n * Sxx - Sx * Sx;
        let A = 0, B = 0;
        if (Math.abs(det) > 1e-9) {
            A = (-ST * Sxx + STx * Sx) / det;
            B = (-n * STx + Sx * ST) / det;
        } else {
            A = -ST / Math.max(1, n);
            B = 0;
        }

        const R = x.map(xi => A + B * xi);
        const R_l = R[0];
        const R_r = R[n - 1];

        const Qe = [], Mf = []; let currQ = 0;
        Td.forEach((t, i) => {
            currQ += t + R[i];
            Qe.push(currQ);

            const xi = pillars[i].x - pillars[0].x;
            let m = 0;
            for (let k = 0; k < i; k++) {
                const xk = pillars[k].x - pillars[0].x;
                m += (Td[k] + R[k]) * (xi - xk);
            }
            Mf.push(m);
        });

        const sumTd = Td.reduce((s, t) => s + t, 0);
        const sumR  = R.reduce((s, r) => s + r, 0);
        return { Td, Qe, Mf, R, R_left: R_l, R_right: R_r, supportIdx1: 0, supportIdx2: n - 1, sumTd, sumR, simpleBeamSpans: [] };
    },

    /**
     * 【単一責任】単純梁モデルのスパン別地震時応力算定 (アーキトレンド完全一致)
     */
    calculateSimpleBeamModel: function(Td, pillars) {
        const simpleBeamSpans = [];
        const n = pillars.length;
        const R = pillars.map(() => 0);
        const Qe_nodes = pillars.map(() => 0);
        const Mf_nodes = pillars.map(() => 0);

        if (n >= 2) {
            // 1. 各スパンの壁判定・M水算定 (アーキトレンド公式: M水 = (lTd - rTd)/2 * L)
            for (let i = 0; i < n - 1; i++) {
                const lTd_val = Td[i];
                const rTd_val = Td[i + 1];
                const L_span  = pillars[i + 1].x - pillars[i].x;
                const isWall  = (Math.abs(lTd_val) > 1e-6 || Math.abs(rTd_val) > 1e-6);
                const M_wf    = (lTd_val - rTd_val) / 2 * L_span;
                simpleBeamSpans.push({
                    idx_l: i, idx_r: i + 1,
                    lTd: lTd_val, rTd: rTd_val,
                    L: L_span, isWall, M_wf,
                    Qe: 0, lM_wf: 0, rM_wf: 0
                });
            }

            // 2. 開口スパンの伝達モーメント・せん断力算定
            for (let i = 0; i < simpleBeamSpans.length; i++) {
                const sp = simpleBeamSpans[i];
                if (sp.isWall) continue;

                let leftWall = null;
                for (let j = i - 1; j >= 0; j--) {
                    if (simpleBeamSpans[j].isWall) { leftWall = simpleBeamSpans[j]; break; }
                }
                let rightWall = null;
                for (let j = i + 1; j < simpleBeamSpans.length; j++) {
                    if (simpleBeamSpans[j].isWall) { rightWall = simpleBeamSpans[j]; break; }
                }

                const M_left  = leftWall ? leftWall.M_wf : 0;
                const M_right = rightWall ? rightWall.M_wf : 0;

                sp.lM_wf = M_left / 2;
                sp.rM_wf = -M_right / 2;
                sp.Qe    = sp.L > 1e-9 ? (sp.lM_wf - sp.rM_wf) / sp.L : 0;
            }
        }

        return { Td, Qe: Qe_nodes, Mf: Mf_nodes, R, R_left: 0, R_right: 0, supportIdx1: 0, supportIdx2: n - 1, sumTd: 0, sumR: 0, simpleBeamSpans };
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
                // [根本修正] 支点不足（片持ち等）の場合であってもスラブ接地圧の同期計算は仮想スパンに対して実行する
                const p1_node = {
                    id: 's1',
                    name: '始点',
                    x: 0,
                    globalX: beam.p1.x,
                    globalY: beam.p1.y,
                    seismicAxial: 0
                };
                const p2_node = {
                    id: 's2',
                    name: '終点',
                    x: Math.hypot(beam.p2.x - beam.p1.x, beam.p2.y - beam.p1.y) / 1000,
                    globalX: beam.p2.x,
                    globalY: beam.p2.y,
                    seismicAxial: 0
                };
                const L = Math.max(0.1, p2_node.x - p1_node.x);

                const b_val = beam.props?.width || 150;
                const h_val = beam.props?.height || 640;
                const embed_val = beam.props?.embedDepth ?? 250;
                const w_self_span = (b_val * (Math.max(0, h_val - embed_val) + 10.0) / 1e6) * 24.0;

                const load = (window.SlabBeamSynchronizer && typeof window.SlabBeamSynchronizer.calculateSpanSlabLoad === 'function')
                    ? window.SlabBeamSynchronizer.calculateSpanSlabLoad(slabs, beam, { p1: p1_node, p2: p2_node }, s)
                    : { sigma: 12.0, B: 1.0, isSyncFailed: true };

                const w = (load.sigma * load.B) + w_self_span;

                spans.push({
                    startNode: p1_node,
                    endNode: p2_node,
                    L,
                    sigma_e: load.sigma,
                    B_trib: load.B,
                    w,
                    isSyncFailed: !!load.isSyncFailed,
                    M_mid: 0,
                    M_end_left: 0,
                    M_end_right: 0,
                    Q_left: 0,
                    Q_right: 0,
                    props: {
                        width: b_val,
                        height: h_val,
                        embedDepth: embed_val
                    }
                });

                beam.fdStress = { pillars: [p1_node, p2_node], seismic, spans, isNG: !!load.isSyncFailed };
                return;
            }

            if (!beam.spanProps) beam.spanProps = [];

            for (let i = 0; i < pillars.length - 1; i++) {
                const p1 = pillars[i], p2 = pillars[i+1], L = Math.max(0.1, p2.x - p1.x);
                
                // 1. 永続スパンプロパティ(spanProps)を優先参照
                const sp = beam.spanProps[i] || {};
                
                // 2. スパン別次元の確定 (個別指定が無ければ全体デフォルト)
                const b_val = sp.width !== undefined ? parseFloat(sp.width) : (beam.props?.width || 150);
                const h_val = sp.height !== undefined ? parseFloat(sp.height) : (beam.props?.height || 640);
                const embed_val = sp.embedDepth !== undefined ? parseFloat(sp.embedDepth) : (beam.props?.embedDepth ?? 250);
                
                // 鉄筋および基礎符号もスパン別上書きに対応 (スコープをループ直下に配置)
                const symbolStr = sp.symbol || beam.props?.symbol || beam.props?.beamName || `FG${i+1}`;
                const topRebarStr = sp.topRebar || beam.props?.topRebar || '1-D13';
                const botRebarStr = sp.bottomRebar || beam.props?.bottomRebar || '1-D13';
                const stirrupStr = sp.stirrup || beam.props?.stirrup || '1-D10@200';
                
                // 永続ストア spanProps に即座に保存
                beam.spanProps[i] = {
                    symbol: symbolStr,
                    width: b_val,
                    height: h_val,
                    embedDepth: embed_val,
                    topRebar: topRebarStr,
                    bottomRebar: botRebarStr,
                    stirrup: stirrupStr
                };
                
                const topRebar = this.parseRebar(topRebarStr);
                const botRebar = this.parseRebar(botRebarStr);
                const st = this.parseStirrups(stirrupStr);

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
                    const M_end_left = (i === 0 ? 0 : M_end);
                    const M_end_right = (i === pillars.length - 2 ? 0 : M_end);
                    
                    // Combined moment (signed: gravity support end moment under upward pressure is positive)
                    const M_combo_l = M_end_left + (res.Mf[i] || 0);
                    const M_combo_r = M_end_right + (res.Mf[i + 1] || 0);
                    const Q_s = Q_L + Math.abs(res.Qe[i] || 0);
                    
                    // スパン別断面検定 (b_val, h_valを使用)
                    const d = Math.max(10, h_val - 70);
                    const j = d * 0.875;
                    
                    const lMa_top = (topRebar.area * 195 * j) / 1e6;
                    const lMa_bot = (botRebar.area * 195 * j) / 1e6;
                    const sMa_top = lMa_top * 1.5;
                    const sMa_bot = lMa_bot * 1.5;
                    
                    const fs = (s.config?.concreteFc || 21) / 30;
                    const Qa_conc_L = 1.0 * fs * b_val * j / 1000;
                    const Qa_steel_L = (st.area * 295 * j / (st.pitch || 200)) / 1000;
                    const lQa = Qa_conc_L + Qa_steel_L;
                    
                    // せん断スパン比αの算定 (画像に基づいて短期・長期のモーメントを適用)
                    const M_ratio_L = Math.max(Math.abs(M_end), 1e-6);
                    const alpha_L = Math.max(1.0, Math.min(2.0, 4.0 / ((M_ratio_L / (Q_L * d / 1000 || 1)) + 1)));
                    
                    const M_combo_max = Math.max(Math.abs(M_combo_l), Math.abs(M_combo_r));
                    const M_ratio_S = Math.max(M_combo_max, 1e-6);
                    const alpha_S = Math.max(1.0, Math.min(2.0, 4.0 / ((M_ratio_S / (Q_s * d / 1000 || 1)) + 1)));
                    const sQa = (alpha_S * fs * b_val * j * 1.5 / 1000) + Qa_steel_L;
                    
                    // 端部曲げモーメント(上筋抵抗 sMa_top) と 中央部曲げモーメント(下筋抵抗 sMa_bot) の分離算定
                    const M_mid_S = Math.abs(M_mid + ((res.Mf[i] || 0) + (res.Mf[i + 1] || 0)) / 2.0);
                    const rM_mid_S = M_mid_S / (sMa_bot || 1);

                    const rM_left_top = Math.abs(M_combo_l) / (sMa_top || 1);
                    const rM_right_top = Math.abs(M_combo_r) / (sMa_top || 1);
                    const rM_end_max = Math.max(rM_left_top, rM_right_top);

                    const cap_l = M_combo_l < 0 ? sMa_top : sMa_bot;
                    const cap_r = M_combo_r < 0 ? sMa_top : sMa_bot;
                    
                    const rM_left = Math.abs(M_combo_l) / (cap_l || 1);
                    const rM_right = Math.abs(M_combo_r) / (cap_r || 1);
                    
                    return {
                        M_left: Math.abs(M_combo_l), M_mid_S: M_mid_S, M_right: Math.abs(M_combo_r), Q: Q_s,
                        lMa_top, lMa_bot, sMa_top, sMa_bot, lQa, sQa,
                        alpha_L, alpha_S, pw: st.area / (b_val * (st.pitch || 200)),
                        rM_left, rM_right, rM_left_top, rM_right_top, rM_end_max, rM_mid_S,
                        ok: Math.abs(M_combo_l) < cap_l && Math.abs(M_combo_r) < cap_r && M_mid_S < sMa_bot && Q_s < sQa
                    };
                };
                
                const resL = check(true);
                const resR = check(false);
                
                const M_end_left = (i === 0 ? 0 : M_end);
                const M_end_right = (i === pillars.length - 2 ? 0 : M_end);
                
                // 長期曲げ: 中央部M中 (上端引張 lMa_top) と 端部M端 (下端引張 lMa_bot)
                const rM_L_mid = M_mid / (resL.lMa_top || 1);
                const rM_L_end = Math.max(M_end_left / (resL.lMa_bot || 1), M_end_right / (resL.lMa_bot || 1));
                const rM_L = Math.max(rM_L_mid, rM_L_end);
                const rQ_L = Q_L / (resL.lQa || 1);

                const rM_end_S = Math.max(resL.rM_end_max, resR.rM_end_max);
                const rM_mid_S_max = Math.max(resL.rM_mid_S, resR.rM_mid_S);
                const needTopBoost = (rM_L_mid > 1.0) || (resL.rM_left_top > 1.0) || (resL.rM_right_top > 1.0) || (resR.rM_left_top > 1.0) || (resR.rM_right_top > 1.0);
                const needBotBoost = (rM_L_end > 1.0);

                const spanNG = (
                    rM_L_mid > 1.0 ||
                    rM_L_end > 1.0 ||
                    rQ_L > 1.0 ||
                    resL.rM_left_top > 1.0 ||
                    resL.rM_right_top > 1.0 ||
                    (resL.Q / (resL.sQa || 1)) > 1.0 ||
                    resR.rM_left_top > 1.0 ||
                    resR.rM_right_top > 1.0 ||
                    (resR.Q / (resR.sQa || 1)) > 1.0
                );
                if (spanNG) isNG = true;
                
                spans.push({
                    spanName: `${p1.name}-${p2.name}`,
                    startNode: p1, endNode: p2,
                    L, sigma_e: load.sigma, B_trib: load.B, w,
                    isSyncFailed: load.isSyncFailed,
                    M_mid, M_end, Q_L, rM_L, rQ_L,
                    rM_L_mid, rM_L_end,
                    ratioM_L: rM_L, ratioQ_L: rQ_L,
                    rM_end_S, rM_mid_S: rM_mid_S_max,
                    needTopBoost, needBotBoost,
                    ratioM_S: Math.max(rM_end_S, rM_mid_S_max),
                    ratioQ_S: Math.max(resL.Q/resL.sQa, resR.Q/resR.sQa),
                    leftward: { ...resL, rQ: resL.Q/(resL.sQa || 1) },
                    rightward: { ...resR, rQ: resR.Q/(resR.sQa || 1) },
                    cap: { 
                        ...resL, 
                        alpha_S_L: resL.alpha_S, 
                        alpha_S_R: resR.alpha_S,
                        sQa_L: resL.sQa,
                        sQa_R: resR.sQa,
                        b: b_val,
                        h: h_val
                    },
                    isNG: spanNG,
                    props: beam.spanProps[i]
                });
            }
            beam.fdStress = { pillars, seismic, spans, isNG };
            beam.spans = spans;
        });
    },    _getConvexHull: function(points) {
        if (!points || points.length <= 1) return points || [];
        const unique = [];
        const seen = new Set();
        points.forEach(p => {
            const key = `${Math.round(p.x)}_${Math.round(p.y)}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(p);
            }
        });
        if (unique.length <= 1) return unique;
        unique.sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
        const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        const lower = [];
        for (let i = 0; i < unique.length; i++) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], unique[i]) <= 0) {
                lower.pop();
            }
            lower.push(unique[i]);
        }
        const upper = [];
        for (let i = unique.length - 1; i >= 0; i--) {
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], unique[i]) <= 0) {
                upper.pop();
            }
            upper.push(unique[i]);
        }
        lower.pop();
        upper.pop();
        return lower.concat(upper);
    },

    _offsetPolygon: function(poly, d) {
        if (!poly || poly.length < 3) return [];
        let pts = poly.map(v => ({ x: v.x, y: v.y }));
        if (this.M && this.M.ensureCCW) {
            this.M.ensureCCW(pts);
        } else {
            let sum = 0;
            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
                sum += (p2.x - p1.x) * (p2.y + p1.y);
            }
            if (sum > 0) pts.reverse();
        }
        const n = pts.length;
        const normals = [];
        for (let i = 0; i < n; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % n];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const L = Math.hypot(dx, dy);
            if (L < 1e-6) {
                normals.push({ x: 0, y: 0 });
            } else {
                normals.push({ x: dy / L, y: -dx / L });
            }
        }
        const offsetPts = [];
        for (let i = 0; i < n; i++) {
            const p = pts[i];
            const n_prev = normals[(i - 1 + n) % n];
            const n_curr = normals[i];
            
            const denom = 1 + (n_prev.x * n_curr.x + n_prev.y * n_curr.y);
            const factor = denom > 1e-4 ? 1 / denom : 1;
            const vx = (n_prev.x + n_curr.x) * factor;
            const vy = (n_prev.y + n_curr.y) * factor;
            
            offsetPts.push({
                x: p.x + d * vx,
                y: p.y + d * vy
            });
        }
        return offsetPts;
    },

    _getCombinedRoofPolygon: function(state) {
        const s = state;
        const areaLines = s.areaLines || [];
        const targetPolys = areaLines.filter(a => 
            !a.isDeleted && a.vertices && a.vertices.length >= 3 && 
            (!a.areaType || a.areaType === 'floor' || a.areaType === 'porch')
        );
        const pts = [];
        targetPolys.forEach(a => {
            a.vertices.forEach(v => {
                pts.push({ x: v.x, y: v.y });
            });
        });
        if (pts.length === 0) {
            const activePillars = (s.pillars || []).filter(p => !p.isDeleted && !p.isInvalidPos);
            activePillars.forEach(p => {
                pts.push({ x: p.x, y: p.y });
            });
        }
        if (pts.length < 3) {
            return [];
        }
        const hull = this._getConvexHull(pts);
        const eavesLen = s.config?.eavesLen !== undefined ? s.config.eavesLen : 300;
        return this._offsetPolygon(hull, eavesLen);
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
        if (this.M && this.M.isPointInPolygon && this.M.isPointInPolygon(mid, poly)) return 2; // Internal
        return 0; // None
    },
    _isBeamOnSlabBoundary: function(b, poly) {
        const onBound = (p) => { for (let i = 0; i < poly.length; i++) { if (this.M.distToBeamLine(p.x, p.y, poly[i].x, poly[i].y, poly[(i+1)%poly.length].x, poly[(i+1)%poly.length].y) < 10) return true; } return false; };
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
        if (!str) return { area: 126.7 };
        const raw = String(str).trim();
        const table = { '10': 71.33, '13': 126.7, '16': 198.6, '19': 286.5, '22': 387.1, '25': 506.7 };
        
        let totalArea = 0;
        // '+' または ',' で分割された複数指定に対応 (例: 1-D13+1-D16 または 2-D13)
        const parts = raw.split(/[+,]/);
        parts.forEach(p => {
            const item = p.trim();
            const m = item.match(/(\d+)?\s*-?\s*D([A-Za-z0-9]+)/i);
            if (m) {
                const count = parseInt(m[1]) || 1;
                const typeStr = m[2].toUpperCase();
                if (typeStr === '13D16' || typeStr === '1316') {
                    totalArea += count * (table['13'] + table['16']);
                } else if (typeStr === '13D19' || typeStr === '1319') {
                    totalArea += count * (table['13'] + table['19']);
                } else if (typeStr === '16D19' || typeStr === '1619') {
                    totalArea += count * (table['16'] + table['19']);
                } else {
                    const unitArea = table[typeStr] || 126.7;
                    totalArea += count * unitArea;
                }
            }
        });
        return { area: totalArea > 0 ? totalArea : 126.7 };
    },
    parseStirrups: function(str) { 
        const m = (str || '').match(/(\d+)-D(\d+)@(\d+)/); 
        if (!m) return { area: 71, pitch: 200 };
        return { area: (parseInt(m[1]) || 1) * 71, pitch: parseInt(m[3]) || 200 };
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('FoundationEngine', window.FoundationEngine);
}

