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

    // 読み込まれた全要素からレイヤー名を動的抽出
    const foundLayers = new Set(Object.keys(state.layerVisibility));
    if (state.bgLinesOriginal) state.bgLinesOriginal.forEach(l => { if (l.layer) foundLayers.add(l.layer); });
    if (state.bgTextsOriginal) state.bgTextsOriginal.forEach(t => { if (t.layer) foundLayers.add(t.layer); });
    if (state.pillars) state.pillars.forEach(p => { if (p.layer) foundLayers.add(p.layer); });

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
