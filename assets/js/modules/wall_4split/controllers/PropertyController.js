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

        if (item && item.id !== undefined) {
            if (type === 'beam' || type === 'beam_span') {
                const freshItem = window.AppState.foundationBeams.find(b => b.id === item.id);
                if (freshItem) item = freshItem;
            } else if (type === 'slab') {
                const freshItem = window.AppState.foundationSlabs.find(s => s.id === item.id);
                if (freshItem) item = freshItem;
            }
        }

        window.AppState.fdSelection = { type, item };
        const popup = document.getElementById('fd-property-popup');
        const title = document.getElementById('fd-popup-title');
        const content = document.getElementById('fd-popup-content');
        if (!popup || !title || !content) return;

        // すでに表示されている場合はウィンドウ位置を維持
        if (popup.style.display !== 'block') {
            if ((type === 'beam' || type === 'beam_span') && item && item.fdStress && item.fdStress.isNG) {
                alert("🚨 この基礎梁には断面検定がNGのスパンがあります！判定表をご確認ください。");
            }
            const cp = document.getElementById('center-panel');
            let width = 750; 
            if (cp) {
                const rect = cp.getBoundingClientRect();
                width = Math.max(600, Math.round(rect.width * 0.8)); // センターパネルの80%、最低600px
                const height = Math.round(window.innerHeight * 0.85); 
                let px = rect.left + (rect.width - width) / 2;
                let py = (window.innerHeight - height) / 2;
                popup.style.width = width + 'px';
                popup.style.height = height + 'px';
                popup.style.left = Math.max(10, px) + 'px';
                popup.style.top = Math.max(10, py) + 'px';
                popup.style.overflowX = 'auto'; // 横スクロール対応
            } else {
                width = Math.max(600, Math.round(window.innerWidth * 0.8));
                let px = (window.innerWidth - width) / 2;
                let py = (window.innerHeight - 600) / 2;
                popup.style.width = width + 'px';
                popup.style.left = Math.max(10, px) + 'px';
                popup.style.top = Math.max(10, py) + 'px';
            }
        }
        popup.style.display = 'block';

        this.initDragHandler(popup);

        // コンテンツの生成 (スクロール位置を保持)
        const scrollEl = content.querySelector('.calc-box');
        const savedScrollTop = scrollEl ? scrollEl.scrollTop : 0;

        try {
            content.innerHTML = this.generateFdContentHtml(type, item);
        } catch (err) {
            console.error("Foundation Modal Rendering Error:", err);
            content.innerHTML = `
                <div style="padding:20px; color:#c0392b; background:#fdf2f2; border:1px solid #f5b7b1; border-radius:8px; font-family:sans-serif;">
                    <div style="font-weight:bold; font-size:16px; margin-bottom:10px;">❌ 表示エラーが発生しました</div>
                    <div style="font-size:12px; line-height:1.6;">
                        データの整合性エラーにより詳細画面を表示できません。<br>
                        「解析の再実行」ボタンを押すか、通り芯・柱の配置を再度確認してください。
                    </div>
                    <pre style="margin-top:15px; font-size:10px; background:#fff; padding:10px; border:1px solid #ddd; overflow:auto;">${err.stack || err.message}</pre>
                </div>
            `;
        }

        const newScrollEl = content.querySelector('.calc-box');
        if (newScrollEl) newScrollEl.scrollTop = savedScrollTop;

        window.triggerUpdate();
    },

    hideFdPopup: function() {
        const type = window.AppState.fdSelection.type;
        const item = window.AppState.fdSelection.item;
        if ((type === 'beam' || type === 'beam_span') && item && item.fdStress && item.fdStress.isNG) {
            alert("⚠️ 断面検定にNGがある状態です。配筋や断面寸法を再調整してください。");
        }
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

        let finalVal = (isNaN(val) || val === '' || keyPath.includes('name') || keyPath.includes('symbol') || keyPath.includes('type') || keyPath.includes('support') || keyPath.includes('Rebar') || keyPath.includes('stirrup')) ? val : parseFloat(val);

        if ((type === 'beam' || type === 'beam_span') && spanIndex !== null) {
            const span = item.spans[spanIndex];
            if (span) {
                if (!span.props) span.props = JSON.parse(JSON.stringify(item.props));
                span.props[keyPath] = finalVal;
            }
        } else {
            if (!item.props) item.props = {};
            const keys = keyPath.split('.');
            let target = (type === 'slab' || type === 'beam' || type === 'beam_span') ? item.props : item;
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
            const freshSlab = state.foundationSlabs.find(s => s.id === id) || item;
            const reportCont = document.getElementById('slab-calc-result-container');
            if (reportCont && typeof getFoundationSlabReportHtml === 'function') {
                reportCont.innerHTML = getFoundationSlabReportHtml(freshSlab);
            }
        } else {
            const popupType = (type === 'beam_span') ? 'beam' : type;
            const freshBeam = state.foundationBeams.find(b => b.id === id) || item;
            setTimeout(() => this.showFdPopup(popupType, freshBeam, this.lastPopupMx, this.lastPopupMy), 0);
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
            const gridName = window.getGridNameAt ? window.getGridNameAt(item.x, item.y) : null;
            const isDefaultName = !item.name || 
                                 /^(P|M)_?(P|M)?\d+$/i.test(item.name) || 
                                 item.name.toLowerCase().startsWith('pillar') || 
                                 item.name === `P_${item.id}` || 
                                 item.name === item.id;
            if (isDefaultName && gridName) item.name = gridName;
        } else {
            window.AppState.selectedPillar = null;
        }

        const headerTitle = document.querySelector("#modal-prop-header h3");
        if (headerTitle) {
            if (type === 'pillar') {
                const gridName = window.getGridNameAt ? window.getGridNameAt(item.x, item.y) : null;
                headerTitle.innerText = `柱プロパティ [${gridName || item.name || `P_${item.id}`}]`;
            } else if (type === 'wall') {
                headerTitle.innerText = `耐力壁プロパティ`;
            } else if (type === 'window') {
                headerTitle.innerText = `開口部プロパティ`;
            } else {
                headerTitle.innerText = `要素のプロパティ編集`;
            }
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
            item.name = document.getElementById("edit-pillar-name").value || null;
            
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
        if (type === 'beam' || type === 'beam_span') return this.generateBeamHtml(item);
        if (type === 'slab') return this.generateSlabHtml(item);
        if (type === 'manhole') return `<div class="calc-box"><div class="calc-row"><label>開口幅(mm)</label><input type="number" value="${item.width}" onchange="window.PropertyController.updateFdProp('manhole', ${item.id}, 'width', this.value)"></div></div>`;
        if (type === 'ext_wall') {
            let len = 0;
            const vts = item.vertices || [];
            for (let i = 0; i < vts.length - 1; i++) {
                len += Math.hypot(vts[i+1].x - vts[i].x, vts[i+1].y - vts[i].y);
            }
            if (item.closed && vts.length > 2) {
                len += Math.hypot(vts[vts.length - 1].x - vts[0].x, vts[vts.length - 1].y - vts[0].y);
            }
            const lenM = (len / 1000).toFixed(2); // converting from mm to meters
            return `<div class="calc-box" style="padding:15px; font-family:sans-serif; background:#ffffff; color:#333; line-height:1.5;">
                <div style="font-size:14px; font-weight:bold; color:#e67e22; border-bottom:2px solid #e67e22; margin-bottom:12px; padding-bottom:6px;">🧱 外壁線 プロパティ</div>
                <div style="margin-bottom:8px; font-size:12px;">
                    <span style="width:100px; display:inline-block; font-weight:bold; color:#7f8c8d;">種別:</span> <span style="font-weight:bold; color:#2c3e50;">外壁線（荷重評価用）</span>
                </div>
                <div style="margin-bottom:8px; font-size:12px;">
                    <span style="width:100px; display:inline-block; font-weight:bold; color:#7f8c8d;">配置階:</span> <span style="font-weight:bold; color:#2c3e50;">${item.floor || '1F'}</span>
                </div>
                <div style="margin-bottom:8px; font-size:12px;">
                    <span style="width:100px; display:inline-block; font-weight:bold; color:#7f8c8d;">壁延長 (L):</span> <span style="font-weight:bold; color:#d35400; font-size:14px;">${lenM} m</span>
                </div>
                <div style="margin-bottom:8px; font-size:12px;">
                    <span style="width:100px; display:inline-block; font-weight:bold; color:#7f8c8d;">形状:</span> <span style="font-weight:bold; color:#2c3e50;">${item.closed ? '閉じた多角形（ループ）' : '一筆書き（オープン）'}</span>
                </div>
            </div>`;
        }
        return '';
    },

    generateBeamHtml: function(beam) {
        const bp = beam.props || {};

        const parseRebarInput = (str) => {
            const m = (str || '1-D13').match(/^(\d+)-D([A-Za-z0-9]+)/i);
            if (!m) return { count: 1, type: 'D13' };
            return { count: parseInt(m[1]) || 1, type: 'D' + m[2].toUpperCase() };
        };

        const parseStirrupInput = (str) => {
            const m = (str || '1-D10@200').match(/^(\d+)-D(\d+)@(\d+)/i);
            if (!m) return { count: 1, type: 'D10', pitch: '200' };
            return { count: parseInt(m[1]) || 1, type: 'D' + m[2], pitch: m[3] };
        };

        // 通り名の特定
        const getBeamAxisName = () => {
            return window.GridEngine ? window.GridEngine.getLineAxisName(beam.p1, beam.p2, window.AppState) : '';
        };
        const beamAxisName = getBeamAxisName();

        let html = `<div class="calc-box" style="padding:10px; height:100%; overflow:auto; font-family:sans-serif; box-sizing:border-box;">
            <div style="font-size:12px; font-weight:bold; color:#2c3e50; border-bottom:2px solid #8e44ad; margin-bottom:10px; padding-bottom:5px;">🏗️ 基礎梁 計算条件</div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; background:#fdfafa; padding:8px; border-radius:6px; margin-bottom:12px; border:1px solid #f1e5f5; font-size:11px;">
                <div>
                    <label style="font-weight:bold; color:#7d3c98; display:block; margin-bottom:2px;">配置通り芯</label>
                    <div style="background:#fff; border:1px solid #ddd; padding:4px; border-radius:4px; font-weight:bold; color:#2c3e50; text-align:center;">${beamAxisName ? beamAxisName + '通り' : '個別計算'}</div>
                </div>
                <div>
                    <label style="font-weight:bold; color:#7d3c98; display:block; margin-bottom:2px;">B (反曲点高比)</label>
                    <input type="number" step="0.05" min="0" max="1" value="${bp.B_val !== undefined ? bp.B_val : 0.5}" onchange="window.PropertyController.updateFdProp('beam', ${beam.id}, 'B_val', this.value)" style="width:100%; box-sizing:border-box; padding:4px; border:1px solid #ccc; border-radius:4px;">
                </div>
                <div>
                    <label style="font-weight:bold; color:#7d3c98; display:block; margin-bottom:2px;">モデル選択</label>
                    <select onchange="window.PropertyController.updateFdProp('beam', ${beam.id}, 'modelType', this.value)" style="width:100%; box-sizing:border-box; padding:4px; border:1px solid #ccc; border-radius:4px; background:#fff;">
                        <option value="both_ends" ${bp.modelType !== 'pillar_supported' ? 'selected' : ''}>両端支点（連続梁）</option>
                        <option value="pillar_supported" ${bp.modelType === 'pillar_supported' ? 'selected' : ''}>柱直下支点（連続梁）</option>
                    </select>
                </div>
            </div>`;

        if (beam.fdStress && beam.fdStress.pillars && beam.fdStress.pillars.length > 0) {
            const getFreshPillarName = (p) => {
                if (!p) return '支点';
                const px = p.globalX ?? (p.x * 1000) ?? 0;
                const py = p.globalY ?? (p.y * 1000) ?? 0;
                const gridName = window.getGridNameAt ? window.getGridNameAt(px, py) : null;
                const isDefault = !p.name || /^(P|M)_?(P|M)?\d+$/i.test(p.name) || p.name.toLowerCase().startsWith('pillar') || p.name === `P_${p.id}` || p.name === p.id || p.name.startsWith('支点') || (p.id && p.id.startsWith('support'));
                let rawName = isDefault ? (gridName || p.name || `P_${p.id}`) : p.name;
                
                if (beamAxisName && rawName.includes(beamAxisName)) {
                    rawName = rawName.replace(beamAxisName, '').replace(/^[ -]+|[ -]+$/g, '');
                }
                return rawName || '支点';
            };

            const getFreshSpanName = (span) => {
                if (!span) return '柱間';
                const p1Name = getFreshPillarName(span.startNode);
                const p2Name = getFreshPillarName(span.endNode);
                return `${p1Name}-${p2Name}`;
            };

            // (0) 応力分布図
            html += `<div style="font-size:11px; font-weight:bold; color:#2c3e50; border-bottom:1px solid #8e44ad; margin:15px 0 8px 0; padding-bottom:3px;">📊 応力分布図（短期軸力図・M図・Q図）</div>`;
            html += this.generateStressDiagramsSvg(beam, beamAxisName);

            // (1) 応力の算定（水平荷重時）
            html += `<div style="font-size:11px; font-weight:bold; color:#2c3e50; border-bottom:1px solid #8e44ad; margin:15px 0 5px 0; padding-bottom:3px;">📈 (1) 応力の算定（水平荷重時）</div>`;
            const B_val = bp.B_val !== undefined ? parseFloat(bp.B_val) : 0.5;
            const modelType = bp.modelType || 'both_ends';
            const dispB = (modelType === 'pillar_supported') ? 1.0 : B_val;
            
            let table1 = `<table style="width:100%; border-collapse:collapse; font-size:9px; margin-bottom:12px; border:1px solid #ddd;">
                <thead>
                    <tr style="background:#f2f4f4; border-bottom:1px solid #ddd;">
                        <th rowspan="2" style="border:1px solid #ddd; padding:3px;">柱</th>
                        <th rowspan="2" style="border:1px solid #ddd; padding:3px;">x(m)</th>
                        <th colspan="4" style="border:1px solid #ddd; padding:3px; text-align:center; background:#ebf5fb;">左加力 (B=${dispB.toFixed(3)})</th>
                        <th colspan="4" style="border:1px solid #ddd; padding:3px; text-align:center; background:#fdf2e9;">右加力 (B=${dispB.toFixed(3)})</th>
                    </tr>
                    <tr style="background:#f2f4f4; border-bottom:1px solid #ddd;">
                        <th style="border:1px solid #ddd; padding:2px;">Td</th>
                        <th style="border:1px solid #ddd; padding:2px;">R</th>
                        <th style="border:1px solid #ddd; padding:2px;">Qe</th>
                        <th style="border:1px solid #ddd; padding:2px;">Mf</th>
                        <th style="border:1px solid #ddd; padding:2px;">Td</th>
                        <th style="border:1px solid #ddd; padding:2px;">R</th>
                        <th style="border:1px solid #ddd; padding:2px;">Qe</th>
                        <th style="border:1px solid #ddd; padding:2px;">Mf</th>
                    </tr>
                </thead>
                <tbody>`;
            
            const pillars = beam.fdStress.pillars;
            const seismic = beam.fdStress.seismic || { leftward: { Td:[], Qe:[], Mf:[] }, rightward: { Td:[], Qe:[], Mf:[] } };

            pillars.forEach((p, idx) => {
                const l_Td = (seismic.leftward.Td?.[idx] ?? 0).toFixed(3);
                const l_R_val = seismic.leftward.R ? (seismic.leftward.R[idx] ?? 0) : (idx === seismic.leftward.supportIdx1 ? (seismic.leftward.R_left ?? 0) : (idx === seismic.leftward.supportIdx2 ? (seismic.leftward.R_right ?? 0) : 0));
                const l_Qe = (seismic.leftward.Qe?.[idx] ?? 0).toFixed(3);
                const l_Mf = (seismic.leftward.Mf?.[idx] ?? 0).toFixed(3);

                const r_Td = (seismic.rightward.Td?.[idx] ?? 0).toFixed(3);
                const r_R_val = seismic.rightward.R ? (seismic.rightward.R[idx] ?? 0) : (idx === seismic.rightward.supportIdx1 ? (seismic.rightward.R_left ?? 0) : (idx === seismic.rightward.supportIdx2 ? (seismic.rightward.R_right ?? 0) : 0));
                const r_Qe = (seismic.rightward.Qe?.[idx] ?? 0).toFixed(3);
                const r_Mf = (seismic.rightward.Mf?.[idx] ?? 0).toFixed(3);

                table1 += `<tr>
                    <td style="border:1px solid #ddd; padding:3px; font-weight:bold;">${getFreshPillarName(p)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right;">${(p.x ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; background:#f4f6f7;">${l_Td}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; background:#f4f6f7;">${l_R_val.toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#2980b9;">${l_Qe}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#27ae60;">${l_Mf}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; background:#fdfefe;">${r_Td}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; background:#fdfefe;">${r_R_val.toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#c0392b;">${r_Qe}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#d35400;">${r_Mf}</td>
                </tr>`;
            });
            table1 += `</tbody></table>`;
            html += table1;

            // (2) 応力の算定（長期）
            html += `<div style="font-size:11px; font-weight:bold; color:#2c3e50; border-bottom:1px solid #8e44ad; margin:15px 0 5px 0; padding-bottom:3px;">📈 (2) 応力の算定（長期）</div>`;
            let table2 = `<table style="width:100%; border-collapse:collapse; font-size:9px; margin-bottom:12px; border:1px solid #ddd;">
                <thead>
                    <tr style="background:#f2f4f4; border-bottom:1px solid #ddd;">
                        <th style="border:1px solid #ddd; padding:3px;">柱間</th>
                        <th style="border:1px solid #ddd; padding:3px;">長さL(m)</th>
                        <th style="border:1px solid #ddd; padding:3px;">σe (kN/㎡)</th>
                        <th style="border:1px solid #ddd; padding:3px;">負担幅 B(m)</th>
                        <th style="border:1px solid #ddd; padding:3px;">M中(kNm)</th>
                        <th style="border:1px solid #ddd; padding:3px;">M端(kNm)</th>
                        <th style="border:1px solid #ddd; padding:3px;">QL(kN)</th>
                    </tr>
                </thead>
                <tbody>`;
            
            const spans = beam.fdStress.spans || [];
            spans.forEach(span => {
                table2 += `<tr>
                    <td style="border:1px solid #ddd; padding:3px; font-weight:bold;">${getFreshSpanName(span)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right;">${(span.L ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right;">${(span.sigma_e ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right;">${(span.B_trib ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#27ae60;">${(span.M_mid ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#2980b9;">${(span.M_end ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#7d3c98;">${(span.Q_L ?? 0).toFixed(3)}</td>
                </tr>`;
            });
            table2 += `</tbody></table>`;
            html += table2;

            // (3) 応力の算定（短期）
            html += `<div style="font-size:11px; font-weight:bold; color:#2c3e50; border-bottom:1px solid #8e44ad; margin:15px 0 5px 0; padding-bottom:3px;">📈 (3) 応力の算定（短期）</div>`;
            let table3 = `<table style="width:100%; border-collapse:collapse; font-size:9px; margin-bottom:12px; border:1px solid #ddd;">
                <thead>
                    <tr style="background:#f2f4f4; border-bottom:1px solid #ddd;">
                        <th rowspan="2" style="border:1px solid #ddd; padding:3px;">柱間</th>
                        <th colspan="3" style="border:1px solid #ddd; padding:3px; text-align:center; background:#ebf5fb;">左加力 (QL + Qe)</th>
                        <th colspan="3" style="border:1px solid #ddd; padding:3px; text-align:center; background:#fdf2e9;">右加力 (QL + Qe)</th>
                    </tr>
                    <tr style="background:#f2f4f4; border-bottom:1px solid #ddd;">
                        <th style="border:1px solid #ddd; padding:2px;">M端(左)</th>
                        <th style="border:1px solid #ddd; padding:2px;">M端(右)</th>
                        <th style="border:1px solid #ddd; padding:2px;">QS (kN)</th>
                        <th style="border:1px solid #ddd; padding:2px;">M端(左)</th>
                        <th style="border:1px solid #ddd; padding:2px;">M端(右)</th>
                        <th style="border:1px solid #ddd; padding:2px;">QS (kN)</th>
                    </tr>
                </thead>
                <tbody>`;
            
            spans.forEach(span => {
                table3 += `<tr>
                    <td style="border:1px solid #ddd; padding:3px; font-weight:bold;">${getFreshSpanName(span)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; color:#2980b9;">${(span.leftward?.M_left ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; color:#27ae60;">${(span.leftward?.M_right ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#7d3c98;">${(span.leftward?.Q ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; color:#c0392b;">${(span.rightward?.M_left ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; color:#e67e22;">${(span.rightward?.M_right ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#e74c3c;">${(span.rightward?.Q ?? 0).toFixed(3)}</td>
                </tr>`;
            });
            table3 += `</tbody></table>`;
            html += table3;

            // (4) 許容耐力の算定（1）
            html += `<div style="font-size:11px; font-weight:bold; color:#2c3e50; border-bottom:1px solid #8e44ad; margin:15px 0 5px 0; padding-bottom:3px;">📈 (4) 許容耐力の算定（1 - 曲げ）</div>`;
            let table4 = `<table style="width:100%; border-collapse:collapse; font-size:9px; margin-bottom:12px; border:1px solid #ddd;">
                <thead>
                    <tr style="background:#f2f4f4; border-bottom:1px solid #ddd;">
                        <th rowspan="2" style="border:1px solid #ddd; padding:3px;">柱間</th>
                        <th rowspan="2" style="border:1px solid #ddd; padding:3px;">成 D(mm)</th>
                        <th rowspan="2" style="border:1px solid #ddd; padding:3px;">根入れ h(mm)</th>
                        <th colspan="4" style="border:1px solid #ddd; padding:3px; text-align:center; background:#ebf5fb;">上端主筋</th>
                        <th colspan="4" style="border:1px solid #ddd; padding:3px; text-align:center; background:#fdf2e9;">下端主筋</th>
                    </tr>
                    <tr style="background:#f2f4f4; border-bottom:1px solid #ddd;">
                        <th style="border:1px solid #ddd; padding:2px;">鉄筋</th>
                        <th style="border:1px solid #ddd; padding:2px;">at(㎟)</th>
                        <th style="border:1px solid #ddd; padding:2px;">lMa(長期)</th>
                        <th style="border:1px solid #ddd; padding:2px;">sMa(短期)</th>
                        <th style="border:1px solid #ddd; padding:2px;">鉄筋</th>
                        <th style="border:1px solid #ddd; padding:2px;">at(㎟)</th>
                        <th style="border:1px solid #ddd; padding:2px;">lMa(長期)</th>
                        <th style="border:1px solid #ddd; padding:2px;">sMa(短期)</th>
                    </tr>
                </thead>
                <tbody>`;
            
            spans.forEach((span, sIdx) => {
                const sTopRebar = span.props?.topRebar || bp.topRebar || '1-D13';
                const sBottomRebar = span.props?.bottomRebar || bp.bottomRebar || '1-D13';
                const currentTop = parseRebarInput(sTopRebar);
                const currentBot = parseRebarInput(sBottomRebar);

                const topCountId = `top-count-${beam.id}-${sIdx}`;
                const topTypeId = `top-type-${beam.id}-${sIdx}`;
                const botCountId = `bot-count-${beam.id}-${sIdx}`;
                const botTypeId = `bot-type-${beam.id}-${sIdx}`;

                const topArea = (window.FoundationEngine && window.FoundationEngine.parseRebar) ? window.FoundationEngine.parseRebar(sTopRebar).area : 127;
                const botArea = (window.FoundationEngine && window.FoundationEngine.parseRebar) ? window.FoundationEngine.parseRebar(sBottomRebar).area : 127;

                table4 += `<tr>
                    <td style="border:1px solid #ddd; padding:3px; font-weight:bold;">${getFreshSpanName(span)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:center;">
                        <input type="number" step="10" value="${span.props?.height || bp.height || 640}" onchange="window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'height', this.value, ${sIdx})" style="width:42px; padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; text-align:right;">
                    </td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:center;">
                        <input type="number" step="10" value="${span.props?.embedDepth !== undefined ? span.props.embedDepth : (bp.embedDepth !== undefined ? bp.embedDepth : 250)}" onchange="window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'embedDepth', this.value, ${sIdx})" style="width:42px; padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; text-align:right;">
                    </td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:center; white-space:nowrap;">
                        <input type="number" id="${topCountId}" min="1" value="${currentTop.count}" onchange="const typeVal = document.getElementById('${topTypeId}').value; window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'topRebar', this.value + '-' + typeVal, ${sIdx})" style="width:35px; padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; text-align:right;">-
                        <select id="${topTypeId}" onchange="const countVal = document.getElementById('${topCountId}').value; window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'topRebar', countVal + '-' + this.value, ${sIdx})" style="padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; background:#fff; max-width:75px;">
                            <option value="D13" ${currentTop.type === 'D13' ? 'selected' : ''}>D13</option>
                            <option value="D16" ${currentTop.type === 'D16' ? 'selected' : ''}>D16</option>
                            <option value="D19" ${currentTop.type === 'D19' ? 'selected' : ''}>D19</option>
                            <option value="D13D16" ${currentTop.type === 'D13D16' ? 'selected' : ''}>D13D16</option>
                            <option value="D13D19" ${currentTop.type === 'D13D19' ? 'selected' : ''}>D13D19</option>
                            <option value="D16D19" ${currentTop.type === 'D16D19' ? 'selected' : ''}>D16D19</option>
                        </select>
                    </td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right;">${topArea.toFixed(1)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#27ae60;">${(span.cap?.lMa_top ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#16a085;">${(span.cap?.sMa_top ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:center; white-space:nowrap;">
                        <input type="number" id="${botCountId}" min="1" value="${currentBot.count}" onchange="const typeVal = document.getElementById('${botTypeId}').value; window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'bottomRebar', this.value + '-' + typeVal, ${sIdx})" style="width:35px; padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; text-align:right;">-
                        <select id="${botTypeId}" onchange="const countVal = document.getElementById('${botCountId}').value; window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'bottomRebar', countVal + '-' + this.value, ${sIdx})" style="padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; background:#fff; max-width:75px;">
                            <option value="D13" ${currentBot.type === 'D13' ? 'selected' : ''}>D13</option>
                            <option value="D16" ${currentBot.type === 'D16' ? 'selected' : ''}>D16</option>
                            <option value="D19" ${currentBot.type === 'D19' ? 'selected' : ''}>D19</option>
                            <option value="D13D16" ${currentBot.type === 'D13D16' ? 'selected' : ''}>D13D16</option>
                            <option value="D13D19" ${currentBot.type === 'D13D19' ? 'selected' : ''}>D13D19</option>
                            <option value="D16D19" ${currentBot.type === 'D16D19' ? 'selected' : ''}>D16D19</option>
                        </select>
                    </td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right;">${botArea.toFixed(1)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#2980b9;">${(span.cap?.lMa_bot ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#2e4053;">${(span.cap?.sMa_bot ?? 0).toFixed(3)}</td>
                </tr>`;
            });
            table4 += `</tbody></table>`;
            html += table4;

            // (5) 許容耐力の算定（2）
            html += `<div style="font-size:11px; font-weight:bold; color:#2c3e50; border-bottom:1px solid #8e44ad; margin:15px 0 5px 0; padding-bottom:3px;">📈 (5) 許容耐力の算定（2 - せん断）</div>`;
            let table5 = `<table style="width:100%; border-collapse:collapse; font-size:9px; margin-bottom:12px; border:1px solid #ddd;">
                <thead>
                    <tr style="background:#f2f4f4; border-bottom:1px solid #ddd;">
                        <th rowspan="2" style="border:1px solid #ddd; padding:3px;">柱間</th>
                        <th rowspan="2" style="border:1px solid #ddd; padding:3px;">幅 b(mm)</th>
                        <th colspan="3" style="border:1px solid #ddd; padding:3px; text-align:center; background:#ebf5fb;">スターラップ筋 (あばら筋)</th>
                        <th rowspan="2" style="border:1px solid #ddd; padding:3px;">pw</th>
                        <th colspan="2" style="border:1px solid #ddd; padding:3px; text-align:center; background:#e8f8f5;">せん断長期</th>
                        <th colspan="4" style="border:1px solid #ddd; padding:3px; text-align:center; background:#fef9e7;">せん断短期</th>
                    </tr>
                    <tr style="background:#f2f4f4; border-bottom:1px solid #ddd;">
                        <th style="border:1px solid #ddd; padding:2px;">鉄筋</th>
                        <th style="border:1px solid #ddd; padding:2px;">at(㎟)</th>
                        <th style="border:1px solid #ddd; padding:2px;">ピッチ(mm)</th>
                        <th style="border:1px solid #ddd; padding:2px;">α</th>
                        <th style="border:1px solid #ddd; padding:2px;">lQa (kN)</th>
                        <th style="border:1px solid #ddd; padding:2px;">α(左)</th>
                        <th style="border:1px solid #ddd; padding:2px;">sQa_L (kN)</th>
                        <th style="border:1px solid #ddd; padding:2px;">α(右)</th>
                        <th style="border:1px solid #ddd; padding:2px;">sQa_R (kN)</th>
                    </tr>
                </thead>
                <tbody>`;
            
            spans.forEach((span, sIdx) => {
                const sStirrup = span.props?.stirrup || bp.stirrup || '1-D10@200';
                const currentSt = parseStirrupInput(sStirrup);

                const stCountId = `st-count-${beam.id}-${sIdx}`;
                const stTypeId = `st-type-${beam.id}-${sIdx}`;
                const stPitchId = `st-pitch-${beam.id}-${sIdx}`;

                const stArea = (window.FoundationEngine && window.FoundationEngine.parseStirrups) ? window.FoundationEngine.parseStirrups(sStirrup).area : 71;

                const alpha_L = span.cap?.alpha_L != null ? span.cap.alpha_L.toFixed(3) : '--';
                const alpha_S_L = span.cap?.alpha_S_L != null ? span.cap.alpha_S_L.toFixed(3) : '--';
                const alpha_S_R = span.cap?.alpha_S_R != null ? span.cap.alpha_S_R.toFixed(3) : '--';

                const pwValue = span.cap?.pw ?? 0;
                const pwWarning = pwValue < 0.002 ? 'background:#fff9c4; color:#d32f2f; font-weight:bold;' : '';

                table5 += `<tr>
                    <td style="border:1px solid #ddd; padding:3px; font-weight:bold;">${getFreshSpanName(span)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:center;">
                        <input type="number" step="10" value="${span.props?.width || bp.width || 150}" onchange="window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'width', this.value, ${sIdx})" style="width:45px; padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; text-align:right;">
                    </td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:center; white-space:nowrap;">
                        <input type="number" id="${stCountId}" min="1" value="${currentSt.count}" onchange="const typeVal = document.getElementById('${stTypeId}').value; const pitchVal = document.getElementById('${stPitchId}').value; window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'stirrup', this.value + '-' + typeVal + '@' + pitchVal, ${sIdx})" style="width:35px; padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; text-align:right;">-
                        <select id="${stTypeId}" onchange="const countVal = document.getElementById('${stCountId}').value; const pitchVal = document.getElementById('${stPitchId}').value; window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'stirrup', countVal + '-' + this.value + '@' + pitchVal, ${sIdx})" style="padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; background:#fff; max-width:65px;">
                            <option value="D10" ${currentSt.type === 'D10' ? 'selected' : ''}>D10</option>
                            <option value="D13" ${currentSt.type === 'D13' ? 'selected' : ''}>D13</option>
                        </select>
                    </td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right;">${stArea.toFixed(1)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:center;">
                        <select id="${stPitchId}" onchange="const countVal = document.getElementById('${stCountId}').value; const typeVal = document.getElementById('${stTypeId}').value; window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'stirrup', countVal + '-' + typeVal + '@' + this.value, ${sIdx})" style="padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; background:#fff; max-width:75px;">
                            <option value="300" ${currentSt.pitch === '300' ? 'selected' : ''}>@300</option>
                            <option value="200" ${currentSt.pitch === '200' ? 'selected' : ''}>@200</option>
                            <option value="150" ${currentSt.pitch === '150' ? 'selected' : ''}>@150</option>
                            <option value="100" ${currentSt.pitch === '100' ? 'selected' : ''}>@100</option>
                        </select>
                    </td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; ${pwWarning}">${pwValue.toFixed(5)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#117a65;">${alpha_L}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#27ae60;">${(span.cap?.lQa ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#117a65;">${alpha_S_L}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#2980b9;">${(span.cap?.sQa_L ?? 0).toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#117a65;">${alpha_S_R}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:#7d3c98;">${(span.cap?.sQa_R ?? 0).toFixed(3)}</td>
                </tr>`;
            });
            table5 += `</tbody></table>`;
            
            // pw < 0.002 警告メッセージ
            if (spans.some(s => (s.cap?.pw ?? 0) < 0.002)) {
                html += `<div style="background:#fff9c4; border-left:4px solid #fbc02d; padding:8px; margin-bottom:12px; font-size:10px; color:#856404; font-weight:bold;">
                    ⚠️ せん断補強筋比(pw)が0.002を下回っています。鉄筋の本数・径を増やすか、ピッチを細かく(例:@100)修正してください。
                </div>`;
            }
            html += table5;

            // (6) 総合判定表
            html += `<div style="font-size:11px; font-weight:bold; color:#2c3e50; border-bottom:1px solid #8e44ad; margin:15px 0 5px 0; padding-bottom:3px;">🏅 (6) 総合判定表</div>`;
            let table6 = `<table style="width:100%; border-collapse:collapse; font-size:9px; border:1px solid #ddd;">
                <thead>
                    <tr style="background:#f2f4f4; border-bottom:1px solid #ddd;">
                        <th style="border:1px solid #ddd; padding:3px;">柱間</th>
                        <th style="border:1px solid #ddd; padding:3px; text-align:center;">長期 M_L/Ma</th>
                        <th style="border:1px solid #ddd; padding:3px; text-align:center;">長期 Q_L/Qa</th>
                        <th style="border:1px solid #ddd; padding:3px; text-align:center;">短期左 M_S/Ma</th>
                        <th style="border:1px solid #ddd; padding:3px; text-align:center;">短期左 Q_S/Qa</th>
                        <th style="border:1px solid #ddd; padding:3px; text-align:center;">短期右 M_S/Ma</th>
                        <th style="border:1px solid #ddd; padding:3px; text-align:center;">短期右 Q_S/Qa</th>
                        <th style="border:1px solid #ddd; padding:3px; text-align:center;">判定</th>
                    </tr>
                </thead>
                <tbody>`;
            
            spans.forEach(span => {
                const badge = span.isNG ? `<span style="background:#e74c3c; color:#fff; padding:2px 4px; border-radius:3px; font-weight:bold; font-size:8px;">NG</span>` : `<span style="background:#27ae60; color:#fff; padding:2px 4px; border-radius:3px; font-weight:bold; font-size:8px;">OK</span>`;
                
                const rM_L = span.rM_L ?? 0;
                const rQ_L = span.rQ_L ?? 0;
                const rM_S_L = Math.max(span.leftward?.rM_left ?? 0, span.leftward?.rM_right ?? 0);
                const rQ_S_L = span.leftward?.rQ ?? 0;
                const rM_S_R = Math.max(span.rightward?.rM_left ?? 0, span.rightward?.rM_right ?? 0);
                const rQ_S_R = span.rightward?.rQ ?? 0;

                table6 += `<tr>
                    <td style="border:1px solid #ddd; padding:3px; font-weight:bold;">${getFreshSpanName(span)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:${rM_L > 1.0 ? 'red' : '#2980b9'}">${rM_L.toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:${rQ_L > 1.0 ? 'red' : '#27ae60'}">${rQ_L.toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:${rM_S_L > 1.0 ? 'red' : '#7d3c98'}">${rM_S_L.toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:${rQ_S_L > 1.0 ? 'red' : '#138d75'}">${rQ_S_L.toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:${rM_S_R > 1.0 ? 'red' : '#d35400'}">${rM_S_R.toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:right; font-weight:bold; color:${rQ_S_R > 1.0 ? 'red' : '#900c3f'}">${rQ_S_R.toFixed(3)}</td>
                    <td style="border:1px solid #ddd; padding:3px; text-align:center;">${badge}</td>
                </tr>`;
            });
            table6 += `</tbody></table>`;
            html += table6;
        } else {
            html += `<div style="padding:15px; text-align:center; color:#7f8c8d; font-size:11px;">
                💡 基礎梁のスパン（柱間）が検出されていません。通り芯および柱が配置されると、自動的にスパンが分割され詳細な断面解析が実行されます。
            </div>`;
        }

        html += `</div>`;
        return html;
    },

    generateStressDiagramsSvg: function(beam, beamAxisName = null) {
        if (!beam.fdStress || !beam.fdStress.pillars || beam.fdStress.pillars.length === 0) return '';
        const pillars = beam.fdStress.pillars;
        const spans = beam.fdStress.spans || [];

        // ヘルパー: 特定された通り名を除外した名前を取得
        const getDisplayPillarName = (p) => {
            if (!p) return '支点';
            let px = 0, py = 0;
            if (p.globalX !== undefined) {
                px = p.globalX; py = p.globalY;
            } else if (p.x !== undefined && p.x > 100) {
                px = p.x; py = p.y !== undefined ? p.y : 0;
            } else {
                px = (p.x || 0) * 1000; py = (p.y || 0) * 1000;
            }
            const gridName = window.getGridNameAt ? window.getGridNameAt(px, py) : null;
            const isDefault = !p.name || /^(P|M)_?(P|M)?\d+$/i.test(p.name) || p.name.toLowerCase().startsWith('pillar') || p.name === `P_${p.id}` || p.name === p.id || p.name.startsWith('支点') || (p.id && p.id.startsWith('support')) || (p.name && p.name.startsWith('support'));
            let rawName = isDefault ? (gridName || p.name || `P_${p.id}`) : p.name;
            
            if (beamAxisName && rawName.includes(beamAxisName)) {
                rawName = rawName.replace(beamAxisName, '').replace(/^[ -]+|[ -]+$/g, '');
            }
            return rawName || '支点';
        };
        
        const xMin = pillars[0].x;
        const xMax = pillars[pillars.length - 1].x;
        const totalLength = xMax - xMin;
        if (totalLength <= 0) return '';

        const width = 700;
        const padX = 60;
        const chartW = width - padX * 2;
        
        const getX = (x) => padX + ((x - xMin) / totalLength) * chartW;

        let maxTd = 1;
        let maxM = 1;
        let maxQ = 1;

        const seismic = beam.fdStress.seismic;
        pillars.forEach((p, idx) => {
            const l_Td = Math.abs(seismic.leftward.Td[idx] || 0);
            const r_Td = Math.abs(seismic.rightward.Td[idx] || 0);
            maxTd = Math.max(maxTd, l_Td, r_Td);

            const l_M = Math.abs(seismic.leftward.Mf[idx] || 0);
            const r_M = Math.abs(seismic.rightward.Mf[idx] || 0);
            maxM = Math.max(maxM, l_M, r_M);
        });

        spans.forEach((s, sIdx) => {
            const l_Q = Math.abs(seismic.leftward.Qe[sIdx] || 0);
            const r_Q = Math.abs(seismic.rightward.Qe[sIdx] || 0);
            maxQ = Math.max(maxQ, l_Q, r_Q);
        });

        const h = 100;
        const spacing = 45;
        const svgHeight = (h + spacing) * 3 + 20;

        let svg = `<svg viewBox="0 0 ${width} ${svgHeight}" style="background:#fdfdfd; border:1px solid #cbd5e1; border-radius:8px; margin:15px 0; width:100%; max-width:700px; font-family:sans-serif; box-shadow:0 1px 3px rgba(0,0,0,0.05);">`;
        
        // 0. 通りの薄い線 (Vertical dashed grid lines aligned across all three charts)
        svg += `<g class="grid-lines" opacity="0.35">`;
        pillars.forEach((p) => {
            const px = getX(p.x);
            svg += `<line x1="${px}" y1="30" x2="${px}" y2="${svgHeight - 20}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3,3" />`;
        });
        svg += `</g>`;

        // 1. Td (短期軸力図)
        let y1 = 60;
        svg += `<g class="chart-axial">
            <text x="${padX}" y="${y1 - 35}" font-size="11" font-weight="bold" fill="#1e293b">■ 短期軸力図 Td (kN)</text>
            <line x1="${padX - 10}" y1="${y1}" x2="${width - padX + 10}" y2="${y1}" stroke="#94a3b8" stroke-width="1.5" />
        `;
        pillars.forEach((p, idx) => {
            const px = getX(p.x);
            const l_val = seismic.leftward?.Td?.[idx] ?? 0;
            const r_val = seismic.rightward?.Td?.[idx] ?? 0;
            
            const ly = y1 - (l_val / maxTd) * 35;
            const ry = y1 - (r_val / maxTd) * 35;

            svg += `<text x="${px}" y="${y1 + 15}" font-size="8" text-anchor="middle" fill="#64748b" font-weight="bold">${getDisplayPillarName(p)}</text>`;

            // Downward (Leftward) force (Blue)
            svg += `<line x1="${px - 3.5}" y1="${y1}" x2="${px - 3.5}" y2="${ly}" stroke="#3b82f6" stroke-width="3" />`;
            // Upward (Rightward) force (Orange)
            svg += `<line x1="${px + 3.5}" y1="${y1}" x2="${px + 3.5}" y2="${ry}" stroke="#f97316" stroke-width="3" />`;

            if (Math.abs(l_val) > 0.001) {
                svg += `<text x="${px - 6}" y="${ly + (l_val >= 0 ? -4 : 8)}" font-size="8" text-anchor="end" fill="#1d4ed8" font-weight="bold">${l_val.toFixed(3)}</text>`;
            }
            if (Math.abs(r_val) > 0.001) {
                svg += `<text x="${px + 6}" y="${ry + (r_val >= 0 ? -4 : 8)}" font-size="8" text-anchor="start" fill="#c2410c" font-weight="bold">${r_val.toFixed(3)}</text>`;
            }
        });
        svg += `</g>`;

        // 2. M図 (曲げモーメント図)
        let y2 = y1 + h + spacing;
        svg += `<g class="chart-moment">
            <text x="${padX}" y="${y2 - 35}" font-size="11" font-weight="bold" fill="#1e293b">■ 曲げモーメント図 M (kNm)</text>
            <line x1="${padX - 10}" y1="${y2}" x2="${width - padX + 10}" y2="${y2}" stroke="#94a3b8" stroke-width="1.5" />
        `;

        // Draw leftward moment polyline connecting all pillars
        let lMPath = "";
        pillars.forEach((p, idx) => {
            const px = getX(p.x);
            const val = seismic.leftward?.Mf?.[idx] ?? 0;
            const py = y2 + (val / maxM) * 35;
            lMPath += `${idx === 0 ? 'M' : 'L'} ${px} ${py} `;
        });
        svg += `<path d="${lMPath}" fill="none" stroke="#3b82f6" stroke-width="1.5" />`;

        // Draw rightward moment polyline connecting all pillars
        let rMPath = "";
        pillars.forEach((p, idx) => {
            const px = getX(p.x);
            const val = seismic.rightward?.Mf?.[idx] ?? 0;
            const py = y2 + (val / maxM) * 35;
            rMPath += `${idx === 0 ? 'M' : 'L'} ${px} ${py} `;
        });
        svg += `<path d="${rMPath}" fill="none" stroke="#f97316" stroke-width="1.5" />`;

        // Draw labels
        pillars.forEach((p, idx) => {
            const px = getX(p.x);
            const l_val = seismic.leftward?.Mf?.[idx] ?? 0;
            const r_val = seismic.rightward?.Mf?.[idx] ?? 0;
            const ly = y2 + (l_val / maxM) * 35;
            const ry = y2 + (r_val / maxM) * 35;

            if (Math.abs(l_val) > 0.001) {
                svg += `<text x="${px}" y="${ly + (l_val >= 0 ? 10 : -4)}" font-size="8" text-anchor="middle" fill="#1d4ed8" font-weight="bold">${l_val.toFixed(3)}</text>`;
            }
            if (Math.abs(r_val) > 0.001) {
                svg += `<text x="${px}" y="${ry + (r_val >= 0 ? 10 : -4)}" font-size="8" text-anchor="middle" fill="#c2410c" font-weight="bold">${r_val.toFixed(3)}</text>`;
            }
        });
        svg += `</g>`;

        // 3. Q図 (せん断力図)
        let y3 = y2 + h + spacing;
        svg += `<g class="chart-shear">
            <text x="${padX}" y="${y3 - 35}" font-size="11" font-weight="bold" fill="#1e293b">■ せん断力図 Q (kN)</text>
            <line x1="${padX - 10}" y1="${y3}" x2="${width - padX + 10}" y2="${y3}" stroke="#94a3b8" stroke-width="1.5" />
        `;

        // Draw step (flat) lines for leftward shear Qe
        let lQPoints = [];
        spans.forEach((span, sIdx) => {
            const pLeft = pillars[sIdx];
            const pRight = pillars[sIdx + 1];
            if (!pLeft || !pRight) return;
            const xL = getX(pLeft.x);
            const xR = getX(pRight.x);
            const Qe = seismic.leftward?.Qe?.[sIdx] ?? 0;
            const py = y3 - (Qe / maxQ) * 35;
            lQPoints.push({ x: xL, y: py });
            lQPoints.push({ x: xR, y: py });
        });
        if (lQPoints.length > 0) {
            let lQPath = "";
            lQPoints.forEach((pt, idx) => {
                lQPath += `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y} `;
            });
            svg += `<path d="${lQPath}" fill="none" stroke="#3b82f6" stroke-width="1.5" />`;
        }

        // Draw step (flat) lines for rightward shear Qe
        let rQPoints = [];
        spans.forEach((span, sIdx) => {
            const pLeft = pillars[sIdx];
            const pRight = pillars[sIdx + 1];
            if (!pLeft || !pRight) return;
            const xL = getX(pLeft.x);
            const xR = getX(pRight.x);
            const Qe = seismic.rightward?.Qe?.[sIdx] ?? 0;
            const py = y3 - (Qe / maxQ) * 35;
            rQPoints.push({ x: xL, y: py });
            rQPoints.push({ x: xR, y: py });
        });
        if (rQPoints.length > 0) {
            let rQPath = "";
            rQPoints.forEach((pt, idx) => {
                rQPath += `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y} `;
            });
            svg += `<path d="${rQPath}" fill="none" stroke="#f97316" stroke-width="1.5" />`;
        }

        // Draw step value labels in the middle of each span
        spans.forEach((span, sIdx) => {
            const pLeft = pillars[sIdx];
            const pRight = pillars[sIdx + 1];
            if (!pLeft || !pRight) return;
            const xMid = (getX(pLeft.x) + getX(pRight.x)) / 2;
            const l_Qe = seismic.leftward?.Qe?.[sIdx] ?? 0;
            const r_Qe = seismic.rightward?.Qe?.[sIdx] ?? 0;
            
            const ly = y3 - (l_Qe / maxQ) * 35;
            const ry = y3 - (r_Qe / maxQ) * 35;
            
            if (Math.abs(l_Qe) > 0.001) {
                svg += `<text x="${xMid}" y="${ly + (l_Qe >= 0 ? -4 : 10)}" font-size="8" text-anchor="middle" fill="#1d4ed8" font-weight="bold">${l_Qe.toFixed(3)}</text>`;
            }
            if (Math.abs(r_Qe) > 0.001) {
                svg += `<text x="${xMid}" y="${ry + (r_Qe >= 0 ? -4 : 10)}" font-size="8" text-anchor="middle" fill="#c2410c" font-weight="bold">${r_Qe.toFixed(3)}</text>`;
            }
        });
        svg += `</g>`;

        svg += `
            <g transform="translate(${width - 180}, 12)">
                <rect width="170" height="24" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
                <line x1="10" y1="12" x2="25" y2="12" stroke="#3b82f6" stroke-width="2" />
                <text x="30" y="15" font-size="8" fill="#475569" font-weight="bold">左加力 (下加力)</text>
                <line x1="95" y1="12" x2="110" y2="12" stroke="#f97316" stroke-width="2" />
                <text x="115" y="15" font-size="8" fill="#475569" font-weight="bold">右加力 (上加力)</text>
            </g>
        `;

        svg += `</svg>`;
        return svg;
    },

    generateSlabHtml: function(item) {
        const p = item.props || {};
        const supports = [
            '4辺固定', '3辺固定1辺ピン（長辺ピン）', '3辺固定1辺ピン（短辺ピン）',
            '2隣辺固定2隣辺ピン', '長辺2辺固定短辺2辺ピン', '短辺2辺固定長辺2辺ピン',
            '1辺固定3辺ピン（長辺固定）', '1辺固定3辺ピン（短辺固定）', '4辺ピン', '片持ち'
        ];
        const rebars = ['D10', 'D10/D13', 'D13', 'D16', 'D13/D16'];

        return `
            <div class="calc-box" style="padding:15px; height:100%; overflow:auto; box-sizing:border-box; font-family:sans-serif; background:#ffffff; border-radius:10px;">
                <div style="font-size:14px; font-weight:bold; color:#1e293b; border-bottom:3px solid #27ae60; margin-bottom:12px; padding-bottom:8px; display:flex; align-items:center; gap:6px;">
                    <span style="font-size:16px;">📐</span> 基礎スラブ設定・検定
                </div>
                <!-- 2. 個別スラブ基本設定カード -->
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:15px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
                    <div style="font-size:11px; font-weight:bold; color:#1e293b; border-bottom:1px solid #e2e8f0; margin-bottom:10px; padding-bottom:4px; display:flex; align-items:center; gap:6px;">
                        <span style="font-size:12px; color:#0f766e;">📝</span> 個別スラブ基本設定
                    </div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                        <div style="display:flex; flex-direction:column;">
                            <label style="font-size:11px; color:#475569; margin-bottom:3px; font-weight:500;">符号 (スラブ名)</label>
                            <input type="text" value="${p.name || 'S1'}" onchange="window.PropertyController.updateFdProp('slab', ${item.id}, 'name', this.value)" style="padding:4px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px; color:#1e293b; font-weight:bold; background:#fff;">
                        </div>
                        <div style="display:flex; flex-direction:column;">
                            <label style="font-size:11px; color:#475569; margin-bottom:3px; font-weight:500;">支持条件</label>
                            <select onchange="window.PropertyController.updateFdProp('slab', ${item.id}, 'support', this.value)" style="padding:4px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px; color:#1e293b; background:#fff;">
                                ${supports.map(s => `<option value="${s}" ${p.support === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    ${p.support === '片持ち' ? `
                    <div style="display:flex; flex-direction:column; margin-bottom:10px; background:#fffbeb; border:1px solid #fde68a; border-radius:4px; padding:6px;">
                        <label style="font-size:10px; color:#b45309; margin-bottom:3px; font-weight:500;">片持ち長さ (m)</label>
                        <div style="display:flex; align-items:center; gap:5px;">
                            <input type="number" step="0.1" value="${p.cantileverLength || 0.9}" onchange="window.PropertyController.updateFdProp('slab', ${item.id}, 'cantileverLength', this.value)" style="width:70px; padding:3px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px;">
                            <span style="font-size:11px; color:#4b5563;">m</span>
                        </div>
                    </div>
                    ` : ''}

                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; background:#f1f5f9; padding:8px; border-radius:6px; border:1px solid #cbd5e1;">
                        <div style="display:flex; flex-direction:column;">
                            <label style="font-size:10px; color:#64748b; margin-bottom:3px; font-weight:500;">厚さ (mm)</label>
                            <div style="display:flex; align-items:center; gap:4px;">
                                <input type="number" value="${p.slabThickness || 150}" onchange="window.PropertyController.updateFdProp('slab', ${item.id}, 'slabThickness', this.value)" style="width:70px; padding:4px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px; text-align:right;">
                                <span style="font-size:10px; color:#475569;">mm</span>
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column;">
                            <label style="font-size:10px; color:#64748b; margin-bottom:3px; font-weight:500;">かぶり (mm)</label>
                            <div style="display:flex; align-items:center; gap:4px;">
                                <input type="number" value="${p.coverDepth || 70}" onchange="window.PropertyController.updateFdProp('slab', ${item.id}, 'coverDepth', this.value)" style="width:70px; padding:4px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px; text-align:right;">
                                <span style="font-size:10px; color:#475569;">mm</span>
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column;">
                            <label style="font-size:10px; color:#64748b; margin-bottom:3px; font-weight:500;">天端高 (mm)</label>
                            <div style="display:flex; align-items:center; gap:4px;">
                                <input type="number" value="${p.slabTopHeight !== undefined ? p.slabTopHeight : 50}" onchange="window.PropertyController.updateFdProp('slab', ${item.id}, 'slabTopHeight', this.value)" style="width:70px; padding:4px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px; text-align:right;">
                                <span style="font-size:10px; color:#475569;">mm</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 3. 個別配筋設定カード -->
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:15px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
                    <div style="font-size:11px; font-weight:bold; color:#1e293b; border-bottom:1px solid #e2e8f0; margin-bottom:10px; padding-bottom:4px; display:flex; align-items:center; gap:6px;">
                        <span style="font-size:12px; color:#15803d;">⛓️</span> 個別配筋設定
                    </div>
                    
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <!-- 短辺配筋 -->
                        <div style="display:grid; grid-template-columns: 2fr 3fr 1fr 3fr; align-items:center; gap:6px; font-size:11px; padding:4px 0; border-bottom:1px dashed #e2e8f0;">
                            <span style="font-weight:500; color:#334155;">短辺配筋</span>
                            <select onchange="window.PropertyController.updateFdProp('slab', ${item.id}, 'rebarShort.type', this.value)" style="padding:3px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px; background:#fff;">
                                ${rebars.map(r => `<option value="${r}" ${p.rebarShort?.type === r ? 'selected' : ''}>${r}</option>`).join('')}
                            </select>
                            <span style="text-align:center; color:#64748b;">@</span>
                            <div style="display:flex; align-items:center; gap:4px;">
                                <input type="number" value="${p.rebarShort?.pitch || 200}" onchange="window.PropertyController.updateFdProp('slab', ${item.id}, 'rebarShort.pitch', this.value)" style="width:55px; padding:3px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px; text-align:right;">
                                <span style="font-size:10px; color:#64748b;">mm</span>
                            </div>
                        </div>

                        <!-- 長辺配筋 -->
                        <div style="display:grid; grid-template-columns: 2fr 3fr 1fr 3fr; align-items:center; gap:6px; font-size:11px; padding:4px 0;">
                            <span style="font-weight:500; color:#334155;">長辺配筋</span>
                            <select onchange="window.PropertyController.updateFdProp('slab', ${item.id}, 'rebarLong.type', this.value)" style="padding:3px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px; background:#fff;">
                                ${rebars.map(r => `<option value="${r}" ${p.rebarLong?.type === r ? 'selected' : ''}>${r}</option>`).join('')}
                            </select>
                            <span style="text-align:center; color:#64748b;">@</span>
                            <div style="display:flex; align-items:center; gap:4px;">
                                <input type="number" value="${p.rebarLong?.pitch || 200}" onchange="window.PropertyController.updateFdProp('slab', ${item.id}, 'rebarLong.pitch', this.value)" style="width:55px; padding:3px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px; text-align:right;">
                                <span style="font-size:10px; color:#64748b;">mm</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="slab-calc-result-container" style="margin-top:15px; border-top:1px dashed #cbd5e1; padding-top:10px;">
                    ${(typeof getFoundationSlabReportHtml === 'function') ? getFoundationSlabReportHtml(item) : '<p style="color:#888; font-size:11px;">解析中...</p>'}
                </div>
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
                        <label style="font-size:13px; color:#34495e;">🏷️ 柱符号 (通り芯交点名等)</label>
                        <input type="text" id="edit-pillar-name" value="${item.name || ''}" style="width:120px; font-weight:bold; padding:4px; border:1px solid #ccc; border-radius:4px; text-align:center;">
                    </div>

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
    
    // [v2.5.22] カスタム金物設定も DOM から AppState へアクティブ同期
    let hwList = [];
    document.querySelectorAll('.cust-hw-row').forEach(row => {
        let nEl = row.querySelector('.cust-h-n');
        let vEl = row.querySelector('.cust-h-v');
        if (nEl && vEl) {
            const rawN = (nEl.value || "").trim();
            if (rawN && rawN !== "undefined" && rawN !== "null" && !isNaN(parseFloat(vEl.value))) {
                hwList.push({ name: rawN, val: parseFloat(vEl.value) });
            }
        }
    });
    state.customHardware = hwList;

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

/**
 * スラブ断面検定レポートHTML生成 (v2.4.8)
 */
window.getFoundationSlabReportHtml = function(slab) {
    if (!slab || !slab.fdStress) return `<p style="color:#888; font-size:11px;">解析データがありません。支持条件を設定してください。</p>`;
    const s = slab.fdStress;
    const fmt = (v, d = 2) => (v != null && !isNaN(v)) ? v.toFixed(d) : "--";
    const fmtR = (r) => {
        const ok = r <= 1.0;
        return `<span style="color:${ok ? "#27ae60" : "#e74c3c"}; font-weight:bold;">${(r * 100).toFixed(1)}% ${ok ? "OK" : "NG"}</span>`;
    };

    let html = `<div style="background:#fff; border:1px solid #ddd; border-radius:4px; padding:12px; font-size:11px; line-height:1.6; color:#333;">`;
    html += `<div style="font-weight:bold; color:#000; border-bottom:2px solid #333; margin-bottom:10px; font-size:12px;">7－1．べた基礎の検定（接地圧）</div>`;
    
    // (1) 基礎定数と算定条件
    html += `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px; background:#f9f9f9; padding:8px; border:1px solid #eee;">`;
    if (s.cantileverLength) {
        html += `<div>片持ち L: <b>${fmt(s.cantileverLength)}</b> m</div>`;
    } else {
        html += `<div>短辺 Lx: <b>${fmt(s.lx)}</b> m</div>`;
        html += `<div>長辺 Ly: <b>${fmt(s.ly)}</b> m</div>`;
    }
    html += `<div>面積 Area: <b>${fmt(s.area)}</b> ㎡</div>`;
    html += `</div>`;

    // 算定条件の明示 (Detailed Building Load Breakdown)
    const dl = s.detailedLoads || {};
    const wR = dl.wR || 0.60;
    const wW = dl.wW || 0.67;
    const wF = dl.wF || 2.40;
    const wTotal = wR + wW + wF;

    html += `<div style="margin-bottom:10px; padding:6px; background:#fdfdfe; border:1px solid #dee2e6; border-left:4px solid #8e44ad; font-size:10px;">`;
    html += `<div style="font-weight:bold; color:#8e44ad; margin-bottom:3px;">【算定条件・参照プロパティ】</div>`;
    html += `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px;">`;
    html += `<div>・スラブ厚 D: <b>${slab.props?.slabThickness || 150}</b> mm</div>`;
    html += `<div>・スラブ天端高 dt: <b>${slab.props?.slabTopHeight || 50}</b> mm</div>`;
    html += `<div>・建物荷重(仕様合計): <b>${wTotal.toFixed(2)}</b> kN/㎡</div>`;
    html += `<div>　(屋根:${wR.toFixed(2)} + 外壁:${wW.toFixed(2)} + 骨組:${wF.toFixed(2)})</div>`;
    html += `<div>・1階床負担面積: <b>${fmt(dl.sArea1F || 0, 3)}</b> ㎡</div>`;
    html += `<div>・2階床負担面積: <b>${fmt(dl.sArea2F || 0, 3)}</b> ㎡</div>`;
    html += `<div>・屋根投影負担面積: <b>${fmt(dl.sAreaRoof || 0, 3)}</b> ㎡</div>`;
    html += `<div>・床積載+仕上: <b>1.74</b> kN/㎡</div>`;
    html += `</div>`;
    const eaves = (window.AppState.config?.eavesLen !== undefined) ? window.AppState.config.eavesLen : 300;
    html += `<div style="margin-top:4px; border-top:1px dashed #cbd5e1; padding-top:4px; font-size:9px; color:#4b5563;">・軒の出寸法: <b>${eaves}</b> mm (最外周オフセットによる統合屋根投影面積)</div>`;
    html += `<div style="margin-top:4px; color:#666; font-size:9px;">※建物軸力 ΣN = 各階の負担面積合計 × 建物荷重(仕様合計) に基づき、スラブ上の1階・2階面積から算出</div>`;
    html += `<div style="margin-top:2px; color:#666; font-size:9px;">※立上り自重には、スラブ境界にある<b>内部・外周全ての基礎梁</b>の重量が含まれます</div>`;
    html += `</div>`;

    // (2) 荷重の内訳表
    html += `<div style="font-weight:bold; margin-bottom:4px;">1. 接地圧 σe の算定 (kN/㎡)</div>`;
    html += `<table style="width:100%; border-collapse:collapse; margin-bottom:10px; border:1px solid #333; font-size:10px;">`;
    html += `<tr style="background:#eee; border-bottom:1px solid #333;"><th style="padding:4px; border-right:1px solid #333; text-align:left;">項目</th><th style="padding:4px; text-align:right;">値</th></tr>`;
    html += `<tr><td style="padding:4px; border-right:1px solid #333;">① 建物軸力 (ΣN/Area) = ${fmt(s.totalAxial_kN)} / ${fmt(s.area)}</td><td style="padding:4px; text-align:right;">${fmt(s.axialPressure, 3)}</td></tr>`;
    html += `<tr><td style="padding:4px; border-right:1px solid #333;">② 立上り自重 (Stem/Area) = ${fmt(s.stemWeight_kN)} / ${fmt(s.area)}</td><td style="padding:4px; text-align:right;">${fmt(s.stemPressure, 3)}</td></tr>`;
    html += `<tr style="background:#f9f9f9; border-top:1px solid #333;"><td style="padding:4px; border-right:1px solid #333; font-weight:bold;">③ 均し荷重 (①+②)</td><td style="padding:4px; text-align:right; font-weight:bold;">${fmt(s.deadLoad, 3)}</td></tr>`;
    html += `<tr><td style="padding:4px; border-right:1px solid #333;">④ 床荷重 (積載1.30+仕上0.44)</td><td style="padding:4px; text-align:right;">${fmt(s.floorLoad, 3)}</td></tr>`;
    html += `<tr style="background:#e8f4f8; border-top:2px solid #333;"><td style="padding:4px; border-right:1px solid #333; font-weight:bold;">接地圧 σe (③+④)</td><td style="padding:4px; text-align:right; font-weight:bold; color:#0056b3;">${fmt(s.qTotal, 3)}</td></tr>`;
    html += `</table>`;

    // (4) 判定テーブル (M検定含む)
    html += `<div style="font-weight:bold; margin-bottom:4px;">断面検定判定</div>`;
    html += `<table style="width:100%; border-collapse:collapse; margin-bottom:10px; border:1px solid #333;">`;
    html += `<tr style="background:#eee; border-bottom:1px solid #333;"><th style="text-align:left; padding:4px; border-right:1px solid #333;">項目</th><th style="text-align:right; padding:4px; border-right:1px solid #333;">設計値</th><th style="text-align:right; padding:4px; border-right:1px solid #333;">許容値</th><th style="text-align:center; padding:4px;">判定</th></tr>`;
    html += `<tr style="background:#f1f3f5;"><td colspan="4" style="padding:2px 4px; font-size:9px; color:#666;">単位: 接地圧(kN/㎡), モーメント(kNm/m)</td></tr>`;
    
    // 接地圧判定 (fe' = fe - 24 * d)
    const fe = parseFloat(document.getElementById('global-fe')?.value) || 20.0;
    const d_val = parseFloat(document.getElementById('global-fd-thickness-m')?.value) || 0.15;
    const fe_prime = Math.max(0, fe - 24.0 * d_val);
    const groundRatio = s.qTotal / (fe_prime || 1);
    html += `<tr style="border-bottom:1px solid #ddd;"><td style="padding:4px; border-right:1px solid #333;">接地圧 σe / fe'<br><small style="font-size:8px;color:#666;">fe' = fe - 24*d</small></td><td style="text-align:right; padding:4px; border-right:1px solid #333;">${fmt(s.qTotal, 3)}</td><td style="text-align:right; padding:4px; border-right:1px solid #333;">${fmt(fe_prime, 3)}<br><small style="font-size:8px;color:#666;">(${fe} - 24*${d_val})</small></td><td style="text-align:center; padding:4px;">${fmtR(groundRatio)}</td></tr>`;
    
    // 曲げモーメント判定
    html += `<tr style="border-bottom:1px solid #ddd;"><td style="padding:4px; border-right:1px solid #333;">短辺 M (kNm)</td><td style="text-align:right; padding:4px; border-right:1px solid #333;">${fmt(Math.max(s.Mx_center||0, s.Mx_end||0), 3)}</td><td style="text-align:right; padding:4px; border-right:1px solid #333;">${fmt(s.Ma_short, 3)}</td><td style="text-align:center; padding:4px;">${fmtR(s.ratioShort)}</td></tr>`;
    if (!s.cantileverLength) {
        html += `<tr><td style="padding:4px; border-right:1px solid #333;">長辺 M (kNm)</td><td style="text-align:right; padding:4px; border-right:1px solid #333;">${fmt(Math.max(s.My_center||0, s.My_end||0), 3)}</td><td style="text-align:right; padding:4px; border-right:1px solid #333;">${fmt(s.Ma_long, 3)}</td><td style="text-align:center; padding:4px;">${fmtR(s.ratioLong)}</td></tr>`;
    }
    html += `</table>`;
    
    const finalNG = s.isNG || (groundRatio > 1.0);
    if (finalNG) html += `<div style="color:#fff; background:#e74c3c; font-weight:bold; text-align:center; padding:6px; border-radius:2px;">❌ 断面不足 (NG)</div>`;
    else html += `<div style="color:#fff; background:#27ae60; font-weight:bold; text-align:center; padding:6px; border-radius:2px;">✅ 安全 (OK)</div>`;

    html += `</div>`;
    return html;
};
