// ==========================================
// calc_engine_v2.js - 構造計算・検定ロジック
// 上善如水 - 壁量計算WEB Ver 1.14ベース (計算ロジック完全維持版)
// ==========================================

const Geometry = {
    polygonCentroid: function (pts) {
        let cx = 0, cy = 0, area = 0, n = pts.length;
        if (n < 3) return null;
        for (let i = 0; i < n; i++) {
            let j = (i + 1) % n;
            let cross = pts[i].x * pts[j].y - pts[j].x * pts[i].y;
            area += cross;
            cx += (pts[i].x + pts[j].x) * cross;
            cy += (pts[i].y + pts[j].y) * cross;
        }
        area /= 2;
        if (area === 0) return { x: pts[0].x, y: pts[0].y, area: 0 };
        return { x: cx / (6 * area), y: cy / (6 * area), area: Math.abs(area) };
    }
};

function signedPolygonArea(poly) {
    if (!poly || poly.length < 3) return 0;
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
        let j = (i + 1) % poly.length;
        a += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
    }
    return a / 2;
}

function polygonArea(poly) {
    return Math.abs(signedPolygonArea(poly));
}

function ensureCCW(poly) {
    if (signedPolygonArea(poly) < 0) {
        poly.reverse();
    }
}

function clipPolygonByHalfPlane(poly, A, B) {
    let mx = (A.x + B.x) / 2;
    let my = (A.y + B.y) / 2;
    let nx = B.x - A.x;
    let ny = B.y - A.y;

    let isInside = (p) => {
        return (p.x - mx) * nx + (p.y - my) * ny <= 1e-6;
    };

    let intersect = (S, E) => {
        let num = (mx - S.x) * nx + (my - S.y) * ny;
        let den = (E.x - S.x) * nx + (E.y - S.y) * ny;
        let t = num / den;
        return { x: S.x + t * (E.x - S.x), y: S.y + t * (E.y - S.y) };
    };

    let outputList = [];
    if (poly.length === 0) return [];

    let S = poly[poly.length - 1];
    for (let i = 0; i < poly.length; i++) {
        let E = poly[i];
        if (isInside(E)) {
            if (!isInside(S)) outputList.push(intersect(S, E));
            outputList.push(E);
        } else if (isInside(S)) {
            outputList.push(intersect(S, E));
        }
        S = E;
    }
    return outputList;
}

function clipByVoronoi(subjectPolygon, clipPolygon) {
    let outputList = subjectPolygon;
    for (let i = 0; i < clipPolygon.length; i++) {
        let cp1 = clipPolygon[i];
        let cp2 = clipPolygon[(i + 1) % clipPolygon.length];
        let inputList = outputList;
        outputList = [];
        if (inputList.length === 0) break;

        let S = inputList[inputList.length - 1];
        for (let j = 0; j < inputList.length; j++) {
            let E = inputList[j];
            let isInside = (p) => (cp2.x - cp1.x) * (p.y - cp1.y) - (cp2.y - cp1.y) * (p.x - cp1.x) >= -1e-6;

            let intersection = () => {
                let A1 = cp2.y - cp1.y, B1 = cp1.x - cp2.x, C1 = A1 * cp1.x + B1 * cp1.y;
                let A2 = E.y - S.y, B2 = S.x - E.x, C2 = A2 * S.x + B2 * S.y;
                let det = A1 * B2 - A2 * B1;
                if (Math.abs(det) < 1e-6) return { x: S.x, y: S.y };
                return { x: (B2 * C1 - B1 * C2) / det, y: (A1 * C2 - A2 * C1) / det };
            };

            if (isInside(E)) {
                if (!isInside(S)) outputList.push(intersection());
                outputList.push(E);
            } else if (isInside(S)) {
                outputList.push(intersection());
            }
            S = E;
        }
    }
    return outputList.map(p => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 }));
}

// ★ 追加: Sutherland-Hodgmanによる矩形クリッピング関数
function clipPolygonByRect(poly, minX, maxX, minY, maxY) {
    let result = poly;
    const clipEdge = (pts, edge, sign, val) => {
        let out = [];
        if (pts.length === 0) return out;
        let p1 = pts[pts.length - 1];
        let p1_in = (edge === 'x') ? (sign * p1.x >= sign * val) : (sign * p1.y >= sign * val);
        for (let i = 0; i < pts.length; i++) {
            let p2 = pts[i];
            let p2_in = (edge === 'x') ? (sign * p2.x >= sign * val) : (sign * p2.y >= sign * val);
            if (p1_in !== p2_in) {
                let dx = p2.x - p1.x, dy = p2.y - p1.y;
                let t = (edge === 'x') ? (val - p1.x) / dx : (val - p1.y) / dy;
                out.push({ x: p1.x + t * dx, y: p1.y + t * dy });
            }
            if (p2_in) out.push(p2);
            p1 = p2; p1_in = p2_in;
        }
        return out;
    };
    // ★ 修正: valにはそのまま正の値を渡し、sign(1 or -1)で向きを制御する
    result = clipEdge(result, 'x', 1, minX);
    result = clipEdge(result, 'x', -1, maxX);
    result = clipEdge(result, 'y', 1, minY);
    result = clipEdge(result, 'y', -1, maxY);
    return result;
}

// ★ 修正：作図データからの床面積推計（凹多角形対応、updateReportと同一ロジック）
function getFloorArea(floor) {
    // 修正: 'floor' または areaType が未定義のものだけを対象にする
    const fAreas = areaLines.filter(a => a.floor === floor && (!a.areaType || a.areaType === 'floor'));
    if (fAreas.length === 0) return null;
    let floorTotalArea = 0;
    fAreas.forEach(area => {
        const poly = area.vertices;
        floorTotalArea += polygonArea(poly) / 1000000;
    });
    return floorTotalArea;
}

