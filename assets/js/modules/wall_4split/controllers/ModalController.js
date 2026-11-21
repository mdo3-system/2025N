/**
 * controllers/ModalController.js - モーダルダイアログおよび入力ダイアログ統合管理
 * v3.15.9: window.prompt() 完全撤廃 - インラインHTMLモーダルダイアログ化
 */

window.ModalController = {

    openDxfLayerToggleModal: function() {
        if (typeof window.renderLayerPanel === 'function') {
            window.renderLayerPanel();
        }
        const modal = document.getElementById('modal-dxf-layer-toggle') || document.getElementById('modal-dxf-layer') || document.getElementById('modal-dxf-layer-visibility');
        if (modal) modal.style.display = 'flex';
    },

    // Aliases for compatibility
    openPropertyModal: function(hit) {
        if (window.PropertyController) window.PropertyController.openGeneralModal(hit);
    },
    updateModalFields: function(type) {
        if (window.PropertyController) window.PropertyController.updateWallFields(type, null);
    },
    applyPropertyChanges: function() {
        if (window.PropertyController) window.PropertyController.applyGeneralChanges();
    },

    /**
     * 共通モーダルオーバーレイ生成ヘルパー
     */
    _createModalContainer: function(titleText) {
        // 既存のモーダルがあれば削除
        const existing = document.getElementById('app-custom-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'app-custom-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(2px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            box-sizing: border-box;
            animation: appModalFadeIn 0.15s ease-out;
        `;

        const modal = document.createElement('div');
        modal.id = 'app-custom-modal-dialog';
        modal.style.cssText = `
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 480px;
            overflow: hidden;
            border: 1px solid #cbd5e1;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1e293b;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 20px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
        `;

        const title = document.createElement('h3');
        title.style.cssText = `
            margin: 0;
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        title.textContent = titleText;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = `
            background: transparent;
            border: none;
            font-size: 24px;
            line-height: 1;
            color: #64748b;
            cursor: pointer;
            padding: 0 4px;
            border-radius: 4px;
        `;
        closeBtn.onmouseenter = () => closeBtn.style.color = '#0f172a';
        closeBtn.onmouseleave = () => closeBtn.style.color = '#64748b';

        header.appendChild(title);
        header.appendChild(closeBtn);
        modal.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = `
            padding: 20px;
            max-height: calc(85vh - 120px);
            overflow-y: auto;
        `;
        modal.appendChild(body);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const close = () => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            document.removeEventListener('keydown', handleKey);
        };

        closeBtn.onclick = close;

        const handleKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
            }
        };
        document.addEventListener('keydown', handleKey);

        return { overlay, modal, body, close };
    },

    /**
     * 単一入力用のシンプルモーダル (window.prompt の完全代替)
     */
    showSimpleInputModal: function(options) {
        const {
            title = '入力',
            message = '',
            defaultValue = '',
            inputType = 'text',
            placeholder = '',
            confirmText = 'OK',
            cancelText = 'キャンセル',
            onConfirm = null,
            onCancel = null
        } = options;

        const { overlay, modal, body, close } = this._createModalContainer(title);

        if (message) {
            const msgEl = document.createElement('p');
            msgEl.style.cssText = `
                margin: 0 0 14px 0;
                font-size: 14px;
                line-height: 1.5;
                color: #334155;
                white-space: pre-wrap;
            `;
            msgEl.textContent = message;
            body.appendChild(msgEl);
        }

        const input = document.createElement('input');
        input.type = inputType;
        input.value = defaultValue;
        if (placeholder) input.placeholder = placeholder;
        input.style.cssText = `
            width: 100%;
            box-sizing: border-box;
            padding: 10px 12px;
            font-size: 15px;
            border: 1.5px solid #cbd5e1;
            border-radius: 6px;
            outline: none;
            transition: border-color 0.15s;
        `;
        input.onfocus = () => input.style.borderColor = '#2563eb';
        input.onblur = () => input.style.borderColor = '#cbd5e1';
        body.appendChild(input);

        // ボタン領域
        const footer = document.createElement('div');
        footer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 20px;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = cancelText;
        cancelBtn.style.cssText = `
            padding: 8px 16px;
            font-size: 14px;
            font-weight: 500;
            color: #475569;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            cursor: pointer;
        `;
        cancelBtn.onclick = () => {
            close();
            if (onCancel) onCancel();
        };

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.textContent = confirmText;
        confirmBtn.style.cssText = `
            padding: 8px 18px;
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            background: #2563eb;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        `;
        const handleConfirm = () => {
            const val = input.value;
            close();
            if (onConfirm) onConfirm(val);
        };
        confirmBtn.onclick = handleConfirm;

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);
        body.appendChild(footer);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            }
        });

        setTimeout(() => {
            input.focus();
            input.select();
        }, 50);
    },

    /**
     * 通り芯追加モーダル (add-grid)
     */
    showGridAddModal: function(options) {
        const { state, clickX, clickY, onConfirm, onCancel } = options;

        const { overlay, modal, body, close } = this._createModalContainer('📍 通り芯の追加 (オフセット配置)');

        // クリック位置から最寄りの通り芯を検出
        let bestGX = 0, minDX = Infinity;
        if (state.gridXCoords && state.gridXCoords.length > 0) {
            state.gridXCoords.forEach(gx => {
                const cx = window.toCanvasPixel ? window.toCanvasPixel(gx, 0).cx : (gx * state.scale + state.offsetX);
                const d = Math.abs(clickX - cx);
                if (d < minDX) { minDX = d; bestGX = gx; }
            });
        }
        if (minDX > 150 || minDX === Infinity) {
            const snap = (v) => Math.round(v / 910) * 910;
            bestGX = snap(window.toWorldCoord ? window.toWorldCoord(clickX, clickY).x : (clickX - state.offsetX) / state.scale);
        }

        let bestGY = 0, minDY = Infinity;
        const _dprGY = window.devicePixelRatio || 1;
        const _cssHGY = (state.canvas ? state.canvas.height : 600) / _dprGY;
        if (state.gridYCoords && state.gridYCoords.length > 0) {
            state.gridYCoords.forEach(gy => {
                const cy = window.toCanvasPixel ? window.toCanvasPixel(0, gy).cy : (_cssHGY - (gy * state.scale + state.offsetY));
                const d = Math.abs(clickY - cy);
                if (d < minDY) { minDY = d; bestGY = gy; }
            });
        }
        if (minDY > 150 || minDY === Infinity) {
            const snap = (v) => Math.round(v / 910) * 910;
            bestGY = snap(window.toWorldCoord ? window.toWorldCoord(clickX, clickY).y : (_cssHGY - clickY - state.offsetY) / state.scale);
        }

        // 初期選択軸: クリック位置がより近かった方の軸を選択
        let currentAxis = (minDY < minDX) ? 'Y' : 'X';

        // フォームHTML作成
        body.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:16px;">
                <!-- 方向選択 -->
                <div>
                    <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:6px;">追加する方向 (軸)</label>
                    <div style="display:flex; gap:12px;">
                        <label style="flex:1; display:flex; align-items:center; gap:8px; padding:10px 14px; border:1.5px solid #cbd5e1; border-radius:8px; cursor:pointer; background:#f8fafc; font-size:14px; font-weight:600;" id="label-axis-x">
                            <input type="radio" name="grid-modal-axis" value="X" ${currentAxis === 'X' ? 'checked' : ''} style="cursor:pointer;">
                            <span>X方向 (縦線 / 間口)</span>
                        </label>
                        <label style="flex:1; display:flex; align-items:center; gap:8px; padding:10px 14px; border:1.5px solid #cbd5e1; border-radius:8px; cursor:pointer; background:#f8fafc; font-size:14px; font-weight:600;" id="label-axis-y">
                            <input type="radio" name="grid-modal-axis" value="Y" ${currentAxis === 'Y' ? 'checked' : ''} style="cursor:pointer;">
                            <span>Y方向 (横線 / 奥行)</span>
                        </label>
                    </div>
                </div>

                <!-- 基準位置 -->
                <div>
                    <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:6px;">基準となる通り芯 (座標)</label>
                    <select id="grid-modal-base-select" style="width:100%; padding:9px 12px; font-size:14px; border:1.5px solid #cbd5e1; border-radius:6px; background:#ffffff; outline:none;">
                    </select>
                </div>

                <!-- オフセット距離 -->
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
                        <label style="font-size:13px; font-weight:600; color:#475569;">オフセット距離 (mm)</label>
                        <span id="grid-modal-offset-hint" style="font-size:12px; color:#64748b;">右方向: プラス(+) / 左方向: マイナス(-)</span>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <input type="number" id="grid-modal-offset" value="910" step="1" style="flex:1; padding:9px 12px; font-size:15px; font-weight:600; border:1.5px solid #cbd5e1; border-radius:6px; outline:none;">
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
                        <button type="button" class="btn-offset-chip" data-val="910" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; background:#f1f5f9; cursor:pointer;">+910</button>
                        <button type="button" class="btn-offset-chip" data-val="-910" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; background:#f1f5f9; cursor:pointer;">-910</button>
                        <button type="button" class="btn-offset-chip" data-val="455" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; background:#f1f5f9; cursor:pointer;">+455</button>
                        <button type="button" class="btn-offset-chip" data-val="-455" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; background:#f1f5f9; cursor:pointer;">-455</button>
                        <button type="button" class="btn-offset-chip" data-val="1820" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; background:#f1f5f9; cursor:pointer;">+1820</button>
                        <button type="button" class="btn-offset-chip" data-val="-1820" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; background:#f1f5f9; cursor:pointer;">-1820</button>
                    </div>
                </div>

                <!-- 通り芯名称 -->
                <div>
                    <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:6px;">追加する通り芯の名称</label>
                    <input type="text" id="grid-modal-name" value="" style="width:100%; box-sizing:border-box; padding:9px 12px; font-size:14px; border:1.5px solid #cbd5e1; border-radius:6px; outline:none;">
                </div>

                <!-- 計算結果プレビュー -->
                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px 16px; font-size:13px; color:#166534; display:flex; align-items:center; justify-content:space-between;">
                    <span>配置予定の座標:</span>
                    <strong id="grid-modal-calc-preview" style="font-size:16px; font-weight:700;">--- mm</strong>
                </div>

                <!-- ボタン -->
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
                    <button type="button" id="grid-modal-cancel" style="padding:9px 18px; font-size:14px; font-weight:500; color:#475569; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; cursor:pointer;">キャンセル</button>
                    <button type="button" id="grid-modal-submit" style="padding:9px 22px; font-size:14px; font-weight:600; color:#ffffff; background:#2563eb; border:none; border-radius:6px; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.1);">通り芯を追加</button>
                </div>
            </div>
        `;

        const radX = body.querySelector('input[value="X"]');
        const radY = body.querySelector('input[value="Y"]');
        const lblX = body.querySelector('#label-axis-x');
        const lblY = body.querySelector('#label-axis-y');
        const baseSelect = body.querySelector('#grid-modal-base-select');
        const offsetInput = body.querySelector('#grid-modal-offset');
        const hintEl = body.querySelector('#grid-modal-offset-hint');
        const nameInput = body.querySelector('#grid-modal-name');
        const previewEl = body.querySelector('#grid-modal-calc-preview');
        const btnSubmit = body.querySelector('#grid-modal-submit');
        const btnCancel = body.querySelector('#grid-modal-cancel');

        // 通り芯候補リストをプルダウンに格納
        const populateBases = (axis) => {
            baseSelect.innerHTML = '';
            const coords = (axis === 'X' ? state.gridXCoords : state.gridYCoords) || [];
            const names = (axis === 'X' ? state.gridXNames : state.gridYNames) || [];
            const bestVal = axis === 'X' ? bestGX : bestGY;

            if (coords.length > 0) {
                coords.forEach((coord, i) => {
                    const opt = document.createElement('option');
                    opt.value = coord;
                    const nm = names[i] || `${axis}${i + 1}`;
                    opt.textContent = `${nm} (${Math.round(coord)} mm)`;
                    if (Math.abs(coord - bestVal) < 1) {
                        opt.selected = true;
                    }
                    baseSelect.appendChild(opt);
                });
            } else {
                const opt = document.createElement('option');
                opt.value = bestVal;
                opt.textContent = `基準位置 (${Math.round(bestVal)} mm)`;
                opt.selected = true;
                baseSelect.appendChild(opt);
            }

            // 初期名称設定
            const count = (axis === 'X' ? (state.manualGridX || []).length : (state.manualGridY || []).length) + 1;
            nameInput.value = `${axis}_${count}`;
        };

        const updatePreview = () => {
            const base = parseFloat(baseSelect.value) || 0;
            const offset = parseFloat(offsetInput.value) || 0;
            const target = base + offset;
            previewEl.textContent = `${Math.round(base)} + (${Math.round(offset)}) = ${Math.round(target)} mm`;
        };

        const onAxisChange = (axis) => {
            currentAxis = axis;
            if (axis === 'X') {
                lblX.style.borderColor = '#2563eb';
                lblX.style.background = '#eff6ff';
                lblY.style.borderColor = '#cbd5e1';
                lblY.style.background = '#f8fafc';
                hintEl.textContent = '右方向: プラス(+) / 左方向: マイナス(-)';
            } else {
                lblY.style.borderColor = '#2563eb';
                lblY.style.background = '#eff6ff';
                lblX.style.borderColor = '#cbd5e1';
                lblX.style.background = '#f8fafc';
                hintEl.textContent = '上方向: プラス(+) / 下方向: マイナス(-)';
            }
            populateBases(axis);
            updatePreview();
        };

        radX.onchange = () => onAxisChange('X');
        radY.onchange = () => onAxisChange('Y');
        baseSelect.onchange = updatePreview;
        offsetInput.oninput = updatePreview;

        body.querySelectorAll('.btn-offset-chip').forEach(btn => {
            btn.onclick = () => {
                offsetInput.value = btn.getAttribute('data-val');
                updatePreview();
                offsetInput.focus();
            };
        });

        const handleSubmit = () => {
            const axis = currentAxis;
            const base = parseFloat(baseSelect.value) || 0;
            const offset = parseFloat(offsetInput.value);
            if (isNaN(offset)) {
                alert('オフセット距離を正しい数値で入力してください。');
                offsetInput.focus();
                return;
            }
            const name = nameInput.value.trim() || `${axis}_新通り`;
            close();
            if (onConfirm) onConfirm(axis, base, offset, name);
        };

        btnSubmit.onclick = handleSubmit;
        btnCancel.onclick = () => {
            close();
            if (onCancel) onCancel();
        };

        offsetInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            }
        });
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            }
        });

        // 初期表示設定
        onAxisChange(currentAxis);

        setTimeout(() => {
            offsetInput.focus();
            offsetInput.select();
        }, 50);
    },

    /**
     * 屋根通り芯追加モーダル (roof-add-grid)
     */
    showRoofGridAddModal: function(options) {
        const { state, clickX, clickY, onConfirm, onCancel } = options;

        const { overlay, modal, body, close } = this._createModalContainer('🏠 屋根通り芯の追加 (オフセット配置)');

        const roofGrids = (window.RoofEngine && typeof window.RoofEngine.getRoofGrids === 'function')
            ? window.RoofEngine.getRoofGrids(state) : { x: [], y: [] };

        let bestGX = 0, minDX = Infinity;
        if (roofGrids.x.length > 0) {
            roofGrids.x.forEach(gx => {
                const d = Math.abs(clickX - (gx * state.scale + state.offsetX));
                if (d < minDX) { minDX = d; bestGX = gx; }
            });
        }
        if (minDX > 150 || minDX === Infinity) {
            const snap = (v) => Math.round(v / 910) * 910;
            bestGX = snap(window.toWorldCoord ? window.toWorldCoord(clickX, clickY).x : (clickX - state.offsetX) / state.scale);
        }

        let bestGY = 0, minDY = Infinity;
        const _dprRG = window.devicePixelRatio || 1;
        const _cssHRG = (state.canvas ? state.canvas.height : 600) / _dprRG;
        if (roofGrids.y.length > 0) {
            roofGrids.y.forEach(gy => {
                const d = Math.abs(clickY - (_cssHRG - (gy * state.scale + state.offsetY)));
                if (d < minDY) { minDY = d; bestGY = gy; }
            });
        }
        if (minDY > 150 || minDY === Infinity) {
            const snap = (v) => Math.round(v / 910) * 910;
            bestGY = snap((_cssHRG - clickY - state.offsetY) / state.scale);
        }

        let currentAxis = (minDY < minDX) ? 'Y' : 'X';

        body.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:16px;">
                <!-- 方向選択 -->
                <div>
                    <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:6px;">屋根通り芯の方向 (軸)</label>
                    <div style="display:flex; gap:12px;">
                        <label style="flex:1; display:flex; align-items:center; gap:8px; padding:10px 14px; border:1.5px solid #cbd5e1; border-radius:8px; cursor:pointer; background:#f8fafc; font-size:14px; font-weight:600;" id="label-roof-axis-x">
                            <input type="radio" name="roof-modal-axis" value="X" ${currentAxis === 'X' ? 'checked' : ''} style="cursor:pointer;">
                            <span>X方向 (縦線)</span>
                        </label>
                        <label style="flex:1; display:flex; align-items:center; gap:8px; padding:10px 14px; border:1.5px solid #cbd5e1; border-radius:8px; cursor:pointer; background:#f8fafc; font-size:14px; font-weight:600;" id="label-roof-axis-y">
                            <input type="radio" name="roof-modal-axis" value="Y" ${currentAxis === 'Y' ? 'checked' : ''} style="cursor:pointer;">
                            <span>Y方向 (横線)</span>
                        </label>
                    </div>
                </div>

                <!-- 基準位置 -->
                <div>
                    <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:6px;">屋根基準位置 (座標)</label>
                    <input type="number" id="roof-modal-base-coord" value="${currentAxis === 'X' ? bestGX : bestGY}" style="width:100%; box-sizing:border-box; padding:9px 12px; font-size:14px; border:1.5px solid #cbd5e1; border-radius:6px; outline:none;">
                </div>

                <!-- タイプ選択 -->
                <div>
                    <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:6px;">グリッドタイプ</label>
                    <select id="roof-modal-type-select" style="width:100%; padding:9px 12px; font-size:14px; border:1.5px solid #cbd5e1; border-radius:6px; background:#ffffff; outline:none;">
                        <option value="eaves">軒の出 (eaves)</option>
                        <option value="keraba">ケラバの出 (keraba)</option>
                        <option value="other">その他 (other)</option>
                    </select>
                </div>

                <!-- オフセット距離 -->
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
                        <label style="font-size:13px; font-weight:600; color:#475569;">オフセット距離 (mm)</label>
                        <span id="roof-modal-offset-hint" style="font-size:12px; color:#64748b;">右方向: プラス(+) / 左方向: マイナス(-)</span>
                    </div>
                    <input type="number" id="roof-modal-offset" value="910" step="1" style="width:100%; box-sizing:border-box; padding:9px 12px; font-size:15px; font-weight:600; border:1.5px solid #cbd5e1; border-radius:6px; outline:none;">
                </div>

                <!-- 通り芯名称 -->
                <div>
                    <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:6px;">屋根通り芯の名称</label>
                    <input type="text" id="roof-modal-name" value="" style="width:100%; box-sizing:border-box; padding:9px 12px; font-size:14px; border:1.5px solid #cbd5e1; border-radius:6px; outline:none;">
                </div>

                <!-- ボタン -->
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
                    <button type="button" id="roof-modal-cancel" style="padding:9px 18px; font-size:14px; font-weight:500; color:#475569; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; cursor:pointer;">キャンセル</button>
                    <button type="button" id="roof-modal-submit" style="padding:9px 22px; font-size:14px; font-weight:600; color:#ffffff; background:#2563eb; border:none; border-radius:6px; cursor:pointer;">屋根通り芯を追加</button>
                </div>
            </div>
        `;

        const radX = body.querySelector('input[value="X"]');
        const radY = body.querySelector('input[value="Y"]');
        const lblX = body.querySelector('#label-roof-axis-x');
        const lblY = body.querySelector('#label-roof-axis-y');
        const baseCoordInput = body.querySelector('#roof-modal-base-coord');
        const typeSelect = body.querySelector('#roof-modal-type-select');
        const offsetInput = body.querySelector('#roof-modal-offset');
        const hintEl = body.querySelector('#roof-modal-offset-hint');
        const nameInput = body.querySelector('#roof-modal-name');
        const btnSubmit = body.querySelector('#roof-modal-submit');
        const btnCancel = body.querySelector('#roof-modal-cancel');

        const updateRoofName = () => {
            const count = (currentAxis === 'X' ? (state.roofGridManualX || []).length : (state.roofGridManualY || []).length) + 1;
            const type = typeSelect.value;
            const typeLabel = type === 'eaves' ? '軒の出' : (type === 'keraba' ? 'ケラバの出' : 'その他');
            nameInput.value = `${count} ${typeLabel}`;
        };

        const onAxisChange = (axis) => {
            currentAxis = axis;
            if (axis === 'X') {
                lblX.style.borderColor = '#2563eb';
                lblX.style.background = '#eff6ff';
                lblY.style.borderColor = '#cbd5e1';
                lblY.style.background = '#f8fafc';
                hintEl.textContent = '右方向: プラス(+) / 左方向: マイナス(-)';
                baseCoordInput.value = bestGX;
            } else {
                lblY.style.borderColor = '#2563eb';
                lblY.style.background = '#eff6ff';
                lblX.style.borderColor = '#cbd5e1';
                lblX.style.background = '#f8fafc';
                hintEl.textContent = '上方向: プラス(+) / 下方向: マイナス(-)';
                baseCoordInput.value = bestGY;
            }
            updateRoofName();
        };

        radX.onchange = () => onAxisChange('X');
        radY.onchange = () => onAxisChange('Y');
        typeSelect.onchange = updateRoofName;

        const handleSubmit = () => {
            const axis = currentAxis;
            const base = parseFloat(baseCoordInput.value) || 0;
            const offset = parseFloat(offsetInput.value);
            if (isNaN(offset)) {
                alert('オフセット距離を正しい数値で入力してください。');
                offsetInput.focus();
                return;
            }
            const type = typeSelect.value;
            const name = nameInput.value.trim() || '屋根通り芯';
            close();
            if (onConfirm) onConfirm(axis, base, offset, type, name);
        };

        btnSubmit.onclick = handleSubmit;
        btnCancel.onclick = () => {
            close();
            if (onCancel) onCancel();
        };

        onAxisChange(currentAxis);

        setTimeout(() => {
            offsetInput.focus();
            offsetInput.select();
        }, 50);
    },

    /**
     * 屋根面プロパティ入力モーダル (RoofInputController フォールバック用)
     */
    showRoofFaceModal: function(options) {
        const { state, existingFace = null, onConfirm, onCancel } = options;

        const { overlay, modal, body, close } = this._createModalContainer('🏠 屋根面プロパティの設定');

        const defaultLabel = existingFace ? existingFace.label : `R${(state.roofFaces || []).length + 1}`;
        const defaultSlope = existingFace ? String(existingFace.slope) : "4.5";
        const defaultThickness = existingFace ? String(existingFace.roofThickness) : "150";
        const defaultDelta = existingFace ? String(existingFace.baseHeightDelta) : "0";

        const currentFl = state.currentFloor || '1F';
        const is1FGroup = (f) => ['1F', '1R', '1RF', '1F_R'].includes(String(f).toUpperCase().trim());
        const defaultFloor = existingFace ? existingFace.floor : (is1FGroup(currentFl) ? '1F' : '2F');

        body.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:14px;">
                <div>
                    <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:5px;">屋根面の名称</label>
                    <input type="text" id="rf-modal-label" value="${defaultLabel}" style="width:100%; box-sizing:border-box; padding:8px 12px; font-size:14px; border:1.5px solid #cbd5e1; border-radius:6px; outline:none;">
                </div>
                <div>
                    <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:5px;">屋根勾配 (寸) (例: 4.5)</label>
                    <input type="number" step="0.1" id="rf-modal-slope" value="${defaultSlope}" style="width:100%; box-sizing:border-box; padding:8px 12px; font-size:14px; border:1.5px solid #cbd5e1; border-radius:6px; outline:none;">
                </div>
                <div>
                    <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:5px;">屋根厚み (mm)</label>
                    <input type="number" id="rf-modal-thickness" value="${defaultThickness}" style="width:100%; box-sizing:border-box; padding:8px 12px; font-size:14px; border:1.5px solid #cbd5e1; border-radius:6px; outline:none;">
                </div>
                <div>
                    <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:5px;">基準高からの増減 (mm)</label>
                    <input type="number" id="rf-modal-delta" value="${defaultDelta}" style="width:100%; box-sizing:border-box; padding:8px 12px; font-size:14px; border:1.5px solid #cbd5e1; border-radius:6px; outline:none;">
                </div>
                <div>
                    <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:5px;">対象階</label>
                    <select id="rf-modal-floor" style="width:100%; padding:8px 12px; font-size:14px; border:1.5px solid #cbd5e1; border-radius:6px; background:#fff; outline:none;">
                        <option value="1F" ${defaultFloor === '1F' ? 'selected' : ''}>1階 (下屋)</option>
                        <option value="2F" ${defaultFloor === '2F' ? 'selected' : ''}>2階 (主屋根)</option>
                    </select>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
                    <button type="button" id="rf-modal-cancel" style="padding:8px 16px; font-size:14px; color:#475569; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; cursor:pointer;">キャンセル</button>
                    <button type="button" id="rf-modal-submit" style="padding:8px 20px; font-size:14px; font-weight:600; color:#fff; background:#2563eb; border:none; border-radius:6px; cursor:pointer;">確定</button>
                </div>
            </div>
        `;

        const btnSubmit = body.querySelector('#rf-modal-submit');
        const btnCancel = body.querySelector('#rf-modal-cancel');

        const handleSubmit = () => {
            const label = body.querySelector('#rf-modal-label').value.trim() || defaultLabel;
            const slope = parseFloat(body.querySelector('#rf-modal-slope').value) || parseFloat(defaultSlope);
            const thickness = parseFloat(body.querySelector('#rf-modal-thickness').value) || parseFloat(defaultThickness);
            const delta = parseFloat(body.querySelector('#rf-modal-delta').value) || parseFloat(defaultDelta);
            const floor = body.querySelector('#rf-modal-floor').value;
            close();
            if (onConfirm) onConfirm({ label, slope, thickness, delta, floor });
        };

        btnSubmit.onclick = handleSubmit;
        btnCancel.onclick = () => {
            close();
            if (onCancel) onCancel();
        };
    }
};
