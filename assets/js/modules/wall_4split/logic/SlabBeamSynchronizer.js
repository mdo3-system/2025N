/**
 * logic/SlabBeamSynchronizer.js - 基礎スラブ・基礎梁 荷重同期・按分モジュール
 * v3.0.2 Modular Refactoring
 * 
 * [最重要構造大原則]:
 * 1. 通り芯は設計意図に基づき配置される。
 * 2. 柱・壁・基礎梁・スラブ端点はすべてグリッド（通り芯）の交点に1mm単位で厳密に配置される。
 * 3. 基礎梁は始点と終点を結ぶ直線であり、斜め梁も許容される。
 */

window.SlabBeamSynchronizer = {
    /**
     * CCW (Counter Clockwise) 法を用いた線分交差判定
     * @param {Object} a - 線分1の端点1 {x, y}
     * @param {Object} b - 線分1の端点2 {x, y}
     * @param {Object} c - 線分2의 端点1 {x, y}
     * @param {Object} d - 線分2の端点2 {x, y}
     * @returns {boolean} 交差していればtrue
     */
    isSegmentsIntersect: function(a, b, c, d) {
        const ccw = (p1, p2, p3) => {
            return (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
        };
        return (ccw(a, c, d) !== ccw(b, c, d)) && (ccw(a, b, c) !== ccw(a, b, d));
    },

    /**
     * レイキャスティング法を用いた点の内包判定
     * @param {Object} p - 判定対象の点 {x, y}
     * @param {Array} polygon - 多角形の頂点リスト [{x, y}]
     * @returns {boolean} 内包されていればtrue
     */
    isPointInPolygon: function(p, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            const intersect = ((yi > p.y) !== (yj > p.y))
                && (p.x < (xj - xi) * (p.y - yi) / (yj - yi || 1) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    },

    /**
     * 線分が多角形の内部を通過する実際の長さを算出する
     * @param {number} x1 - 始点X
     * @param {number} y1 - 始点Y
     * @param {number} x2 - 終点X
     * @param {number} y2 - 終点Y
     * @param {Array} polygon - 多角形の頂点リスト [{x, y}]
     * @returns {number} 通過長さ (mm)
     */
    getOverlapLengthInPolygon: function(x1, y1, x2, y2, polygon) {
        const p1 = { x: x1, y: y1 };
        const p2 = { x: x2, y: y2 };
        const L_span = Math.hypot(x2 - x1, y2 - y1);
        if (L_span < 0.1) return 0;

        const getIntersectionT = (pa, pb, pc, pd) => {
            const denom = (pd.y - pc.y) * (pb.x - pa.x) - (pd.x - pc.x) * (pb.y - pa.y);
            if (denom === 0) return null; // 平行
            const ua = ((pd.x - pc.x) * (pa.y - pc.y) - (pd.y - pc.y) * (pa.x - pc.x)) / denom;
            const ub = ((pb.x - pa.x) * (pa.y - pc.y) - (pb.y - pa.y) * (pa.x - pc.x)) / denom;
            if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
                return ua;
            }
            return null;
        };

        // 1. すべての交点パラメータ t を取得
        const tList = [0, 1]; // 始点と終点
        const N = polygon.length;
        for (let i = 0; i < N; i++) {
            const p3 = polygon[i];
            const p4 = polygon[(i + 1) % N];
            const t = getIntersectionT(p1, p2, p3, p4);
            if (t !== null && t > 0.0001 && t < 0.9999) {
                tList.push(t);
            }
        }

        // 2. パラメータ t を昇順ソートして重複を排除
        tList.sort((a, b) => a - b);
        const uniqueT = [];
        for (let i = 0; i < tList.length; i++) {
            if (i === 0 || tList[i] - tList[i - 1] > 0.0001) {
                uniqueT.push(tList[i]);
            }
        }

        // 3. 各区間の中点が多角形内にあるか判定し、内包される区間の長さを合計
        let intersectLength = 0;
        for (let i = 0; i < uniqueT.length - 1; i++) {
            const tStart = uniqueT[i];
            const tEnd = uniqueT[i + 1];
            const tMid = (tStart + tEnd) / 2;
            const midPoint = {
                x: x1 + tMid * (x2 - x1),
                y: y1 + tMid * (y2 - y1)
            };

            if (this.isPointInPolygon(midPoint, polygon)) {
                intersectLength += (tEnd - tStart) * L_span;
            }
        }

        return intersectLength;
    },

    /**
     * スラブの分配ポリゴン (tributaryPolygons) から、梁の各スパンへの負担幅と接地圧の按分・同期計算を行います
     * @param {Array} slabs - スラブオブジェクト의 配列
     * @param {Object} beam - 解析対象の基礎梁オブジェクト
     * @param {Object} span - 解析対象のスパン (p1 - p2)
     * @param {Object} state - アプリケーション状態
     * @returns {Object} { B: totalB, sigma: finalSigma, isSyncFailed: boolean } - 按分後の全負担幅と加重平均接地圧、および同期失敗フラグ
     */
    calculateSpanSlabLoad: function(slabs, beam, span, state) {
        const s = state || window.AppState;
        const p1 = span.p1; // 始点柱 (globalX, globalY)
        const p2 = span.p2; // 終点柱 (globalX, globalY)

        // [本質的解決1] 座標をミリメートル単位（整数値）に四捨五入して丸めることで浮動小数点の「微妙なズレ」を完全排除
        const x1 = Math.round(p1.globalX);
        const y1 = Math.round(p1.globalY);
        const x2 = Math.round(p2.globalX);
        const y2 = Math.round(p2.globalY);

        const L_span = Math.hypot(x2 - x1, y2 - y1);
        if (L_span < 0.1) {
            // [本質的解決2] ゼロ除算を避ける極小値チェックに変更し、平均接地圧へのサイレントフォールバックを完全廃止
            return { B: 0, sigma: 0, isSyncFailed: true };
        }

        // [v2.5.0] Calculate normalized directional vector for the beam
        const uX = (x2 - x1) / L_span;
        const uY = (y2 - y1) / L_span;
        
        let B_side1 = 0, B_side2 = 0;
        let sigma_B_side1 = 0, sigma_B_side2 = 0;

        (slabs || []).forEach(slab => {
            const qSlab = slab.fdStress ? slab.fdStress.qTotal : 12.0;
            (slab.tributaryPolygons || []).forEach(tp => {
                // [超重要改善] すでに分配アルゴリズムにより beamId がこの梁に一致している場合は、
                // 重心の距離判定をバイパスし、確実に按分同期対象とする。
                const isMyBeam = (tp.beamId === beam.id);

                // [本質的解決1] スラブ分配ポリゴンの頂点座標も四捨五入して丸める
                const roundedPolygon = (tp.polygon || []).map(pt => ({
                    x: Math.round(pt.x),
                    y: Math.round(pt.y)
                }));

                if (roundedPolygon.length === 0) return;

                const mx = tp.mx !== undefined ? Math.round(tp.mx) : roundedPolygon.reduce((sum, pt) => sum + pt.x, 0) / roundedPolygon.length;
                const my = tp.my !== undefined ? Math.round(tp.my) : roundedPolygon.reduce((sum, pt) => sum + pt.y, 0) / roundedPolygon.length;

                if (!isMyBeam) {
                    // 紐付いていない場合、ポリゴンのいずれかの頂点がこの梁の「直線（延長線）」上にあるか（距離150未満か）を判定する
                    const distToLine = (px, py) => {
                        const l2 = (x2 - x1)**2 + (y2 - y1)**2;
                        if (l2 === 0) return Math.hypot(px - x1, py - y1);
                        const t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
                        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
                    };
                    const minLineDist = Math.min(...roundedPolygon.map(pt => distToLine(pt.x, pt.y)));
                    
                    // [v2.6.7] 片持ち梁等での幾何判定漏れを防ぐため、スラブ重心から梁スパン（線分）への距離もチェックする
                    const distCentroidToSpan = () => {
                        const l2 = (x2 - x1)**2 + (y2 - y1)**2;
                        if (l2 === 0) return Math.hypot(mx - x1, my - y1);
                        let t = ((mx - x1) * (x2 - x1) + (my - y1) * (y2 - y1)) / l2;
                        t = Math.max(0, Math.min(1, t)); // 線分内にクランプ
                        return Math.hypot(mx - (x1 + t * (x2 - x1)), my - (y1 + t * (y2 - y1)));
                    };

                    if (minLineDist >= 150 && distCentroidToSpan() >= 250) return;
                }

                // [v2.5.0] Project polygon vertices onto the beam vector to calculate true 1D overlap
                const polyT = roundedPolygon.map(pt => (pt.x - x1) * uX + (pt.y - y1) * uY);
                const minT = Math.min(...polyT);
                const maxT = Math.max(...polyT);
                
                let overlap = Math.max(0, Math.min(maxT, L_span) - Math.max(minT, 0));

                // [本質的解決3] 幾何学的に重なっていない梁に対して誤同期させる危険な重心投影フォールバックを完全削除
                // ただし、直交・貫通する基礎梁（overlap <= 0.1）に対しては、物理的な交差・内包判定により救済を行う
                if (overlap <= 0.1) {
                    let hasIntersection = false;
                    const pPoint1 = { x: x1, y: y1 };
                    const pPoint2 = { x: x2, y: y2 };
                    const N = roundedPolygon.length;

                    // 1. 端点の内包判定
                    if (this.isPointInPolygon(pPoint1, roundedPolygon) || this.isPointInPolygon(pPoint2, roundedPolygon)) {
                        hasIntersection = true;
                    }

                    // 2. 梁線分と分配ポリゴン辺の交差判定
                    if (!hasIntersection) {
                        for (let i = 0; i < N; i++) {
                            const p3 = roundedPolygon[i];
                            const p4 = roundedPolygon[(i + 1) % N];
                            if (this.isSegmentsIntersect(pPoint1, pPoint2, p3, p4)) {
                                hasIntersection = true;
                                break;
                            }
                        }
                    }

                    if (hasIntersection) {
                        // 3. 多角形内の通過長さを計算
                        const intersectLength = this.getOverlapLengthInPolygon(x1, y1, x2, y2, roundedPolygon);
                        // 境界線上のわずかな交差判定ズレを防ぐため、10.0mm未満の極小通過長さの場合は
                        // 安全側にスパン全体が載っているとみなす（セーフガード）
                        overlap = Math.max(intersectLength, 10.0);
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
        let finalSigma = 0; // [v2.6.7] サイレントな初期値フォールバックを完全廃止
        let isSyncFailed = false;

        if (totalB > 0.001) {
            finalSigma = (sigma_B_side1 + sigma_B_side2) / totalB;
        } else {
            isSyncFailed = true; // スラブ接地圧が取得できなかったことを明示
        }

        return { B: totalB, sigma: finalSigma, isSyncFailed };
    }
};
