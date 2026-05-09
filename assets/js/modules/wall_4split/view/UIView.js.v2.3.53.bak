/**
 * view/UIView.js - UI Component Builders and Dynamic Elements
 */

window.UIView = {
    /**
     * Add a custom wall specification row to the UI
     */
    addCustomWallRow: function() {
        console.log(`➕ [${window.APP_VERSION}] Adding custom wall row...`);
        const container = document.getElementById('custom-wall-container');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'calc-row cust-wall-row';
        div.style.marginBottom = '5px';
        div.innerHTML = `
            <input type="text" class="cust-w-n" placeholder="名称" style="width:130px; margin:0;" onchange="window.updateWallSelects()">
            <input type="number" class="cust-w-v" placeholder="倍率" step="0.1" style="width:60px; margin:0;" onchange="window.updateWallSelects()">
            <button onclick="this.parentElement.remove(); window.updateWallSelects();" style="border:none; background:none; cursor:pointer;">❌</button>
        `;
        container.appendChild(div);
        window.updateWallSelects();
    },

    /**
     * Add a custom hardware specification row to the UI
     */
    addCustomHwRow: function() {
        console.log(`➕ [${window.APP_VERSION}] Adding custom hardware row...`);
        const container = document.getElementById('custom-hw-container');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'calc-row cust-hw-row';
        div.style.marginBottom = '5px';
        div.innerHTML = `
            <input type="text" class="cust-h-n" placeholder="記号" style="width:130px; margin:0;" onchange="window.updateWallSelects()">
            <input type="number" class="cust-h-v" placeholder="耐力(kN)" step="0.1" style="width:60px; margin:0;" onchange="window.updateWallSelects()">
            <button onclick="this.parentElement.remove(); window.updateWallSelects();" style="border:none; background:none; cursor:pointer;">❌</button>
        `;
        container.appendChild(div);
        window.updateWallSelects();
    },

    /**
     * 壁仕様設定モーダルを開く
     */
    openWallSettingsModal: function() {
        const m = document.getElementById('modal-wall-settings');
        if (!m) return;
        
        // メインの設定値をモーダルへ同期
        const p1 = document.getElementById('wall-p1');
        const p2 = document.getElementById('wall-p2');
        const b = document.getElementById('wall-b');
        
        const m1 = document.getElementById('wall-p1-modal');
        const m2 = document.getElementById('wall-p2-modal');
        const mb = document.getElementById('wall-b-modal');
        
        if (m1 && p1) m1.value = p1.value;
        if (m2 && p2) m2.value = p2.value;
        if (mb && b) mb.value = b.value;
        
        this.updateModalWallTotal();
        m.style.display = 'flex';
    },

    /**
     * モーダル内の合計倍率表示を更新
     */
    updateModalWallTotal: function() {
        if (!window.WallEngine) return;
        const m1 = document.getElementById('wall-p1-modal');
        const m2 = document.getElementById('wall-p2-modal');
        const mb = document.getElementById('wall-b-modal');
        
        const v1 = window.WallEngine.getWallSpec(m1?.value).val || 0;
        const v2 = window.WallEngine.getWallSpec(m2?.value).val || 0;
        const vb = (window.WallEngine.getBraceSpec ? window.WallEngine.getBraceSpec(mb?.value).val : 0) || 0;
        
        const total = v1 + v2 + vb;
        const display = document.getElementById('total-val-modal');
        if (display) {
            display.innerText = total.toFixed(1);
            display.style.color = (total > 7.0) ? "red" : "#27ae60";
        }
    },

    /**
     * モーダルでの設定をメイン画面へ適用
     */
    applyWallSettingsFromModal: function() {
        const p1 = document.getElementById('wall-p1');
        const p2 = document.getElementById('wall-p2');
        const b = document.getElementById('wall-b');
        
        const m1 = document.getElementById('wall-p1-modal');
        const m2 = document.getElementById('wall-p2-modal');
        const mb = document.getElementById('wall-b-modal');
        
        if (p1 && m1) p1.value = m1.value;
        if (p2 && m2) p2.value = m2.value;
        if (b && mb) b.value = mb.value;
        
        this.updateWallSpecSummary();
        document.getElementById('modal-wall-settings').style.display = 'none';
        
        if (window.AppController) window.AppController.refreshAll();
    },

    /**
     * 右パネルの仕様概要表示を更新
     */
    updateWallSpecSummary: function() {
        const p1 = document.getElementById('wall-p1-modal');
        const p2 = document.getElementById('wall-p2-modal');
        const b = document.getElementById('wall-b-modal');
        
        const summary = document.getElementById('wall-spec-summary');
        if (summary && p1 && p2 && b) {
            const n1 = p1.options[p1.selectedIndex]?.text.split(' ')[0] || 'なし';
            const n2 = p2.options[p2.selectedIndex]?.text.split(' ')[0] || 'なし';
            const nb = b.options[b.selectedIndex]?.text.split(' ')[0] || 'なし';
            summary.innerHTML = `面材1: ${n1} / 面材2: ${n2}<br>筋交: ${nb}`;
        }
        
        // 面積設定のラベル同期
        const areaType = document.getElementById('area-type-select');
        const areaLabel = document.getElementById('current-area-type-label');
        if (areaType && areaLabel) {
            areaLabel.innerText = areaType.options[areaType.selectedIndex]?.text || '床面積 (通常)';
        }

        const calcMode = document.getElementById('area-calc-sub-select');
        const calcLabel = document.getElementById('current-area-calc-mode-label');
        if (calcMode && calcLabel) {
            calcLabel.innerText = calcMode.options[calcMode.selectedIndex]?.text || '左パネル連動';
        }
    }
};

// モーダル内での変更監視用グローバル関数
window.syncWallModalToMain = function() {
    if (window.UIView) window.UIView.updateModalWallTotal();
};
