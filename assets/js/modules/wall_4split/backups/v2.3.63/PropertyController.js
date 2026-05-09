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
        let html = `<div class="calc-box" style="padding:10px; max-height:550px; overflow-y:auto; font-family:sans-serif;">
            <div style="font-size:12px; font-weight:bold; color:#2c3e50; border-bottom:2px solid #8e44ad; margin-bottom:10px; padding-bottom:5px;">🏗️ 基礎梁 解析結果</div>
            <table style="width:100%; border-collapse:collapse; font-size:10px;">
                <thead>
                    <tr style="background:#f8f9fa; border-bottom:1px solid #ddd;">
                        <th style="padding:5px; text-align:left;">No.</th>
                        <th style="padding:5px; text-align:left;">寸法/配筋</th>
                        <th style="padding:5px; text-align:right;">長期応力/短期軸力</th>
                        <th style="padding:5px; text-align:center;">判定</th>
                    </tr>
                </thead>
                <tbody>`;
        
        beam.spans.forEach((span, idx) => {
            const p = span.props || beam.props;
            const st = span.fdStress; // FoundationEngine sets this
            const badge = span.isNG ? '<span style="background:#e74c3c; color:#fff; padding:2px 4px; border-radius:3px; font-weight:bold;">NG</span>' : '<span style="background:#27ae60; color:#fff; padding:2px 4px; border-radius:3px; font-weight:bold;">OK</span>';
            
            // 応力詳細
            let stressInfo = "-";
            if (st) {
                const M_L = (st.M_mid_kNm || 0).toFixed(2);
                const Q_L = (st.Q_max_kN || 0).toFixed(2);
                const Ne_S = (st.st?.Ne_N || 0).toFixed(0);
                const ratio = st.ratioCombined_S ? st.ratioCombined_S.toFixed(2) : (st.ratioM_L ? st.ratioM_L.toFixed(2) : "0.00");
                
                stressInfo = `<div style="line-height:1.4;">
                    長期: M=${M_L}kNm / Q=${Q_L}kN<br>
                    短期: <b style="color:#e67e22;">Ne=${Ne_S} N</b> (B=0.5)<br>
                    検定比: <b style="${parseFloat(ratio) > 1.0 ? 'color:red' : 'color:#2980b9'}">${ratio}</b>
                </div>`;
            }

            html += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:8px 5px; vertical-align:top;">${idx+1}</td>
                <td style="padding:8px 5px; vertical-align:top;">
                    <div style="margin-bottom:5px;">
                        <input type="number" value="${p.width}" onchange="window.PropertyController.updateFdProp('beam', ${beam.id}, 'width', this.value, ${idx})" style="width:40px; padding:2px;"> × 
                        <input type="number" value="${p.height}" onchange="window.PropertyController.updateFdProp('beam', ${beam.id}, 'height', this.value, ${idx})" style="width:40px; padding:2px;">
                    </div>
                    <div style="font-size:9px; color:#666;">
                        主筋: ${p.bottomRebar || '1-D13'}<br>
                        ST筋: ${p.stirrup || '1-D10@200'}
                    </div>
                </td>
                <td style="padding:8px 5px; vertical-align:top; text-align:right;">${stressInfo}</td>
                <td style="padding:8px 5px; vertical-align:top; text-align:center;">${badge}</td>
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
                <!-- 1. 結果セクション -->
                <div style="background:#f0f7ff; padding:15px; border-radius:8px; border:1px solid #bce8f1; margin-bottom:15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="font-weight:bold; color:#2c3e50; border-bottom:2px solid #3498db; margin-bottom:12px; font-size:14px; display:flex; align-items:center; gap:5px;">
                        <span style="font-size:18px;">📊</span> N値算定結果
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
                        <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #d1d1d1; text-align:center;">
                            <div style="font-size:11px; color:#7f8c8d; margin-bottom:4px;">算定N値</div>
                            <div style="color:#e74c3c; font-weight:bold; font-size:20px;">${nVal}</div>
                        </div>
                        <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #d1d1d1; text-align:center;">
                            <div style="font-size:11px; color:#7f8c8d; margin-bottom:4px;">判定金物</div>
                            <div style="color:#2ecc71; font-weight:bold; font-size:18px;">${nMark}</div>
                        </div>
                    </div>
                </div>

                <!-- 2. 計算根拠セクション -->
                <div style="background:#fff; padding:12px; border:1px solid #d1d1d1; border-radius:8px; margin-bottom:15px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-weight:bold; font-size:12px; color:#2c3e50; margin-bottom:12px; border-bottom:2px solid #3498db; padding-bottom:5px;">【 N値 計算根拠式 】</div>
                    <div style="font-size:13px; color:#2c3e50; line-height:1.6; font-family: 'Consolas', 'Monaco', monospace;">
                        <div style="margin-bottom:12px; padding:8px; background:#f8f9fa; border-left:4px solid #3498db; border-radius: 0 4px 4px 0;">
                            <b style="color:#2980b9; display:block; margin-bottom:4px; font-size:11px; border-bottom:1px solid #eee;">X方向地震 (Y方向壁 左右差)</b>
                            <div style="padding-left:10px;">${calcX}</div>
                        </div>
                        <div style="padding:8px; background:#f8f9fa; border-left:4px solid #3498db; border-radius: 0 4px 4px 0;">
                            <b style="color:#2980b9; display:block; margin-bottom:4px; font-size:11px; border-bottom:1px solid #eee;">Y方向地震 (X方向壁 上下差)</b>
                            <div style="padding-left:10px;">${calcY}</div>
                        </div>
                    </div>
                </div>

                <!-- 3. 設定セクション -->
                <div style="background:#fdfdfe; padding:15px; border-radius:8px; border:1px solid #dee2e6; border-top: 4px solid #adb5bd;">
                    <div style="font-weight:bold; font-size:12px; color:#495057; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.5px;">⚙️ 各種設定</div>
                    
                    <div class="prop-edit-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:5px 0; border-bottom:1px dashed #eee;">
                        <label style="font-size:13px; color:#34495e;">🏢 軸組階高 (柱長さ)</label>
                        <div style="display:flex; align-items:center; gap:5px;">
                            <input type="number" id="edit-pillar-h" step="0.001" value="${item.h || floorHeight.toFixed(3)}" style="width:90px; text-align:right; font-weight:bold; padding:4px;">
                            <span style="font-size:12px; color:#7f8c8d;">m</span>
                        </div>
                    </div>

                    <div class="prop-edit-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:5px 0; border-bottom:1px dashed #eee;">
                        <label style="font-size:13px; color:#34495e;">🚩 出隅として強制計算</label>
                        <input type="checkbox" id="edit-pillar-corner" ${item.isManualCorner ? "checked" : ""} style="transform:scale(1.2);">
                    </div>

                    <div class="prop-edit-row" style="display:flex; justify-content:space-between; align-items:center; padding:5px 0;">
                        <label style="font-size:13px; color:#34495e;">🔨 金物指定</label>
                        <select id="edit-pillar-mark" style="padding:4px; font-weight:bold; color:#2c3e50;">
                            <option value="">自動計算</option>
                            ${(window.AppState.getHardwareList ? window.AppState.getHardwareList() : []).map(h => `<option value="${h.name}" ${item.manualMark === h.name ? "selected" : ""}>${h.name}</option>`).join("")}
                        </select>
                    </div>
                </div>
            `;
        }
        if (type === 'wall' || type === 'window') {
            const wallLen = item.p1 && item.p2 ? (Math.hypot(item.p2.x - item.p1.x, item.p2.y - item.p1.y) / 1000) : 0;
            const widthInput = type === 'window' 
                ? `<span><input type="number" id="edit-win-width" value="${item.length || (wallLen * 1000).toFixed(0)}" style="width:70px; text-align:right;"> mm</span>`
                : `<span style="font-weight:bold;">${(wallLen * 1000).toFixed(0)} mm</span>`;
            
            return `
                <div style="background:#fff9db; padding:10px; border-radius:6px; border:1px solid #ffe066; margin-bottom:12px; font-size:13px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <span>📏 ${type === 'wall' ? '耐力壁' : '開口'}幅:</span>
                        ${widthInput}
                    </div>
                    ${type === 'wall' ? '<div style="font-size:10px; color:#e67e22; margin-top:-5px; margin-bottom:10px;">※耐力壁の幅は柱間距離で自動決定されます</div>' : ''}
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
                    <div style="display:flex; flex-direction:column; gap:5px; margin-bottom:5px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span>算出面積:</span>
                            <span style="color:#15aabf; font-weight:bold; font-size:18px;">${areaVal.toFixed(3)} ㎡</span>
                        </div>
                        <div style="background:rgba(255,255,255,0.6); padding:8px; border-radius:4px; font-family:monospace; font-size:12px; color:#2c3e50; border:1px dashed #22b8cf; margin-top:5px;">
                            <b style="color:#0891b2;">算定根拠:</b><br>
                            ${window.MathUtils.getAreaFormula(item.vertices)}
                        </div>
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

    // セレクトボックスの更新対象 (メイン hidden & モーダル)
    const targets = [
        { id: 'wall-p1', modalId: 'wall-p1-modal', type: 'p1' },
        { id: 'wall-p2', modalId: 'wall-p2-modal', type: 'p2' },
        { id: 'wall-b',  modalId: 'wall-b-modal',  type: 'b' }
    ];

    targets.forEach(target => {
        const sel = document.getElementById(target.id);
        const modSel = document.getElementById(target.modalId);
        
        const list = (target.type === 'b') ? braceList : wallList;
        const html = list.map(o => `<option value="${o.id}" data-val="${o.val || 0}">${o.text}</option>`).join("");
        
        if (sel) {
            const oldVal = sel.value;
            sel.innerHTML = html;
            if (overrideItem) sel.value = (target.type === 'p1') ? overrideItem.outPanelId : (target.type === 'p2' ? overrideItem.inPanelId : overrideItem.braceId);
            else if (oldVal) sel.value = oldVal;
            if (!sel.value && sel.options.length > 0) sel.selectedIndex = 0;
        }
        if (modSel) {
            const oldVal = modSel.value;
            modSel.innerHTML = html;
            modSel.setAttribute('onchange', 'syncWallModalToMain()'); // Ensure listener is present
            if (sel) modSel.value = sel.value;
            else if (oldVal) modSel.value = oldVal;
            if (!modSel.value && modSel.options.length > 0) modSel.selectedIndex = 0;
        }
    });

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
    
    // 表示更新
    const totalEl = document.getElementById('total-val');
    if (totalEl) {
        totalEl.innerText = t.toFixed(1);
        totalEl.style.color = (t > 7.0) ? "red" : "#0056b3";
    }
    const totalModalEl = document.getElementById('total-val-modal');
    if (totalModalEl) {
        totalModalEl.innerText = t.toFixed(1);
    }
    
    if (window.UIView && window.UIView.updateWallSpecSummary) {
        window.UIView.updateWallSpecSummary();
    }
    
    state.currentTotalVal = t;
};
