/**
 * controllers/AppController.js - アプリケーション全体の中央制御
 * v2.3.25 リファクタリング
 */

window.AppController = {
    /**
     * アプリケーションの全体更新（旧 triggerUpdate）
     */
    refreshAll: function(shouldSaveHistory = true) {
        const state = window.AppState;
        if (!state) return;

        // 0. Sync state from UI (Single Source of Truth)
        if (typeof state.init === 'function') {
            state.init();
        }

        // 0.1. Auto-fill areas from drawing data (if present)
        if (window.AreaEngine) {
            ['1F', '2F'].forEach(f => {
                const lv = f.charAt(0);
                const drawnFloor = window.AreaEngine.getFloorArea(f, state);
                if (drawnFloor !== null) {
                    const el = document.getElementById('a-f' + lv);
                    if (el) el.value = drawnFloor.toFixed(2);
                }
                const drawnAttic = window.AreaEngine.getAreaByType(f, 'attic', state);
                if (drawnAttic !== null) {
                    const el = document.getElementById('a-attic' + lv);
                    if (el) el.value = drawnAttic.toFixed(2);
                }
                const drawnBalcony = window.AreaEngine.getAreaByType(f, 'balcony', state);
                if (drawnBalcony !== null) {
                    const el = document.getElementById('a-balcony' + lv);
                    if (el) el.value = drawnBalcony.toFixed(2);
                }
                const drawnPorch = window.AreaEngine.getAreaByType(f, 'porch', state);
                if (drawnPorch !== null) {
                    const el = document.getElementById('a-porch' + lv);
                    if (el) el.value = drawnPorch.toFixed(2);
                }
                const drawnVoid = window.AreaEngine.getAreaByType(f, 'void', state);
                if (drawnVoid !== null) {
                    const el = document.getElementById('a-void' + lv);
                    if (el) el.value = drawnVoid.toFixed(2);
                }

                // Auto-fill 4-division side end areas with precise 3 decimals (always synchronized)
                const div4 = window.AreaEngine.calculate4DivisionAreas(f, state);
                if (div4) {
                    const xtEl = document.getElementById('e-x-t' + lv); if (xtEl) xtEl.value = div4.xt.toFixed(3);
                    const xbEl = document.getElementById('e-x-b' + lv); if (xbEl) xbEl.value = div4.xb.toFixed(3);
                    const ylEl = document.getElementById('e-y-l' + lv); if (ylEl) ylEl.value = div4.yl.toFixed(3);
                    const yrEl = document.getElementById('e-y-r' + lv); if (yrEl) yrEl.value = div4.yr.toFixed(3);
                } else {
                    const xtEl = document.getElementById('e-x-t' + lv); if (xtEl) xtEl.value = "0.000";
                    const xbEl = document.getElementById('e-x-b' + lv); if (xbEl) xbEl.value = "0.000";
                    const ylEl = document.getElementById('e-y-l' + lv); if (ylEl) ylEl.value = "0.000";
                    const yrEl = document.getElementById('e-y-r' + lv); if (yrEl) yrEl.value = "0.000";
                }
            });
            // Re-init state to capture the auto-filled values
            state.init();
        }

        // 0.2. Auto-calculate projected areas from roofFaces (if present)
        if (window.RoofEngine) {
            window.RoofEngine.updateProjectedAreas(state);
            state.init();
        }

        // 1. 解析の実行 (Logic)
        if (window.StructuralEngine) {
            window.StructuralEngine.runAnalysis();
        }

        // 2. 履歴の保存
        if (shouldSaveHistory) {
            this.saveStateToHistory();
        }

        // 3. UI表示の更新 (View / Controller)
        if (window.ReportEngine && window.ReportEngine.updateReport) {
            window.ReportEngine.updateReport(state);
        }
        if (window.updateWallSelects) window.updateWallSelects();
        if (window.PropertyController && typeof window.PropertyController.syncCenterPanel === 'function') {
            window.PropertyController.syncCenterPanel();
        }

        // 4. キャンバスの再描画 (View)
        if (window.MainRenderer) {
            window.MainRenderer.render(state);
        }
    },

    /**
     * 状態を履歴スタックに保存
     */
    saveStateToHistory: function() {
        const state = window.AppState;
        const data = {
            pillars: JSON.parse(JSON.stringify(state.pillars)),
            walls: JSON.parse(JSON.stringify(state.walls)),
            windowsArr: JSON.parse(JSON.stringify(state.windowsArr)),
            areaLines: JSON.parse(JSON.stringify(state.areaLines)),
            roofFaces: JSON.parse(JSON.stringify(state.roofFaces || [])), // [v2.7.0]
            manualGridX: JSON.parse(JSON.stringify(state.manualGridX || [])),
            manualGridY: JSON.parse(JSON.stringify(state.manualGridY || [])),
            roofGridManualX: JSON.parse(JSON.stringify(state.roofGridManualX || [])), // [v2.7.0]
            roofGridManualY: JSON.parse(JSON.stringify(state.roofGridManualY || [])), // [v2.7.0]
            manualGridAngle: JSON.parse(JSON.stringify(state.manualGridAngle || [])),
            deletedGridX: [...(state.deletedGridX || [])],
            deletedGridY: [...(state.deletedGridY || [])],
            foundationBeams: JSON.parse(JSON.stringify(state.foundationBeams || [])),
            foundationSlabs: JSON.parse(JSON.stringify(state.foundationSlabs || [])),
            exteriorWalls: JSON.parse(JSON.stringify(state.exteriorWalls || [])),
            manholes: JSON.parse(JSON.stringify(state.manholes || [])),
            config: JSON.parse(JSON.stringify(state.config || {})) // [v2.5.18] 履歴に手入力フォーム値を完全に含めて保存
        };

        const last = state.historyStack[state.historyStack.length - 1];
        if (last && JSON.stringify(last) === JSON.stringify(data)) return;

        state.historyStack.push(data);
        if (state.historyStack.length > 50) state.historyStack.shift();
        state.redoStack = []; // 新しい操作をしたらレッドゥーはクリア
    },

    undo: function() {
        const state = window.AppState;
        if (state.historyStack.length < 2) return;
        
        const current = state.historyStack.pop();
        state.redoStack.push(current);
        
        const prev = state.historyStack[state.historyStack.length - 1];
        this.restoreState(prev);
        this.refreshAll(false);
    },

    redo: function() {
        const state = window.AppState;
        if (state.redoStack.length === 0) return;
        
        const next = state.redoStack.pop();
        state.historyStack.push(next);
        
        this.restoreState(next);
        this.refreshAll(false);
    },

    restoreState: function(data) {
        const state = window.AppState;
        state.pillars = JSON.parse(JSON.stringify(data.pillars));
        state.walls = JSON.parse(JSON.stringify(data.walls));
        state.windowsArr = JSON.parse(JSON.stringify(data.windowsArr));
        state.areaLines = JSON.parse(JSON.stringify(data.areaLines));
        state.roofFaces = JSON.parse(JSON.stringify(data.roofFaces || [])); // [v2.7.0]
        state.gridXCoords = [...(data.gridXCoords || [])];
        state.gridYCoords = [...(data.gridYCoords || [])];
        state.gridXNames = [...(data.gridXNames || [])];
        state.gridYNames = [...(data.gridYNames || [])];
        state.manualGridX = JSON.parse(JSON.stringify(data.manualGridX || []));
        state.manualGridY = JSON.parse(JSON.stringify(data.manualGridY || []));
        state.roofGridManualX = JSON.parse(JSON.stringify(data.roofGridManualX || [])); // [v2.7.0]
        state.roofGridManualY = JSON.parse(JSON.stringify(data.roofGridManualY || [])); // [v2.7.0]
        state.manualGridAngle = JSON.parse(JSON.stringify(data.manualGridAngle || []));
        state.deletedGridX = [...(data.deletedGridX || [])];
        state.deletedGridY = [...(data.deletedGridY || [])];
        if (data.foundationBeams) state.foundationBeams = JSON.parse(JSON.stringify(data.foundationBeams));
        if (data.foundationSlabs) state.foundationSlabs = JSON.parse(JSON.stringify(data.foundationSlabs));
        if (data.exteriorWalls) state.exteriorWalls = JSON.parse(JSON.stringify(data.exteriorWalls));
        if (data.manholes) state.manholes = JSON.parse(JSON.stringify(data.manholes));
        
        if (data.config) {
            state.config = JSON.parse(JSON.stringify(data.config));
            // [v2.5.18] 履歴の復元時にDOM入力欄も完全に再同期する
            this.syncConfigToDOM(state.config);
        }
    },

    /**
     * [v2.5.18] 状態オブジェクトの設定をDOM入力フィールド群に反映
     */
    syncConfigToDOM: function(cfg) {
        if (!cfg) return;
        const sV = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined && val !== null) el.value = val;
        };
        sV('calc-mode-select', cfg.calcMode);
        sV('attic-height', cfg.atticHeight);
        sV('global-triangle-mult', cfg.triangleMultiplier);
        
        if (cfg.floorAreas) {
            sV('a-f1', cfg.floorAreas['1F']);
            sV('a-attic1', cfg.floorAreas['1F_attic']);
            sV('a-balcony1', cfg.floorAreas['1F_balcony']);
            sV('a-porch1', cfg.floorAreas['1F_porch']);
            sV('a-f2', cfg.floorAreas['2F']);
            sV('a-attic2', cfg.floorAreas['2F_attic']);
            sV('a-balcony2', cfg.floorAreas['2F_balcony']);
            sV('a-void2', cfg.floorAreas['2F_void']);
        }
        if (cfg.reqWallCoeffs) {
            if (cfg.reqWallCoeffs['1F']) {
                sV('c-q1', cfg.reqWallCoeffs['1F'].seismic);
                sV('c-w', cfg.reqWallCoeffs['1F'].wind);
            }
            if (cfg.reqWallCoeffs['2F']) sV('c-q2', cfg.reqWallCoeffs['2F'].seismic);
        }
        if (cfg.projectedAreas) {
            if (cfg.projectedAreas['1F']) { sV('a-wx1', cfg.projectedAreas['1F'].x); sV('a-wy1', cfg.projectedAreas['1F'].y); }
            if (cfg.projectedAreas['2F']) { sV('a-wx2', cfg.projectedAreas['2F'].x); sV('a-wy2', cfg.projectedAreas['2F'].y); }
        }
        sV('n-h1', cfg.floorHeight1F);
        sV('n-h2', cfg.floorHeight2F);
    },

    /**
     * モード切替のハンドル
     */
    switchAppMode: function(mode) {
        const state = window.AppState;
        state.currentAppMode = mode;
        
        // UIパネルの表示制御
        const wallPanel = document.getElementById('wall-mode-panel');
        const foundPanel = document.getElementById('foundation-mode-panel');
        if (wallPanel) {
            // foundation モード以外は常に表示する
            wallPanel.style.display = (mode === 'foundation') ? 'none' : 'block';
        }
        if (foundPanel) foundPanel.style.display = (mode === 'foundation') ? '' : 'none';

        if (mode === 'foundation') {
            this.updateFoundationUI();
            // [v2.5.16 修正] スケールが初期デフォルト値(1.0)かつオフセットもゼロ（＝完全未初期化状態）の場合のみ初期ビューを計算する
            const isUninitialized = (state.scale === 1.0 && state.offsetX === 0 && state.offsetY === 0);
            if (isUninitialized && typeof initViewForce === 'function') initViewForce();
        } else {
            this.updateWallUI();
        }

        this.refreshAll(false); // モード切替は履歴に含めない（データ変更時のみ）
    },

    updateFoundationUI: function() {
        const tf = document.getElementById('tab-foundation');
        const t1 = document.getElementById('tab-1f');
        const t2 = document.getElementById('tab-2f');
        if (tf) tf.className = 'tab-btn active';
        if (t1) t1.className = 'tab-btn';
        if (t2) t2.className = 'tab-btn';

        window.AppState.elementVisibility.walls = false;
        window.AppState.elementVisibility.areas = false;
        
        const visWall = document.getElementById('vis-wall');
        const visDiaph = document.getElementById('vis-diaph');
        if (visWall) visWall.checked = false;
        if (visDiaph) visDiaph.checked = false;
    },

    updateWallUI: function() {
        const floor = window.AppState.currentFloor;
        const tf = document.getElementById('tab-foundation');
        const t1 = document.getElementById('tab-1f');
        const t2 = document.getElementById('tab-2f');
        if (tf) tf.className = 'tab-btn';
        if (t1) t1.className = floor === '1F' ? 'tab-btn active' : 'tab-btn';
        if (t2) t2.className = floor === '2F' ? 'tab-btn active' : 'tab-btn';

        // [v2.5.18] 基礎モードから復帰した際、すべてのレイヤを自動的に強制ONにする
        const vis = window.AppState.elementVisibility;
        if (vis) {
            Object.keys(vis).forEach(k => vis[k] = true);
            vis.div4 = true; // 4分割も強制ON
        }
        const layerDomIds = [
            'v-layer-grids', 'v-layer-pillars', 'v-layer-pillarNValues', 'vis-wall',
            'v-layer-windows', 'vis-diaph', 'v-layer-f_beams', 'v-layer-f_slabs',
            'v-layer-f_ext_walls', 'v-layer-f_manholes', 'v-layer-div4-sub', 'v-layer-div4'
        ];
        layerDomIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = true;
        });
    },

    /**
     * 階の切替
     */
    setFloor: function(floor) {
        window.AppState.currentFloor = floor;
        this.switchAppMode('wall');
    }
};

/**
 * レガシー互換用のグローバルエイリアス
 */
window.triggerUpdate = function() {
    window.AppController.refreshAll();
};

window.updateReport = function() {
    if (window.ReportEngine) window.ReportEngine.updateReport(window.AppState);
};

window.undoLastAction = function() {
    window.AppController.undo();
};

window.redoLastAction = function() {
    window.AppController.redo();
};
