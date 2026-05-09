/**
 * wall_4split_main.js - 繧ｨ繝ｳ繝医Μ繝ｼ繝昴う繝ｳ繝� & 繧ｰ繝ｭ繝ｼ繝舌Ν繝悶Μ繝�ず
 * v2.3.25 Refactoring
 */

// --- 髫主ｱ､蛹悶い繝ｼ繧ｭ繝�け繝√Ε縺ｮ蛻晄悄蛹� ---
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log(`�噫 [${window.APP_VERSION || 'v2.x'}] Initializing Wall 4-Split Application...`);

        // 0. 繝舌�繧ｸ繝ｧ繝ｳ陦ｨ遉ｺ縺ｮ譖ｴ譁ｰ
        const verEl = document.getElementById('app-version-title');
        if (verEl) verEl.innerText = window.APP_VERSION || 'v2.x';

        // 1. 迥ｶ諷九�蛻晄悄蛹�
        if (window.AppState && typeof window.AppState.init === 'function') {
            window.AppState.init();
        }

        // 2. 繧ｭ繝｣繝ｳ繝舌せ縺ｮ蜿門ｾ�
        const canvas = document.getElementById('cad-canvas');
        if (canvas) {
            window.AppState.canvas = canvas;
            window.AppState.ctx = canvas.getContext('2d');
            
            // 謠冗判繧ｵ繧､繧ｺ縺ｮ隱ｿ謨ｴ
            if (typeof resizeCanvas === 'function') resizeCanvas();
        }

        // 3. 繧ｳ繝ｳ繝医Ο繝ｼ繝ｩ繝ｼ縺ｮ蛻晄悄蛹�
        if (window.InputController) {
            window.InputController.init();
            if (canvas) window.InputController.initCanvas(canvas);
        }

        // 4. 蛻晏屓縺ｮ隗｣譫舌→謠冗判
        if (window.AppController) {
            window.AppController.refreshAll();
        }

        // 5. 繝ｪ繧ｵ繧､繧ｺ繧､繝吶Φ繝医�逋ｻ骭ｲ
        window.addEventListener('resize', () => {
            if (typeof resizeCanvas === 'function') resizeCanvas();
            if (window.AppController) window.AppController.refreshAll();
        });

        // 6. 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繝ｫ繝ｼ繝励�髢句ｧ�
        requestAnimationFrame(animationLoop);

    } catch (e) {
        console.error("Initialize error:", e);
        alert("蛻晄悄蛹悶お繝ｩ繝ｼ: " + e.message);
    }
});

/**
 * 繝ｬ繧ｬ繧ｷ繝ｼ縺ｪ繧ｰ繝ｭ繝ｼ繝舌Ν螟画焚縺ｮ繝悶Μ繝�ず (莠呈鋤諤ｧ邯ｭ謖�)
 */
