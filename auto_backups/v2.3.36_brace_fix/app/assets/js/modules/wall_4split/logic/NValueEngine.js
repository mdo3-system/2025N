/**
 * logic/NValueEngine.js - N-Value Calculation Engine
 * v2.3.25 Refactoring
 */

window.NValueEngine = {
    /**
     * Get the list of hardware for N-value selection
     */
    getHardwareList: function() {
        if (!window.Specs) return [];
        const base = window.Specs.getHardwareList();
        const custom = (window.AppState.customHardware || []).map(ch => ({
            name: ch.name,
            n: ch.val / 5.3,
            text: `[任意] ${ch.name} (${ch.val}kN)`
        }));
        return [...base, ...custom].sort((a, b) => a.n - b.n);
    },

    /**
     * Calculate N-values for all pillars (Faithful Port v2.1.1)
     */
    calculateNValues: function(state) {
        const s = state || window.AppState;
        const config = s.config;
        
        const h1 = config.floorHeight1F || 2.7;
        const h2 = config.floorHeight2F || 2.7;
        
        const wRoof = (s.config.weights.roof + s.config.weights.solar + s.config.weights.ceilingIns) / 1000;
        const wFloor = 0.60;
        
        const pillars2F = s.pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === '2F');
        let map2FByName = {};
        pillars2F.forEach(p => {
            let nm = window.getPillarName(p, s);
            if (nm && nm !== '位置不明') map2FByName[nm] = p;
        });

        const has2FAbove = (p) => {
            let nm = window.getPillarName(p, s);
            if (map2FByName[nm]) return true;
            return false;
        };

        // Table 3-14 Correction Factor
        const calcTable314Correction = (brace1, brace2) => {
            if (!brace1 && !brace2) return 0;
            if ((brace1 && brace1.m === 4.0) || (brace2 && brace2.m === 4.0)) return 0.5;
            if (!brace1 || !brace2) {
                let b = brace1 || brace2;
                if (b.m === 1.5 || b.m === 2.0) return b.type === 'P1' ? -0.5 : 0.5;
                if (b.m === 3.0) return b.type === 'P1' ? -2.0 : 2.0;
                return 0;
            }
            let m = Math.max(brace1.m, brace2.m);
            let types = [brace1.type, brace2.type].sort().join('');
            if (m === 1.5 || m === 2.0) {
                if (types === 'P1P1') return 0;
                if (types === 'P2P2') return 1.0;
                if (types === 'P1P2') return 1.5;
            }
            if (m === 3.0) {
                if (types === 'P1P1') return 0;
                if (types === 'P2P2') return 2.0;
                if (types === 'P1P2') return 2.0;
            }
            return 0;
        };

        // Collect Alpha (Pull-out force components)
        const collectAlpha = (targetPillarId, targetFloor, refP) => {
            let sumR = 0, sumL = 0, sumT = 0, sumB = 0;
            let braceX_L = null, braceX_R = null, braceY_B = null, braceY_T = null;
            const parts = { X: [], Y: [] };

            s.walls.filter(w => w.floor === targetFloor && (w.p1.id === targetPillarId || w.p2.id === targetPillarId))
                .forEach(w => {
                    const tv = window.getWallTotalVal(w);
                    if (tv === 0) return;
                    const op = (w.p1.id === targetPillarId) ? w.p2 : w.p1;
                    const dx = Math.abs(op.x - refP.x), dy = Math.abs(op.y - refP.y);
                    const L_wall = Math.sqrt(dx * dx + dy * dy) / 1000;
                    if (L_wall === 0) return;

                    let isP1 = w.p1.id === targetPillarId;
                    let isBrace = w.braceId ? (w.braceId !== 'b0') : false;
                    let braceObj = isBrace ? { m: window.WallEngine.getBraceSpec(w.braceId).val, type: isP1 ? 'P1' : 'P2' } : null;
                    let isDiag = (dx > 10 && dy > 10);
                    let effTx = isDiag ? tv : (dx > dy ? tv : 0);
                    let effTy = isDiag ? tv : (dy > dx ? tv : 0);
                    let label = isDiag ? '(斜)' : '(基)';

                    if (effTx > 0.01) {
                        if (op.x >= refP.x) { sumR += effTx; parts.X_R = parts.X_R || []; parts.X_R.push(`${effTx.toFixed(2)}${label}`); if (isBrace) braceX_R = braceObj; }
                        else { sumL += effTx; parts.X_L = parts.X_L || []; parts.X_L.push(`${effTx.toFixed(2)}${label}`); if (isBrace) braceX_L = braceObj; }
                    }
                    if (effTy > 0.01) {
                        if (op.y >= refP.y) { sumT += effTy; parts.Y_T = parts.Y_T || []; parts.Y_T.push(`${effTy.toFixed(2)}${label}`); if (isBrace) braceY_T = braceObj; }
                        else { sumB += effTy; parts.Y_B = parts.Y_B || []; parts.Y_B.push(`${effTy.toFixed(2)}${label}`); if (isBrace) braceY_B = braceObj; }
                    }
                });

            let effX = 0;
            if (sumR > 0 || sumL > 0) {
                let baseDiffX = Math.abs(sumR - sumL);
                let corrX = calcTable314Correction(braceX_L, braceX_R);
                effX = Math.max(0, baseDiffX + corrX);
                parts.X = [`(${Math.abs(sumR-sumL).toFixed(2)})${corrX !== 0 ? (corrX > 0 ? '+' : '') + corrX.toFixed(2) : ''}`];
            }
            let effY = 0;
            if (sumT > 0 || sumB > 0) {
                let baseDiffY = Math.abs(sumT - sumB);
                let corrY = calcTable314Correction(braceY_B, braceY_T);
                effY = Math.max(0, baseDiffY + corrY);
                parts.Y = [`(${Math.abs(sumT-sumB).toFixed(2)})${corrY !== 0 ? (corrY > 0 ? '+' : '') + corrY.toFixed(2) : ''}`];
            }
            return { aL: 0, aR: effX, aB: 0, aT: effY, parts };
        };

        // 1. Calculate Alphas for 2F
        s.pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === '2F').forEach(p => {
            const { aR, aT, parts } = collectAlpha(p.id, '2F', p);
            p.Ax = aR; p.Ay = aT; p._parts = parts;
        });

        // 2. Final N-Value Logic for all floors
        ['2F', '1F'].forEach(f => {
            s.pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === f).forEach(p => {
                const isC = p.isManualCorner !== null ? p.isManualCorner : p.isCornerAuto;
                p.isC = isC;
                const b = isC ? 0.8 : 0.5;
                const baseH = f === '1F' ? h1 : h2;
                const p_h = p.manualH || baseH;
                const p_d = p.manualD || (f === '1F' ? config.pillarDepth1F : config.pillarDepth2F);
                
                const k_p = (p_h <= 3.2 ? 2.7 : p_h) / 2.7;
                let usedArea = p.manualArea !== null ? p.manualArea : (p.autoArea || 0);
                let isDetail = p.lCalcMode === 'detail';

                if (f === '1F') {
                    const upper = map2FByName[window.getPillarName(p, s)] || null;
                    const underUpper = has2FAbove(p);
                    const { aR, aT, parts } = collectAlpha(p.id, '1F', p);
                    
                    let L = isDetail ? ((underUpper ? (wRoof + wFloor) : wRoof) * usedArea / 5.3) : (underUpper ? (isC ? 1.0 : 1.6) : (isC ? 0.4 : 0.6));
                    
                    if (underUpper && upper) {
                        const b2 = (upper.isManualCorner !== null ? upper.isManualCorner : upper.isCornerAuto) ? 0.8 : 0.5;
                        const k2 = ((upper.manualH || h2) <= 3.2 ? 2.7 : (upper.manualH || h2)) / 2.7;
                        p.nValue = Math.max(0, (aR * b * k_p) + (upper.Ax * b2 * k2) - L, (aT * b * k_p) + (upper.Ay * b2 * k2) - L);
                    } else {
                        p.nValue = Math.max(0, aR * b * k_p - L, aT * b * k_p - L);
                    }
                } else {
                    let L = isDetail ? (wRoof * usedArea / 5.3) : (isC ? 0.4 : 0.6);
                    p.nValue = Math.max(0, p.Ax * b * k_p - L, p.Ay * b * k_p - L);
                }
                
                // Hardware mapping
                if (p.nValue <= 0) {
                    p.nMark = '不要';
                } else {
                    const hwList = (typeof window.getHardwareList === 'function') ? window.getHardwareList() : [];
                    const hw = hwList.find(h => !h.isCust && h.n >= p.nValue);
                    p.nMark = hw ? hw.name : '別途検討';
                }
                if (p.manualMark) p.nMark = p.manualMark;
            });
        });
    }
};
