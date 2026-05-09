/**
 * logic/CadLogic.js - DXF Bridge
 * v2.3.13 Refactoring
 */

function loadDxf(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
        try {
            const rawTxt = new TextDecoder('UTF-8').decode(ev.target.result);
            window_currentDxfRaw = rawTxt.includes('\uFFFD') ? new TextDecoder('Shift_JIS').decode(ev.target.result) : rawTxt;

            const dxf = window.CadEngine.processDxf(window_currentDxfRaw);
            if (!dxf) return;

            if (window.pillars && window.pillars.length > 0) {
                if (confirm("既存の柱・壁データを保持して読み込みますか？\n[OK] 適合しないデータのみ整理\n[キャンセル] 全消去")) {
                    processDxfData(dxf, true);
                } else {
                    processDxfData(dxf, false);
                }
            } else {
                processDxfData(dxf, false);
            }
            
            if (window.GridEngine && window.GridEngine.analyzeGrids) {
                window.GridEngine.analyzeGrids(window.AppState);
            }
            if (window.AppController) window.AppController.refreshAll();

        } catch (err) {
            console.error("DXF Load Error:", err);
            alert("DXFの読み込みに失敗しました。ファイル形式を確認してください。");
        }
    };
    reader.readAsArrayBuffer(file);
}

function processDxfData(dxf, isIncremental) {
    if (!window.CadEngine || !window.CadEngine.mapEntitiesToBackground) return;

    const result = window.CadEngine.mapEntitiesToBackground(dxf.entities, dxf.blocks, window.AppState);
    
    bgLinesOriginal = result.newBgLines;
    bgTextsOriginal = result.newBgTexts;
    gridBubbles = result.newBubbles;

    if (!isIncremental) {
        pillars = [];
        walls = [];
        areaLines = [];
    }
    
    // 状態をAppStateへ同期
    if (window.AppState) {
        window.AppState.bgLinesOriginal = bgLinesOriginal;
        window.AppState.bgTextsOriginal = bgTextsOriginal;
        window.AppState.gridBubbles = gridBubbles;
        window.AppState.pillars = pillars;
        window.AppState.walls = walls;
        window.AppState.areaLines = areaLines;
    }
}
