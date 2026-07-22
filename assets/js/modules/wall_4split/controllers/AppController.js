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

        // [v3.0.10] 0.1. 最新の通り芯（グリッド）を最優先で解析・構築
        if (window.GridEngine && window.GridEngine.analyzeGrids) {
            window.GridEngine.analyzeGrids(state);
        }

        // [v3.0.12] 0.2. 先に DOM からの値を同期 (init) してから、見附投影面積を自動計算し DOM へ書き戻す
        state.init();
        if (window.MitsukeEngine && window.MitsukeEngine.updateProjectedAreas) {
            window.MitsukeEngine.updateProjectedAreas(state);
            // 自動計算された見付面積をDOM入力フィールドへ逆書き込み
            ['1', '2'].forEach(lv => {
                const f = lv + 'F';
                const pxVal = state.config.projectedAreas[f]?.x || 0;
                const pyVal = state.config.projectedAreas[f]?.y || 0;
                const wxEl = document.getElementById('a-wx' + lv);
                const wyEl = document.getElementById('a-wy' + lv);
                if (wxEl) wxEl.value = pxVal.toFixed(3); // 平米（㎡）値をそのまま代入
                if (wyEl) wyEl.value = pyVal.toFixed(3);
            });
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

        // [v2.7.0] 3Dプレビューがアクティブな場合は、シーンの同期描画もリアルタイム実行
        if (window.ThreeDPreviewController && document.getElementById(window.ThreeDPreviewController.modalId)?.style.display === 'flex') {
            window.ThreeDPreviewController.updateScene();
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
        sV('prop-wall-thickness', cfg.wallThickness);
        sV('prop-max-height', cfg.maxHeight);
        sV('prop-max-eaves-height', cfg.maxEavesHeight);
        sV('prop-base-height', cfg.baseHeight);
        sV('prop-base-pack', cfg.basePack);
        sV('prop-base-sill', cfg.baseSill);
        sV('prop-floor-thick-1f', cfg.floorThick1F);
        sV('prop-floor-thick-2f', cfg.floorThick2F);
        sV('prop-roof-thickness', cfg.roofThickness);
        
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
        const roofPanel = document.getElementById('roof-mode-panel');
        
        if (wallPanel) wallPanel.style.display = (mode === 'wall') ? 'block' : 'none';
        if (foundPanel) foundPanel.style.display = (mode === 'foundation') ? 'block' : 'none';
        if (roofPanel) roofPanel.style.display = (mode === 'roof') ? 'block' : 'none';

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
        const t1r = document.getElementById('tab-1r');
        const t2r = document.getElementById('tab-2r');
        if (tf) tf.className = 'tab-btn active';
        if (t1) t1.className = 'tab-btn';
        if (t2) t2.className = 'tab-btn';
        if (t1r) t1r.className = 'tab-btn';
        if (t2r) t2r.className = 'tab-btn';

        const vis = window.AppState.elementVisibility;
        if (vis) {
            // 基礎モード時の初期状態レイヤー制御：
            // 「基礎モード用」の全レイヤはON
            vis.f_slabs = true;
            vis.f_beams = true;
            vis.f_manholes = true;

            // 「作図・屋根モード用」のレイヤは柱とグリッドだけON、他はOFF
            vis.grids = true;
            vis.pillars = true;
            vis.pillarNValues = false;
            vis.walls = false;
            vis.windows = false;
            vis.areas = false;
            vis.div4 = false;
            vis.f_ext_walls = false;
            vis.roofGrids = false;
            vis.roofs = false;
        }

        // チェックボックスDOMへの同期反映
        const domMappings = {
            'v-layer-grids': true,
            'v-layer-pillars': true,
            'v-layer-pillarNValues': false,
            'vis-wall': false,
            'v-layer-windows': false,
            'vis-diaph': false,
            'v-layer-f_slabs': true,
            'v-layer-f_beams': true,
            'v-layer-f_manholes': true,
            'v-layer-f_ext_walls': false,
            'v-layer-div4': false,
            'v-layer-div4-sub': false,
            'v-layer-roofGrids': false,
            'v-layer-roofs': false
        };
        Object.keys(domMappings).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = domMappings[id];
        });
    },

    updateWallUI: function() {
        const floor = window.AppState.currentFloor;
        const mode = window.AppState.currentAppMode;
        const tf = document.getElementById('tab-foundation');
        const t1 = document.getElementById('tab-1f');
        const t2 = document.getElementById('tab-2f');
        const t1r = document.getElementById('tab-1r');
        const t2r = document.getElementById('tab-2r');
        if (tf) tf.className = 'tab-btn';
        if (t1) t1.className = (floor === '1F' && mode === 'wall') ? 'tab-btn active' : 'tab-btn';
        if (t2) t2.className = (floor === '2F' && mode === 'wall') ? 'tab-btn active' : 'tab-btn';
        if (t1r) t1r.className = (floor === '1F' && mode === 'roof') ? 'tab-btn active' : 'tab-btn';
        if (t2r) t2r.className = (floor === '2F' && mode === 'roof') ? 'tab-btn active' : 'tab-btn';

        const vis = window.AppState.elementVisibility;
        if (vis) {
            if (mode === 'roof') {
                vis.grids = true; // [v3.0.9] 屋根モード時も通り芯を必ず表示！
                vis.pillars = true; // 柱も基準として表示
                vis.f_ext_walls = true;
                vis.roofGrids = true;
                vis.roofs = true;
            } else {
                // 初回未設定時のみ初期デフォルト値をセットし、ユーザーが個別に変更した設定を保持する
                if (vis.pillars === undefined) vis.pillars = true;
                if (vis.walls === undefined) vis.walls = true;
                if (vis.windows === undefined) vis.windows = true;
                if (vis.grids === undefined) vis.grids = true;
                if (vis.areas === undefined) vis.areas = true;
                if (vis.div4 === undefined) vis.div4 = true;
                if (vis.pillarNValues === undefined) vis.pillarNValues = true;
                vis.roofGrids = false;
                vis.roofs = false;
            }
        }

        // チェックボックスDOMへの同期反映
        const domMappings = {
            'v-layer-grids': vis ? vis.grids : true,
            'v-layer-pillars': vis ? vis.pillars : true,
            'v-layer-pillarNValues': vis ? vis.pillarNValues : true,
            'vis-wall': vis ? vis.walls : true,
            'v-layer-windows': vis ? vis.windows : true,
            'vis-diaph': vis ? vis.areas : true,
            'v-layer-f_slabs': false,
            'v-layer-f_beams': false,
            'v-layer-f_manholes': false,
            'v-layer-f_ext_walls': vis ? vis.f_ext_walls : true,
            'v-layer-div4': vis ? vis.div4 : true,
            'v-layer-div4-sub': vis ? vis.div4 : true,
            'v-layer-roofGrids': vis ? vis.roofGrids : false,
            'v-layer-roofs': vis ? vis.roofs : false
        };
        Object.keys(domMappings).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = domMappings[id];
        });
    },

    /**
     * 階の切替
     */
    setFloor: function(floor) {
        window.AppState.currentFloor = floor;
        this.switchAppMode('wall');
    },

    /**
     * [v2.7.0] 屋根作図階の切替
     */
    setRoofFloor: function(floor) {
        window.AppState.currentFloor = floor;
        this.switchAppMode('roof');
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
