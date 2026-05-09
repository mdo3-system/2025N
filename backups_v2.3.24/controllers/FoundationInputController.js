/**
 * controllers/FoundationInputController.js - 基礎入力管理
 * v2.3.0 リファクタリング
 */

window.FoundationInputController = {
    /**
     * 基礎モードの mousedown ハンドラ
     */
    handleMouseDown: function(e, state) {
        const rect = state.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const fm = state.foundationMode || 'f_beam';
        const snap = this.getFdSnapPoint(mx, my, state);

        if (fm === 'f_select') {
            this.trySelectElement(mx, my, state);
            return;
        }

        if (fm === 'f_beam') {
            this.handleBeamInput(snap, state);
        } else if (fm === 'f_ext_wall' || fm === 'f_slab') {
            this.handlePolygonInput(snap, fm, state);
        } else if (fm === 'f_manhole') {
            this.handleManholeInput(snap, state);
        } else if (fm === 'f_delete') {
            this.handleDelete(mx, my, state);
        }
    },

    /**
     * 基礎モードの mousemove ハンドラ
     */
    handleMouseMove: function(mx, my, state) {
        state.snapPoint = this.getFdSnapPoint(mx, my, state);
    },

    handleBeamInput: function(snap, state) {
        if (!state.fdSelectedPillarLike) {
            state.fdSelectedPillarLike = { x: snap.x, y: snap.y };
        } else {
            const p1 = state.fdSelectedPillarLike;
            const p2 = { x: snap.x, y: snap.y };
            if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 10) {
                const w  = parseFloat(document.getElementById('fd-beam-width')?.value)  || 150;
                const h  = parseFloat(document.getElementById('fd-beam-height')?.value) || 640;
                const tr = document.getElementById('fd-top-rebar')?.value  || '1-D13';
                const br = document.getElementById('fd-bot-rebar')?.value  || '1-D13';
                const st = document.getElementById('fd-stirrup')?.value    || '1-D10@200';
                state.foundationBeams.push({ id: Date.now(), p1, p2, props: { width: w, height: h, topRebar: tr, bottomRebar: br, stirrup: st } });
            }
            state.fdSelectedPillarLike = null;
            window.AppController.refreshAll();
        }
    },

    handlePolygonInput: function(snap, fm, state) {
        const pts = state.fdDrawPoints;
        if (pts.length > 2 && Math.hypot(snap.x - pts[0].x, snap.y - pts[0].y) < 20 / state.scale) {
            const vts = pts.map(p => ({ x: p.x, y: p.y }));
            if (fm === 'f_ext_wall') {
                state.exteriorWalls.push({ id: Date.now(), floor: state.currentFloor, vertices: vts, closed: true });
            } else {
                state.foundationSlabs.push({ id: Date.now(), vertices: vts, closed: true, props: { slabThickness: 150, slabTopHeight: 50 } });
            }
            state.fdDrawPoints = [];
            window.AppController.refreshAll();
        } else {
            pts.push({ x: snap.x, y: snap.y });
            window.AppController.refreshAll();
        }
    },

    handleManholeInput: function(snap, state) {
        const wx = snap.x, wy = snap.y;
        let bestBeam = null, bestT = 0, bestDist = Infinity;
        state.foundationBeams.forEach(b => {
            const dx = b.p2.x - b.p1.x, dy = b.p2.y - b.p1.y;
            const len2 = dx * dx + dy * dy; if (len2 < 1) return;
            const t = Math.max(0, Math.min(1, ((wx - b.p1.x) * dx + (wy - b.p1.y) * dy) / len2));
            const d = Math.hypot(wx - (b.p1.x + t * dx), wy - (b.p1.y + t * dy));
            if (d < bestDist) { bestDist = d; bestBeam = b; bestT = t; }
        });
        if (bestBeam && bestDist < 500) {
            state.manholes.push({ id: Date.now(), parentBeamId: bestBeam.id, x: bestBeam.p1.x + bestT * (bestBeam.p2.x - bestBeam.p1.x), y: bestBeam.p1.y + bestT * (bestBeam.p2.y - bestBeam.p1.y), width: 600 });
            window.AppController.refreshAll();
        }
    },

    handleDelete: function(mx, my, state) {
        if (this.trySelectElement(mx, my, state)) {
            const sel = state.fdSelection;
            if (sel.type === 'beam') state.foundationBeams = state.foundationBeams.filter(b => b.id !== sel.item.id);
            else if (sel.type === 'slab') state.foundationSlabs = state.foundationSlabs.filter(s => s.id !== sel.item.id);
            else if (sel.type === 'manhole') state.manholes = state.manholes.filter(m => m.id !== sel.item.id);
            window.PropertyController.hideFdPopup();
        }
    },

    trySelectElement: function(mx, my, state) {
        // (existing trySelectFoundationElement logic)
        const HIT = 25 / state.scale;
        const wx = (mx - state.offsetX) / state.scale;
        const wy = (state.canvas.height - my - state.offsetY) / state.scale;
        const wp = { x: wx, y: wy };

        for (const mh of state.manholes) {
            if (Math.hypot(wx - mh.x, wy - mh.y) < HIT) { window.PropertyController.showFdPopup('manhole', mh, mx, my); return true; }
        }
        for (const b of state.foundationBeams) {
            const l2 = (b.p2.x - b.p1.x) ** 2 + (b.p2.y - b.p1.y) ** 2;
            const t = l2 > 0 ? Math.max(0, Math.min(1, ((wx - b.p1.x) * (b.p2.x - b.p1.x) + (wy - b.p1.y) * (b.p2.y - b.p1.y)) / l2)) : 0;
            if (Math.hypot(wx - (b.p1.x + t * (b.p2.x - b.p1.x)), wy - (b.p1.y + t * (b.p2.y - b.p1.y))) < HIT) { window.PropertyController.showFdPopup('beam', b, mx, my); return true; }
        }
        for (const s of state.foundationSlabs) {
            if (window.MathUtils.isPointInPolygon(wp, s.vertices)) { window.PropertyController.showFdPopup('slab', s, mx, my); return true; }
        }
        window.PropertyController.hideFdPopup();
        return false;
    },

    getFdSnapPoint: function(mx, my, state) {
        const wp = { x: (mx - state.offsetX) / state.scale, y: (state.canvas.height - my - state.offsetY) / state.scale };
        let best = null, bestD = 20 / state.scale;
        state.gridXCoords.forEach(gx => state.gridYCoords.forEach(gy => {
            const d = Math.hypot(wp.x - gx, wp.y - gy);
            if (d < bestD) { bestD = d; best = { x: gx, y: gy }; }
        }));
        state.foundationBeams.forEach(b => {
            [b.p1, b.p2].forEach(p => {
                const d = Math.hypot(wp.x - p.x, wp.y - p.y);
                if (d < bestD) { bestD = d; best = { x: p.x, y: p.y }; }
            });
        });
        return best || wp;
    }
};