// ★ 修正：複数ポリゴン（下屋等）に対応するため、配列で返す
function getBuildingPolygons(floor, pillarsOfFloor) {
    // ★ 「床面積」種別のみを建物外形として使用する
    let floorAreas = areaLines.filter(a => a.floor === floor && a.vertices && a.vertices.length >= 3 && (!a.areaType || a.areaType === 'floor'));
    if (floorAreas.length > 0) {
        return floorAreas.map(a => {
            let poly = a.vertices.map(v => ({ x: v.x, y: v.y }));
            ensureCCW(poly);
            return poly;
        });
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pillarsOfFloor.forEach(p => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    if (minX === Infinity) return [];
    const OFFSET = 455;
    let poly = [
        { x: minX - OFFSET, y: minY - OFFSET },
        { x: maxX + OFFSET, y: minY - OFFSET },
        { x: maxX + OFFSET, y: maxY + OFFSET },
        { x: minX - OFFSET, y: maxY + OFFSET }
    ];
    ensureCCW(poly);
    return [poly];
}

function updateCalculations() {
    updateWallSelects();
    calcRequired();
    calcPillarAreas();
    calcNValues();

    // [機能補完 スラブ計算全結合] 基礎モード時の専用計算ルート
    if ((typeof getAppMode === 'function') && getAppMode() === 'foundation') {
        // [機能改善 連続梁・スパンモデル化] 梁のクレンジングと一本化・スパン分割
        if (typeof reconstructContinuousBeams === 'function') {
            reconstructContinuousBeams();
        }

        // ① 建物荷重の集計・平均接地圧(建物分)の算出
        updateAverageGroundPressure();

        // ② スラブの断面検定 (自重＋積載を合算し qTotal を確定)
        if (typeof calculateFoundationSlabAnalysis === 'function') {
            calculateFoundationSlabAnalysis(window.AppState.foundationSlabs, window.AppState.averageBuildingPressure);
        }

        // ③ 亀甲分割（幾何学的計算）
        calculateSlabTributary(window.AppState.foundationSlabs, window.AppState.foundationBeams);

        // ④ 基礎梁 応力解析・断面検定 (確定した各スラブの qTotal を参照)
        if (typeof runFoundationBeamAnalysis === 'function') {
            runFoundationBeamAnalysis(window.AppState.foundationBeams, window.AppState.foundationSlabs);
        }

        // [機能補完 最終調整] 平均接地圧の算出
        updateAverageGroundPressure();
    }


    ['1F', '2F'].forEach(f => {
        const b = get4DivBounds(f);
        if (!b) return;
        const suffix = f === '1F' ? '1' : '2';

        // ★ 作図面積または手入力面積の厳格な1/4を採用（部分フォールバック用）
        const autoArea = getFloorArea(f);
        let q_xt = 0, q_xb = 0, q_yl = 0, q_yr = 0;

        if (autoArea !== null && areaLines.some(a => a.floor === f)) {
            // ★ 作図ポリゴンが存在する場合: Sutherland-Hodgmanで各領域の面積を厳密に計算
            areaLines.filter(a => a.floor === f && (!a.areaType || a.areaType === 'floor')).forEach(area => {
                let poly = [...area.vertices];
                if (poly.length < 3) return;
                let totalSigned = 0;
                for (let i = 0; i < poly.length; i++) { let j = (i + 1) % poly.length; totalSigned += (poly[i].x * poly[j].y - poly[j].x * poly[i].y); }
                if (totalSigned < 0) poly.reverse();

                // キャンバス座標系のY軸変化に合わせた四方の拡張
                const INF = 1000000;
                let isYDown = b.yTop < b.yBottom;
                let topMinY = isYDown ? -INF : b.yTop;
                let topMaxY = isYDown ? b.yTop : INF;
                let botMinY = isYDown ? b.yBottom : -INF;
                let botMaxY = isYDown ? INF : b.yBottom;

                let c_xt = clipPolygonByRect(poly, -INF, INF, topMinY, topMaxY);
                let c_xb = clipPolygonByRect(poly, -INF, INF, botMinY, botMaxY);
                let c_yl = clipPolygonByRect(poly, -INF, b.xLeft, -INF, INF);
                let c_yr = clipPolygonByRect(poly, b.xRight, INF, -INF, INF);

                q_xt += polygonArea(c_xt) / 1000000;
                q_xb += polygonArea(c_xb) / 1000000;
                q_yl += polygonArea(c_yl) / 1000000;
                q_yr += polygonArea(c_yr) / 1000000;
            });
        } else {
            // 作図データがない場合のフォールバック（手入力の床面積÷4）
            const totalA = getVal(`a-f${suffix}`);
            const qArea = totalA / 4;
            q_xt = q_xb = q_yl = q_yr = qArea;
        }

        const setIfEmpty = (id, val) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (autoArea !== null) {
                el.value = val.toFixed(3);
                el.style.backgroundColor = '#fffff0';
            } else {
                el.style.backgroundColor = '';
                const current = parseFloat(el.value);
                if (isNaN(current) || current === 0) {
                    el.value = val.toFixed(3);
                }
            }
        };
        setIfEmpty(`e-x-t${suffix}`, q_xt); setIfEmpty(`e-x-b${suffix}`, q_xb);
        setIfEmpty(`e-y-l${suffix}`, q_yl); setIfEmpty(`e-y-r${suffix}`, q_yr);
    });
}

function get4DivBounds(floor) {
    let xs = [], ys = [];
    
    // 【優先順位1】ユーザーが作図した対象面積（小屋裏とバルコニー以外）がある場合、その範囲を境界とする
    const floorPolys = areaLines.filter(a => a.floor === floor && a.areaType !== 'attic' && a.areaType !== 'balcony');
    if (floorPolys.length > 0) {
        floorPolys.forEach(a => a.vertices.forEach(v => { xs.push(v.x); ys.push(v.y); }));
    } else {
        // 【優先順位2】床面積等がない場合は、柱の最外周から取得
        pillars.filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === floor || p.floor === 'ALL')).forEach(p => { xs.push(p.x); ys.push(p.y); });
    }
    
    if (xs.length === 0 || ys.length === 0) return null;

    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const W = maxX - minX, H = maxY - minY;
    if (W <= 0 || H <= 0) return null;

    const s = floor === '1F' ? '1' : '2';

    // ★ W, H の算出直後に 1/4 の数値をUIへ強制自動入力する
    let elZxt = document.getElementById(`z-x-t${s}`);
    let elZxb = document.getElementById(`z-x-b${s}`);
    let elZyl = document.getElementById(`z-y-l${s}`);
    let elZyr = document.getElementById(`z-y-r${s}`);
    if (elZxt) elZxt.value = (H / 4).toFixed(3);
    if (elZxb) elZxb.value = (H / 4).toFixed(3);
    if (elZyl) elZyl.value = (W / 4).toFixed(3);
    if (elZyr) elZyr.value = (W / 4).toFixed(3);

    const zxt = getVal(`z-x-t${s}`) || (H / 4);
    const zxb = getVal(`z-x-b${s}`) || (H / 4);
    const zyl = getVal(`z-y-l${s}`) || (W / 4);
    const zyr = getVal(`z-y-r${s}`) || (W / 4);

    return { minX, maxX, minY, maxY, W, H, xLeft: minX + zyl, xRight: maxX - zyr, yBottom: minY + zxb, yTop: maxY - zxt };
}

