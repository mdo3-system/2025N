/**
 * wall_4split_main.js - エントリーポイント & グローバルブリッジ
 * v2.3.25 Refactoring
 */

// --- 階層化アーキテクチャの初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log(`🚀 [${window.APP_VERSION || 'v2.x'}] Initializing Wall 4-Split Application...`);

        // 0. バージョン表示の更新
        const verEl = document.getElementById('app-version-title');
        if (verEl) verEl.innerText = window.APP_VERSION || 'v2.x';

        // 1. 状態の初期化
        if (window.AppState && typeof window.AppState.init === 'function') {
            window.AppState.init();
        }

        // 2. キャンバスの取得
        const canvas = document.getElementById('cad-canvas');
        if (canvas) {
            window.AppState.canvas = canvas;
            window.AppState.ctx = canvas.getContext('2d');
            
            // 描画サイズの調整
            if (typeof resizeCanvas === 'function') resizeCanvas();
        }

        // 3. コントローラーの初期化
        if (window.InputController) {
            window.InputController.init();
            if (canvas) window.InputController.initCanvas(canvas);
        }

        // 4. 初回の解析と描画
        if (window.AppController) {
            window.AppController.refreshAll();
        }

        // 5. リサイズイベントの登録
        window.addEventListener('resize', () => {
            if (typeof resizeCanvas === 'function') resizeCanvas();
            if (window.AppController) window.AppController.refreshAll();
        });

        // 6. アニメーションループの開始
        requestAnimationFrame(animationLoop);

    } catch (e) {
        console.error("Initialize error:", e);
        alert("初期化エラー: " + e.message);
    }
});

/**
 * レガシーなグローバル変数のブリッジ (互換性維持)
 */
// 状態データ
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

// レガシー関数
function switchAppMode(mode) { window.AppController.switchAppMode(mode); }
function setFloor(floor) { window.AppController.setFloor(floor); }
function getAppMode() { return window.AppState.currentAppMode || 'wall'; }
function getMode() {
    const el = document.querySelector('input[name="mode"]:checked');
    return el ? el.value : 'select';
}

/**
 * アニメーションループ
 */
function animationLoop() {
    // 選択状態など、動的な描画が必要な場合に実行
    if (window.AppState.selectedElement || window.AppState.snapPoint || window.AppState.isDragging || window.getMode() === 'draw-area') {
        if (window.MainRenderer) window.MainRenderer.render(window.AppState);
    }
    requestAnimationFrame(animationLoop);
}

// DXFレイヤーパネルのトグル（InputController から呼ばれる）
function renderLayerPanel() {
    if (typeof window.UIView !== 'undefined' && window.UIView.renderLayerPanel) {
        window.UIView.renderLayerPanel();
    }
}

/**
 * 基礎モードの作図サブモード切り替え
 */
function updateFdModeUI(mode) {
    if (window.AppState) {
        window.AppState.foundationMode = mode;
        // console.log("🔄 Foundation Mode switched to:", mode);
        // 全体をリフレッシュして描画状態を同期
        if (window.AppController) window.AppController.refreshAll();
    }
}

