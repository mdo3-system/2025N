/**
 * UIFoundationPopup.js
 * 基礎要素（基礎梁、スラブ、人通口など）のプロパティポップアップを管理するモジュール
 */

import { AppState } from '../state/AppState.js';
import { getFoundationSlabReportHtml } from './FoundationView.js';

let lastPopupMx = 0;
let lastPopupMy = 0;

/**
 * 基礎要素プロパティポップアップの表示
 * @param {string} type - 'beam', 'slab', 'manhole', 'ext_wall', 'beam_span'
 * @param {Object} item - 対象要素オブジェクト
 * @param {number} mx - マウスX座標
 * @param {number} my - マウスY座標
 */
export function showFdPropertyPopup(type, item, mx, my) {
    if (mx !== undefined) lastPopupMx = mx;
    if (my !== undefined) lastPopupMy = my;

    // 前回の選択を継承するガード（引数なし呼び出し対応）
    if (!type && !item) {
        type = AppState.fdSelection.type;
        item = AppState.fdSelection.item;
    }
    if (!type || !item) return;

    AppState.fdSelection = { type, item };
    const popup = document.getElementById('fd-property-popup');
    const title = document.getElementById('fd-popup-title');
    const content = document.getElementById('fd-popup-content');
    if (!popup || !title || !content) return;

    // ポップアップ位置の設定（クランプ処理）
    let px = lastPopupMx + 20;
    let py = lastPopupMy + 20;
    const popW = 320, popH = 450;
    if (px + popW > window.innerWidth) px = window.innerWidth - popW - 20;
    if (py + popH > window.innerHeight) py = window.innerHeight - popH - 20;
    if (px < 10) px = 10;
    if (py < 10) py = 10;

    popup.style.left = px + 'px';
    popup.style.top = py + 'px';
    popup.style.display = 'block';

    // ドラッグ移動の初期化
    setupPopupDrag(popup);

    // コンテンツ生成
    let html = '';
    if (type === 'beam' || type === 'beam_span') {
        html = generateBeamPopupContent(type, item);
    } else if (type === 'slab') {
        html = generateSlabPopupContent(item);
    } else if (type === 'ext_wall') {
        html = generateExtWallPopupContent(item);
    } else if (type === 'manhole') {
        html = generateManholePopupContent(item);
    }

    content.innerHTML = html;
    
    // 描画トリガー (window.draw が存在する場合)
    if (typeof window.draw === 'function') requestAnimationFrame(window.draw);
}

/**
 * ポップアップを閉じる
 */
export function hideFdPropertyPopup() {
    AppState.fdSelection = { type: null, item: null };
    const popup = document.getElementById('fd-property-popup');
    if (popup) popup.style.display = 'none';
    if (typeof window.draw === 'function') requestAnimationFrame(window.draw);
}

/**
 * ドラッグ移動のセットアップ
 */
function setupPopupDrag(popup) {
    const header = document.getElementById('fd-popup-header');
    if (header && !header.dataset.dragInit) {
        let isDragging = false, startX, startY, initX, initY;
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            initX = parseInt(popup.style.left, 10) || 0;
            initY = parseInt(popup.style.top, 10) || 0;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let nx = initX + (e.clientX - startX);
            let ny = initY + (e.clientY - startY);
            if (nx < 0) nx = 0;
            if (ny < 0) ny = 0;
            if (nx + popup.offsetWidth > window.innerWidth) nx = window.innerWidth - popup.offsetWidth;
            if (ny + popup.offsetHeight > window.innerHeight) ny = window.innerHeight - popup.offsetHeight;
            popup.style.left = nx + 'px';
            popup.style.top = ny + 'px';
        });
        document.addEventListener('mouseup', () => { isDragging = false; });
        header.dataset.dragInit = 'true';
    }
}

/**
 * 基礎梁ポップアップコンテンツ
 */
