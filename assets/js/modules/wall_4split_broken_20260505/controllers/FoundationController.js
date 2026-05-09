/**
 * FoundationController.js
 * 基礎モードにおけるマウス操作、部材入力、削除、スナップ制御を行う
 */

import { AppState } from '../state/AppState.js';
import { setupStateBridge } from '../state/AppState.js';
import { showFdPropertyPopup, hideFdPropertyPopup } from '../view/UIFoundationPopup.js';
import { calculateSlabAt } from '../logic/Parsers.js';
import { getFoundationSlabReportHtml } from '../view/FoundationView.js';

/**
 * 基礎用グリッドスナップ（基礎梁端点・グリッド交点）
 */
export function getFdSnapPoint(mx, my) {
    const scale = AppState.scale;
    const offsetX = AppState.offsetX;
    const offsetY = AppState.offsetY;
    const canvas = AppState.canvas;

    const toW = (cx, cy) => ({ x: (cx - offsetX) / scale, y: (canvas.height - cy - offsetY) / scale });
    let snapRadius = 20 / scale;
    let best = null, bestD = snapRadius; 
    const wp = toW(mx, my);

    // グリッド交点
    AppState.gridXCoords.forEach(gx => {
        AppState.gridYCoords.forEach(gy => {
            const d = Math.hypot(wp.x - gx, wp.y - gy);
            if (d < bestD) { bestD = d; best = { x: gx, y: gy }; }
        });
    });
    // 基礎梁端点
    AppState.foundationBeams.forEach(b => {
        [b.p1, b.p2].forEach(p => {
            const d = Math.hypot(wp.x - p.x, wp.y - p.y);
            if (d < bestD) { bestD = d; best = { x: p.x, y: p.y }; }
        });
    });
    return best || wp;
}

/**
 * ヒットテスト: 座標付近にある基礎要素を特定し選択ポップアップを表示
 */
export function trySelectFoundationElement(mx, my) {
    const scale = AppState.scale;
    const offsetX = AppState.offsetX;
    const offsetY = AppState.offsetY;
    const canvas = AppState.canvas;

    const toC = (x, y) => ({ cx: x * scale + offsetX, cy: canvas.height - (y * scale + offsetY) });
    const toW = (cx, cy) => ({ x: (cx - offsetX) / scale, y: (canvas.height - cy - offsetY) / scale });
    const wp = toW(mx, my);
    const HIT = 25; // px

    // 1. 人通口 (点)
    for (const mh of AppState.manholes) {
        const mc = toC(mh.x, mh.y);
        if (Math.hypot(mx - mc.cx, my - mc.cy) < HIT) {
            showFdPropertyPopup('manhole', mh, mx, my);
            return true;
        }
    }

    // 2. 基礎梁 (線)
    for (const b of AppState.foundationBeams) {
        if (b.spans && b.spans.length > 0) {
            for (let i = 0; i < b.spans.length; i++) {
                const span = b.spans[i];
                if (!span || !span.startNode || !span.endNode) continue;
                const p1c = toC(span.startNode.x, span.startNode.y);
                const p2c = toC(span.endNode.x, span.endNode.y);
                const l2 = (p2c.cx - p1c.cx) ** 2 + (p2c.cy - p1c.cy) ** 2;
                const t = l2 > 0 ? Math.max(0, Math.min(1, ((mx - p1c.cx) * (p2c.cx - p1c.cx) + (my - p1c.cy) * (p2c.cy - p1c.cy)) / l2)) : 0;
                const dist = Math.hypot(mx - (p1c.cx + t * (p2c.cx - p1c.cx)), my - (p1c.cy + t * (p2c.cy - p1c.cy)));
                if (dist < HIT) {
                    showFdPropertyPopup('beam', b, mx, my);
                    return true;
                }
            }
        }
    }

    // 3. スラブ / 外壁線 (多角形)
    const isPointInPolygon = (p, poly) => {
        let inside = false;
        let x = p.x, y = p.y;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            if (((poly[i].y > y) !== (poly[j].y > y)) && (x < (poly[j].x - poly[i].x) * (y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)) inside = !inside;
        }
        return inside;
    };

    for (const s of AppState.foundationSlabs) {
        if (isPointInPolygon(wp, s.vertices)) {
            showFdPropertyPopup('slab', s, mx, my);
            return true;
        }
    }
    for (const ew of AppState.exteriorWalls) {
        if (isPointInPolygon(wp, ew.vertices)) {
            showFdPropertyPopup('ext_wall', ew, mx, my);
            return true;
        }
    }

    hideFdPropertyPopup();
    return false;
}

/**
 * 基礎モードのmousedownハンドラ
 */
