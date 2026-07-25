/**
 * view/ReportMitsukeView.js - Mitsuke (Projected Elevation Area) Canvas Generator
 * v3.3.0 Refactoring: Single Responsibility Principle - Pure View for Mitsuke area auto-generation
 */

window.ReportMitsukeView = {
    /**
     * 見附面積キャンバスを自動生成
     * @param {string} direction - 方向 ('X' or 'Y')
     * @param {number} commonScale - 共通スケール値
     * @returns {object|null} { img: dataURL, area: number } または null
     */
    generateAutoMitsukeCanvas: function(direction, commonScale) {
        return generateAutoMitsukeCanvas_inner(direction, commonScale);
    }
};

// Inner implementation (extracted from wall_4split_pdf.js)
function generateAutoMitsukeCanvas_inner(direction, commonScale) {
    const s = window.AppState;
    if (!s || !s.config) return null;

    const config = s.config;
    const wallThick = parseFloat(config.wallThickness ?? 150);

    // --- GL基準高さ取得 ---
    const lvl = window.RoofEngine ? window.RoofEngine.getFloorLevels(s) : { FL1: 561, FL2: 3261, cut1: 1911, cut2: 4611 };

    const proj = window.MitsukeEngine && window.MitsukeEngine.generateElevationAreas ? window.MitsukeEngine.generateElevationAreas(direction, s) : null;
    if (!proj || !proj.primitives || proj.primitives.length === 0) return null;

    let uMinAll = Infinity, uMaxAll = -Infinity, zMaxAll = -Infinity;
    proj.primitives.forEach(prim => {
        prim.vertices.forEach(v => {
            if (v.u < uMinAll) uMinAll = v.u;
            if (v.u > uMaxAll) uMaxAll = v.u;
            if (v.z > zMaxAll) zMaxAll = v.z;
        });
    });
    const W = uMaxAll > uMinAll ? uMaxAll - uMinAll : 10000;
    const uMin = uMinAll;
    const uMax = uMaxAll;

    // 1F外壁、2F外壁の幅を計測（寸法線用）
    let uMin1F = Infinity, uMax1F = -Infinity;
    let uMin2F = Infinity, uMax2F = -Infinity;
    proj.primitives.forEach(prim => {
        if (prim.type === 'rect') {
            prim.vertices.forEach(v => {
                if (prim.floor === '1F') { if (v.u < uMin1F) uMin1F = v.u; if (v.u > uMax1F) uMax1F = v.u; }
                if (prim.floor === '2F') { if (v.u < uMin2F) uMin2F = v.u; if (v.u > uMax2F) uMax2F = v.u; }
            });
        }
    });

    const eavesZ2F = proj.eavesZ2F || (lvl.FL2 + 2700);
    const maxH = Math.max(zMaxAll, eavesZ2F);
    const totalH = Math.max(maxH, eavesZ2F + 1000); // キャンバス高さ基準

    // --- Canvas生成 ---
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // CADグリッド
    ctx.strokeStyle = '#f1f2f6'; ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 30) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }

    const padL = 90, padR = 400, padT = 70, padB = 60;
    const drawW = canvas.width - padL - padR;
    const drawH = canvas.height - padT - padB;

    let scale = commonScale;
    if (!scale) {
        const scaleU = drawW / W;
        const scaleZ = drawH / totalH;
        scale = Math.min(scaleU, scaleZ) * 0.90;
    }

    const toX = (u) => padL + (u - uMin) * scale;
    const toY = (z) => canvas.height - padB - z * scale;

    const primaryColor = (direction === 'X') ? '#e67e22' : '#2980b9';

    const cutY2 = toY(lvl.cut2);
    const cutY1 = toY(lvl.cut1);
    const glY   = toY(0);

    // 1. 各Primitiveを描画 (外壁と屋根) - 塗りつぶしのみ
    ctx.save();
    let clipperPolygons = []; // Clipper用ポリゴン配列
    const scaleFactor = 1000; // Clipperの整数化用

    proj.primitives.forEach(prim => {
        if (!prim.vertices || prim.vertices.length < 3) return;
        
        // Clipper用パス生成
        let path = [];
        ctx.beginPath();
        ctx.moveTo(toX(prim.vertices[0].u), toY(prim.vertices[0].z));
        path.push({ X: Math.round(prim.vertices[0].u * scaleFactor), Y: Math.round(prim.vertices[0].z * scaleFactor) });
        for (let i = 1; i < prim.vertices.length; i++) {
            ctx.lineTo(toX(prim.vertices[i].u), toY(prim.vertices[i].z));
            path.push({ X: Math.round(prim.vertices[i].u * scaleFactor), Y: Math.round(prim.vertices[i].z * scaleFactor) });
        }
        ctx.closePath();
        clipperPolygons.push(path);
        
        // 色分け (1F, 2F, 屋根)
        if (prim.name && typeof prim.name.includes === 'function' && prim.name.includes('屋根')) {
            ctx.fillStyle = (direction === 'X') ? 'rgba(230,126,34,0.3)' : 'rgba(41,128,185,0.3)';
        } else if (prim.floor === '2F') {
            ctx.fillStyle = (direction === 'X') ? 'rgba(230,126,34,0.15)' : 'rgba(41,128,185,0.15)';
        } else {
            ctx.fillStyle = (direction === 'X') ? 'rgba(230,126,34,0.05)' : 'rgba(41,128,185,0.05)';
        }
        
        ctx.fill();
        // ctx.stroke() はここでは行わない（内部の線を描かない）
    });
    ctx.restore();

    // 1.5 Clipperによる全体のシルエット（アウトライン）描画
    if (typeof ClipperLib !== 'undefined' && clipperPolygons.length > 0) {
        const cpr = new ClipperLib.Clipper();
        cpr.AddPaths(clipperPolygons, ClipperLib.PolyType.ptSubject, true);
        const solution = new ClipperLib.Paths();
        cpr.Execute(ClipperLib.ClipType.ctUnion, solution, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
        
        ctx.save();
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2; // 外周は太線
        ctx.lineJoin = 'round';
        
        solution.forEach(path => {
            if (path.length < 3) return;
            ctx.beginPath();
            ctx.moveTo(toX(path[0].X / scaleFactor), toY(path[0].Y / scaleFactor));
            for (let i = 1; i < path.length; i++) {
                ctx.lineTo(toX(path[i].X / scaleFactor), toY(path[i].Y / scaleFactor));
            }
            ctx.closePath();
            ctx.stroke();
        });
        ctx.restore();
    } else {
        // Clipperが無い場合のフォールバック（従来通りの枠線描画）
        ctx.save();
        proj.primitives.forEach(prim => {
            if (!prim.vertices || prim.vertices.length < 3) return;
            ctx.beginPath();
            ctx.moveTo(toX(prim.vertices[0].u), toY(prim.vertices[0].z));
            for (let i = 1; i < prim.vertices.length; i++) {
                ctx.lineTo(toX(prim.vertices[i].u), toY(prim.vertices[i].z));
            }
            ctx.closePath();
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = 1;
            ctx.stroke();
        });
        ctx.restore();
    }

    // 2. 分解された矩形・三角形の境界と番号を描画
    ctx.save();
    const fAreas = config.elevationFormulaAreas;
    if (fAreas) {
        const key = direction === 'X' ? 'x' : 'y';
        
        ['1F', '2F'].forEach(flr => {
            const flrItems = fAreas[flr][key] || [];
            const accentColor = flr === '2F'
                ? (direction === 'X' ? 'rgba(230,126,34,1.0)' : 'rgba(41,128,185,1.0)')
                : (direction === 'X' ? 'rgba(230,126,34,0.55)' : 'rgba(41,128,185,0.55)');

            ctx.lineWidth = 1.5;
            ctx.strokeStyle = accentColor;
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            flrItems.forEach(item => {
                const uL = item.uStart;
                const uR = item.uStart + item.w;
                const zBL = item.zBL !== undefined ? item.zBL : item.zBot;
                const zBR = item.zBR !== undefined ? item.zBR : item.zBot;
                const zTL = item.zTL !== undefined ? item.zTL : (item.zBot + (item.hL || 0));
                const zTR = item.zTR !== undefined ? item.zTR : (item.zBot + (item.hR || 0));

                // 領域の境界線 (点線) を描画
                ctx.setLineDash([4, 3]);
                ctx.strokeStyle = accentColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(toX(uL), toY(zBL));
                ctx.lineTo(toX(uR), toY(zBR));
                ctx.lineTo(toX(uR), toY(zTR));
                ctx.lineTo(toX(uL), toY(zTL));
                ctx.closePath();
                ctx.stroke();
                ctx.setLineDash([]);

                // 丸番号ラベル (A1, B1...) を描画
                const cx = toX(uL + item.w / 2);
                let centerZ = (zBL + zBR + zTL + zTR) / 4;
                if (item.type === 'tri') {
                    centerZ = (zBL + Math.max(zTL, zTR) + Math.min(zTL, zTR)) / 3;
                }
                const cz = toY(centerZ);

                const codeStr = item.code || (item.name || 'A');
                ctx.beginPath();
                ctx.arc(cx, cz, 12, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.strokeStyle = accentColor;
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.fillStyle = '#2c3e50';
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText(codeStr, cx, cz);
            });
        });
    }
    ctx.restore();
    // GL線
    ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(padL-20, glY); ctx.lineTo(padL+drawW+20, glY); ctx.stroke();
    ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#2c3e50'; ctx.textAlign = 'right';
    ctx.fillText('▼ GL', padL - 25, glY + 4);

    // 1Fカットライン (破線)
    ctx.setLineDash([8, 5]); ctx.strokeStyle = '#27ae60'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL-10, cutY1); ctx.lineTo(padL+drawW+10, cutY1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#27ae60'; ctx.textAlign = 'right';
    ctx.fillText(`▶ 1FL+1350 (${(lvl.cut1/1000).toFixed(3)}m)`, padL-14, cutY1 - 3);

    // 2Fカットライン (破線)
    ctx.setLineDash([8, 5]); ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL-10, cutY2); ctx.lineTo(padL+drawW+10, cutY2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#e74c3c'; ctx.textAlign = 'right';
    ctx.fillText(`▶ 2FL+1350 (${(lvl.cut2/1000).toFixed(3)}m)`, padL-14, cutY2 - 3);

    // 1FL・2FL線 (薄い)
    [{ z: lvl.FL1, label: `1FL (${(lvl.FL1/1000).toFixed(3)}m)`, color: '#27ae60' },
     { z: lvl.FL2, label: `2FL (${(lvl.FL2/1000).toFixed(3)}m)`, color: '#e74c3c' }
    ].forEach(({ z, label, color }) => {
        const cy = toY(z);
        ctx.setLineDash([4,4]); ctx.strokeStyle = color + '88'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padL-10, cy); ctx.lineTo(padL+drawW+10, cy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '9px sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'right';
        ctx.fillText(label, padL-14, cy + 3);
    });

    // 最高の高さ (破線)
    const maxY_maxH = toY(maxH);
    ctx.setLineDash([8, 5]); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL-10, maxY_maxH); ctx.lineTo(padL+drawW+10, maxY_maxH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#c0392b'; ctx.textAlign = 'right';
    ctx.fillText(`▶ 最高の高さ (${(maxH/1000).toFixed(3)}m)`, padL-14, maxY_maxH - 3);

    // --- CAD風寸法線の描画 ---
    const drawTick = (px, py) => {
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px - 5, py + 5);
        ctx.lineTo(px + 5, py - 5);
        ctx.stroke();
    };

    const drawHorizDim = (uStart, uEnd, zPos, valText) => {
        const x1 = toX(uStart);
        const x2 = toX(uEnd);
        const y = toY(zPos);

        // 1. 引出線 (点線)
        ctx.strokeStyle = 'rgba(127, 140, 141, 0.7)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        const zTarget = zPos > 0 ? zPos - 300 : 0;
        ctx.moveTo(x1, toY(zTarget));
        ctx.lineTo(x1, y + 8 * (zPos > 0 ? -1 : 1));
        ctx.moveTo(x2, toY(zTarget));
        ctx.lineTo(x2, y + 8 * (zPos > 0 ? -1 : 1));
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. 寸法線 (実線)
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();

        // 3. チッマーク
        drawTick(x1, y);
        drawTick(x2, y);

        // 4. テキスト (背景白矩形付き)
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(valText).width;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect((x1 + x2)/2 - tw/2 - 3, y - 6, tw + 6, 12);
        ctx.fillStyle = '#c0392b';
        ctx.fillText(valText, (x1 + x2)/2, y);
    };

    const drawVertDim = (zStart, zEnd, xPos, valText) => {
        const y1 = toY(zStart);
        const y2 = toY(zEnd);
        const x = xPos;

        // 1. 引出線 (点線)
        ctx.strokeStyle = 'rgba(127, 140, 141, 0.7)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(padL - 10, y1);
        ctx.lineTo(x - 8, y1);
        ctx.moveTo(padL - 10, y2);
        ctx.lineTo(x - 8, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. 寸法線 (実線)
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.stroke();

        // 3. チッマーク
        drawTick(x, y1);
        drawTick(x, y2);

        // 4. テキスト (背景白矩形付き)
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(valText).width;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - tw/2 - 3, (y1 + y2)/2 - 6, tw + 6, 12);
        ctx.fillStyle = '#c0392b';
        ctx.fillText(valText, x, (y1 + y2)/2);
    };

    // 水平寸法線 (建物全幅、1F壁幅、2F壁幅)
    drawHorizDim(uMin, uMax, -500, Math.round(W).toString());
    
    if (uMax1F > uMin1F) {
        drawHorizDim(uMin1F, uMax1F, (lvl.fl1 + lvl.cut1) / 2, Math.round(uMax1F - uMin1F).toString());
    }

    if (uMax2F > uMin2F) {
        drawHorizDim(uMin2F, uMax2F, (lvl.fl2 + lvl.cut2) / 2, Math.round(uMax2F - uMin2F).toString());
    }

    // 垂直寸法線 (高さ関係)
    drawVertDim(0, lvl.cut1, padL - 45, Math.round(lvl.cut1).toString());
    drawVertDim(lvl.cut1, lvl.cut2, padL - 45, Math.round(lvl.cut2 - lvl.cut1).toString());
    drawVertDim(lvl.cut2, maxH, padL - 45, Math.round(maxH - lvl.cut2).toString());
    drawVertDim(0, maxH, padL - 75, Math.round(maxH).toString());

    // --- 右側テキスト (計算式) ---
    const textL = canvas.width - padR + 40;
    let textY = padT;
    const area2F_x = window.AppState.config.projectedAreas?.['2F']?.x ?? 0;
    const area2F_y = window.AppState.config.projectedAreas?.['2F']?.y ?? 0;
    const area1F_x = window.AppState.config.projectedAreas?.['1F']?.x ?? 0;
    const area1F_y = window.AppState.config.projectedAreas?.['1F']?.y ?? 0;
    const areaShown2F = direction === 'X' ? area2F_x : area2F_y;
    const areaShown1F_add = direction === 'X' ? area1F_x : area1F_y;
    const areaTotal = areaShown2F + areaShown1F_add;

    ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${direction}方向 見付面積図 (GL基準・スキャンライン法)`, textL, textY); textY += 20;
    ctx.fillStyle = '#7f8c8d'; ctx.font = '10px sans-serif';
    ctx.fillText(`外壁: 柱芯±壁厚${wallThick}mm オフセット済`, textL, textY); textY += 14;
    ctx.fillStyle = '#d35400'; ctx.font = '9px sans-serif';
    ctx.fillText(`※棟線(水平主棟)を持つ屋根のため頂部は台形(水平上辺)として投影・求積`, textL, textY); textY += 24;

    const box = (title, val, color) => {
        ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(title, textL, textY); textY += 18;
        ctx.fillStyle = '#555'; ctx.font = '11px monospace'; ctx.fillText(`カットライン以上 = ${val.toFixed(3)} ㎡`, textL+10, textY); textY += 28;
    };
    box('■ 2F見附 (2FL+1350以上)', areaShown2F, primaryColor);
    box('■ 1F追加見附 (1FL+1350〜2FL+1350)', areaShown1F_add, '#27ae60');

    ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(textL, textY-8); ctx.lineTo(canvas.width-30, textY-8); ctx.stroke();
    textY += 4;

    ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('📐 合計 投影見付面積', textL, textY); textY += 22;
    ctx.font = 'bold 22px monospace'; ctx.fillStyle = '#c62828';
    ctx.fillText(`${areaTotal.toFixed(3)} ㎡`, textL+10, textY); textY += 30;

    ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1; ctx.strokeRect(8, 8, canvas.width-16, canvas.height-16);

    return { img: canvas.toDataURL('image/png'), area: areaTotal };
}

// Register with ServiceContainer
if (window.ServiceContainer) {
    window.ServiceContainer.register('ReportMitsukeView', window.ReportMitsukeView);
}

// Backward compatibility alias
window.generateAutoMitsukeCanvas = function(direction, commonScale) {
    return window.ReportMitsukeView.generateAutoMitsukeCanvas(direction, commonScale);
};
