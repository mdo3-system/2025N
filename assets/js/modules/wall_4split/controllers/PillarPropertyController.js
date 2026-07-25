/**
 * controllers/PillarPropertyController.js - 柱専用プロパティコントローラー
 * v3.4.0 Refactoring: Single Responsibility Principle (SRP)
 */

window.PillarPropertyController = {
    /**
     * 柱要素のプロパティ表示・フォームバインド
     * @param {Object} pillar - 柱オブジェクト
     */
    showPillarProps: function(pillar) {
        if (!pillar) return;
        window.AppState.selectedPillar = pillar;

        // 柱編集の右パネル側連動 (#prop-mark, #prop-corner, #prop-lcalc)
        const pMark = document.getElementById("prop-mark");
        if (pMark) {
            pMark.value = pillar.manualMark ? pillar.manualMark : "";
            pMark.onchange = function() {
                pillar.manualMark = this.value === "" ? null : this.value;
                if (window.AppController && typeof window.AppController.refreshAll === 'function') {
                    window.AppController.refreshAll();
                }
            };
        }

        const pCorner = document.getElementById("prop-corner");
        if (pCorner) {
            pCorner.checked = pillar.isManualCorner !== null ? pillar.isManualCorner : (pillar.isCornerAuto || false);
            pCorner.onchange = function() {
                pillar.isManualCorner = this.checked;
                if (window.AppController && typeof window.AppController.refreshAll === 'function') {
                    window.AppController.refreshAll();
                }
            };
        }

        const pLcalc = document.getElementById("prop-lcalc");
        if (pLcalc) {
            pLcalc.value = pillar.lCalcMode || "auto";
            pLcalc.onchange = function() {
                pillar.lCalcMode = this.value;
                if (window.AppController && typeof window.AppController.refreshAll === 'function') {
                    window.AppController.refreshAll();
                }
            };
        }
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

// Backward compatibility alias
window.showPillarProps = function(pillar) {
    window.PillarPropertyController.showPillarProps(pillar);
};
