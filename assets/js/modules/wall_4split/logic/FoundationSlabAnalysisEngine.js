/**
 * logic/FoundationSlabAnalysisEngine.js - 基礎スラブ構造計算・断面検定エンジン
 * v3.4.0 Refactoring: Single Responsibility Principle (SRP)
 */

window.FoundationSlabAnalysisEngine = {
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

    /**
     * ベタ基礎スラブ・片持ちスラブの接地圧算定・曲げモーメント・許容耐力断面検定
     * @param {Array} slabs - スラブ配列
     * @param {number} avgBuildingPressure - 平均建物接地圧
     * @param {Object} [engineFacade] - FoundationEngine 参照
     */
    calculateSlabAnalysis: function(slabs, avgBuildingPressure, engineFacade) {
        if (!slabs) return;
        const fe = engineFacade || window.FoundationEngine;
        const s = window.AppState;
        const M = window.MathUtils;
        const beams = (s.foundationBeams || []).filter(b => !b.isDeleted);

        // Step 1: Pre-aggregation determining discrete span boundaries.
        const spanAdjacency = {};
        beams.forEach(b => {
            const spans = b.spans || [];
            spans.forEach((sp, idx) => {
                const key = `${b.id}_${idx}`; spanAdjacency[key] = 0;
                const p1 = { x: sp.startNode?.globalX ?? b.p1.x, y: sp.startNode?.globalY ?? b.p1.y };
                const p2 = { x: sp.endNode?.globalX ?? b.p2.x, y: sp.endNode?.globalY ?? b.p2.y };
                const spanObj = { p1, p2 };
                slabs.forEach(slab => {
                    if (fe && typeof fe._isBeamOnSlabBoundary === 'function') {
                        if (fe._isBeamOnSlabBoundary(spanObj, slab.vertices)) spanAdjacency[key]++;
                    }
                });
            });
        });

        slabs.forEach(slab => {
            const area = M.polygonArea(slab.vertices) / 1000000;
            const a1Polys = (s.areaLines || []).filter(al => al.floor === '1F' && !['attic','balcony'].includes(al.areaType));
            const a2Polys = (s.areaLines || []).filter(al => al.floor === '2F' && !['attic','balcony'].includes(al.areaType));

            // 耳刈り法（Ear Clipping）
            const triangulate = (verts) => {
                const pts = [];
                for (let i = 0; i < verts.length; i++) {
                    const p = verts[i];
                    if (pts.length === 0 || Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y) > 1e-3) {
                        pts.push({ x: p.x, y: p.y });
                    }
                }
                if (pts.length > 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-3) {
                    pts.pop();
                }
                if (pts.length < 3) return [];
                
                let a = 0;
                for (let i = 0; i < pts.length; i++) {
                    let j = (i + 1) % pts.length;
                    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
                }
                if (a < 0) pts.reverse();
                
                const indices = pts.map((_, idx) => idx);
                let limit = pts.length * 3;
                const triangles = [];
                
                const isEar = (u, v, w, n, pts, indices) => {
                    const pA = pts[indices[u]], pB = pts[indices[v]], pC = pts[indices[w]];
                    if ((pB.x - pA.x) * (pC.y - pA.y) - (pB.y - pA.y) * (pC.x - pA.x) <= 1e-6) return false;
                    for (let i = 0; i < n; i++) {
                        if (i === u || i === v || i === w) continue;
                        const p = pts[indices[i]];
                        const c1 = (pB.x - pA.x) * (p.y - pA.y) - (pB.y - pA.y) * (p.x - pA.x);
                        const c2 = (pC.x - pB.x) * (p.y - pB.y) - (pC.y - pB.y) * (p.x - pB.x);
                        const c3 = (pA.x - pC.x) * (p.y - pC.y) - (pA.y - pC.y) * (p.x - pC.x);
                        if (c1 >= -1e-6 && c2 >= -1e-6 && c3 >= -1e-6) return false;
                    }
                    return true;
                };
                
                while (indices.length > 2 && limit > 0) {
                    limit--;
                    let earFound = false;
                    for (let i = 0; i < indices.length; i++) {
                        const u = (i - 1 + indices.length) % indices.length;
                        const v = i;
                        const w = (i + 1) % indices.length;
                        if (isEar(u, v, w, indices.length, pts, indices)) {
                            triangles.push([pts[indices[u]], pts[indices[v]], pts[indices[w]]]);
                            indices.splice(v, 1);
                            earFound = true;
                            break;
                        }
                    }
                    if (!earFound) {
                        triangles.push([pts[indices[0]], pts[indices[1]], pts[indices[2]]]);
                        indices.splice(1, 1);
                    }
                }
                return triangles;
            };

            const intersectArea = (p, areaPolys) => {
                let total = 0;
                const pCCW = p.map(v => ({ x: v.x, y: v.y }));
                M.ensureCCW(pCCW);

                areaPolys.forEach(ap => {
                    if (!ap.vertices || ap.vertices.length < 3) return;
                    const tris = triangulate(ap.vertices);

                    tris.forEach(tri => {
                        let clipped = [...pCCW];
                        for (let i = 0; i < tri.length; i++) {
                            const p1 = tri[i], p2 = tri[(i + 1) % tri.length], dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
                            if (L < 1) continue;
                            if (fe && typeof fe._clipByLine === 'function') {
                                clipped = fe._clipByLine(clipped, dy/L, -dx/L, -((dy/L)*p1.x + (-dx/L)*p1.y));
                            }
                        }
                        total += M.polygonArea(clipped) / 1000000;
                    });
                });
                return total;
            };

            let sArea1F = intersectArea(slab.vertices, a1Polys);
            const sArea2F = intersectArea(slab.vertices, a2Polys);
            
            if (sArea1F <= 0.0001) {
                sArea1F = area;
            }
            
            const roofPoly = fe && typeof fe._getCombinedRoofPolygon === 'function' ? fe._getCombinedRoofPolygon(s) : [];
            let sAreaRoof = 0;
            if (roofPoly && roofPoly.length >= 3) {
                sAreaRoof = intersectArea(slab.vertices, [{ vertices: roofPoly }]);
            } else {
                sAreaRoof = Math.max(sArea1F, sArea2F);
            }
            
            const wR = ((s.config?.weights?.roof || 500) + (s.config?.weights?.solar || 0) + (s.config?.weights?.ceilingIns || 100)) / 1000;
            const wW = ((s.config?.weights?.exteriorWall || 600) + (s.config?.weights?.wallIns || 70)) / 1000;
            const wF = 2.4;
            const axial_kN = (sArea1F * (wF + wW)) + (sArea2F * wF) + (sAreaRoof * wR);
            let stem_kN = 0; 
            
            beams.forEach(b => {
                const spans = b.spans || [];
                if (spans.length > 0) {
                    spans.forEach((sp, idx) => {
                        const key = `${b.id}_${idx}`;
                        const p1 = { x: sp.startNode?.globalX ?? b.p1.x, y: sp.startNode?.globalY ?? b.p1.y };
                        const p2 = { x: sp.endNode?.globalX ?? b.p2.x, y: sp.endNode?.globalY ?? b.p2.y };
                        const spanObj = { p1, p2 };
                        
                        const involve = fe && typeof fe._isBeamInvolvedInSlab === 'function' ? fe._isBeamInvolvedInSlab(spanObj, slab.vertices) : 0;
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
                    const involve = fe && typeof fe._isBeamInvolvedInSlab === 'function' ? fe._isBeamInvolvedInSlab(b, slab.vertices) : 0;
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

            let edgeLengths = [];
            for (let i = 0; i < slab.vertices.length; i++) {
                const p1 = slab.vertices[i], p2 = slab.vertices[(i + 1) % slab.vertices.length];
                edgeLengths.push(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 1000);
            }
            edgeLengths.sort((a, b) => a - b);
            
            let lx = edgeLengths[0] || 0;
            let ly = edgeLengths[edgeLengths.length - 1] || 0;
            if (edgeLengths.length >= 4) {
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
            slab.fdStress.detailedLoads = { wR, wW, wF, sArea1F, sArea2F, sAreaRoof };
        });
    }
};

// Register with ServiceContainer
if (window.ServiceContainer) {
    window.ServiceContainer.register('FoundationSlabAnalysisEngine', window.FoundationSlabAnalysisEngine);
}
