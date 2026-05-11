/**
 * logic/AxialEngine.js - Seismic Axial Force Calculation Engine
 * Dedicated to calculating Sigma N for foundation and reporting.
 */

window.AxialEngine = {
    /**
     * Calculate cumulative seismic axial forces (Sigma N) for all pillars by axis.
     * Logic based on ElevationRenderer's table: N = alpha * 1.96 * H
     */
    calculateAllAxialForces: function(state) {
        const s = state || window.AppState;
        
        // Ensure grid names and coords are analyzed and up-to-date
        if (window.GridEngine && window.GridEngine.analyzeGrids) {
            window.GridEngine.analyzeGrids(s);
        }
        
        // 1. Initialize seismicAxial and axisSeismicAxial for all pillars
        s.pillars.forEach(p => {
            p.seismicAxial = 0; // Cumulative Sigma N at the base (1F) Sum
            p.seismicAxial2F = 0; // Sigma N at 2F floor level Sum
            p.axisSeismicAxial = {}; // Cumulative Sigma N by Axis at base (1F)
            p.axisSeismicAxial2F = {}; // Cumulative Sigma N by Axis at 2F level
        });

        const h1 = s.config.floorHeight1F || 2.7;
        const h2 = s.config.floorHeight2F || 2.7;

        // 2. Process each pillar
        s.pillars.filter(p => !p.isDeleted).forEach(p => {
            const floors = ['2F', '1F'];
            const cumulativeAccum = {};

            floors.forEach(f => {
                // Get floor height (considering manual override)
                const pForH = s.pillars.find(p_h => p_h.floor === f && Math.hypot(p_h.x - p.x, p_h.y - p.y) < 5);
                const h = (pForH && pForH.manualH) ? pForH.manualH : (f === '2F' ? h2 : h1);

                // Find connected walls on this floor
                const connectedWalls = s.walls.filter(w => {
                    if (w.floor !== f) return false;
                    return (Math.hypot(w.p1.x - p.x, w.p1.y - p.y) < 5 || Math.hypot(w.p2.x - p.x, w.p2.y - p.y) < 5);
                });

                connectedWalls.forEach(w => {
                    const alpha = window.WallEngine.getTotalMultiplier(w);
                    if (alpha <= 0) return;
                    
                    const N_kN = alpha * 1.96 * h; 
                    
                    // [v2.5.0] Determine axis name for this wall FIRST
                    let wallAxis = window.GridEngine ? window.GridEngine.getLineAxisName(w.p1, w.p2, s) : '';
                    if (!wallAxis) {
                        const dx = w.p2.x - w.p1.x;
                        const dy = w.p2.y - w.p1.y;
                        wallAxis = Math.abs(dx) > Math.abs(dy) ? 'X' : 'Y';
                    }

                    // [v2.5.0] Use MathUtils to get the correct 1D projection and left/right orientation
                    let isLeftEnd = false;
                    if (window.MathUtils && window.MathUtils.getWallProjectionInfo) {
                        const info = window.MathUtils.getWallProjectionInfo(w, p, wallAxis, s);
                        isLeftEnd = info.isLeftEnd;
                    } else {
                        // Fallback
                        const dx = w.p2.x - w.p1.x;
                        const dy = w.p2.y - w.p1.y;
                        const isXAxis = Math.abs(dx) > Math.abs(dy);
                        const currentCoord = isXAxis ? p.x : p.y;
                        const p1Coord = isXAxis ? w.p1.x : w.p1.y;
                        const p2Coord = isXAxis ? w.p2.x : w.p2.y;
                        isLeftEnd = (Math.abs(currentCoord - Math.min(p1Coord, p2Coord)) < 5);
                    }

                    const sign = isLeftEnd ? 1 : -1; // Tension (+) for left end, compression (-) for right end under leftward load

                    const force_N = N_kN * sign * 1000;

                    cumulativeAccum[wallAxis] = (cumulativeAccum[wallAxis] || 0) + force_N;
                });

                if (f === '2F') {
                    p.axisSeismicAxial2F = { ...cumulativeAccum };
                }
                if (f === '1F') {
                    p.axisSeismicAxial = { ...cumulativeAccum };
                }
            });

            // Backwards compatibility: sum up all active axes
            let totalCumulative = 0;
            Object.values(p.axisSeismicAxial).forEach(val => { totalCumulative += val; });
            p.seismicAxial = totalCumulative;

            let totalCumulative2F = 0;
            Object.values(p.axisSeismicAxial2F).forEach(val => { totalCumulative2F += val; });
            p.seismicAxial2F = totalCumulative2F;
        });

        console.log("📊 [AxialEngine] Axis-specific seismic axial forces (Sigma N) calculated and saved.");
    },

    /**
     * Calculate long-term (static) axial forces for ground pressure.
     * Uses tributary areas from AreaEngine and average building weight.
     */
    calculateLongTermAxialForces: function(state) {
        const s = state || window.AppState;
        
        const wRoof = ( (s.roofWeight || 500) + (s.solarWeight || 0) + (s.ceilingInsWeight || 100) ) / 1000;
        const wWallSpec = ( (s.exteriorWallWeight || 600) + (s.wallInsWeight || 70) ) / 1000;
        const wFloorSkeleton = 2.4; // 床組・骨組の標準自重 [kN/m2]

        const a1 = window.AreaEngine ? window.AreaEngine.getFloorArea('1F', s) : 0;
        const a2 = window.AreaEngine ? window.AreaEngine.getFloorArea('2F', s) : 0;

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

        let ratio1F = (len1F > 0 && a1 > 0) ? (len1F * h1) / a1 : 1.0;
        let ratio2F = (len2F > 0 && a2 > 0) ? (len2F * h2) / a2 : 1.0;

        ratio1F = Math.min(2.5, Math.max(0.2, ratio1F));
        ratio2F = Math.min(2.5, Math.max(0.2, ratio2F));

        const wFloor1F = (wWallSpec * ratio1F) + wFloorSkeleton;
        const wFloor2F = wRoof + (wWallSpec * ratio2F) + wFloorSkeleton;
        
        s.pillars.filter(p => !p.isDeleted).forEach(p => {
            const p2F = s.pillars.find(p2 => p2.floor === '2F' && Math.hypot(p2.x - p.x, p2.y - p.y) < 10);
            
            let n_total = (p.loadArea || 0) * (p.floor === '2F' ? wFloor2F : wFloor1F);
            if (p.floor === '1F' && p2F) {
                n_total += (p2F.loadArea || 0) * wFloor2F;
            }
            
            p.longTermAxial_kN = n_total;
        });
        
        console.log(`📊 [AxialEngine] Long-term axial forces calculated using real wall length. 1F ratio=${ratio1F.toFixed(2)}, 2F ratio=${ratio2F.toFixed(2)}.`);
    }
};
