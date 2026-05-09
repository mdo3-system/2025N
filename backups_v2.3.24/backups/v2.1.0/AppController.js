/**
 * controllers/AppController.js - Main Application Orchestrator
 * v2.1.0 Refactoring
 */

window.AppController = {
    /**
     * The master refresh method. Call this whenever the state changes.
     */
    refreshAll: function() {
        console.log("🔄 [v2.1.0] Refreshing All...");
        const state = window.AppState;

        // 0. Sync UI to State (Pick up input values)
        this.syncUItoState(state);

        // 1. Run Structural Analysis (Logic)
        if (window.StructuralEngine) {
            window.StructuralEngine.runAnalysis(state);
        }

        // 2. Sync UI Components (Controller)
        if (window.PropertyController) {
            window.PropertyController.syncCenterPanel();
        }

        // 3. Update Canvas (View)
        if (window.MainRenderer) {
            window.MainRenderer.render(state);
        } else if (typeof triggerUpdate === 'function') {
            // Legacy fallback
            triggerUpdate();
        }

        // 4. Update Report/Calc Basis (View)
        this.updateReportUI(state);
    },

    /**
     * Update the textual report and calculation basis in the left/bottom panels
     */
    updateReportUI: function(state) {
        // This will eventually be moved to view/ReportView.js
        // For now, it calls the legacy updateReport() or equivalent
        if (typeof updateReport === 'function') {
            updateReport();
        }
    },

    /**
     * Handle Application Mode Switching
     */
    switchMode: function(mode) {
        window.AppState.currentAppMode = mode;
        this.refreshAll();
    },

    /**
     * Synchronize input field values from HTML into AppState.config
     */
    syncUItoState: function(state) {
        
        state.config.calcMode = document.getElementById('calc-mode-select')?.value || 'kijun';
        state.config.atticHeight = getVal('attic-height');
        state.config.floorHeight1F = getVal('n-h1');
        state.config.floorHeight2F = getVal('n-h2');
        state.config.pillarDepth1F = getVal('p-d1');
        state.config.pillarDepth2F = getVal('p-d2');
        state.config.triangleMultiplier = getVal('global-triangle-mult');

        state.config.weights.roof = getVal('prop-roof-type'); // Note: select value is numeric weight
        state.config.weights.solar = getVal('prop-solar');
        state.config.weights.ceilingIns = getVal('prop-ceiling-ins');
        state.config.weights.wallIns = getVal('prop-wall-ins');
        state.config.weights.exteriorWall = getVal('prop-ext-wall');
    }
};
