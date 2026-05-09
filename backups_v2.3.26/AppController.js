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

        // 1. 解析の実行 (Logic)
        if (window.StructuralEngine) {
            window.StructuralEngine.runAnalysis();
        }

        // 2. 履歴の保存
        if (shouldSaveHistory) {
            this.saveStateToHistory();
        }

        // 3. UI表示の更新 (View / Controller)
        if (typeof updateReport === 'function') updateReport();
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
            gridXCoords: [...state.gridXCoords],
            gridYCoords: [...state.gridYCoords],
            gridXNames: [...state.gridXNames],
            gridYNames: [...state.gridYNames]
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
        state.gridXCoords = [...data.gridXCoords];
        state.gridYCoords = [...data.gridYCoords];
        state.gridXNames = [...data.gridXNames];
        state.gridYNames = [...data.gridYNames];
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
    },

    /**
     * 階の切替
     */
    setFloor: function(floor) {
        window.AppState.currentFloor = floor;
        window.AppState.currentAppMode = 'wall';
        this.updateWallUI();
        this.refreshAll(false);
    }
};

/**
 * レガシー互換用のグローバルエイリアス
 */
window.triggerUpdate = function() {
    window.AppController.refreshAll();
};

window.undoLastAction = function() {
    window.AppController.undo();
};

window.redoLastAction = function() {
    window.AppController.redo();
};
