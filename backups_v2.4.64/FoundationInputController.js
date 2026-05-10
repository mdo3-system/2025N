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
            this.handlePolygonInput(snap, fm, state, e);
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
            state.fdSelectedPillarLike = { x: Math.round(snap.x), y: Math.round(snap.y) };
        } else {
            const p1 = { x: Math.round(state.fdSelectedPillarLike.x), y: Math.round(state.fdSelectedPillarLike.y) };
            let p2 = { x: Math.round(snap.x), y: Math.round(snap.y) };
            
            // [超重要・直交化クランプ] 基礎梁は折れのない完全な水平、または垂直の直線のみを許容する
            const dx = Math.abs(p2.x - p1.x);
            const dy = Math.abs(p2.y - p1.y);
            if (dx > dy) {
                p2.y = p1.y; // 完全な水平梁に補正
            } else {
                p2.x = p1.x; // 完全な垂直梁に補正
            }

            if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 10) {
                if (window.AppController && typeof window.AppController.saveStateToHistory === 'function') {
                    window.AppController.saveStateToHistory();
                }
                const sym = document.getElementById('fd-beam-symbol')?.value || 'FG1';
                const w  = parseFloat(document.getElementById('fd-beam-width')?.value)  || 150;
                const h  = parseFloat(document.getElementById('fd-beam-height')?.value) || 640;
                const ed = parseFloat(document.getElementById('fd-embed-depth')?.value) || 250;
                const tr = document.getElementById('fd-top-rebar')?.value  || '1-D13';
                const br = document.getElementById('fd-bot-rebar')?.value  || '1-D13';
                const st = document.getElementById('fd-stirrup')?.value    || '1-D10@200';
                state.foundationBeams.push({ id: Date.now(), p1, p2, props: { symbol: sym, width: w, height: h, embedDepth: ed, topRebar: tr, bottomRebar: br, stirrup: st } });
            }
            state.fdSelectedPillarLike = null;
            window.AppController.refreshAll();
        }
    },

    handlePolygonInput: function(snap, fm, state, e) {
        const pts = state.fdDrawPoints;
        const isDoubleClick = e && (e.detail === 2);

        if (isDoubleClick && pts.length > 1) {
            // ダブルクリックでの作成完了（特にポーチなどの一筆書きを閉じる/終了する用）
            // 2回目のクリックで追加された可能性のある重複点（最後の1点）をトリミング
            if (pts.length > 1) {
                const last = pts[pts.length - 1];
                if (Math.hypot(snap.x - last.x, snap.y - last.y) < 5.0) {
                    pts.pop();
                }
            }
            if (pts.length > 1) {
                const vts = pts.map(p => ({ x: p.x, y: p.y }));
                if (window.AppController && typeof window.AppController.saveStateToHistory === 'function') {
                    window.AppController.saveStateToHistory();
                }
                if (fm === 'f_ext_wall') {
                    state.exteriorWalls.push({ id: Date.now(), floor: state.currentFloor, vertices: vts, closed: false });
                } else {
                    const sym = document.getElementById('fd-slab-symbol')?.value || 'FS1';
                    const thick = parseFloat(document.getElementById('fd-slab-thickness')?.value) || 150;
                    const th = parseFloat(document.getElementById('fd-slab-top-height')?.value) || 50;
                    const stype = document.getElementById('fd-slab-short-type')?.value || 'D13';
                    const spitch = parseFloat(document.getElementById('fd-slab-short-pitch')?.value) || 150;
                    const ltype = document.getElementById('fd-slab-long-type')?.value || 'D13';
                    const lpitch = parseFloat(document.getElementById('fd-slab-long-pitch')?.value) || 300;
                    
                    let sat = 0, lat = 0;
                    if (window.WallEngine && window.WallEngine.calculateSlabAt) {
                        sat = window.WallEngine.calculateSlabAt(stype, spitch);
                        lat = window.WallEngine.calculateSlabAt(ltype, lpitch);
                    }
                    
                    const slabProps = {
                        name: sym,
                        support: '4辺固定',
                        slabThickness: thick,
                        slabTopHeight: th,
                        coverDepth: 70,
                        rebarShort: { type: stype, pitch: spitch, at: sat },
                        rebarLong: { type: ltype, pitch: lpitch, at: lat }
                    };
                    state.foundationSlabs.push({ id: Date.now(), vertices: vts, closed: true, props: slabProps });
                }
                state.fdDrawPoints = [];
                window.AppController.refreshAll();
                return;
            }
        }

        if (pts.length > 2 && Math.hypot(snap.x - pts[0].x, snap.y - pts[0].y) < 20 / state.scale) {
            const vts = pts.map(p => ({ x: p.x, y: p.y }));
            if (window.AppController && typeof window.AppController.saveStateToHistory === 'function') {
                window.AppController.saveStateToHistory();
            }
            if (fm === 'f_ext_wall') {
                state.exteriorWalls.push({ id: Date.now(), floor: state.currentFloor, vertices: vts, closed: true });
            } else {
                const sym = document.getElementById('fd-slab-symbol')?.value || 'FS1';
                const thick = parseFloat(document.getElementById('fd-slab-thickness')?.value) || 150;
                const th = parseFloat(document.getElementById('fd-slab-top-height')?.value) || 50;
                const stype = document.getElementById('fd-slab-short-type')?.value || 'D13';
                const spitch = parseFloat(document.getElementById('fd-slab-short-pitch')?.value) || 150;
                const ltype = document.getElementById('fd-slab-long-type')?.value || 'D13';
                const lpitch = parseFloat(document.getElementById('fd-slab-long-pitch')?.value) || 300;
                
                let sat = 0, lat = 0;
                if (window.WallEngine && window.WallEngine.calculateSlabAt) {
                    sat = window.WallEngine.calculateSlabAt(stype, spitch);
                    lat = window.WallEngine.calculateSlabAt(ltype, lpitch);
                }
                
                const slabProps = {
                    name: sym,
                    support: '4辺固定',
                    slabThickness: thick,
                    slabTopHeight: th,
                    coverDepth: 70,
                    rebarShort: { type: stype, pitch: spitch, at: sat },
                    rebarLong: { type: ltype, pitch: lpitch, at: lat }
                };
                state.foundationSlabs.push({ id: Date.now(), vertices: vts, closed: true, props: slabProps });
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
            if (window.AppController && typeof window.AppController.saveStateToHistory === 'function') {
                window.AppController.saveStateToHistory();
            }
            state.manholes.push({ id: Date.now(), parentBeamId: bestBeam.id, x: bestBeam.p1.x + bestT * (bestBeam.p2.x - bestBeam.p1.x), y: bestBeam.p1.y + bestT * (bestBeam.p2.y - bestBeam.p1.y), width: 600 });
            window.AppController.refreshAll();
        }
    },

    handleDelete: function(mx, my, state) {
        if (this.trySelectElement(mx, my, state)) {
            if (window.AppController && typeof window.AppController.saveStateToHistory === 'function') {
                window.AppController.saveStateToHistory();
            }
            const sel = state.fdSelection;
            if (sel.type === 'beam') state.foundationBeams = state.foundationBeams.filter(b => b.id !== sel.item.id);
            else if (sel.type === 'slab') state.foundationSlabs = state.foundationSlabs.filter(s => s.id !== sel.item.id);
            else if (sel.type === 'manhole') state.manholes = state.manholes.filter(m => m.id !== sel.item.id);
            else if (sel.type === 'ext_wall') state.exteriorWalls = state.exteriorWalls.filter(ew => ew.id !== sel.item.id);
            state.fdSelection = { type: null, item: null };
            window.PropertyController.hideFdPopup();
            window.AppController.refreshAll();
        }
    },

    trySelectElement: function(mx, my, state) {
        // (existing trySelectFoundationElement logic)
        const HIT = 25 / state.scale;
        const wx = (mx - state.offsetX) / state.scale;
        const wy = (state.canvas.height - my - state.offsetY) / state.scale;
        const wp = { x: wx, y: wy };

        for (const mh of (state.manholes || [])) {
            if (Math.hypot(wx - mh.x, wy - mh.y) < HIT) { window.PropertyController.showFdPopup('manhole', mh, mx, my); return true; }
        }
        for (const b of (state.foundationBeams || [])) {
            if (!b.p1 || !b.p2) continue;
            const l2 = (b.p2.x - b.p1.x) ** 2 + (b.p2.y - b.p1.y) ** 2;
            const t = l2 > 0 ? Math.max(0, Math.min(1, ((wx - b.p1.x) * (b.p2.x - b.p1.x) + (wy - b.p1.y) * (b.p2.y - b.p1.y)) / l2)) : 0;
            if (Math.hypot(wx - (b.p1.x + t * (b.p2.x - b.p1.x)), wy - (b.p1.y + t * (b.p2.y - b.p1.y))) < HIT) { window.PropertyController.showFdPopup('beam', b, mx, my); return true; }
        }
        for (const ew of (state.exteriorWalls || [])) {
            if (ew.floor !== state.currentFloor) continue;
            const vts = ew.vertices || [];
            for (let i = 0; i < vts.length - 1; i++) {
                const p1 = vts[i];
                const p2 = vts[i+1];
                const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
                const t = l2 > 0 ? Math.max(0, Math.min(1, ((wx - p1.x) * (p2.x - p1.x) + (wy - p1.y) * (p2.y - p1.y)) / l2)) : 0;
                if (Math.hypot(wx - (p1.x + t * (p2.x - p1.x)), wy - (p1.y + t * (p2.y - p1.y))) < HIT) {
                    window.PropertyController.showFdPopup('ext_wall', ew, mx, my);
                    return true;
                }
            }
            if (ew.closed && vts.length > 2) {
                const p1 = vts[vts.length - 1];
                const p2 = vts[0];
                const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
                const t = l2 > 0 ? Math.max(0, Math.min(1, ((wx - p1.x) * (p2.x - p1.x) + (wy - p1.y) * (p2.y - p1.y)) / l2)) : 0;
                if (Math.hypot(wx - (p1.x + t * (p2.x - p1.x)), wy - (p1.y + t * (p2.y - p1.y))) < HIT) {
                    window.PropertyController.showFdPopup('ext_wall', ew, mx, my);
                    return true;
                }
            }
        }
        for (const s of (state.foundationSlabs || [])) {
            if (window.MathUtils && window.MathUtils.isPointInPolygon(wp, s.vertices)) { window.PropertyController.showFdPopup('slab', s, mx, my); return true; }
        }

        window.PropertyController.hideFdPopup();
        return false;
    },

    getFdSnapPoint: function(mx, my, state) {
        const wp = { x: (mx - state.offsetX) / state.scale, y: (state.canvas.height - my - state.offsetY) / state.scale };
        let best = null, bestD = Infinity; // Remove distance threshold to enforce 100% grid snapping
        state.gridXCoords.forEach(gx => state.gridYCoords.forEach(gy => {
            const d = Math.hypot(wp.x - gx, wp.y - gy);
            if (d < bestD) { bestD = d; best = { x: Math.round(gx), y: Math.round(gy) }; }
        }));
        if (best) return best;
        return { x: Math.round(wp.x), y: Math.round(wp.y) };
    }
};
