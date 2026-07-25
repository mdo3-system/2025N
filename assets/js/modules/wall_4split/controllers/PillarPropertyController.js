/**
 * controllers/PillarPropertyController.js - 柱専用プロパティコントローラー
 * v3.4.0 Refactoring: Single Responsibility Principle (SRP)
 */

window.PillarPropertyController = {
    /**
     * 柱要素のプロパティ表示・フォームバインド (右パネル #pillar-props を表示・更新)
     * @param {Object} pillar - 柱オブジェクト
     */
    showPillarProps: function(pillar) {
        if (!pillar) return;
        window.AppState.selectedPillar = pillar;

        const pp = document.getElementById('pillar-props');
        if (pp) {
            pp.style.display = 'block';

            // 柱位置・名称表示
            const propId = document.getElementById('prop-id');
            if (propId) {
                const gridName = window.getGridNameAt ? window.getGridNameAt(pillar.x, pillar.y) : null;
                propId.innerText = `[${pillar.floor}] ${gridName || pillar.name || `P_${pillar.id}`}`;
            }

            // 金物手動指定ドロップダウン (#prop-mark)
            const pMark = document.getElementById('prop-mark');
            if (pMark) {
                const hwList = window.AppState.masterHardwareList || [
                    { name: '不要', value: '不要' },
                    { name: 'イ', value: 'イ' }, { name: 'ロ', value: 'ロ' },
                    { name: 'ハ', value: 'ハ' }, { name: 'ニ', value: 'ニ' },
                    { name: 'ホ', value: 'ホ' }, { name: 'ヘ', value: 'ヘ' },
                    { name: 'ト', value: 'ト' }, { name: 'チ', value: 'チ' },
                    { name: 'リ', value: 'リ' }, { name: 'ヌ', value: 'ヌ' },
                    { name: 'ル', value: 'ル' }, { name: 'ヲ', value: 'ヲ' }
                ];
                let optsHtml = '<option value="">(自動計算)</option>';
                hwList.forEach(hw => {
                    const val = hw.value || hw.name;
                    const sel = (pillar.manualMark === val) ? 'selected' : '';
                    optsHtml += `<option value="${val}" ${sel}>${hw.name}</option>`;
                });
                pMark.innerHTML = optsHtml;

                pMark.onchange = function() {
                    pillar.manualMark = this.value === '' ? null : this.value;
                    if (window.AppController && typeof window.AppController.refreshAll === 'function') {
                        window.AppController.refreshAll();
                    }
                    window.PillarPropertyController.showPillarProps(pillar);
                };
            }

            // 出隅フラグ (#prop-corner)
            const pCorner = document.getElementById('prop-corner');
            if (pCorner) {
                pCorner.checked = pillar.isManualCorner !== null ? pillar.isManualCorner : (pillar.isCornerAuto || false);
                pCorner.onchange = function() {
                    pillar.isManualCorner = this.checked;
                    if (window.AppController && typeof window.AppController.refreshAll === 'function') {
                        window.AppController.refreshAll();
                    }
                    window.PillarPropertyController.showPillarProps(pillar);
                };
            }

            // L値計算モード (#prop-lcalc)
            const pLcalc = document.getElementById('prop-lcalc');
            if (pLcalc) {
                pLcalc.value = pillar.lCalcMode || 'auto';
                pLcalc.onchange = function() {
                    pillar.lCalcMode = this.value;
                    if (window.AppController && typeof window.AppController.refreshAll === 'function') {
                        window.AppController.refreshAll();
                    }
                    window.PillarPropertyController.showPillarProps(pillar);
                };
            }

            // 簡易概要テキストのセット
            const propDetail = document.getElementById('prop-detail');
            if (propDetail) {
                const nValStr = pillar.nValue != null ? pillar.nValue.toFixed(2) : '-';
                const nMarkStr = pillar.nMark || '-';
                propDetail.innerText = `N値: ${nValStr} / 判定金物: ${nMarkStr}\n(クリックで計算根拠ダイアログを表示可能)`;
                propDetail.style.cursor = 'pointer';
                propDetail.onclick = function() {
                    window.PillarPropertyController.showPillarDetail(pillar.id);
                };
            }
        }
    },

    /**
     * 柱の非表示
     */
    hidePillarProps: function() {
        const pp = document.getElementById('pillar-props');
        if (pp) pp.style.display = 'none';
        if (window.AppState) window.AppState.selectedPillar = null;
    },

    /**
     * 柱N値計算根拠詳細モーダルを表示
     * @param {string|number} id - 柱ID
     */
    showPillarDetail: function(id) {
        const s = window.AppState;
        if (!s || !s.pillars) return;
        const p = s.pillars.find(p => p.id == id);
        if (!p) return;
        const pdText = document.getElementById('pillar-detail-text');
        const modal = document.getElementById('modal-pillar-detail');
        if (!pdText || !modal) return;

        let Nx = p.Ax != null ? p.Ax.toFixed(2) : '—';
        let Ny = p.Ay != null ? p.Ay.toFixed(2) : '—';
        let N = p.nValue != null ? p.nValue.toFixed(2) : '—';
        let isC = p.isManualCorner !== null ? p.isManualCorner : p.isCornerAuto;
        let L_str = p.lCalcMode === 'detail' ? `詳細(負担面積 ${p.usedArea?.toFixed(2)}㎡×荷重)` : `告示(${isC ? '角' : '一般'})`;
        
        let detail = '';
        if (p.nValue === undefined) {
            detail = '接続壁なし（計算未実行）';
        } else {
            const areaWarn = (p.lCalcMode === 'detail' && !(p.usedArea > 0)) ? '\n⚠️ 負担面積=0: 隣接柱が未検出です。手動で面積を入力してください。' : '';
            detail = [
                '【N値計算 - Ｎ値計算法（斜め壁はグレー本準拠）】',
                `柱: ${window.getPillarName ? window.getPillarName(p) : p.name || p.id}  (${p.floor})`,
                `押さえ効果L: ${L_str} = ${p.L_val?.toFixed(2)}`,
                '',
                '─ X方向地震（Y方向壁 左右差）─',
                `  計算式: ${p.cStrX || '-'}`,
                `  Nx = ${Nx}`,
                '',
                '─ Y方向地震（X方向壁 上下差）─',
                `  計算式: ${p.cStrY || '-'}`,
                `  Ny = ${Ny}`,
                '',
                `採用N値 = max(Nx, Ny, 0) = ${N}`,
                `判定金物: ${p.nMark || '-'}`,
                p.manualMark ? `※手動指定: ${p.manualMark}` : '',
                areaWarn
            ].filter(s => s !== null).join('\n');
        }
        pdText.innerText = detail;
        modal.style.display = 'flex';
    },

    /**
     * モーダル用 柱変更の適用
     * @param {Object} item - 柱オブジェクト
     */
    applyChanges: function(item) {
        if (!item) return;
        const cornerEl = document.getElementById("edit-pillar-corner");
        if (cornerEl) item.isManualCorner = cornerEl.checked;

        const markEl = document.getElementById("edit-pillar-mark");
        if (markEl) item.manualMark = markEl.value || null;

        const nameEl = document.getElementById("edit-pillar-name");
        if (nameEl) item.name = nameEl.value || null;

        const hEl = document.getElementById("edit-pillar-h");
        if (hEl) {
            const newH = parseFloat(hEl.value);
            item.h = isNaN(newH) ? null : newH;
        }
    }
};

// Register with ServiceContainer
if (window.ServiceContainer) {
    window.ServiceContainer.register('PillarPropertyController', window.PillarPropertyController);
}

// Backward compatibility aliases
window.showPillarProps = function(pillar) {
    window.PillarPropertyController.showPillarProps(pillar);
};
window.hidePillarProps = function() {
    window.PillarPropertyController.hidePillarProps();
};
window.showPillarDetail = function(id) {
    window.PillarPropertyController.showPillarDetail(id);
};