export function handleFoundationMouseDown(e) {
    const rect = AppState.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const snap = getFdSnapPoint(mx, my);
    const fm = AppState.foundationMode;

    if (fm === 'f_select') {
        trySelectFoundationElement(mx, my);
        return;
    }

    if (fm === 'f_beam') {
        if (!AppState.fdSelectedPillarLike) {
            AppState.fdSelectedPillarLike = { x: snap.x, y: snap.y };
        } else {
            const p1 = AppState.fdSelectedPillarLike;
            const p2 = { x: snap.x, y: snap.y };
            if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 10) {
                const w  = parseFloat(document.getElementById('fd-beam-width')?.value)  || 150;
                const h  = parseFloat(document.getElementById('fd-beam-height')?.value) || 640;
                const ed = parseFloat(document.getElementById('fd-embed-depth')?.value) || 240;
                const tr = document.getElementById('fd-top-rebar')?.value  || '1-D13';
                const br = document.getElementById('fd-bot-rebar')?.value  || '1-D13';
                const st = document.getElementById('fd-stirrup')?.value    || '1-D10@200';
                const nb = { id: Date.now(), p1, p2, props: { width: w, height: h, embedDepth: ed, topRebar: tr, bottomRebar: br, stirrup: st } };
                AppState.foundationBeams.push(nb);
            }
            AppState.fdSelectedPillarLike = null;
            if (typeof window.triggerUpdate === 'function') window.triggerUpdate();
        }
        return;
    }

    if (fm === 'f_ext_wall' || fm === 'f_slab') {
        const pt = { x: snap.x, y: snap.y };
        if (AppState.fdDrawPoints.length > 2 &&
            Math.hypot(pt.x - AppState.fdDrawPoints[0].x, pt.y - AppState.fdDrawPoints[0].y) < 20 / AppState.scale) {
            const vts = AppState.fdDrawPoints.map(p => ({ x: p.x, y: p.y }));
            if (fm === 'f_ext_wall') {
                AppState.exteriorWalls.push({ id: Date.now(), floor: AppState.currentFloor, vertices: vts, closed: true });
            } else {
                const sth = parseFloat(document.getElementById('fd-slab-top-height')?.value) || 50;
                const stk = parseFloat(document.getElementById('fd-slab-thickness')?.value) || 150;
                const newSlab = { id: Date.now(), vertices: vts, closed: true, props: { slabTopHeight: sth, slabThickness: stk } };
                AppState.foundationSlabs.push(newSlab);
                // 梁の自動生成ロジックなどは必要に応じて呼び出し
            }
            AppState.fdDrawPoints = [];
            if (typeof window.triggerUpdate === 'function') window.triggerUpdate();
            return;
        }
        AppState.fdDrawPoints.push(pt);
        if (typeof window.triggerUpdate === 'function') window.triggerUpdate();
        return;
    }

    if (fm === 'f_delete') {
        if (trySelectFoundationElement(mx, my)) {
            const sel = AppState.fdSelection;
            if (sel.type === 'beam') AppState.foundationBeams = AppState.foundationBeams.filter(b => b.id !== sel.item.id);
            else if (sel.type === 'slab') AppState.foundationSlabs = AppState.foundationSlabs.filter(s => s.id !== sel.item.id);
            else if (sel.type === 'manhole') AppState.manholes = AppState.manholes.filter(m => m.id !== sel.item.id);
            hideFdPropertyPopup();
            if (typeof window.triggerUpdate === 'function') window.triggerUpdate();
        }
    }
}

/**
 * プロパティポップアップからの要素値更新
 */
export function updateFdItemProp(type, id, keyPath, val, spanIndex = null) {
    let item = null;
    if (type === 'slab') item = AppState.foundationSlabs.find(s => s.id === id);
    if (type === 'manhole') item = AppState.manholes.find(m => m.id === id);
    if (type === 'beam' || type === 'beam_span') item = (AppState.foundationBeams || []).find(b => b.id === id);
    if (!item) return;

    let finalVal = (isNaN(val) || val === '' || val.includes('-') || keyPath.includes('name') || keyPath.includes('type') || keyPath.includes('support') || keyPath.includes('Rebar') || keyPath.includes('stirrup')) ? val : parseFloat(val);

    const keys = keyPath.split('.');
    let target = (type === 'slab') ? item.props : item;

    if ((type === 'beam' || type === 'beam_span') && spanIndex !== null) {
        const span = item.spans[spanIndex];
        if (span) {
            if (!span.props) {
                span.props = JSON.parse(JSON.stringify(item.props || {}));
            }
            span.props[keyPath] = finalVal;
        }

        if (typeof window.updateCalculations === 'function') window.updateCalculations();
        // 状態が反映された後に直前のマウス位置を使って再表示
        setTimeout(() => showFdPropertyPopup('beam', item), 0);
    } else {
        for (let i = 0; i < keys.length - 1; i++) {
            if (!target[keys[i]]) target[keys[i]] = {};
            target = target[keys[i]];
        }
        target[keys[keys.length - 1]] = finalVal;
    }

    if (type === 'slab' && keyPath.includes('rebar')) {
        const p = item.props;
        p.rebarShort.at = calculateSlabAt(p.rebarShort.type, p.rebarShort.pitch);
        p.rebarLong.at = calculateSlabAt(p.rebarLong.type, p.rebarLong.pitch);
        
        const elShort = document.getElementById('popup-at-short');
        const elLong  = document.getElementById('popup-at-long');
        if (elShort) elShort.innerText = p.rebarShort.at.toFixed(1);
        if (elLong)  elLong.innerText  = p.rebarLong.at.toFixed(1);
    }

    if (type === 'slab') {
        if (typeof window.updateCalculations === 'function') window.updateCalculations();
        if (typeof window.triggerUpdate === 'function') window.triggerUpdate();

        const reportCont = document.getElementById('slab-calc-result-container');
        if (reportCont) {
            reportCont.innerHTML = getFoundationSlabReportHtml(item);
        }

        if (keyPath === 'support') {
            const rowCant = document.getElementById('row-cantilever-length');
            if (rowCant) {
                rowCant.style.display = (val === '片持ち' ? 'flex' : 'none');
            }
        }
    } else {
        if (typeof window.triggerUpdate === 'function') window.triggerUpdate();
    }
}
