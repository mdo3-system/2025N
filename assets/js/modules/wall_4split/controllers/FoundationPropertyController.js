/**
 * controllers/FoundationPropertyController.js - Foundation Elements Property UI Controller
 * v3.5.0 Refactoring: Single Responsibility Principle (SRP)
 */

window.FoundationPropertyController = {
    /**
     * 基礎要素のプロパティポップアップを表示
     */
    showFdPopup: function(item, type, clientPos) {
        const popup = document.getElementById('fd-property-popup');
        const content = document.getElementById('fd-popup-content');
        const title = document.getElementById('fd-popup-title');
        if (!popup || !content) return;

        let titleText = type === 'beam' ? '🏗️ 基礎梁 プロパティ' : (type === 'slab' ? '🔲 基礎スラブ プロパティ' : '🚪 人通口 プロパティ');
        if (title) title.innerText = titleText;

        let html = '';
        if (type === 'beam') {
            const bW = item.width || 150;
            const bH = item.height || 450;
            html = `
                <div style="font-size:12px; line-height:1.6;">
                    <div style="margin-bottom:8px;"><b>梁ID:</b> ${item.id || 'FB-1'} (${item.floor || '基礎'})</div>
                    <div style="margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                        <label>梁幅(mm):</label>
                        <input type="number" id="edit-fd-beam-w" value="${bW}" style="width:70px; padding:2px;">
                    </div>
                    <div style="margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                        <label>梁せい(mm):</label>
                        <input type="number" id="edit-fd-beam-h" value="${bH}" style="width:70px; padding:2px;">
                    </div>
                    <div style="margin-top:12px; text-align:right;">
                        <button onclick="window.FoundationPropertyController.applyFdBeamChanges('${item.id}')" style="background:#8e44ad; color:#fff; border:none; padding:4px 12px; border-radius:3px; cursor:pointer; font-weight:bold;">適用</button>
                    </div>
                </div>`;
        } else if (type === 'slab') {
            const thick = item.thickness || 150;
            html = `
                <div style="font-size:12px; line-height:1.6;">
                    <div style="margin-bottom:8px;"><b>スラブID:</b> ${item.id || 'FS-1'}</div>
                    <div style="margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                        <label>底盤厚さ(mm):</label>
                        <input type="number" id="edit-fd-slab-t" value="${thick}" style="width:70px; padding:2px;">
                    </div>
                    <div style="margin-top:12px; text-align:right;">
                        <button onclick="window.FoundationPropertyController.applyFdSlabChanges('${item.id}')" style="background:#8e44ad; color:#fff; border:none; padding:4px 12px; border-radius:3px; cursor:pointer; font-weight:bold;">適用</button>
                    </div>
                </div>`;
        } content.innerHTML = html;
        popup.style.display = 'block';

        if (clientPos) {
            popup.style.left = Math.min(clientPos.x, window.innerWidth - 500) + 'px';
            popup.style.top = Math.min(clientPos.y, window.innerHeight - 300) + 'px';
        }
    },

    hideFdPopup: function() {
        const popup = document.getElementById('fd-property-popup');
        if (popup) popup.style.display = 'none';
    },

    applyFdBeamChanges: function(id) {
        const wEl = document.getElementById('edit-fd-beam-w');
        const hEl = document.getElementById('edit-fd-beam-h');
        if (!wEl || !hEl) return;

        const w = parseFloat(wEl.value) || 150;
        const h = parseFloat(hEl.value) || 450;

        const beams = (window.AppState && window.AppState.f_beams) || [];
        const target = beams.find(b => b.id === id);
        if (target) {
            target.width = w;
            target.height = h;
            if (window.AppController) window.AppController.refreshAll();
        }
        this.hideFdPopup();
    },

    applyFdSlabChanges: function(id) {
        const tEl = document.getElementById('edit-fd-slab-t');
        if (!tEl) return;

        const t = parseFloat(tEl.value) || 150;
        const slabs = (window.AppState && window.AppState.f_slabs) || [];
        const target = slabs.find(s => s.id === id);
        if (target) {
            target.thickness = t;
            if (window.AppController) window.AppController.refreshAll();
        }
        this.hideFdPopup();
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('FoundationPropertyController', window.FoundationPropertyController);
}
