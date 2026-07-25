/**
 * controllers/RoofPropertyController.js - Roof Elements Property UI Controller
 * v3.5.0 Refactoring: Single Responsibility Principle (SRP)
 */

window.RoofPropertyController = {
    /**
     * 屋根要素のプロパティポップアップを表示
     */
    showRoofPopup: function(roofItem, clientPos) {
        const popup = document.getElementById('roof-property-popup');
        const content = document.getElementById('roof-popup-content');
        if (!popup || !content) return;

        if (!roofItem) return;

        const slope = roofItem.slope != null ? roofItem.slope : 0.4;
        const eType = roofItem.eavesType || 'standard';

        const html = `
            <div style="font-size:12px; line-height:1.6;">
                <div style="margin-bottom:8px;"><b>屋根面ID:</b> ${roofItem.id || 'R-1'} (${roofItem.floor || 'RF'})</div>
                <div style="margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                    <label>屋根勾配 (寸):</label>
                    <input type="number" id="edit-roof-slope" value="${(slope * 10).toFixed(1)}" step="0.5" style="width:70px; padding:2px;"> 寸勾配
                </div>
                <div style="margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                    <label>軒先区分:</label>
                    <select id="edit-roof-eaves" style="padding:2px;">
                        <option value="standard" ${eType === 'standard' ? 'selected' : ''}>標準 (出寸法300mm)</option>
                        <option value="large" ${eType === 'large' ? 'selected' : ''}>深庇 (出寸法600mm以上)</option>
                        <option value="none" ${eType === 'none' ? 'selected' : ''}>ケラバ・軒出なし</option>
                    </select>
                </div>
                <div style="margin-top:12px; text-align:right;">
                    <button onclick="window.RoofPropertyController.applyRoofChanges('${roofItem.id}')" style="background:#2980b9; color:#fff; border:none; padding:4px 12px; border-radius:3px; cursor:pointer; font-weight:bold;">適用</button>
                </div>
            </div>`;

        content.innerHTML = html;
        popup.style.display = 'block';

        if (clientPos) {
            popup.style.left = Math.min(clientPos.x, window.innerWidth - 420) + 'px';
            popup.style.top = Math.min(clientPos.y, window.innerHeight - 300) + 'px';
        }
    },

    hideRoofPopup: function() {
        const popup = document.getElementById('roof-property-popup');
        if (popup) popup.style.display = 'none';
    },

    applyRoofChanges: function(id) {
        const sEl = document.getElementById('edit-roof-slope');
        const eEl = document.getElementById('edit-roof-eaves');
        if (!sEl) return;

        const slopeVal = (parseFloat(sEl.value) || 4.0) / 10.0;
        const eavesVal = eEl ? eEl.value : 'standard';

        const roofs = (window.AppState && window.AppState.roofs) || [];
        const target = roofs.find(r => r.id === id);
        if (target) {
            target.slope = slopeVal;
            target.eavesType = eavesVal;
            if (window.AppController) window.AppController.refreshAll();
        }
        this.hideRoofPopup();
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('RoofPropertyController', window.RoofPropertyController);
}
