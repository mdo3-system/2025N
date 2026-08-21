/**
 * controllers/DxfLayerMapperController.js - Universal Step-by-Step DXF Wizard Controller
 * v3.12.42 All-Step Grid Layer Slots & Magnetic Snapping to Selected Grid Line Intersections
 */

window.DxfLayerMapperController = {
    loadedFiles: [], // [{ name, rawTxt, layers }]
    onConfirmCallback: null,

    currentStep: 1, // 1: 1F, 2: 2F, 3: 1F_ROOF, 4: 2F_ROOF

    stepData: {
        1: { fileIdx: 0, gridLayer: '', colLayer: '', backLayer: '', originPt: null },
        2: { fileIdx: 0, gridLayer: '', colLayer: '', backLayer: '', originPt: null },
        3: { fileIdx: 0, gridLayer: '', roofLayer: '', originPt: null },
        4: { fileIdx: 0, gridLayer: '', roofLayer: '', originPt: null }
    },

    established1FOrigin: null,     // Step 1 で確定した 1階基準原点 {x, y}
    established1FGridLines: [],    // Step 1 で抽出した 1階通り芯線分（Step 2以降で下絵として重ね描画）

    previewZoomScale: 1.0,
    previewPanOffset: { x: 0, y: 0 },
    selectedVisualOriginPt: null,
    currentStepGridIntersections: [], // 現在ステップの指定通り芯レイヤーの交点リスト

    /**
     * プログレスバー表示・非表示
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

    closeProgress: function() {
        const modal = document.getElementById('modal-dxf-loading');
        if (modal) modal.style.display = 'none';
    },

    /**
     * DXFステップバイステップウィザードモーダルを展開
     */
    openMapper: function(inputData, callback) {
        this.closeProgress();
        this.onConfirmCallback = callback;
        this.loadedFiles = [];
        this.currentStep = 1;
        this.established1FOrigin = null;
        this.established1FGridLines = [];

        this.gridTextStep = 1; // 通り芯文字を読み込むステップ（1: 1F, 2: 2F, 3: 1RF, 4: 2RF）
        // ステップデータの初期化（全ステップで gridLayer をサポート）
        this.stepData = {
            1: { fileIdx: 0, gridLayer: '', colLayer: '', backLayer: '', originPt: null },
            2: { fileIdx: 0, gridLayer: '', colLayer: '', backLayer: '', originPt: null },
            3: { fileIdx: 0, gridLayer: '', roofLayer: '', originPt: null },
            4: { fileIdx: 0, gridLayer: '', roofLayer: '', originPt: null }
        };

        if (Array.isArray(inputData)) {
            inputData.forEach(item => {
                const lines = this.parseDxfRawLinesDirect(item.rawTxt);
                const lSet = new Set();
                lines.forEach(l => { if (l.layer) lSet.add(l.layer.toUpperCase().trim()); });
                this.loadedFiles.push({ name: item.name, rawTxt: item.rawTxt, layers: Array.from(lSet).sort() });
            });
        } else if (typeof inputData === 'string') {
            const lines = this.parseDxfRawLinesDirect(inputData);
            const lSet = new Set();
            lines.forEach(l => { if (l.layer) lSet.add(l.layer.toUpperCase().trim()); });
            this.loadedFiles.push({ name: "単一DXFデータ.dxf", rawTxt: inputData, layers: Array.from(lSet).sort() });
        }

        if (this.loadedFiles.length === 0) {
            alert("❌ DXFの読み込みに失敗しました。");
            return;
        }

        // ファイル名の自動マッチング
        const isRoofFile = (name) => /(?:1RF|2RF|RF|屋根|下屋|大屋根|\b1R\b|\b2R\b)/i.test(name);
        
        const findIdx = (pat, excludeRoof = false) => {
            return this.loadedFiles.findIndex(f => {
                if (excludeRoof && isRoofFile(f.name)) return false;
                return pat.test(f.name);
            });
        };

        const idx1F = Math.max(0, findIdx(/(?:1F|1階|1_COL|1_BACK)/i, true));
        const idx2F = Math.max(0, findIdx(/(?:2F|2階|2_COL|2_BACK)/i, true));
        const idx1RF = Math.max(0, findIdx(/(?:1RF|1R|下屋)/i));
        const idx2RF = Math.max(0, findIdx(/(?:2RF|2R|RF|屋根|大屋根)/i));

        this.stepData[1].fileIdx = (idx1F >= 0) ? idx1F : 0;
        this.stepData[2].fileIdx = (idx2F >= 0) ? idx2F : (this.loadedFiles.length > 1 ? 1 : 0);
        this.stepData[3].fileIdx = (idx1RF >= 0) ? idx1RF : 0;
        this.stepData[4].fileIdx = (idx2RF >= 0) ? idx2RF : 0;

        const countEl = document.getElementById('dxf-mapper-layer-count');
        if (countEl) countEl.innerText = `ロード済みファイル: ${this.loadedFiles.length} 件`;

        const modal = document.getElementById('modal-dxf-mapper');
        if (modal) modal.style.display = 'flex';

        this.bindWizardEvents();
        this.renderStep(1);
    },

    /**
     * イベントハンドラーバインド
     */
    bindWizardEvents: function() {
        const btnNext = document.getElementById('btn-wizard-next');
        const btnPrev = document.getElementById('btn-wizard-prev');
        const btnSkip = document.getElementById('btn-wizard-skip');
        const btnCancel = document.getElementById('btn-wizard-cancel');
        const btnFit = document.getElementById('btn-preview-zoom-fit');

        if (btnNext) btnNext.onclick = () => this.nextStep();
        if (btnPrev) btnPrev.onclick = () => this.prevStep();
        if (btnSkip) btnSkip.onclick = () => this.finishWizard();
        if (btnCancel) btnCancel.onclick = () => this.closeModal();
        if (btnFit) btnFit.onclick = () => {
            this.previewZoomScale = 1.0;
            this.previewPanOffset = { x: 0, y: 0 };
            this.renderPreviewCanvas();
        };

        this.initPreviewCanvasEvents();
    },

    closeModal: function() {
        const modal = document.getElementById('modal-dxf-mapper');
        if (modal) modal.style.display = 'none';
    },

    /**
     * 各ステップでのDXFファイル追加ハンドラー
     */
    handleAddDxfFile: function(e, stepNum) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const rawTxt = evt.target.result;
            const lines = this.parseDxfRawLinesDirect(rawTxt);
            const lSet = new Set();
            lines.forEach(l => { if (l.layer) lSet.add(l.layer.toUpperCase().trim()); });

            const newIdx = this.loadedFiles.length;
            this.loadedFiles.push({
                name: file.name,
                rawTxt: rawTxt,
                layers: Array.from(lSet).sort()
            });

            // 現在のステップに対象ファイルを即座に割り当て
            this.stepData[stepNum].fileIdx = newIdx;

            // レイヤー自動マッチング
            const activeFileObj = this.loadedFiles[newIdx];
            const fileLayers = activeFileObj.layers;
            const findLayer = (pat) => fileLayers.find(l => pat.test(l)) || '';

            if (stepNum === 1) {
                this.stepData[1].gridLayer = findLayer(/(GRID|GLID|通り芯|軸線)/i);
                this.stepData[1].colLayer = findLayer(/(柱|COL|HASHIRA)/i);
                this.stepData[1].backLayer = '__ALL_LAYERS__';
            } else if (stepNum === 2) {
                this.stepData[2].gridLayer = findLayer(/(GRID|GLID|通り芯|軸線)/i);
                this.stepData[2].colLayer = findLayer(/(柱|COL|HASHIRA)/i);
                this.stepData[2].backLayer = '__ALL_LAYERS__';
            } else if (stepNum === 3 || stepNum === 4) {
                this.stepData[stepNum].gridLayer = findLayer(/(GRID|GLID|通り芯|軸線)/i);
                this.stepData[stepNum].roofLayer = findLayer(/(屋根|ROOF|下屋|大屋根)/i) || '__ALL_LAYERS__';
            }

            const countEl = document.getElementById('dxf-mapper-layer-count');
            if (countEl) countEl.innerText = `ロード済みファイル: ${this.loadedFiles.length} 件`;

            this.renderStep(stepNum);
        };
        reader.readAsText(file);
    },

    /**
     * 指定ステップのUIコントロールおよびプレビュー描画 (全ステップ通り芯スロット完備)
     */
    renderStep: function(stepNum) {
        this.currentStep = stepNum;
        this.previewZoomScale = 1.0;
        this.previewPanOffset = { x: 0, y: 0 };
        this.selectedVisualOriginPt = this.stepData[stepNum].originPt || null;

        // タブバッジ表示切替
        for (let i = 1; i <= 4; i++) {
            const badge = document.getElementById(`wizard-step-badge-${i}`);
            if (badge) {
                if (i === stepNum) {
                    badge.style.background = '#00d2d3';
                    badge.style.color = '#1e272e';
                } else if (i < stepNum) {
                    badge.style.background = '#10ac84';
                    badge.style.color = '#fff';
                } else {
                    badge.style.background = '#353b48';
                    badge.style.color = '#a4b0be';
                }
            }
        }

        // タイトルテキスト
        const titleEl = document.getElementById('wizard-step-title');
        const titles = {
            1: '🏠 【Step 1 / 4】1階図面の原点指定 (通り芯レイヤーを選択し、交点をクリックして基準原点を設定)',
            2: '🏢 【Step 2 / 4】2階図面の原点指定 (2階の通り芯レイヤーを選択し、1階原点🎯へ合わせる交点をクリック)',
            3: '🏠 【Step 3 / 4】1階屋根図面の原点指定 (屋根の通り芯レイヤーを選択し、1階原点🎯へ合わせる交点をクリック)',
            4: '🏠 【Step 4 / 4】2階屋根図面の原点指定 (屋根の通り芯レイヤーを選択し、1階原点🎯へ合わせる交点をクリック)'
        };
        if (titleEl) titleEl.innerText = titles[stepNum] || '';

        // フッターボタン表示制御
        const btnPrev = document.getElementById('btn-wizard-prev');
        const btnNext = document.getElementById('btn-wizard-next');
        const btnSkip = document.getElementById('btn-wizard-skip');
        if (btnPrev) btnPrev.style.display = (stepNum > 1) ? 'inline-block' : 'none';
        if (btnSkip) btnSkip.style.display = (stepNum >= 2) ? 'inline-block' : 'none';
        if (btnNext) btnNext.innerText = (stepNum === 4) ? '解析・読込完了 🚀' : '確定して次へ ➔';

        // ステップ専用コントロールの自動生成 (全ステップで通り芯レイヤー選択スロットを設置)
        const container = document.getElementById('wizard-step-control-container');
        if (!container) return;

        const curData = this.stepData[stepNum];
        const activeFileObj = this.loadedFiles[curData.fileIdx] || this.loadedFiles[0];
        const fileLayers = activeFileObj ? activeFileObj.layers : [];

        let html = '';
        const gridRadioHtml = `
            <div style="margin-top:8px; padding-top:6px; border-top:1px dashed #485460; display:flex; align-items:center; justify-content:space-between;">
                <label style="font-size:11px; color:#f1c40f; font-weight:bold; display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="radio" name="w-grid-text-step" value="${stepNum}" ${this.gridTextStep === stepNum ? 'checked' : ''} onchange="window.DxfLayerMapperController.gridTextStep = ${stepNum};" style="cursor:pointer;" />
                    🏷️ このファイルから通り芯名（文字）を読み込む
                </label>
                <span style="font-size:10px; color:#95a5a6;">※ 通り芯文字の重複防止のため、1つのファイルのみ選択できます（デフォルトは1階）</span>
            </div>
        `;

        if (stepNum === 1) {
            container.style.borderLeftColor = '#00d2d3';
            html = `
                <div style="display:grid; grid-template-columns: 1.3fr 1fr 1fr 1fr; gap:10px; align-items:center;">
                    <div>
                        <span style="font-size:11px; color:#a4b0be; display:block;">📁 1階対象ファイル:</span>
                        <div style="display:flex; gap:4px; align-items:center;">
                            <select id="w-file-select" style="flex:1; min-width:0; padding:6px; background:#1e272e; color:#fff; border:1px solid #485460; border-radius:4px; font-size:12px;"></select>
                            <button type="button" onclick="document.getElementById('w-file-add-input').click()" style="padding:6px 8px; background:#2980b9; color:#fff; border:none; border-radius:4px; font-size:11px; cursor:pointer; white-space:nowrap;" title="DXFファイルを追加">➕ 追加</button>
                            <input type="file" id="w-file-add-input" accept=".dxf" style="display:none;" onchange="window.DxfLayerMapperController.handleAddDxfFile(event, ${stepNum})" />
                        </div>
                    </div>
                    <div>
                        <span style="font-size:11px; color:#00d2d3; font-weight:bold; display:block;">📐 通り芯レイヤー:</span>
                        <select id="w-select-grid" style="width:100%; padding:6px; background:#1e272e; color:#fff; border:1px solid #485460; border-radius:4px; font-size:12px;"></select>
                    </div>
                    <div>
                        <span style="font-size:11px; color:#48dbfb; font-weight:bold; display:block;">🏛️ 1階柱レイヤー:</span>
                        <select id="w-select-col" style="width:100%; padding:6px; background:#1e272e; color:#fff; border:1px solid #485460; border-radius:4px; font-size:12px;"></select>
                    </div>
                    <div>
                        <span style="font-size:11px; color:#1dd1a1; font-weight:bold; display:block;">🖼️ 1階背景レイヤー:</span>
                        <select id="w-select-back" style="width:100%; padding:6px; background:#1e272e; color:#fff; border:1px solid #485460; border-radius:4px; font-size:12px;"></select>
                    </div>
                </div>
                ${gridRadioHtml}
            `;
        } else if (stepNum === 2) {
            container.style.borderLeftColor = '#ff9ff3';
            html = `
                <div style="display:grid; grid-template-columns: 1.3fr 1fr 1fr 1fr; gap:10px; align-items:center;">
                    <div>
                        <span style="font-size:11px; color:#a4b0be; display:block;">📁 2階対象ファイル:</span>
                        <div style="display:flex; gap:4px; align-items:center;">
                            <select id="w-file-select" style="flex:1; min-width:0; padding:6px; background:#1e272e; color:#fff; border:1px solid #485460; border-radius:4px; font-size:12px;"></select>
                            <button type="button" onclick="document.getElementById('w-file-add-input').click()" style="padding:6px 8px; background:#2980b9; color:#fff; border:none; border-radius:4px; font-size:11px; cursor:pointer; white-space:nowrap;" title="DXFファイルを追加">➕ 追加</button>
                            <input type="file" id="w-file-add-input" accept=".dxf" style="display:none;" onchange="window.DxfLayerMapperController.handleAddDxfFile(event, ${stepNum})" />
                        </div>
                    </div>
                    <div>
                        <span style="font-size:11px; color:#00d2d3; font-weight:bold; display:block;">📐 2階通り芯レイヤー:</span>
                        <select id="w-select-grid" style="width:100%; padding:6px; background:#1e272e; color:#fff; border:1px solid #485460; border-radius:4px; font-size:12px;"></select>
                    </div>
                    <div>
                        <span style="font-size:11px; color:#ff9ff3; font-weight:bold; display:block;">🏛️ 2階柱レイヤー:</span>
                        <select id="w-select-col" style="width:100%; padding:6px; background:#1e272e; color:#fff; border:1px solid #485460; border-radius:4px; font-size:12px;"></select>
                    </div>
                    <div>
                        <span style="font-size:11px; color:#54a0ff; font-weight:bold; display:block;">🖼️ 2階背景レイヤー:</span>
                        <select id="w-select-back" style="width:100%; padding:6px; background:#1e272e; color:#fff; border:1px solid #485460; border-radius:4px; font-size:12px;"></select>
                    </div>
                </div>
                ${gridRadioHtml}
            `;
        } else {
            container.style.borderLeftColor = (stepNum === 3) ? '#feca57' : '#ff6b6b';
            const label = (stepNum === 3) ? '1階屋根 (下屋) レイヤー:' : '2階屋根 (大屋根) レイヤー:';
            html = `
                <div style="display:grid; grid-template-columns: 1.3fr 1fr 1fr; gap:10px; align-items:center;">
                    <div>
                        <span style="font-size:11px; color:#a4b0be; display:block;">📁 屋根対象ファイル:</span>
                        <div style="display:flex; gap:4px; align-items:center;">
                            <select id="w-file-select" style="flex:1; min-width:0; padding:6px; background:#1e272e; color:#fff; border:1px solid #485460; border-radius:4px; font-size:12px;"></select>
                            <button type="button" onclick="document.getElementById('w-file-add-input').click()" style="padding:6px 8px; background:#2980b9; color:#fff; border:none; border-radius:4px; font-size:11px; cursor:pointer; white-space:nowrap;" title="DXFファイルを追加">➕ 追加</button>
                            <input type="file" id="w-file-add-input" accept=".dxf" style="display:none;" onchange="window.DxfLayerMapperController.handleAddDxfFile(event, ${stepNum})" />
                        </div>
                    </div>
                    <div>
                        <span style="font-size:11px; color:#00d2d3; font-weight:bold; display:block;">📐 通り芯レイヤー:</span>
                        <select id="w-select-grid" style="width:100%; padding:6px; background:#1e272e; color:#fff; border:1px solid #485460; border-radius:4px; font-size:12px;"></select>
                    </div>
                    <div>
                        <span style="font-size:11px; color:#feca57; font-weight:bold; display:block;">🏠 ${label}</span>
                        <select id="w-select-roof" style="width:100%; padding:6px; background:#1e272e; color:#fff; border:1px solid #485460; border-radius:4px; font-size:12px;"></select>
                    </div>
                </div>
                ${gridRadioHtml}
            `;
        }

        container.innerHTML = html;

        // ファイルドロップダウン生成
        const fileSel = document.getElementById('w-file-select');
        if (fileSel) {
            fileSel.innerHTML = '';
            this.loadedFiles.forEach((f, idx) => {
                const opt = document.createElement('option');
                opt.value = idx; opt.text = f.name;
                if (idx === curData.fileIdx) opt.selected = true;
                fileSel.appendChild(opt);
            });
            fileSel.onchange = (e) => {
                curData.fileIdx = parseInt(e.target.value || 0, 10);
                this.renderStep(stepNum);
            };
        }

        // レイヤードロップダウン設定
        const populateSelect = (elId, pat, currentVal, isBack = false) => {
            const el = document.getElementById(elId);
            if (!el) return;
            el.innerHTML = '';
            const defOpt = document.createElement('option');
            defOpt.value = ''; defOpt.text = '-- 未指定 (全レイヤー対象) --';
            el.appendChild(defOpt);

            if (isBack) {
                const allOpt = document.createElement('option');
                allOpt.value = '__ALL_LAYERS__';
                allOpt.text = '★ [ファイル内全レイヤー] を背景として取り込み';
                if (currentVal === '__ALL_LAYERS__') allOpt.selected = true;
                el.appendChild(allOpt);
            }

            const autoMatched = fileLayers.find(l => pat.test(l)) || "";
            fileLayers.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l; opt.text = l;
                if (currentVal && fileLayers.includes(currentVal)) {
                    if (currentVal === l) opt.selected = true;
                } else if (autoMatched === l) {
                    opt.selected = true;
                }
                el.appendChild(opt);
            });

            // 変更イベントでプレビューをリアルタイム更新
            el.onchange = () => {
                if (elId === 'w-select-grid') curData.gridLayer = el.value;
                this.renderPreviewCanvas();
            };
        };

        populateSelect('w-select-grid', /(GRID|GLID|通り芯|軸線|°)/i, curData.gridLayer);

        if (stepNum === 1) {
            populateSelect('w-select-col', /(1F_COL|1F.*COL|1F.*柱|COL|COLUMN|柱)/i, curData.colLayer);
            populateSelect('w-select-back', /(1F_BACK|1_BACK|1F.*背景|BACK|背景|下図)/i, curData.backLayer, true);
        } else if (stepNum === 2) {
            populateSelect('w-select-col', /(2F_COL|2F.*COL|2F.*柱|COL|COLUMN|柱)/i, curData.colLayer);
            populateSelect('w-select-back', /(2F_BACK|2_BACK|2F.*背景|BACK|背景|下図)/i, curData.backLayer, true);
        } else if (stepNum === 3) {
            populateSelect('w-select-roof', /(1F_R|1R|1RF|屋根|下屋)/i, curData.roofLayer, true);
        } else if (stepNum === 4) {
            populateSelect('w-select-roof', /(2F_R|2R|2RF|RF|大屋根|屋根)/i, curData.roofLayer, true);
        }

        this.renderPreviewCanvas();
    },

    /**
     * 次のステップへ進む
     */
    nextStep: function() {
        const curNum = this.currentStep;
        const curData = this.stepData[curNum];

        // 現在フォームの選択値を収集
        const fileSel = document.getElementById('w-file-select');
        if (fileSel) curData.fileIdx = parseInt(fileSel.value || 0, 10);
        curData.gridLayer = document.getElementById('w-select-grid')?.value || '';

        if (curNum === 1) {
            curData.colLayer = document.getElementById('w-select-col')?.value || '';
            curData.backLayer = document.getElementById('w-select-back')?.value || '';
            curData.originPt = this.selectedVisualOriginPt || { x: 0, y: 0 };
            this.established1FOrigin = curData.originPt;
        } else if (curNum === 2) {
            curData.colLayer = document.getElementById('w-select-col')?.value || '';
            curData.backLayer = document.getElementById('w-select-back')?.value || '';
            curData.originPt = this.selectedVisualOriginPt || { x: 0, y: 0 };
        } else if (curNum === 3 || curNum === 4) {
            curData.roofLayer = document.getElementById('w-select-roof')?.value || '';
            curData.originPt = this.selectedVisualOriginPt || { x: 0, y: 0 };
        }

        if (curNum < 4) {
            this.renderStep(curNum + 1);
        } else {
            this.finishWizard();
        }
    },

    /**
     * 前のステップへ戻る
     */
    prevStep: function() {
        if (this.currentStep > 1) {
            this.renderStep(this.currentStep - 1);
        }
    },

    /**
     * ウィザード完了：全ステップのデータを平行移動補正付きで順次パース・AppStateへ追記
     */
    
    /**
     * 合算された通り芯線分の重複排除（デデュープ）処理
     */
    deduplicateGridLines: function(bgLines) {
        if (!Array.isArray(bgLines)) return [];
        const gridLines = bgLines.filter(l => l.layerCategory === 'GRID' || /(GRID|GLID|通り芯|軸線|°)/i.test(l.layer));
        const otherLines = bgLines.filter(l => !(l.layerCategory === 'GRID' || /(GRID|GLID|通り芯|軸線|°)/i.test(l.layer)));

        const uniqueGrids = [];
        gridLines.forEach(line => {
            const lx1 = Math.min(line.x1, line.x2), ly1 = Math.min(line.y1, line.y2);
            const lx2 = Math.max(line.x1, line.x2), ly2 = Math.max(line.y1, line.y2);

            const isDuplicate = uniqueGrids.some(u => {
                const ux1 = Math.min(u.x1, u.x2), uy1 = Math.min(u.y1, u.y2);
                const ux2 = Math.max(u.x1, u.x2), uy2 = Math.max(u.y1, u.y2);
                // 幾何学的に端点座標が15mm以内で一致する場合重複とみなす
                return Math.hypot(lx1 - ux1, ly1 - uy1) < 15 && Math.hypot(lx2 - ux2, ly2 - uy2) < 15;
            });

            if (!isDuplicate) {
                line.layerCategory = 'GRID';
                line.layer = 'GRID';
                uniqueGrids.push(line);
            }
        });

        console.log(`✅ [Grid Dedupe] Reduced ${gridLines.length} grid lines to ${uniqueGrids.length} unique lines`);
        return [...uniqueGrids, ...otherLines];
    },

    finishWizard: function() {
        this.closeModal();
        this.showProgress(30, "⚙️ ステップ別DXFデータを解析中...");

        const s = window.AppState;

        // 手動入力データ以外を初期リセット
        s.bgLinesOriginal = [];
        s.bgTextsOriginal = [];
        s.pillars = (s.pillars || []).filter(p => p.isManual);
        if (s.docDrawings) {
            s.docDrawings.floor = { entities: [], loaded: false };
            s.docDrawings.div4  = { entities: [], loaded: false };
        }
        s.layerVisibility = {};

        const orig1F = this.established1FOrigin || { x: 0, y: 0 };

        // 統合 layerMapping の構築
        const fullMapping = {
            gridLayer:   this.stepData[1].gridLayer || '',
            col1FLayer:  this.stepData[1].colLayer || '',
            col2FLayer:  this.stepData[2].colLayer || '',
            back1FLayer: this.stepData[1].backLayer || '__ALL_LAYERS__',
            back2FLayer: this.stepData[2].backLayer || '__ALL_LAYERS__',
            roof1FLayer: this.stepData[3].roofLayer || '__ALL_LAYERS__',
            roof2FLayer: this.stepData[4].roofLayer || '__ALL_LAYERS__',
            slots: {
                grid:   { fileIdx: this.stepData[1].fileIdx },
                col1F:  { fileIdx: this.stepData[1].fileIdx },
                col2F:  { fileIdx: this.stepData[2].fileIdx },
                back1F: { fileIdx: this.stepData[1].fileIdx },
                back2F: { fileIdx: this.stepData[2].fileIdx },
                roof1F: { fileIdx: this.stepData[3].fileIdx },
                roof2F: { fileIdx: this.stepData[4].fileIdx }
            }
        };

        // 順次パース処理定義
        const stepsToProcess = [
            { stepNum: 1, key: 'grid',   layer: fullMapping.gridLayer   },
            { stepNum: 1, key: 'col1F',  layer: fullMapping.col1FLayer  },
            { stepNum: 1, key: 'back1F', layer: fullMapping.back1FLayer },
            { stepNum: 2, key: 'col2F',  layer: fullMapping.col2FLayer  },
            { stepNum: 2, key: 'back2F', layer: fullMapping.back2FLayer },
            { stepNum: 3, key: 'roof1F', layer: fullMapping.roof1FLayer },
            { stepNum: 4, key: 'roof2F', layer: fullMapping.roof2FLayer },
        ];

        stepsToProcess.forEach(({ stepNum, key, layer }) => {
            if (stepNum > 1 && !layer) return;
            const curData = this.stepData[stepNum];
            const fileObj = this.loadedFiles[curData.fileIdx];
            if (!fileObj || !fileObj.rawTxt) return;

            const startLineCount = (s.bgLinesOriginal || []).length;
            const startTextCount = (s.bgTextsOriginal || []).length;

            // 原点平行移動オフセット計算: dx = origin1F.x - targetOrigin.x
            const targetOrig = curData.originPt || orig1F;
            const dx = orig1F.x - targetOrig.x;
            const dy = orig1F.y - targetOrig.y;

            const targetFloorStr = (stepNum === 1) ? '1F' : ((stepNum === 2) ? '2F' : ((stepNum === 3) ? '1R' : '2R'));
            const singleMapping = {
                gridLayer:    key === 'grid'   ? layer : '',
                col1FLayer:   key === 'col1F'  ? layer : '',
                col2FLayer:   key === 'col2F'  ? layer : '',
                back1FLayer:  key === 'back1F' ? (layer || '__ALL_LAYERS__') : '',
                back2FLayer:  key === 'back2F' ? (layer || '__ALL_LAYERS__') : '',
                roof1FLayer:  key === 'roof1F' ? (layer || '__ALL_LAYERS__') : '',
                roof2FLayer:  key === 'roof2F' ? (layer || '__ALL_LAYERS__') : '',
                targetFloor:  targetFloorStr,
                skipGridText: (stepNum !== (this.gridTextStep || 1))
            };

            try {
                window.Parsers.parseDxf(
                    fileObj.rawTxt,
                    s,
                    false,  // isSub
                    false,  // skipEntities
                    singleMapping,
                    true,   // appendMode
                    dx,     // offsetX
                    dy      // offsetY
                );

                // パースで追加された全要素に対し、ステップの目的カテゴリを直接注入
                const targetCat = (stepNum === 1) ? '1F_BACK' : ((stepNum === 2) ? '2F_BACK' : ((stepNum === 3) ? '1F_ROOF' : '2F_ROOF'));
                if (s.bgLinesOriginal) {
                    for (let i = startLineCount; i < s.bgLinesOriginal.length; i++) {
                        const l = s.bgLinesOriginal[i];
                        if (key !== 'grid' && l.layerCategory !== 'GRID') {
                            l.layerCategory = targetCat;
                            l.floor = targetFloorStr;
                        }
                    }
                }
                if (s.bgTextsOriginal) {
                    for (let i = startTextCount; i < s.bgTextsOriginal.length; i++) {
                        const t = s.bgTextsOriginal[i];
                        if (key !== 'grid' && t.layerCategory !== 'GRID') {
                            t.layerCategory = targetCat;
                            t.floor = targetFloorStr;
                        }
                    }
                }

                console.log(`✅ [Step:${stepNum} Key:${key}] parsed ${(s.bgLinesOriginal||[]).length - startLineCount} lines with category ${targetCat}`);
            } catch(e) {
                console.error(`❌ [Wizard] Step ${stepNum} parse error:`, e);
            }
        });

        // 柱の重複除去（10mm以内）
        if (s.pillars) {
            s.pillars = s.pillars.filter((p, idx, self) =>
                idx === self.findIndex(t => t.floor === p.floor && Math.hypot(t.x - p.x, t.y - p.y) < 10)
            );
        }

        
        s.bgLinesOriginal = this.deduplicateGridLines(s.bgLinesOriginal);
        s.layerVisibility = {
            'GRID': true,
            '1F_BACK': true,
            '2F_BACK': true,
            '1F_ROOF': true,
            '2F_ROOF': true
        };
        // 全オリジナルレイヤーも可視化初期化
        s.bgLinesOriginal.forEach(l => {
            if (l.originalLayer) s.layerVisibility[l.originalLayer] = true;
            if (l.layer) s.layerVisibility[l.layer] = true;
        });
        s.layerMapping = fullMapping;


        if (window.GridEngine && window.GridEngine.analyzeGrids) {
            window.GridEngine.analyzeGrids(s);
        }

        this.closeProgress();

        if (typeof this.onConfirmCallback === 'function') {
            this.onConfirmCallback(fullMapping, this.loadedFiles);
        }

        if (window.AppController && window.AppController.refreshAll) {
            window.AppController.refreshAll();
        }
        setTimeout(() => {
            if (typeof window.zoomFit === 'function') {
                window.zoomFit();
                console.log('✅ [DXF Wizard] Auto-triggered zoomFit after import completion!');
            }
        }, 150);
    },

    /**
     * 万能DXF生テキストパーサー (Universal DXF Entity & Block Scanner)
     */
    parseDxfRawLinesDirect: function(rawTxt) {
        const lines = [];
        if (!rawTxt || typeof rawTxt !== 'string') return lines;

        const rawLines = rawTxt.split(/\r?\n/);
        let section = null;
        let blocks = {};
        let curBlockName = null;
        let curBlockEnts = [];
        let inserts = [];

        let curType = null, curLayer = "";
        let pts = [];
        let curR = null;

        const pushBlockEnt = () => {
            if (!curType || pts.length === 0) return;
            if (curType === 'LINE' && pts.length >= 2) {
                curBlockEnts.push({ type: 'LINE', layer: curLayer, x1: pts[0].x, y1: pts[0].y, x2: pts[1].x, y2: pts[1].y });
            } else if ((curType === 'LWPOLYLINE' || curType === 'POLYLINE') && pts.length >= 2) {
                for (let k = 0; k < pts.length - 1; k++) {
                    curBlockEnts.push({ type: 'LWPOLYLINE', layer: curLayer, x1: pts[k].x, y1: pts[k].y, x2: pts[k + 1].x, y2: pts[k + 1].y });
                }
            } else if ((curType === 'CIRCLE' || curType === 'ARC') && pts.length >= 1) {
                const r = curR || 100;
                curBlockEnts.push({ type: 'CIRCLE', layer: curLayer, x1: pts[0].x - r, y1: pts[0].y, x2: pts[0].x + r, y2: pts[0].y });
                curBlockEnts.push({ type: 'CIRCLE', layer: curLayer, x1: pts[0].x, y1: pts[0].y - r, x2: pts[0].x, y2: pts[0].y + r });
            }
        };

        const pushEntity = () => {
            if (!curType || pts.length === 0) return;
            if (curType === 'LINE' && pts.length >= 2) {
                lines.push({ type: 'LINE', layer: curLayer, x1: pts[0].x, y1: pts[0].y, x2: pts[1].x, y2: pts[1].y });
            } else if ((curType === 'LWPOLYLINE' || curType === 'POLYLINE') && pts.length >= 2) {
                for (let k = 0; k < pts.length - 1; k++) {
                    lines.push({ type: 'LWPOLYLINE', layer: curLayer, x1: pts[k].x, y1: pts[k].y, x2: pts[k + 1].x, y2: pts[k + 1].y });
                }
            } else if ((curType === 'CIRCLE' || curType === 'ARC') && pts.length >= 1) {
                const r = curR || 100;
                lines.push({ type: 'CIRCLE', layer: curLayer, x1: pts[0].x - r, y1: pts[0].y, x2: pts[0].x + r, y2: pts[0].y });
                lines.push({ type: 'CIRCLE', layer: curLayer, x1: pts[0].x, y1: pts[0].y - r, x2: pts[0].x, y2: pts[0].y + r });
            } else if (curType === 'POINT' && pts.length >= 1) {
                lines.push({ type: 'POINT', layer: curLayer, x1: pts[0].x - 50, y1: pts[0].y, x2: pts[0].x + 50, y2: pts[0].y });
                lines.push({ type: 'POINT', layer: curLayer, x1: pts[0].x, y1: pts[0].y - 50, x2: pts[0].x, y2: pts[0].y + 50 });
            } else if (curType === 'INSERT' && curBlockName && pts.length >= 1) {
                inserts.push({ name: curBlockName, layer: curLayer, x: pts[0].x, y: pts[0].y });
            }
        };

        for (let i = 0; i < rawLines.length - 1; i++) {
            const code = rawLines[i].trim();
            const val = rawLines[i + 1] ? rawLines[i + 1].trim() : "";

            if (code === '0' && val === 'SECTION') {
                const nextCode = rawLines[i + 2] ? rawLines[i + 2].trim() : "";
                const nextVal = rawLines[i + 3] ? rawLines[i + 3].trim() : "";
                if (nextCode === '2') section = nextVal;
            }
            if (code === '0' && val === 'ENDSEC') section = null;

            if (section === 'BLOCKS') {
                if (code === '0' && val === 'BLOCK') { pushBlockEnt(); curBlockName = null; curBlockEnts = []; }
                if (code === '2' && !curBlockName) curBlockName = val;
                if (code === '0' && val === 'ENDBLK') {
                    pushBlockEnt();
                    if (curBlockName) blocks[curBlockName] = curBlockEnts;
                    curBlockName = null; curBlockEnts = [];
                }
                if (curBlockName && code === '0' && val !== 'BLOCK') {
                    pushBlockEnt();
                    curType = val; curLayer = ""; pts = []; curR = null;
                }
                if (curBlockName) {
                    if (code === '8') curLayer = val;
                    if (code === '10') { if (!pts[0]) pts[0] = { x: 0, y: 0 }; pts[0].x = parseFloat(val); }
                    if (code === '20') { if (!pts[0]) pts[0] = { x: 0, y: 0 }; pts[0].y = parseFloat(val); }
                    if (code === '11') { if (!pts[1]) pts[1] = { x: 0, y: 0 }; pts[1].x = parseFloat(val); }
                    if (code === '21') { if (!pts[1]) pts[1] = { x: 0, y: 0 }; pts[1].y = parseFloat(val); }
                    if (code === '40') curR = parseFloat(val);
                }
            }

            if (section === 'ENTITIES' || (!section && code === '0')) {
                if (code === '0') {
                    pushEntity();
                    curType = val; curLayer = ""; curBlockName = null; pts = []; curR = null;
                }
                if (code === '8') curLayer = val;
                if (code === '2') curBlockName = val;
                if (code === '10') {
                    if (curType === 'LWPOLYLINE' || curType === 'POLYLINE') pts.push({ x: parseFloat(val), y: 0 });
                    else { if (!pts[0]) pts[0] = { x: 0, y: 0 }; pts[0].x = parseFloat(val); }
                }
                if (code === '20') {
                    const last = pts[pts.length - 1];
                    if ((curType === 'LWPOLYLINE' || curType === 'POLYLINE') && last) last.y = parseFloat(val);
                    else { if (!pts[0]) pts[0] = { x: 0, y: 0 }; pts[0].y = parseFloat(val); }
                }
                if (code === '11') { if (!pts[1]) pts[1] = { x: 0, y: 0 }; pts[1].x = parseFloat(val); }
                if (code === '21') { if (!pts[1]) pts[1] = { x: 0, y: 0 }; pts[1].y = parseFloat(val); }
                if (code === '40') curR = parseFloat(val);
            }
        }
        pushEntity();

        inserts.forEach(ins => {
            const blkEnts = blocks[ins.name] || [];
            blkEnts.forEach(ent => {
                const x1 = ent.x1 + ins.x, y1 = ent.y1 + ins.y;
                const x2 = ent.x2 + ins.x, y2 = ent.y2 + ins.y;
                lines.push({ type: ent.type || 'LINE', layer: ins.layer || ent.layer || '', x1, y1, x2, y2 });
            });
        });

        return lines;
    },

    /**
     * プレビューキャンバス描画（選択された通り芯レイヤーの交点磁石吸着＆リアルタイムアライメント描画）
     */
    renderPreviewCanvas: function() {
        const cvs = document.getElementById('dxf-origin-preview-canvas');
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        ctx.clearRect(0, 0, cvs.width, cvs.height);

        const curNum = this.currentStep;
        const curData = this.stepData[curNum];
        const fileObj = this.loadedFiles[curData.fileIdx] || this.loadedFiles[0];
        if (!fileObj || !fileObj.rawTxt) return;

        // 万能スキャナーで生テキストから全線分を解読抽出
        const rawLines = this.parseDxfRawLinesDirect(fileObj.rawTxt);

        if (curNum === 1) {
            // Step 1 の通り芯線分を保存
            const gridL = curData.gridLayer;
            this.established1FGridLines = rawLines.filter(l => gridL ? (l.layer && l.layer.toUpperCase().trim() === gridL.toUpperCase().trim()) : /(GRID|GLID|通り芯|軸線|°)/i.test(l.layer));
            if (this.established1FGridLines.length === 0) this.established1FGridLines = rawLines.slice(0, 100);
        }

        // 指定された通り芯レイヤー内の線分同士の交点をリアルタイム抽出
        const gridL = curData.gridLayer;
        const targetGridLines = rawLines.filter(l => {
            if (!gridL) return /(GRID|GLID|通り芯|軸線|°)/i.test(l.layer);
            return l.layer && (l.layer.toUpperCase().trim() === gridL.toUpperCase().trim());
        });

        const vertGrid = targetGridLines.filter(l => Math.abs(l.x1 - l.x2) < 80).slice(0, 50);
        const horizGrid = targetGridLines.filter(l => Math.abs(l.y1 - l.y2) < 80).slice(0, 50);
        const intersections = [];

        vertGrid.forEach(vl => {
            const vx = (vl.x1 + vl.x2) / 2;
            const vMinY = Math.min(vl.y1, vl.y2) - 500, vMaxY = Math.max(vl.y1, vl.y2) + 500;
            horizGrid.forEach(hl => {
                const hy = (hl.y1 + hl.y2) / 2;
                const hMinX = Math.min(hl.x1, hl.x2) - 500, hMaxX = Math.max(hl.x1, hl.x2) + 500;
                if (vx >= hMinX && vx <= hMaxX && hy >= vMinY && hy <= vMaxY) {
                    if (!intersections.some(pt => Math.hypot(pt.x - vx, pt.y - hy) < 20)) intersections.push({ x: vx, y: hy });
                }
            });
        });
        this.currentStepGridIntersections = intersections;

        // デフォルト選択原点（最初の通り芯交点、または図面中央）
        let minRawX = Infinity, minRawY = Infinity, maxRawX = -Infinity, maxRawY = -Infinity;
        rawLines.forEach(l => {
            if (l.x1 != null && !isNaN(l.x1)) { minRawX = Math.min(minRawX, l.x1); maxRawX = Math.max(maxRawX, l.x1); }
            if (l.y1 != null && !isNaN(l.y1)) { minRawY = Math.min(minRawY, l.y1); maxRawY = Math.max(maxRawY, l.y1); }
        });
        const defaultCenterPt = (intersections.length > 0) ? intersections[0] : ((minRawX !== Infinity) ? { x: (minRawX + maxRawX) / 2, y: (minRawY + maxRawY) / 2 } : { x: 0, y: 0 });

        const chosenPt = this.selectedVisualOriginPt || defaultCenterPt;
        curData.originPt = chosenPt;

        // 平行移動オフセット計算: Step 2以降ではクリックした交点 chosenPt が 1階基準原点 1FOrigin へ重ね合わさるようにシフト
        const orig1F = this.established1FOrigin || (this.stepData[1].originPt || { x: 0, y: 0 });
        const alignOffset = (curNum >= 2 && orig1F) ? {
            dx: orig1F.x - chosenPt.x,
            dy: orig1F.y - chosenPt.y
        } : { dx: 0, dy: 0 };

        // 描画用座標にアライメントシフトを反映
        const lines = rawLines.map(l => ({
            ...l,
            x1: l.x1 + alignOffset.dx, y1: l.y1 + alignOffset.dy,
            x2: l.x2 + alignOffset.dx, y2: l.y2 + alignOffset.dy
        }));

        // 描画バウンディングボックスの計算（1階基準座標系）
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        lines.forEach(l => {
            minX = Math.min(minX, l.x1, l.x2); maxX = Math.max(maxX, l.x1, l.x2);
            minY = Math.min(minY, l.y1, l.y2); maxY = Math.max(maxY, l.y1, l.y2);
        });

        if (curNum >= 2 && this.established1FGridLines.length > 0) {
            this.established1FGridLines.forEach(l => {
                minX = Math.min(minX, l.x1, l.x2); maxX = Math.max(maxX, l.x1, l.x2);
                minY = Math.min(minY, l.y1, l.y2); maxY = Math.max(maxY, l.y1, l.y2);
            });
        }

        if (minX === Infinity || lines.length === 0) {
            ctx.fillStyle = '#64748b'; ctx.font = '12px sans-serif';
            ctx.fillText('※プレビュー描画用エンティティがありません', 20, cvs.height / 2);
            return;
        }

        const w = maxX - minX || 1;
        const h = maxY - minY || 1;
        const padding = 25;
        const baseScale = Math.min((cvs.width - padding * 2) / w, (cvs.height - padding * 2) / h);
        const scale = baseScale * (this.previewZoomScale || 1.0);

        this.lastPreviewBounds = { minX, minY, maxX, maxY, scale, padding, alignOffset };

        const panX = this.previewPanOffset ? this.previewPanOffset.x : 0;
        const panY = this.previewPanOffset ? this.previewPanOffset.y : 0;

        const toCanvas = (x, y) => ({
            cx: padding + (x - minX) * scale + panX,
            cy: cvs.height - (padding + (y - minY) * scale) + panY
        });

        // 1. Step 2 以降の場合、1階通り芯を背景オーバーレイ描画
        if (curNum >= 2 && this.established1FGridLines.length > 0) {
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([5, 5]);
            this.established1FGridLines.forEach(l => {
                const p1 = toCanvas(l.x1, l.y1);
                const p2 = toCanvas(l.x2, l.y2);
                ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
            });
            ctx.setLineDash([]);
        }

        // 2. 現在図面の描画 (アライメント平行移動適用済み。指定された通り芯レイヤーは水色強調表示)
        lines.forEach(l => {
            const p1 = toCanvas(l.x1, l.y1);
            const p2 = toCanvas(l.x2, l.y2);
            ctx.beginPath();
            const isSelectedGrid = gridL && l.layer && (l.layer.toUpperCase().trim() === gridL.toUpperCase().trim());
            if (isSelectedGrid) {
                ctx.strokeStyle = '#00d2d3'; ctx.lineWidth = 1.5;
            } else if (l.type === 'CIRCLE' || l.type === 'POINT') {
                ctx.strokeStyle = '#ff7675'; ctx.lineWidth = 1.2;
            } else {
                ctx.strokeStyle = '#718093'; ctx.lineWidth = 1.0;
            }
            ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
        });

        // 3. 赤い基準原点 🎯 マーカー（1階基準原点位置に完全固定表示）
        const targetPtWorld = (curNum >= 2 && orig1F) ? orig1F : chosenPt;
        if (targetPtWorld) {
            const cp = toCanvas(targetPtWorld.x, targetPtWorld.y);
            ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 3.0;
            ctx.beginPath(); ctx.arc(cp.cx, cp.cy, 12, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#ff6b6b';
            ctx.beginPath(); ctx.arc(cp.cx, cp.cy, 5, 0, Math.PI * 2); ctx.fill();

            const infoEl = document.getElementById('wizard-preview-overlay-info');
            if (infoEl) {
                const gridNameStr = gridL ? `[通り芯レイヤー: "${gridL}"]` : '[通り芯レイヤー: 未指定]';
                if (curNum === 1) {
                    infoEl.innerText = `🎯 【1階基準原点】: (${Math.round(chosenPt.x)}, ${Math.round(chosenPt.y)}) ${gridNameStr}`;
                } else {
                    infoEl.innerText = `🎯 【1階基準原点🎯へ合致】: 選択通り芯交点 (${Math.round(chosenPt.x)}, ${Math.round(chosenPt.y)})  [位置補正量: dx=${Math.round(alignOffset.dx)}, dy=${Math.round(alignOffset.dy)}]`;
                }
            }
        }
    },

    /**
     * キャンバスイベント初期化（指定通り芯レイヤー交点へのスマート磁石スナップ＆100%ダイレクト指定）
     */
    initPreviewCanvasEvents: function() {
        const cvs = document.getElementById('dxf-origin-preview-canvas');
        if (!cvs) return;

        let isDragging = false;
        let lastMousePos = { x: 0, y: 0 };

        cvs.onwheel = (ev) => {
            ev.preventDefault();
            const zoomFactor = ev.deltaY < 0 ? 1.15 : 0.85;
            this.previewZoomScale = Math.max(0.2, Math.min(10.0, (this.previewZoomScale || 1.0) * zoomFactor));
            this.renderPreviewCanvas();
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
                this.renderPreviewCanvas();
            }
        };

        cvs.onmouseup = cvs.onmouseleave = () => { isDragging = false; };

        // クリックイベント：指定された通り芯レイヤー内の直線交点に優先磁石スナップ！
        cvs.onclick = (ev) => {
            const rect = cvs.getBoundingClientRect();
            const mouseX = ev.clientX - rect.left;
            const mouseY = ev.clientY - rect.top;

            const padding = 25;
            const panX = this.previewPanOffset ? this.previewPanOffset.x : 0;
            const panY = this.previewPanOffset ? this.previewPanOffset.y : 0;
            const bounds = this.lastPreviewBounds;
            if (!bounds || !bounds.scale) return;

            const alignOffset = bounds.alignOffset || { dx: 0, dy: 0 };

            // クリック位置のワールド生座標
            const clickedWorldX = bounds.minX + (mouseX - padding - panX) / bounds.scale - alignOffset.dx;
            const clickedWorldY = bounds.minY + (cvs.height - mouseY - padding + panY) / bounds.scale - alignOffset.dy;

            // 指定された通り芯レイヤーの交点リストから、クリック位置近く（画面上45px以内）の交点を探索
            let closestGridIntersection = null;
            let minSnapDistWorld = 45 / bounds.scale; // 磁石スナップ半径

            (this.currentStepGridIntersections || []).forEach(pt => {
                const d = Math.hypot(pt.x - clickedWorldX, pt.y - clickedWorldY);
                if (d < minSnapDistWorld) {
                    minSnapDistWorld = d;
                    closestGridIntersection = pt;
                }
            });

            // 通り芯交点が見つかればそれに精密磁石スナップ！なければクリックされた場所を採用
            const targetPt = closestGridIntersection || { x: clickedWorldX, y: clickedWorldY };

            this.selectedVisualOriginPt = targetPt;
            this.stepData[this.currentStep].originPt = targetPt;
            if (this.currentStep === 1) {
                this.established1FOrigin = targetPt;
            }
            this.renderPreviewCanvas();
        };
    },
    toggleDxfLayerPanel: function() {
        if (typeof window.renderLayerPanel === 'function') {
            window.renderLayerPanel();
        }
        const panel = document.getElementById('dxf-layer-panel');
        if (panel) {
            const isHidden = (panel.style.display === 'none' || panel.style.display === '');
            panel.style.display = isHidden ? 'block' : 'none';
            return;
        }
        const modal = document.getElementById('modal-dxf-layer-toggle');
        if (modal) {
            modal.style.display = (modal.style.display === 'none' || !modal.style.display) ? 'flex' : 'none';
        }
    }
};

window.toggleLayerPanelDirect = function() {
    return window.DxfLayerMapperController.toggleDxfLayerPanel();
};

window.toggleDxfLayerPanel = window.toggleLayerPanelDirect;
window.openOrToggleDxfLayerPanel = window.toggleLayerPanelDirect;

if (window.ServiceContainer) {
    window.ServiceContainer.register('DxfLayerMapperController', window.DxfLayerMapperController);
}
