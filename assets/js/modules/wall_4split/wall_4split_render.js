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
    let panel = document.getElementById('dxf-layer-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'dxf-layer-panel';
        panel.style.cssText = `
            position: absolute; top: 10px; right: 10px; width: 200px; max-height: 80%;
            background: rgba(255,255,255,0.9); border: 1px solid #ccc; border-radius: 8px;
            padding: 10px; overflow-y: auto; z-index: 1000; font-family: sans-serif;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2); font-size: 11px;
        `;
        document.getElementById('cad-container').appendChild(panel);
    }

    let layers = Object.keys(appLayerVisibility).sort();
    if (layers.length === 0) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'block';

    let html = `<div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #ddd; padding-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
        <span>DXFレイヤ表示設定</span>
        <button onclick="this.parentElement.parentElement.style.display='none'" style="border:none; background:none; cursor:pointer; font-size:14px;">×</button>
    </div>`;

    layers.forEach(ln => {
        let checked = appLayerVisibility[ln] ? 'checked' : '';
        html += `<label style="display:flex; align-items:center; margin-bottom:4px; cursor:pointer; font-weight:normal; color:#333;">
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
            appLayerVisibility[ln] = cb.checked;
            draw();
        });
        panel.dataset.listener = "true";
    }
}
