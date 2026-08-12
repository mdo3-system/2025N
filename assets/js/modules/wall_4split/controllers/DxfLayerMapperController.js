/**
 * controllers/DxfLayerMapperController.js - DXF Layer Mapping Assistant Modal Controller & Progress Bar UI
 * v3.11.6
 */

window.DxfLayerMapperController = {
    currentDxfRaw: "",
    onConfirmCallback: null,

    /**
     * プログレスバー表示
     */
    showProgress: function(percent, message) {
        const modal = document.getElementById('modal-dxf-loading');
        const bar = document.getElementById('dxf-loading-bar');
        const msg = document.getElementById('dxf-loading-msg');
        const pct = document.getElementById('dxf-loading-percent');

        if (modal) modal.style.display = 'flex';
        if (bar) bar.style.width = `${percent}%`;
        if (msg) msg.innerText = message;
        if (pct) pct.innerText = `${percent}%`;
    },

    /**
     * プログレスバー非表示
     */
    closeProgress: function() {
        const modal = document.getElementById('modal-dxf-loading');
        if (modal) modal.style.display = 'none';
    },

    /**
     * DXFレイヤーマッピングモーダルを開く
     * @param {string} rawTxt - DXFの生テキスト
     * @param {Function} callback - 確定時に呼び出すコールバック function(mapping, rawTxt)
     */
    loadedFiles: [], // [{ name: string, rawTxt: string, layers: string[] }]

    /**
     * DXFレイヤーマッピングモーダルを開く
     * @param {string|Array} inputData - DXFの生テキスト または ファイルオブジェクト配列 [{ name, rawTxt }]
     * @param {Function} callback - 確定時に呼び出すコールバック function(mapping, combinedDxfRaw)
     */
    openMapper: function(inputData, callback) {
        this.closeProgress();
        this.onConfirmCallback = callback;
        this.loadedFiles = [];

        if (Array.isArray(inputData)) {
            inputData.forEach(item => {
                const dxf = window.CadEngine ? window.CadEngine.processDxf(item.rawTxt) : null;
                if (dxf && dxf.entities) {
                    const lSet = new Set();
                    dxf.entities.forEach(ent => { if (ent.layer) lSet.add(ent.layer.toUpperCase().trim()); });
                    this.loadedFiles.push({ name: item.name, rawTxt: item.rawTxt, layers: Array.from(lSet).sort() });
                }
            });
        } else if (typeof inputData === 'string') {
            const dxf = window.CadEngine ? window.CadEngine.processDxf(inputData) : null;
            if (dxf && dxf.entities) {
                const lSet = new Set();
                dxf.entities.forEach(ent => { if (ent.layer) lSet.add(ent.layer.toUpperCase().trim()); });
                this.loadedFiles.push({ name: "単一DXFデータ.dxf", rawTxt: inputData, layers: Array.from(lSet).sort() });
            }
        }

        if (this.loadedFiles.length === 0) {
            alert("❌ DXFの読み込みに失敗しました。ファイルフォーマットをご確認ください。");
            return;
        }

        this.currentDxfRaw = this.loadedFiles[0].rawTxt;

        // 全ファイルの統合ユニークレイヤー抽出
        const allLayersSet = new Set();
        this.loadedFiles.forEach(f => f.layers.forEach(l => allLayersSet.add(l)));
        const allLayers = Array.from(allLayersSet).sort();

        // スマート自動推定 (Smart Auto-Select)
        const autoMap = {
            grid: allLayers.find(l => /(GRID|GLID|通り芯|軸線)/i.test(l) && !/(COL|COLUMN|柱|BACK|Rｸﾞﾙｰﾌﾟ|グループ|背景)/i.test(l)) || "",
            col1F: allLayers.find(l => /(1F_COL|1F.*COL|1F.*柱)/i.test(l) && !/(BACK|背景)/i.test(l)) || allLayers.find(l => /(COL|COLUMN|柱)/i.test(l) && !/(2F|BACK|背景)/i.test(l)) || "",
            col2F: allLayers.find(l => /(2F_COL|2F.*COL|2F.*柱)/i.test(l) && !/(BACK|背景)/i.test(l)) || "",
            roof1F: allLayers.find(l => /(1F_R|1F.*屋根|軒|下屋)/i.test(l) && !/(BACK|背景)/i.test(l)) || "",
            roof2F: allLayers.find(l => /(2F_R|2F.*屋根|RF|大屋根)/i.test(l) && !/(BACK|背景)/i.test(l)) || "",
            back1F: allLayers.find(l => /(1F_BACK|1_BACK|1F.*背景|1F.*下図)/i.test(l)) || allLayers.find(l => /(BACK|背景|下図)/i.test(l) && !/2F/i.test(l)) || "",
            back2F: allLayers.find(l => /(2F_BACK|2_BACK|2F.*背景|2F.*下図)/i.test(l)) || ""
        };

        // レイヤーカウント表記
        const countEl = document.getElementById('dxf-mapper-layer-count');
        if (countEl) countEl.innerText = `ロード済みファイル: ${this.loadedFiles.length} 件 | 全レイヤー数: ${allLayers.length}`;

        // 7つのスロット設定ID
        const slotKeys = [
            { fileId: 'dxf-file-grid', selectId: 'dxf-select-grid', selectedKey: 'grid', isBack: false },
            { fileId: 'dxf-file-1f-col', selectId: 'dxf-select-1f-col', selectedKey: 'col1F', isBack: false },
            { fileId: 'dxf-file-2f-col', selectId: 'dxf-select-2f-col', selectedKey: 'col2F', isBack: false },
            { fileId: 'dxf-file-1f-roof', selectId: 'dxf-select-1f-roof', selectedKey: 'roof1F', isBack: true },
            { fileId: 'dxf-file-2f-roof', selectId: 'dxf-select-2f-roof', selectedKey: 'roof2F', isBack: true },
            { fileId: 'dxf-file-1f-back', selectId: 'dxf-select-1f-back', selectedKey: 'back1F', isBack: true },
            { fileId: 'dxf-file-2f-back', selectId: 'dxf-select-2f-back', selectedKey: 'back2F', isBack: true }
        ];

        // 各スロットのファイル選択ドロップダウンの更新関数
        const populateSlotDropdowns = () => {
            slotKeys.forEach(item => {
                const fileEl = document.getElementById(item.fileId);
                const selectEl = document.getElementById(item.selectId);
                if (!fileEl || !selectEl) return;

                // ファイルドロップダウン構築
                const currentFileVal = fileEl.value;
                fileEl.innerHTML = '';
                this.loadedFiles.forEach((f, idx) => {
                    const opt = document.createElement('option');
                    opt.value = idx;
                    opt.text = f.name;
                    fileEl.appendChild(opt);
                });
                if (currentFileVal && fileEl.options[currentFileVal]) {
                    fileEl.value = currentFileVal;
                }

                // 選択中ファイルに基づくレイヤー一覧の再構成
                const activeFileIdx = parseInt(fileEl.value || 0, 10);
                const targetFileObj = this.loadedFiles[activeFileIdx] || this.loadedFiles[0];
                const fileLayers = targetFileObj ? targetFileObj.layers : allLayers;

                const currentLayerVal = selectEl.value;
                selectEl.innerHTML = '';

                const defaultOpt = document.createElement('option');
                defaultOpt.value = '';
                defaultOpt.text = '-- ※明示的にレイヤーを選択してください --';
                selectEl.appendChild(defaultOpt);

                if (item.isBack) {
                    const allOpt = document.createElement('option');
                    allOpt.value = '__ALL_LAYERS__';
                    allOpt.text = '★ [ファイル内全レイヤー] を背景として一括取り込み';
                    selectEl.appendChild(allOpt);
                }

                fileLayers.forEach(l => {
                    const opt = document.createElement('option');
                    opt.value = l;
                    opt.text = l;
                    if (currentLayerVal ? (currentLayerVal === l) : (autoMap[item.selectedKey] === l)) {
                        opt.selected = true;
                    }
                    selectEl.appendChild(opt);
                });
            });
        };

        // 単一ファイルモード vs 複数ファイルモードの切り替え制御
        const isMultiMode = this.loadedFiles.length > 1;
        const setRouteMode = (multi) => {
            const tabSingle = document.getElementById('tab-mode-single');
            const tabMulti = document.getElementById('tab-mode-multi');
            const previewContainer = document.getElementById('dxf-origin-preview-canvas')?.parentElement?.parentElement;
            
            if (multi) {
                if (tabSingle) { tabSingle.style.background = '#353b48'; tabSingle.style.color = '#a4b0be'; }
                if (tabMulti) { tabMulti.style.background = '#00d2d3'; tabMulti.style.color = '#1e272e'; }
                if (previewContainer) previewContainer.style.display = 'flex';
                document.querySelectorAll('.dxf-slot-file-select, .dxf-slot-origin-select, .btn-pick-origin').forEach(el => el.style.display = '');
            } else {
                if (tabSingle) { tabSingle.style.background = '#00d2d3'; tabSingle.style.color = '#1e272e'; }
                if (tabMulti) { tabMulti.style.background = '#353b48'; tabMulti.style.color = '#a4b0be'; }
                if (previewContainer) previewContainer.style.display = 'none';
                document.querySelectorAll('.dxf-slot-file-select, .dxf-slot-origin-select, .btn-pick-origin').forEach(el => el.style.display = 'none');
            }
        };

        const tabSingle = document.getElementById('tab-mode-single');
        const tabMulti = document.getElementById('tab-mode-multi');
        if (tabSingle) tabSingle.onclick = () => setRouteMode(false);
        if (tabMulti) tabMulti.onclick = () => setRouteMode(true);

        setRouteMode(isMultiMode);

        // ファイルドロップダウン初期化 ＆ 変更イベント接続
        populateSlotDropdowns();
        slotKeys.forEach(item => {
            const fileEl = document.getElementById(item.fileId);
            if (fileEl) {
                fileEl.onchange = () => {
                    populateSlotDropdowns();
                    this.renderPreviewCanvas(parseInt(fileEl.value || 0, 10));
                };
            }
        });

        // 初回キャンバス描画 ＆ イベントバインド
        this.previewZoomScale = 1.0;
        this.previewPanOffset = { x: 0, y: 0 };
        this.renderPreviewCanvas(0);
        this.initPreviewCanvasEvents();

        // キャンバスクリックで原点交点を視覚的選択
        const cvs = document.getElementById('dxf-origin-preview-canvas');
        if (cvs) {
            cvs.onclick = (ev) => {
                const rect = cvs.getBoundingClientRect();
                const clickX = ev.clientX - rect.left;
                const clickY = ev.clientY - rect.top;
                this.handlePreviewCanvasClick(clickX, clickY, cvs.width, cvs.height);
            };
        }

        // 各スロットカードの「🎯 原点指定」ボタン接続
        document.querySelectorAll('.btn-pick-origin').forEach(btn => {
            btn.onclick = () => {
                const slotName = btn.getAttribute('data-slot');
                const fileSelectId = `dxf-file-${slotName}`;
                const fileEl = document.getElementById(fileSelectId);
                const fileIdx = parseInt(fileEl?.value || 0, 10);
                
                const infoEl = document.getElementById('preview-origin-info');
                if (infoEl) {
                    const slotTitle = btn.parentElement?.innerText || slotName;
                    infoEl.innerText = `🎯 【${slotTitle}】の原点プレビュー指定モード中`;
                }

                this.activeOriginSlotKey = slotName;
                this.renderPreviewCanvas(fileIdx);
            };
        });

        // 「📂 別ファイルをスロット追加ロード」ボタンのイベント接続
        const addFileEl = document.getElementById('dxf-slot-add-file');
        if (addFileEl) {
            addFileEl.onchange = (e) => {
                const addFiles = Array.from(e.target.files || []);
                if (addFiles.length === 0) return;

                let readCount = 0;
                addFiles.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        try {
                            const buffer = new Uint8Array(ev.target.result);
                            let raw = "";
                            if (typeof window.Encoding !== 'undefined' && window.Encoding.detect) {
                                const det = window.Encoding.detect(buffer);
                                raw = window.Encoding.convert(buffer, { to: 'UNICODE', from: det || 'AUTO', type: 'STRING' });
                            } else {
                                raw = new TextDecoder('UTF-8').decode(buffer);
                            }
                            const dxf = window.CadEngine ? window.CadEngine.processDxf(raw) : null;
                            if (dxf && dxf.entities) {
                                const lSet = new Set();
                                dxf.entities.forEach(ent => { if (ent.layer) lSet.add(ent.layer.toUpperCase().trim()); });
                                this.loadedFiles.push({ name: file.name, rawTxt: raw, layers: Array.from(lSet).sort() });
                            }
                        } catch (err) {
                            console.error(err);
                        } finally {
                            readCount++;
                            if (readCount === addFiles.length) {
                                populateSlotDropdowns();
                                if (countEl) countEl.innerText = `ロード済みファイル: ${this.loadedFiles.length} 件 | 最新ファイルを全スロットで指定可能`;
                            }
                        }
                    };
                    reader.readAsArrayBuffer(file);
                });
            };
        }

        // イベントハンドラーのバインド
        const btnConfirm = document.getElementById('btn-dxf-mapper-confirm');
        if (btnConfirm) {
            btnConfirm.onclick = () => this.confirmAndExecute();
        }

        const btnCancel = document.getElementById('btn-dxf-mapper-cancel');
        if (btnCancel) {
            btnCancel.onclick = () => this.closeMapper();
        }

        const modal = document.getElementById('modal-dxf-layer-mapper');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => {
                this.renderPreviewCanvas(0);
            }, 60);
        }
    },

    /**
     * モーダルを閉じる
     */
    closeMapper: function() {
        const modal = document.getElementById('modal-dxf-layer-mapper');
        if (modal) modal.style.display = 'none';
    },

    /**
     * 設定を確定して非同期プログレスバー付きで解析を実行
     */
    confirmAndExecute: function() {
        const mapping = {
            gridLayer: document.getElementById('dxf-select-grid')?.value || "",
            col1FLayer: document.getElementById('dxf-select-1f-col')?.value || "",
            col2FLayer: document.getElementById('dxf-select-2f-col')?.value || "",
            roof1FLayer: document.getElementById('dxf-select-1f-roof')?.value || "",
            roof2FLayer: document.getElementById('dxf-select-2f-roof')?.value || "",
            back1FLayer: document.getElementById('dxf-select-1f-back')?.value || "",
            back2FLayer: document.getElementById('dxf-select-2f-back')?.value || "",
            slots: {
                grid: { fileIdx: parseInt(document.getElementById('dxf-file-grid')?.value || 0, 10), layer: document.getElementById('dxf-select-grid')?.value || "", origin: document.getElementById('dxf-origin-grid')?.value || "auto_min_grid" },
                col1F: { fileIdx: parseInt(document.getElementById('dxf-file-1f-col')?.value || 0, 10), layer: document.getElementById('dxf-select-1f-col')?.value || "", origin: document.getElementById('dxf-origin-1f-col')?.value || "auto_min_grid" },
                col2F: { fileIdx: parseInt(document.getElementById('dxf-file-2f-col')?.value || 0, 10), layer: document.getElementById('dxf-select-2f-col')?.value || "", origin: document.getElementById('dxf-origin-2f-col')?.value || "auto_min_grid" },
                roof1F: { fileIdx: parseInt(document.getElementById('dxf-file-1f-roof')?.value || 0, 10), layer: document.getElementById('dxf-select-1f-roof')?.value || "", origin: document.getElementById('dxf-origin-1f-roof')?.value || "auto_min_grid" },
                roof2F: { fileIdx: parseInt(document.getElementById('dxf-file-2f-roof')?.value || 0, 10), layer: document.getElementById('dxf-select-2f-roof')?.value || "", origin: document.getElementById('dxf-origin-2f-roof')?.value || "auto_min_grid" },
                back1F: { fileIdx: parseInt(document.getElementById('dxf-file-1f-back')?.value || 0, 10), layer: document.getElementById('dxf-select-1f-back')?.value || "", origin: document.getElementById('dxf-origin-1f-back')?.value || "auto_min_grid" },
                back2F: { fileIdx: parseInt(document.getElementById('dxf-file-2f-back')?.value || 0, 10), layer: document.getElementById('dxf-select-2f-back')?.value || "", origin: document.getElementById('dxf-origin-2f-back')?.value || "auto_min_grid" }
            }
        };

        if (!mapping.gridLayer) {
            alert("⚠️ 通り芯（グリッド）レイヤーが選択されていません。\n正確な基準座標スナップのため、必ず通り芯レイヤーを選択してください。");
            return;
        }

        this.closeMapper();

        // 割り当てられた指定主要レイヤーの集合を作成
        const assignedLayers = new Set(
            Object.values(mapping).filter(v => v && typeof v === 'string').map(v => v.toUpperCase().trim())
        );

        // 段階的プログレスアニメーション表示
        this.showProgress(15, "📂 DXF構造データをメモリにロードしています...");

        setTimeout(() => {
            this.showProgress(45, "⚙️ レイヤー構造および直線・柱の幾何要素を抽出中...");

            setTimeout(() => {
                this.showProgress(75, "📐 通り芯（グリッド）交点へ柱を100%厳密スナップ処理中...");

                setTimeout(() => {
                    if (typeof this.onConfirmCallback === 'function') {
                        this.onConfirmCallback(mapping, this.currentDxfRaw);
                    }

                    // [v3.11.11] 読込時点で指定主要レイヤー以外の不要レイヤーをスマート非表示化
                    const state = window.AppState || {};
                    state.layerMapping = mapping;
                    state.layerVisibility = {};

                    const allLayers = new Set();
                    (state.bgLinesOriginal || []).forEach(l => { if (l.layer) allLayers.add(l.layer.toUpperCase().trim()); });
                    (state.bgTextsOriginal || []).forEach(t => { if (t.layer) allLayers.add(t.layer.toUpperCase().trim()); });
                    (state.pillars || []).forEach(p => { if (p.layer) allLayers.add(p.layer.toUpperCase().trim()); });

                    allLayers.forEach(l => {
                        state.layerVisibility[l] = true;
                    });

                    if (window.AppController && window.AppController.refreshAll) {
                        window.AppController.refreshAll();
                    }

                    this.showProgress(100, "🎨 画面描画と計算結果を更新完了！");
                    setTimeout(() => {
                        this.closeProgress();
                        this.renderLayerPanel();
                    }, 400);
                }, 100);
            }, 100);
        }, 100);
    },

    /**
     * DXFレイヤ表示設定パネル (dxf-layer-panel) のレンダリング
     */
    renderLayerPanel: function() {
        const container = document.getElementById('layer-list-container');
        if (!container) return;
        container.innerHTML = '';

        const state = window.AppState || {};
        if (!state.layerVisibility) state.layerVisibility = {};

        // アプリケーション内の背景・図面レイヤー名を収集 (COL柱専用レイヤーは除外)
        const layerSet = new Set();
        (state.bgLinesOriginal || []).forEach(l => { 
            if (l.layer && !/(COL|COLUMN|柱)/i.test(l.layer)) layerSet.add(l.layer.toUpperCase().trim()); 
        });
        (state.bgTextsOriginal || []).forEach(t => { 
            if (t.layer && !/(COL|COLUMN|柱)/i.test(t.layer)) layerSet.add(t.layer.toUpperCase().trim()); 
        });

        const layers = Array.from(layerSet).sort();

        if (layers.length === 0) {
            container.innerHTML = '<div style="color:#999; padding:8px; text-align:center;">DXFレイヤーデータがありません</div>';
            return;
        }

        // 全選択 / 全解除ツールバー
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display:flex; justify-content:space-between; margin-bottom:8px; padding-bottom:6px; border-bottom:1px dashed #ccc;';
        toolbar.innerHTML = `
            <button type="button" id="btn-layer-all-on" style="font-size:10px; padding:2px 8px; background:#2ecc71; color:#fff; border:none; border-radius:3px; cursor:pointer;">✔ 全選択</button>
            <button type="button" id="btn-layer-all-off" style="font-size:10px; padding:2px 8px; background:#e74c3c; color:#fff; border:none; border-radius:3px; cursor:pointer;">✖ 全解除</button>
        `;
        container.appendChild(toolbar);

        toolbar.querySelector('#btn-layer-all-on').onclick = () => {
            layers.forEach(l => { state.layerVisibility[l] = true; });
            this.renderLayerPanel();
            if (window.AppController && window.AppController.refreshAll) window.AppController.refreshAll();
        };
        toolbar.querySelector('#btn-layer-all-off').onclick = () => {
            layers.forEach(l => { state.layerVisibility[l] = false; });
            this.renderLayerPanel();
            if (window.AppController && window.AppController.refreshAll) window.AppController.refreshAll();
        };

        // レイヤーチェックボックスリスト
        const listDiv = document.createElement('div');
        listDiv.style.cssText = 'display:flex; flex-direction:column; gap:4px; max-height:180px; overflow-y:auto;';

        layers.forEach(layer => {
            if (state.layerVisibility[layer] === undefined) {
                state.layerVisibility[layer] = true;
            }
            const isChecked = state.layerVisibility[layer] !== false;

            const item = document.createElement('label');
            item.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:11px; color:#2c3e50; cursor:pointer; padding:2px 4px; border-radius:3px; hover:background:#f1f2f6;';
            item.innerHTML = `
                <input type="checkbox" ${isChecked ? 'checked' : ''} style="cursor:pointer;">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${layer}">${layer}</span>
            `;

            item.querySelector('input').onchange = (e) => {
                state.layerVisibility[layer] = e.target.checked;
                if (window.AppController && window.AppController.refreshAll) window.AppController.refreshAll();
            };

            listDiv.appendChild(item);
        });

        container.appendChild(listDiv);

        // 下部：レイヤー再割り当てモーダル呼び出しボタン
        if (this.currentDxfRaw) {
            const reMapBtn = document.createElement('button');
            reMapBtn.type = 'button';
            reMapBtn.style.cssText = 'width:100%; margin-top:8px; padding:6px; background:#0056b3; color:#fff; border:none; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; text-align:center;';
            reMapBtn.innerText = '⚙️ レイヤー割当を再変更...';
            reMapBtn.onclick = () => {
                const panel = document.getElementById('dxf-layer-panel');
                if (panel) panel.style.display = 'none';
                this.openMapper(this.currentDxfRaw, this.onConfirmCallback);
            };
            container.appendChild(reMapBtn);
        }
    },

    /**
     * モーダル内DXF図面キャンバス描画（ビジュアル原点指定用）
     */
    lastPreviewBounds: null,
    lastGridIntersections: [],
    selectedVisualOriginPt: null,

    previewZoomScale: 1.0,
    previewPanOffset: { x: 0, y: 0 },

    /**
     * 超軽量・メモリ消費ゼロDXFテキスト線分スキャナー (フリーズ防止用)
     */
    parseDxfRawLinesDirect: function(rawTxt) {
        const lines = [];
        if (!rawTxt || typeof rawTxt !== 'string') return lines;

        // ENTITIESセクション位置を検索
        const entIdx = rawTxt.indexOf('ENTITIES');
        const searchTxt = entIdx !== -1 ? rawTxt.substring(entIdx, entIdx + 500000) : rawTxt.substring(0, 500000);

        // LINEエンティティの正規表現高速抽出 (最大1,500本までサンプリング)
        const lineRegex = /(?:^|\r?\n)0\r?\nLINE\r?\n[\s\S]*?10\r?\n([^\r\n]+)\r?\n20\r?\n([^\r\n]+)\r?\n11\r?\n([^\r\n]+)\r?\n21\r?\n([^\r\n]+)/g;
        let match;
        let count = 0;

        while ((match = lineRegex.exec(searchTxt)) !== null && count < 1500) {
            const x1 = parseFloat(match[1]);
            const y1 = parseFloat(match[2]);
            const x2 = parseFloat(match[3]);
            const y2 = parseFloat(match[4]);
            if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
                lines.push({ x1, y1, x2, y2 });
                count++;
            }
        }
        return lines;
    },

    renderPreviewCanvas: function(fileIdx) {
        const cvs = document.getElementById('dxf-origin-preview-canvas');
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        ctx.clearRect(0, 0, cvs.width, cvs.height);

        const fileObj = this.loadedFiles[fileIdx] || this.loadedFiles[0];
        if (!fileObj || !fileObj.rawTxt) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let lines = [];

        try {
            const dxf = window.CadEngine ? window.CadEngine.processDxf(fileObj.rawTxt) : null;
            if (dxf && dxf.entities) {
                function collectEntities(entities, blocks) {
                    if (!entities) return;
                    for (let i = 0; i < Math.min(entities.length, 2000); i++) {
                        const ent = entities[i];
                        if (ent.type === 'LINE' && ent.start && ent.end) {
                            lines.push({ x1: ent.start.x, y1: ent.start.y, x2: ent.end.x, y2: ent.end.y });
                            minX = Math.min(minX, ent.start.x, ent.end.x);
                            minY = Math.min(minY, ent.start.y, ent.end.y);
                            maxX = Math.max(maxX, ent.start.x, ent.end.x);
                            maxY = Math.max(maxY, ent.start.y, ent.end.y);
                        } else if ((ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') && ent.vertices && ent.vertices.length > 1) {
                            for (let j = 0; j < Math.min(ent.vertices.length - 1, 100); j++) {
                                const v1 = ent.vertices[j];
                                const v2 = ent.vertices[j + 1];
                                lines.push({ x1: v1.x, y1: v1.y, x2: v2.x, y2: v2.y });
                                minX = Math.min(minX, v1.x, v2.x);
                                minY = Math.min(minY, v1.y, v2.y);
                                maxX = Math.max(maxX, v1.x, v2.x);
                                maxY = Math.max(maxY, v1.y, v2.y);
                            }
                        }
                    }
                }
                collectEntities(dxf.entities, dxf.blocks);
            }
        } catch (e) {
            console.warn("CadEngine parse skipped in preview, fallback engaged:", e);
        }

        // ライブラリで線分が取れない場合は超軽量フォールバックパーサーを実行
        if (lines.length === 0) {
            lines = this.parseDxfRawLinesDirect(fileObj.rawTxt);
            lines.forEach(l => {
                minX = Math.min(minX, l.x1, l.x2);
                minY = Math.min(minY, l.y1, l.y2);
                maxX = Math.max(maxX, l.x1, l.x2);
                maxY = Math.max(maxY, l.y1, l.y2);
            });
        }

        if (minX === Infinity || lines.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '12px sans-serif';
            ctx.fillText('※プレビュー描画用エンティティがありません', 20, cvs.height / 2);
            return;
        }

        const w = maxX - minX || 1;
        const h = maxY - minY || 1;
        const padding = 20;
        const baseScale = Math.min((cvs.width - padding * 2) / w, (cvs.height - padding * 2) / h);
        const scale = baseScale * (this.previewZoomScale || 1.0);

        this.lastPreviewBounds = { minX, minY, maxX, maxY, scale, padding };

        // 通り芯交点の抽出 (最大30本×30本の計算キャップ制限)
        const xLines = lines.filter(l => Math.abs(l.x1 - l.x2) < 15).slice(0, 30);
        const yLines = lines.filter(l => Math.abs(l.y1 - l.y2) < 15).slice(0, 30);
        const intersections = [];

        xLines.forEach(xl => {
            yLines.forEach(yl => {
                const ix = (xl.x1 + xl.x2) / 2;
                const iy = (yl.y1 + yl.y2) / 2;
                if (!intersections.some(pt => Math.hypot(pt.x - ix, pt.y - iy) < 100)) {
                    intersections.push({ x: ix, y: iy });
                }
            });
        });
        // 通り芯交点がない場合は線分端点を交点候補に採用
        if (intersections.length === 0) {
            lines.slice(0, 50).forEach(l => {
                if (!intersections.some(pt => Math.hypot(pt.x - l.x1, pt.y - l.y1) < 500)) intersections.push({ x: l.x1, y: l.y1 });
            });
        }
        this.lastGridIntersections = intersections;

        const panX = this.previewPanOffset ? this.previewPanOffset.x : 0;
        const panY = this.previewPanOffset ? this.previewPanOffset.y : 0;

        const toCanvas = (x, y) => ({
            cx: padding + (x - minX) * scale + panX,
            cy: cvs.height - (padding + (y - minY) * scale) + panY
        });

        // 1. 線分要素のプレビュー描画
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        lines.forEach(l => {
            const p1 = toCanvas(l.x1, l.y1);
            const p2 = toCanvas(l.x2, l.y2);
            ctx.beginPath();
            ctx.moveTo(p1.cx, p1.cy);
            ctx.lineTo(p2.cx, p2.cy);
            ctx.stroke();
        });

        // 2. 通り芯交点（青いスナップポイント）の描画
        intersections.forEach(pt => {
            const cp = toCanvas(pt.x, pt.y);
            ctx.fillStyle = '#00d2d3';
            ctx.beginPath();
            ctx.arc(cp.cx, cp.cy, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        // 3. 選択中の基準原点ターゲットマーカー (赤い 🎯 マーカー)
        const targetPt = this.selectedVisualOriginPt || (intersections.length > 0 ? intersections[0] : null);
        if (targetPt) {
            const cp = toCanvas(targetPt.x, targetPt.y);
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cp.cx, cp.cy, 8, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#ff6b6b';
            ctx.beginPath();
            ctx.arc(cp.cx, cp.cy, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    /**
     * キャンバスイベント初期化（ホイールズーム、ドラッグパン、交点磁石スナップ）
     */
    initPreviewCanvasEvents: function() {
        const cvs = document.getElementById('dxf-origin-preview-canvas');
        const btnFit = document.getElementById('btn-preview-zoom-fit');
        if (!cvs) return;

        let isDragging = false;
        let lastMousePos = { x: 0, y: 0 };

        if (btnFit) {
            btnFit.onclick = () => {
                this.previewZoomScale = 1.0;
                this.previewPanOffset = { x: 0, y: 0 };
                this.renderPreviewCanvas(0);
            };
        }

        cvs.onwheel = (ev) => {
            ev.preventDefault();
            const zoomFactor = ev.deltaY < 0 ? 1.15 : 0.85;
            this.previewZoomScale = Math.max(0.2, Math.min(10.0, (this.previewZoomScale || 1.0) * zoomFactor));
            this.renderPreviewCanvas(0);
        };

        cvs.onmousedown = (ev) => {
            isDragging = true;
            lastMousePos = { x: ev.clientX, y: ev.clientY };
        };

        cvs.onmousemove = (ev) => {
            if (isDragging) {
                const dx = ev.clientX - lastMousePos.x;
                const dy = ev.clientY - lastMousePos.y;
                if (!this.previewPanOffset) this.previewPanOffset = { x: 0, y: 0 };
                this.previewPanOffset.x += dx;
                this.previewPanOffset.y += dy;
                lastMousePos = { x: ev.clientX, y: ev.clientY };
                this.renderPreviewCanvas(0);
            }
        };

        cvs.onmouseup = () => { isDragging = false; };
        cvs.onmouseleave = () => { isDragging = false; };
    },

    /**
     * キャンバスクリック時の交点判定 ＆ 原点決定
     */
    handlePreviewCanvasClick: function(clickCx, clickCy, cvsW, cvsH) {
        if (!this.lastPreviewBounds || !this.lastGridIntersections || this.lastGridIntersections.length === 0) return;

        const { minX, minY, scale, padding } = this.lastPreviewBounds;
        const panX = this.previewPanOffset ? this.previewPanOffset.x : 0;
        const panY = this.previewPanOffset ? this.previewPanOffset.y : 0;

        let closestPt = null;
        let minDist = Infinity;

        this.lastGridIntersections.forEach(pt => {
            const cx = padding + (pt.x - minX) * scale + panX;
            const cy = cvsH - (padding + (pt.y - minY) * scale) + panY;
            const d = Math.hypot(cx - clickCx, cy - clickCy);
            if (d < minDist) {
                minDist = d;
                closestPt = pt;
            }
        });

        if (closestPt) {
            this.selectedVisualOriginPt = closestPt;
            const infoEl = document.getElementById('preview-origin-info');
            if (infoEl) {
                infoEl.innerText = `🎯 基準指定交点: X=${Math.round(closestPt.x)}, Y=${Math.round(closestPt.y)}`;
            }
            this.renderPreviewCanvas(0);
        }
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('DxfLayerMapperController', window.DxfLayerMapperController);
}
