/**
 * wall_4split_cad.js - Bridge between CadEngine and UI
 * v2.3.33 Refactoring - Restored missing DXF features
 */

function loadDxf(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const rawTxt = new TextDecoder('UTF-8').decode(ev.target.result);
            const dxfRaw = rawTxt.includes('\uFFFD') ? new TextDecoder('Shift_JIS').decode(ev.target.result) : rawTxt;
            
            const dxf = window.CadEngine.processDxf(dxfRaw);
            if (!dxf) {
                alert("❌ DXFの解析に失敗しました。ファイル形式を確認してください。");
                return;
            }

            // [Smart Reload] Check if existing data should be preserved
            let isIncremental = false;
            if (pillars && pillars.length > 0) {
                isIncremental = confirm("既存の柱や壁のデータを保持しますか？\n[OK] 保持して追加 / [キャンセル] 全消去して新規読込");
            }

            processDxfData(dxf, isIncremental, dxfRaw);
            
            // Show area input modal for floor area confirmation
            showAreaInputModal();

            let msgEl = document.getElementById('action-msg');
            if (msgEl) msgEl.innerText = "✅ 平面図DXFを読み込みました。";

        } catch (err) {
            console.error(err);
            alert("❌ DXF解析エラー: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function processDxfData(dxf, isIncremental, rawDxf) {
    const state = window.AppState;
    const result = window.CadEngine.mapEntitiesToBackground(dxf.entities, dxf.blocks, state);

    if (!isIncremental) {
        pillars = [];
        walls = [];
        windowsArr = [];
        areaLines = [];
    }

    // Merge or set background data
    bgLinesOriginal = result.newBgLines;
    bgTextsOriginal = result.newBgTexts;
    gridBubbles = result.newBubbles;
    
    // Merge extracted elements
    if (result.pillars) {
        pillars = [...pillars, ...result.pillars];
    }
    if (result.areaLines) {
        areaLines = [...areaLines, ...result.areaLines];
    }

    // Deduplicate pillars
    pillars = pillars.filter((p, index, self) =>
        index === self.findIndex((t) => Math.hypot(t.x - p.x, t.y - p.y) < 10)
    );

    // Update drawings container for PDF/Reports
    const docData = { entities: [...bgLinesOriginal, ...bgTextsOriginal], loaded: true, rawDxf: rawDxf };
    docDrawings.floor = docData;
    docDrawings.div4 = docData;
    if (!docDrawings.elev || !docDrawings.elev.loaded) {
        docDrawings.elev = docData;
    }

    if (typeof analyzeGrids === 'function') analyzeGrids();
    if (typeof initViewForce === 'function') initViewForce();
    
    AppController.refreshAll();
}

/**
 * 挿絵用 DXF 読込専用関数（メインデータを破壊しない）
 */
function loadSubDxf(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const rawTxt = new TextDecoder('UTF-8').decode(ev.target.result);
            const dxfRaw = rawTxt.includes('\uFFFD') ? new TextDecoder('Shift_JIS').decode(ev.target.result) : rawTxt;

            const dxf = window.CadEngine.processDxf(dxfRaw);
            if (!dxf) { alert('❌ 挿絵DXFの解析に失敗しました。'); return; }

            const result = window.CadEngine.mapEntitiesToBackground(dxf.entities, dxf.blocks, window.AppState);
            const extractedEnts = [...result.newBgLines, ...result.newBgTexts, ...result.newBubbles];
            
            docDrawings.elev = { entities: extractedEnts, loaded: true, rawDxf: dxfRaw };

            let msgEl = document.getElementById('action-msg');
            if (msgEl) msgEl.innerText = "✅ 挿絵用DXFを読み込みました。";

            // If the projected area modal is open, refresh preview
            if (typeof showAreaPreview === 'function') {
                showAreaPreview();
            }

        } catch (err) { alert("❌ 挿絵DXF解析エラー: " + err.message); }
    };
    reader.readAsArrayBuffer(file);
}

function showAreaInputModal() {
    let autoA = { '1F': 0, '2F': 0, 'RF': 0 };

    areaLines.forEach(a => {
        if (!a.vertices || a.vertices.length < 3) return;
        let area = 0;
        for (let i = 0; i < a.vertices.length; i++) {
            let j = (i + 1) % a.vertices.length;
            area += a.vertices[i].x * a.vertices[j].y;
            area -= a.vertices[j].x * a.vertices[i].y;
        }
        let finalAreaSqM = Math.abs(area / 2) / 1000000; 

        let f = a.floor;
        if (f === '1F') autoA['1F'] += finalAreaSqM;
        if (f === '2F') autoA['2F'] += finalAreaSqM;
        if (f === 'RF') autoA['RF'] += finalAreaSqM;
    });

    // Populate modal if fields are empty
    if (autoA['1F'] > 0) {
        let el = document.getElementById('aim-a-f1');
        if (el && (!el.value || el.value == "0" || el.value == "0.00")) el.value = autoA['1F'].toFixed(2);
    }
    const total2F = autoA['2F'] + autoA['RF'];
    if (total2F > 0) {
        let el = document.getElementById('aim-a-f2');
        if (el && (!el.value || el.value == "0" || el.value == "0.00")) el.value = total2F.toFixed(2);
    }

    const aiM = document.getElementById('modal-area-input');
    if (aiM) aiM.style.display = 'flex';
}

function applyAreaInputModal() {
    const ids = ['a-f1', 'a-attic1', 'a-balcony1', 'a-wx1', 'a-wy1', 'e-x-t1', 'e-x-b1', 'e-y-l1', 'e-y-r1',
        'a-f2', 'a-attic2', 'a-balcony2', 'a-wx2', 'a-wy2', 'e-x-t2', 'e-x-b2', 'e-y-l2', 'e-y-r2'];
    ids.forEach(id => {
        const modalEl = document.getElementById(`aim-${id}`);
        if (modalEl) {
            const v = modalEl.value;
            const mainEl = document.getElementById(id);
            if (v !== "" && mainEl) mainEl.value = v;
        }
    });
    document.getElementById('modal-area-input').style.display = 'none';
    if (window.AppController) window.AppController.refreshAll();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const dxfUp = document.getElementById('dxf-upload');
    if (dxfUp) dxfUp.addEventListener('change', loadDxf);

    const subUp = document.getElementById('upload-doc-sub');
    if (subUp) subUp.addEventListener('change', loadSubDxf);

    const btnApplyArea = document.getElementById('btn-apply-area-input');
    if (btnApplyArea) btnApplyArea.addEventListener('click', applyAreaInputModal);
});
