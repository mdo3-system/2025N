/**
 * state/AppState.js - Global Application State Container
 * v2.3.25 Refactoring
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
    foundationMode: 'f_select',
    isPrintMode: false,

    // [v2.3.25] UI Interaction State (Single Source of Truth)
    uiState: {
        mode: 'select', // 'select' | 'wall' | 'window' | 'draw-area' | 'delete-unified' | etc.
        areaType: 'floor'
    },

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
        eavesLen: 300,           // mm
        weights: {
            roof: 500,           // N/m2
            solar: 0,            // N/m2
            ceilingIns: 100,     // N/m2
            wallIns: 70,         // N/m2
            exteriorWall: 600    // N/m2
        },
        // [v2.3.24] Integrated Area Basis Data
        floorAreas: {
            '1F': 0, '1F_attic': 0, '1F_balcony': 0,
            '2F': 0, '2F_attic': 0, '2F_balcony': 0
        },
        div4Areas: {
            '1F': { xt: 0, xb: 0, yl: 0, yr: 0 },
            '2F': { xt: 0, xb: 0, yl: 0, yr: 0 }
        },
        div4Zones: {
            '1F': { xt: null, xb: null, yl: null, yr: null },
            '2F': { xt: null, xb: null, yl: null, yr: null }
        },
        projectedAreas: {
            '1F': { x: 0, y: 0 },
            '2F': { x: 0, y: 0 }
        },
        reqWallCoeffs: {
            '1F': { seismic: 0.29, wind: 0.50 },
            '2F': { seismic: 0.15, wind: 0.50 }
        }
    },

    /**
     * Initialize state from DOM (Standardization Bridge)
     */
    init: function() {
        // console.log("⚛️ [AppState] Initializing state from DOM...");
        const getNum = (id, def = 0) => {
            const el = document.getElementById(id);
            return el ? (parseFloat(el.value) || def) : def;
        };
        const getVal = (id) => document.getElementById(id)?.value;

        const c = this.config;
        const u = this.uiState;
        
        c.calcMode = getVal('calc-mode-select') || 'kijun';
        c.atticHeight = getNum('attic-height', 1.4);

        // [v2.3.25] UI State Sync
        const modeEl = document.querySelector('input[name="mode"]:checked');
        u.mode = modeEl ? modeEl.value : 'select';
        u.areaType = getVal('area-type-select') || 'floor';
        
        c.floorHeight1F = getNum('n-h1', 2.7);
        c.floorHeight2F = getNum('n-h2', 2.7);
        c.pillarDepth1F = getNum('p-d1', 105);
        c.pillarDepth2F = getNum('p-d2', 105);
        
        c.triangleMultiplier = getNum('global-triangle-mult', 1.33);
        
        c.weights.roof = getNum('prop-roof-type', 500);
        c.eavesLen = getNum('prop-eaves-len', 300);
        c.weights.solar = getNum('prop-solar', 0);
        c.weights.ceilingIns = getNum('prop-ceiling-ins', 100);
        c.weights.wallIns = getNum('prop-wall-ins', 70);
        c.weights.exteriorWall = getNum('prop-ext-wall', 600);

        // Areas
        ['1', '2'].forEach(lv => {
            const f = lv + 'F';
            c.floorAreas[f] = getNum('a-f' + lv);
            c.floorAreas[f + '_attic'] = getNum('a-attic' + lv);
            c.floorAreas[f + '_balcony'] = getNum('a-balcony' + lv);

            c.div4Areas[f].xt = getNum('e-x-t' + lv);
            c.div4Areas[f].xb = getNum('e-x-b' + lv);
            c.div4Areas[f].yl = getNum('e-y-l' + lv);
            c.div4Areas[f].yr = getNum('e-y-r' + lv);

            c.div4Zones[f].xt = getNum('z-x-t' + lv, null);
            c.div4Zones[f].xb = getNum('z-x-b' + lv, null);
            c.div4Zones[f].yl = getNum('z-y-l' + lv, null);
            c.div4Zones[f].yr = getNum('z-y-r' + lv, null);

            c.projectedAreas[f].x = getNum('a-wx' + lv);
            c.projectedAreas[f].y = getNum('a-wy' + lv);

            c.reqWallCoeffs[f].seismic = getNum('c-q' + lv, f === '1F' ? 0.29 : 0.15);
            c.reqWallCoeffs[f].wind = getNum('c-w', 0.50);
        });

        // [軸力図連携] 階高の同期
        c.floorHeight1F = getNum('n-h1', 2.7);
        c.floorHeight2F = getNum('n-h2', 2.7);
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
    manualGridAngle: [], // Array of { id, name, p1: {x,y}, p2: {x,y} } 既存交点スナップ強制
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
    diagGridPoints: [], // [v2.5.10] Temporary points for drawing diagonal grids
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
            
            // [v2.5.23] カスタム仕様に対して自動で丸数字（⑨〜⑳）を採番
            const circles = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];
            const prefix = circles[8 + idx] || "[任意]"; // ⑨以降を割り当て
            
            // ユーザー名自体がすでに丸数字から始まっている場合は二重付与を防ぐ
            const hasCirclePrefix = cw.name && circles.some(c => cw.name.startsWith(c));
            const textLabel = hasCirclePrefix ? cw.name : `${prefix} ${cw.name || ''}`;
            
            return {
                id: cw.id || `cust-w-${safeName}-${cw.val}`,
                val: cw.val,
                text: `${textLabel.trim()} (${cw.val}倍)`
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
        f_manholes: true,
        div4: true
    }
};

// Global Error Handler
window.onerror = function (msg, url, line, col, error) {
    console.error(`⚠️[${window.APP_VERSION || 'v2.x'}] System Error:`, msg, "at line:", line, error);
    return false;
};
