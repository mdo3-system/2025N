/**
 * controllers/InputController.js - Application Input Layer
 * v2.1.1 Refactoring
 */

window.InputController = {
    /**
     * Initialize all global event listeners
     */
    init: function() {
        console.log("🎮 [v2.1.1] Initializing Input Controller...");
        
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
                window.Parsers.parseJson(ev.target.result, window.AppState);
                window.StructuralEngine.runAnalysis(window.AppState);
                if (typeof triggerUpdate === 'function') triggerUpdate();
            };
            reader.readAsText(file);
        });

        bF('dxf-upload', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const rawTxt = new TextDecoder('UTF-8').decode(ev.target.result);
                window.Parsers.parseDxf(rawTxt, window.AppState);
                window.StructuralEngine.runAnalysis(window.AppState);
                if (typeof triggerUpdate === 'function') triggerUpdate();
            };
            reader.readAsArrayBuffer(file);
        });

        bF('upload-doc-sub', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const rawTxt = new TextDecoder('UTF-8').decode(ev.target.result);
                window.Parsers.parseDxf(rawTxt, window.AppState, true);
                if (typeof triggerUpdate === 'function') triggerUpdate();
            };
            reader.readAsArrayBuffer(file);
        });
    },

    bindButtonHandlers: function() {
        const bC = (id, fn) => { let el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
        
        bC('btn-save', () => window.AppExport.saveData());
        bC('btn-undo', () => window.undoLastAction());
        bC('btn-redo', () => window.redoLastAction());
        
        bC('btn-toggle-layer', () => {
            const panel = document.getElementById('dxf-layer-panel');
            if (panel) panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
            else if (typeof renderLayerPanel === 'function') renderLayerPanel();
        });

        bC('btn-add-cust-wall', () => window.addCustomWallRow());
        bC('btn-add-cust-hw', () => window.addCustomHwRow());

        // [v2.1.1] Apply Property Changes
        bC('btn-prop-apply', () => window.ModalController.applyPropertyChanges());
        
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
        
        bC('tab-foundation', () => window.switchAppMode('foundation'));
        bC('tab-1f', () => window.setFloor('1F'));
        bC('tab-2f', () => window.setFloor('2F'));
        
        document.querySelectorAll('input[name="mode"]').forEach(el => { 
            el.addEventListener('change', (e) => window.handleModeChange(e)); 
        });
    },

    bindStateHandlers: function() {
        const bindLayerToggle = (id, key) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    window.elementVisibility[key] = e.target.checked;
                    if (typeof triggerUpdate === 'function') triggerUpdate();
                });
            }
        };
        
        bindLayerToggle('v-layer-grids', 'grids');
        bindLayerToggle('v-layer-pillars', 'pillars');
        bindLayerToggle('vis-wall', 'walls');
        bindLayerToggle('vis-diaph', 'areas');

        const fcEl = document.getElementById('global-fc');
        if (fcEl) {
            fcEl.addEventListener('change', (e) => {
                window.AppState.concreteFc = parseInt(e.target.value, 10) || 21;
                window.StructuralEngine.runAnalysis(window.AppState);
                if (typeof triggerUpdate === 'function') triggerUpdate();
            });
        }
        
        const tmEl = document.getElementById('global-triangle-mult');
        if (tmEl) {
            tmEl.addEventListener('input', (e) => {
                window.AppState.triangleMultiplier = parseFloat(e.target.value) || 1.33;
                window.StructuralEngine.runAnalysis(window.AppState);
                if (typeof triggerUpdate === 'function') triggerUpdate();
            });
        }
    }
};
