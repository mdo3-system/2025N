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
                box-shadow: 0 4px 15px rgba(0,0,0,0.2); width: 280px; padding: 12px;
            `;
            container.appendChild(panel);
        }
    }

    const s = window.AppState || {};
    if (!s.layerVisibility) s.layerVisibility = {};

    const categories = [
        { id: 'GRID', name: '📐 通り芯・グリッド', color: '#00d2d3' },
        { id: '1F_BACK', name: '🖼️ 1階背景', color: '#1dd1a1' },
        { id: '2F_BACK', name: '🖼️ 2階背景', color: '#54a0ff' },
        { id: '1F_ROOF', name: '🏠 1階屋根', color: '#feca57' },
        { id: '2F_ROOF', name: '🏠 2階屋根', color: '#ff6b6b' },
    ];

    let html = '<div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">';

    categories.forEach(cat => {
        const checked = s.layerVisibility[cat.id] !== false ? 'checked' : '';
        html += `
            <label style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:#f8f9fa; border-left:4px solid ${cat.color}; border-radius:4px; color:#2c3e50; font-size:12px; cursor:pointer; user-select:none;">
                <input type="checkbox" class="dxf-layer-toggle-cb" data-layer="${cat.id}" ${checked} style="width:16px; height:16px; cursor:pointer;">
                <span style="font-weight:bold;">${cat.name}</span>
            </label>
        `;
    });

    html += '</div>';

    const modalContainer = document.getElementById('dxf-layer-toggle-container');
    if (modalContainer) modalContainer.innerHTML = html;

    if (listContainer) {
        listContainer.innerHTML = html;
    } else if (panel) {
        let fullHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:6px; margin-bottom:10px;">
                <span style="font-weight:bold; font-size:13px; color:#0056b3;">🎨 DXFレイヤ表示設定</span>
                <button onclick="document.getElementById('dxf-layer-panel').style.display='none'" style="background:none; border:none; font-size:14px; cursor:pointer; color:#666;">✖</button>
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
                }
            };
        });
    };

    bindEvents(modalContainer);
    bindEvents(listContainer);
    bindEvents(panel);
};
