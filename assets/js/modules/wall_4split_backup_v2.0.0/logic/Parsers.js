/**
 * Parsers.js
 * 鉄筋、コンクリート強度などの仕様文字列をパースするモジュール
 */

/**
 * 鉄筋文字列のパース ("2-D16" -> { count: 2, dia: 16, area: 397.2 })
 */
export function fd_parseRebar(str) {
    if (!str || typeof str !== 'string') return { count: 0, dia: 0, area: 0 };
    const m = str.trim().match(/^(\d+)-D(\d+)/i);
    if (!m) return { count: 0, dia: 0, area: 0 };
    const count = parseInt(m[1], 10);
    const dia   = parseInt(m[2], 10);
    // 標準鉄筋断面積 (mm²)
    const diaTbl = { 10: 71.33, 13: 126.7, 16: 198.6, 19: 286.5, 22: 387.1, 25: 506.7, 29: 642.4, 32: 794.2 };
    const area1 = diaTbl[dia] || (Math.PI * dia * dia / 4);
    return { count, dia, area: count * area1 };
}

/**
 * 鉄筋強度の自動判定 (SD295 / SD345)
 */
export function fd_getSteelStrength(str) {
    if (!str) return { ft: 195, fts: 295, type: 'SD295' };
    const isSD345 = /19|22/.test(str);
    if (isSD345) {
        return { ft: 215, fts: 345, type: 'SD345' };
    }
    return { ft: 195, fts: 295, type: 'SD295' };
}

/**
 * せん断補強筋のパース ("1-D10@200" -> { count, dia, pitch, area })
 */
export function fd_parseStirrups(str) {
    if (!str || typeof str !== 'string') return { count: 1, dia: 10, pitch: 200, area: 71.33 };
    const m = str.trim().match(/^(\d+)-D(\d+)@(\d+)/i);
    if (!m) return { count: 1, dia: 10, pitch: 200, area: 71.33 };
    const count = parseInt(m[1], 10);
    const dia   = parseInt(m[2], 10);
    const pitch = parseInt(m[3], 10);
    const diaTbl = { 10: 71.33, 13: 126.7, 16: 198.6, 19: 286.5, 22: 387.1 };
    const area1 = diaTbl[dia] || (Math.PI * dia * dia / 4);
    return { count, dia, pitch, area: count * area1 };
}

/**
 * コンクリート許容応力度の取得
 */
export function fd_getConcreteAllowable(fc) {
    return {
        fc: fc,
        fck_L: fc / 3,
        ftk_L: 0.49 * Math.pow(fc, 1/3),
        fwk_L: fc / 3 / Math.sqrt(3)
    };
}

/**
 * スラブ断面積 at の計算
 */
export function calculateSlabAt(typeStr, pitch) {
    const diaTbl = { 'D10': 71.3, 'D13': 126.7, 'D16': 198.6 };
    let area = 0;
    if (typeStr === 'D10/D13') area = (diaTbl['D10'] + diaTbl['D13']) / 2;
    else if (typeStr === 'D13/D16') area = (diaTbl['D13'] + diaTbl['D16']) / 2;
    else area = diaTbl[typeStr] || 0;
    
    if (!pitch || pitch <= 0) return 0;
    return area * (1000 / pitch);
}

/**
 * JSONデータからAppStateへのマッピング
 */
export function mapJsonToAppState(d, AppState) {
    // 基本入力値の同期 (IDベース)
    if (d.inputs) {
        for (let id in d.inputs) {
            const el = document.getElementById(id);
            if (el) el.value = d.inputs[id];
        }
    }

    // 基本要素の復元
    AppState.pillars = d.pillars || [];
    AppState.bgTextsOriginal = d.texts || [];
    AppState.pIdCounter = d.pIdCounter || 1000;
    AppState.walls = d.walls || [];
    AppState.windowsArr = d.windowsArr || d.windows || [];
    AppState.bgLinesOriginal = d.bgLines || [];
    AppState.areaLines = d.areaLines || [];
    AppState.gridBubbles = d.gridBubbles || [];

    // 通り芯情報の復元
    AppState.manualGridX = d.mgX || [];
    AppState.manualGridY = d.mgY || [];
    AppState.gridXNames = d.gx || [];
    AppState.gridYNames = d.gy || [];
    AppState.gridXCoords = d.gxc || [];
    AppState.gridYCoords = d.gyc || [];
    AppState.userEditedGridX = d.ueGX || {};
    AppState.userEditedGridY = d.ueGY || {};
    AppState.deletedGridX = d.deletedGX || [];
    AppState.deletedGridY = d.deletedGY || [];

    // 基礎データの復元
    AppState.foundationSlabs = d.foundationSlabs || [];
    AppState.exteriorWalls = d.exteriorWalls || [];
    AppState.foundationBeams = d.foundationBeams || [];
    AppState.manholes = d.manholes || [];
    AppState.concreteFc = d.concreteFc || 21;
    AppState.averageGroundPressure = d.averageGroundPressure || 0;

    // 表示設定の復元
    if (d.layerVisibility && window.layerVisibility) {
        Object.assign(window.layerVisibility, d.layerVisibility);
    }

    // データの互換性救済処理 (壁・開口部の柱参照の紐づけ)
    const pillarMap = new Map(AppState.pillars.map(p => [p.id, p]));
    AppState.walls.forEach(w => {
        if (typeof w.p1 === 'object' && w.p1.id) w.p1 = pillarMap.get(w.p1.id) || w.p1;
        if (typeof w.p2 === 'object' && w.p2.id) w.p2 = pillarMap.get(w.p2.id) || w.p2;
        if (!w.floor && w.p1) w.floor = w.p1.floor || '1F';
    });
    AppState.windowsArr.forEach(w => {
        if (typeof w.p1 === 'object' && w.p1.id) w.p1 = pillarMap.get(w.p1.id) || w.p1;
        if (typeof w.p2 === 'object' && w.p2.id) w.p2 = pillarMap.get(w.p2.id) || w.p2;
        if (!w.floor && w.p1) w.floor = w.p1.floor || '1F';
    });

    // 図面データの復旧とDXFパース (必要に応じて)
    if (d.docDrawingsRaw) {
        AppState.docDrawingsRaw = d.docDrawingsRaw;
        // 注意: DxfParser は非同期または別途MainControllerで処理するため、ここではフラグ立てのみ
    }

    return true;
}
