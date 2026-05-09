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
        const TOL_SNAP = 2; // 近接グリッドのマージ制限
        const TEXT_GRID_TOL_WIDE = 300; // 文字検索の許容誤差

        // 1. 背景図面(DXF)のグリッド線から座標を抽出
        state.bgLinesOriginal.forEach(e => {
            if (e.isGridLine && e.type === 'LINE' && e.vertices && e.vertices.length === 2) {
                let p1 = e.vertices[0], p2 = e.vertices[1];
                let dx = Math.abs(p1.x - p2.x), dy = Math.abs(p1.y - p2.y);
                if (Math.max(dx, dy) > 100) {
                    if (dx < TOL_SNAP) gridLineXs.push((p1.x + p2.x) / 2);
                    if (dy < TOL_SNAP) gridLineYs.push((p1.y + p2.y) / 2);
                }
            }
        });

        // 2. 柱をグリッド線にスナップ
        validPillars.forEach(p => {
            let gx = gridLineXs.find(x => Math.abs(x - p.x) < TOL_SNAP);
            if (gx !== undefined) p.x = gx;
            let gy = gridLineYs.find(y => Math.abs(y - p.y) < TOL_SNAP);
            if (gy !== undefined) p.y = gy;
        });

        // 3. 通り芯の座標マスターリストを作成
        let masterXs = [], masterYs = [];

        // グリッド線から
        gridLineXs.forEach(x => { if (!masterXs.some(mx => Math.abs(mx - x) < TOL_SNAP)) masterXs.push(x); });
        gridLineYs.forEach(y => { if (!masterYs.some(my => Math.abs(my - y) < TOL_SNAP)) masterYs.push(y); });

        // 柱から
        validPillars.forEach(p => {
            if (!masterXs.some(x => Math.abs(x - p.x) < TOL_SNAP)) masterXs.push(p.x);
            if (!masterYs.some(y => Math.abs(y - p.y) < TOL_SNAP)) masterYs.push(p.y);
        });

        // 手動追加グリッドから
        state.manualGridX.forEach(m => { if (!masterXs.some(x => Math.abs(x - m.coord) < TOL_SNAP)) masterXs.push(m.coord); });
        state.manualGridY.forEach(m => { if (!masterYs.some(y => Math.abs(y - m.coord) < TOL_SNAP)) masterYs.push(m.coord); });

        masterXs.sort((a, b) => a - b); masterYs.sort((a, b) => a - b);
        
        // ブラックリスト（削除済みグリッド）を除外
        masterXs = masterXs.filter(mx => !state.deletedGridX.some(dx => Math.abs(dx - mx) < TOL_SNAP));
        masterYs = masterYs.filter(my => !state.deletedGridY.some(dy => Math.abs(dy - my) < TOL_SNAP));

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
            state.manualGridX.forEach(m => { nameMapX[m.coord] = m.name; });
            state.manualGridY.forEach(m => { nameMapY[m.coord] = m.name; });

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

            // 現在表示中の階の設定を同期
            if (targetFloor === state.currentFloor) {
                state.gridXCoords = masterXs; state.gridXNames = nx;
                state.gridYCoords = masterYs; state.gridYNames = ny;
            }
        });
    },

    /**
     * 柱の現在の座標から通り芯名を取得します
     */
    getPillarName: function(p, state) {
        if (!p) return '位置不明';
        const TOL = 5;
        let xi = state.gridXCoords.findIndex(x => Math.abs(x - p.x) < TOL); 
        let yi = state.gridYCoords.findIndex(y => Math.abs(y - p.y) < TOL);
        let gx = xi >= 0 ? state.gridXNames[xi] : (p.gx || '?');
        let gy = yi >= 0 ? state.gridYNames[yi] : (p.gy || '?');
        
        if (state.userEditedGridX && state.userEditedGridX[p.x]) gx = state.userEditedGridX[p.x];
        if (state.userEditedGridY && state.userEditedGridY[p.y]) gy = state.userEditedGridY[p.y];
        
        if (gx === '?' && gy === '?') return '位置不明';
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
        const zxt = c.div4Zones[floor].xt || (H / 4);
        const zxb = c.div4Zones[floor].xb || (H / 4);
        const zyl = c.div4Zones[floor].yl || (W / 4);
        const zyr = c.div4Zones[floor].yr || (W / 4);
        
        return { 
            minX, maxX, minY, maxY, W, H, 
            xLeft: minX + zyl, xRight: maxX - zyr, 
            yBottom: minY + zxb, yTop: maxY - zxt 
        };
    }
};
