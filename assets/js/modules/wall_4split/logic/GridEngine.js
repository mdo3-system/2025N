/**
 * logic/GridEngine.js - 通り芯解析エンジン
 * v2.3.25 Refactoring
 */

window.GridEngine = {
    /**
     * キャンバス上の線分、柱、手動設定から通り芯を解析・統合します
     * @param {Object} state - アプリケーション状態
     */
    analyzeGrids: function(state) {
        let validPillars = state.pillars.filter(p => !p.isDeleted);
        
        let gridLineXs = [], gridLineYs = [];
        const TOL_SNAP = 5; // 近接グリッドのマージ制限
        const TEXT_GRID_TOL_WIDE = 300; // 文字検索の許容誤差

        // 座標を標準モジュール(455mm)に「近い場合のみ」吸着させる補助関数
        const snapToModule = (val) => {
            const module = 455;
            const nearest = Math.round(val / module) * module;
            // 5mm以内の誤差であれば標準モジュールに吸着
            if (Math.abs(val - nearest) < 5) return nearest;
            // それ以外は1mm単位の丸めのみ（斜め壁等の位置維持）
            return Math.round(val);
        };

        // 1. 背景図面(DXF)のグリッド線から座標を抽出
        state.bgLinesOriginal.forEach(e => {
            if (e.isGridLine && e.type === 'LINE' && e.vertices && e.vertices.length === 2) {
                let p1 = e.vertices[0], p2 = e.vertices[1];
                let dx = Math.abs(p1.x - p2.x), dy = Math.abs(p1.y - p2.y);
                if (Math.max(dx, dy) > 100) {
                    if (dx < TOL_SNAP) gridLineXs.push(snapToModule((p1.x + p2.x) / 2));
                    if (dy < TOL_SNAP) gridLineYs.push(snapToModule((p1.y + p2.y) / 2));
                }
            }
        });

        // 2. 柱の座標を標準モジュールに揃える & グリッド線にスナップ
        validPillars.forEach(p => {
            p.x = snapToModule(p.x);
            p.y = snapToModule(p.y);
            
            let gx = gridLineXs.find(x => Math.abs(x - p.x) < TOL_SNAP);
            if (gx !== undefined) p.x = gx;
            let gy = gridLineYs.find(y => Math.abs(y - p.y) < TOL_SNAP);
            if (gy !== undefined) p.y = gy;
        });

        // 3. 通り芯の座標マスターリストを作成
        let masterXs = [], masterYs = [];

        // グリッド線から
        gridLineXs.forEach(x => { 
            let sx = snapToModule(x);
            if (!masterXs.some(mx => Math.abs(mx - sx) < TOL_SNAP)) masterXs.push(sx); 
        });
        gridLineYs.forEach(y => { 
            let sy = snapToModule(y);
            if (!masterYs.some(my => Math.abs(my - sy) < TOL_SNAP)) masterYs.push(sy); 
        });

        // 柱から
        validPillars.forEach(p => {
            if (!masterXs.some(x => Math.abs(x - p.x) < TOL_SNAP)) masterXs.push(p.x);
            if (!masterYs.some(y => Math.abs(y - p.y) < TOL_SNAP)) masterYs.push(p.y);
        });

        // 手動追加グリッドから
        state.manualGridX.forEach(m => { 
            let sx = snapToModule(m.coord);
            if (!masterXs.some(x => Math.abs(x - sx) < TOL_SNAP)) masterXs.push(sx); 
        });
        state.manualGridY.forEach(m => { 
            let sy = snapToModule(m.coord);
            if (!masterYs.some(y => Math.abs(y - sy) < TOL_SNAP)) masterYs.push(sy); 
        });

        // 基礎梁の端点を追加（基礎モードでの通り芯消失を防止）
        (state.foundationBeams || []).forEach(b => {
            let s1x = snapToModule(b.p1.x), s1y = snapToModule(b.p1.y);
            let s2x = snapToModule(b.p2.x), s2y = snapToModule(b.p2.y);
            if (!masterXs.some(x => Math.abs(x - s1x) < TOL_SNAP)) masterXs.push(s1x);
            if (!masterYs.some(y => Math.abs(y - s1y) < TOL_SNAP)) masterYs.push(s1y);
            if (!masterXs.some(x => Math.abs(x - s2x) < TOL_SNAP)) masterXs.push(s2x);
            if (!masterYs.some(y => Math.abs(y - s2y) < TOL_SNAP)) masterYs.push(s2y);
        });

        masterXs.sort((a, b) => a - b); masterYs.sort((a, b) => a - b);
        
        // ブラックリスト（削除済みグリッド）を除外
        const manualXCoords = state.manualGridX.map(m => snapToModule(m.coord));
        masterXs = masterXs.filter(mx => {
            if (manualXCoords.includes(mx)) return true;
            return !state.deletedGridX.some(dx => Math.abs(dx - mx) < TOL_SNAP);
        });

        const manualYCoords = state.manualGridY.map(m => snapToModule(m.coord));
        masterYs = masterYs.filter(my => {
            if (manualYCoords.includes(my)) return true;
            return !state.deletedGridY.some(dy => Math.abs(dy - my) < TOL_SNAP);
        });

        state.masterXs = masterXs; 
        state.masterYs = masterYs;

        // 4. 柱の座標を統合したマスター座標で揃える
        validPillars.forEach(p => {
            let mx = masterXs.find(x => Math.abs(x - p.x) < TOL_SNAP);
            if (mx !== undefined) p.x = mx;
            let my = masterYs.find(y => Math.abs(y - p.y) < TOL_SNAP);
            if (my !== undefined) p.y = my;
        });

        // 5. 階ごとに名称マッピング
        ['1F', '2F'].forEach(targetFloor => {
            let cfPillars = validPillars.filter(p => p.floor === targetFloor);
            let availableGridTexts = state.bgTextsOriginal.filter(t => t.isGridText);

            let nameMapX = {}, nameMapY = {};
            state.manualGridX.forEach(m => { nameMapX[snapToModule(m.coord)] = m.name; });
            state.manualGridY.forEach(m => { nameMapY[snapToModule(m.coord)] = m.name; });

            // X軸マッピング
            masterXs.forEach(x => {
                if (nameMapX[x]) return;
                let possibleTexts = availableGridTexts.filter(t => Math.abs(t.x - x) < TEXT_GRID_TOL_WIDE);
                if (possibleTexts.length > 0) {
                    possibleTexts.sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));
                    nameMapX[x] = possibleTexts[0].text.trim().normalize("NFKC").toUpperCase();
                    availableGridTexts = availableGridTexts.filter(at => at !== possibleTexts[0]);
                }
            });

            // Y軸マッピング
            masterYs.forEach(y => {
                if (nameMapY[y]) return;
                let possibleTexts = availableGridTexts.filter(t => Math.abs(t.y - y) < TEXT_GRID_TOL_WIDE);
                if (possibleTexts.length > 0) {
                    possibleTexts.sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y));
                    nameMapY[y] = possibleTexts[0].text.trim().normalize("NFKC").toUpperCase();
                    availableGridTexts = availableGridTexts.filter(at => at !== possibleTexts[0]);
                }
            });

            // 最終名称の確定 (ユーザー編集優先 > 抽出テキスト > 自動連番)
            let nx = masterXs.map((x, i) => (state.userEditedGridX && state.userEditedGridX[x]) || nameMapX[x] || `X${i + 1}`);
            let ny = masterYs.map((y, i) => (state.userEditedGridY && state.userEditedGridY[y]) || nameMapY[y] || `Y${i + 1}`);

            // 柱への名称割り当て
            cfPillars.forEach(p => {
                let xi = masterXs.indexOf(p.x);
                let yi = masterYs.indexOf(p.y);
                if (xi >= 0 && yi >= 0) {
                    p.gx = nx[xi]; p.gy = ny[yi]; p.gName = `${p.gx}${p.gy}`;
                    p.isInvalidPos = false;
                } else {
                    p.gx = '?'; p.gy = '?'; p.gName = '位置不明';
                    p.isInvalidPos = true;
                }
            });

            // 全階層共通のマスター設定として同期 (階のループ内だが最後に設定したものが勝つ = 全階層包含)
            state.gridXCoords = masterXs; state.gridXNames = nx;
            state.gridYCoords = masterYs; state.gridYNames = ny;
        });
    },

    /**
     * 柱の現在の座標から通り芯名を取得します
     */
    getPillarName: function(p, state) {
        if (!p) return '位置不明';
        const TOL = 250;
        
        let bestXIndex = -1;
        let minXDist = Infinity;
        const gXC = state.gridXCoords || [];
        const gXN = state.gridXNames || [];
        for (let i = 0; i < gXC.length; i++) {
            const dist = Math.abs(Number(gXC[i]) - Number(p.x));
            if (dist < minXDist) {
                minXDist = dist;
                bestXIndex = i;
            }
        }
        let gx = (bestXIndex !== -1 && minXDist < TOL) ? gXN[bestXIndex] : (p.gx || '?');

        let bestYIndex = -1;
        let minYDist = Infinity;
        const gYC = state.gridYCoords || [];
        const gYN = state.gridYNames || [];
        for (let i = 0; i < gYC.length; i++) {
            const dist = Math.abs(Number(gYC[i]) - Number(p.y));
            if (dist < minYDist) {
                minYDist = dist;
                bestYIndex = i;
            }
        }
        let gy = (bestYIndex !== -1 && minYDist < TOL) ? gYN[bestYIndex] : (p.gy || '?');
        
        if (state.userEditedGridX && state.userEditedGridX[p.x]) gx = state.userEditedGridX[p.x];
        if (state.userEditedGridY && state.userEditedGridY[p.y]) gy = state.userEditedGridY[p.y];
        
        if (gx === '?' && gy === '?') return `(${Math.round(p.x)}, ${Math.round(p.y)})`;
        if (gx === '?') return `${gy}通り上`;
        if (gy === '?') return `${gx}通り上`;
        return `${gx}${gy}`;
    },

    /**
     * 4分割図の境界範囲を計算します
     */
    get4DivisionBounds: function(floor, state) {
        const s = state || window.AppState;
        let xs = [], ys = [];
        const floorPolys = s.areaLines.filter(a => a.floor === floor && a.areaType !== 'attic' && a.areaType !== 'balcony');
        
        if (floorPolys.length > 0) {
            floorPolys.forEach(a => a.vertices.forEach(v => { xs.push(v.x); ys.push(v.y); }));
        } else {
            s.pillars.filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === floor || p.floor === 'ALL')).forEach(p => { xs.push(p.x); ys.push(p.y); });
        }
        
        if (xs.length === 0 || ys.length === 0) return null;
        
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const W = maxX - minX, H = maxY - minY;
        if (W <= 0 || H <= 0) return null;

        const suffix = floor === '1F' ? '1' : '2';
        const c = s.config;
        const zones = (c.div4Zones && c.div4Zones[floor]) ? c.div4Zones[floor] : { xt: null, xb: null, yl: null, yr: null };
        const zxt = zones.xt || (H / 4);
        const zxb = zones.xb || (H / 4);
        const zyl = zones.yl || (W / 4);
        const zyr = zones.yr || (W / 4);
        
        return { 
            minX, maxX, minY, maxY, W, H, 
            xLineL: minX + zyl, 
            xLineR: maxX - zyr, 
            yLineT: maxY - zxt, 
            yLineB: minY + zxb 
        };
    },

    /**
     * 梁または壁（線分）が属する通り芯名を統一的に取得します
     */
    getLineAxisName: function(p1, p2, state) {
        const s = state || window.AppState;
        const n1 = this.getPillarName(p1, s);
        const n2 = this.getPillarName(p2, s);

        // 0. [v2.5.0] 斜め通り芯の判定 (幾何学的一致を優先)
        if (s.manualGridAngle && s.manualGridAngle.length > 0) {
            for (const g of s.manualGridAngle) {
                if (!g.p1 || !g.p2) continue;
                // 直線の方程式 Ax + By + C = 0
                const A = g.p2.y - g.p1.y;
                const B = g.p1.x - g.p2.x;
                const C = g.p1.y * g.p2.x - g.p1.x * g.p2.y;
                const den = Math.hypot(A, B);
                if (den < 1) continue;

                // 線分の両端点から直線への距離を算出
                const d1 = Math.abs(A * p1.x + B * p1.y + C) / den;
                const d2 = Math.abs(A * p2.x + B * p2.y + C) / den;

                // [v2.5.21 堅牢化] 許容誤差を100mmから、極めて安全な「15mm」に縮小。
                // これにより1mm程度のグリッド座標ズレは完璧に許容しつつ、近接する隣の通り芯を誤認するリスクをゼロにします。
                if (d1 < 15 && d2 < 15) {
                    return g.name || 'DA';
                }
            }
        }
        
        const dx = Math.abs(p2.x - p1.x);
        const dy = Math.abs(p2.y - p1.y);
        const isHorizontal = dx >= dy;

        // 1. 両端の柱名の共通項から通りを特定 (X1Y1, X5Y1 -> Y1)
        if (n1 && n2) {
            const xNames = s.gridXNames || [];
            const yNames = s.gridYNames || [];
            const allNames = [...xNames, ...yNames];
            const common = allNames.filter(name => name && n1.includes(name) && n2.includes(name));
            if (common.length > 0) {
                // [v2.4.77] 長さが長いものを優先（例：X5よりもX5aを優先する）
                return common.sort((a, b) => b.length - a.length)[0];
            }
            
            // 正規表現による抽出試行 ([v2.4.77] 末尾のアルファベット枝番に対応)
            const axisRegex = /[A-Z]+\d+[a-zA-Z]*/gi;
            const m1 = n1.match(axisRegex);
            const m2 = n2.match(axisRegex);
            if (m1 && m2) {
                const commonFallback = m1.filter(pt => m2.includes(pt));
                if (commonFallback.length > 0) return commonFallback.sort((a, b) => b.length - a.length)[0];
            }
        }

        // 2. 共通項がない場合、中点から最も近いグリッド座標を探す
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        let best = '', minD = Infinity;
        if (isHorizontal) {
            (s.gridYCoords || []).forEach((gy, i) => { 
                const d = Math.abs(gy - mid.y);
                if (d < minD) { minD = d; best = s.gridYNames[i]; } 
            });
        } else {
            (s.gridXCoords || []).forEach((gx, i) => { 
                const d = Math.abs(gx - mid.x);
                if (d < minD) { minD = d; best = s.gridXNames[i]; } 
            });
        }
        return (minD < 250) ? best : '';
    }
};

window.getGridNameAt = function(x, y) {
    const state = window.AppState;
    if (!state) return `(${Math.round(x)}, ${Math.round(y)})`;
    return window.GridEngine.getPillarName({ x, y }, state);
};