// ★ 追加: 種別ごとの面積集計
function getAreaByType(floor, type) {
    const fAreas = areaLines.filter(a => a.floor === floor && (a.areaType === type || (type === 'floor' && !a.areaType)));
    if (fAreas.length === 0) return null;
    let total = 0;
    fAreas.forEach(area => {
        let poly = [...area.vertices];
        if (poly.length < 3) return;
        total += polygonArea(poly) / 1000000;
    });
    return total;
}

function calcRequired() {
    const calcMode = document.getElementById('calc-mode-select')?.value || 'kijun';
    const isSeinou = calcMode === 'seinou';

    const atticH = parseFloat(document.getElementById('attic-height')?.value) || 1.4;
    const atticRatio = atticH / 2.1;

    // 生の面積を取得し、ステップAの文字列を生成する関数
    const getAreaDef = (f, type, id, name) => {
        let target = areaLines.filter(a => a.floor === f && a.areaType === type);
        let el = id ? document.getElementById(id) : null;
        if (target.length > 0) {
            let parts = []; let total = 0;
            target.forEach(a => {
                let poly = [...a.vertices];
                if (poly.length >= 3) {
                    let area = polygonArea(poly) / 1000000;
                    parts.push(area); total += area;
                }
            });
            if (el) { el.value = total.toFixed(2); el.style.backgroundColor = '#fffff0'; }
            let sA = parts.length > 1 ? `[生の${name}面積] = ${parts.map(p=>p.toFixed(2)+'㎡').join(' ＋ ')} = ${total.toFixed(2)}㎡` : `[生の${name}面積] = ${total.toFixed(2)}㎡`;
            return { val: total, stepA: sA };
        }
        if (el) el.style.backgroundColor = '';
        let mVal = id ? getVal(id) : 0;
        let sA = mVal > 0 ? `[生の${name}面積] = ${mVal.toFixed(2)}㎡ (手動入力)` : null;
        return { val: mVal, stepA: sA };
    };

    const af1 = getAreaDef('1F', 'floor', 'a-f1', '1F床');
    const aa1 = getAreaDef('1F', 'attic', 'a-attic1', '1F小屋裏');
    const ab1 = getAreaDef('1F', 'balcony', 'a-balcony1', '1Fバルコニー');
    const ap1 = getAreaDef('1F', 'porch', null, '1Fポーチ・屋根');
    const af2 = getAreaDef('2F', 'floor', 'a-f2', '2F床');
    const aa2 = getAreaDef('2F', 'attic', 'a-attic2', '2F小屋裏');
    const ab2 = getAreaDef('2F', 'balcony', 'a-balcony2', '2Fバルコニー');
    const av2 = getAreaDef('2F', 'void', null, '2F吹き抜け');

    const makeStepB = (name, rawVal, loadFactor, factorStr) => {
        if (rawVal <= 0) return null;
        if (loadFactor === 1.0) return `[${name}の加算分] = ${rawVal.toFixed(2)}㎡ (そのまま加算)`;
        return `[${name}の加算分] = ${rawVal.toFixed(2)}㎡ × ${factorStr} = ${(rawVal * loadFactor).toFixed(2)}㎡`;
    };

    // --- 1Fの計算 ---
    let steps1F = ['<div style="margin-top:4px;"><b>【ステップA】生の作図面積の合算</b></div>'];
    if (af1.stepA) steps1F.push(af1.stepA);
    if (aa1.stepA) steps1F.push(aa1.stepA);
    if (aa2.stepA) steps1F.push(aa2.stepA); // 2F小屋裏も1F柱にかかる
    if (isSeinou && ap1.stepA) steps1F.push(ap1.stepA);
    if (isSeinou && ab1.stepA) steps1F.push(ab1.stepA);
    
    steps1F.push('<div style="margin-top:8px;"><b>【ステップB】荷重換算式の適用</b></div>');
    if (af1.val > 0) steps1F.push(makeStepB('1F床', af1.val, 1.0));
    if (aa1.val > 0) steps1F.push(makeStepB('1F小屋裏', aa1.val, atticRatio, `(${atticH}/2.1)`));
    if (aa2.val > 0) steps1F.push(makeStepB('2F小屋裏(1F柱用)', aa2.val, atticRatio, `(${atticH}/2.1)`));
    if (isSeinou && ap1.val > 0) steps1F.push(makeStepB('1Fポーチ・屋根', ap1.val, 1.0));
    if (isSeinou && ab1.val > 0) steps1F.push(makeStepB('1Fバルコニー', ab1.val, 0.4, '0.4'));

    let a1_seismic = af1.val + (aa1.val * atticRatio) + (aa2.val * atticRatio);
    let sC1 = `【${isSeinou ? '性能表示(見上げ)' : '建築基準法(見下げ)'}モード】 1F地震力用床面積 = 1F床加算分(${af1.val.toFixed(2)}) ＋ 1F小屋裏加算分(${(aa1.val * atticRatio).toFixed(2)}) ＋ 2F小屋裏加算分(${(aa2.val * atticRatio).toFixed(2)})`;
    if (isSeinou) {
        a1_seismic += ap1.val + (ab1.val * 0.4);
        sC1 += ` ＋ 1Fポーチ加算分(${ap1.val.toFixed(2)}) ＋ 1Fバルコニー加算分(${(ab1.val * 0.4).toFixed(2)})`;
    }
    sC1 += ` = <b>合計 ${a1_seismic.toFixed(2)}㎡</b>`;
    steps1F.push('<div style="margin-top:8px;"><b>【ステップC】必要壁量用面積の最終合算</b></div>');
    steps1F.push(sC1);
    let a1_basis = steps1F.join('<br>');


    // --- 2Fの計算 ---
    let steps2F = ['<div style="margin-top:4px;"><b>【ステップA】生の作図面積の合算</b></div>'];
    if (af2.stepA) steps2F.push(af2.stepA);
    if (aa2.stepA) steps2F.push(aa2.stepA);
    if (isSeinou && av2.stepA) steps2F.push(av2.stepA);

    steps2F.push('<div style="margin-top:8px;"><b>【ステップB】荷重換算式の適用</b></div>');
    if (af2.val > 0) steps2F.push(makeStepB('2F床', af2.val, 1.0));
    if (aa2.val > 0) steps2F.push(makeStepB('2F小屋裏', aa2.val, atticRatio, `(${atticH}/2.1)`));
    if (isSeinou && av2.val > 0) steps2F.push(makeStepB('2F吹き抜け', av2.val, 1.0));

    let a2_seismic = af2.val + (aa2.val * atticRatio);
    let sC2 = `【${isSeinou ? '性能表示(見上げ)' : '建築基準法(見下げ)'}モード】 2F地震力用床面積 = 2F床加算分(${af2.val.toFixed(2)}) ＋ 2F小屋裏加算分(${(aa2.val * atticRatio).toFixed(2)})`;
    if (isSeinou) {
        a2_seismic += av2.val;
        sC2 += ` ＋ 2F吹き抜け加算分(${av2.val.toFixed(2)})`;
    }
    sC2 += ` = <b>合計 ${a2_seismic.toFixed(2)}㎡</b>`;
    steps2F.push('<div style="margin-top:8px;"><b>【ステップC】必要壁量用面積の最終合算</b></div>');
    steps2F.push(sC2);
    let a2_basis = steps2F.join('<br>');

    ['1F', '2F'].forEach(f => {
        const s = f === '1F' ? '1' : '2';
        const cq = getVal(`c-q${s}`);
        const cw = getVal(`c-w${s}`);
        let awx = getVal(`a-wx${s}`);
        let awy = getVal(`a-wy${s}`);
        if (f === '1F') { awx += getVal('a-wx2'); awy += getVal('a-wy2'); }
        const a_seismic = (f === '1F' ? a1_seismic : a2_seismic);
        const a_basis = (f === '1F' ? a1_basis : a2_basis);

        const eq = a_seismic * cq;
        const triMult = window.AppState.triangleMultiplier || 1.0;
        const qX = Math.max(eq, awx * cw * triMult);
        const qY = Math.max(eq, awy * cw * triMult);
        reqWall[f] = { qX, qY, eq, a_eff: a_seismic, basis: a_basis };
    });
}

