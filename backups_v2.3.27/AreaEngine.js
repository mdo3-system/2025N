/**
 * logic/AreaEngine.js - Area Calculation Engine
 * v2.3.25 Refactoring
 */

window.AreaEngine = {
    /**
     * Calculate floor area from area polygons (or return null if none)
     */
    getFloorArea: function(floor, state) {
        const s = state || window.AppState;
        const areaLines = s.areaLines || [];
        const fAreas = areaLines.filter(a => a.floor === floor && (!a.areaType || a.areaType === 'floor'));
        if (fAreas.length === 0) return null;
        
        let totalArea = 0;
        fAreas.forEach(area => {
            if (area.vertices && area.vertices.length >= 3) {
                totalArea += window.MathUtils.polygonArea(area.vertices) / 1000000;
            }
        });
        return totalArea;
    },

    /**
     * Get building boundary polygons for a floor
     */
    getBuildingPolygons: function(floor, pillarsOfFloor, state) {
        const s = state || window.AppState;
        const areaLines = s.areaLines || [];
        
        // Use 'floor' type area lines if they exist
        let floorAreas = areaLines.filter(a => a.floor === floor && a.vertices && a.vertices.length >= 3 && (!a.areaType || a.areaType === 'floor'));
        if (floorAreas.length > 0) {
            return floorAreas.map(a => {
                let poly = a.vertices.map(v => ({ x: v.x, y: v.y }));
                window.MathUtils.ensureCCW(poly);
                return poly;
            });
        }

        // Fallback: Use bounding box of pillars
        if (!pillarsOfFloor || pillarsOfFloor.length === 0) return [];
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        pillarsOfFloor.forEach(p => {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        });
        
        if (minX === Infinity) return [];
        const OFFSET = 455;
        let poly = [
            { x: minX - OFFSET, y: minY - OFFSET },
            { x: maxX + OFFSET, y: minY - OFFSET },
            { x: maxX + OFFSET, y: maxY + OFFSET },
            { x: minX - OFFSET, y: maxY + OFFSET }
        ];
        window.MathUtils.ensureCCW(poly);
        return [poly];
    },

    /**
     * Get aggregate area by type (e.g., 'balcony', 'attic')
     */
    getAreaByType: function(floor, type, state) {
        const s = state || window.AppState;
        const areaLines = s.areaLines || [];
        const fAreas = areaLines.filter(a => a.floor === floor && (a.areaType === type || (type === 'floor' && !a.areaType)));
        if (fAreas.length === 0) return 0;
        
        let total = 0;
        fAreas.forEach(area => {
            let poly = [...area.vertices];
            if (poly.length < 3) return;
            total += window.MathUtils.polygonArea(poly) / 1000000;
        });
        return total;
    },

    /**
     * 必要壁量用の面積計算
     */
    calculateRequiredWallAreas: function(state) {
        const s = state || window.AppState;
        const c = s.config;
        const atticRatio = (c.atticHeight || 1.4) / 2.1;
        const isSeinou = (c.calcMode === 'seinou');

        const getAreaVal = (f, type) => this.getAreaByType(f, type, s);

        const af1 = getAreaVal('1F', 'floor'), aa1 = getAreaVal('1F', 'attic'), ab1 = getAreaVal('1F', 'balcony'), ap1 = getAreaVal('1F', 'porch');
        const af2 = getAreaVal('2F', 'floor'), aa2 = getAreaVal('2F', 'attic'), ab2 = getAreaVal('2F', 'balcony'), av2 = getAreaVal('2F', 'void');

        let a1_seismic = af1 + (aa1 * atticRatio) + (aa2 * atticRatio);
        if (isSeinou) a1_seismic += ap1 + (ab1 * 0.4);

        let a2_seismic = af2 + (aa2 * atticRatio);
        if (isSeinou) a2_seismic += av2;

        return {
            '1F': { seismic: a1_seismic, floor: af1, attic: aa1, balcony: ab1, porch: ap1 },
            '2F': { seismic: a2_seismic, floor: af2, attic: aa2, balcony: ab2, void: av2 }
        };
    },

    /**
     * 柱ごとの負担面積計算
     */
    calculatePillarLoadAreas: function(state) {
        const s = state || window.AppState;
        const M = window.MathUtils;
        const INF = 100000;
        const atticRatio = (s.config.atticHeight || 1.4) / 2.1;
        const isSeinou = (s.config.calcMode === 'seinou');

        ['1F', '2F'].forEach(f => {
            let ap = s.pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === f);
            let bPolys = this.getBuildingPolygons(f, ap, s);
            if (bPolys.length === 0) return;

            let extras = [{ type: 'attic', ratio: atticRatio }];
            if (f === '1F' && isSeinou) { 
                extras.push({ type: 'porch', ratio: 1.0 }, { type: 'balcony', ratio: 0.4 }); 
            } else if (f === '2F' && isSeinou) { 
                extras.push({ type: 'void', ratio: 1.0 }); 
            }

            const exPolys = extras.map(et => ({ 
                ...et, 
                polys: s.areaLines.filter(a => a.floor === f && a.areaType === et.type && a.vertices?.length >= 3).map(a => { 
                    let p = a.vertices.map(v => ({ x: v.x, y: v.y })); 
                    M.ensureCCW(p); 
                    return p; 
                }) 
            }));

            ap.forEach(p => {
                let cell = [{ x: p.x - INF, y: p.y - INF }, { x: p.x + INF, y: p.y - INF }, { x: p.x + INF, y: p.y + INF }, { x: p.x - INF, y: p.y + INF }];
                M.ensureCCW(cell);
                ap.forEach(op => { 
                    if (op.id !== p.id && Math.hypot(op.x - p.x, op.y - p.y) >= 1) {
                        cell = M.clipPolygonByHalfPlane(cell, p, op); 
                    }
                });

                let floorA = 0;
                let tPolys = [];
                bPolys.forEach(bp => {
                    const intersected = M.clipPolygonByPolygon(cell, bp);
                    if (intersected.length >= 3) {
                        floorA += M.polygonArea(intersected) / 1000000;
                        tPolys.push(intersected);
                    }
                });

                let extraA = 0;
                exPolys.forEach(et => {
                    et.polys.forEach(ep => {
                        const intersected = M.clipPolygonByPolygon(cell, ep);
                        if (intersected.length >= 3) {
                            extraA += (M.polygonArea(intersected) / 1000000) * et.ratio;
                            tPolys.push(intersected);
                        }
                    });
                });

                p.tributaryPolygon = tPolys; // 旧レンダラー互換（複数ポリゴンの配列）
                p.loadArea = floorA + extraA;
                p.pureFloorArea = floorA;
                p.autoArea = p.loadArea; // 旧ロジック互換
            });
        });
    }
};
