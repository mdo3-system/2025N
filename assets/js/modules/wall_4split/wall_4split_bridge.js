// ==========================================
// wall_4split_bridge.js - グローバル変数ブリッジ
// ==========================================

// ★ 状態ブリッジ (AppStateへの透過的アクセス)
// プリミティブ値のコピーによる不整合を防ぐため、windowオブジェクトのプロパティとして定義します。
Object.defineProperties(window, {
    currentFloor: { get: () => window.AppState.currentFloor, set: (v) => window.AppState.currentFloor = v, enumerable: true, configurable: true },
    isPrintMode: { get: () => window.AppState.isPrintMode, set: (v) => window.AppState.isPrintMode = v, enumerable: true, configurable: true },
    reqWall: { get: () => window.AppState.reqWall, set: (v) => window.AppState.reqWall = v, enumerable: true, configurable: true },
    currentTotalVal: { get: () => window.AppState.currentTotalVal, set: (v) => window.AppState.currentTotalVal = v, enumerable: true, configurable: true },
    bgLinesOriginal: { get: () => window.AppState.bgLinesOriginal || [], set: (v) => window.AppState.bgLinesOriginal = v, enumerable: true, configurable: true },
    bgTextsOriginal: { get: () => window.AppState.bgTextsOriginal || [], set: (v) => window.AppState.bgTextsOriginal = v, enumerable: true, configurable: true },
    gridBubbles: { get: () => window.AppState.gridBubbles || [], set: (v) => window.AppState.gridBubbles = v, enumerable: true, configurable: true },
    pillars: { get: () => window.AppState.pillars || [], set: (v) => window.AppState.pillars = v, enumerable: true, configurable: true },
    walls: { get: () => window.AppState.walls || [], set: (v) => window.AppState.walls = v, enumerable: true, configurable: true },
    windowsArr: { get: () => window.AppState.windowsArr || [], set: (v) => window.AppState.windowsArr = v, enumerable: true, configurable: true },
    historyStack: { get: () => window.AppState.historyStack || [], set: (v) => window.AppState.historyStack = v, enumerable: true, configurable: true },
    redoStack: { get: () => window.AppState.redoStack || [], set: (v) => window.AppState.redoStack = v, enumerable: true, configurable: true },
    areaLines: { get: () => window.AppState.areaLines || [], set: (v) => window.AppState.areaLines = v, enumerable: true, configurable: true },
    gridXNames: { get: () => window.AppState.gridXNames || [], set: (v) => window.AppState.gridXNames = v, enumerable: true, configurable: true },
    gridYNames: { get: () => window.AppState.gridYNames || [], set: (v) => window.AppState.gridYNames = v, enumerable: true, configurable: true },
    gridXCoords: { get: () => window.AppState.gridXCoords || [], set: (v) => window.AppState.gridXCoords = v, enumerable: true, configurable: true },
    gridYCoords: { get: () => window.AppState.gridYCoords || [], set: (v) => window.AppState.gridYCoords = v, enumerable: true, configurable: true },
    userEditedGridX: { get: () => window.AppState.userEditedGridX, set: (v) => window.AppState.userEditedGridX = v, enumerable: true, configurable: true },
    userEditedGridY: { get: () => window.AppState.userEditedGridY, set: (v) => window.AppState.userEditedGridY = v, enumerable: true, configurable: true },
    manualGridX: { get: () => window.AppState.manualGridX, set: (v) => window.AppState.manualGridX = v, enumerable: true, configurable: true },
    manualGridY: { get: () => window.AppState.manualGridY, set: (v) => window.AppState.manualGridY = v, enumerable: true, configurable: true },
    areaDrawPoints: { get: () => window.AppState.areaDrawPoints, set: (v) => window.AppState.areaDrawPoints = v, enumerable: true, configurable: true },
    deletedGridX: { get: () => window.AppState.deletedGridX, set: (v) => window.AppState.deletedGridX = v, enumerable: true, configurable: true },
    deletedGridY: { get: () => window.AppState.deletedGridY, set: (v) => window.AppState.deletedGridY = v, enumerable: true, configurable: true },
    scale: { get: () => window.AppState.scale, set: (v) => window.AppState.scale = v, enumerable: true, configurable: true },
    offsetX: { get: () => window.AppState.offsetX, set: (v) => window.AppState.offsetX = v, enumerable: true, configurable: true },
    offsetY: { get: () => window.AppState.offsetY, set: (v) => window.AppState.offsetY = v, enumerable: true, configurable: true },
    isDragging: { get: () => window.AppState.isDragging, set: (v) => window.AppState.isDragging = v, enumerable: true, configurable: true },
    lastMouseX: { get: () => window.AppState.lastMouseX, set: (v) => window.AppState.lastMouseX = v, enumerable: true, configurable: true },
    lastMouseY: { get: () => window.AppState.lastMouseY, set: (v) => window.AppState.lastMouseY = v, enumerable: true, configurable: true },
    mouseX: { get: () => window.AppState.mouseX, set: (v) => window.AppState.mouseX = v, enumerable: true, configurable: true },
    mouseY: { get: () => window.AppState.mouseY, set: (v) => window.AppState.mouseY = v, enumerable: true, configurable: true },
    hoveredPillar: { get: () => window.AppState.hoveredPillar, set: (v) => window.AppState.hoveredPillar = v, enumerable: true, configurable: true },
    selectedPillar: { get: () => window.AppState.selectedPillar, set: (v) => window.AppState.selectedPillar = v, enumerable: true, configurable: true },
    snapPoint: { get: () => window.AppState.snapPoint, set: (v) => window.AppState.snapPoint = v, enumerable: true, configurable: true },
    currentG: { get: () => window.AppState.currentG, set: (v) => window.AppState.currentG = v, enumerable: true, configurable: true },
    currentC: { get: () => window.AppState.currentC, set: (v) => window.AppState.currentC = v, enumerable: true, configurable: true },
    // [機能改善 外壁仕様追加]
    exteriorWallWeight: { get: () => window.AppState.config.weights.exteriorWall, set: (v) => window.AppState.config.weights.exteriorWall = v, enumerable: true, configurable: true },
    // [機能改善 荷重仕様拡充]
    roofWeight: { get: () => window.AppState.config.weights.roof, set: (v) => window.AppState.config.weights.roof = v, enumerable: true, configurable: true },
    solarWeight: { get: () => window.AppState.config.weights.solar, set: (v) => window.AppState.config.weights.solar = v, enumerable: true, configurable: true },
    ceilingInsWeight: { get: () => window.AppState.config.weights.ceilingIns, set: (v) => window.AppState.config.weights.ceilingIns = v, enumerable: true, configurable: true },
    wallInsWeight: { get: () => window.AppState.config.weights.wallIns, set: (v) => window.AppState.config.weights.wallIns = v, enumerable: true, configurable: true },
    
    // [機能改善 要素レイヤ切替]
    elementVisibility: { get: () => window.AppState.elementVisibility, set: (v) => window.AppState.elementVisibility = v, enumerable: true, configurable: true },
    appLayerVisibility: { get: () => window.AppState.layerVisibility, set: (v) => window.AppState.layerVisibility = v, enumerable: true, configurable: true },

    pIdCounter: { get: () => window.AppState.pIdCounter, set: (v) => window.AppState.pIdCounter = v, enumerable: true, configurable: true },
    window_currentDxfRaw: { get: () => window.AppState.window_currentDxfRaw, set: (v) => window.AppState.window_currentDxfRaw = v, enumerable: true, configurable: true },
    docDrawings: { get: () => window.AppState.docDrawings, set: (v) => window.AppState.docDrawings = v, enumerable: true, configurable: true },
    canvas: { get: () => window.AppState.canvas, set: (v) => window.AppState.canvas = v, enumerable: true, configurable: true },
    ctx: { get: () => window.AppState.ctx, set: (v) => window.AppState.ctx = v, enumerable: true, configurable: true },
    // [基礎計算追加 Phase1] アプリモードのブリッジ
    currentAppMode: { get: () => window.AppState.currentAppMode, set: (v) => window.AppState.currentAppMode = v, enumerable: true, configurable: true },
    // [基礎計算追加 Phase1] 基礎データ配列のブリッジ
    exteriorWalls: { get: () => window.AppState.exteriorWalls, set: (v) => window.AppState.exteriorWalls = v, enumerable: true, configurable: true },
    foundationBeams: { get: () => window.AppState.foundationBeams, set: (v) => window.AppState.foundationBeams = v, enumerable: true, configurable: true },
    foundationSlabs: { get: () => window.AppState.foundationSlabs, set: (v) => window.AppState.foundationSlabs = v, enumerable: true, configurable: true },
    manholes: { get: () => window.AppState.manholes, set: (v) => window.AppState.manholes = v, enumerable: true, configurable: true },
    // [基礎計算追加 Phase2] サブモードとバッファのブリッジ
    foundationMode: { get: () => window.AppState.foundationMode, set: (v) => window.AppState.foundationMode = v, enumerable: true, configurable: true },
    fdDrawPoints: { get: () => window.AppState.fdDrawPoints, set: (v) => window.AppState.fdDrawPoints = v, enumerable: true, configurable: true },
    fdSelectedPillarLike: { get: () => window.AppState.fdSelectedPillarLike, set: (v) => window.AppState.fdSelectedPillarLike = v, enumerable: true, configurable: true },
    // [基礎計算追加 Phase4] 選択基礎梁のブリッジ
    selectedFoundationBeam: { get: () => window.AppState.selectedFoundationBeam, set: (v) => window.AppState.selectedFoundationBeam = v, enumerable: true, configurable: true },
    selectedElement: { get: () => window.AppState.selectedElement, set: (v) => window.AppState.selectedElement = v, enumerable: true, configurable: true }
});

