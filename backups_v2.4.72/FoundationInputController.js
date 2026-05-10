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
        // [原則] 全てはグリッド交点にある。この原理を活かした「レール判定」を実装。
        const HIT_PX = 25; 
        const canvasH = Math.round(state.canvas.height);
        
        // 世界座標 (mm)
        const wp = { 
            x: (mx - state.offsetX) / state.scale, 
            y: (canvasH - my - state.offsetY) / state.scale 
        };

        // 補助関数: 世界座標から描画バッファ上のピクセル座標への変換
        const toCanvasX = (wx) => wx * state.scale + state.offsetX;
        const toCanvasY = (wy) => canvasH - (wy * state.scale + state.offsetY);

        // --- 優先度 1: 人通口 (Manholes) ---
        for (const mh of (state.manholes || [])) {
            const cx = toCanvasX(mh.x), cy = toCanvasY(mh.y);
            if (Math.hypot(mx - cx, my - cy) < HIT_PX) { 
                window.PropertyController.showFdPopup('manhole', mh, mx, my); 
                return true; 
            }
        }

        // --- 優先度 2: 基礎梁 (Grid-Rail Selection) ---
        // 近傍のグリッド（レール）を特定
        const nearGridX = (state.gridXCoords || []).find(gx => Math.abs(mx - toCanvasX(gx)) < HIT_PX);
        const nearGridY = (state.gridYCoords || []).find(gy => Math.abs(my - toCanvasY(gy)) < HIT_PX);

        const beams = state.foundationBeams || [];
        for (const b of beams) {
            // スパン情報を考慮。解析前なら p1, p2 を使用
            const segments = (b.spans && b.spans.length > 0) 
                ? b.spans.map(s => ({ p1: s.startNode, p2: s.endNode })) 
                : [{ p1: b.p1, p2: b.p2 }];

            for (const seg of segments) {
                if (!seg.p1 || !seg.p2) continue;
                
                // 水平梁判定: Y座標が一致し、マウスがYグリッドレール上にあり、X範囲内にあるか
                const isH = Math.abs(seg.p1.y - seg.p2.y) < 1.0;
                if (isH && nearGridY !== undefined && Math.abs(seg.p1.y - nearGridY) < 1.0) {
                    const xMin = Math.min(seg.p1.x, seg.p2.x), xMax = Math.max(seg.p1.x, seg.p2.x);
                    if (wp.x >= xMin - 100 && wp.x <= xMax + 100) {
                        window.PropertyController.showFdPopup('beam', b, mx, my);
                        return true;
                    }
                }
                
                // 垂直梁判定: X座標が一致し、マウスがXグリッドレール上にあり、Y範囲内にあるか
                const isV = Math.abs(seg.p1.x - seg.p2.x) < 1.0;
                if (isV && nearGridX !== undefined && Math.abs(seg.p1.x - nearGridX) < 1.0) {
                    const yMin = Math.min(seg.p1.y, seg.p2.y), yMax = Math.max(seg.p1.y, seg.p2.y);
                    if (wp.y >= yMin - 100 && wp.y <= yMax + 100) {
                        window.PropertyController.showFdPopup('beam', b, mx, my);
                        return true;
                    }
                }

                // 斜め梁判定 (Fallback: 従来の距離計算)
                if (!isH && !isV) {
                    const p1c = { x: toCanvasX(seg.p1.x), y: toCanvasY(seg.p1.y) };
                    const p2c = { x: toCanvasX(seg.p2.x), y: toCanvasY(seg.p2.y) };
                    const l2 = (p2c.x - p1c.x) ** 2 + (p2c.y - p1c.y) ** 2;
                    const t = l2 > 0 ? Math.max(0, Math.min(1, ((mx - p1c.x) * (p2c.x - p1c.x) + (my - p1c.y) * (p2c.y - p1c.y)) / l2)) : 0;
                    if (Math.hypot(mx - (p1c.x + t * (p2c.x - p1c.x)), my - (p1c.y + t * (p2c.y - p1c.y))) < HIT_PX) {
                        window.PropertyController.showFdPopup('beam', b, mx, my);
                        return true;
                    }
                }
            }
        }

        // --- 優先度 3: 外壁線 ---
        for (const ew of (state.exteriorWalls || [])) {
            if (ew.floor !== state.currentFloor) continue;
            const vts = ew.vertices || [];
            const edgeVts = ew.closed ? [...vts, vts[0]] : vts;
            for (let i = 0; i < edgeVts.length - 1; i++) {
                const p1c = { x: toCanvasX(edgeVts[i].x), y: toCanvasY(edgeVts[i].y) };
                const p2c = { x: toCanvasX(edgeVts[i+1].x), y: toCanvasY(edgeVts[i+1].y) };
                const l2 = (p2c.x - p1c.x) ** 2 + (p2c.y - p1c.y) ** 2;
                const t = l2 > 0 ? Math.max(0, Math.min(1, ((mx - p1c.x) * (p2c.x - p1c.x) + (my - p1c.y) * (p2c.y - p1c.y)) / l2)) : 0;
                if (Math.hypot(mx - (p1c.x + t * (p2c.x - p1c.x)), my - (p1c.y + t * (p2c.y - p1c.y))) < HIT_PX) {
                    window.PropertyController.showFdPopup('ext_wall', ew, mx, my);
                    return true;
                }
            }
        }

        // --- 優先度 4: スラブ ---
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
        let best = null, bestD = Infinity;
        (state.gridXCoords || []).forEach(gx => (state.gridYCoords || []).forEach(gy => {
            const d = Math.hypot(wp.x - gx, wp.y - gy);
            if (d < bestD) { bestD = d; best = { x: Math.round(gx), y: Math.round(gy) }; }
        }));
        if (best) return best;
        return { x: Math.round(wp.x), y: Math.round(wp.y) };
    }
};
