// ==========================================
// main_v2.js - 繧ｰ繝ｭ繝ｼ繝舌Ν螟画焚繝ｻ繝ｦ繝ｼ繝・・ｽ・ｽ繝ｪ繝・・ｽ・ｽ繝ｻUI繧ｳ繝ｳ繝医Ο繝ｼ繝ｩ
// ==========================================

// 笘・螳壽焚繧ｨ繧､繝ｪ繧｢繧ｹ (AppConfig縺九ｉ)
const GRID_SNAP_TOL = window.AppConfig?.TOLERANCE?.GRID_SNAP || 150;
const MANUAL_GRID_TOL = window.AppConfig?.TOLERANCE?.MANUAL_GRID || 50;
const TEXT_GRID_TOL = window.AppConfig?.TOLERANCE?.TEXT_GRID || 1000;

// 笘・迥ｶ諷九お繧､繝ｪ繧｢繧ｹ (AppState縺九ｉ)
// 窶ｻ驟搾ｿｽE繝ｻ繧ｪ繝悶ず繧ｧ繧ｯ繝茨ｿｽE蜿ゑｿｽE貂｡縺暦ｿｽE縺溘ａ縲｝ush遲峨〒AppState譛ｬ菴薙ｂ譖ｴ譁ｰ縺輔ｌ縺ｾ縺吶・
// 窶ｻ繝励Μ繝溘ユ繧｣繝・謨ｰ蛟､繝ｻ譁・・ｽ・ｽ・ｽE繝ｻ逵溷⊃蛟､)縺ｯ縲√ヵ繧ｧ繝ｼ繧ｺ2縺ｧ `AppState.xxx = ` 縺ｸ縺ｮ荳諡ｬ鄂ｮ謠帙ｒ陦後＞縺ｾ縺吶・
// 笘・迥ｶ諷九ヶ繝ｪ繝・・ｽ・ｽ (AppState縺ｸ縺ｮ騾城℃逧・・ｽ・ｽ繧ｯ繧ｻ繧ｹ)
// 繝励Μ繝溘ユ繧｣繝門､縺ｮ繧ｳ繝費ｿｽE縺ｫ繧医ｋ荳肴紛蜷医ｒ髦ｲ縺舌◆繧√『indow繧ｪ繝悶ず繧ｧ繧ｯ繝茨ｿｽE繝励Ο繝代ユ繧｣縺ｨ縺励※螳夂ｾｩ縺励∪縺吶・
window.AppState = window.AppState || {};

const _propKeys = [
    'currentFloor', 'isPrintMode', 'reqWall', 'currentTotalVal', 'bgLinesOriginal', 'bgTextsOriginal',
    'gridBubbles', 'pillars', 'walls', 'windowsArr', 'historyStack', 'redoStack', 'areaLines',
    'gridXNames', 'gridYNames', 'gridXCoords', 'gridYCoords', 'userEditedGridX', 'userEditedGridY',
    'manualGridX', 'manualGridY', 'areaDrawPoints', 'deletedGridX', 'deletedGridY', 'scale', 'offsetX',
    'offsetY', 'isDragging', 'lastMouseX', 'lastMouseY', 'mouseX', 'mouseY', 'hoveredPillar',
    'selectedPillar', 'snapPoint', 'currentG', 'currentC', 'exteriorWallWeight', 'roofWeight',
    'solarWeight', 'ceilingInsWeight', 'wallInsWeight', 'elementVisibility', 'pIdCounter',
    'window_currentDxfRaw', 'docDrawings', 'canvas', 'ctx', 'currentAppMode', 'exteriorWalls',
    'foundationBeams', 'foundationSlabs', 'manholes', 'foundationMode', 'fdDrawPoints',
    'fdSelectedPillarLike', 'selectedFoundationBeam'
];

_propKeys.forEach(key => {
    Object.defineProperty(window, key, {
        get: () => window.AppState ? window.AppState[key] : undefined,
        set: (v) => { if (window.AppState) window.AppState[key] = v; },
        enumerable: true,
        configurable: true
    });
});

function handleModeChange() { selectedPillar = null; areaDrawPoints = []; snapPoint = null; hidePillarProps(); triggerUpdate(); }

// --- 蝓ｺ遉弱Δ繝ｼ繝蛾未騾｣縺ｮ謫堺ｽ懊ワ繝ｳ繝峨Λ縺ｯ controllers/FoundationController.js 縺ｫ遘ｻ陦後＆繧後∪縺励◆ ---