// 迥ｶ諷九ョ繝ｼ繧ｿ
Object.defineProperty(window, 'pillars', { get: () => window.AppState.pillars, set: v => window.AppState.pillars = v });
Object.defineProperty(window, 'walls', { get: () => window.AppState.walls, set: v => window.AppState.walls = v });
Object.defineProperty(window, 'windowsArr', { get: () => window.AppState.windowsArr, set: v => window.AppState.windowsArr = v });
Object.defineProperty(window, 'areaLines', { get: () => window.AppState.areaLines, set: v => window.AppState.areaLines = v });
Object.defineProperty(window, 'bgLinesOriginal', { get: () => window.AppState.bgLinesOriginal, set: v => window.AppState.bgLinesOriginal = v });
Object.defineProperty(window, 'bgTextsOriginal', { get: () => window.AppState.bgTextsOriginal, set: v => window.AppState.bgTextsOriginal = v });
Object.defineProperty(window, 'gridXCoords', { get: () => window.AppState.gridXCoords, set: v => window.AppState.gridXCoords = v });
Object.defineProperty(window, 'gridYCoords', { get: () => window.AppState.gridYCoords, set: v => window.AppState.gridYCoords = v });
Object.defineProperty(window, 'gridXNames', { get: () => window.AppState.gridXNames, set: v => window.AppState.gridXNames = v });
Object.defineProperty(window, 'gridYNames', { get: () => window.AppState.gridYNames, set: v => window.AppState.gridYNames = v });
Object.defineProperty(window, 'pIdCounter', { get: () => window.AppState.pIdCounter, set: v => window.AppState.pIdCounter = v });
Object.defineProperty(window, 'currentFloor', { get: () => window.AppState.currentFloor, set: v => window.AppState.currentFloor = v });
Object.defineProperty(window, 'isPrintMode', { get: () => window.AppState.isPrintMode, set: v => window.AppState.isPrintMode = v });
Object.defineProperty(window, 'scale', { get: () => window.AppState.scale, set: v => window.AppState.scale = v });
Object.defineProperty(window, 'offsetX', { get: () => window.AppState.offsetX, set: v => window.AppState.offsetX = v });
Object.defineProperty(window, 'offsetY', { get: () => window.AppState.offsetY, set: v => window.AppState.offsetY = v });
Object.defineProperty(window, 'mouseX', { get: () => window.AppState.mouseX, set: v => window.AppState.mouseX = v });
Object.defineProperty(window, 'mouseY', { get: () => window.AppState.mouseY, set: v => window.AppState.mouseY = v });
Object.defineProperty(window, 'isDragging', { get: () => window.AppState.isDragging, set: v => window.AppState.isDragging = v });
Object.defineProperty(window, 'lastMouseX', { get: () => window.AppState.lastMouseX, set: v => window.AppState.lastMouseX = v });
Object.defineProperty(window, 'lastMouseY', { get: () => window.AppState.lastMouseY, set: v => window.AppState.lastMouseY = v });
Object.defineProperty(window, 'hoveredPillar', { get: () => window.AppState.hoveredPillar, set: v => window.AppState.hoveredPillar = v });
Object.defineProperty(window, 'selectedPillar', { get: () => window.AppState.selectedPillar, set: v => window.AppState.selectedPillar = v });
Object.defineProperty(window, 'snapPoint', { get: () => window.AppState.snapPoint, set: v => window.AppState.snapPoint = v });
Object.defineProperty(window, 'areaDrawPoints', { get: () => window.AppState.areaDrawPoints, set: v => window.AppState.areaDrawPoints = v });

// 繝ｬ繧ｬ繧ｷ繝ｼ髢｢謨ｰ
function switchAppMode(mode) { window.AppController.switchAppMode(mode); }
window.getFdMode = function() { return window.AppState.foundationMode || 'f_beam'; };
function setFloor(floor) { window.AppController.setFloor(floor); }
function getAppMode() { return window.AppState.currentAppMode || 'wall'; }
function getMode() {
    const el = document.querySelector('input[name="mode"]:checked');
    return el ? el.value : 'select';
}

/**
 * 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繝ｫ繝ｼ繝�
 */
function animationLoop() {
    // 驕ｸ謚樒憾諷九↑縺ｩ縲∝虚逧�↑謠冗判縺悟ｿ�ｦ√↑蝣ｴ蜷医↓螳溯｡�
    if (window.AppState.selectedElement || window.AppState.snapPoint || window.AppState.isDragging || window.getMode() === 'draw-area') {
        if (window.MainRenderer) window.MainRenderer.render(window.AppState);
    }
    requestAnimationFrame(animationLoop);
}

// DXF繝ｬ繧､繝､繝ｼ繝代ロ繝ｫ縺ｮ繝医げ繝ｫ��nputController 縺九ｉ蜻ｼ縺ｰ繧後ｋ��
function renderLayerPanel() {
    if (typeof window.UIView !== 'undefined' && window.UIView.renderLayerPanel) {
        window.UIView.renderLayerPanel();
    }
}

/**
 * 蝓ｺ遉弱Δ繝ｼ繝峨�菴懷峙繧ｵ繝悶Δ繝ｼ繝牙�繧頑崛縺�
 */
function updateFdModeUI(mode) {
    if (window.AppState) {
        window.AppState.foundationMode = mode;
        // console.log("�売 Foundation Mode switched to:", mode);
        // 蜈ｨ菴薙ｒ繝ｪ繝輔Ξ繝�す繝･縺励※謠冗判迥ｶ諷九ｒ蜷梧悄
        if (window.AppController) window.AppController.refreshAll();
    }
}


/**
 * 基礎プロパティポップアップを閉じる (HTMLからの呼び出し用)
 */
function hideFdPropertyPopup() {
    if (window.PropertyController) {
        window.PropertyController.hideFdPopup();
    }
}
