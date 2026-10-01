/**
 * controllers/FoundationSectionController.js - Controller & Adapter for Foundation Beam Section CAD Modal
 * v3.13.39: Single Responsibility Principle (SRP) - Bridge between AppState and CAD Section Viewer
 */

(function(exports) {
    'use strict';

    const STORAGE_KEY = 'FOUNDATION_CAD_PRO_STATE_V5';

    const FoundationSectionController = {
        beamList: [],
        currentBeamIndex: 0,
        avgGlConfig: {
            show: true,
            diff: -180
        },
        slabCommon: {
            shortBar: 'D13@150',
            longBar: 'D10@300'
        },
        view: {
            zoom: 0.82,
            panX: -10,
            panY: 30,
            isPanning: false,
            startX: 0,
            startY: 0
        },

        /**
         * 断面図CADモーダルを開く（AppStateから符号と仕様を同期）
         * @param {string} [targetSymbol] - 初期フォーカスする梁符号名
         */
        openModal: function(targetSymbol) {
            this.syncFromAppState();
            if (targetSymbol) {
                const targetStr = String(targetSymbol).trim();
                const idx = this.beamList.findIndex(b => (b.title || b.id) === targetStr);
                if (idx !== -1) {
                    this.currentBeamIndex = idx;
                }
            }
            const modal = document.getElementById('modal-foundation-section-cad');
            if (modal) {
                modal.style.display = 'flex';
                this.initPanZoom();
                this.renderTabs();
                this.loadCurrentBeamToInputs();
                this.draw();
                this.checkInconsistenciesAndAlert();
            }
        },

        /**
         * 断面図CADモーダルを閉じる
         */
        closeModal: function() {
            const modal = document.getElementById('modal-foundation-section-cad');
            if (modal) {
                modal.style.display = 'none';
            }
        },

        /**
         * AppState（伏図上の基礎梁・スラブ）から符号と仕様を自動抽出・同期
         */
        syncFromAppState: function() {
            const s = (typeof window !== 'undefined') ? window.AppState : null;
            if (!s) return;

            // 1. スラブ仕様からスラブ厚・天端下がり・配筋を同期
            let defaultSlabT = 150;
            let defaultGlToSlab = 50;
            let defaultSlabArrangement = 'double';

            if (s.foundationSlabs && s.foundationSlabs.length > 0) {
                const sl = s.foundationSlabs[0];
                const sp = sl.props || {};
                if (sp.slabThickness || sp.thickness) {
                    defaultSlabT = Number(sp.slabThickness || sp.thickness);
                }
                if (sp.slabTopHeight !== undefined) {
                    defaultGlToSlab = Number(sp.slabTopHeight);
                }
                if (sp.rebarShort) {
                    this.slabCommon.shortBar = typeof sp.rebarShort === 'string'
                        ? sp.rebarShort
                        : `${sp.rebarShort.type || 'D13'}@${sp.rebarShort.pitch || 150}`;
                }
                if (sp.rebarLong) {
                    this.slabCommon.longBar = typeof sp.rebarLong === 'string'
                        ? sp.rebarLong
                        : `${sp.rebarLong.type || 'D10'}@${sp.rebarLong.pitch || 300}`;
                }
                if (sp.arrangement) {
                    defaultSlabArrangement = sp.arrangement;
                } else if (sp.isDouble !== undefined) {
                    defaultSlabArrangement = sp.isDouble ? 'double' : 'single';
                }
            }

            // 2. 伏図から符号ごとに梁仕様・隣接スラブ仕様を集約
            const symbolMap = {};

            (s.foundationBeams || []).forEach(beam => {
                const bp = beam.props || {};
                const isExterior = this._isBeamExterior(beam, s);
                const beamSlabT = bp.slabThickness || bp.thickness || defaultSlabT;
                const beamGlToSlab = bp.slabTopHeight !== undefined ? bp.slabTopHeight : defaultGlToSlab;

                if (beam.spans && beam.spans.length > 0) {
                    beam.spans.forEach((span, sIdx) => {
                        const spProps = span.props || {};
                        const sym = (spProps.symbol || span.symbol || bp.symbol || `FG${sIdx + 1}`).trim();
                        if (!sym) return;

                        if (!symbolMap[sym]) {
                            symbolMap[sym] = {
                                symbol: sym,
                                spansCount: 0,
                                isExterior: isExterior,
                                width: spProps.width !== undefined ? spProps.width : (bp.width || 150),
                                height: spProps.height !== undefined ? spProps.height : (bp.height || 640),
                                embedDepth: spProps.embedDepth !== undefined ? spProps.embedDepth : (bp.embedDepth ?? 250),
                                slabT: spProps.slabThickness !== undefined ? spProps.slabThickness : beamSlabT,
                                glToSlab: spProps.slabTopHeight !== undefined ? spProps.slabTopHeight : beamGlToSlab,
                                slabArrangement: spProps.slabArrangement || bp.slabArrangement || defaultSlabArrangement,
                                topRebar: spProps.topRebar || bp.topRebar || '1-D13',
                                bottomRebar: spProps.bottomRebar || bp.bottomRebar || '1-D13',
                                stirrup: spProps.stirrup || bp.stirrup || '1-D10@200'
                            };
                        }
                        symbolMap[sym].spansCount++;
                    });
                } else if (beam.p1 && beam.p2) {
                    const sym = (bp.symbol || bp.beamName || 'FG1').trim();
                    if (!symbolMap[sym]) {
                        symbolMap[sym] = {
                            symbol: sym,
                            spansCount: 0,
                            isExterior: isExterior,
                            width: bp.width || 150,
                            height: bp.height || 640,
                            embedDepth: bp.embedDepth ?? 250,
                            slabT: beamSlabT,
                            glToSlab: beamGlToSlab,
                            slabArrangement: bp.slabArrangement || defaultSlabArrangement,
                            topRebar: bp.topRebar || '1-D13',
                            bottomRebar: bp.bottomRebar || '1-D13',
                            stirrup: bp.stirrup || '1-D10@200'
                        };
                    }
                    symbolMap[sym].spansCount++;
                }
            });

            // 3. 既存の beamList とマージ（伏図の最新スラブ・梁値を反映しつつ、手動追加符号も維持）
            const updatedList = [];
            const processedSymbols = new Set();

            // まず伏図で使用中の符号を追加/更新
            Object.keys(symbolMap).forEach(sym => {
                const info = symbolMap[sym];
                processedSymbols.add(sym);

                let existing = this.beamList.find(b => (b.title || b.id) === sym);
                if (!existing) {
                    existing = {
                        id: sym,
                        title: sym,
                        baseSpec: info.isExterior ? 'FG1' : 'FG2',
                        baseToeWidthType: 'matchStem',
                        stemArrangement: 'single',
                        slabArrangement: info.slabArrangement || defaultSlabArrangement,
                        stemW: info.width || 150,
                        slabT: info.slabT || defaultSlabT,
                        aboveGl: Math.max((info.height || 640) - (info.embedDepth || 250), 300),
                        embedH: info.embedDepth || 250,
                        glToSlab: info.glToSlab !== undefined ? info.glToSlab : defaultGlToSlab,
                        levelerT: 10,
                        topSpec: this._normalizeRebarSpec(info.topRebar),
                        botSpec: this._normalizeRebarSpec(info.bottomRebar),
                        stirrupBar: this._normalizeStirrupSpec(info.stirrup),
                        incTopStirrup: true,
                        incBotStirrup: true,
                        spansCount: info.spansCount
                    };
                } else {
                    existing.title = sym;
                    existing.spansCount = info.spansCount;
                    existing.stemW = info.width || existing.stemW;
                    existing.embedH = info.embedDepth !== undefined ? info.embedDepth : existing.embedH;
                    existing.slabT = info.slabT || existing.slabT || defaultSlabT;
                    existing.glToSlab = info.glToSlab !== undefined ? info.glToSlab : existing.glToSlab;
                    existing.slabArrangement = info.slabArrangement || existing.slabArrangement || defaultSlabArrangement;
                    existing.topSpec = this._normalizeRebarSpec(info.topRebar) || existing.topSpec;
                    existing.botSpec = this._normalizeRebarSpec(info.bottomRebar) || existing.botSpec;
                    existing.stirrupBar = this._normalizeStirrupSpec(info.stirrup) || existing.stirrupBar;
                }
                updatedList.push(existing);
            });

            // 伏図には未配置だがユーザーが手動追加した符号を保持
            this.beamList.forEach(b => {
                const sym = b.title || b.id;
                if (!processedSymbols.has(sym)) {
                    b.spansCount = 0; // 未配置マーク
                    b.slabT = b.slabT || defaultSlabT;
                    b.glToSlab = b.glToSlab !== undefined ? b.glToSlab : defaultGlToSlab;
                    updatedList.push(b);
                }
            });

            if (updatedList.length === 0) {
                // デフォルト初期値
                updatedList.push({
                    id: 'FG1', title: 'FG1', baseSpec: 'FG1', baseToeWidthType: 'matchStem',
                    stemArrangement: 'single', slabArrangement: defaultSlabArrangement,
                    stemW: 150, slabT: defaultSlabT, aboveGl: 400, embedH: 500, glToSlab: defaultGlToSlab, levelerT: 10,
                    topSpec: '1-D13', botSpec: '1-D13', stirrupBar: 'D10@200',
                    incTopStirrup: true, incBotStirrup: true, spansCount: 0
                });
            }

            this.beamList = updatedList;
            if (this.currentBeamIndex >= this.beamList.length) {
                this.currentBeamIndex = 0;
            }
        },

        /**
         * 梁が外周（片側のみスラブ/外壁接合）か判定
         */
        _isBeamExterior: function(beam, state) {
            if (!beam || !state) return true;
            // スラブの隣接判定（左右スラブがあるか）
            if (beam.tributaryEntries && beam.tributaryEntries.length === 1) {
                return true; // 片側のみ
            }
            return false;
        },

        _normalizeRebarSpec: function(str) {
            if (!str) return '1-D13';
            if (str.startsWith('1-D') || str.startsWith('2-D') || str.startsWith('3-D') || str.includes('2段')) {
                return str;
            }
            return str;
        },

        _normalizeStirrupSpec: function(str) {
            if (!str) return 'D10@200';
            const m = str.match(/D\d+@\d+/i);
            return m ? m[0].toUpperCase() : 'D10@200';
        },

        /**
         * 符号整合性チェックの実行と警告表示
         */
        checkInconsistenciesAndAlert: function() {
            if (typeof window === 'undefined' || !window.FoundationSymbolValidator) return;
            const warnings = window.FoundationSymbolValidator.validateSymbolsConsistency(window.AppState);
            const alertBox = document.getElementById('fd-section-warning-banner');
            if (!alertBox) return;

            if (warnings.length > 0) {
                let html = '<div style="background:#fef2f2; border:1px solid #f87171; border-radius:6px; padding:8px 12px; margin-bottom:10px; font-size:11px; color:#991b1b;">';
                html += '<div style="font-weight:bold; margin-bottom:4px; display:flex; items-center; gap:6px;">⚠️ 基礎梁 符号・主筋仕様の重複不整合が検出されました</div>';
                warnings.forEach(w => {
                    html += `<div style="margin-top:2px;"><b>【符号 ${w.symbol}】</b>: ${w.conflicts.map(c => `${c.locationA} と ${c.locationB} で相違 (${c.diffDetails.join(', ')})`).join('<br>')}</div>`;
                });
                html += '<div style="margin-top:4px; font-size:10px; color:#b91c1c;">※同一符号で主筋や断面が異なる場合は、符号名を「FG1A」「FG1B」のように分けるか、仕様を統一してください。</div>';
                html += '</div>';
                alertBox.innerHTML = html;
                alertBox.style.display = 'block';
            } else {
                alertBox.innerHTML = '';
                alertBox.style.display = 'none';
            }
        },

        renderTabs: function() {
            const container = document.getElementById('beamSectionTabsContainer');
            if (!container) return;
            container.innerHTML = '';

            this.beamList.forEach((beam, index) => {
                const btn = document.createElement('button');
                const isActive = index === this.currentBeamIndex;
                const isUsed = (beam.spansCount && beam.spansCount > 0);
                const statusBadge = isUsed 
                    ? `<span style="font-size:9px; background:#10b981; color:#fff; padding:1px 4px; border-radius:3px; margin-left:4px;">配置${beam.spansCount}</span>` 
                    : `<span style="font-size:9px; background:#64748b; color:#fff; padding:1px 4px; border-radius:3px; margin-left:4px;">未配置</span>`;

                btn.className = `px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                    isActive ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`;
                btn.innerHTML = `<span>${beam.title || beam.id}</span>${statusBadge}`;
                btn.onclick = () => this.selectBeam(index);
                container.appendChild(btn);
            });
        },

        selectBeam: function(index) {
            this.currentBeamIndex = index;
            this.renderTabs();
            this.loadCurrentBeamToInputs();
            this.draw();
        },

        loadCurrentBeamToInputs: function() {
            const b = this.beamList[this.currentBeamIndex];
            if (!b) return;

            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val;
            };

            const ensureOptionAndSet = (id, val) => {
                const el = document.getElementById(id);
                if (!el || !val) return;
                let found = false;
                for (let i = 0; i < el.options.length; i++) {
                    if (el.options[i].value === val) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    const opt = document.createElement('option');
                    opt.value = val;
                    opt.textContent = val;
                    el.appendChild(opt);
                }
                el.value = val;
            };

            const lblTitle = document.getElementById('lblCurrentSignTitle');
            if (lblTitle) {
                lblTitle.value = b.title || b.id || 'FG1';
            }

            setVal('beamBaseSpec', b.baseSpec || 'FG1');
            setVal('baseToeWidthType', b.baseToeWidthType || 'matchStem');
            setVal('stemArrangement', b.stemArrangement || 'single');
            setVal('stemW', b.stemW || 150);
            setVal('slabT', b.slabT || 150);
            setVal('aboveGl', b.aboveGl !== undefined ? b.aboveGl : 400);
            setVal('embedH', b.embedH !== undefined ? b.embedH : 500);
            setVal('glToSlab', b.glToSlab !== undefined ? b.glToSlab : 50);
            setVal('levelerT', b.levelerT !== undefined ? b.levelerT : 10);
            ensureOptionAndSet('stirrupBar', b.stirrupBar || 'D10@200');

            const txtSlabT = document.getElementById('txtSlabT');
            if (txtSlabT) txtSlabT.textContent = (b.slabT || 150) + ' mm';
            const txtAboveGl = document.getElementById('txtAboveGl');
            if (txtAboveGl) txtAboveGl.textContent = (b.aboveGl !== undefined ? b.aboveGl : 400) + ' mm';
            const txtEmbed = document.getElementById('txtEmbed');
            if (txtEmbed) txtEmbed.textContent = (b.embedH !== undefined ? b.embedH : 500) + ' mm';
            const txtGlToSlab = document.getElementById('txtGlToSlab');
            if (txtGlToSlab) txtGlToSlab.textContent = '+' + (b.glToSlab !== undefined ? b.glToSlab : 50) + ' mm';
            const txtLeveler = document.getElementById('txtLeveler');
            if (txtLeveler) txtLeveler.textContent = (b.levelerT !== undefined ? b.levelerT : 10) + ' mm';

            this.updateTopSpecOptions(b.stemArrangement === 'double', b.topSpec);
            const is250 = (b.baseSpec === 'FG1') && (b.baseToeWidthType === 'fixed250');
            this.updateBotSpecOptions(is250, b.stemArrangement === 'double', b.botSpec);

            ensureOptionAndSet('slabShortBar', this.slabCommon.shortBar);
            ensureOptionAndSet('slabLongBar', this.slabCommon.longBar);

            const chkAvg = document.getElementById('chkShowAvgGl');
            if (chkAvg) chkAvg.checked = this.avgGlConfig.show;
            setVal('avgGlDiff', this.avgGlConfig.diff);
            const txtAvgDiff = document.getElementById('txtAvgGlDiff');
            if (txtAvgDiff) txtAvgDiff.textContent = (this.avgGlConfig.diff >= 0 ? '+' : '') + this.avgGlConfig.diff + ' mm';
        },

        updateCurrentSignTitle: function(newTitle) {
            const b = this.beamList[this.currentBeamIndex];
            if (!b) return;
            const cleanTitle = (newTitle || '').trim();
            if (!cleanTitle) return;
            b.title = cleanTitle;
            b.id = cleanTitle;
            this.renderTabs();
            this.draw();
        },

        updateTopSpecOptions: function(isDoubleStem, currentVal) {
            const select = document.getElementById('topSpec');
            if (!select) return currentVal;
            select.innerHTML = '';
            let options = [];
            if (isDoubleStem) {
                options = [
                    { v: '2-D13', t: '2-D13 (W配筋各1本)' },
                    { v: '2-D16', t: '2-D16 (W配筋各1本)' },
                    { v: '2-D13+2段2-D13', t: '2段筋 2-D13 + 2段2-D13' },
                    { v: '2-D13+2段2-D16', t: '2段筋 2-D13 + 2段2-D16' },
                    { v: '2-D16+2段2-D16', t: '2段筋 2-D16 + 2段2-D16' }
                ];
            } else {
                options = [
                    { v: '1-D13', t: '1-D13 (1本)' },
                    { v: '2-D13', t: '2-D13 (縦2段)' },
                    { v: '1-D16', t: '1-D16 (1本)' },
                    { v: '2-D16', t: '2-D16 (縦2段)' },
                    { v: 'D13+D16', t: 'D13 + 2段D16' }
                ];
            }
            options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt.v;
                o.textContent = opt.t;
                select.appendChild(o);
            });
            let targetVal = currentVal;
            if (!options.some(o => o.v === targetVal)) {
                targetVal = isDoubleStem ? '2-D13' : '1-D13';
            }
            select.value = targetVal;
            return targetVal;
        },

        updateBotSpecOptions: function(is250mm, isDoubleStem, currentVal) {
            const select = document.getElementById('botSpec');
            if (!select) return currentVal;
            select.innerHTML = '';
            let options = [];
            if (isDoubleStem) {
                options = [
                    { v: '2-D13', t: '2-D13 (W配筋各1本)' },
                    { v: '2-D16', t: '2-D16 (W配筋各1本)' },
                    { v: '2-D13+2段2-D13', t: '2段筋 2-D13 + 2段2-D13' },
                    { v: '2-D13+2段2-D16', t: '2段筋 2-D13 + 2段2-D16' },
                    { v: '2-D16+2段2-D16', t: '2段筋 2-D16 + 2段2-D16' }
                ];
            } else if (is250mm) {
                options = [
                    { v: '1-D13', t: '1-D13 (並列1本)' },
                    { v: '2-D13', t: '2-D13 (並列2本)' },
                    { v: '3-D13', t: '3-D13 (並列3本)' },
                    { v: '1-D16', t: '1-D16 (並列1本)' },
                    { v: '2-D16', t: '2-D16 (並列2本)' },
                    { v: '3-D16', t: '3-D16 (並列3本)' }
                ];
            } else {
                options = [
                    { v: '1-D13', t: '1-D13 (1段・1本)' },
                    { v: '1-D16', t: '1-D16 (1段・1本)' },
                    { v: 'D13+2段D13', t: '2段筋 D13 + 2段D13 (上下各1本)' },
                    { v: 'D13+2段D16', t: '2段筋 D13 + 2段D16 (1段D13+2段D16)' },
                    { v: 'D16+2段D13', t: '2段筋 D16 + 2段D13 (1段D16+2段D13)' },
                    { v: 'D16+2段D16', t: '2段筋 D16 + 2段D16 (上下各1本)' }
                ];
            }
            options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt.v;
                o.textContent = opt.t;
                select.appendChild(o);
            });
            let targetVal = currentVal;
            if (!options.some(o => o.v === targetVal)) {
                targetVal = isDoubleStem ? '2-D13' : (is250mm ? '3-D13' : '1-D13');
            }
            select.value = targetVal;
            return targetVal;
        },

        addNewBeam: function() {
            const nextNum = this.beamList.length + 1;
            const newId = `FG${nextNum}`;
            const baseBeam = this.beamList[this.currentBeamIndex] || this.beamList[0];
            const newBeam = JSON.parse(JSON.stringify(baseBeam));
            newBeam.id = newId;
            newBeam.title = newId;
            newBeam.spansCount = 0;
            this.beamList.push(newBeam);
            this.selectBeam(this.beamList.length - 1);
        },

        cloneCurrentBeam: function() {
            const baseBeam = this.beamList[this.currentBeamIndex];
            const nextNum = this.beamList.length + 1;
            const newId = `FG${nextNum}`;
            const newBeam = JSON.parse(JSON.stringify(baseBeam));
            newBeam.id = newId;
            newBeam.title = newId;
            newBeam.spansCount = 0;
            this.beamList.push(newBeam);
            this.selectBeam(this.beamList.length - 1);
        },

        deleteCurrentBeam: function() {
            if (this.beamList.length <= 1) return;
            const b = this.beamList[this.currentBeamIndex];
            if (b.spansCount && b.spansCount > 0) {
                alert(`符号「${b.title}」は伏図上に配置されているため削除できません。伏図の符号を変更してから削除してください。`);
                return;
            }
            if (!confirm(`${b.title} を削除しますか？`)) return;
            this.beamList.splice(this.currentBeamIndex, 1);
            this.currentBeamIndex = Math.max(0, this.currentBeamIndex - 1);
            this.selectBeam(this.currentBeamIndex);
        },

        updateParam: function(key, val) {
            const b = this.beamList[this.currentBeamIndex];
            if (!b) return;
            b[key] = val;
            if (key === 'baseSpec' || key === 'baseToeWidthType' || key === 'stemArrangement') {
                const is250 = (b.baseSpec === 'FG1') && (b.baseToeWidthType === 'fixed250');
                b.botSpec = this.updateBotSpecOptions(is250, b.stemArrangement === 'double', b.botSpec);
                b.topSpec = this.updateTopSpecOptions(b.stemArrangement === 'double', b.topSpec);
            }
            this.draw();
        },

        draw: function() {
            const b = this.beamList[this.currentBeamIndex];
            const g = document.getElementById('cadViewportGroup');
            if (!b || !g || typeof window === 'undefined' || !window.FoundationSectionSvgRenderer) return;

            window.FoundationSectionSvgRenderer.renderSectionSvg(b, this.avgGlConfig, this.slabCommon, g);
            this.applyTransform();
        },

        applyTransform: function() {
            const g = document.getElementById('cadViewportGroup');
            if (g) {
                g.setAttribute('transform', `translate(${this.view.panX}, ${this.view.panY}) scale(${this.view.zoom})`);
            }
        },

        initPanZoom: function() {
            const el = document.getElementById('cadViewerMain');
            if (!el || el.dataset.panZoomInit) return;
            el.dataset.panZoomInit = 'true';

            el.addEventListener('mousedown', (e) => {
                this.view.isPanning = true;
                this.view.startX = e.clientX - this.view.panX;
                this.view.startY = e.clientY - this.view.panY;
            });
            window.addEventListener('mousemove', (e) => {
                if (!this.view.isPanning) return;
                this.view.panX = e.clientX - this.view.startX;
                this.view.panY = e.clientY - this.view.startY;
                this.applyTransform();
            });
            window.addEventListener('mouseup', () => { this.view.isPanning = false; });
            el.addEventListener('wheel', (e) => {
                e.preventDefault();
                const factor = e.deltaY < 0 ? 1.12 : 0.88;
                this.view.zoom = Math.min(Math.max(this.view.zoom * factor, 0.3), 3.0);
                this.applyTransform();
            }, { passive: false });
        },

        exportSVG: function() {
            const svg = document.getElementById('cadSvgViewer');
            const curBeam = this.beamList[this.currentBeamIndex] || this.beamList[0];
            if (!svg || !curBeam) return;

            const cloneSvg = svg.cloneNode(true);
            const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            bgRect.setAttribute("width", "100%");
            bgRect.setAttribute("height", "100%");
            bgRect.setAttribute("fill", "#080c14");
            cloneSvg.insertBefore(bgRect, cloneSvg.firstChild);

            const blob = new Blob([cloneSvg.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `Foundation_Beam_${curBeam.title}_Section.svg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        },

        exportDXF: function(isAll = true) {
            if (typeof window === 'undefined' || !window.FoundationSectionDxfExporter) return;
            const curBeam = this.beamList[this.currentBeamIndex];
            const targets = isAll ? this.beamList : [curBeam];
            const dxf = window.FoundationSectionDxfExporter.generateDXF(targets, this.avgGlConfig, this.slabCommon);
            const fname = isAll ? 'Foundation_Beam_Schedule_All_FG.dxf' : `Foundation_Beam_${curBeam.title}_Section.dxf`;
            window.FoundationSectionDxfExporter.downloadDXF(dxf, fname);
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = FoundationSectionController;
    }
    if (typeof window !== 'undefined') {
        window.FoundationSectionController = FoundationSectionController;
        if (window.ServiceContainer) {
            window.ServiceContainer.register('FoundationSectionController', FoundationSectionController);
        }
    }
})(typeof exports === 'undefined' ? this : exports);
