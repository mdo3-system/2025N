/**
 * controllers/PropertyController.js - 統一プロパティ管理コントローラー
 * v2.3.19 リファクタリング
 */

window.PropertyController = {
    lastPopupMx: 0,
    lastPopupMy: 0,

    /**
     * 基礎要素のプロパティポップアップ表示
     */
    showFdPopup: function(type, item, mx, my) {
        if (mx !== undefined) this.lastPopupMx = mx;
        if (my !== undefined) this.lastPopupMy = my;

        if (!type && !item) {
            type = window.AppState.fdSelection.type;
            item = window.AppState.fdSelection.item;
        }
        if (!type || !item) return;

        window.AppState.fdSelection = { type, item };
        const popup = document.getElementById('fd-property-popup');
        const title = document.getElementById('fd-popup-title');
        const content = document.getElementById('fd-popup-content');
        if (!popup || !title || !content) return;

        // ポップアップ位置の計算とクランプ
        let px = (mx || this.lastPopupMx) + 20;
        let py = (my || this.lastPopupMy) + 20;
        popup.style.left = px + 'px';
        popup.style.top = py + 'px';
        popup.style.display = 'block';

        this.initDragHandler(popup);

        // コンテンツの生成
        content.innerHTML = this.generateFdContentHtml(type, item);
        window.triggerUpdate();
    },

    hideFdPopup: function() {
        window.AppState.fdSelection = { type: null, item: null };
        const popup = document.getElementById('fd-property-popup');
        if (popup) popup.style.display = 'none';
        window.triggerUpdate();
    },

    /**
     * 基礎プロパティ更新
     */
    updateFdProp: function(type, id, keyPath, val, spanIndex = null) {
        const state = window.AppState;
        let item = null;
        if (type === 'slab') item = state.foundationSlabs.find(s => s.id === id);
        if (type === 'manhole') item = state.manholes.find(m => m.id === id);
        if (type === 'beam' || type === 'beam_span') item = state.foundationBeams.find(b => b.id === id);
        if (!item) return;

        let finalVal = (isNaN(val) || val === '' || keyPath.includes('name') || keyPath.includes('type') || keyPath.includes('support') || keyPath.includes('Rebar') || keyPath.includes('stirrup')) ? val : parseFloat(val);

        if ((type === 'beam' || type === 'beam_span') && spanIndex !== null) {
            const span = item.spans[spanIndex];
            if (span) {
                if (!span.props) span.props = JSON.parse(JSON.stringify(item.props));
                span.props[keyPath] = finalVal;
            }
        } else {
            const keys = keyPath.split('.');
            let target = (type === 'slab') ? item.props : item;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!target[keys[i]]) target[keys[i]] = {};
                target = target[keys[i]];
            }
            target[keys[keys.length - 1]] = finalVal;
        }

        // スラブ特有の再計算
        if (type === 'slab' && keyPath.includes('rebar')) {
            const p = item.props;
            if (window.WallEngine && window.WallEngine.calculateSlabAt) {
                 p.rebarShort.at = window.WallEngine.calculateSlabAt(p.rebarShort.type, p.rebarShort.pitch);
                 p.rebarLong.at = window.WallEngine.calculateSlabAt(p.rebarLong.type, p.rebarLong.pitch);
            }
        }

        window.AppController.refreshAll();
        
        // UI更新（スラブの場合はポップアップ内も更新）
        if (type === 'slab') {
            const reportCont = document.getElementById('slab-calc-result-container');
            if (reportCont && typeof getFoundationSlabReportHtml === 'function') {
                reportCont.innerHTML = getFoundationSlabReportHtml(item);
            }
        } else {
            setTimeout(() => this.showFdPopup(type, item, this.lastPopupMx, this.lastPopupMy), 0);
        }
    },

    /**
     * 一般要素（壁・柱・面積）のプロパティモーダル表示
     */
    openGeneralModal: function(hit) {
        const modal = document.getElementById("modal-property-editor");
        const body = document.getElementById("modal-prop-body");
        if (!modal || !body) return;

        window.AppState.selectedElement = hit;
        const type = hit.type;
        const item = hit.item;

        if (type === 'pillar') {
            window.AppState.selectedPillar = item;
        } else {
            window.AppState.selectedPillar = null;
        }

        body.innerHTML = this.generateGeneralFormHtml(type, item);
        modal.style.display = "flex";
        
        if (type === 'wall' || type === 'window') {
            this.updateWallFields(type, item);
            this.syncCenterPanel(item); // Sync right panel tool too
        }
    },

    applyGeneralChanges: function() {
        const hit = window.AppState.selectedElement;
        if (!hit) return;
        const oldType = hit.type;
        const item = hit.item;

        if (oldType === "pillar") {
            item.isManualCorner = document.getElementById("edit-pillar-corner").checked;
            item.manualMark = document.getElementById("edit-pillar-mark").value || null;
            
            const newH = parseFloat(document.getElementById("edit-pillar-h").value);
            item.h = isNaN(newH) ? null : newH;

        } else if (oldType === "wall" || oldType === "window") {
            const newType = document.getElementById("edit-element-type").value;
            
            // 高連動ロジック
            if (oldType === "wall" || newType === "wall") {
                const newH = parseFloat(document.getElementById("edit-wall-h")?.value);
                if (!isNaN(newH)) {
                    item.h = newH;
                    // 取り付く柱の高さも自動修正
                    if (item.p1) item.p1.h = newH;
                    if (item.p2) item.p2.h = newH;
                    
                    // 同一方向の隣接連動 (簡易実装: 同じ座標を共有する他の壁・柱を探す)
                    this.propagateHeight(item, newH);
                }
            }

            // 壁・開口の切り替えロジック
            if (oldType !== newType) {
                if (newType === "window") {
                    window.AppState.walls = window.AppState.walls.filter(w => w !== item);
                    window.AppState.windowsArr.push(item);
                    hit.type = "window";
                } else {
                    window.AppState.windowsArr = window.AppState.windowsArr.filter(w => w !== item);
                    window.AppState.walls.push(item);
                    hit.type = "wall";
                }
            }

            if (newType === "wall") {
                item.outPanelId = document.getElementById("edit-wall-p1").value;
                item.inPanelId  = document.getElementById("edit-wall-p2").value;
                item.braceId    = document.getElementById("edit-wall-b").value;
                
                // キャッシュは最小限（totalValのみ、既存ロジックとの互換性のため）
                item.totalVal = window.WallEngine.getTotalMultiplier(item);
                
                // TASUKI判定などのUI/Logic用フラグ
                const bSpec = window.WallEngine.getBraceSpec(item.braceId);
                item.isTasuki = bSpec.text.includes('たすき');
            } else {
                item.length = parseInt(document.getElementById("edit-win-width").value, 10);
                item.totalVal = 0;
            }
        } else if (oldType === "area") {
            item.areaType = document.getElementById("edit-area-type").value;
        }

        document.getElementById("modal-property-editor").style.display = "none";
        window.AppController.refreshAll();
    },

    // --- 内部ヘルパー ---

    initDragHandler: function(el) {
        const header = el.querySelector('.popup-header') || el.querySelector('div');
        if (header && !header.dataset.dragInit) {
            let isDragging = false, startX, startY, initX, initY;
            header.addEventListener('mousedown', (e) => {
                isDragging = true;
                startX = e.clientX; startY = e.clientY;
                initX = parseInt(el.style.left, 10) || 0;
                initY = parseInt(el.style.top, 10) || 0;
                e.preventDefault();
            });
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                el.style.left = (initX + (e.clientX - startX)) + 'px';
                el.style.top = (initY + (e.clientY - startY)) + 'px';
            });
            document.addEventListener('mouseup', () => { isDragging = false; });
            header.dataset.dragInit = 'true';
        }
    },

    generateFdContentHtml: function(type, item) {
        // (既存の main.js からの移植 - 基礎梁、スラブ等のHTML生成)
        if (type === 'beam') return this.generateBeamHtml(item);
        if (type === 'slab') return this.generateSlabHtml(item);
        if (type === 'manhole') return `<div class="calc-box"><div class="calc-row"><label>開口幅(mm)</label><input type="number" value="${item.width}" onchange="window.PropertyController.updateFdProp('manhole', ${item.id}, 'width', this.value)"></div></div>`;
        return '';
    },

    generateBeamHtml: function(beam) {
        let html = `<div class="calc-box" style="padding:10px; max-height:450px; overflow-y:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:11px;">
                <thead><tr style="background:#f2f2f2;"><th>No.</th><th>幅/成/配筋</th><th>判定</th></tr></thead>
                <tbody>`;
        beam.spans.forEach((span, idx) => {
            const p = span.props || beam.props;
            const badge = span.isNG ? '<span style="color:#e74c3c;">NG</span>' : '<span style="color:#27ae60;">OK</span>';
            html += `<tr style="border-bottom:1px solid #eee;">
                <td>${idx+1}</td>
                <td>
                    <input type="number" value="${p.width}" onchange="window.PropertyController.updateFdProp('beam', ${beam.id}, 'width', this.value, ${idx})" style="width:40px;">×
                    <input type="number" value="${p.height}" onchange="window.PropertyController.updateFdProp('beam', ${beam.id}, 'height', this.value, ${idx})" style="width:40px;">
                </td>
                <td>${badge}</td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
        return html;
    },

    generateSlabHtml: function(item) {
        const p = item.props || {};
        return `<div class="calc-box" style="padding:10px;">
            <div class="calc-row"><label>スラブ名</label><input type="text" value="${p.name || 'S1'}" onchange="window.PropertyController.updateFdProp('slab', ${item.id}, 'name', this.value)"></div>
            <div id="slab-calc-result-container">${(typeof getFoundationSlabReportHtml === 'function') ? getFoundationSlabReportHtml(item) : ''}</div>
        </div>`;
    },

    generateGeneralFormHtml: function(type, item) {
        const state = window.AppState;
        const floorHeight = (item.floor === '2F') ? (state.config.floorHeight2F || 2.7) : (state.config.floorHeight1F || 2.7);

        if (type === 'pillar') {
            const nVal = item.nValue !== undefined ? item.nValue.toFixed(3) : '-';
            const nMark = item.nMark || '-';
            const calcX = item.cStrX || '計算中...';
            const calcY = item.cStrY || '計算中...';
            
            return `
                <div class="prop-edit-row" style="background:#f0f7ff; padding:12px; border-radius:6px; border:1px solid #bce8f1; margin-bottom:15px;">
                    <div style="font-weight:bold; color:#2c3e50; border-bottom:2px solid #3498db; margin-bottom:10px; font-size:14px;">📊 N値算定結果</div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:13px;"><span>算定N値:</span><span style="color:#e74c3c; font-weight:bold; font-size:16px;">${nVal}</span></div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;"><span>判定金物:</span><span style="color:#2ecc71; font-weight:bold; font-size:16px;">${nMark}</span></div>
                    
                    <div style="margin-top:10px; background:#fff; padding:10px; border:1px solid #ddd; border-radius:4px;">
                        <div style="font-weight:bold; font-size:11px; color:#7f8c8d; margin-bottom:10px; border-bottom:1px dashed #eee; padding-bottom:5px;">【計算根拠式】</div>
                        <div style="font-size:13px; color:#2c3e50; line-height:1.6; font-family: 'Courier New', Courier, monospace; word-break: break-all;">
                            <div style="margin-bottom:8px;"><b>X方向:</b><br>${calcX}</div>
                            <div><b>Y方向:</b><br>${calcY}</div>
                        </div>
                    </div>

                    <div style="margin-top:10px; font-size:12px; color:#34495e; display:flex; align-items:center; justify-content:space-between;">
                        <span>🏢 軸組階高 (柱長さ):</span>
                        <span><input type="number" id="edit-pillar-h" step="0.001" value="${item.h || floorHeight.toFixed(3)}" style="width:80px; text-align:right;"> m</span>
                    </div>
                </div>
                <div class="prop-edit-row"><label>出隅として強制計算</label><input type="checkbox" id="edit-pillar-corner" ${item.isManualCorner ? "checked" : ""}></div>
                <div class="prop-edit-row"><label>金物指定</label><select id="edit-pillar-mark"><option value="">自動計算</option>${(window.AppState.getHardwareList ? window.AppState.getHardwareList() : []).map(h => `<option value="${h.name}" ${item.manualMark === h.name ? "selected" : ""}>${h.name}</option>`).join("")}</select></div>
            `;
        }
        if (type === 'wall' || type === 'window') {
            const wallLen = item.p1 && item.p2 ? (Math.hypot(item.p2.x - item.p1.x, item.p2.y - item.p1.y) / 1000) : 0;
            return `
                <div style="background:#fff9db; padding:10px; border-radius:6px; border:1px solid #ffe066; margin-bottom:12px; font-size:13px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>📏 壁の長さ:</span><span style="font-weight:bold;">${wallLen.toFixed(3)} m</span></div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span>🏢 軸組階高:</span>
                        <span><input type="number" id="edit-wall-h" step="0.001" value="${item.h || floorHeight.toFixed(3)}" style="width:80px; text-align:right; font-weight:bold;"> m</span>
                    </div>
                </div>
                <div class="prop-edit-row"><label>要素種別</label><select id="edit-element-type" onchange="window.PropertyController.updateWallFields(this.value, null)"><option value="wall" ${type === "wall" ? "selected" : ""}>耐力壁</option><option value="window" ${type === "window" ? "selected" : ""}>開口部</option></select></div><div id="dynamic-fields"></div>`;
        }
        if (type === 'area') {
            const areaVal = window.MathUtils && item.vertices ? (window.MathUtils.polygonArea(item.vertices) / 1000000) : 0;
            return `
                <div style="background:#e3fafc; padding:12px; border-radius:6px; border:1px solid #99e9f2; margin-bottom:15px;">
                    <div style="font-weight:bold; color:#0b7285; border-bottom:2px solid #22b8cf; margin-bottom:10px; font-size:14px;">📐 面積計算</div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>算出面積:</span><span style="color:#15aabf; font-weight:bold; font-size:18px;">${areaVal.toFixed(3)} ㎡</span></div>
                    <div style="font-size:10px; color:#868e96; margin-top:8px;">
                        ※ 頂点座標からの自動計算<br>
                        (多角形面積公式: Σ(xi*yi+1 - xi+1*yi) / 2)
                    </div>
                </div>
                <div class="prop-edit-row"><label>面積の種類</label><select id="edit-area-type">
                    <option value="floor" ${item.areaType === "floor" ? "selected" : ""}>床面積</option>
                    <option value="attic" ${item.areaType === "attic" ? "selected" : ""}>小屋裏</option>
                    <option value="balcony" ${item.areaType === "balcony" ? "selected" : ""}>バルコニー</option>
                    <option value="void" ${item.areaType === "void" ? "selected" : ""}>吹き抜け</option>
                    <option value="porch" ${item.areaType === "porch" ? "selected" : ""}>ポーチ・屋根</option>
                </select></div>`;
        }
        return '';
    },

    updateWallFields: function(type, item) {
        const container = document.getElementById("dynamic-fields");
        if (!container) return;
        if (!item) item = window.AppState.selectedElement.item;

        if (type === "wall") {
            const wallList = (window.WallEngine.getWallSpecList ? window.WallEngine.getWallSpecList() : window.AppState.getMasterWallList())
                .filter(w => w.type !== 'opening');
            const braceList = window.WallEngine.getBraceSpecList ? window.WallEngine.getBraceSpecList() : window.AppState.getMasterBraceList();
            container.innerHTML = `
                <div class="prop-edit-row"><label>外側パネル</label><select id="edit-wall-p1" onchange="window.PropertyController.updateModalTotal()">${wallList.map(o => `<option value="${o.id}" ${item.outPanelId === o.id ? "selected" : ""}>${o.text}</option>`).join("")}</select></div>
                <div class="prop-edit-row"><label>内側パネル</label><select id="edit-wall-p2" onchange="window.PropertyController.updateModalTotal()">${wallList.map(o => `<option value="${o.id}" ${item.inPanelId === o.id ? "selected" : ""}>${o.text}</option>`).join("")}</select></div>
                <div class="prop-edit-row"><label>筋交い</label><select id="edit-wall-b" onchange="window.PropertyController.updateModalTotal()">${braceList.map(o => `<option value="${o.id}" ${item.braceId === o.id ? "selected" : ""}>${o.text}</option>`).join("")}</select></div>
                <div style="text-align:right; font-weight:bold; color:#0056b3; margin-top:10px;">合計倍率: <span id="total-multiplier-modal">0.0</span> 倍</div>
            `;
            this.updateModalTotal();
        } else {
            container.innerHTML = `<div class="prop-edit-row"><label>幅 (mm)</label><input type="number" id="edit-win-width" value="${item.length || 910}"></div>`;
        }
    },

    updateModalTotal: function() {
        const p1 = document.getElementById("edit-wall-p1")?.value;
        const p2 = document.getElementById("edit-wall-p2")?.value;
        const b  = document.getElementById("edit-wall-b")?.value;
        const el = document.getElementById("total-multiplier-modal");
        if (!el) return;

        const p1Val = window.WallEngine.getWallSpec(p1).val || 0;
        const p2Val = window.WallEngine.getWallSpec(p2).val || 0;
        const bVal = (window.WallEngine.getBraceSpec ? window.WallEngine.getBraceSpec(b).val : 0) || 0;
        el.innerText = (p1Val + p2Val + bVal).toFixed(1);
    },

    /**
     * 高さを近接部材へ伝播させる (軸組階高の連動)
     */
    propagateHeight: function(sourceWall, newH) {
        const state = window.AppState;
        const TOL = 10; // 座標一致の許容誤差
        const floor = sourceWall.floor;

        // 同一座標・同一方向の部材を再帰的または一括で検索
        const allWalls = state.walls.concat(state.windowsArr).filter(w => w.floor === floor);
        const allPillars = state.pillars.filter(p => p.floor === floor && !p.isDeleted);

        const targetCoords = [sourceWall.p1, sourceWall.p2];
        const processed = new Set();
        processed.add(sourceWall);

        let queue = [...targetCoords];
        while (queue.length > 0) {
            const current = queue.shift();
            
            // 柱を更新
            allPillars.forEach(p => {
                if (Math.abs(p.x - current.x) < TOL && Math.abs(p.y - current.y) < TOL) {
                    p.h = newH;
                }
            });

            // 隣接する壁を探す
            allWalls.forEach(w => {
                if (processed.has(w)) return;
                const shareP1 = Math.abs(w.p1.x - current.x) < TOL && Math.abs(w.p1.y - current.y) < TOL;
                const shareP2 = Math.abs(w.p2.x - current.x) < TOL && Math.abs(w.p2.y - current.y) < TOL;

                if (shareP1 || shareP2) {
                    // 同一線上（X方向またはY方向が一致）かチェック
                    const isSameLine = (Math.abs(w.p1.x - w.p2.x) < TOL && Math.abs(sourceWall.p1.x - sourceWall.p2.x) < TOL) ||
                                       (Math.abs(w.p1.y - w.p2.y) < TOL && Math.abs(sourceWall.p1.y - sourceWall.p2.y) < TOL);
                    
                    if (isSameLine) {
                        w.h = newH;
                        processed.add(w);
                        queue.push(shareP1 ? w.p2 : w.p1);
                    }
                }
            });
        }
    },

    /**
     * センターパネル（右パネルのツール等）の状態同期
     */
    syncCenterPanel: function(item = null) {
        if (typeof window.updateWallSelects === 'function') {
            window.updateWallSelects(item);
        }
    }
};

/**
 * 右パネルの壁仕様セレクトボックスをマスターリストから構築・更新します
 * @param {Object} overrideItem - 選択中の要素がある場合、その仕様を優先的に表示に反映させる
 */
window.updateWallSelects = function(overrideItem = null) {
    const state = window.AppState;
    if (!state) return;

    // 1. カスタム設定を DOM から AppState へ同期
    if (typeof window.getCustomWallList === 'function') {
        state.customWalls = window.getCustomWallList();
    }

    const wallList = state.getMasterWallList().filter(w => w.type !== 'opening');
    const braceList = state.getMasterBraceList();

    // 面材セレクトの更新
    ['wall-p1', 'wall-p2'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        
        let targetVal = sel.value;
        if (overrideItem) {
            targetVal = (id === 'wall-p1') ? overrideItem.outPanelId : overrideItem.inPanelId;
        }

        sel.innerHTML = wallList.map(o => `<option value="${o.id}" data-val="${o.val}">${o.text}</option>`).join("");
        
        if (targetVal) sel.value = targetVal;
        // フォールバック (値がない場合)
        if (!sel.value && sel.options.length > 0) sel.selectedIndex = 0;
    });

    // 筋交いセレクトの更新
    const bSel = document.getElementById('wall-b');
    if (bSel) {
        let targetVal = bSel.value;
        if (overrideItem) targetVal = overrideItem.braceId;

        bSel.innerHTML = braceList.map(o => `<option value="${o.id}">${o.text}</option>`).join("");
        
        if (targetVal) bSel.value = targetVal;
        if (!bSel.value && bSel.options.length > 0) bSel.selectedIndex = 0;
    }

    // 合計倍率の更新
    const getPV = (id) => {
        const el = document.getElementById(id);
        return (el && el.selectedIndex >= 0) ? parseFloat(el.options[el.selectedIndex].dataset.val || 0) : 0;
    };
    const getBV = (id) => {
        const spec = state.getMasterBraceList().find(b => b.id === (document.getElementById(id)?.value));
        return spec ? spec.val : 0;
    };

    const t = getPV('wall-p1') + getPV('wall-p2') + getBV('wall-b');
    const totalEl = document.getElementById('total-val');
    if (totalEl) {
        totalEl.innerText = t.toFixed(1);
        totalEl.style.color = (t > 7.0) ? "red" : "#0056b3";
    }
    state.currentTotalVal = t;
};
