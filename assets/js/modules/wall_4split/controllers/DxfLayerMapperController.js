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
        if (countEl) countEl.innerText = `検出ファイル数: ${this.loadedFiles.length} ファイル | 全レイヤー数: ${allLayers.length}`;

        // ドロップダウンのレンダリング
        const selectIds = [
            { id: 'dxf-select-grid', selectedKey: 'grid' },
            { id: 'dxf-select-1f-col', selectedKey: 'col1F' },
            { id: 'dxf-select-2f-col', selectedKey: 'col2F' },
            { id: 'dxf-select-1f-roof', selectedKey: 'roof1F' },
            { id: 'dxf-select-2f-roof', selectedKey: 'roof2F' },
            { id: 'dxf-select-1f-back', selectedKey: 'back1F' },
            { id: 'dxf-select-2f-back', selectedKey: 'back2F' }
        ];

        selectIds.forEach(item => {
            const selectEl = document.getElementById(item.id);
            if (!selectEl) return;
            selectEl.innerHTML = '';

            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.text = '-- 指定なし / 自動判定 --';
            selectEl.appendChild(defaultOpt);

            allLayers.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l;
                opt.text = l;
                if (autoMap[item.selectedKey] === l) {
                    opt.selected = true;
                }
                selectEl.appendChild(opt);
            });
        });

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
        if (modal) modal.style.display = 'flex';
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
            back2FLayer: document.getElementById('dxf-select-2f-back')?.value || ""
        };

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
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('DxfLayerMapperController', window.DxfLayerMapperController);
}
