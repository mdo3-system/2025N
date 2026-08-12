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
    openMapper: function(rawTxt, callback) {
        this.closeProgress();
        this.currentDxfRaw = rawTxt;
        this.onConfirmCallback = callback;

        const dxf = window.CadEngine ? window.CadEngine.processDxf(rawTxt) : null;
        if (!dxf || !dxf.entities) {
            alert("❌ DXFの読み込みに失敗しました。ファイルフォーマットをご確認ください。");
            return;
        }

        // ユニークレイヤー名の抽出
        const layerSet = new Set();
        dxf.entities.forEach(ent => {
            if (ent.layer) layerSet.add(ent.layer.toUpperCase().trim());
        });
        const layers = Array.from(layerSet).sort();

        // スマート自動推定 (Smart Auto-Select)
        const autoMap = {
            grid: layers.find(l => /(GRID|GLID|通り芯|軸線)/i.test(l) && !/(COL|COLUMN|柱|BACK|Rｸﾞﾙｰﾌﾟ|グループ|背景)/i.test(l)) || "",
            col1F: layers.find(l => /(1F_COL|1F.*COL|1F.*柱)/i.test(l) && !/(BACK|背景)/i.test(l)) || layers.find(l => /(COL|COLUMN|柱)/i.test(l) && !/(2F|BACK|背景)/i.test(l)) || "",
            col2F: layers.find(l => /(2F_COL|2F.*COL|2F.*柱)/i.test(l) && !/(BACK|背景)/i.test(l)) || "",
            roof1F: layers.find(l => /(1F_R|1F.*屋根|軒|下屋)/i.test(l) && !/(BACK|背景)/i.test(l)) || "",
            roof2F: layers.find(l => /(2F_R|2F.*屋根|RF|大屋根)/i.test(l) && !/(BACK|背景)/i.test(l)) || "",
            back1F: layers.find(l => /(1F_BACK|1_BACK|1F.*背景|1F.*下図)/i.test(l)) || layers.find(l => /(BACK|背景|下図)/i.test(l) && !/2F/i.test(l)) || "",
            back2F: layers.find(l => /(2F_BACK|2_BACK|2F.*背景|2F.*下図)/i.test(l)) || ""
        };

        // レイヤーカウント表記
        const countEl = document.getElementById('dxf-mapper-layer-count');
        if (countEl) countEl.innerText = `検出レイヤー数: ${layers.length}`;

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

            layers.forEach(l => {
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

                    this.showProgress(100, "🎨 画面描画と計算結果を更新完了！");
                    setTimeout(() => {
                        this.closeProgress();
                    }, 400);
                }, 100);
            }, 100);
        }, 100);
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('DxfLayerMapperController', window.DxfLayerMapperController);
}
