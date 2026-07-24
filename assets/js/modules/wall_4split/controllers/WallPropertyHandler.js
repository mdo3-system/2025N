/**
 * controllers/WallPropertyHandler.js - Wall Property Modal & Input Handler
 * v3.2.1 Refactoring: Single Responsibility Principle
 */

window.WallPropertyHandler = {
    /**
     * 耐力壁のプロパティ更新
     */
    updateWallProp: function(wallId, key, val) {
        const s = window.AppState;
        if (!s || !s.walls) return;

        const w = s.walls.find(x => x.id === wallId);
        if (!w) return;

        let numVal = parseFloat(val);
        if (key === 'braceVal') w.braceVal = isNaN(numVal) ? 0 : numVal;
        else if (key === 'outPanelVal') w.outPanelVal = isNaN(numVal) ? 0 : numVal;
        else if (key === 'inPanelVal') w.inPanelVal = isNaN(numVal) ? 0 : numVal;
        else w[key] = val;

        if (window.WallEngine && typeof window.WallEngine.calculate === 'function') {
            window.WallEngine.calculate(s);
        }
        if (window.AppController && typeof window.AppController.refreshAll === 'function') {
            window.AppController.refreshAll();
        }
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('WallPropertyHandler', window.WallPropertyHandler);
}
