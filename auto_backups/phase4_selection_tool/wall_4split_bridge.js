// ==========================================
// wall_4split_bridge.js - グローバル変数ブリッジ
// ==========================================

// ★ 状態ブリッジ (AppStateへの透過的アクセス)
// プリミティブ値のコピーによる不整合を防ぐため、windowオブジェクトのプロパティとして定義します。
Object.defineProperties(window, {
    currentFloor: { get: () => window.AppState.currentFloor, set: (v) => window.AppState.currentFloor = v, enumerable: true },
    isPrintMode: { get: () => window.AppState.isPrintMode, set: (v) => window.AppState.isPrintMode = v, enumerable: true },
    reqWall: { get: () => window.AppState.reqWall, set: (v) => window.AppState.reqWall = v, enumerable: true },
    currentTotalVal: { get: () => window.AppState.currentTotalVal, set: (v) => window.AppState.currentTotalVal = v, enumerable: true },
    bgLinesOriginal: { get: () => window.AppState.bgLinesOriginal, set: (v) => window.AppState.bgLinesOriginal = v, enumerable: true },
    bgTextsOriginal: { get: () => window.AppState.bgTextsOriginal, set: (v) => window.AppState.bgTextsOriginal = v, enumerable: true },
    gridBubbles: { get: () => window.AppState.gridBubbles, set: (v) => window.AppState.gridBubbles = v, enumerable: true },
    pillars: { get: () => window.AppState.pillars, set: (v) => window.AppState.pillars = v, enumerable: true },
    walls: { get: () => window.AppState.walls, set: (v) => window.AppState.walls = v, enumerable: true },
    windowsArr: { get: () => window.AppState.windowsArr, set: (v) => window.AppState.windowsArr = v, enumerable: true },
    historyStack: { get: () => window.AppState.historyStack, set: (v) => window.AppState.historyStack = v, enumerable: true },
    redoStack: { get: () => window.AppState.redoStack, set: (v) => window.AppState.redoStack = v, enumerable: true },
    areaLines: { get: () => window.AppState.areaLines, set: (v) => window.AppState.areaLines = v, enumerable: true },
    gridXNames: { get: () => window.AppState.gridXNames, set: (v) => window.AppState.gridXNames = v, enumerable: true },
    gridYNames: { get: () => window.AppState.gridYNames, set: (v) => window.AppState.gridYNames = v, enumerable: true },
    gridXCoords: { get: () => window.AppState.gridXCoords, set: (v) => window.AppState.gridXCoords = v, enumerable: true },
    gridYCoords: { get: () => window.AppState.gridYCoords, set: (v) => window.AppState.gridYCoords = v, enumerable: true },
    userEditedGridX: { get: () => window.AppState.userEditedGridX, set: (v) => window.AppState.userEditedGridX = v, enumerable: true },
    userEditedGridY: { get: () => window.AppState.userEditedGridY, set: (v) => window.AppState.userEditedGridY = v, enumerable: true },
    manualGridX: { get: () => window.AppState.manualGridX, set: (v) => window.AppState.manualGridX = v, enumerable: true },
    manualGridY: { get: () => window.AppState.manualGridY, set: (v) => window.AppState.manualGridY = v, enumerable: true },
    areaDrawPoints: { get: () => window.AppState.areaDrawPoints, set: (v) => window.AppState.areaDrawPoints = v, enumerable: true },
    deletedGridX: { get: () => window.AppState.deletedGridX, set: (v) => window.AppState.deletedGridX = v, enumerable: true },
    deletedGridY: { get: () => window.AppState.deletedGridY, set: (v) => window.AppState.deletedGridY = v, enumerable: true },
    scale: { get: () => window.AppState.scale, set: (v) => window.AppState.scale = v, enumerable: true },
    offsetX: { get: () => window.AppState.offsetX, set: (v) => window.AppState.offsetX = v, enumerable: true },
    offsetY: { get: () => window.AppState.offsetY, set: (v) => window.AppState.offsetY = v, enumerable: true },
    isDragging: { get: () => window.AppState.isDragging, set: (v) => window.AppState.isDragging = v, enumerable: true },
    lastMouseX: { get: () => window.AppState.lastMouseX, set: (v) => window.AppState.lastMouseX = v, enumerable: true },
    lastMouseY: { get: () => window.AppState.lastMouseY, set: (v) => window.AppState.lastMouseY = v, enumerable: true },
    mouseX: { get: () => window.AppState.mouseX, set: (v) => window.AppState.mouseX = v, enumerable: true },
    mouseY: { get: () => window.AppState.mouseY, set: (v) => window.AppState.mouseY = v, enumerable: true },
    hoveredPillar: { get: () => window.AppState.hoveredPillar, set: (v) => window.AppState.hoveredPillar = v, enumerable: true },
    selectedPillar: { get: () => window.AppState.selectedPillar, set: (v) => window.AppState.selectedPillar = v, enumerable: true },
    snapPoint: { get: () => window.AppState.snapPoint, set: (v) => window.AppState.snapPoint = v, enumerable: true },
    currentG: { get: () => window.AppState.currentG, set: (v) => window.AppState.currentG = v, enumerable: true },
    currentC: { get: () => window.AppState.currentC, set: (v) => window.AppState.currentC = v, enumerable: true },
    // [機能改善 外壁仕様追加]
    exteriorWallWeight: { get: () => window.AppState.exteriorWallWeight, set: (v) => window.AppState.exteriorWallWeight = v, enumerable: true },
    // [機能改善 荷重仕様拡充]
    roofWeight: { get: () => window.AppState.roofWeight, set: (v) => window.AppState.roofWeight = v, enumerable: true },
    solarWeight: { get: () => window.AppState.solarWeight, set: (v) => window.AppState.solarWeight = v, enumerable: true },
    ceilingInsWeight: { get: () => window.AppState.ceilingInsWeight, set: (v) => window.AppState.ceilingInsWeight = v, enumerable: true },
    wallInsWeight: { get: () => window.AppState.wallInsWeight, set: (v) => window.AppState.wallInsWeight = v, enumerable: true },
    
    // [機能改善 要素レイヤ切替]
    elementVisibility: { get: () => window.AppState.elementVisibility, set: (v) => window.AppState.elementVisibility = v, enumerable: true },

    pIdCounter: { get: () => window.AppState.pIdCounter, set: (v) => window.AppState.pIdCounter = v, enumerable: true },
    window_currentDxfRaw: { get: () => window.AppState.window_currentDxfRaw, set: (v) => window.AppState.window_currentDxfRaw = v, enumerable: true },
    docDrawings: { get: () => window.AppState.docDrawings, set: (v) => window.AppState.docDrawings = v, enumerable: true },
    canvas: { get: () => window.AppState.canvas, set: (v) => window.AppState.canvas = v, enumerable: true },
    ctx: { get: () => window.AppState.ctx, set: (v) => window.AppState.ctx = v, enumerable: true },
    // [基礎計算追加 Phase1] アプリモードのブリッジ
    currentAppMode: { get: () => window.AppState.currentAppMode, set: (v) => window.AppState.currentAppMode = v, enumerable: true },
    // [基礎計算追加 Phase1] 基礎データ配列のブリッジ
    exteriorWalls: { get: () => window.AppState.exteriorWalls, set: (v) => window.AppState.exteriorWalls = v, enumerable: true },
    foundationBeams: { get: () => window.AppState.foundationBeams, set: (v) => window.AppState.foundationBeams = v, enumerable: true },
    foundationSlabs: { get: () => window.AppState.foundationSlabs, set: (v) => window.AppState.foundationSlabs = v, enumerable: true },
    manholes: { get: () => window.AppState.manholes, set: (v) => window.AppState.manholes = v, enumerable: true },
    // [基礎計算追加 Phase2] サブモードとバッファのブリッジ
    foundationMode: { get: () => window.AppState.foundationMode, set: (v) => window.AppState.foundationMode = v, enumerable: true },
    fdDrawPoints: { get: () => window.AppState.fdDrawPoints, set: (v) => window.AppState.fdDrawPoints = v, enumerable: true },
    fdSelectedPillarLike: { get: () => window.AppState.fdSelectedPillarLike, set: (v) => window.AppState.fdSelectedPillarLike = v, enumerable: true },
    // [基礎計算追加 Phase4] 選択基礎梁のブリッジ
    selectedFoundationBeam: { get: () => window.AppState.selectedFoundationBeam, set: (v) => window.AppState.selectedFoundationBeam = v, enumerable: true },
    selectedElement: { get: () => window.AppState.selectedElement, set: (v) => window.AppState.selectedElement = v, enumerable: true }
});
