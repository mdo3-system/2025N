/**
 * controllers/PillarPropertyHandler.js - Pillar Property Modal & Input Handler
 * v3.2.1 Refactoring: Single Responsibility Principle
 */

window.PillarPropertyHandler = {
    /**
     * 柱のプロパティプロパティ更新
     */
    updatePillarProp: function(pillarId, key, val) {
        const s = window.AppState;
        if (!s || !s.pillars) return;

        const p = s.pillars.find(x => x.id === pillarId);
        if (!p) return;

        let numVal = parseFloat(val);
        if (key === 'isContinuous') p.isContinuous = Boolean(val);
        else if (key === 'isCorner') p.isCorner = Boolean(val);
        else if (key === 'd') p.d = isNaN(numVal) ? 105 : numVal;
        else if (key === 'manualMark') p.manualMark = val;
        else p[key] = val;

        if (window.NValueEngine && typeof window.NValueEngine.calculate === 'function') {
            window.NValueEngine.calculate(s);
        }
        if (window.AppController && typeof window.AppController.refreshAll === 'function') {
            window.AppController.refreshAll();
        }
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('PillarPropertyHandler', window.PillarPropertyHandler);
}