// 笘・蜍慕噪繝ｪ繧ｹ繝茨ｿｽEDOM逕滂ｿｽE髢｢謨ｰ (髱｢譚撰ｿｽE驥醍黄)
function addCustomWallRow(name = '', val = '') {
    let container = document.getElementById('custom-wall-container');
    if (!container) return;
    let div = document.createElement('div');
    div.className = 'calc-row cust-wall-row';
    div.style.marginBottom = '5px';
    div.innerHTML = `<input type="text" class="cust-w-n" placeholder="蜷咲ｧｰ" value="${name}" style="width:130px; margin:0;"><input type="number" class="cust-w-v" placeholder="蛟咲紫" step="0.1" value="${val}" style="width:60px; margin:0;"><button class="btn-del-item" style="background:#dc3545;color:#fff;border:none;border-radius:3px;cursor:pointer;padding:2px 5px;margin-left:5px;">笨・/button>`;
    div.querySelector('.btn-del-item').onclick = () => { div.remove(); triggerUpdate(); };
    div.querySelectorAll('input').forEach(i => i.addEventListener('input', triggerUpdate));
    container.appendChild(div);
}

function addCustomHwRow(name = '', val = '') {
    let container = document.getElementById('custom-hw-container');
    if (!container) return;
    let div = document.createElement('div');
    div.className = 'calc-row cust-hw-row';
    div.style.marginBottom = '5px';
    div.innerHTML = `<input type="text" class="cust-h-n" placeholder="險伜捷" value="${name}" style="width:130px; margin:0;"><input type="number" class="cust-h-v" placeholder="閠仙鴨(kN)" step="0.1" value="${val}" style="width:60px; margin:0;"><button class="btn-del-item" style="background:#dc3545;color:#fff;border:none;border-radius:3px;cursor:pointer;padding:2px 5px;margin-left:5px;">笨・/button>`;
    div.querySelector('.btn-del-item').onclick = () => { div.remove(); triggerUpdate(); };
    div.querySelectorAll('input').forEach(i => i.addEventListener('input', triggerUpdate));
    container.appendChild(div);
}

// 笘・螻･豁ｴ邂｡逅・
// pushHistory moved


function setFloor(floor) {
    // [UI謾ｹ菫ｮ 蝓ｺ遉弱ち繝也ｧｻ蜍評 髫趣ｿｽE繧頑崛縺域凾縺ｯ螢・・ｽ・ｽ繝｢繝ｼ繝峨∈遘ｻ陦・
    if ((window.AppState ? window.AppState.currentAppMode : 'wall') !== 'wall') {
        if (typeof window.switchAppMode === 'function') window.switchAppMode('wall');
    }

    currentFloor = floor;
    let t1 = document.getElementById('tab-1f'); if (t1) t1.className = (floor === '1F' && (window.AppState ? window.AppState.currentAppMode : 'wall') === 'wall') ? 'tab-btn active' : 'tab-btn';
    let t2 = document.getElementById('tab-2f'); if (t2) t2.className = (floor === '2F' && (window.AppState ? window.AppState.currentAppMode : 'wall') === 'wall') ? 'tab-btn active' : 'tab-btn';
    
    // 蝓ｺ遉弱ち繝厄ｿｽE豸茨ｿｽE
    let tf = document.getElementById('tab-fd'); if (tf) tf.className = 'tab-btn';

    selectedPillar = null; areaDrawPoints = []; hidePillarProps();
    analyzeGrids();
    initViewForce();
    triggerUpdate();
}




