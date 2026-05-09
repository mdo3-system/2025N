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
        
        document.querySelectorAll('input[name="mode"]').forEach(el => { 
            el.addEventListener('change', () => window.AppController.refreshAll()); 
        });
    },

    bindStateHandlers: function() {
        const bindLayerToggle = (id, key) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    window.AppState.elementVisibility[key] = e.target.checked;
                    window.AppController.refreshAll();
                });
            }
        };
        
        bindLayerToggle('v-layer-grids', 'grids');
        bindLayerToggle('v-layer-pillars', 'pillars');
        bindLayerToggle('vis-wall', 'walls');
        bindLayerToggle('vis-diaph', 'areas');

        const fcEl = document.getElementById('global-fc');
        if (fcEl) {
            fcEl.addEventListener('change', () => window.AppController.refreshAll());
        }
        
        const tmEl = document.getElementById('global-triangle-mult');
        if (tmEl) {
            tmEl.addEventListener('input', () => window.AppController.refreshAll());
        }
    }
};
