/**
 * MainController.js
 * アプリケーションモードの切り替え、階層管理、基本UIイベントの制御
 */

import { AppState } from '../state/AppState.js';
import { hideFdPropertyPopup } from '../view/UIFoundationPopup.js';
import { mapJsonToAppState } from '../logic/Parsers.js';

/**
 * 階層の切り替え
 */
export function setFloor(floor) {
    if (AppState.currentAppMode !== 'wall') {
        switchAppMode('wall');
    }

    AppState.currentFloor = floor;
    
    // UIのハイライト更新
    const tf = document.getElementById('tab-fd'); if (tf) tf.className = 'tab-btn';
    const t1 = document.getElementById('tab-1f'); if (t1) t1.className = (floor === '1F') ? 'tab-btn active' : 'tab-btn';
    const t2 = document.getElementById('tab-2f'); if (t2) t2.className = (floor === '2F') ? 'tab-btn active' : 'tab-btn';

    // 選択状態のリセット
    AppState.selectedPillar = null;
    AppState.areaDrawPoints = [];
    
    // 他のモジュール（Grid分析等）の呼び出しが必要な場合はグローバル経由またはインポートで
    if (typeof window.analyzeGrids === 'function') window.analyzeGrids();
    if (typeof window.triggerUpdate === 'function') window.triggerUpdate();
}

/**
 * アプリケーションモードの切り替え ('wall' | 'foundation')
 */
export function switchAppMode(mode) {
    AppState.currentAppMode = mode;

    // パネル表示の切り替え
    const wallPanel = document.getElementById('wall-mode-panel');
    const foundPanel = document.getElementById('foundation-mode-panel');
    if (wallPanel)  wallPanel.style.display  = (mode === 'wall')       ? '' : 'none';
    if (foundPanel) foundPanel.style.display = (mode === 'foundation') ? '' : 'none';

    const elCtrl = document.getElementById('elevation-viewer-ctrl');
    if (elCtrl) elCtrl.style.display = (mode === 'foundation') ? 'block' : 'none';

    // ポップアップを閉じる
    hideFdPropertyPopup();
    if (typeof window.hidePillarProps === 'function') window.hidePillarProps();

    // タブのハイライト更新
    const tf = document.getElementById('tab-fd');
    const t1 = document.getElementById('tab-1f');
    const t2 = document.getElementById('tab-2f');

    if (mode === 'foundation') {
        if (tf) tf.className = 'tab-btn active';
        if (t1) t1.className = 'tab-btn';
        if (t2) t2.className = 'tab-btn';

        // 基礎モード初期設定
        AppState.elementVisibility.walls = false;
        AppState.elementVisibility.areas = false;
        const visWall = document.getElementById('vis-wall'); if (visWall) visWall.checked = false;
        const visDiaph = document.getElementById('vis-diaph'); if (visDiaph) visDiaph.checked = false;

        // 操作ツールをN値モードへ
        const nValueTool = document.querySelector('input[name="mode"][value="n-value"]');
        if (nValueTool) {
            nValueTool.checked = true;
            if (typeof window.handleModeChange === 'function') window.handleModeChange();
        }
    } else {
        if (tf) tf.className = 'tab-btn';
        // setFloor が呼ばれることで1F/2Fのハイライトが付きます
    }

    if (typeof window.triggerUpdate === 'function') window.triggerUpdate();
}

/**
 * 基礎サブモードの更新
 */
export function updateFdSubMode(mode) {
    AppState.foundationMode = mode;
    AppState.fdDrawPoints = [];
    AppState.fdSelectedPillarLike = null;
    AppState.fdSelection = { type: null, item: null };
    hideFdPropertyPopup();

    // ラベルのハイライト
    const labels = document.querySelectorAll('.fd-mode-label');
    labels.forEach(lbl => {
        const rad = lbl.querySelector('input');
        if (rad && rad.value === mode) {
            lbl.style.background = '#6c3483';
            lbl.style.fontWeight = 'bold';
        } else {
            lbl.style.background = '#4a235a';
            lbl.style.fontWeight = 'normal';
        }
    });

    if (typeof window.triggerUpdate === 'function') window.triggerUpdate();
}

/**
 * プロジェクトデータの読み込み (JSON復元)
 */
export function loadProjectData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // AppState へのマッピング
            mapJsonToAppState(data, AppState);

            // 図面データの再構築 (DxfParserを使用)
            if (AppState.docDrawingsRaw && window.DxfParser) {
                const parser = new window.DxfParser();
                const d = AppState.docDrawingsRaw;
                if (d.floor) {
                    const res = parser.parseSync(d.floor);
                    if (res && res.entities) AppState.docDrawings.floor = { entities: res.entities, loaded: true, rawDxf: d.floor };
                }
                if (d.elev) {
                    const res = parser.parseSync(d.elev);
                    if (res && res.entities) AppState.docDrawings.elev = { entities: res.entities, loaded: true, rawDxf: d.elev };
                }
                if (d.div4) {
                    const res = parser.parseSync(d.div4);
                    if (res && res.entities) AppState.docDrawings.div4 = { entities: res.entities, loaded: true, rawDxf: d.div4 };
                }
            }

            // UI同期と再計算
            if (typeof window.resizeCanvas === 'function') window.resizeCanvas();
            if (typeof window.analyzeGrids === 'function') window.analyzeGrids();
            if (typeof window.initViewForce === 'function') window.initViewForce();
            
            // ユーザー要望: 壁量計算モードで開始
            setFloor(AppState.currentFloor || '1F');

            if (typeof window.updateCalculations === 'function') window.updateCalculations();
            if (typeof window.updateReport === 'function') window.updateReport();
            if (typeof window.triggerUpdate === 'function') window.triggerUpdate();

            alert("✅ データを復元しました。");
            console.log("📂 Project restored successfully.");
        } catch (err) {
            console.error("Failed to restore project:", err);
            alert("❌ JSON復元失敗: \n" + err.message);
        }
    };
    reader.readAsText(file);
    
    // 次回同じファイルを選んでもイベントが発火するようにリセット
    event.target.value = '';
}