function calcPillarAreas() {
    const INF = 100000;
    const atticH = parseFloat(document.getElementById('attic-height')?.value) || 1.4;
    const atticRatio = atticH / 2.1; // 小屋裏面積の荷重換算係数
    const balconyRatio = 0.4;       // 持ち出しバルコニーの荷重換算係数
    const porchRatio = 1.0;         // ポーチの荷重換算係数
    const voidRatio = 1.0;          // 吹き抜けの荷重換算係数

    const calcMethod = document.getElementById('calc-mode-select')?.value || 'kijun';
    const isSeinou = calcMethod === 'seinou';

    ['1F', '2F'].forEach(f => {
        let ap = pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === f);
        if (ap.length === 0) return;

        // ---- 建物外形（床面積のみ）からVoronoiセルを生成 ----
        let buildingPolys = getBuildingPolygons(f, ap);
        if (buildingPolys.length === 0) return;

        // 階とモードに応じた追加の負担面積（バルコニー・小屋裏など）の定義
        let extraTypes = [];
        if (f === '1F') {
            extraTypes.push({ type: 'attic', ratio: atticRatio });
            if (isSeinou) {
                extraTypes.push({ type: 'porch', ratio: porchRatio });
                extraTypes.push({ type: 'balcony', ratio: balconyRatio });
            }
        } else if (f === '2F') {
            extraTypes.push({ type: 'attic', ratio: atticRatio });
            if (isSeinou) {
                extraTypes.push({ type: 'void', ratio: voidRatio });
            }
        }

        const extraPolysByType = extraTypes.map(et => ({
            ...et,
            polys: areaLines
                .filter(a => a.floor === f && a.areaType === et.type && a.vertices && a.vertices.length >= 3)
                .map(a => { let poly = a.vertices.map(v => ({ x: v.x, y: v.y })); ensureCCW(poly); return poly; })
        }));

        ap.forEach(p => {
            // ---- 各柱のVoronoiセルを生成 ----
            let cell = [
                { x: p.x - INF, y: p.y - INF },
                { x: p.x + INF, y: p.y - INF },
                { x: p.x + INF, y: p.y + INF },
                { x: p.x - INF, y: p.y + INF }
            ];
            ensureCCW(cell);

            ap.forEach(op => {
                if (op.id === p.id) return;
                if (Math.hypot(op.x - p.x, op.y - p.y) < 1) return;
                cell = clipPolygonByHalfPlane(cell, p, op);
            });

            // ---- [1] 床面積ポリゴンとのクリッピング (N値等の主たる負担面積) ----
            let totalTributaryParts = [];
            let totalArea = 0;
            buildingPolys.forEach(bp => {
                let part = clipByVoronoi(bp, cell);
                if (part.length >= 3) {
                    totalTributaryParts.push(part);
                    totalArea += polygonArea(part);
                }
            });

            // ---- [2] 追加ポリゴン（バルコニー・小屋裏等）のクリッピングと面積・描画図形への加算 ----
            let extraArea = 0;
            extraPolysByType.forEach(et => {
                et.polys.forEach(bp => {
                    let part = clipByVoronoi(bp, cell);
                    if (part.length >= 3) {
                        totalTributaryParts.push(part); // 描画用の負担面積図形群として追加
                        extraArea += polygonArea(part) / 1000000 * et.ratio;
                    }
                });
            });

            p.tributaryPolygons = totalTributaryParts;
            // 互換性のため、最大のものを代入
            p.tributaryPolygon = totalTributaryParts.reduce((a, b) => {
                if (!a && !b) return null;
                if (!a) return b;
                if (!b) return a;
                return (polygonArea(a) > polygonArea(b) ? a : b);
            }, null);
            let floorAutoArea = totalArea / 1000000;

            p.autoArea = floorAutoArea + extraArea;
        });
    });
}

