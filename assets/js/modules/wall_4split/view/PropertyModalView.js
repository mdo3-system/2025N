/**
 * view/PropertyModalView.js - Property Modal HTML View Components
 * v3.12.106 Refactoring: Single Responsibility Principle - Pure View for Property Modal Forms
 */

window.PropertyModalView = {
    /**
     * 一般要素（柱・壁・床・基礎等）の基本プロパティフォームHTML生成
     */
    generateGeneralFormHtml: function(type, item) {
        if (type === 'pillar') {
            return `
                <div class="calc-row">
                    <label>柱ID</label>
                    <input type="text" value="${item.id || ''}" readonly style="background:#eee;">
                </div>
                <div class="calc-row">
                    <label>位置 (通り芯)</label>
                    <input type="text" value="${item.gName || (item.gx + item.gy) || ''}" readonly style="background:#eee;">
                </div>
                <div class="calc-row">
                    <label>階</label>
                    <input type="text" value="${item.floor || '1F'}" readonly style="background:#eee;">
                </div>
            `;
        }
        if (type === 'wall') {
            const masterList = (window.AppState && typeof window.AppState.getMasterWallList === 'function') ? window.AppState.getMasterWallList() : [];
            const masterBraceList = (window.AppState && typeof window.AppState.getMasterBraceList === 'function') ? window.AppState.getMasterBraceList() : [];
            
            const outOptHtml = masterList.map(w => `<option value="${w.id}" ${item.outPanelId === w.id ? 'selected' : ''}>${w.name} (×${w.mult})</option>`).join('');
            const inOptHtml  = masterList.map(w => `<option value="${w.id}" ${item.inPanelId === w.id ? 'selected' : ''}>${w.name} (×${w.mult})</option>`).join('');
            const braceOptHtml = masterBraceList.map(b => `<option value="${b.id}" ${item.braceId === b.id ? 'selected' : ''}>${b.name} (×${b.mult})</option>`).join('');

            return `
                <div class="calc-row">
                    <label>外側 面材仕様</label>
                    <select id="edit-wall-out" style="flex:1;">${outOptHtml}</select>
                </div>
                <div class="calc-row">
                    <label>内側 面材仕様</label>
                    <select id="edit-wall-in" style="flex:1;">${inOptHtml}</select>
                </div>
                <div class="calc-row">
                    <label>筋交い仕様</label>
                    <select id="edit-wall-brace" style="flex:1;">${braceOptHtml}</select>
                </div>
            `;
        }
        return '';
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('PropertyModalView', window.PropertyModalView);
}
