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
        if (fAreas.length === 0) return null; // [v2.5.18] Return null to align with getFloorArea and distinguish no-polygon state
        
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
     * 基準法モード: 床・小屋裏のみ集計（バルコニー・ポーチ・吹き抜けは完全除外）
     * 性能表示モード: 1F柱に見上げ要素（ポーチ, バルコニー 0.4倍, 2F吹抜, 2F小屋裏）を含めて集計
     */
    calculatePillarLoadAreas: function(state, overrideMode = null) {
        const s = state || window.AppState;
        const M = window.MathUtils;
        const INF = 100000;
        const atticRatio = (s.config.atticHeight || 1.4) / 2.1;
        
        // モード決定: 手動指定(overrideMode)がなければ全体設定(calcMode)に従う
        const mode = (overrideMode && overrideMode !== 'auto') ? overrideMode : s.config.calcMode;
        const isSeinou = (mode === 'seinou');
        const areaLines = s.areaLines || [];

        const isFloorMatched = (f1, f2) => window.isFloorMatched ? window.isFloorMatched(f1, f2) : (String(f1).toUpperCase().trim() === String(f2).toUpperCase().trim());

        ['1F', '2F'].forEach(f => {
            const ap = s.pillars.filter(p => !p.isDeleted && !p.isInvalidPos && isFloorMatched(p.floor, f));
            if (ap.length === 0) return;

            // 各階に応じた負担ポリゴンリスト { poly, ratio, type }
            const targetPolys = [];

            const addAreaPolys = (targetFloor, targetType, ratio) => {
                areaLines.filter(a => {
                    if (!isFloorMatched(a.floor, targetFloor) || !a.vertices || a.vertices.length < 3) return false;
                    const aType = a.areaType || 'floor';
                    return aType === targetType;
                }).forEach(a => {
                    let p = a.vertices.map(v => ({ x: v.x, y: v.y }));
                    M.ensureCCW(p);
                    targetPolys.push({ poly: p, ratio: ratio, type: targetType });
                });
            };

            if (!isSeinou) {
                // 【基準法モード（見下げ）】: バルコニー、ポーチ、吹き抜けは一切除外
                if (f === '1F') {
                    addAreaPolys('1F', 'floor', 1.0);
                    addAreaPolys('1F', 'attic', atticRatio);
                    addAreaPolys('2F', 'attic', atticRatio);
                } else { // 2F
                    addAreaPolys('2F', 'floor', 1.0);
                    addAreaPolys('2F', 'attic', atticRatio);
                }
            } else {
                // 【性能表示モード（見上げ）】: ポーチ, バルコニー(0.4倍), 吹き抜けを含める
                if (f === '1F') {
                    addAreaPolys('1F', 'floor', 1.0);
                    addAreaPolys('1F', 'attic', atticRatio);
                    addAreaPolys('2F', 'attic', atticRatio);
                    addAreaPolys('2F', 'void', 1.0);
                    addAreaPolys('1F', 'porch', 1.0);
                    addAreaPolys('1F', 'balcony', 0.4);
                } else { // 2F
                    addAreaPolys('2F', 'floor', 1.0);
                    addAreaPolys('2F', 'attic', atticRatio);
                    addAreaPolys('2F', 'void', 1.0);
                }
            }

            // もしポリゴンが登録されていない場合のフォールバック（柱の外郭バウンディングボックス）
            if (targetPolys.length === 0) {
                const fallbackPolys = this.getBuildingPolygons(f, ap, s);
                fallbackPolys.forEach(poly => {
                    targetPolys.push({ poly: poly, ratio: 1.0, type: 'floor' });
                });
            }

            ap.forEach(p => {
                let cell = [
                    { x: p.x - INF, y: p.y - INF },
                    { x: p.x + INF, y: p.y - INF },
                    { x: p.x + INF, y: p.y + INF },
                    { x: p.x - INF, y: p.y + INF }
                ];
                M.ensureCCW(cell);
                ap.forEach(op => { 
                    if (op.id !== p.id && Math.hypot(op.x - p.x, op.y - p.y) >= 1) {
                        cell = M.clipPolygonByHalfPlane(cell, p, op); 
                    }
                });

                let totalAreaVal = 0;
                let tributaryPolygons = [];
                
                targetPolys.forEach(tp => {
                    // 凹ポリゴン（L字型等）でも正確にクリッピングできるよう三角形分割（Triangulation）して交差計算
                    const triangles = (tp.poly.length === 3) ? [tp.poly] : (M.triangulate ? M.triangulate(tp.poly) : [tp.poly]);
                    triangles.forEach(tri => {
                        const triCCW = tri.map(v => ({ x: v.x, y: v.y }));
                        M.ensureCCW(triCCW);
                        const intersected = M.clipPolygonByPolygon(cell, triCCW);
                        if (intersected && intersected.length >= 3) {
                            totalAreaVal += M.polygonArea(intersected) * tp.ratio;
                            tributaryPolygons.push(intersected);
                        }
                    });
                });

                p.tributaryPolygon = tributaryPolygons; 
                p.loadArea = Math.round(totalAreaVal / 10000) / 100;
                p.autoArea = p.loadArea; 
            });
        });
    },

    calculate4DivisionAreas: function(floor, state) {
        const s = state || window.AppState;
        const M = window.MathUtils;
        if (!window.GridEngine || !window.GridEngine.get4DivisionBounds) return null;
        const b = window.GridEngine.get4DivisionBounds(floor, s);
        if (!b) return null;

        const isSeinou = s.config.calcMode === 'seinou';
        const atticH = s.config.atticHeight || 1.4;
        const atticRatio = atticH / 2.1;

        // すべてのポリゴンから、見下げ・見上げのロジックに基づいて該当階の構成要素を抽出
        const allPolys = [];

        if (!isSeinou) {
            // 【基準法（見下げ面積）のロジック】
            if (floor === '1F') {
                // 1F 床
                s.areaLines.filter(a => a.floor === '1F' && (!a.areaType || a.areaType === 'floor')).forEach(a => allPolys.push({ a, factor: 1.0 }));
                // 1F 小屋裏
                s.areaLines.filter(a => a.floor === '1F' && a.areaType === 'attic').forEach(a => allPolys.push({ a, factor: atticRatio }));
                // 2F 小屋裏（1F荷重分として見下げ計算に加算）
                s.areaLines.filter(a => a.floor === '2F' && a.areaType === 'attic').forEach(a => allPolys.push({ a, factor: atticRatio }));
            } else { // 2F
                // 2F 床
                s.areaLines.filter(a => a.floor === '2F' && (!a.areaType || a.areaType === 'floor')).forEach(a => allPolys.push({ a, factor: 1.0 }));
                // 2F 小屋裏
                s.areaLines.filter(a => a.floor === '2F' && a.areaType === 'attic').forEach(a => allPolys.push({ a, factor: atticRatio }));
            }
            // ※ 基準法モードでは、吹き抜け(void), バルコニー(balcony), ポーチ(porch)は一切拾いません。
        } else {
            // 【性能表示（見上げ面積）のロジック】
            if (floor === '1F') {
                // 1F 床
                s.areaLines.filter(a => a.floor === '1F' && (!a.areaType || a.areaType === 'floor')).forEach(a => allPolys.push({ a, factor: 1.0 }));
                // 1F 小屋裏
                s.areaLines.filter(a => a.floor === '1F' && a.areaType === 'attic').forEach(a => allPolys.push({ a, factor: atticRatio }));
                // 2F 小屋裏（1F荷重分）
                s.areaLines.filter(a => a.floor === '2F' && a.areaType === 'attic').forEach(a => allPolys.push({ a, factor: atticRatio }));
                // 2F 吹き抜け
                s.areaLines.filter(a => a.floor === '2F' && a.areaType === 'void').forEach(a => allPolys.push({ a, factor: 1.0 }));
                // 1F ポーチ
                s.areaLines.filter(a => a.floor === '1F' && a.areaType === 'porch').forEach(a => allPolys.push({ a, factor: 1.0 }));
                // 1F バルコニー
                s.areaLines.filter(a => a.floor === '1F' && a.areaType === 'balcony').forEach(a => allPolys.push({ a, factor: 0.4 }));
            } else { // 2F
                // 2F 床
                s.areaLines.filter(a => a.floor === '2F' && (!a.areaType || a.areaType === 'floor')).forEach(a => allPolys.push({ a, factor: 1.0 }));
                // 2F 小屋裏
                s.areaLines.filter(a => a.floor === '2F' && a.areaType === 'attic').forEach(a => allPolys.push({ a, factor: atticRatio }));
                // 2F 吹き抜け
                s.areaLines.filter(a => a.floor === '2F' && a.areaType === 'void').forEach(a => allPolys.push({ a, factor: 1.0 }));
                // 1F ポーチ
                s.areaLines.filter(a => a.floor === '1F' && a.areaType === 'porch').forEach(a => allPolys.push({ a, factor: 1.0 }));
                // 1F バルコニー
                s.areaLines.filter(a => a.floor === '1F' && a.areaType === 'balcony').forEach(a => allPolys.push({ a, factor: 0.4 }));
            }
        }

        const res = { xt: 0, xb: 0, yl: 0, yr: 0 };
        
        allPolys.forEach(item => {
            const area = item.a;
            const factor = item.factor;
            if (!area.vertices || area.vertices.length < 3) return;

            const poly = area.vertices.map(v => ({ x: v.x, y: v.y }));
            M.ensureCCW(poly);

            // X-Top (上/奥) - yLineT to maxY
            res.xt += (M.polygonArea(M.clipPolygonByRect(poly, -1e8, 1e8, b.yLineT, 1e8)) / 1000000) * factor;
            // X-Bottom (下/前) - minY to yLineB
            res.xb += (M.polygonArea(M.clipPolygonByRect(poly, -1e8, 1e8, -1e8, b.yLineB)) / 1000000) * factor;
            // Y-Left (左) - minX to xLineL
            res.yl += (M.polygonArea(M.clipPolygonByRect(poly, -1e8, b.xLineL, -1e8, 1e8)) / 1000000) * factor;
            // Y-Right (右) - xLineR to maxX
            res.yr += (M.polygonArea(M.clipPolygonByRect(poly, b.xLineR, 1e8, -1e8, 1e8)) / 1000000) * factor;
        });

        return res;
    }
};
