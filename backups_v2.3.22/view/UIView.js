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
     * Update the layer visibility panel
     */
    renderLayerPanel: function(layerVisibility, onChange) {
        const container = document.getElementById('dxf-layer-list');
        if (!container) return;
        container.innerHTML = '';
        
        Object.keys(layerVisibility).sort().forEach(layer => {
            const div = document.createElement('div');
            div.className = 'layer-item';
            div.innerHTML = `
                <label>
                    <input type="checkbox" ${layerVisibility[layer] ? 'checked' : ''}>
                    ${layer}
                </label>
            `;
            div.querySelector('input').addEventListener('change', (e) => {
                onChange(layer, e.target.checked);
            });
            container.appendChild(div);
        });
    }
};