function calcNValues() {
    const h1 = getVal('n-h1') || 2.7, h2 = getVal('n-h2') || 2.7;
    // [機能改善 UI整理と断熱材調整] 手動入力から仕様プロパティの積算に変更
    const wRoof = (window.AppState.roofWeight + window.AppState.solarWeight + window.AppState.ceilingInsWeight) / 1000;
    const wFloor = 0.60; // 床は固定値(0.60)とする
    const hwList = getHardwareList();

    const pillars2F = pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === '2F'); // ★修正2：柱の2階/1階対応付けに共通の getPillarName を使用
    let map2FByName = {};
    pillars2F.forEach(p => {
        let nm = window.getPillarName(p);
        if (nm && nm !== '位置不明') map2FByName[nm] = p;
    });

    const xs2F = pillars2F.map(p => p.x), ys2F = pillars2F.map(p => p.y);
    const bb2F = (xs2F.length > 0) ? { minX: Math.min(...xs2F), maxX: Math.max(...xs2F), minY: Math.min(...ys2F), maxY: Math.max(...ys2F) } : null;

    const has2FAbove = (p) => {
        let nm = window.getPillarName(p);
        if (map2FByName[nm]) return true;
        if (bb2F && p.x >= bb2F.minX && p.x <= bb2F.maxX && p.y >= bb2F.minY && p.y <= bb2F.maxY) return true;
        return false;
    };

    // ★ 1. 告示第1460号 表3-14: 筋交い補正値算出関数 (修正版)
    function calcTable314Correction(brace1, brace2) {
        if (!brace1 && !brace2) return 0;
        // たすき掛け(4.0倍)の処理：片側・両側問わず+0.5
        if ((brace1 && brace1.m === 4.0) || (brace2 && brace2.m === 4.0)) return 0.5;

        // 片側のみの場合 (面材と筋交いの混在など)
        if (!brace1 || !brace2) {
            let b = brace1 || brace2;
            // P1(柱脚)は圧縮でマイナス、P2(柱頭)は引張でプラス
            if (b.m === 1.5 || b.m === 2.0) return b.type === 'P1' ? -0.5 : 0.5;
            if (b.m === 3.0) return b.type === 'P1' ? -2.0 : 2.0;
            return 0;
        }

        // 両側にある場合 (V字, ハの字, 平行)
        let m = Math.max(brace1.m, brace2.m); // 安全側
        let types = [brace1.type, brace2.type].sort().join(''); // 'P1P1'(\/), 'P2P2'(/\), 'P1P2'(//)

        if (m === 1.5 || m === 2.0) {
            if (types === 'P1P1') return 0;    // V字 (互いに押し合うため0)
            if (types === 'P2P2') return 1.0;  // ハの字 (引張方向: +1.0)
            if (types === 'P1P2') return 1.5;  // 平行 (表3-14より: +1.5)
        }
        if (m === 3.0) {
            if (types === 'P1P1') return 0;    // V字
            if (types === 'P2P2') return 2.0;  // ハの字
            if (types === 'P1P2') return 2.0;  // 平行
        }
        return 0;
    }

    // ★ 2. N値計算における斜め壁の引抜力（α）加算ロジックの完全再構築
    const collectAlpha = (targetPillarId, targetFloor, refP) => {
        let sumR = 0, sumL = 0, sumT = 0, sumB = 0;
        let braceX_L = null, braceX_R = null, braceY_B = null, braceY_T = null;
        const parts = { X: [], Y: [] };

        walls.filter(w => w.floor === targetFloor && (w.p1.id === targetPillarId || w.p2.id === targetPillarId))
            .forEach(w => {
                const tv = w.totalVal || 0;
                if (tv === 0) return;
                const op = (w.p1.id === targetPillarId) ? w.p2 : w.p1;
                const dx = Math.abs(op.x - refP.x), dy = Math.abs(op.y - refP.y);
                const L_wall = Math.sqrt(dx * dx + dy * dy) / 1000;
                if (L_wall === 0) return;

                let ratioX = dx / 1000 / L_wall;
                let ratioY = dy / 1000 / L_wall;

                let isP1 = w.p1.id === targetPillarId;
                let isBrace = [1.0, 1.5, 2.0, 3.0, 4.0].includes(tv);
                let braceObj = isBrace ? { m: tv, type: isP1 ? 'P1' : 'P2' } : null;

                // 角度による斜め・基本の判定 (10mm以上のズレ)
                let isDiag = (dx > 10 && dy > 10);

                // ★ N値計算のセオリー：斜め壁は按分せず、元の倍率(tv)をそのまま100%引抜力として扱う
                // 基本壁は、壁の向き（XかYか）にのみ100%作用する
                let effTx = isDiag ? tv : (dx > dy ? tv : 0);
                let effTy = isDiag ? tv : (dy > dx ? tv : 0);

                let label = isDiag ? '(斜)' : '(基)';

                // ===== X方向の加算 =====
                if (effTx > 0.01) {
                    if (op.x >= refP.x) { sumR += effTx; parts.X_R = parts.X_R || []; parts.X_R.push(`${effTx.toFixed(2)}${label}`); if (isBrace) braceX_R = braceObj; }
                    else { sumL += effTx; parts.X_L = parts.X_L || []; parts.X_L.push(`${effTx.toFixed(2)}${label}`); if (isBrace) braceX_L = braceObj; }
                }

                // ===== Y方向の加算 =====
                if (effTy > 0.01) {
                    if (op.y >= refP.y) { sumT += effTy; parts.Y_T = parts.Y_T || []; parts.Y_T.push(`${effTy.toFixed(2)}${label}`); if (isBrace) braceY_T = braceObj; }
                    else { sumB += effTy; parts.Y_B = parts.Y_B || []; parts.Y_B.push(`${effTy.toFixed(2)}${label}`); if (isBrace) braceY_B = braceObj; }
                }
            });

        // 差分文字列の生成ヘルパー
        const makeDiffStr = (arr1, arr2, name1, name2) => {
            let s1 = arr1 && arr1.length > 0 ? (arr1.length > 1 ? `(${arr1.join('+')})` : arr1[0]) : '0.00';
            let s2 = arr2 && arr2.length > 0 ? (arr2.length > 1 ? `(${arr2.join('+')})` : arr2[0]) : '0.00';
            return `|${name1}${s1}-${name2}${s2}|`;
        };

        // X方向の最終引抜力と計算式文字列
        let effX = 0;
        if (sumR > 0 || sumL > 0) {
            let baseDiffX = Math.abs(sumR - sumL);
            let corrX = calcTable314Correction(braceX_L, braceX_R);
            effX = Math.max(0, baseDiffX + corrX);
            let strX = makeDiffStr(parts.X_R, parts.X_L, '右', '左');
            if (corrX !== 0) strX += `${corrX > 0 ? '+' : ''}${corrX.toFixed(2)}`;
            parts.X = [`(${strX})`]; // 既存の出力互換性のため配列に入れる
        }

        // Y方向の最終引抜力と計算式文字列
        let effY = 0;
        if (sumT > 0 || sumB > 0) {
            let baseDiffY = Math.abs(sumT - sumB);
            let corrY = calcTable314Correction(braceY_B, braceY_T);
            effY = Math.max(0, baseDiffY + corrY);
            let strY = makeDiffStr(parts.Y_T, parts.Y_B, '上', '下');
            if (corrY !== 0) strY += `${corrY > 0 ? '+' : ''}${corrY.toFixed(2)}`;
            parts.Y = [`(${strY})`];
        }

        return { aL: 0, aR: effX, aB: 0, aT: effY, parts };
    };

    pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === '2F').forEach(p => {
        const isC = p.isManualCorner !== null ? p.isManualCorner : p.isCornerAuto;
        p.isC = isC;
        const { aL, aR, aB, aT, parts } = collectAlpha(p.id, '2F', p);
        p.Ax = Math.abs(aR - aL); p.Ay = Math.abs(aT - aB); p._parts = parts;
    });

    ['2F', '1F'].forEach(f => {
        pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === f).forEach(p => {
            const isC = p.isManualCorner !== null ? p.isManualCorner : p.isCornerAuto;
            p.isC = isC;
            const b = isC ? 0.8 : 0.5;

            const baseH = f === '1F' ? h1 : h2;
            const p_h = p.manualH || baseH;
            const p_d = p.manualD || (f === '1F' ? getVal('p-d1') || 105 : getVal('p-d2') || 105);

            const l_0 = p_h;
            const lambda = (l_0 * 1000 * Math.sqrt(12)) / p_d;

            p.d = p_d;
            p.l_0 = l_0;
            p.lambda = lambda;
            p.lambdaOK = lambda <= 150;

            // ★修正2：高さ係数 k の下限設定 (H <= 3.2m で H=2.7 とする)
            const calc_H = p_h <= 3.2 ? 2.7 : p_h;
            const k_p = calc_H / 2.7;

            let usedArea = p.manualArea !== null && p.manualArea !== undefined ? p.manualArea : (p.autoArea || 0);
            p.usedArea = usedArea;
            let isDetail = p.lCalcMode === 'detail';

            if (f === '1F') {
                p.h1 = p_h;
                let nm = window.getPillarName(p);
                const upper = map2FByName[nm] || null;
                p.h2 = upper ? (upper.manualH || h2) : null;

                const underUpper = has2FAbove(p);
                const { aL, aR, aB, aT, parts } = collectAlpha(p.id, '1F', p);
                const Ax1 = Math.abs(aR - aL), Ay1 = Math.abs(aT - aB);
                p.Ax = Ax1; p.Ay = Ay1;

                let L = 0;
                if (isDetail) {
                    let unitLoad = underUpper ? (wRoof + wFloor) : wRoof; // 2Fがあれば屋根+床、なければ屋根(下屋)のみ
                    let W_kN = unitLoad * usedArea;
                    L = W_kN / 5.3;
                } else {
                    L = underUpper ? (isC ? 1.0 : 1.6) : (isC ? 0.4 : 0.6);
                }
                p.L_val = L;

                let Nx, Ny, cStrX, cStrY;
                if (underUpper && upper) {
                    const isC2 = upper.isManualCorner !== null ? upper.isManualCorner : upper.isCornerAuto;
                    const b2 = isC2 ? 0.8 : 0.5;
                    const Ax2 = upper.Ax ?? 0, Ay2 = upper.Ay ?? 0;
                    const p2Parts = upper._parts || { X: [], Y: [] };
                    const k_upper = p.h2 ? (p.h2 <= 3.2 ? 2.7 : p.h2) / 2.7 : 1.0;

                    Nx = (Ax1 * b * k_p) + (Ax2 * b2 * k_upper) - L;
                    Ny = (Ay1 * b * k_p) + (Ay2 * b2 * k_upper) - L;
                    cStrX = `(${parts.X.join('+') || '0'})|×b${b}×k${k_p.toFixed(2)} + (${p2Parts.X.join('+') || '0'})|×b${b2}×k${k_upper.toFixed(2)} - L${L.toFixed(2)}`;
                    cStrY = `(${parts.Y.join('+') || '0'})|×b${b}×k${k_p.toFixed(2)} + (${p2Parts.Y.join('+') || '0'})|×b${b2}×k${k_upper.toFixed(2)} - L${L.toFixed(2)}`;
                } else {
                    Nx = Ax1 * b * k_p - L; Ny = Ay1 * b * k_p - L;
                    cStrX = `(${parts.X.join('+') || '0'})|×b${b}×k${k_p.toFixed(2)} - L${L.toFixed(2)}`;
                    cStrY = `(${parts.Y.join('+') || '0'})|×b${b}×k${k_p.toFixed(2)} - L${L.toFixed(2)}`;
                }
                p.nCalcX = Nx; p.nCalcY = Ny; p.nValue = Math.max(Nx, Ny, 0); p.cStrX = cStrX; p.cStrY = cStrY;
            } else {
                p.h2 = p_h;
                let L;
                if (isDetail) { let W_kN = wRoof * usedArea; L = W_kN / 5.3; }
                else { L = isC ? 0.4 : 0.6; }
                p.L_val = L;

                const Nx = p.Ax * b * k_p - L, Ny = p.Ay * b * k_p - L;
                p.nCalcX = Nx; p.nCalcY = Ny; p.nValue = Math.max(Nx, Ny, 0);
                const pts = p._parts || { X: [], Y: [] };
                p.cStrX = `(${pts.X.join('+') || '0'})|×b${b}×k${k_p.toFixed(2)} - L${L.toFixed(2)}`;
                p.cStrY = `(${pts.Y.join('+') || '0'})|×b${b}×k${k_p.toFixed(2)} - L${L.toFixed(2)}`;
            }

            if ((p.Ax + p.Ay) === 0 || p.nValue <= 0) { p.nMark = '不要'; }
            else { const hw = hwList.find(h => !h.isCust && h.n >= p.nValue); p.nMark = hw ? hw.name : '別途検討'; }
            if (p.manualMark) p.nMark = p.manualMark;
        });
    });
}

