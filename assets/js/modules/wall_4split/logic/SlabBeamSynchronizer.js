/**
 * logic/SlabBeamSynchronizer.js - 基礎スラブ・基礎梁 荷重同期・按分モジュール
 * v3.0.1 Modular Refactoring
 * 
 * [最重要構造大原則]:
 * 1. 通り芯は設計意図に基づき配置される。
 * 2. 柱・壁・基礎梁・スラブ端点はすべてグリッド（通り芯）の交点に1mm単位で厳密に配置される。
 * 3. 基礎梁は始点と終点を結ぶ直線であり、斜め梁も許容される。
 */

window.SlabBeamSynchronizer = {
    /**
     * スラブの分配ポリゴン (tributaryPolygons) から、梁の各スパンへの負担幅と接地圧の按分・同期計算を行います
     * @param {Array} slabs - スラブオブジェクトの配列
     * @param {Object} beam - 解析対象の基礎梁オブジェクト
     * @param {Object} span - 解析対象のスパン (p1 - p2)
     * @param {Object} state - アプリケーション状態
     * @returns {Object} { B: totalB, sigma: finalSigma } - 按分後の全負担幅と加重平均接地圧
     */
    calculateSpanSlabLoad: function(slabs, beam, span, state) {
        const s = state || window.AppState;
        const p1 = span.p1; // 始点柱 (globalX, globalY)
        const p2 = span.p2; // 終点柱 (globalX, globalY)

        const x1 = p1.globalX, y1 = p1.globalY;
        const x2 = p2.globalX, y2 = p2.globalY;
        const L_span = Math.hypot(x2 - x1, y2 - y1);
        if (L_span < 1.0) {
            return { B: 0, sigma: s.averageGroundPressure || 12.0 };
        }

        const isVertical = Math.abs(x2 - x1) < Math.abs(y2 - y1);
        
        let B_side1 = 0, B_side2 = 0;
        let sigma_B_side1 = 0, sigma_B_side2 = 0;

        (slabs || []).forEach(slab => {
            const qSlab = slab.fdStress ? slab.fdStress.qTotal : 12.0;
            (slab.tributaryPolygons || []).forEach(tp => {
                // [超重要改善] すでに分配アルゴリズムにより beamId がこの梁に一致している場合は、
                // 重心の距離判定をバイパスし、確実に按分同期対象とする。
                const isMyBeam = (tp.beamId === beam.id);

                const mx = tp.mx !== undefined ? tp.mx : (tp.polygon[0].x + tp.polygon[1].x) / 2;
                const my = tp.my !== undefined ? tp.my : (tp.polygon[0].y + tp.polygon[1].y) / 2;

                if (!isMyBeam) {
                    // 紐付いておらず、かつ重心が梁軸から遠いものは除外
                    const dist = window.FoundationEngine._distToSegment(mx, my, { x: x1, y: y1 }, { x: x2, y: y2 });
                    if (dist >= 150) return;
                }

                // スラブ分配ポリゴンの座標バウンディングボックスの取得
                const polyX = tp.polygon.map(pt => pt.x);
                const polyY = tp.polygon.map(pt => pt.y);
                const minPx = Math.min(...polyX), maxPx = Math.max(...polyX);
                const minPy = Math.min(...polyY), maxPy = Math.max(...polyY);

                let overlap = 0;
                if (isVertical) {
                    // Y軸方向の重複長
                    const sMin = Math.min(y1, y2);
                    const sMax = Math.max(y1, y2);
                    overlap = Math.max(0, Math.min(maxPy, sMax) - Math.max(minPy, sMin));
                } else {
                    // X軸方向の重複長
                    const sMin = Math.min(x1, x2);
                    const sMax = Math.max(x1, x2);
                    overlap = Math.max(0, Math.min(maxPx, sMax) - Math.max(minPx, sMin));
                }

                // 重複が検出されない場合、重心（代表点）がスパン内にあるかをチェックするフォールバック
                if (overlap <= 0.1) {
                    const sMin = isVertical ? Math.min(y1, y2) : Math.min(x1, x2);
                    const sMax = isVertical ? Math.max(y1, y2) : Math.max(x1, x2);
                    const mVal = isVertical ? my : mx;
                    if (mVal >= sMin && mVal <= sMax) {
                        overlap = L_span; // 簡略的にスパン全体に載っているとみなす
                    } else {
                        return; // 重複なし
                    }
                }

                // 按分比率
                const ratio = overlap / L_span;
                const B_part = tp.width * ratio;
                const sigma_part = qSlab;

                // 梁の右側/左側のサイド判定 (外積)
                const dx = x2 - x1;
                const dy = y2 - y1;
                const crossProduct = (mx - x1) * dy - (my - y1) * dx;
                const side = crossProduct >= 0 ? 1 : -1;

                if (side === 1) {
                    B_side1 += B_part;
                    sigma_B_side1 += sigma_part * B_part;
                } else {
                    B_side2 += B_part;
                    sigma_B_side2 += sigma_part * B_part;
                }
            });
        });

        const totalB = B_side1 + B_side2;
        let finalSigma = s.averageGroundPressure || 12.0;
        if (totalB > 0.001) {
            finalSigma = (sigma_B_side1 + sigma_B_side2) / totalB;
        }

        return { B: totalB, sigma: finalSigma };
    }
};
