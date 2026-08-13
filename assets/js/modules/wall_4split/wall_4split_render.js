/**
 * wall_4split_render.js - 描画エントリーポイント (Legacy Bridge)
 * v2.3.15 リファクタリング
 */

function draw() {
    if (window.MainRenderer) {
        window.MainRenderer.render(window.AppState);
    }
}

function resizeCanvas() {
    const canvas = window.AppState.canvas || document.getElementById('cad-canvas');
    if (!canvas) return;
    const container = document.getElementById('cad-container');
    if (container) { 
        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        // AppState に反映 (論理的なサイズを保持)
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
    }
}

function initViewForce() {
    // [v3.5.7] 視点初期化・ズームフィット処理を AppController.zoomFit に統一
    if (window.AppController && typeof window.AppController.zoomFit === 'function') {
        window.AppController.zoomFit();
    }
}

function renderLayerPanel() {
    let container = document.getElementById('cad-container');
    if (!container) return;
    let panel = document.getElementById('dxf-layer-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'dxf-layer-panel';
        panel.style.cssText = `
            position: absolute; top: 10px; right: 10px; width: 220px; max-height: 80%;
            background: rgba(255,255,255,0.95); border: 1px solid #0056b3; border-radius: 8px;
            padding: 10px; overflow-y: auto; z-index: 1000; font-family: sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-size: 11px;
        `;
        container.appendChild(panel);
    }

    const state = window.AppState || {};
    if (!state.layerVisibility) state.layerVisibility = {};

    // 読み込まれた全要素からレイヤー名および originalLayer 名を網羅抽出
    const foundLayers = new Set(Object.keys(state.layerVisibility));
    if (state.bgLinesOriginal) state.bgLinesOriginal.forEach(l => { 
        if (l.layer) foundLayers.add(l.layer); 
        if (l.originalLayer) foundLayers.add(l.originalLayer);
    });
    if (state.bgTextsOriginal) state.bgTextsOriginal.forEach(t => { 
        if (t.layer) foundLayers.add(t.layer); 
        if (t.originalLayer) foundLayers.add(t.originalLayer);
    });
    if (state.pillars) state.pillars.forEach(p => { 
        if (p.layer) foundLayers.add(p.layer); 
        if (p.originalLayer) foundLayers.add(p.originalLayer);
    });

    let layers = Array.from(foundLayers).sort();
    if (layers.length === 0) {
        panel.innerHTML = `<div style="font-weight:bold; margin-bottom:6px; color:#555;">🎨 DXFレイヤ表示設定</div><div style="color:#888;">DXF図面が読み込まれていません</div>`;
        panel.style.display = 'block';
        return;
    }

    // デフォルト全有効化
    layers.forEach(ln => {
        if (state.layerVisibility[ln] === undefined) state.layerVisibility[ln] = true;
    });

    panel.style.display = 'block';

    let html = `<div style="font-weight:bold; margin-bottom:8px; border-bottom:2px solid #0056b3; padding-bottom:4px; display:flex; justify-content:space-between; align-items:center; color:#0056b3;">
        <span>🎨 DXFレイヤ表示設定 (${layers.length})</span>
        <button onclick="document.getElementById('dxf-layer-panel').style.display='none'" style="border:none; background:none; cursor:pointer; font-size:16px; font-weight:bold; color:#e74c3c;">×</button>
    </div>`;

    layers.forEach(ln => {
        let checked = state.layerVisibility[ln] !== false ? 'checked' : '';
        html += `<label style="display:flex; align-items:center; margin-bottom:4px; cursor:pointer; font-weight:normal; color:#333; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            <input type="checkbox" data-layer="${ln}" ${checked} style="margin-right:6px;">
            ${ln}
        </label>`;
    });

    panel.innerHTML = html;

    if (!panel.dataset.listener) {
        panel.addEventListener('change', (e) => {
            const cb = e.target.closest('input[type="checkbox"]');
            if (!cb) return;
            const ln = cb.getAttribute('data-layer');
            state.layerVisibility[ln] = cb.checked;
            if (typeof appLayerVisibility !== 'undefined') appLayerVisibility[ln] = cb.checked;
            if (window.AppController) window.AppController.refreshAll();
            else draw();
        });
        panel.dataset.listener = "true";
    }
}


/**
 * 「🎨 DXFレイヤ表示設定」モーダルパネルの動的描画
 */
window.renderLayerPanel = function() {
    const container = document.getElementById('dxf-layer-toggle-container') || document.getElementById('layer-list-container');
    const container2 = document.getElementById('layer-list-container');

    const s = window.AppState;
    if (!s.layerVisibility) s.layerVisibility = {};

    const categories = [
        { id: 'GRID', name: '📐 通り芯 (GRID)', color: '#00d2d3' },
        { id: '1F_BACK', name: '🖼️ 1階背景 (1F_BACK)', color: '#1dd1a1' },
        { id: '2F_BACK', name: '🖼️ 2階背景 (2F_BACK)', color: '#54a0ff' },
        { id: '1F_ROOF', name: '🏠 1階屋根 (1F_ROOF)', color: '#feca57' },
        { id: '2F_ROOF', name: '🏠 2階屋根 (2F_ROOF)', color: '#ff6b6b' },
    ];

    // DXF内に存在するユニークなオリジナルレイヤー名を網羅抽出
    const customLayers = new Set();
    (s.bgLinesOriginal || []).forEach(l => {
        if (l.originalLayer && !['GRID','1F_BACK','2F_BACK','1F_ROOF','2F_ROOF'].includes(l.originalLayer)) {
            customLayers.add(l.originalLayer);
        } else if (l.layer && !['GRID','1F_BACK','2F_BACK','1F_ROOF','2F_ROOF'].includes(l.layer)) {
            customLayers.add(l.layer);
        }
    });

    let html = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:10px; padding:10px;">';

    categories.forEach(cat => {
        const checked = s.layerVisibility[cat.id] !== false ? 'checked' : '';
        html += `
            <label style="display:flex; align-items:center; gap:8px; padding:8px 12px; background:#1e272e; border-left:4px solid ${cat.color}; border-radius:4px; color:#fff; font-size:13px; cursor:pointer;">
                <input type="checkbox" class="dxf-layer-toggle-cb" data-layer="${cat.id}" ${checked} style="width:16px; height:16px; cursor:pointer;">
                <span style="font-weight:bold;">${cat.name}</span>
            </label>
        `;
    });

    customLayers.forEach(lName => {
        const checked = s.layerVisibility[lName] !== false ? 'checked' : '';
        html += `
            <label style="display:flex; align-items:center; gap:8px; padding:8px 12px; background:#2c3e50; border-left:4px solid #a4b0be; border-radius:4px; color:#ecf0f1; font-size:12px; cursor:pointer;">
                <input type="checkbox" class="dxf-layer-toggle-cb" data-layer="${lName}" ${checked} style="width:16px; height:16px; cursor:pointer;">
                <span>🎨 DXF元レイヤ: <strong>${lName}</strong></span>
            </label>
        `;
    });

    html += '</div>';
    if (container) container.innerHTML = html;
    if (container2 && container2 !== container) container2.innerHTML = html;

    const bindCBs = (targetEl) => {
        if (!targetEl) return;
        targetEl.querySelectorAll('.dxf-layer-toggle-cb').forEach(cb => {
            cb.onchange = (e) => {
                const layerKey = e.target.getAttribute('data-layer');
                s.layerVisibility[layerKey] = e.target.checked;
                if (window.AppController && window.AppController.refreshAll) {
                    window.AppController.refreshAll();
                }
            };
        });
    };
    bindCBs(container);
    bindCBs(container2);
};
