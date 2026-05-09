/**
 * state/AppState.js - Global Application State Container
 * v2.3.20 Refactoring
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
    customWalls: [],
    customBraces: [],
    customHardware: [],

    getMasterWallList: function() {
        if (!window.Specs) return [];
        const base = window.Specs.getMasterWallList();
        const custom = this.customWalls.map((cw, idx) => {
            // IDを名前ベースで安定化させる（インデックスだと行の削除・挿入でズレるため）
            const safeName = (cw.name || "").replace(/\s+/g, "_");
            return {
                id: cw.id || `cust-w-${safeName}-${cw.val}`,
                val: cw.val,
                text: `[任意] ${cw.name} (${cw.val}倍)`
            };
        });
        return [...base, ...custom];
    },

    getMasterBraceList: function() {
        return window.Specs ? window.Specs.getMasterBraceList() : [];
    },

    getHardwareList: function() {
        if (!window.Specs) return [];
        const base = window.Specs.getHardwareList();
        const custom = this.customHardware.map(ch => ({
            name: ch.name,
            n: ch.val / 5.3, // kN to n conversion (approx)
            text: `[任意] ${ch.name} (${ch.val}kN)`
        }));
        return [...base, ...custom].sort((a, b) => a.n - b.n);
    },

    // --- History ---
    historyStack: [],
    redoStack: [],
    
    // --- View State Extras ---
    elementVisibility: {
        grids: true,
        pillars: true,
        pillarNValues: true,
        walls: true,
        windows: true,
        areas: true,
        foundation: true,
        f_beams: true,
        f_slabs: true,
        f_ext_walls: true,
        f_manholes: true
    }
};

// Global Error Handler
window.onerror = function (msg, url, line, col, error) {
    console.error(`⚠️[${window.APP_VERSION || 'v2.x'}] System Error:`, msg, "at line:", line, error);
    return false;
};