function calcDirectSupportRatio() {
    let p2F = pillars.filter(p => p.floor === '2F' && !p.isDeleted && !p.isInvalidPos);
    let p1F = pillars.filter(p => p.floor === '1F' && !p.isDeleted && !p.isInvalidPos);

    let pCount2F = p2F.length;
    let pMatch = 0;
    p2F.forEach(p2 => {
        if (p1F.some(p1 => Math.abs(p1.x - p2.x) < 10 && Math.abs(p1.y - p2.y) < 10)) pMatch++;
    });
    let pRatio = pCount2F > 0 ? (pMatch / pCount2F) * 100 : 0;

    let w2F = walls.filter(w => w.floor === '2F');
    let w1F = walls.filter(w => w.floor === '1F');

    let wLen2FX = 0, wLen2FY = 0;
    let wMatchX = 0, wMatchY = 0;

    const getOverlap = (min2, max2, s1List) => {
        let overlaps = [];
        s1List.forEach(s1 => {
            let start = Math.max(min2, s1.min);
            let end = Math.min(max2, s1.max);
            if (start < end) overlaps.push({ start, end });
        });
        overlaps.sort((a, b) => a.start - b.start);
        let merged = [];
        for (let o of overlaps) {
            if (merged.length === 0) merged.push(o);
            else {
                let last = merged[merged.length - 1];
                if (o.start <= last.end) last.end = Math.max(last.end, o.end);
                else merged.push(o);
            }
        }
        return merged.reduce((sum, o) => sum + (o.end - o.start), 0);
    };

    w2F.forEach(w2 => {
        let dx = Math.abs(w2.p2.x - w2.p1.x);
        let dy = Math.abs(w2.p2.y - w2.p1.y);
        let len = Math.sqrt(dx * dx + dy * dy) / 1000;
        if (len === 0) return;

        if (dx > dy) {
            wLen2FX += len;
            let cy2 = (w2.p1.y + w2.p2.y) / 2;
            let target1F = w1F.filter(w1 => {
                let dx1 = Math.abs(w1.p2.x - w1.p1.x), dy1 = Math.abs(w1.p2.y - w1.p1.y);
                if (dy1 >= dx1) return false;
                let cy1 = (w1.p1.y + w1.p2.y) / 2;
                return Math.abs(cy2 - cy1) < 100;
            }).map(w1 => ({ min: Math.min(w1.p1.x, w1.p2.x), max: Math.max(w1.p1.x, w1.p2.x) }));
            let min2 = Math.min(w2.p1.x, w2.p2.x), max2 = Math.max(w2.p1.x, w2.p2.x);
            wMatchX += getOverlap(min2, max2, target1F) / 1000;
        } else {
            wLen2FY += len;
            let cx2 = (w2.p1.x + w2.p2.x) / 2;
            let target1F = w1F.filter(w1 => {
                let dx1 = Math.abs(w1.p2.x - w1.p1.x), dy1 = Math.abs(w1.p2.y - w1.p1.y);
                if (dx1 > dy1) return false;
                let cx1 = (w1.p1.x + w1.p2.x) / 2;
                return Math.abs(cx2 - cx1) < 100;
            }).map(w1 => ({ min: Math.min(w1.p1.y, w1.p2.y), max: Math.max(w1.p1.y, w1.p2.y) }));
            let min2 = Math.min(w2.p1.y, w2.p2.y), max2 = Math.max(w2.p1.y, w2.p2.y);
            wMatchY += getOverlap(min2, max2, target1F) / 1000;
        }
    });

    let wRatioX = wLen2FX > 0 ? (wMatchX / wLen2FX) * 100 : 0;
    let wRatioY = wLen2FY > 0 ? (wMatchY / wLen2FY) * 100 : 0;
    let wRatioTotal = (wLen2FX + wLen2FY) > 0 ? ((wMatchX + wMatchY) / (wLen2FX + wLen2FY)) * 100 : 0;

    return {
        pRatio, pCount2F, pMatch,
        wRatioX, wLen2FX, wMatchX,
        wRatioY, wLen2FY, wMatchY,
        wRatioTotal, wLenTotal: wLen2FX + wLen2FY, wMatchTotal: wMatchX + wMatchY
    };
}

