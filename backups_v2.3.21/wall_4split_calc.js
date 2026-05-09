/**
 * logic/StructuralLogic.js - Core Structural Logic (Legacy Bridge)
 * v2.3.14 Refactoring
 */

const Geometry = window.MathUtils;

function updateCalculations() {
    window.StructuralEngine.runAnalysis();
}

/**
 * 必要壁量計算 (Legacy Bridge)
 * エンジン側の計算結果をDOMへ反映する役割も兼ねる
 */
function calcRequired() {
    const s = window.AppState;
    if (!window.AreaEngine || !s.requiredAreas) return;

    // DOMへの反映
    const setVal = (id, val) => {
        let el = document.getElementById(id);
        if (el) {
            el.value = val.toFixed(2);
            el.style.backgroundColor = '#fffff0';
        }
    };

    const r = s.requiredAreas;
    setVal('a-f1', r['1F'].floor);
    setVal('a-attic1', r['1F'].attic);
    setVal('a-balcony1', r['1F'].balcony);
    setVal('a-f2', r['2F'].floor);
    setVal('a-attic2', r['2F'].attic);
    setVal('a-balcony2', r['2F'].balcony);

    // 壁量計算結果の反映 (reqWall等)
    // 注意: reqWallはグローバル変数として残っている可能性があるため同期
    if (window.reqWall) {
        const cq1 = window.MathUtils.getVal('c-q1'), cq2 = window.MathUtils.getVal('c-q2');
        const cw1 = window.MathUtils.getVal('c-w1'), cw2 = window.MathUtils.getVal('c-w2');
        const triMult = s.config.triangleMultiplier || 1.33;

        ['1F', '2F'].forEach(f => {
            const level = f === '1F' ? '1' : '2';
            const cq = f === '1F' ? cq1 : cq2;
            const cw = f === '1F' ? cw1 : cw2;
            const awx = window.MathUtils.getVal(`a-wx${level}`) + (f === '1F' ? window.MathUtils.getVal('a-wx2') : 0);
            const awy = window.MathUtils.getVal(`a-wy${level}`) + (f === '1F' ? window.MathUtils.getVal('a-wy2') : 0);
            
            const eq = r[f].seismic * cq;
            window.reqWall[f] = {
                qX: Math.max(eq, awx * cw * triMult),
                qY: Math.max(eq, awy * cw * triMult),
                eq: eq,
                a_eff: r[f].seismic
            };
        });
    }
}

/**
 * 柱負担面積計算 (Legacy Bridge)
 */
function calcPillarAreas() {
    if (window.AreaEngine) {
        window.AreaEngine.calculatePillarLoadAreas(window.AppState);
    }
}

/**
 * 以下の関数は StructuralEngine に統合済み
 */
const calculateSlabTributary = (s, b) => window.StructuralEngine.calculateSlabTributary(s, b);
const updateAverageGroundPressure = () => window.StructuralEngine.updateAverageGroundPressure();

function getFloorArea(floor) {
    return window.AreaEngine.getFloorArea(floor, window.AppState);
}

function getBuildingPolygons(floor, pillarsOfFloor) {
    return window.AreaEngine.getBuildingPolygons(floor, pillarsOfFloor, window.AppState);
}

/**
 * N値計算 (将来的に NValueEngine へ完全移行)
 */
function calcNValues() {
    if (window.NValueEngine) {
        window.NValueEngine.calculateNValues(window.AppState);
    }
}
