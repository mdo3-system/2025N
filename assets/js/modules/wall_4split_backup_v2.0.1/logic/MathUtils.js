/**
 * MathUtils.js
 * 幾何学計算、ポリゴン処理などの共通数学関数モジュール
 */

export const Geometry = {
    /**
     * ポリゴンの重心と面積を計算
     */
    polygonCentroid(pts) {
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

/**
 * 符号付きポリゴン面積
 */
export function signedPolygonArea(poly) {
    if (!poly || poly.length < 3) return 0;
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
        let j = (i + 1) % poly.length;
        a += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
    }
    return a / 2;
}

/**
 * ポリゴン面積 (絶対値)
 */
export function polygonArea(poly) {
    return Math.abs(signedPolygonArea(poly));
}

/**
 * ポリゴンを反時計回りに整列
 */
export function ensureCCW(poly) {
    if (signedPolygonArea(poly) < 0) {
        poly.reverse();
    }
}

/**
 * 半平面によるポリゴンクリッピング
 */
export function clipPolygonByHalfPlane(poly, A, B) {
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

/**
 * Voronoi領域によるクリッピング
 */
export function clipByVoronoi(subjectPolygon, clipPolygon) {
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

/**
 * 矩形によるポリゴンクリッピング (Sutherland-Hodgman)
 */
export function clipPolygonByRect(poly, minX, maxX, minY, maxY) {
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
    result = clipEdge(result, 'x', 1, minX);
    result = clipEdge(result, 'x', -1, maxX);
    result = clipEdge(result, 'y', 1, minY);
    result = clipEdge(result, 'y', -1, maxY);
    return result;
}

/**
 * 点がポリゴン内に含まれるか判定
 */
export function isPointInPolygon(p, poly) {
    let inside = false;
    let x = p.x, y = p.y;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        if (((poly[i].y > y) !== (poly[j].y > y)) && (x < (poly[j].x - poly[i].x) * (y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)) inside = !inside;
    }
    return inside;
}

/**
 * 直線 Ax + By + C <= 0 でポリゴンをクリッピング (厳密版)
 */
export function clipPolygonStrict(poly, a, b, c) {
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
 * 重複頂点を削除
 */
export function dedupPolygon(poly, eps = 5) {
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
 * 点(px,py)から線分(ax,ay)-(bx,by)への最短距離
 */
export function distToLineSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