// ★ 関数ブリッジ (Engineメソッドへのエイリアス)
window.getPillarName = (p) => window.GridEngine.getPillarName(p, window.AppState);
window.getWallTotalVal = (w) => window.WallEngine.getTotalMultiplier(w);
window.getWallSpec = (id) => window.WallEngine.getWallSpec(id);
window.getBraceSpec = (id) => window.WallEngine.getBraceSpec(id);

// ★ 座標変換の一元化 (Unified Coordinate Transformation)
// 描画と入力の不一致を完全に解消するためのグローバル共通関数
window.toCanvasPixel = (x_or_obj, y_val) => {
    const s = window.AppState;
    if (!s || !s.canvas) return { cx: 0, cy: 0 };
    let wx = Number(typeof x_or_obj === 'object' ? (x_or_obj.globalX ?? x_or_obj.x) : x_or_obj);
    let wy = Number(typeof x_or_obj === 'object' ? (x_or_obj.globalY ?? x_or_obj.y) : y_val);
    const dpr = window.devicePixelRatio || 1;
    const cssH = s.canvas.height / dpr; // CSS論理ピクセル高さに正規化
    return {
        cx: wx * s.scale + s.offsetX,
        cy: cssH - (wy * s.scale + s.offsetY)
    };
};

window.toWorldCoord = (cx, cy) => {
    const s = window.AppState;
    if (!s || !s.canvas) return { x: 0, y: 0 };
    const dpr = window.devicePixelRatio || 1;
    const cssH = s.canvas.height / dpr; // CSS論理ピクセル高さに正規化
    return {
        x: (cx - s.offsetX) / s.scale,
        y: (cssH - cy - s.offsetY) / s.scale
    };
};
