/**
 * EngineCenterOfGravity.js
 * 床面積ポリゴンまたは柱座標群から階ごとの重心を計算するロジックモジュール
 */

import { Geometry } from './MathUtils.js';

export function calculateCenterOfGravity(floor, areaLines, pillars) {
    let Gx = 0;
    let Gy = 0;
    let isApproximation = false; // 略算（柱座標の平均）かどうか
    let details = {}; // 算出根拠用

    // 「床面積」の図形を取得（小屋裏・バルコニー等を除外するため、無指定か'floor'のみ）
    let polys = areaLines.filter(a => a.floor === floor && (!a.areaType || a.areaType === 'floor'));

    if (polys.length > 0) {
        let totalArea = 0, sumCx = 0, sumCy = 0;
        polys.forEach(poly => {
            let c = Geometry.polygonCentroid(poly.vertices);
            if (c && c.area > 0) { 
                totalArea += c.area; 
                sumCx += c.x * c.area; 
                sumCy += c.y * c.area; 
            }
        });
        if (totalArea > 0) { 
            Gx = sumCx / totalArea; 
            Gy = sumCy / totalArea; 
            details = { method: 'polygon', totalArea, sumCx, sumCy };
        }
    }

    // 床面積ポリゴンが存在しない、あるいは面積ゼロの場合は柱座標の平均で略算する
    if (Gx === 0 && Gy === 0) {
        let ap = pillars.filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === floor || p.floor === 'ALL'));
        let spx = 0, spy = 0, pc = ap.length;
        ap.forEach(p => { spx += p.x; spy += p.y; });
        Gx = pc > 0 ? spx / pc : 0; 
        Gy = pc > 0 ? spy / pc : 0;
        isApproximation = true;
        details = { method: 'pillar_average', pillarCount: pc, sumX: spx, sumY: spy };
    }

    return {
        Gx,
        Gy,
        isApproximation,
        details
    };
}