function generateBeamPopupContent(type, beam) {
    // 梁の通り芯名の特定
    let axisName = "";
    const span0 = beam.spans && beam.spans[0];
    if (span0) {
        const dx = Math.abs(span0.startNode.x - span0.endNode.x);
        const dy = Math.abs(span0.startNode.y - span0.endNode.y);
        if (dx > dy) {
            const idx = AppState.gridYCoords.findIndex(y => Math.abs(y - span0.startNode.y) < 10);
            axisName = idx >= 0 ? `${AppState.gridYNames[idx]}通り` : "水平梁";
        } else {
            const idx = AppState.gridXCoords.findIndex(x => Math.abs(x - span0.startNode.x) < 10);
            axisName = idx >= 0 ? `${AppState.gridXNames[idx]}通り` : "垂直梁";
        }
    }

    const titleText = (type === 'beam') ? `🏗 基礎梁 一括プロパティ (${axisName})` : `🏗 基礎梁スパン プロパティ`;
    
    let tableHtml = `
        <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:5px;">
            <thead>
                <tr style="background:#f2f2f2; border-bottom:1px solid #ddd;">
                    <th style="padding:4px; text-align:left;">No. / 長さ</th>
                    <th style="padding:4px; text-align:left;">幅/成/配筋</th>
                    <th style="padding:4px; text-align:center;">判定</th>
                </tr>
            </thead>
            <tbody>
    `;

    (beam.spans || []).forEach((span, idx) => {
        const p = span.props || beam.props;
        const badge = span.isNG ? '<span style="color:#e74c3c; font-weight:bold;">NG</span>' : '<span style="color:#27ae60; font-weight:bold;">OK</span>';
        const sLen = span.spanLength ? Math.round(span.spanLength) : '-';

        tableHtml += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:8px 4px; vertical-align:top;">
                    <div style="font-weight:bold; color:#e67e22;">スパン${idx+1}</div>
                    <div style="color:#666;">${sLen}mm</div>
                </td>
                <td style="padding:8px 4px;">
                    <div style="display:flex; gap:5px; margin-bottom:4px;">
                        <input type="number" value="${p.width}" onchange="updateFdItemProp('beam', ${beam.id}, 'width', this.value, ${idx})" style="width:45px; font-size:10px;">
                        ×
                        <input type="number" value="${p.height}" onchange="updateFdItemProp('beam', ${beam.id}, 'height', this.value, ${idx})" style="width:45px; font-size:10px;">
                    </div>
                    <div style="margin-bottom:2px;"><input type="text" value="${p.topRebar}" onchange="updateFdItemProp('beam', ${beam.id}, 'topRebar', this.value, ${idx})" style="width:100px; font-size:10px;" placeholder="上端筋"></div>
                    <div style="margin-bottom:2px;"><input type="text" value="${p.bottomRebar}" onchange="updateFdItemProp('beam', ${beam.id}, 'bottomRebar', this.value, ${idx})" style="width:100px; font-size:10px;" placeholder="下端筋"></div>
                    <div><input type="text" value="${p.stirrup}" onchange="updateFdItemProp('beam', ${beam.id}, 'stirrup', this.value, ${idx})" style="width:100px; font-size:10px;" placeholder="あばら筋"></div>
                </td>
                <td style="padding:8px 4px; text-align:center; vertical-align:middle;">
                    ${badge}
                </td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table>`;
    
    return `
        <div class="calc-box" style="padding:10px; max-height:450px; overflow-y:auto;">
            <div style="background:#fff3cd; color:#856404; padding:6px; font-size:10px; border-radius:3px; margin-bottom:10px;">
                ※ 変更内容は全ての計算に即時反映されます。
            </div>
            ${tableHtml}
            <button onclick='showFoundationBeamReportModal(${JSON.stringify(beam)})' style="width:100%; margin-top:12px; padding:8px; background:#2980b9; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;">
                📊 通り別 計算書プレビュー
            </button>
        </div>
    `;
}

/**
 * スラブポップアップコンテンツ
 */
function generateSlabPopupContent(item) {
    const p = item.props || {};
    const supportOpts = [
        '4辺固定', '3辺固定1辺ピン（長辺ピン）', '3辺固定1辺ピン（短辺ピン）',
        '2隣辺固定2隣辺ピン', '長辺2辺固定短辺2辺ピン', '短辺2辺固定長辺2辺ピン',
        '1辺固定3辺ピン（長辺固定）', '1辺固定3辺ピン（短辺固定）', '4辺ピン', '片持ち'
    ];
    const typeOpts = ['D10', 'D10/D13', 'D13', 'D16', 'D13/D16'];
    const pitchOpts = [75, 100, 150, 200, 300];

    const row = (label, html, id = '') => `<div class="calc-row" ${id ? `id="${id}"` : ''} style="display:flex; align-items:center; margin-bottom:5px;"><label style="font-size:11px;width:100px;">${label}</label>${html}</div>`;
    const sel = (key, current, opts, path = '') => {
        const pathStr = path ? `${path}.${key}` : key;
        return `<select onchange="updateFdItemProp('slab', ${item.id}, '${pathStr}', this.value)" style="flex:1; padding:2px; font-size:11px;">
            ${opts.map(o => `<option value="${o}" ${o == current ? 'selected' : ''}>${o}</option>`).join('')}
        </select>`;
    };

    return `<div class="calc-box" style="padding:10px;">
        <div style="font-size:11px; margin-bottom:10px; font-weight:bold; color:#8e44ad; border-bottom:1px solid #ddd; padding-bottom:5px;">■ 設計情報</div>
        ${row('スラブ名', `<input type="text" value="${p.name || 'S1'}" onchange="updateFdItemProp('slab', ${item.id}, 'name', this.value)" style="flex:1;">`)}
        ${row('支持条件', sel('support', p.support || '4辺固定', supportOpts))}
        
        <div id="row-cantilever-length" style="display: ${p.support === '片持ち' ? 'flex' : 'none'}; align-items:center; margin-bottom:5px;">
            <label style="font-size:11px; width:100px;">片持ち長さ L (m)</label>
            <input type="number" step="0.1" value="${p.cantileverLength || 0.9}" onchange="updateFdItemProp('slab', ${item.id}, 'cantileverLength', this.value)" style="width:60px;">
        </div>

        ${row('板厚 D (mm)', `<input type="number" value="${p.slabThickness || 150}" onchange="updateFdItemProp('slab', ${item.id}, 'slabThickness', this.value)" style="width:60px;">`)}
        ${row('天端高 (mm)', `<input type="number" value="${p.slabTopHeight || 50}" onchange="updateFdItemProp('slab', ${item.id}, 'slabTopHeight', this.value)" style="width:60px;">`)}
        ${row('かぶり dt (mm)', `<input type="number" value="${p.coverDepth || 70}" onchange="updateFdItemProp('slab', ${item.id}, 'coverDepth', this.value)" style="width:60px;">`)}

        <div style="font-size:11px; margin:10px 0 5px 0; font-weight:bold; color:#8e44ad; border-bottom:1px solid #ddd; padding-bottom:5px;">■ 短辺方向 配筋</div>
        ${row('種別', sel('type', p.rebarShort?.type || 'D13', typeOpts, 'rebarShort'))}
        ${row('ピッチ (@)', sel('pitch', p.rebarShort?.pitch || 200, pitchOpts, 'rebarShort'))}
        <div style="text-align:right; font-size:11px; color:#2c3e50; font-weight:bold; margin-top:2px;">at = <span id="popup-at-short">${(p.rebarShort?.at || 0).toFixed(1)}</span> mm²/m</div>

        <div style="font-size:11px; margin:10px 0 5px 0; font-weight:bold; color:#8e44ad; border-bottom:1px solid #ddd; padding-bottom:5px;">■ 長辺方向 配筋</div>
        ${row('種別', sel('type', p.rebarLong?.type || 'D13', typeOpts, 'rebarLong'))}
        ${row('ピッチ (@)', sel('pitch', p.rebarLong?.pitch || 200, pitchOpts, 'rebarLong'))}
        <div style="text-align:right; font-size:11px; color:#2c3e50; font-weight:bold; margin-top:2px;">at = <span id="popup-at-long">${(p.rebarLong?.at || 0).toFixed(1)}</span> mm²/m</div>

        <div id="slab-calc-result-container" style="margin-top:10px;">
            ${getFoundationSlabReportHtml(item)}
        </div>
    </div>`;
}

/**
 * 外壁ポップアップ
 */
function generateExtWallPopupContent(item) {
    return `<div class="calc-box">
        <div style="font-size:12px; margin-bottom:10px;">ID: ${item.id} (階: ${item.floor})</div>
        <p style="font-size:11px; color:#666;">外壁線は多角形範囲として荷重算出に使用されます。</p>
    </div>`;
}

/**
 * 人通口ポップアップ
 */
function generateManholePopupContent(item) {
    return `<div class="calc-box">
        <div class="calc-row" style="display:flex; align-items:center;"><label style="font-size:11px; width:100px;">開口幅(mm)</label>
        <input type="number" value="${item.width}" onchange="updateFdItemProp('manhole', ${item.id}, 'width', this.value)" style="width:60px;"></div>
    </div>`;
}
