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
        } else if (oldType === "wall" || oldType === "window") {
            const newType = document.getElementById("edit-element-type").value;
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
        if (type === 'pillar') {
            const nVal = item.nValue !== undefined ? item.nValue.toFixed(3) : '-';
            const nMark = item.nMark || '-';
            const calcX = item.cStrX || '';
            const calcY = item.cStrY || '';
            
            return `
                <div class="prop-edit-row" style="background:#f9f9f9; padding:8px; border-radius:4px; margin-bottom:10px;">
                    <div style="font-weight:bold; color:#2c3e50; border-bottom:1px solid #eee; margin-bottom:5px;">N値計算結果</div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:3px;"><span>算定N値:</span><span style="color:#e74c3c; font-weight:bold;">${nVal}</span></div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>判定金物:</span><span style="color:#2ecc71; font-weight:bold;">${nMark}</span></div>
                    <div style="font-size:10px; color:#7f8c8d; line-height:1.2; background:#fff; padding:4px; border:1px solid #eee;">
                        X式: ${calcX}<br>
                        Y式: ${calcY}
                    </div>
                </div>
                <div class="prop-edit-row"><label>出隅として強制計算</label><input type="checkbox" id="edit-pillar-corner" ${item.isManualCorner ? "checked" : ""}></div>
                <div class="prop-edit-row"><label>金物指定</label><select id="edit-pillar-mark"><option value="">自動計算</option>${(window.AppState.getHardwareList ? window.AppState.getHardwareList() : []).map(h => `<option value="${h.name}" ${item.manualMark === h.name ? "selected" : ""}>${h.name}</option>`).join("")}</select></div>
            `;
        }
        if (type === 'wall' || type === 'window') {
            return `<div class="prop-edit-row"><label>要素種別</label><select id="edit-element-type" onchange="window.PropertyController.updateWallFields(this.value, null)"><option value="wall" ${type === "wall" ? "selected" : ""}>耐力壁</option><option value="window" ${type === "window" ? "selected" : ""}>開口部</option></select></div><div id="dynamic-fields"></div>`;
        }
        if (type === 'area') {
            return `<div class="prop-edit-row"><label>面積の種類</label><select id="edit-area-type">
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