/**
 * [バグ修正 亀甲分割ロジック復旧] 入力ポリゴンを直線 Ax + By + C <= 0 でクリッピングする
 */
function clipPolygonStrict(poly, a, b, c) {
    const out = [];
    if (!poly || poly.length === 0) return out;
    const isInside = (p) => a * p.x + b * p.y + c <= 1e-6;
    const intersect = (p1, p2) => {
        const d1 = a * p1.x + b * p1.y + c;
        const d2 = a * p2.x + b * p2.y + c;
        const t = d1 / (d1 - d2);
        return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
    };
    for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i === 0 ? poly.length - 1 : i - 1];
        const p2 = poly[i];
        if (isInside(p2)) {
            if (!isInside(p1)) out.push(intersect(p1, p2));
            out.push(p2);
        } else if (isInside(p1)) {
            out.push(intersect(p1, p2));
        }
    }
    return out;
}

/**
 * [バグ修正 亀甲分割ロジック復旧] 重複頂点を削除
 */
function dedupPolygon(poly, eps = 5) {
    if (!poly || poly.length < 2) return poly;
    const out = [poly[0]];
    for (let i = 1; i < poly.length; i++) {
        const p1 = out[out.length - 1];
        const p2 = poly[i];
        if (Math.hypot(p1.x - p2.x, p1.y - p2.y) > eps) out.push(p2);
    }
    if (out.length > 2) {
        if (Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < eps) out.pop();
    }
    return out;
}

/**
 * [バグ修正 亀甲分割ロジック復旧] 多角形の面積を厳密に計算
 */
function calcPolygonAreaStrict(poly) {
    if (!poly || poly.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        area += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
    }
    return Math.abs(area) / 2;
}

/**
 * [バグ修正 亀甲分割ロジック復旧] 点(px,py)から線分(ax,ay)-(bx,by)への最短距離
 */
