/**
 * wall_4split_main.js - 繧ｨ繝ｳ繝医Μ繝ｼ繝昴う繝ｳ繝� & 繧ｰ繝ｭ繝ｼ繝舌Ν繝悶Μ繝�ず
 * wall_4split_main.js - 繧ｨ繝ｳ繝医Μ繝ｼ繝昴う繝ｳ繝 & 繧ｰ繝ｭ繝ｼ繝舌Ν繝悶Μ繝ず
 * v2.3.25 Refactoring
 */

// --- 髫主ｱ､蛹悶い繝ｼ繧ｭ繝け繝√Ε縺ｮ蛻晄悄蛹 ---
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log(`🚀 [${window.APP_VERSION || 'v2.x'}] Initializing Wall 4-Split Application...`);

        // Register and wire up core engine dependencies via DI
        if (window.ServiceContainer) {
            const sync = window.ServiceContainer.get('SlabBeamSynchronizer');
            if (sync && typeof sync.inject === 'function') {
                sync.inject({
                    appState: window.AppState
                });
            }

            const fdEngine = window.ServiceContainer.get('FoundationEngine');
            if (fdEngine && typeof fdEngine.inject === 'function') {
                fdEngine.inject({
                    appState: window.AppState,
                    mathUtils: window.MathUtils,
                    axialEngine: window.AxialEngine,
                    areaEngine: window.AreaEngine,
                    synchronizer: sync
                });
            }
        }

        // 0. バージョン表示の更新
        const verEl = document.getElementById('app-version-title');
        if (verEl) {
            verEl.innerText = window.APP_VERSION || 'v2.x';
            document.title = `上善如水 - 壁量計算WEB (${window.APP_VERSION || 'v2.x'})`; // 印刷ヘッダー用
        }

        // 1. 迥ｶ諷九蛻晄悄蛹
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

        // 4. 初回モード設定 (1階作図モード: 1F / 壁の配置)
        if (window.AppController) {
            window.AppController.setFloor('1F');
            window.AppController.switchAppMode('wall');
            const wallRadio = document.querySelector('input[name="mode"][value="wall"]');
            if (wallRadio) {
                wallRadio.checked = true;
                if (typeof handleModeChange === 'function') handleModeChange({ target: wallRadio });
            }
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
Object.defineProperty(window, 'hoveredFdElement', { get: () => window.AppState.hoveredFdElement, set: v => window.AppState.hoveredFdElement = v });
Object.defineProperty(window, 'selectedPillar', { get: () => window.AppState.selectedPillar, set: v => window.AppState.selectedPillar = v });
Object.defineProperty(window, 'snapPoint', { get: () => window.AppState.snapPoint, set: v => window.AppState.snapPoint = v });
Object.defineProperty(window, 'areaDrawPoints', { get: () => window.AppState.areaDrawPoints, set: v => window.AppState.areaDrawPoints = v });

// 繝ｬ繧ｬ繧ｷ繝ｼ髢｢謨ｰ
function switchAppMode(mode) { window.AppController.switchAppMode(mode); }
window.getFdMode = function() { return window.AppState.foundationMode || 'f_beam'; };
function setFloor(floor) { window.AppController.setFloor(floor); }
function getAppMode() { return window.AppState.currentAppMode || 'wall'; }
function getMode() {
    const state = window.AppState;
    if (state && state.currentAppMode === 'roof') {
        const el = document.querySelector('input[name="roof_mode"]:checked');
        return el ? el.value : 'roof_select';
    }
    const el = document.querySelector('input[name="mode"]:checked');
    return el ? el.value : 'select';
}

window.updateRoofModeUI = function(mode) {
    const selector = document.getElementById('roof-mode-selector');
    if (selector) {
        const labels = selector.querySelectorAll('.roof-mode-label');
        labels.forEach(l => {
            const input = l.querySelector('input');
            if (input) {
                if (input.value === mode) {
                    l.style.background = '#2980b9';
                    l.style.fontWeight = 'bold';
                } else {
                    l.style.background = '#1b4f72';
                    l.style.fontWeight = 'normal';
                }
            }
        });
    }
    if (window.RoofInputController) window.RoofInputController.cancelDrawing(window.AppState);
};


/**
 * 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繝ｫ繝ｼ繝�
 */
function animationLoop() {
    // 驕ｸ謚樒憾諷九↑縺ｩ縲∝虚逧�↑謠冗判縺悟ｿ�ｦ√↑蝣ｴ蜷医↓螳溯｡�
    // 驕ｸ謚樒憾諷九↑縺ｩ縲∝虚逧↑謠冗判縺悟ｿｦ√↑蝣ｴ蜷医↓螳溯｡
    if (window.AppState.selectedElement || window.AppState.snapPoint || window.AppState.isDragging || window.getMode() === 'draw-area') {
        if (window.MainRenderer) window.MainRenderer.render(window.AppState);
    }
    requestAnimationFrame(animationLoop);
}

// DXF繝ｬ繧､繝､繝ｼ繝代ロ繝ｫ縺ｮ繝医げ繝ｫ

/**
 * 蝓ｺ遉弱Δ繝ｼ繝峨菴懷峙繧ｵ繝悶Δ繝ｼ繝牙繧頑崛縺
 */
function updateFdModeUI(mode) {
    if (window.AppState) {
        window.AppState.foundationMode = mode;
        const selector = document.getElementById('fd-mode-selector');
        if (selector) {
            const labels = selector.querySelectorAll('.fd-mode-label');
            labels.forEach(lbl => {
                const radio = lbl.querySelector('input[type="radio"]');
                if (radio && radio.value === mode) {
                    radio.checked = true;
                    lbl.style.background = '#6c3483';
                    lbl.style.fontWeight = 'bold';
                } else if (lbl) {
                    lbl.style.background = (radio && radio.value === 'f_delete') ? '#4a235a' : '#4a235a';
                    lbl.style.fontWeight = 'normal';
                }
            });
        }
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

window.setBeamPresetBtn = function(preset) {
    const btns = ['FG1', 'FG2', 'FG3'];
    btns.forEach(b => {
        const btn = document.getElementById('btn-preset-' + b.toLowerCase());
        if (btn) {
            if (b === preset) {
                btn.style.background = '#8e44ad';
                btn.style.color = '#fff';
                btn.style.borderColor = '#8e44ad';
            } else {
                btn.style.background = '#fff';
                btn.style.color = '#8e44ad';
                btn.style.borderColor = '#d2b4de';
            }
        }
    });
    window.applyBeamPreset(preset);
};

window.setSlabPresetBtn = function(preset) {
    const btns = ['FS1', 'FS2', 'FS3'];
    btns.forEach(b => {
        const btn = document.getElementById('btn-preset-' + b.toLowerCase());
        if (btn) {
            if (b === preset) {
                btn.style.background = '#8e44ad';
                btn.style.color = '#fff';
                btn.style.borderColor = '#8e44ad';
            } else {
                btn.style.background = '#fff';
                btn.style.color = '#8e44ad';
                btn.style.borderColor = '#d2b4de';
            }
        }
    });
    window.applySlabPreset(preset);
};

window.applyBeamPreset = function(preset) {
    const sym = document.getElementById('fd-beam-symbol');
    const w = document.getElementById('fd-beam-width');
    const h = document.getElementById('fd-beam-height');
    const tr = document.getElementById('fd-top-rebar');
    const br = document.getElementById('fd-bot-rebar');
    const st = document.getElementById('fd-stirrup');
    if (preset === 'FG1') {
        if(sym) sym.value = 'FG1';
        if(w) w.value = 150;
        if(h) h.value = 640;
        if(tr) tr.value = '1-D13';
        if(br) br.value = '1-D13';
        if(st) st.value = '1-D10@200';
    } else if (preset === 'FG2') {
        if(sym) sym.value = 'FG2';
        if(w) w.value = 150;
        if(h) h.value = 490;
        if(tr) tr.value = '1-D13';
        if(br) br.value = '1-D13';
        if(st) st.value = '1-D10@200';
    } else if (preset === 'FG3') {
        if(sym) sym.value = 'FG3';
        if(w) w.value = 150;
        if(h) h.value = 300;
        if(tr) tr.value = '1-D13';
        if(br) br.value = '1-D13';
        if(st) st.value = '1-D10@200';
    }
};

window.applySlabPreset = function(preset) {
    const sym = document.getElementById('fd-slab-symbol');
    const thick = document.getElementById('fd-slab-thickness');
    const th = document.getElementById('fd-slab-top-height');
    const stype = document.getElementById('fd-slab-short-type');
    const spitch = document.getElementById('fd-slab-short-pitch');
    const ltype = document.getElementById('fd-slab-long-type');
    const lpitch = document.getElementById('fd-slab-long-pitch');
    if (preset === 'FS1') {
        if(sym) sym.value = 'FS1';
        if(thick) thick.value = 150;
        if(th) th.value = 50;
        if(stype) stype.value = 'D13';
        if(spitch) spitch.value = 150;
        if(ltype) ltype.value = 'D13';
        if(lpitch) lpitch.value = 300;
    } else if (preset === 'FS2') {
        if(sym) sym.value = 'FS2';
        if(thick) thick.value = 150;
        if(th) th.value = 50;
        if(stype) stype.value = 'D10';
        if(spitch) spitch.value = 150;
        if(ltype) ltype.value = 'D10';
        if(lpitch) lpitch.value = 300;
    } else if (preset === 'FS3') {
        if(sym) sym.value = 'FS3';
        if(thick) thick.value = 120;
        if(th) th.value = 50;
        if(stype) stype.value = 'D10';
        if(spitch) spitch.value = 200;
        if(ltype) ltype.value = 'D10';
        if(lpitch) lpitch.value = 200;
    }
};
