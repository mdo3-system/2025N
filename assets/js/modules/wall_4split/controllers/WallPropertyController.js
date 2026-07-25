/**
 * controllers/WallPropertyController.js - 壁・開口専用プロパティコントローラー
 * v3.4.4 Refactoring: Single Responsibility Principle (SRP) & Modal Spec Binding
 */

window.WallPropertyController = {
    /**
     * 壁・開口プロパティモーダルの変更反映
     * @param {Object} hit - selectedElement { type, item }
     */
    applyChanges: function(hit) {
        if (!hit || !hit.item) return;
        const oldType = hit.type;
        const item = hit.item;
        const newTypeEl = document.getElementById("edit-element-type");
        const newType = newTypeEl ? newTypeEl.value : oldType;

        // 1. 軸組階高連動ロジック
        if (oldType === "wall" || newType === "wall") {
            const hEl = document.getElementById("edit-wall-h");
            const newH = hEl ? parseFloat(hEl.value) : NaN;
            if (!isNaN(newH)) {
                item.h = newH;
                if (item.p1) item.p1.h = newH;
                if (item.p2) item.p2.h = newH;
                
                // 同一座標・方向の近接部材へ階高伝播
                if (window.PropertyController && typeof window.PropertyController.propagateHeight === 'function') {
                    window.PropertyController.propagateHeight(item, newH);
                }
            }
        }

        // 2. 耐力壁・開口部の切り替えロジック
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

        // 3. 壁の仕様（外側パネル・内側パネル・筋かい）更新
        if (newType === "wall") {
            const p1El = document.getElementById("edit-wall-p1");
            const p2El = document.getElementById("edit-wall-p2");
            const bEl  = document.getElementById("edit-wall-b");
            if (p1El) item.outPanelId = p1El.value;
            if (p2El) item.inPanelId  = p2El.value;
            if (bEl)  item.braceId    = bEl.value;

            if (window.WallEngine) {
                item.totalVal = window.WallEngine.getTotalMultiplier(item);
                const bSpec = window.WallEngine.getBraceSpec(item.braceId);
                item.isTasuki = bSpec ? (bSpec.text || '').includes('たすき') : false;
            }
        } else {
            const winWEl = document.getElementById("edit-win-width");
            if (winWEl) item.length = parseInt(winWEl.value, 10);
            item.totalVal = 0;
        }

        // 右パネルの入力デフォルト仕様も最新選択値に同期
        const p1Main = document.getElementById("wall-p1");
        const p2Main = document.getElementById("wall-p2");
        const bMain  = document.getElementById("wall-b");
        if (p1Main && item.outPanelId) p1Main.value = item.outPanelId;
        if (p2Main && item.inPanelId)  p2Main.value = item.inPanelId;
        if (bMain  && item.braceId)    bMain.value  = item.braceId;

        if (window.UIView && typeof window.UIView.updateWallSpecSummary === 'function') {
            window.UIView.updateWallSpecSummary();
        }
    }
};

// Register with ServiceContainer
if (window.ServiceContainer) {
    window.ServiceContainer.register('WallPropertyController', window.WallPropertyController);
}