function loadData(event) {
    let f = event.target.files[0]; if (!f) return;
    let msg = document.getElementById('action-msg'); let reader = new FileReader();
    reader.onload = function (ev) {
        try {
            let d = JSON.parse(ev.target.result);
            if (d.inputs) { for (let id in d.inputs) { let el = document.getElementById(id); if (el) el.value = d.inputs[id]; } }
            pillars = d.pillars || []; bgTextsOriginal = d.texts || []; pIdCounter = d.pIdCounter || 1000;
            walls = d.walls || []; windowsArr = d.windowsArr || d.windows || [];
            bgLinesOriginal = d.bgLines || []; areaLines = d.areaLines || [];
            gridBubbles = d.gridBubbles || []; manualGridX = d.mgX || []; manualGridY = d.mgY || [];
            gridXNames = d.gx || []; gridYNames = d.gy || []; gridXCoords = d.gxc || []; gridYCoords = d.gyc || [];
            window.userEditedGridX = d.ueGX || {}; window.userEditedGridY = d.ueGY || {};
            deletedGridX = d.deletedGX || []; deletedGridY = d.deletedGY || []; // 笘・隱ｲ鬘・・ｽE・ｽ繝悶Λ繝・・ｽ・ｽ繝ｪ繧ｹ繝亥ｾｩ蜈・

            // [繝舌げ菫ｮ豁｣ 蝓ｺ遉弱ョ繝ｼ繧ｿ縺ｮ繧ｻ繝ｼ繝厄ｿｽE繝ｭ繝ｼ繝牙ｯｾ蠢彎 蝓ｺ遉弱Δ繝ｼ繝峨ョ繝ｼ繧ｿ縺ｮ蠕ｩ蜈・・ｽ・ｽ遨ｺ驟搾ｿｽE繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
            if (window.AppState) {
                window.AppState.foundationSlabs = d.foundationSlabs || [];
                window.AppState.exteriorWalls = d.exteriorWalls || [];
                window.AppState.foundationBeams = d.foundationBeams || [];
                window.AppState.manholes = d.manholes || [];
                window.AppState.concreteFc = d.concreteFc || 21;
                window.AppState.averageGroundPressure = d.averageGroundPressure || 0;
                window.AppState.diagonalGrids = d.diagonalGrids || [];
                if (typeof window.rebuildDiagonalNodes === 'function') window.rebuildDiagonalNodes();
            }


            // 笘・隱ｲ鬘・: 繝ｬ繧､繝､陦ｨ遉ｺ險ｭ螳壹ｒ蠕ｩ蜈・・ｽ・ｽ縲√ヱ繝阪ΝUI繧呈峩譁ｰ
            if (d.layerVisibility) {
                layerVisibility = d.layerVisibility;
            }

            // 笘・繝舌げ菫ｮ豁｣: bgLines/bgTexts蜈ｨ隕∫ｴ繧定ｵｰ譟ｻ縺励※layerVisibility繧抵ｿｽE讒狗ｯ・
            // JSON縺ｫ菫晏ｭ倥＆繧後※縺・・ｽ・ｽ縺・・ｽ・ｽ繧､繝､繧・・ｽ・ｽlayer縺梧悴螳夂ｾｩ縺ｮ隕∫ｴ繧ゅ％縺薙〒陬懷ｮ後☆繧・
            bgLinesOriginal.forEach(e => {
                if (!e.layer) e.layer = 'BG_UNASSIGNED'; // 繝ｬ繧､繝､蜷阪′縺ｪ縺・・ｽ・ｽ蜷茨ｿｽE繝・・ｽ・ｽ繧ｩ繝ｫ繝井ｻ倅ｸ・
                if (!(e.layer in layerVisibility)) layerVisibility[e.layer] = true;
            });
            bgTextsOriginal.forEach(t => {
                if (!t.layer) t.layer = 'BG_UNASSIGNED';
                if (!(t.layer in layerVisibility)) layerVisibility[t.layer] = true;
            });

            // 笘・繝代ロ繝ｫ繧呈怙譁ｰ縺ｮlayerVisibility縺ｧ蜀肴緒逕ｻ
            if (typeof renderLayerPanel === 'function') renderLayerPanel();

            // 笘・霑ｽ蜉: JSON蠕ｩ蜈・・ｽ・ｽ・ｽE繧ｭ繝｣繝ｳ繝舌せ謠冗判縺ｨUI蜷梧悄繧堤｢ｺ螳溘↓陦後≧
            setTimeout(() => {
                if (typeof renderLayerPanel === 'function') renderLayerPanel();
                triggerUpdate();
            }, 100);

            // 笘・繝代ャ繝・・ｽ・ｽ逕ｨ: JSON縺ｮ螢√ョ繝ｼ繧ｿ縺ｫfloor螻樊ｧ縺後↑縺代ｌ縺ｰ1F繧剃ｻ倅ｸ趣ｼ磯℃蜴ｻ繝・・ｽE繧ｿ謨第ｸ茨ｼ・
            walls.forEach(w => {
                w.p1 = pillars.find(p => p.id === w.p1.id) || w.p1;
                w.p2 = pillars.find(p => p.id === w.p2.id) || w.p2;
                if (!w.floor) w.floor = w.p1.floor || '1F';
            });
            windowsArr.forEach(w => {
                w.p1 = pillars.find(p => p.id === w.p1.id) || w.p1;
                w.p2 = pillars.find(p => p.id === w.p2.id) || w.p2;
                if (!w.floor) w.floor = w.p1.floor || '1F';
            });

            // 蜍慕噪繝ｪ繧ｹ繝茨ｿｽE蠕ｩ蜈・
            let cwc = document.getElementById('custom-wall-container');
            if (cwc) {
                cwc.innerHTML = '';
                if (d.customWalls && d.customWalls.length > 0) d.customWalls.forEach(cw => addCustomWallRow(cw.n, cw.v));
                else addCustomWallRow();
            }
            let chc = document.getElementById('custom-hw-container');
            if (chc) {
                chc.innerHTML = '';
                if (d.customHws && d.customHws.length > 0) d.customHws.forEach(ch => addCustomHwRow(ch.n, ch.v));
                else addCustomHwRow();
            }

            if (d.dxfRaw) window_currentDxfRaw = d.dxfRaw;

            // 笘・霑ｽ蜉: 譁ｰ譁ｹ蠑擾ｿｽE逕櫂XF繝・・ｽ・ｽ繧ｹ繝医°繧会ｿｽE docDrawings 蠕ｩ蜈・
            if (d.docDrawingsRaw) {
                const p = new window.DxfParser();
                if (d.docDrawingsRaw.floor) {
                    let res = p.parseSync(d.docDrawingsRaw.floor);
                    if (res && res.entities) docDrawings.floor = { entities: res.entities, loaded: true, rawDxf: d.docDrawingsRaw.floor };
                }
                if (d.docDrawingsRaw.elev) {
                    let res = p.parseSync(d.docDrawingsRaw.elev);
                    if (res && res.entities) docDrawings.elev = { entities: res.entities, loaded: true, rawDxf: d.docDrawingsRaw.elev };
                }
                if (d.docDrawingsRaw.div4) {
                    let res = p.parseSync(d.docDrawingsRaw.div4);
                    if (res && res.entities) docDrawings.div4 = { entities: res.entities, loaded: true, rawDxf: d.docDrawingsRaw.div4 };
                }
            } else if (d.docDxf) {
                const p = new window.DxfParser();
                if (d.docDxf.floor) { let res = p.parseSync(d.docDxf.floor); if (res && res.entities) { docDrawings.floor.rawDxf = d.docDxf.floor; docDrawings.floor.entities = res.entities; docDrawings.floor.loaded = true; } }
                if (d.docDxf.elev) { let res = p.parseSync(d.docDxf.elev); if (res && res.entities) { docDrawings.elev.rawDxf = d.docDxf.elev; docDrawings.elev.entities = res.entities; docDrawings.elev.loaded = true; } }
                if (d.docDxf.div4) { let res = p.parseSync(d.docDxf.div4); if (res && res.entities) { docDrawings.div4.rawDxf = d.docDxf.div4; docDrawings.div4.entities = res.entities; docDrawings.div4.loaded = true; } }
            } else if (bgLinesOriginal.length > 0) {
                // JSON縺ｫdocDxf繝励Ο繝代ユ繧｣縺悟性縺ｾ繧後※縺・・ｽ・ｽ縺・・ｽ・ｽ蜷医∝ｾｩ蜈・・ｽ・ｽ縺溯レ譎ｯ邱壹°繧牙ｸｳ逾ｨ逕ｨ縺ｮ莉ｮ諠ｳDXF繧抵ｿｽE讒狗ｯ峨☆繧具ｼ域諺邨ｵ陦ｨ遉ｺ繝舌げ縺ｮ菫ｮ豁｣・ｽE・ｽE
                const virtualEntities = bgLinesOriginal.map(l => {
                    let e = { type: l.type };
                    if (l.type === 'LINE' && l.vertices) { e.start = l.vertices[0]; e.end = l.vertices[1]; }
                    else if (['LWPOLYLINE', 'POLYLINE'].includes(l.type)) { e.vertices = l.vertices; }
                    else if (['CIRCLE', 'ARC'].includes(l.type)) { e.center = l.center; e.radius = l.radius; e.startAngle = l.startAngle || 0; e.endAngle = l.endAngle || 360; }
                    return e;
                });
                const docData = { entities: virtualEntities, loaded: true, rawDxf: '' };
                docDrawings.floor = docData; docDrawings.elev = docData; docDrawings.div4 = docData;
            }

            resizeCanvas(); analyzeGrids(); initViewForce(); triggerUpdate();

            // 笘・JSON蠕ｩ蜈・・ｽ・ｽ蠕後↓蜷・・ｽ・ｽ蜀崎ｨ育ｮ励→繝ｬ繝晢ｿｽE繝域緒逕ｻ繧貞ｼｷ蛻ｶ繝医Μ繧ｬ繝ｼ縺輔○繧具ｼ亥ｺ企擇遨阪ｄ蛻､螳夂ｭ会ｿｽE陦ｨ遉ｺ逕ｨ・ｽE・ｽE
            if (typeof updateCalculations === 'function') updateCalculations();
            if (typeof updateReport === 'function') updateReport();

            alert("繝・・繧ｿ繧貞ｾｩ蜈・＠縺ｾ縺励◆縲・n險育ｮ玲嶌逕ｨ縺ｮ謖ｿ邨ｵ縺ｯ閭梧勹蝗ｳ蠖｢縺九ｉ蜀肴ｧ狗ｯ峨＆繧後∪縺励◆縲・);
            if (msg) msg.innerText = "唐 繝・・繧ｿ繧貞ｾｩ蜈・＠縺ｾ縺励◆縲・;
        } catch (err) { alert("JSON蠕ｩ蜈・お繝ｩ繝ｼ \n" + err.message); }
    };
    reader.readAsText(f);
    event.target.value = '';
}









async function checkPermissionAndGenerate(e) {
    // 検 霑ｽ險・ 繝ｭ繝ｼ繧ｫ繝ｫ迺ｰ蠅・・ｽ・ｽE27.0.0.1 縺ｾ縺滂ｿｽE localhost・ｽE・ｽ縺ｪ繧陰PI繝√ぉ繝・・ｽ・ｽ繧偵せ繧ｭ繝・・ｽE
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.hostname === '';
    if (isLocal) {
console.log("屏・・繝・せ繝育腸蠅・・縺溘ａ縲∬ｪｲ驥第ｨｩ髯舌メ繧ｧ繝・け繧偵せ繧ｭ繝・・縺励∪縺吶・);
        // API縺鯉ｿｽE蜉溘＠縺溘→縺ｿ縺ｪ縺励※縲∵悽譚･縺ｮ譖ｸ鬘樒函謌撰ｿｽE逅・・ｽ・ｽ逶ｴ謗･蜻ｼ縺ｳ蜃ｺ縺・
        generateDoc();
        return; 
    }

    try {
        // 繝舌ャ繧ｯ繧ｨ繝ｳ繝会ｿｽE讓ｩ髯舌メ繧ｧ繝・・ｽ・ｽAPI繧貞娼縺・
        const response = await fetch('../../api/permissions', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        // 譛ｪ繝ｭ繧ｰ繧､繝ｳ縺ｮ蝣ｴ蜷・
        if (response.status === 401) {
            alert("繧ｻ繝・す繝ｧ繝ｳ縺悟・繧後∪縺励◆縲ょ・蠎ｦ繝ｭ繧ｰ繧､繝ｳ縺励※縺上□縺輔＞縲・);
            window.location.href = '../../login';
            return;
        }

        if (!response.ok) {
            throw new Error("API騾壻ｿ｡繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・);
        }

        const result = await response.json();
        const data = result.data;

        // 繧ｵ繝悶せ繧ｯ讓ｩ髯舌メ繧ｧ繝・・ｽ・ｽ
        if (!data.is_subscribed) {
            const msg = "縺薙・讖溯・繧貞茜逕ｨ縺吶ｋ縺ｫ縺ｯ縲√し繝悶せ繧ｯ繝ｪ繝励す繝ｧ繝ｳ縺ｸ縺ｮ蜉蜈･縺悟ｿ・ｦ√〒縺吶・n" +
                        "繝励Λ繝ｳ螟画峩逕ｻ髱｢縺ｸ遘ｻ蜍輔＠縺ｾ縺吶°・歃n" +
                        "騾壼ｸｸ縺ｮ險育ｮ玲ｩ溯・縺ｮ蛻ｩ逕ｨ繧・ｿ晏ｭ倥・蜿ｯ閭ｽ縺ｧ縺吶・;
            if (confirm(msg)) {
                window.location.href = '../../subscribe';
            }
            return;
        }
        // 蜈ｨ縺ｦ縺ｮ讓ｩ髯舌け繝ｪ繧｢・ｽE・ｽ譌｢蟄假ｿｽEPDF逕滂ｿｽE蜃ｦ逅・・ｽ・ｽ髢句ｧ・
        generateDoc();

    } catch (error) {
        console.error('讓ｩ髯舌メ繧ｧ繝・・ｽ・ｽ縺ｫ螟ｱ謨励＠縺ｾ縺励◆:', error);
        alert('繧ｷ繧ｹ繝・Β繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲よ凾髢薙ｒ縺翫＞縺ｦ蜀榊ｺｦ縺願ｩｦ縺励￥縺縺輔＞縲・);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.mainInitialized) return;
    window.mainInitialized = true;
    try {
        // 笘・Fix4: DOM隱ｭ縺ｿ霎ｼ縺ｿ螳御ｺ・・ｽ・ｽ縺ｫ canvas 繧ｳ繝ｳ繝・・ｽ・ｽ繧ｹ繝医ｒ螳会ｿｽE縺ｫ蜿門ｾ・
        canvas = document.getElementById('cad-canvas');
        ctx = canvas ? canvas.getContext('2d') : null;

        document.querySelectorAll('input:not([type="file"]), select').forEach(el => {
            if (el.name !== 'mode' && el.id !== 'show-4div') el.addEventListener('input', triggerUpdate);
        });

        // [讖滂ｿｽE謾ｹ蝟・螟門｣∽ｻ墓ｧ倩ｿｽ蜉] 螟門｣∽ｻ墓ｧ假ｿｽE繝ｫ繝繧ｦ繝ｳ縺ｮ螟画峩繧､繝吶Φ繝・
        let extWallSel = document.getElementById('prop-ext-wall');
        if (extWallSel) {
            extWallSel.addEventListener('change', (e) => {
                exteriorWallWeight = parseFloat(e.target.value);
                triggerUpdate();
            });
        }

        // [讖滂ｿｽE謾ｹ蝟・闕ｷ驥堺ｻ墓ｧ俶僑蜈・ 闕ｷ驥堺ｻ墓ｧ假ｿｽE螟画峩繧､繝吶Φ繝・
        const bindState = (id, propVar) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    window[propVar] = parseFloat(e.target.value);
                    triggerUpdate();
                });
            }
        };

        bindState('prop-roof-type', 'roofWeight');
        bindState('prop-solar', 'solarWeight');
        bindState('prop-ceiling-ins', 'ceilingInsWeight');
        // [讖滂ｿｽE謾ｹ蝟・UI謨ｴ逅・・ｽ・ｽ譁ｭ辭ｱ譚占ｪｿ謨ｴ] 逶ｴ謗･蜈･蜉帙↓螟画峩
        bindState('prop-wall-ins', 'wallInsWeight');

        // [讖滂ｿｽE陬懷ｮ・譛邨りｪｿ謨ｴ] 荳芽ｧ貞ｽ｢迥ｶ蜑ｲ蠅嶺ｿよ焚
        const triMultEl = document.getElementById('prop-tri-mult');
        if (triMultEl) {
            triMultEl.addEventListener('change', (e) => {
                window.AppState.triangleMultiplier = parseFloat(e.target.value) || 1.0;
                triggerUpdate();
            });
        }

        // [讖滂ｿｽE謾ｹ蝟・隕∫ｴ繝ｬ繧､繝､蛻・・ｽ・ｽ] 陦ｨ遉ｺ蛻・・ｽ・ｽ繧､繝吶Φ繝・
        const bindLayerToggle = (id, key) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    elementVisibility[key] = e.target.checked;
                    triggerUpdate();
                });
            }
        };
        bindLayerToggle('v-layer-grids', 'grids');
        bindLayerToggle('v-layer-pillars', 'pillars');
        bindLayerToggle('v-layer-pillarNValues', 'pillarNValues');
        bindLayerToggle('vis-wall', 'walls'); // [讖滂ｿｽE謾ｹ蝟・蝓ｺ遉弱Δ繝ｼ繝会ｿｽE譛溯ｨｭ螳咯 ID螟画峩
        bindLayerToggle('v-layer-windows', 'windows');
        bindLayerToggle('vis-diaph', 'areas'); // [讖滂ｿｽE謾ｹ蝟・蝓ｺ遉弱Δ繝ｼ繝会ｿｽE譛溯ｨｭ螳咯 ID螟画峩
        bindLayerToggle('v-layer-f_beams', 'f_beams');
        bindLayerToggle('v-layer-f_slabs', 'f_slabs');
        bindLayerToggle('v-layer-f_ext_walls', 'f_ext_walls');
        bindLayerToggle('v-layer-f_manholes', 'f_manholes');

        // [讖滂ｿｽE諡｡蠑ｵ 繧ｹ繝ｩ繝冶ｨｭ險域擅莉ｶ縺ｨ閾ｪ蜍募愛螳咯 蜈ｨ菴楢ｨｭ險域擅莉ｶ縺ｮ繝舌う繝ｳ繝・
        const fcEl = document.getElementById('global-fc');
        if (fcEl) {
            fcEl.addEventListener('change', (e) => {
                window.AppState.concreteFc = parseInt(e.target.value, 10) || 21;
                triggerUpdate();
            });
        }
        
        // [讖滂ｿｽE霑ｽ蜉 荳芽ｧ貞ｽ｢迥ｶ蜑ｲ蠅励＠縺ｮ蜈ｨ菴楢ｨｭ螳壼喧] 
        const tmEl = document.getElementById('global-triangle-mult');
        if (tmEl) {
            tmEl.addEventListener('input', (e) => {
                window.AppState.triangleMultiplier = parseFloat(e.target.value) || 1.33;
                if (typeof updateCalculations === 'function') updateCalculations();
                if (typeof triggerUpdate === 'function') triggerUpdate();
            });
        }
        
        // [讖滂ｿｽE霑ｽ蜉 遶矩擇霆ｸ蜉帛峙繝薙Η繝ｼ繧｢] 襍ｷ蜍包ｿｽE繧ｿ繝ｳ縺ｮ繝舌う繝ｳ繝・
        const btnElView = document.getElementById('btn-elevation-viewer');
        if (btnElView) {
            btnElView.addEventListener('click', () => {
                if (window.openElevationViewer) window.openElevationViewer();
            });
        }

        document.querySelectorAll('input[name="mode"]').forEach(el => { el.addEventListener('change', handleModeChange); });
        let show4 = document.getElementById('show-4div'); if (show4) show4.addEventListener('change', () => { requestAnimationFrame(draw); });

        const bC = (id, fn) => { let el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
        bC('btn-gen-doc', checkPermissionAndGenerate);
        bC('btn-show-ratio', window.AppExport.showRatioModal);
        bC('btn-show-center', () => { if (typeof window.showCenterCalc === 'function') window.showCenterCalc(); }); bC('btn-show-area', () => { if (typeof window.showAreaPreview === 'function') window.showAreaPreview(); });
        bC('btn-export-csv', window.AppExport.exportCSV); 
        bC('btn-export-dxf', window.AppExport.exportDXF);
        bC('btn-save', window.AppExport.saveData); bC('btn-undo', () => { if (typeof window.undoLastAction === 'function') window.undoLastAction(); }); bC('btn-redo', () => { if (typeof window.redoLastAction === 'function') window.redoLastAction(); });
        bC('btn-toggle-layer', () => {
            const panel = document.getElementById('dxf-layer-panel');
            if (!panel) { if (typeof renderLayerPanel === 'function') renderLayerPanel(); return; }
            panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
        });

        // [UI謾ｹ菫ｮ 蝓ｺ遉弱ち繝也ｧｻ蜍評 繧ｿ繝悶う繝吶Φ繝郁ｨｭ螳・
        bC('tab-fd', () => { if (typeof window.switchAppMode === 'function') window.switchAppMode('foundation'); });
        bC('tab-foundation', () => { if (typeof window.switchAppMode === 'function') window.switchAppMode('foundation'); });
        bC('tab-1f', () => setFloor('1F'));
        bC('tab-2f', () => setFloor('2F'));

        // [蝓ｺ遉散I謾ｹ蝟・繧ｿ繧ｹ繧ｯ1] 繝昴ャ繝励い繝・・ｽE閭梧勹繧ｯ繝ｪ繝・・ｽ・ｽ縺ｧ髢峨§繧具ｼ井ｻｻ諢擾ｼ・
        canvas.addEventListener('mousedown', (e) => {
            if ((window.AppState ? window.AppState.currentAppMode : 'wall') === 'foundation' && (window.AppState ? window.AppState.foundationMode : 'f_beam') !== 'f_select') {
                // 繧ｻ繝ｬ繧ｯ繝医Δ繝ｼ繝我ｻ･螟悶〒繧ｯ繝ｪ繝・・ｽ・ｽ縺励◆髫帙∽ｸ譎ら噪縺ｪ繝昴ャ繝励い繝・・ｽE縺ｯ髢峨§繧具ｿｽE縺御ｸ闊ｬ逧・
                // 縺溘□縺励∽ｽ懷峙繧帝が鬲斐＠縺ｪ縺・・ｽ・ｽ縺・・ｽ・ｽ豕ｨ諢・
            }
        });

        bC('btn-add-cust-wall', () => addCustomWallRow());
        bC('btn-add-cust-hw', () => addCustomHwRow());

        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', function () { this.closest('.modal-overlay').style.display = 'none'; });
        });

        const bF = (id, fn) => {
            let el = document.getElementById(id);
            if (el) { el.addEventListener('click', e => { e.target.value = ''; }); el.addEventListener('change', fn); }
        };
        bF('json-upload', loadData);
        bF('dxf-upload', loadDxf);
        bF('upload-doc-sub', loadSubDxf); // 謖ｿ邨ｵ蟆ら畑髢｢謨ｰ縺ｫ螟画峩・ｽE・ｽ繝・・繧ｿ遐ｴ螢翫ｒ髦ｲ豁｢・ｽE・ｽE

        if (canvas) {
            if (window.initViewportController) window.initViewportController(canvas);

            if (window.initCanvasInputController) window.initCanvasInputController(canvas);
        }
    } catch (e) { console.error('Initialize error:', e); } });

