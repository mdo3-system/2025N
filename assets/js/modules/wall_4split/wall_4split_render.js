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
    // 既存のズームフィットロジック（そのまま維持、または将来的に MainRenderer へ移動）
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const accumVtx = (ent) => {
        if (ent.vertices) ent.vertices.forEach(v => { if (v.x != null && !isNaN(v.x)) { if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x; if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y; } });
        else if (ent.type === 'CIRCLE' || ent.type === 'ARC') { if (ent.center.x - ent.radius < minX) minX = ent.center.x - ent.radius; if (ent.center.x + ent.radius > maxX) maxX = ent.center.x + ent.radius; if (ent.center.y - ent.radius < minY) minY = ent.center.y - ent.radius; if (ent.center.y + ent.radius > maxY) maxY = ent.center.y + ent.radius; }
    };

    pillars.filter(p => p.floor === currentFloor && !p.isDeleted).forEach(p => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });

    if (minX === Infinity) {
        bgLinesOriginal.filter(e => e.floor === currentFloor).forEach(accumVtx);
        areaLines.filter(e => e.floor === currentFloor).forEach(accumVtx);
    }
    if (minX === Infinity) { bgLinesOriginal.filter(e => e.floor === 'ALL').forEach(accumVtx); }
    if (minX === Infinity) { minX = 0; minY = 0; maxX = 1000; maxY = 1000; }

    let cx = (minX + maxX) / 2;
    let cy = (minY + maxY) / 2;
    let dx = maxX - minX; if (dx <= 0) dx = 1000;
    let dy = maxY - minY; if (dy <= 0) dy = 1000;

    dx *= 1.2; dy *= 1.2;
    minX = cx - dx / 2;
    minY = cy - dy / 2;

    const activeCanvas = window.AppState.canvas || document.getElementById('cad-canvas');
    let cw = activeCanvas ? activeCanvas.width : 800;
    let ch = activeCanvas ? activeCanvas.height : 600;
    scale = Math.min((cw - 100) / dx, (ch - 100) / dy) || 1;
    offsetX = -minX * scale + (cw - dx * scale) / 2;
    offsetY = -minY * scale + (ch - dy * scale) / 2;

    // AppState への同期
    window.AppState.scale = scale;
    window.AppState.offsetX = offsetX;
    window.AppState.offsetY = offsetY;

    pillars.forEach(p => { p.isCornerAuto = (Math.abs(p.x - minX) < 100 || Math.abs(p.x - maxX) < 100) && (Math.abs(p.y - minY) < 100 || Math.abs(p.y - maxY) < 100); });
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