function distToBeamLine(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * [バグ修正 亀甲分割ロジック復旧]
 * 提供された本来の正しい幾何アルゴリズム（ハーフプレーンクリッピング）による亀甲分割
 */
function calculateSlabTributary(slabs, beams) {
    if (!slabs || slabs.length === 0) return;

    // 基礎梁の荷重情報を初期化
    (beams || []).forEach(b => {
        b.slabLoad = 0;
        b.tributaryArea = 0;
        b.tributaryWidth = 0;
    });

    const triMult = (typeof window !== 'undefined' && window.AppState?.triangleMultiplier) || 1.33;
    const gPressure = (typeof window !== 'undefined' && window.AppState?.averageGroundPressure) || 15.0;

    slabs.forEach(slab => {
        if (!slab.vertices || slab.vertices.length < 3) {
            slab.tributaryPolygons = [];
            slab.edgeLs = [];
            return;
        }

        let initialPts = slab.vertices.map(v => ({ x: v.x, y: v.y }));
        
        // [バグ修正 法線ベクトルの反転防止] 1. 向きのCCW正規化
        let signedArea = 0;
        for (let i = 0; i < initialPts.length; i++) {
            const p1 = initialPts[i];
            const p2 = initialPts[(i + 1) % initialPts.length];
            signedArea += (p1.x * p2.y - p2.x * p1.y);
        }
        // 数学的な反時計回り(signedArea > 0)に正規化
        if (signedArea < 0) {
            initialPts.reverse();
        }
        
        const n = initialPts.length;
        const edges = [];
        for (let i = 0; i < n; i++) {
            const p1 = initialPts[i];
            const p2 = initialPts[(i + 1) % n];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const L = Math.hypot(dx, dy);
            // [バグ修正 法線ベクトルの反転防止] 内向き法線 (-dy/L, dx/L)
            const nx = -dy / (L || 1);
            const ny = dx / (L || 1);
            edges.push({ p1, p2, nx, ny, d: nx * p1.x + ny * p1.y, L });
        }

        const tributaryPolygons = [];
        const edgeLs = [];

        for (let i = 0; i < n; i++) {
            let poly = [...initialPts];
            const Ei = edges[i];

            for (let j = 0; j < n; j++) {
                if (i === j) continue;
                const Ej = edges[j];
                const coeffA = Ei.nx - Ej.nx;
                const coeffB = Ei.ny - Ej.ny;
                const coeffC = Ej.d - Ei.d;
                if (Math.abs(coeffA) > 1e-7 || Math.abs(coeffB) > 1e-7) {
                    poly = clipPolygonStrict(poly, coeffA, coeffB, coeffC);
                }
            }

            poly = dedupPolygon(poly, 5);
            const area = calcPolygonAreaStrict(poly);
            const L = Ei.L || 1;
            
            if (area > 100) {
                // [機能追加 三角形状割増しの全体設定化] ポリゴンが三角形の場合は全体設定の割増係数（triMult）を適用
                let currentWidth = area / L;
                if (poly.length === 3) {
                    currentWidth = (area * triMult) / L;
                }

                const tribEntry = { beamId: null, polygon: poly, area: area, width: currentWidth, edgeLength: L };
                tributaryPolygons.push(tribEntry);
                edgeLs.push(currentWidth);

                const mx = (Ei.p1.x + Ei.p2.x) / 2;
                const my = (Ei.p1.y + Ei.p2.y) / 2;

                let bestBeam = null;
                let minDist = 50; 
                (beams || []).forEach(b => {
                    if (!b.p1 || !b.p2) return;
                    const d = distToBeamLine(mx, my, b.p1.x, b.p1.y, b.p2.x, b.p2.y);
                    if (d < minDist) {
                        minDist = d;
                        bestBeam = b;
                    }
                });

                if (bestBeam) {
                    tribEntry.beamId = bestBeam.id;
                    bestBeam.tributaryArea += area;
                    bestBeam.tributaryWidth += currentWidth;
                    // [バグ修正] 面積(mm2) -> m2 に変換 (1e6) して荷重計算
                    bestBeam.slabLoad += (area / 1000000) * gPressure;
                }
            } else {
                edgeLs.push(0);
            }
        }
        slab.tributaryPolygons = tributaryPolygons;
        slab.edgeLs = edgeLs;
    });
}

/**
 * [基礎計算追加 Phase3]
 * 外壁線の総延長を計算する（デバッグ用）
 * @param {Array} exteriorWalls - AppState.exteriorWalls
 * @returns {number} 総延長（mm）
 */
function calcExteriorWallTotalLength(exteriorWalls) {
    let totalLength = 0;
    (exteriorWalls || []).forEach(ew => {
        if (!ew.vertices || ew.vertices.length < 2) return;
        const vts = ew.closed ? [...ew.vertices, ew.vertices[0]] : ew.vertices;
        for (let i = 0; i < vts.length - 1; i++) {
            totalLength += Math.hypot(vts[i + 1].x - vts[i].x, vts[i + 1].y - vts[i].y);
        }
    });
    return totalLength;
}

/**
 * [バグ修正 NaNカスケード防止と描画復旧] 平均接地圧の算出
 * 建物総重量（各階面積 × 仕様ごとの単位荷重）をもとに平均接地圧を算出します。
 */
function updateAverageGroundPressure() {
    // 1. 各階床面積の取得 (UI入力または自動計算を採用)
    const a1 = Number(getVal('a-f1')) || 0;
    const a2 = Number(getVal('a-f2')) || 0;
    
    // 2. 屋根面積の推定 (安全側に最大階床面積)
    const aRoof = Math.max(a1, a2);
    
    // 3. 単位荷重の取得 (kN/m2)
    const wRoof = (Number(window.AppState.roofWeight || 0) + Number(window.AppState.solarWeight || 0) + Number(window.AppState.ceilingInsWeight || 0)) / 1000;
    const wFloor = 2.4; // 床固定荷重+積載荷重
    
    // 4. 外壁荷重の推定
    const wWallSpec = (Number(window.AppState.exteriorWallWeight || 0) + Number(window.AppState.wallInsWeight || 0)) / 1000;
    const aWallEst = (a1 + a2) * 1.0; 
    
    // 5. 建物重量 (kN) - 上部構造のみ
    const buildingW = (a1 * wFloor) + (a2 * wFloor) + (aRoof * wRoof) + (aWallEst * wWallSpec);
    
    // 6. 基礎自重の推定 (スラブ合計面積から算出)
    const totalSlabArea = (window.AppState.foundationSlabs || []).reduce((sum, s) => {
        const area = (typeof polygonArea === 'function') ? polygonArea(s.vertices) : 0;
        return sum + (Number(area) / 1000000);
    }, 0) || 0;
    
    // 基礎自重 (kN) : 5.0 kN/m2 (概算)
    const foundationW = totalSlabArea * 5.0;
    const totalW = buildingW + foundationW;
    
    // 7. 平均接地圧 (kN/m2) の保存
    if (totalSlabArea > 0) {
        window.AppState.averageBuildingPressure = buildingW / totalSlabArea;
        window.AppState.averageGroundPressure = totalW / totalSlabArea;
        console.log(`[バグ修正] 接地圧算出: 建物分=${window.AppState.averageBuildingPressure.toFixed(2)}kN/㎡, 合計=${window.AppState.averageGroundPressure.toFixed(2)}kN/㎡`);
    } else {
        window.AppState.averageBuildingPressure = 0;
        window.AppState.averageGroundPressure = 0;
    }
}
