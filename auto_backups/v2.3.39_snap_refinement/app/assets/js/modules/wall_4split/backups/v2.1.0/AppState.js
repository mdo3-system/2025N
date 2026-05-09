/**
 * state/AppState.js - Single Source of Truth
 * v2.1.0 Refactoring
 */

window.AppConfig = {
    TOLERANCE: {
        GRID_SNAP: 150,
        MANUAL_GRID: 50,
        TEXT_GRID: 1000
    }
};

window.AppState = {
    // --- Application State ---
    currentFloor: '1F',
    currentAppMode: 'wall', // 'wall' | 'foundation'
    foundationMode: 'f_slab',
    isPrintMode: false,

    // --- Configuration (UI-Driven) ---
    config: {
        calcMode: 'kijun',       // 'kijun' (Standard) | 'seinou' (Performance)
        nValueMode: 'detail',    // 'detail' | 'simple'
        atticHeight: 1.4,        // m
        floorHeight1F: 2.7,      // m
        floorHeight2F: 2.7,      // m
        pillarDepth1F: 105,      // mm
        pillarDepth2F: 105,      // mm
        triangleMultiplier: 1.33,
        weights: {
            roof: 500,           // N/m2
            solar: 0,            // N/m2
            ceilingIns: 100,     // N/m2
            wallIns: 70,         // N/m2
            exteriorWall: 600    // N/m2
        }
    },
    
    // --- Canvas / View State ---
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
    mouseX: 0,
    mouseY: 0,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    canvas: null,
    ctx: null,
    
    // --- Core Structural Elements ---
    pillars: [],       // Array of pillar objects
    walls: [],         // Array of wall objects (bearing & opening)
    windowsArr: [],    // Array of window objects
    areaLines: [],     // Array of area polygon objects
    bgLinesOriginal: [], // Background DXF lines
    bgTextsOriginal: [], // Background DXF texts
    gridBubbles: [],     // Grid bubble markers
    layerVisibility: {}, // Layer visibility states
    docDrawings: {
        floor: { entities: [], loaded: false, rawDxf: null },
        elev: { entities: [], loaded: false, rawDxf: null },
        div4: { entities: [], loaded: false, rawDxf: null }
    },
    
    // --- Foundation Elements ---
    exteriorWalls: [],
    foundationBeams: [],
    foundationSlabs: [],
    manholes: [],

    // --- Grid System ---
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
    pIdCounter: 0,
    window_currentDxfRaw: null,

    // --- Interaction State ---
    selectedElement: null,        // Currently selected object (Wall, Pillar, etc.)
    hoveredElement: null,
    hoveredPillar: null,
    selectedPillar: null,
    snapPoint: null,
    areaDrawPoints: [],
    selectedFoundationBeam: null,
    fdSelection: { type: null, item: null },
    fdDrawPoints: [],
    fdSelectedPillarLike: null,
    
    // --- Calculation Results / Cache ---
    reqWall: { '1F': { qX: 0, qY: 0, eq: 0, a_eff: 0 }, '2F': { qX: 0, qY: 0, eq: 0, a_eff: 0 } },
    currentTotalVal: 0,
    currentG: null,
    currentC: null,

    // --- Master Specification Lists ---
    getMasterWallList: function() {
        return [
            { id: "opt0", val: 0, text: "なし" },
            { id: "opt1", val: 2.0, text: "石こうボード 12.5mm 0.9倍 (実質2.0)" },
            { id: "opt2", val: 2.5, text: "木造軸組 耐力壁 2.5倍" },
            { id: "opt3", val: 3.0, text: "合板 9.0mm 3.0倍" },
            { id: "opt4", val: 4.0, text: "合板 12.0mm 4.0倍" },
            { id: "opt5", val: 5.0, text: "高倍率耐力壁 5.0倍" },
            { id: "opn1", val: 0, text: "開口部 (W=910/1365/1820)", type: "opening" }
        ];
    },

    getMasterBraceList: function() {
        return [
            { id: "b0", val: 0, text: "なし" },
            { id: "b1", val: 1.5, text: "筋交い 15x90 片掛け(／) 1.5倍" },
            { id: "b2", val: 1.5, text: "筋交い 15x90 片掛け(＼) 1.5倍" },
            { id: "b3", val: 2.0, text: "筋交い 45x90 片掛け(／) 2.0倍" },
            { id: "b4", val: 2.0, text: "筋交い 45x90 片掛け(＼) 2.0倍" },
            { id: "b5", val: 3.0, text: "筋交い 90x90 片掛け(／) 3.0倍" },
            { id: "b6", val: 3.0, text: "筋交い 90x90 片掛け(＼) 3.0倍" },
            { id: "b7", val: 4.0, text: "筋交い 45x90 たすき(Ｘ) 4.0倍" },
            { id: "b8", val: 5.0, text: "筋交い 90x90 たすき(Ｘ) 5.0倍" }
        ];
    },

    // --- History ---
    historyStack: [],
    redoStack: [],
    
    // --- View State Extras ---
    elementVisibility: {
        walls: true,
        pillars: true,
        areas: true,
        foundation: true
    }
};

// Global Error Handler
window.onerror = function (msg, url, line, col, error) {
    console.error("⚠️[v2.1.0] System Error:", msg, "at line:", line, error);
    return false;
};
