/**
 * controllers/InputController.js - Application Input Layer
 */

window.InputController = {
    /**
     * Initialize all global event listeners
     */
    init: function() {
        console.log(`🎮 [${window.APP_VERSION || 'v2.x'}] Initializing Input Controller...`);
        
        // 1. File Uploads
        this.bindFileHandlers();
        
        // 2. Global UI Buttons
        this.bindButtonHandlers();
        
        // 3. Tab & Mode Switching
        this.bindNavigationHandlers();
        
        // 4. State Binding (Global inputs)
        this.bindStateHandlers();
    },

    bindFileHandlers: function() {
        const bF = (id, fn) => {
            const el = document.getElementById(id);
            if (el) { el.addEventListener('click', e => { e.target.value = ''; }); el.addEventListener('change', fn); }
        };
        
        bF('json-upload', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (window.Parsers) {
                    const loadedState = window.Parsers.parseJson(ev.target.result, window.AppState);
                    // 復元されたモードに切り替える
                    if (window.AppController && loadedState.currentAppMode) {
                        window.AppController.switchAppMode(loadedState.currentAppMode);
                    }
                }
                if (typeof initViewForce === 'function') initViewForce();
                if (window.AppController) window.AppController.refreshAll();
            };
            reader.readAsText(file);
        });

        bF('dxf-upload', (e) => {
            if (typeof loadDxf === 'function') loadDxf(e);
        });

        bF('upload-doc-sub', (e) => {
            if (typeof loadSubDxf === 'function') loadSubDxf(e);
        });
    },

    bindButtonHandlers: function() {
        const bC = (id, fn) => { let el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
        
        bC('btn-save', () => { if (window.AppExport) window.AppExport.saveData(); });
        bC('btn-undo', () => { if (typeof undoLastAction === 'function') undoLastAction(); });
        bC('btn-redo', () => { if (typeof redoLastAction === 'function') redoLastAction(); });
        
        bC('btn-toggle-layer', () => {
            const panel = document.getElementById('dxf-layer-panel');
            if (panel) panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
        });

        bC('btn-add-cust-wall', () => { console.log("Click: btn-add-cust-wall"); if (window.UIView) window.UIView.addCustomWallRow(); });
        bC('btn-add-cust-hw', () => { console.log("Click: btn-add-cust-hw"); if (window.UIView) window.UIView.addCustomHwRow(); });

        bC('btn-prop-apply', () => { if (window.PropertyController) window.PropertyController.applyGeneralChanges(); });
        
        bC('btn-show-ratio', () => { if (window.AppExport) window.AppExport.showRatioModal(); });
        bC('btn-show-area', () => { if (typeof showAreaPreview === 'function') showAreaPreview(); });
        bC('btn-show-center', () => { if (typeof showCenterCalc === 'function') showCenterCalc(); });
        bC('btn-elevation-viewer-left', () => { 
            if (window.openElevationViewer) {
                window.openElevationViewer();
            } else {
                const modal = document.getElementById('modal-elevation-viewer');
                if (modal) modal.style.display = 'flex';
                if (window.updateElevationViewer) window.updateElevationViewer();
            }
        });
        bC('btn-export-csv', () => { if (window.AppExport) window.AppExport.exportCSV(); });
        bC('btn-export-dxf', () => { if (window.AppExport) window.AppExport.exportDXF(); });
        bC('btn-gen-doc', () => { if (window.DocumentEngine) window.DocumentEngine.generateFullReport(); });

        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', function () { this.closest('.modal-overlay').style.display = 'none'; });
        });
    },

    initCanvas: function(canvas) {
        if (typeof initCanvasInput === 'function') {
            initCanvasInput(canvas);
        }
    },

    bindNavigationHandlers: function() {
        const bC = (id, fn) => { let el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
        
        bC('tab-foundation', () => window.AppController.switchAppMode('foundation'));
        bC('tab-1f', () => window.AppController.setFloor('1F'));
        bC('tab-2f', () => window.AppController.setFloor('2F'));

        bC('btn-open-area-settings', () => {
            const m = document.getElementById('modal-area-settings');
            if (m) m.style.display = 'flex';
        });

        bC('btn-open-wall-settings', () => {
            if (window.UIView) window.UIView.openWallSettingsModal();
        });

        bC('btn-apply-wall-settings', () => {
            if (window.UIView) window.UIView.applyWallSettingsFromModal();
        });
        
        document.querySelectorAll('input[name="mode"]').forEach(el => { 
            el.addEventListener('change', (e) => {
                // 壁モード選択時にモーダルを出す
                if (e.target.value === 'wall') {
                    if (window.UIView) window.UIView.openWallSettingsModal();
                }
                // 柱負担面積図のインライン設定表示
                const areaSubPanel = document.getElementById('area-calc-sub-mode-inline');
                if (areaSubPanel) {
                    areaSubPanel.style.display = (e.target.value === 'area') ? 'block' : 'none';
                }
                window.AppController.refreshAll();
            }); 
        });
    },

    bindStateHandlers: function() {
        const refresh = () => {
            if (window.AppState.init) window.AppState.init();
            if (window.AppController) window.AppController.refreshAll();
        };

        const bindId = (id, event = 'change') => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, refresh);
        };

        // 1. Configuration & Area Basis (Standardized in v2.3.24)
        const globalIds = [
            'calc-mode-select', 'attic-height', 'global-fc', 'global-triangle-mult',
            'prop-ext-wall', 'prop-roof-type', 'prop-solar', 'prop-ceiling-ins', 'prop-wall-ins',
            'n-h1', 'n-h2', 'p-d1', 'p-d2', 'c-w'
        ];
        globalIds.forEach(id => {
            const event = (id.includes('mult') || id.includes('ins') || id.includes('h') || id.includes('d')) ? 'input' : 'change';
            bindId(id, event);
        });

        ['1', '2'].forEach(lv => {
            const floorIds = [
                'a-f' + lv, 'a-attic' + lv, 'a-balcony' + lv,
                'e-x-t' + lv, 'e-x-b' + lv, 'e-y-l' + lv, 'e-y-r' + lv,
                'z-x-t' + lv, 'z-x-b' + lv, 'z-y-l' + lv, 'z-y-r' + lv,
                'a-wx' + lv, 'a-wy' + lv,
                'c-q' + lv
            ];
            floorIds.forEach(id => bindId(id, 'input'));
        });

        // 2. Layer Visibility
        const bindLayerToggle = (id, key) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    if (window.AppState.elementVisibility) {
                        window.AppState.elementVisibility[key] = e.target.checked;
                    }
                    refresh();
                });
            }
        };
        
        bindLayerToggle('v-layer-grids', 'grids');
        bindLayerToggle('v-layer-pillars', 'pillars');
        bindLayerToggle('v-layer-pillarNValues', 'pillarNValues');
        bindLayerToggle('vis-wall', 'walls');
        bindLayerToggle('v-layer-windows', 'windows');
        bindLayerToggle('vis-diaph', 'areas');
        
        // Foundation specific
        bindLayerToggle('v-layer-f_beams', 'f_beams');
        bindLayerToggle('v-layer-f_slabs', 'f_slabs');
        bindLayerToggle('v-layer-f_ext_walls', 'f_ext_walls');
        bindLayerToggle('v-layer-f_manholes', 'f_manholes');

        // 4-division sync (between main checkbox and sidebar panel sub-checkbox)
        const mainDiv4 = document.getElementById('v-layer-div4');
        const subDiv4 = document.getElementById('v-layer-div4-sub');
        const syncDiv4 = (checked) => {
            if (mainDiv4) mainDiv4.checked = checked;
            if (subDiv4) subDiv4.checked = checked;
            if (window.AppState.elementVisibility) {
                window.AppState.elementVisibility.div4 = checked;
            }
            refresh();
        };
        if (mainDiv4) mainDiv4.addEventListener('change', e => syncDiv4(e.target.checked));
        if (subDiv4) subDiv4.addEventListener('change', e => syncDiv4(e.target.checked));
    }
};
