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




/**
 * 「🎨 DXFレイヤ表示設定」パネルの動的描画 (基本5カテゴリ限定)
 */
window.renderLayerPanel = function() {
    let panel = document.getElementById('dxf-layer-panel');
    let listContainer = document.getElementById('layer-list-container');
    
    if (!panel) {
        const container = document.getElementById('cad-container');
        if (container) {
            panel = document.createElement('div');
            panel.id = 'dxf-layer-panel';
            panel.style.cssText = `
                position: absolute; top: 45px; right: 20px; z-index: 4000;
                background: #ffffff; border: 1px solid #0056b3; border-radius: 6px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2); width: 300px; padding: 12px;
                max-height: 80vh; overflow-y: auto;
            `;
            container.appendChild(panel);
        }
    }

    const s = window.AppState || {};
    if (!s.layerVisibility) s.layerVisibility = {};

    // 1. 基本標準カテゴリ
    const categories = [
        { id: 'GRID', name: '📐 通り芯・グリッド', color: '#00d2d3' },
        { id: '1F_BACK', name: '🖼️ 1階背景', color: '#1dd1a1' },
        { id: '2F_BACK', name: '🖼️ 2階背景', color: '#54a0ff' },
        { id: '1F_ROOF', name: '🏠 1階屋根', color: '#feca57' },
        { id: '2F_ROOF', name: '🏠 2階屋根', color: '#ff6b6b' },
    ];

    const standardIds = new Set(categories.map(c => c.id));

    // 2. 実在する追加DXFレイヤーを収集
    const extraLayers = new Set(Object.keys(s.layerVisibility).filter(k => !standardIds.has(k)));
    (s.bgLinesOriginal || []).forEach(l => { if (l.layer && !standardIds.has(l.layer)) extraLayers.add(l.layer); });
    (s.bgTextsOriginal || []).forEach(t => { if (t.layer && !standardIds.has(t.layer)) extraLayers.add(t.layer); });

    let html = '<div style="display:flex; flex-direction:column; gap:6px; font-size:12px;">';

    // 標準カテゴリのHTML生成
    categories.forEach(cat => {
        const checked = s.layerVisibility[cat.id] !== false ? 'checked' : '';
        html += `
            <label style="display:flex; align-items:center; gap:10px; padding:6px 10px; background:#f8f9fa; border-left:4px solid ${cat.color}; border-radius:4px; color:#2c3e50; font-size:12px; cursor:pointer; user-select:none;">
                <input type="checkbox" class="dxf-layer-toggle-cb" data-layer="${cat.id}" ${checked} style="width:16px; height:16px; cursor:pointer;">
                <span style="font-weight:bold;">${cat.name}</span>
            </label>
        `;
    });

    // 追加DXF個別レイヤーのHTML生成
    if (extraLayers.size > 0) {
        html += '<div style="margin-top:8px; padding-top:6px; border-top:1px solid #eee; font-weight:bold; color:#555;">📁 DXF個別レイヤー:</div>';
        extraLayers.forEach(layerName => {
            const checked = s.layerVisibility[layerName] !== false ? 'checked' : '';
            html += `
                <label style="display:flex; align-items:center; gap:10px; padding:4px 8px; background:#fafafa; border-left:3px solid #b2bec3; border-radius:3px; color:#333; font-size:11px; cursor:pointer; user-select:none;">
                    <input type="checkbox" class="dxf-layer-toggle-cb" data-layer="${layerName}" ${checked} style="width:14px; height:14px; cursor:pointer;">
                    <span>${layerName}</span>
                </label>
            `;
        });
    }

    html += '</div>';

    const modalContainer = document.getElementById('dxf-layer-toggle-container');
    if (modalContainer) modalContainer.innerHTML = html;

    if (listContainer) {
        listContainer.innerHTML = html;
    } else if (panel) {
        let fullHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:6px; margin-bottom:10px;">
                <span style="font-weight:bold; font-size:13px; color:#0056b3;">🎨 DXFレイヤ表示設定</span>
                <button onclick="document.getElementById('dxf-layer-panel').style.display='none'" style="background:none; border:none; font-size:16px; cursor:pointer; color:#666; font-weight:bold;">✕</button>
            </div>
            <div id="layer-list-container">${html}</div>
        `;
        panel.innerHTML = fullHtml;
    }

    const bindEvents = (el) => {
        if (!el) return;
        el.querySelectorAll('.dxf-layer-toggle-cb').forEach(cb => {
            cb.onchange = (e) => {
                const layerKey = e.target.getAttribute('data-layer');
                s.layerVisibility[layerKey] = e.target.checked;
                if (window.AppController && window.AppController.refreshAll) {
                    window.AppController.refreshAll();
                } else if (typeof window.draw === 'function') {
                    window.draw();
                }
            };
        });
    };

    bindEvents(modalContainer);
    bindEvents(listContainer);
    bindEvents(panel);
};
