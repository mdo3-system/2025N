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
 * 「🎨 DXFレイヤ表示設定」モーダルパネルの動的描画
 */
window.renderLayerPanel = function() {
    let panel = document.getElementById('dxf-layer-panel');
    let listContainer = document.getElementById('layer-list-container');
    
    // パネル要素がない場合は #cad-container に作成
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

    let html = '<div style="display:flex; flex-direction:column; gap:6px; max-height:300px; overflow-y:auto; font-size:12px;">';

    categories.forEach(cat => {
        const checked = s.layerVisibility[cat.id] !== false ? 'checked' : '';
        html += `
            <label style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:#f8f9fa; border-left:4px solid ${cat.color}; border-radius:4px; color:#2c3e50; font-size:12px; cursor:pointer;">
                <input type="checkbox" class="dxf-layer-toggle-cb" data-layer="${cat.id}" ${checked} style="width:15px; height:15px; cursor:pointer;">
                <span style="font-weight:bold;">${cat.name}</span>
            </label>
        `;
    });

    customLayers.forEach(lName => {
        const checked = s.layerVisibility[lName] !== false ? 'checked' : '';
        html += `
            <label style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:#ffffff; border:1px solid #e1e8ed; border-left:4px solid #95a5a6; border-radius:4px; color:#34495e; font-size:11px; cursor:pointer;">
                <input type="checkbox" class="dxf-layer-toggle-cb" data-layer="${lName}" ${checked} style="width:15px; height:15px; cursor:pointer;">
                <span>🎨 DXF元レイヤ: <strong>${lName}</strong></span>
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
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:6px; margin-bottom:8px;">
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
