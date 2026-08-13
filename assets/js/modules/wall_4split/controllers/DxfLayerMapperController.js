/**
 * controllers/DxfLayerMapperController.js - Step-by-Step DXF Import Wizard Controller
 * v3.12.33 Complete Step-by-Step Architecture
 */

window.DxfLayerMapperController = {
    loadedFiles: [], // [{ name, rawTxt, layers }]
    onConfirmCallback: null,

    currentStep: 1, // 1: 1F, 2: 2F, 3: 1F_ROOF, 4: 2F_ROOF

    stepData: {
        1: { fileIdx: 0, gridLayer: '', colLayer: '', backLayer: '', originPt: null },
        2: { fileIdx: 0, colLayer: '', backLayer: '', originPt: null },
        3: { fileIdx: 0, roofLayer: '', originPt: null },
        4: { fileIdx: 0, roofLayer: '', originPt: null }
    },

    established1FOrigin: null,     // Step 1 で確定した 1階基準原点 {x, y}
    established1FGridLines: [],    // Step 1 で抽出した 1階通り芯線分（Step 2以降で下絵として重ね描画）

    previewZoomScale: 1.0,
    previewPanOffset: { x: 0, y: 0 },
    lastGridIntersections: [],
    selectedVisualOriginPt: null,

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

        // ステップデータの初期化
        this.stepData = {
            1: { fileIdx: 0, gridLayer: '', colLayer: '', backLayer: '', originPt: null },
            2: { fileIdx: 0, colLayer: '', backLayer: '', originPt: null },
            3: { fileIdx: 0, roofLayer: '', originPt: null },
            4: { fileIdx: 0, roofLayer: '', originPt: null }
        };

        if (Array.isArray(inputData)) {
            inputData.forEach(item => {
                const lSet = new Set();
                try {
                    const dxf = window.CadEngine ? window.CadEngine.processDxf(item.rawTxt) : null;
                    if (dxf) {
                        if (dxf.entities) dxf.entities.forEach(ent => { if (ent.layer) lSet.add(ent.layer.toUpperCase().trim()); });
                        if (dxf.blocks) Object.values(dxf.blocks).forEach(b => { if (b && b.entities) b.entities.forEach(e => { if (e.layer) lSet.add(e.layer.toUpperCase().trim()); }); });
                    }
                } catch(e) {}
                const directLines = this.parseDxfRawLinesDirect(item.rawTxt);
                directLines.forEach(l => { if (l.layer) lSet.add(l.layer.toUpperCase().trim()); });
                this.loadedFiles.push({ name: item.name, rawTxt: item.rawTxt, layers: Array.from(lSet).sort() });
            });
        } else if (typeof inputData === 'string') {
            const lSet = new Set();
            const directLines = this.parseDxfRawLinesDirect(inputData);
            directLines.forEach(l => { if (l.layer) lSet.add(l.layer.toUpperCase().trim()); });
            this.loadedFiles.push({ name: "単一DXFデータ.dxf", rawTxt: inputData, layers: Array.from(lSet).sort() });
        }

        if (this.loadedFiles.length === 0) {
            alert("❌ DXFの読み込みに失敗しました。");
            return;
        }

        // ファイル名の自動マッチング（各ステップへデフォルトファイルを自動セット）
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
     * 指定ステップのUIコントロールおよびプレビュー描画
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
            1: '🏠 【Step 1 / 4】1階図面の読込（通り芯・1階柱・1階背景）',
            2: '🏢 【Step 2 / 4】2階図面の読込（2階柱・2階背景）',
            3: '🏠 【Step 3 / 4】1階屋根伏図面の読込 (任意)',
            4: '🏠 【Step 4 / 4】2階屋根伏図面の読込 (任意)'
        };
        if (titleEl) titleEl.innerText = titles[stepNum] || '';

        // フッターボタン表示制御
        const btnPrev = document.getElementById('btn-wizard-prev');
        const btnNext = document.getElementById('btn-wizard-next');
        const btnSkip = document.getElementById('btn-wizard-skip');
        if (btnPrev) btnPrev.style.display = (stepNum > 1) ? 'inline-block' : 'none';
        if (btnSkip) btnSkip.style.display = (stepNum >= 2) ? 'inline-block' : 'none';
        if (btnNext) btnNext.innerText = (stepNum === 4) ? '解析・読込完了 🚀' : '確定して次へ ➔';

        // ステップ専用コントロールの自動生成
        const container = document.getElementById('wizard-step-control-container');
        if (!container) return;

        const curData = this.stepData[stepNum];
        const activeFileObj = this.loadedFiles[curData.fileIdx] || this.loadedFiles[0];
        const fileLayers = activeFileObj ? activeFileObj.layers : [];

        let html = '';
        if (stepNum === 1) {
            container.style.borderLeftColor = '#00d2d3';
            html = `
                <div style="display:grid; grid-template-columns: 1.2fr 1fr 1fr 1fr; gap:10px; align-items:center;">
                    <div>
                        <span style="font-size:11px; color:#a4b0be; display:block;">📁 1階対象ファイル:</span>
                        <select id="w-file-select" style="width:100%; padding:6px; background:#1e272e; color:#fff; border:1px solid #485460; border-radius:4px; font-size:12px;"></select>
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
            `;
        } else if (stepNum === 2) {
            container.style.borderLeftColor = '#ff9ff3';
            html = `
                <div style="display:grid; grid-template-columns: 1.2fr 1fr 1fr; gap:12px; align-items:center;">
                    <div>
                        <span style="font-size:11px; color:#a4b0be; display:block;">📁 2階対象ファイル:</span>
                        <select id="w-file-select" style="width:100%; padding:6px; background:#1e272e; color:#fff; border:1px solid #485460; border-radius:4px; font-size:12px;"></select>
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
            `;
        } else {
            container.style.borderLeftColor = (stepNum === 3) ? '#feca57' : '#ff6b6b';
            const label = (stepNum === 3) ? '1階屋根 (下屋) レイヤー:' : '2階屋根 (大屋根) レイヤー:';
            html = `
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; align-items:center;">
                    <div>
                        <span style="font-size:11px; color:#a4b0be; display:block;">📁 屋根対象ファイル:</span>
                        <select id="w-file-select" style="width:100%; padding:6px; background:#1e272e; color:#fff; border:1px solid #485460; border-radius:4px; font-size:12px;"></select>
                    </div>
                    <div>
                        <span style="font-size:11px; color:#feca57; font-weight:bold; display:block;">🏠 ${label}</span>
                        <select id="w-select-roof" style="width:100%; padding:6px; background:#1e272e; color:#fff; border:1px solid #485460; border-radius:4px; font-size:12px;"></select>
                    </div>
                </div>
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
            defOpt.value = ''; defOpt.text = '-- 未指定 (取り込まない) --';
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
        };

        if (stepNum === 1) {
            populateSelect('w-select-grid', /(GRID|GLID|通り芯|軸線)/i, curData.gridLayer);
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

        if (curNum === 1) {
            curData.gridLayer = document.getElementById('w-select-grid')?.value || '';
            curData.colLayer = document.getElementById('w-select-col')?.value || '';
            curData.backLayer = document.getElementById('w-select-back')?.value || '';
            curData.originPt = this.selectedVisualOriginPt || (this.lastGridIntersections[0] || { x: 0, y: 0 });
            this.established1FOrigin = curData.originPt;
        } else if (curNum === 2) {
            curData.colLayer = document.getElementById('w-select-col')?.value || '';
            curData.backLayer = document.getElementById('w-select-back')?.value || '';
            curData.originPt = this.selectedVisualOriginPt || (this.lastGridIntersections[0] || { x: 0, y: 0 });
        } else if (curNum === 3 || curNum === 4) {
            curData.roofLayer = document.getElementById('w-select-roof')?.value || '';
            curData.originPt = this.selectedVisualOriginPt || (this.lastGridIntersections[0] || { x: 0, y: 0 });
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
            back1FLayer: this.stepData[1].backLayer || '',
            back2FLayer: this.stepData[2].backLayer || '',
            roof1FLayer: this.stepData[3].roofLayer || '',
            roof2FLayer: this.stepData[4].roofLayer || '',
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
            if (!layer) return;
            const curData = this.stepData[stepNum];
            const fileObj = this.loadedFiles[curData.fileIdx];
            if (!fileObj || !fileObj.rawTxt) return;

            // 原点平行移動オフセット計算: dx = origin1F.x - targetOrigin.x
            const targetOrig = curData.originPt || orig1F;
            const dx = orig1F.x - targetOrig.x;
            const dy = orig1F.y - targetOrig.y;

            const targetFloorStr = (stepNum === 1) ? '1F' : ((stepNum === 2) ? '2F' : ((stepNum === 3) ? '1R' : '2R'));
            const singleMapping = {
                gridLayer:   key === 'grid'   ? layer : '',
                col1FLayer:  key === 'col1F'  ? layer : '',
                col2FLayer:  key === 'col2F'  ? layer : '',
                back1FLayer: key === 'back1F' ? layer : '',
                back2FLayer: key === 'back2F' ? layer : '',
                roof1FLayer: key === 'roof1F' ? layer : '',
                roof2FLayer: key === 'roof2F' ? layer : '',
                targetFloor: targetFloorStr
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
                console.log(`✅ [Step:${stepNum} Key:${key}] parsed from "${fileObj.name}" offset=(${Math.round(dx)}, ${Math.round(dy)})`);
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
    },

    /**
     * 高速DXFストリーミングスキャナー (BLOCKS / INSERT 展開対応)
         /**
     * 高速DXFストリーミングスキャナー (BLOCKS / INSERT 展開対応)
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

        let curType = null, curLayer = "", curX1 = null, curY1 = null, curX2 = null, curY2 = null, curR = null;

        const pushBlockEnt = () => {
            if (!curType) return;
            if (curType === 'LINE' && curX1 !== null && curY1 !== null && curX2 !== null && curY2 !== null) {
                curBlockEnts.push({ type: 'LINE', layer: curLayer, x1: curX1, y1: curY1, x2: curX2, y2: curY2 });
            } else if (curType === 'CIRCLE' && curX1 !== null && curY1 !== null) {
                const r = curR || 100;
                curBlockEnts.push({ type: 'CIRCLE', layer: curLayer, x1: curX1 - r, y1: curY1, x2: curX1 + r, y2: curY1 });
                curBlockEnts.push({ type: 'CIRCLE', layer: curLayer, x1: curX1, y1: curY1 - r, x2: curX1, y2: curY1 + r });
            }
        };

        const pushEntity = () => {
            if (!curType) return;
            if (curType === 'LINE' && curX1 !== null && curY1 !== null && curX2 !== null && curY2 !== null) {
                lines.push({ type: 'LINE', layer: curLayer, x1: curX1, y1: curY1, x2: curX2, y2: curY2 });
            } else if (curType === 'CIRCLE' && curX1 !== null && curY1 !== null) {
                const r = curR || 100;
                lines.push({ type: 'CIRCLE', layer: curLayer, x1: curX1 - r, y1: curY1, x2: curX1 + r, y2: curY1 });
                lines.push({ type: 'CIRCLE', layer: curLayer, x1: curX1, y1: curY1 - r, x2: curX1, y2: curY1 + r });
            } else if (curType === 'POINT' && curX1 !== null && curY1 !== null) {
                lines.push({ type: 'POINT', layer: curLayer, x1: curX1 - 50, y1: curY1, x2: curX1 + 50, y2: curY1 });
                lines.push({ type: 'POINT', layer: curLayer, x1: curX1, y1: curY1 - 50, x2: curX1, y2: curY1 + 50 });
            } else if (curType === 'INSERT' && curBlockName && curX1 !== null && curY1 !== null) {
                inserts.push({ name: curBlockName, layer: curLayer, x: curX1, y: curY1 });
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
                    curType = val; curLayer = ""; curX1 = null; curY1 = null; curX2 = null; curY2 = null; curR = null;
                }
                if (curBlockName) {
                    if (code === '8') curLayer = val;
                    if (code === '10') curX1 = parseFloat(val);
                    if (code === '20') curY1 = parseFloat(val);
                    if (code === '11') curX2 = parseFloat(val);
                    if (code === '21') curY2 = parseFloat(val);
                    if (code === '40') curR = parseFloat(val);
                }
            }

            if (section === 'ENTITIES' || (!section && code === '0')) {
                if (code === '0') {
                    pushEntity();
                    curType = val; curLayer = ""; curBlockName = null; curX1 = null; curY1 = null; curX2 = null; curY2 = null; curR = null;
                }
                if (code === '8') curLayer = val;
                if (code === '2') curBlockName = val;
                if (code === '10') curX1 = parseFloat(val);
                if (code === '20') curY1 = parseFloat(val);
                if (code === '11') curX2 = parseFloat(val);
                if (code === '21') curY2 = parseFloat(val);
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
     * プレビューキャンバス描画（1画面1ファイル巨大表示 ＆ Step 1通り芯重ね下絵描画）
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

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let lines = [];

        const addPt = (x, y) => {
            if (x == null || y == null || isNaN(x) || isNaN(y)) return;
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        };

        try {
            const dxf = window.CadEngine ? window.CadEngine.processDxf(fileObj.rawTxt) : null;
            if (dxf && dxf.entities) {
                function collectEntities(entities, blocks, parentX = 0, parentY = 0, depth = 0) {
                    if (!entities || depth > 5) return;
                    for (let i = 0; i < Math.min(entities.length, 10000); i++) {
                        const ent = entities[i];
                        if (ent.type === 'LINE' && ent.start && ent.end) {
                            const x1 = ent.start.x + parentX, y1 = ent.start.y + parentY;
                            const x2 = ent.end.x + parentX, y2 = ent.end.y + parentY;
                            lines.push({ type: 'LINE', layer: ent.layer || "", x1, y1, x2, y2 });
                            addPt(x1, y1); addPt(x2, y2);
                        } else if ((ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') && ent.vertices && ent.vertices.length > 1) {
                            for (let j = 0; j < Math.min(ent.vertices.length - 1, 400); j++) {
                                const v1 = ent.vertices[j], v2 = ent.vertices[j + 1];
                                const x1 = v1.x + parentX, y1 = v1.y + parentY;
                                const x2 = v2.x + parentX, y2 = v2.y + parentY;
                                lines.push({ type: 'LWPOLYLINE', layer: ent.layer || "", x1, y1, x2, y2 });
                                addPt(x1, y1); addPt(x2, y2);
                            }
                        } else if (ent.type === 'CIRCLE' && ent.center) {
                            const cx = ent.center.x + parentX, cy = ent.center.y + parentY, r = ent.radius || 100;
                            lines.push({ type: 'CIRCLE', layer: ent.layer || "", x1: cx - r, y1: cy, x2: cx + r, y2: cy });
                            lines.push({ type: 'CIRCLE', layer: ent.layer || "", x1: cx, y1: cy - r, x2: cx, y2: cy + r });
                            addPt(cx - r, cy - r); addPt(cx + r, cy + r);
                        } else if (ent.type === 'POINT' && ent.position) {
                            const px = ent.position.x + parentX, py = ent.position.y + parentY;
                            lines.push({ type: 'POINT', layer: ent.layer || "", x1: px - 80, y1: py, x2: px + 80, y2: py });
                            lines.push({ type: 'POINT', layer: ent.layer || "", x1: px, y1: py - 80, x2: px, y2: py + 80 });
                            addPt(px - 100, py - 100); addPt(px + 100, py + 100);
                        } else if (ent.type === 'INSERT' && blocks) {
                            const blk = blocks[ent.name];
                            const posX = (ent.position ? ent.position.x : (ent.insertionPoint ? ent.insertionPoint.x : 0));
                            const posY = (ent.position ? ent.position.y : (ent.insertionPoint ? ent.insertionPoint.y : 0));
                            if (blk && blk.entities) collectEntities(blk.entities, blocks, parentX + posX, parentY + posY, depth + 1);
                        }
                    }
                }
                collectEntities(dxf.entities, dxf.blocks);
            }
        } catch(e) {}

        if (lines.length === 0) {
            lines = this.parseDxfRawLinesDirect(fileObj.rawTxt);
            lines.forEach(l => {
                addPt(l.x1, l.y1);
                addPt(l.x2, l.y2);
            });
        }

        if (curNum === 1) {
            // Step 1 の通り芯線分を保存しておく
            this.established1FGridLines = lines.filter(l => /(GRID|GLID|通り芯|軸線)/i.test(l.layer));
            if (this.established1FGridLines.length === 0) this.established1FGridLines = lines.slice(0, 80);
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

        this.lastPreviewBounds = { minX, minY, maxX, maxY, scale, padding };

        const panX = this.previewPanOffset ? this.previewPanOffset.x : 0;
        const panY = this.previewPanOffset ? this.previewPanOffset.y : 0;

        const toCanvas = (x, y) => ({
            cx: padding + (x - minX) * scale + panX,
            cy: cvs.height - (padding + (y - minY) * scale) + panY
        });

        // 1. Step 2 以降の場合、1階通り芯を背景オーバーレイ描画
        if (curNum >= 2 && this.established1FGridLines.length > 0) {
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            this.established1FGridLines.forEach(l => {
                const p1 = toCanvas(l.x1, l.y1);
                const p2 = toCanvas(l.x2, l.y2);
                ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
            });
            ctx.setLineDash([]);
        }

        // 2. 現在図面の鮮明な描画
        lines.forEach(l => {
            const p1 = toCanvas(l.x1, l.y1);
            const p2 = toCanvas(l.x2, l.y2);
            ctx.beginPath();
            if (l.type === 'CIRCLE' || l.type === 'POINT') {
                ctx.strokeStyle = '#ff7675'; ctx.lineWidth = 1.5;
            } else {
                ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
            }
            ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
        });

        // 3. 通り芯交点・候補スナップポイント計算
        const vertLines = lines.filter(l => Math.abs(l.x1 - l.x2) < 30).slice(0, 50);
        const horizLines = lines.filter(l => Math.abs(l.y1 - l.y2) < 30).slice(0, 50);
        const intersections = [];

        vertLines.forEach(vl => {
            const vx = (vl.x1 + vl.x2) / 2;
            const vMinY = Math.min(vl.y1, vl.y2) - 300, vMaxY = Math.max(vl.y1, vl.y2) + 300;
            horizLines.forEach(hl => {
                const hy = (hl.y1 + hl.y2) / 2;
                const hMinX = Math.min(hl.x1, hl.x2) - 300, hMaxX = Math.max(hl.x1, hl.x2) + 300;
                if (vx >= hMinX && vx <= hMaxX && hy >= vMinY && hy <= vMaxY) {
                    if (!intersections.some(pt => Math.hypot(pt.x - vx, pt.y - hy) < 50)) intersections.push({ x: vx, y: hy });
                }
            });
        });

        if (intersections.length === 0) {
            lines.forEach(l => {
                if (l.type === 'CIRCLE' || l.type === 'POINT') {
                    const cx = (l.x1 + l.x2) / 2, cy = (l.y1 + l.y2) / 2;
                    if (!intersections.some(pt => Math.hypot(pt.x - cx, pt.y - cy) < 50)) intersections.push({ x: cx, y: cy });
                }
            });
        }
        if (intersections.length === 0) {
            lines.slice(0, 50).forEach(l => {
                if (!intersections.some(pt => Math.hypot(pt.x - l.x1, pt.y - l.y1) < 500)) intersections.push({ x: l.x1, y: l.y1 });
            });
        }
        this.lastGridIntersections = intersections;

        // 青スナップ描画
        intersections.forEach(pt => {
            const cp = toCanvas(pt.x, pt.y);
            ctx.fillStyle = '#00d2d3';
            ctx.beginPath(); ctx.arc(cp.cx, cp.cy, 5, 0, Math.PI * 2); ctx.fill();
        });

        // 4. 赤い原点ターゲット 🎯 マーカー
        const targetPt = this.selectedVisualOriginPt || (intersections[0] || null);
        if (targetPt) {
            const cp = toCanvas(targetPt.x, targetPt.y);
            ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(cp.cx, cp.cy, 10, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#ff6b6b';
            ctx.beginPath(); ctx.arc(cp.cx, cp.cy, 4, 0, Math.PI * 2); ctx.fill();

            const infoEl = document.getElementById('wizard-preview-overlay-info');
            if (infoEl) {
                infoEl.innerText = `🎯 基準原点: (${Math.round(targetPt.x)}, ${Math.round(targetPt.y)})`;
            }
        }
    },

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

        // クリックによる基準原点スナップ選択
        cvs.onclick = (ev) => {
            const rect = cvs.getBoundingClientRect();
            const mouseX = ev.clientX - rect.left;
            const mouseY = ev.clientY - rect.top;

            const padding = 25;
            const panX = this.previewPanOffset ? this.previewPanOffset.x : 0;
            const panY = this.previewPanOffset ? this.previewPanOffset.y : 0;

            let closest = null, minDist = 35;
            this.lastGridIntersections.forEach(pt => {
                const cp = {
                    cx: padding + (pt.x - this.lastPreviewBounds?.minX) * this.lastPreviewBounds?.scale + panX,
                    cy: cvs.height - (padding + (pt.y - this.lastPreviewBounds?.minY) * this.lastPreviewBounds?.scale) + panY
                };
                const dist = Math.hypot(cp.cx - mouseX, cp.cy - mouseY);
                if (dist < minDist) { minDist = dist; closest = pt; }
            });

            if (closest) {
                this.selectedVisualOriginPt = closest;
                this.stepData[this.currentStep].originPt = closest;
                this.renderPreviewCanvas();
            }
        };
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('DxfLayerMapperController', window.DxfLayerMapperController);
}