// 笘・繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ蟆ら畑繝ｫ繝ｼ繝・(繝代Ν繧ｹ陦ｨ遉ｺ逕ｨ)
// draw() 蜀・・ｽ・ｽ繧・requestAnimationFrame 繧呈賜髯､縺励◆縺溘ａ縲√％縺薙〒邂｡逅・・ｽ・ｽ縺ｾ縺吶・
function animationLoop() {
    if (window.selectedPillar && !window.isPrintMode) {
        if (typeof draw === 'function') draw();
    }
    requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

// ==========================================
// [讖滂ｿｽE霑ｽ蜉 遶矩擇霆ｸ蜉帛峙繝薙Η繝ｼ繧｢] 蛻ｶ蠕｡繝ｭ繧ｸ繝・・ｽ・ｽ
// ==========================================
let currentElevationAxis = "";

window.openElevationViewer = function() {
    const axes = window.getAxesToReport ? window.getAxesToReport() : [];
    const tabCont = document.getElementById('elevation-axis-tabs');
    if (!tabCont) return;
    
    tabCont.innerHTML = "";
    axes.forEach((axis, idx) => {
        const btn = document.createElement('button');
        btn.innerText = axis;
        btn.style.cssText = "padding:6px 15px; border:1px solid #bdc3c7; border-bottom:none; background:#ecf0f1; cursor:pointer; font-size:12px; border-radius:4px 4px 0 0; margin-right:2px; white-space:nowrap;";
        btn.onclick = () => window.selectElevationAxis(axis, btn);
        tabCont.appendChild(btn);
        if (idx === 0) window.selectElevationAxis(axis, btn);
    });
    
    const modal = document.getElementById('modal-elevation-viewer');
    if (modal) {
        modal.style.display = 'flex';
        window.updateElevationViewer();
    }
};

window.selectElevationAxis = function(axis, btn) {
    currentElevationAxis = axis;
    const tabs = document.querySelectorAll('#elevation-axis-tabs button');
    tabs.forEach(t => {
        t.style.background = "#ecf0f1";
        t.style.fontWeight = "normal";
        t.style.borderBottom = "1px solid #bdc3c7";
    });
    btn.style.background = "#fff";
    btn.style.fontWeight = "bold";
    btn.style.borderBottom = "1px solid #fff";
    window.updateElevationViewer();
};

window.updateElevationViewer = function() {
    const container = document.getElementById('elevation-svg-container');
    if (!container || !currentElevationAxis) return;
    
    // 蜉蜉帶婿蜷托ｿｽE蜿門ｾ・
    const dirEl = document.querySelector('input[name="el-dir"]:checked');
    const dir = dirEl ? dirEl.value : 'left';
    
    if (window.generateEnlargedAxialDiagramSvg) {
        // SVG縺ｮ逕滂ｿｽE縺ｨ豬√＠霎ｼ縺ｿ
        container.innerHTML = window.generateEnlargedAxialDiagramSvg(currentElevationAxis, dir);
    } else {
        container.innerHTML = "<div style='padding:20px; color:red;'>繧ｨ繝ｩ繝ｼ: SVG逕滂ｿｽE髢｢謨ｰ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ縲・/div>";
    }
};

// [讖滂ｿｽE霑ｽ蜉 螻ｱ蝣ｴStep1: 繧ｹ繝代Φ蛻･繝励Ο繝代ユ繧｣縺ｨ繝ｬ繝晢ｿｽE繝域棧] 騾壹ｊ蛻･ 險育ｮ玲嶌繝励Ξ繝薙Η繝ｼ 繝｢繝ｼ繝繝ｫ縺ｮ螳溯｣・
window.showFoundationBeamReportModal = function(beam) {
    if (!beam) return;
    const oldModal = document.getElementById('fd-beam-report-modal');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fd-beam-report-modal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;backdrop-filter:blur(5px);';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:#fff;width:90vw;height:90vh;border-radius:12px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.5);';

    const header = document.createElement('div');
    header.style.cssText = 'padding:15px 25px;background:#2c3e50;color:#fff;display:flex;justify-content:space-between;align-items:center;';

    const title = document.createElement('h3');
    title.style.cssText = 'margin:0;font-size:18px;';
    title.textContent = '\u57fa\u790e\u6881 \u8a08\u7b97\u66f8\u30d7\u30ec\u30d3\u30e5\u30fc - ' + beam.id + ' (\u901a\u308a\u63a5\u7d9a)';

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:#e74c3c;color:#fff;border:none;padding:8px 15px;border-radius:4px;cursor:pointer;font-weight:bold;';
    closeBtn.textContent = '\u9589\u3058\u308b';
    closeBtn.onclick = function() { overlay.remove(); };

    header.appendChild(title);
    header.appendChild(closeBtn);

    const content = document.createElement('div');
    content.style.cssText = 'flex:1;overflow-y:auto;padding:30px;background:#fdfdfd;';

    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '1000px';
    wrapper.style.margin = '0 auto';

    const titleBar = document.createElement('div');
    titleBar.style.cssText = 'margin-bottom:30px;border-bottom:2px solid #34495e;padding-bottom:10px;';

    const mainTitle = document.createElement('div');
    mainTitle.style.cssText = 'font-size:24px;font-weight:bold;color:#2c3e50;';
    mainTitle.textContent = '\u57fa\u790e\u6881 \u65ad\u9762\u691c\u5b9a\u8a73\u7d30 (\u901a\u308a\u5225\u7d71\u5408\u30ec\u30dd\u30fc\u30c8)';

    const subTitle = document.createElement('div');
    subTitle.style.cssText = 'color:#7f8c8d;font-size:14px;margin-top:5px;';
    subTitle.textContent = 'ID: ' + beam.id + ' | \u901a\u308a\u540d: ' + (beam.props && beam.props.name ? beam.props.name : '\u672a\u8a2d\u5b9a');

    titleBar.appendChild(mainTitle);
    titleBar.appendChild(subTitle);

    const reportDiv = document.createElement('div');
    reportDiv.innerHTML = generateContinuousBeamReportHtml(beam);

    wrapper.appendChild(titleBar);
    wrapper.appendChild(reportDiv);
    content.appendChild(wrapper);

    modal.appendChild(header);
    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const escHandler = function(e) {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);
};



