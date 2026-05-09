/**
 * AppState.js
 * アプリケーション全体の状態（State）および設定（Config）を管理するモジュール
 */

export const AppConfig = {
    TOLERANCE: {
        GRID_SNAP: 150,
        MANUAL_GRID: 50,
        TEXT_GRID: 1000
    }
};

export const AppState = {
    // UI・表示状態
    currentFloor: '1F',
    isPrintMode: false,
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,

    // メインモード ('wall' | 'foundation')
    currentAppMode: 'wall',

    // 計算用パラメータ
    triangleMultiplier: 1.33,
    averageGroundPressure: 0,
    averageBuildingPressure: 0,
    concreteFc: 21,
    exteriorWallWeight: 600,
    roofWeight: 500,
    solarWeight: 0,
    ceilingInsWeight: 100,
    wallInsWeight: 70,

    // 基礎モード サブモード
    foundationMode: 'f_slab',
    fdSelectedPillarLike: null,
    fdDrawPoints: [],
    fdSelection: { type: null, item: null },

    // 計算結果
    reqWall: { '1F': { qX: 0, qY: 0, eq: 0, a_eff: 0 }, '2F': { qX: 0, qY: 0, eq: 0, a_eff: 0 } },
    currentTotalVal: 0,
    currentG: null,
    currentC: null,

    // レイヤ表示フラグ
    elementVisibility: {
        pillars: true, pillarNValues: true, walls: true, windows: true, areas: true,
        f_beams: true, f_slabs: true, f_ext_walls: true, f_manholes: true,
        grids: true
    },
    
    // 図面データ
    bgLinesOriginal: [],
    bgTextsOriginal: [],
    gridBubbles: [],
    docDrawings: {
        floor: { entities: [], loaded: false, rawDxf: null },
        elev: { entities: [], loaded: false, rawDxf: null },
        div4: { entities: [], loaded: false, rawDxf: null }
    },
    window_currentDxfRaw: null,
    
    // 建築要素
    pillars: [],
    walls: [],
    windowsArr: [],
    areaLines: [],
    pIdCounter: 1,
    exteriorWalls: [],
    foundationBeams: [],
    foundationSlabs: [],
    manholes: [],

    // グリッド
    gridXNames: [],
    gridYNames: [],
    gridXCoords: [],
    gridYCoords: [],
    manualGridX: [],
    manualGridY: [],
    deletedGridX: [],
    deletedGridY: [],
    userEditedGridX: {},
    userEditedGridY: {},
    
    // マウス・作図
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    mouseX: 0,
    mouseY: 0,
    hoveredPillar: null,
    selectedPillar: null,
    snapPoint: null,
    areaDrawPoints: [],
    
    // 履歴
    historyStack: [],
    redoStack: [],
    
    // Canvas (初期化時にセット)
    canvas: null,
    ctx: null,

    // UIパラメータ (DOMからの入力を同期)
    uiParams: {}
};

/**
 * 互換性のための window ブリッジ設定
 * 新しいモジュール化されたコードでは直接 import することを推奨
 */
export function setupStateBridge() {
    window.AppConfig = AppConfig;
    window.AppState = AppState;
    
    // 個別プロパティのブリッジ (既存コードの動作維持用)
    const bridgeProps = {};
    Object.keys(AppState).forEach(key => {
        bridgeProps[key] = {
            get: () => AppState[key],
            set: (v) => { AppState[key] = v; },
            enumerable: true,
            configurable: true
        };
    });
    Object.defineProperties(window, bridgeProps);
}
