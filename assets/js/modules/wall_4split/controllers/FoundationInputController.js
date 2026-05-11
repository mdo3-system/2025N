/**
 * controllers/FoundationInputController.js - 基礎入力管理
 * v2.3.0 リファクタリング
 */

window.FoundationInputController = {
    /**
     * 基礎モードの mousedown ハンドラ
     */
    handleMouseDown: function(e, state) {
        // [v2.4.76 座標ズレ修正] wall_4split_input.js (findHitElement) と同様に、
        // DPR倍せずに論理座標（e.offsetX/Y）をそのまま渡す仕様に合わせる。
        const amx = e.offsetX;
        const amy = e.offsetY;
        
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
        // [v2.4.75 根本修正] 梁のヒットテストを世界座標(mm)で統一
        // 理由: toCanvasPixel が返す物理ピクセル座標と、ctx.setTransform(dpr,...) による
        //       描画位置(論理ピクセル)は DPR 倍ずれるため。
        //       スラブが isPointInPolygon(wp, ...) で正しく選択できるのと同じ方式に統一する。
        const HIT_WORLD = 300; // mm（世界座標での梁から300mm以内をヒットとする）
        const HIT_MANHOLE_WORLD = 400; // mm（世界座標での人通口から400mm以内）
        const wp = window.toWorldCoord(mx, my);
        // [v2.4.75 診断ログ] 万が一の座標ズレ検証用
        console.log(`[Foundation HitTest] CanvasPx:(${Math.round(mx)}, ${Math.round(my)}) -> WorldCoord:(${Math.round(wp.x)}, ${Math.round(wp.y)}) | Scl:${state.scale.toFixed(4)} Off:(${Math.round(state.offsetX)},${Math.round(state.offsetY)})`);
        const candidates = [];

        // 1. 人通口 (点) - [v2.4.76] 世界座標(mm)で判定に統一し、ピクセル演算のズレを排除
        (state.manholes || []).forEach(mh => {
            const d = Math.hypot(wp.x - mh.x, wp.y - mh.y);
            if (d < HIT_MANHOLE_WORLD) candidates.push({ type: 'manhole', item: mh, dist: d, priority: 1 });
        });

        // 2. 基礎梁 (線分) - [v2.4.75] 世界座標(mm)で距離判定
        (state.foundationBeams || []).forEach(b => {
            // スパンがある場合はスパンの startNode/endNode で、なければ b.p1/b.p2 で判定
            const segments = (b.spans && b.spans.length > 0)
                ? b.spans.map((s, i) => ({ p1: s.startNode, p2: s.endNode, spanIdx: i }))
                : [{ p1: b.p1, p2: b.p2, spanIdx: null }];

            segments.forEach((seg) => {
                if (!seg.p1 || !seg.p2) return;
                // globalX/Y を優先、なければ x/y を使用（[v2.4.77] 値が小さい場合はメートルとみなして1000倍しmmに正規化）
                const x1 = seg.p1.globalX ?? (Math.abs(seg.p1.x) < 100 ? seg.p1.x * 1000 : seg.p1.x);
                const y1 = seg.p1.globalY ?? (Math.abs(seg.p1.y) < 100 ? seg.p1.y * 1000 : seg.p1.y);
                const x2 = seg.p2.globalX ?? (Math.abs(seg.p2.x) < 100 ? seg.p2.x * 1000 : seg.p2.x);
                const y2 = seg.p2.globalY ?? (Math.abs(seg.p2.y) < 100 ? seg.p2.y * 1000 : seg.p2.y);

                const distWorld = window.MathUtils.distToBeamLine(wp.x, wp.y, x1, y1, x2, y2);
                if (distWorld < HIT_WORLD) {
                    candidates.push({
                        type: b.spans && b.spans.length > 0 ? 'beam_span' : 'beam',
                        item: b,
                        dist: distWorld,
                        priority: 2,
                        spanIndex: seg.spanIdx
                    });
                }
            });
        });

        // 3. 外壁線 (線分) - 世界座標(mm)で判定に統一
        (state.exteriorWalls || []).forEach(ew => {
            if (ew.floor !== state.currentFloor) return;
            const vts = ew.closed ? [...ew.vertices, ew.vertices[0]] : ew.vertices;
            for (let i = 0; i < vts.length - 1; i++) {
                const d = window.MathUtils.distToBeamLine(wp.x, wp.y, vts[i].x, vts[i].y, vts[i+1].x, vts[i+1].y);
                if (d < HIT_WORLD) candidates.push({ type: 'ext_wall', item: ew, dist: d, priority: 3 });
            }
        });

        // 4. スラブ (面)
        (state.foundationSlabs || []).forEach(s => {
            if (window.MathUtils && window.MathUtils.isPointInPolygon(wp, s.vertices)) {
                // スラブは「面」なので距離は 0 扱いだが、梁や点を優先するため priority を下げる
                candidates.push({ type: 'slab', item: s, dist: 10, priority: 4 });
            }
        });

        if (candidates.length > 0) {
            console.log(`[Foundation HitTest] Found ${candidates.length} candidates. Top priority: ${candidates[0].type}`);
            // 優先度(priority)が低い（数字が小さい）ものを優先、同優先度なら距離(dist)が近いものを優先
            candidates.sort((a, b) => (a.priority - b.priority) || (a.dist - b.dist));
            const best = candidates[0];
            window.PropertyController.showFdPopup(best.type, best.item, mx, my, best.spanIndex);
            return true;
        }

        window.PropertyController.hideFdPopup();
        return false;
    },

    getFdSnapPoint: function(mx, my, state) {
        const wp = window.toWorldCoord(mx, my);
        let best = null, bestD = Infinity;
        // 原理原則: グリッドの交点にしか配せない。よって強制的にグリッド交点を探す。
        const gXs = state.gridXCoords || [];
        const gYs = state.gridYCoords || [];
        
        if (gXs.length > 0 && gYs.length > 0) {
            gXs.forEach(gx => gYs.forEach(gy => {
                const d = Math.hypot(wp.x - gx, wp.y - gy);
                if (d < bestD) { bestD = d; best = { x: Math.round(gx), y: Math.round(gy) }; }
            }));
        }
        
        if (best) return best;
        // グリッドがない場合の最終フォールバック（ミリ単位の丸め）
        return { x: Math.round(wp.x), y: Math.round(wp.y) };
    }
};
