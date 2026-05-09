/**
 * EngineWallAmount.js
 * 存在壁量の集計、斜め壁判定、4分割エリア集計、および剛心計算を行う純粋なロジックモジュール
 */

export function calculateWallAmount(floor, walls, div4Bounds) {
    let kxt = 0; // X方向 存在壁量
    let kyt = 0; // Y方向 存在壁量
    let sx = 0;  // 剛心計算用 Xモーメント (Y壁 × X座標)
    let sy = 0;  // 剛心計算用 Yモーメント (X壁 × Y座標)

    let vxt = 0; // 4分割 X方向 上端
    let vxb = 0; // 4分割 X方向 下端
    let vyl = 0; // 4分割 Y方向 左端
    let vyr = 0; // 4分割 Y方向 右端

    let wallDetails = []; // 剛心計算などの根拠出力用

    const floorWalls = walls.filter(w => w.floor === floor);

    floorWalls.forEach(w => {
        let dx = Math.abs(w.p2.x - w.p1.x);
        let dy = Math.abs(w.p2.y - w.p1.y);
        let L_wall_mm = Math.sqrt(dx * dx + dy * dy);
        let L_wall = L_wall_mm / 1000;
        
        if (L_wall === 0) return;

        let ratioX = Math.min(1, Math.max(-1, dx / L_wall_mm));
        let ratioY = Math.min(1, Math.max(-1, dy / L_wall_mm));
        let degX = Math.acos(ratioX) * 180 / Math.PI;
        let degY = Math.acos(ratioY) * 180 / Math.PI;

        let tv = w.totalVal || 0;

        // 斜め壁の有効成分計算（1.82m未満かつ75度超えの成分は無効）
        let effX = Math.floor(tv * (ratioX * ratioX) * 100) / 100;
        let effY = Math.floor(tv * (ratioY * ratioY) * 100) / 100;
        if (degX > 75 && L_wall < 1.82) effX = 0;
        if (degY > 75 && L_wall < 1.82) effY = 0;

        // 作用位置（両端の柱の中点）
        let cx = (w.p1.x + w.p2.x) / 2;
        let cy = (w.p1.y + w.p2.y) / 2;

        let kx = Math.floor(L_wall * effX * 100) / 100;
        let ky = Math.floor(L_wall * effY * 100) / 100;

        kxt += kx; 
        sy += kx * cy; 
        
        kyt += ky; 
        sx += ky * cx;

        if (div4Bounds) {
            if (cy >= div4Bounds.yTop) vxt += kx;
            if (cy <= div4Bounds.yBottom) vxb += kx;
            if (cx <= div4Bounds.xLeft) vyl += ky;
            if (cx >= div4Bounds.xRight) vyr += ky;
        }

        wallDetails.push({
            id: w.id, p1: w.p1, p2: w.p2, L_wall, tv, effX, effY, kx, ky, cx, cy
        });
    });

    // 剛心の算出
    let Cx = kyt > 0 ? (sx / kyt) : 0;
    let Cy = kxt > 0 ? (sy / kxt) : 0;

    return {
        existX: kxt,
        existY: kyt,
        sx: sx,
        sy: sy,
        Cx: Cx,
        Cy: Cy,
        div4: {
            vxt, vxb, vyl, vyr
        },
        details: wallDetails
    };
}

export function evaluate4SplitBalance(floor, existDiv4, reqDiv4Base, cq) {
    // 側端ごとの必要壁量
    let req_xt = reqDiv4Base.ext * cq;
    let req_xb = reqDiv4Base.exb * cq;
    let req_yl = reqDiv4Base.eyl * cq;
    let req_yr = reqDiv4Base.eyr * cq;

    // 充足率
    let rt_xt = existDiv4.vxt / (req_xt || 1);
    let rt_xb = existDiv4.vxb / (req_xb || 1);
    let rt_yl = existDiv4.vyl / (req_yl || 1);
    let rt_yr = existDiv4.vyr / (req_yr || 1);

    // 壁率比
    let rx = Math.min(rt_xt, rt_xb) / (Math.max(rt_xt, rt_xb) || 1);
    let ry = Math.min(rt_yl, rt_yr) / (Math.max(rt_yl, rt_yr) || 1);

    // 判定 (壁率比0.5以上、または両側端とも充足率1.0以上ならOK)
    let isXOk = (rx >= 0.5) || (rt_xt >= 1.0 && rt_xb >= 1.0);
    let isYOk = (ry >= 0.5) || (rt_yl >= 1.0 && rt_yr >= 1.0);
    let isOk = isXOk && isYOk;

    return {
        req_xt, req_xb, req_yl, req_yr,
        rt_xt, rt_xb, rt_yl, rt_yr,
        rx, ry,
        isXOk, isYOk, isOk
    };
}
