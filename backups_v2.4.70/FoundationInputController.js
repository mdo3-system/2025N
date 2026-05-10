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
        // [改善] 高DPI（4Kモニタ等）やブラウザの拡大率に左右されない、描画バッファベースの正確なマウス座標を算出
        const scaleX = state.canvas.width / rect.width;
        const scaleY = state.canvas.height / rect.height;
        const amx = (e.clientX - rect.left) * scaleX;
        const amy = (e.clientY - rect.top) * scaleY;
        
        const fm = state.foundationMode || 'f_beam';
        const snap = this.getFdSnapPoint(amx, amy, state);

        if (fm === 'f_select') {
            this.trySelectElement(amx, amy, state);
            return;
        }
        
        // ... 残りのモード処理に正確な座標 (amx, amy) を引き渡す
        if (fm === 'f_beam') {
            this.handleBeamInput(snap, state);
        } else if (fm === 'f_ext_wall' || fm === 'f_slab') {
            this.handlePolygonInput(snap, fm, state, e);
        } else if (fm === 'f_manhole') {
            this.handleManholeInput(snap, state);
        } else if (fm === 'f_delete') {
            this.handleDelete(amx, amy, state);
        }
    },

    /**
     * 基礎モードの mousemove ハンドラ
     */
    handleMouseMove: function(mx, my, state) {
        // [改善] バッファ座標ベースのスナップポイント取得
        const rect = state.canvas.getBoundingClientRect();
        const scaleX = state.canvas.width / rect.width;
        const scaleY = state.canvas.height / rect.height;
        const amx = mx * scaleX;
        const amy = my * scaleY;
        state.snapPoint = this.getFdSnapPoint(amx, amy, state);
    },

    handleBeamInput: function(snap, state) {
        if (!state.fdSelectedPillarLike) {
            state.fdSelectedPillarLike = { x: Math.round(snap.x), y: Math.round(snap.y) };
        } else {
            const p1 = { x: Math.round(state.fdSelectedPillarLike.x), y: Math.round(state.fdSelectedPillarLike.y) };
            let p2 = { x: Math.round(snap.x), y: Math.round(snap.y) };
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
            if (sel.item) {
                if (sel.type === 'beam') state.foundationBeams = state.foundationBeams.filter(b => b.id !== sel.item.id);
                else if (sel.type === 'slab') state.foundationSlabs = state.foundationSlabs.filter(s => s.id !== sel.item.id);
                else if (sel.type === 'manhole') state.manholes = state.manholes.filter(m => m.id !== sel.item.id);
                else if (sel.type === 'ext_wall') state.exteriorWalls = state.exteriorWalls.filter(ew => ew.id !== sel.item.id);
            }
            state.fdSelection = { type: null, item: null };
            window.PropertyController.hideFdPopup();
            window.AppController.refreshAll();
        }
    },

    trySelectElement: function(mx, my, state) {
        // mx, my は既にバッファ座標系（0 〜 canvas.width/height）に変換済みである前提
        const HIT_PX = 15; // 判定距離（ピクセル単位）: 以前より少し広めに設定
        
        // [重要] y座標の世界座標変換。canvas.height を基準に反転。
        const wp = { 
            x: (mx - state.offsetX) / state.scale, 
            y: (state.canvas.height - my - state.offsetY) / state.scale 
        };

        // 補助関数: 世界座標から描画バッファ上のピクセル座標への変換
        const toCanvasBuffer = (p) => {
            return {
                x: p.x * state.scale + state.offsetX,
                y: state.canvas.height - (p.y * state.scale + state.offsetY)
            };
        };

        // 1. 人通口 (Manholes)
        for (const mh of (state.manholes || [])) {
            const cp = toCanvasBuffer({ x: mh.x, y: mh.y });
            if (Math.hypot(mx - cp.x, my - cp.y) < HIT_PX) { 
                window.PropertyController.showFdPopup('manhole', mh, mx, my); 
                return true; 
            }
        }

        // 2. 基礎梁・スパン (Beams & Spans)
        for (const b of (state.foundationBeams || [])) {
            // スパン情報を優先（投影後の直線に対してヒットテスト）
            const spans = b.spans && b.spans.length > 0 ? b.spans : [{ startNode: b.p1, endNode: b.p2 }];
            for (const s of spans) {
                if (!s.startNode || !s.endNode) continue;
                const p1 = toCanvasBuffer(s.startNode);
                const p2 = toCanvasBuffer(s.endNode);
                
                const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
                const t = l2 > 0 ? Math.max(0, Math.min(1, ((mx - p1.x) * (p2.x - p1.x) + (my - p1.y) * (p2.y - p1.y)) / l2)) : 0;
                const distPx = Math.hypot(mx - (p1.x + t * (p2.x - p1.x)), my - (p1.y + t * (p2.y - p1.y)));
                
                if (distPx < HIT_PX) {
                    window.PropertyController.showFdPopup('beam', b, mx, my);
                    return true;
                }
            }
        }

        // 3. 外壁線 (Exterior Walls)
        for (const ew of (state.exteriorWalls || [])) {
            if (ew.floor !== state.currentFloor) continue;
            const vts = ew.vertices || [];
            const edgeVts = ew.closed ? [...vts, vts[0]] : vts;
            for (let i = 0; i < edgeVts.length - 1; i++) {
                const p1 = toCanvasBuffer(edgeVts[i]);
                const p2 = toCanvasBuffer(edgeVts[i+1]);
                const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
                const t = l2 > 0 ? Math.max(0, Math.min(1, ((mx - p1.x) * (p2.x - p1.x) + (my - p1.y) * (p2.y - p1.y)) / l2)) : 0;
                if (Math.hypot(mx - (p1.x + t * (p2.x - p1.x)), my - (p1.y + t * (p2.y - p1.y))) < HIT_PX) {
                    window.PropertyController.showFdPopup('ext_wall', ew, mx, my);
                    return true;
                }
            }
        }

        // 4. スラブ (Slabs)
        for (const s of (state.foundationSlabs || [])) {
            if (window.MathUtils && window.MathUtils.isPointInPolygon(wp, s.vertices)) { 
                window.PropertyController.showFdPopup('slab', s, mx, my); 
                return true; 
            }
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
