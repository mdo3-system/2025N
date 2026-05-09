/**
 * EngineNValue.js
 * 柱のN値計算、引抜力計算、金物判定、有効細長比計算を行うモジュール
 */

// 告示第1460号 表3-14: 筋交い補正値算出
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

// 接続壁から引抜力（α）を集計する
function collectAlpha(targetPillarId, targetFloor, refP, walls) {
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

            let isP1 = w.p1.id === targetPillarId;
            let isBrace = [1.0, 1.5, 2.0, 3.0, 4.0].includes(tv);
            let braceObj = isBrace ? { m: tv, type: isP1 ? 'P1' : 'P2' } : null;

            // 角度による斜め・基本の判定 (10mm以上のズレ)
            let isDiag = (dx > 10 && dy > 10);

            // N値計算のセオリー：斜め壁は按分せず、元の倍率(tv)をそのまま100%引抜力として扱う
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
        parts.X = [`(${strX})`];
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
}

export function calculateNValues(pillars, walls, params) {
    const { h1, h2, wRoof, wFloor, hwList, p_d1, p_d2, getPillarName } = params;

    const pillars2F = pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === '2F');
    let map2FByName = {};
    pillars2F.forEach(p => {
        let nm = getPillarName(p);
        if (nm && nm !== '位置不明') map2FByName[nm] = p;
    });

    const xs2F = pillars2F.map(p => p.x), ys2F = pillars2F.map(p => p.y);
    const bb2F = (xs2F.length > 0) ? { minX: Math.min(...xs2F), maxX: Math.max(...xs2F), minY: Math.min(...ys2F), maxY: Math.max(...ys2F) } : null;

    const has2FAbove = (p) => {
        let nm = getPillarName(p);
        if (map2FByName[nm]) return true;
        if (bb2F && p.x >= bb2F.minX && p.x <= bb2F.maxX && p.y >= bb2F.minY && p.y <= bb2F.maxY) return true;
        return false;
    };

    // 2Fのアルファ集計
    pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === '2F').forEach(p => {
        const isC = p.isManualCorner !== null ? p.isManualCorner : p.isCornerAuto;
        p.isC = isC;
        const { aL, aR, aB, aT, parts } = collectAlpha(p.id, '2F', p, walls);
        p.Ax = Math.abs(aR - aL); p.Ay = Math.abs(aT - aB); p._parts = parts;
    });

    // 本計算
    ['2F', '1F'].forEach(f => {
        pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === f).forEach(p => {
            const isC = p.isManualCorner !== null ? p.isManualCorner : p.isCornerAuto;
            p.isC = isC;
            const b = isC ? 0.8 : 0.5;

            const baseH = f === '1F' ? h1 : h2;
            const p_h = p.manualH || baseH;
            const p_d = p.manualD || (f === '1F' ? p_d1 : p_d2) || 105;

            const l_0 = p_h;
            const lambda = (l_0 * 1000 * Math.sqrt(12)) / p_d;

            p.d = p_d;
            p.l_0 = l_0;
            p.lambda = lambda;
            p.lambdaOK = lambda <= 150;

            const calc_H = p_h <= 3.2 ? 2.7 : p_h;
            const k_p = calc_H / 2.7;

            let usedArea = p.manualArea !== null && p.manualArea !== undefined ? p.manualArea : (p.autoArea || 0);
            p.usedArea = usedArea;
            let isDetail = p.lCalcMode === 'detail';

            if (f === '1F') {
                p.h1 = p_h;
                let nm = getPillarName(p);
                const upper = map2FByName[nm] || null;
                p.h2 = upper ? (upper.manualH || h2) : null;

                const underUpper = has2FAbove(p);
                const { aL, aR, aB, aT, parts } = collectAlpha(p.id, '1F', p, walls);
                const Ax1 = Math.abs(aR - aL), Ay1 = Math.abs(aT - aB);
                p.Ax = Ax1; p.Ay = Ay1;

                let L = 0;
                if (isDetail) {
                    let unitLoad = underUpper ? (wRoof + wFloor) : wRoof;
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
