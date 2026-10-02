/**
 * view/FoundationPlanSvgGenerator.js - SVG Generator for Foundation Plan (基礎伏図)
 * v3.14.6: Exterior orientation via slab geometry, shared hook anchors, slab symbol anti-collision,
 *          FG2 embed 100mm, slab rebar combos.
 * Displays: 
 *  1. Foundation beam symbols with hook lines & uniform 45-degree sloped ticks (/), rotated parallel for vertical beams, 
 *     exterior beams positioned outside, merged consecutive spans with same symbol to prevent text clutter.
 *  2. Robust property fallback (startNode/endNode/polygon/name as well as p1/p2/vertices/props).
 *  3. Collision avoidance: automatically shifts slab symbols away from foundation beam lines.
 *  4. 1F pillars as square frames with Hold-down symbols (2, 3, 4, 5, 32) only.
 */

(function(exports) {
    'use strict';

    const FoundationPlanSvgGenerator = {
        /**
         * 基礎伏図のSVGマークアップを生成
         * @param {Object} state - AppState
         * @param {Object} [options] - オプション設定
         * @returns {string} SVGマークアップ文字列
         */
        generateFoundationPlanSvg: function(state, options = {}) {
            const s = state || (typeof window !== 'undefined' ? window.AppState : null);
            if (!s) return '';

            const beams = s.foundationBeams || [];
            const slabs = s.foundationSlabs || [];
            const pillars = (s.pillars || []).filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === 1 || p.floor === '1F' || p.floor === undefined));
            const gridXC = (s.gridXCoords || s.gxc || []).map(Number).filter(isFinite);
            const gridYC = (s.gridYCoords || s.gyc || []).map(Number).filter(isFinite);
            const gridXN = s.gridXNames || s.gx || [];
            const gridYN = s.gridYNames || s.gy || [];

            // 座標抽出ヘルパー（globalX/globalY を最優先し、梁内相対距離 x/y による座標崩壊を完全防止）
            const extractPoint = (pt, fallbackPt) => {
                if (pt) {
                    const x = Number(pt.globalX !== undefined ? pt.globalX : pt.x);
                    const y = Number(pt.globalY !== undefined ? pt.globalY : pt.y);
                    if (isFinite(x) && isFinite(y)) return { x, y };
                }
                if (fallbackPt) {
                    const fx = Number(fallbackPt.globalX !== undefined ? fallbackPt.globalX : fallbackPt.x);
                    const fy = Number(fallbackPt.globalY !== undefined ? fallbackPt.globalY : fallbackPt.y);
                    if (isFinite(fx) && isFinite(fy)) return { x: fx, y: fy };
                }
                return null;
            };

            // 点と線分の最短距離計算関数 (ピクセル単位の干渉判定用)
            const distToSegment = (px, py, x1, y1, x2, y2) => {
                const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
                if (l2 === 0) return Math.hypot(px - x1, py - y1);
                let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
                t = Math.max(0, Math.min(1, t));
                return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
            };

            // 1. バウンディングボックスの算出（厳密なNaNガード）
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            const addPointToBBox = (pt) => {
                if (!pt) return;
                const x = Number(pt.x ?? pt.globalX);
                const y = Number(pt.y ?? pt.globalY);
                if (isFinite(x) && isFinite(y)) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
            };

            gridXC.forEach(x => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); });
            gridYC.forEach(y => { minY = Math.min(minY, y); maxY = Math.max(maxY, y); });

            beams.forEach(b => {
                const p1 = extractPoint(b.p1) || extractPoint(b.startNode);
                const p2 = extractPoint(b.p2) || extractPoint(b.endNode);
                addPointToBBox(p1);
                addPointToBBox(p2);
                if (b.spans && Array.isArray(b.spans)) {
                    b.spans.forEach(sp => {
                        addPointToBBox(extractPoint(sp.startNode) || extractPoint(sp.p1));
                        addPointToBBox(extractPoint(sp.endNode) || extractPoint(sp.p2));
                    });
                }
            });

            slabs.forEach(sl => {
                const poly = sl.polygon || sl.vertices || [];
                poly.forEach(v => addPointToBBox(extractPoint(v)));
            });

            pillars.forEach(p => addPointToBBox(extractPoint(p)));

            if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY) || minX >= maxX || minY >= maxY) {
                minX = 0; maxX = 7280; minY = 0; maxY = 5460;
            }

            const modelW = Math.max(maxX - minX, 1820);
            const modelH = Math.max(maxY - minY, 1820);

            // SVGサイズと余白設計（寸法線・通り芯シンボル用に十分なマージンを確保）
            const svgW = options.width || 840;
            const svgH = options.height || 600;
            const padLeft = 85;
            const padRight = 50;
            const padTop = 65;
            const padBottom = 85;

            const availW = svgW - padLeft - padRight;
            const availH = svgH - padTop - padBottom;
            const scale = (Math.min(availW / modelW, availH / modelH) || 0.05);

            const offsetX = padLeft + (availW - modelW * scale) / 2;
            const offsetY = padTop + (availH - modelH * scale) / 2;

            // 座標変換関数 (CAD: Y上向き -> SVG: Y下向き)
            const toSx = (x) => offsetX + (Number(x) - minX) * scale;
            const toSy = (y) => svgH - (offsetY + (Number(y) - minY) * scale);

            const scaleRatio = isFinite(scale) && scale > 0 ? (1 / scale * 10).toFixed(0) : '100';

            let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" height="auto" style="background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; display:block; font-family:'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'BIZ UDPGothic', sans-serif;">\n`;

            // タイトルバー & 方位記号
            svg += `  <!-- タイトル & 情報 -->
  <text x="${padLeft}" y="28" font-size="14" font-weight="bold" fill="#0f172a">基礎伏図（基礎梁符号・スラブ符号・1F柱・柱脚金物）</text>
  <text x="${svgW - padRight}" y="28" font-size="11" fill="#64748b" text-anchor="end">S = 1 : ${scaleRatio} (AUTO)</text>
  
  <!-- 方位記号 (北) -->
  <g transform="translate(${svgW - 40}, 55)">
    <circle cx="0" cy="0" r="14" fill="#f8fafc" stroke="#64748b" stroke-width="1.2" />
    <polygon points="0,-12 4,2 0,0" fill="#2563eb" />
    <polygon points="0,-12 -4,2 0,0" fill="#64748b" />
    <text x="0" y="-14" font-size="9" font-weight="bold" fill="#2563eb" text-anchor="middle">N</text>
  </g>\n`;

            // 2. 通り芯線の描画
            svg += `  <!-- 通り芯線 -->\n  <g id="grid-lines" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="6,3,1.5,3">\n`;
            gridXC.forEach((x) => {
                const sx = toSx(x);
                svg += `    <line x1="${sx.toFixed(1)}" y1="${(padTop - 20)}" x2="${sx.toFixed(1)}" y2="${(svgH - padBottom + 20)}" />\n`;
            });
            gridYC.forEach((y) => {
                const sy = toSy(y);
                svg += `    <line x1="${(padLeft - 20)}" y1="${sy.toFixed(1)}" x2="${(svgW - padRight + 20)}" y2="${sy.toFixed(1)}" />\n`;
            });
            svg += `  </g>\n`;

            // 3. 通り芯記号（丸囲み）
            svg += `  <!-- 通り芯バルーン -->\n  <g id="grid-bubbles">\n`;
            gridXC.forEach((x, i) => {
                const sx = toSx(x);
                const name = gridXN[i] || `X${i + 1}`;
                svg += `    <circle cx="${sx.toFixed(1)}" cy="${(padTop - 28)}" r="10" fill="#f8fafc" stroke="#475569" stroke-width="1.2" />\n`;
                svg += `    <text x="${sx.toFixed(1)}" y="${(padTop - 24)}" font-size="9.5" font-weight="bold" fill="#1e293b" text-anchor="middle">${name}</text>\n`;
            });
            gridYC.forEach((y, i) => {
                const sy = toSy(y);
                const name = gridYN[i] || `Y${i + 1}`;
                svg += `    <circle cx="${(padLeft - 28)}" cy="${sy.toFixed(1)}" r="10" fill="#f8fafc" stroke="#475569" stroke-width="1.2" />\n`;
                svg += `    <text x="${(padLeft - 28)}" y="${(sy + 3.5).toFixed(1)}" font-size="9.5" font-weight="bold" fill="#1e293b" text-anchor="middle">${name}</text>\n`;
            });
            svg += `  </g>\n`;

            // 4. 寸法線 (グリッド間 & 総寸法)
            svg += `  <!-- 寸法線 -->\n  <g id="dimensions" stroke="#64748b" stroke-width="0.9">\n`;
            const dimY1 = svgH - padBottom + 30;
            const dimY2 = svgH - padBottom + 52;
            for (let i = 0; i < gridXC.length - 1; i++) {
                const x1 = gridXC[i], x2 = gridXC[i + 1];
                const sx1 = toSx(x1), sx2 = toSx(x2);
                const spanMm = Math.round(Math.abs(x2 - x1));
                const midX = (sx1 + sx2) / 2;

                svg += `    <line x1="${sx1.toFixed(1)}" y1="${dimY1}" x2="${sx2.toFixed(1)}" y2="${dimY1}" />\n`;
                svg += `    <line x1="${sx1.toFixed(1)}" y1="${dimY1 - 4}" x2="${sx1.toFixed(1)}" y2="${dimY1 + 4}" />\n`;
                svg += `    <line x1="${sx2.toFixed(1)}" y1="${dimY1 - 4}" x2="${sx2.toFixed(1)}" y2="${dimY1 + 4}" />\n`;
                svg += `    <text x="${midX.toFixed(1)}" y="${dimY1 - 3}" font-size="8.5" fill="#334155" text-anchor="middle">${spanMm}</text>\n`;
            }
            if (gridXC.length >= 2) {
                const sxStart = toSx(gridXC[0]), sxEnd = toSx(gridXC[gridXC.length - 1]);
                const totalX = Math.round(Math.abs(gridXC[gridXC.length - 1] - gridXC[0]));
                svg += `    <line x1="${sxStart.toFixed(1)}" y1="${dimY2}" x2="${sxEnd.toFixed(1)}" y2="${dimY2}" stroke-width="1.2" />\n`;
                svg += `    <line x1="${sxStart.toFixed(1)}" y1="${dimY2 - 5}" x2="${sxStart.toFixed(1)}" y2="${dimY2 + 5}" />\n`;
                svg += `    <line x1="${sxEnd.toFixed(1)}" y1="${dimY2 - 5}" x2="${sxEnd.toFixed(1)}" y2="${dimY2 + 5}" />\n`;
                svg += `    <text x="${((sxStart + sxEnd) / 2).toFixed(1)}" y="${dimY2 - 3}" font-size="9" font-weight="bold" fill="#0f172a" text-anchor="middle">${totalX}</text>\n`;
            }

            const dimX1 = svgW - padRight + 22;
            const dimX2 = svgW - padRight + 42;
            for (let i = 0; i < gridYC.length - 1; i++) {
                const y1 = gridYC[i], y2 = gridYC[i + 1];
                const sy1 = toSy(y1), sy2 = toSy(y2);
                const spanMm = Math.round(Math.abs(y2 - y1));
                const midY = (sy1 + sy2) / 2;

                svg += `    <line x1="${dimX1}" y1="${sy1.toFixed(1)}" x2="${dimX1}" y2="${sy2.toFixed(1)}" />\n`;
                svg += `    <line x1="${dimX1 - 4}" y1="${sy1.toFixed(1)}" x2="${dimX1 + 4}" y2="${sy1.toFixed(1)}" />\n`;
                svg += `    <line x1="${dimX1 - 4}" y1="${sy2.toFixed(1)}" x2="${dimX1 + 4}" y2="${sy2.toFixed(1)}" />\n`;
                svg += `    <text x="${dimX1 + 3}" y="${(midY + 3).toFixed(1)}" font-size="8.5" fill="#334155" text-anchor="start">${spanMm}</text>\n`;
            }
            if (gridYC.length >= 2) {
                const syStart = toSy(gridYC[0]), syEnd = toSy(gridYC[gridYC.length - 1]);
                const totalY = Math.round(Math.abs(gridYC[gridYC.length - 1] - gridYC[0]));
                svg += `    <line x1="${dimX2}" y1="${syStart.toFixed(1)}" x2="${dimX2}" y2="${syEnd.toFixed(1)}" stroke-width="1.2" />\n`;
                svg += `    <line x1="${dimX2 - 5}" y1="${syStart.toFixed(1)}" x2="${dimX2 + 5}" y2="${syStart.toFixed(1)}" />\n`;
                svg += `    <line x1="${dimX2 - 5}" y1="${syEnd.toFixed(1)}" x2="${dimX2 + 5}" y2="${syEnd.toFixed(1)}" />\n`;
                svg += `    <text x="${dimX2 + 4}" y="${(((syStart + syEnd) / 2) + 3).toFixed(1)}" font-size="9" font-weight="bold" fill="#0f172a" text-anchor="start">${totalY}</text>\n`;
            }
            svg += `  </g>\n`;

            // 5. 基礎梁躯体（濃色太線）の描画
            svg += `  <!-- 基礎梁躯体 -->\n  <g id="beam-bodies">\n`;
            const validRawBeams = [];
            beams.forEach((beam, bIdx) => {
                const bP1 = extractPoint(beam.p1) || extractPoint(beam.startNode);
                const bP2 = extractPoint(beam.p2) || extractPoint(beam.endNode);
                if (!bP1 || !bP2) return;
                const bLen = Math.hypot(bP2.x - bP1.x, bP2.y - bP1.y);
                if (bLen < 50) return;

                const x1 = toSx(bP1.x), y1 = toSy(bP1.y);
                const x2 = toSx(bP2.x), y2 = toSy(bP2.y);
                const bp = beam.props || {};
                const strokeW = Math.max(3, Math.min(6, (bp.width || 150) * scale));

                svg += `    <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#0f172a" stroke-width="${strokeW.toFixed(1)}" stroke-linecap="square" />\n`;

                validRawBeams.push({ beam, bIdx, bP1, bP2, bp });
            });
            svg += `  </g>\n`;

            // 6. 梁符号・カギ線のセグメント生成
            // 各梁ごとにスパンを抽出し、無効な微小スパンを除外。同一符号が連続する場合は1本にマージ
            const hookSegments = [];
            validRawBeams.forEach(({ beam, bIdx, bP1, bP2, bp }) => {
                const defaultSym = (bp.symbol || bp.beamName || bp.name || beam.name || `FG${bIdx + 1}`).trim();
                let validSpans = [];

                if (beam.spans && Array.isArray(beam.spans)) {
                    beam.spans.forEach((sp, sIdx) => {
                        const sp1 = extractPoint(sp.startNode) || extractPoint(sp.p1);
                        const sp2 = extractPoint(sp.endNode) || extractPoint(sp.p2);
                        if (sp1 && sp2) {
                            const sLen = Math.hypot(sp2.x - sp1.x, sp2.y - sp1.y);
                            if (sLen >= 150) { // 150mm以上の意味のあるスパン
                                const spProps = sp.props || {};
                                const spSym = (spProps.symbol || sp.symbol || sp.name || defaultSym).trim();
                                validSpans.push({ p1: sp1, p2: sp2, symbol: spSym, length: sLen });
                            }
                        }
                    });
                }

                if (validSpans.length === 0) {
                    hookSegments.push({
                        p1: bP1,
                        p2: bP2,
                        symbol: defaultSym,
                        width: bp.width || 150
                    });
                } else {
                    // スパンを梁の方向に沿ってソート
                    const isH = Math.abs(bP2.x - bP1.x) >= Math.abs(bP2.y - bP1.y);
                    validSpans.sort((a, b) => isH ? (a.p1.x - b.p1.x) : (a.p1.y - b.p1.y));

                    // 同一符号の連続スパンを1本にマージ（密集・文字潰れ防止）
                    let current = null;
                    validSpans.forEach(sp => {
                        if (!current) {
                            current = { p1: { ...sp.p1 }, p2: { ...sp.p2 }, symbol: sp.symbol, width: bp.width || 150 };
                        } else if (current.symbol === sp.symbol) {
                            current.p2 = { ...sp.p2 };
                        } else {
                            hookSegments.push(current);
                            current = { p1: { ...sp.p1 }, p2: { ...sp.p2 }, symbol: sp.symbol, width: bp.width || 150 };
                        }
                    });
                    if (current) hookSegments.push(current);
                }
            });

            // スラブ内外判定ヘルパー (点内包判定)
            const isPointInPoly = (px, py, poly) => {
                let inside = false;
                for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                    const xi = poly[i].x, yi = poly[i].y;
                    const xj = poly[j].x, yj = poly[j].y;
                    const intersect = ((yi > py) !== (yj > py)) &&
                        (px < (xj - xi) * (py - yi) / (yj - yi || 1e-9) + xi);
                    if (intersect) inside = !inside;
                }
                return inside;
            };

            const isInsideAnySlab = (cx, cy) => {
                return slabs.some(sl => {
                    const rawVerts = sl.polygon || sl.vertices || [];
                    const validVerts = rawVerts.map(v => extractPoint(v)).filter(Boolean);
                    return validVerts.length >= 3 && isPointInPoly(cx, cy, validVerts);
                });
            };

            // 7. カギ線付き基礎梁符号のデータ準備 (スラブ符号との干渉回避のため先行計算)
            const renderedHooks = [];
            hookSegments.forEach(item => {
                const sym = item.symbol;
                if (!sym) return;

                const x1 = toSx(item.p1.x), y1 = toSy(item.p1.y);
                const x2 = toSx(item.p2.x), y2 = toSy(item.p2.y);
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.hypot(dx, dy);
                if (len < 10) return;

                const isHorizontal = Math.abs(dx) >= Math.abs(dy);
                const midCadX = (item.p1.x + item.p2.x) / 2;
                const midCadY = (item.p1.y + item.p2.y) / 2;

                const offsetDist = 14;
                const tickSize = 3.2;

                if (isHorizontal) {
                    // 水平梁: スラブ存在判定で外側を完全特定
                    const hasSlabAbove = isInsideAnySlab(midCadX, midCadY + 400);
                    const hasSlabBelow = isInsideAnySlab(midCadX, midCadY - 400);

                    let isPlaceBottom = false;
                    if (!hasSlabBelow && hasSlabAbove) {
                        isPlaceBottom = true; // 南側外周 -> 下(外側)
                    } else if (!hasSlabAbove && hasSlabBelow) {
                        isPlaceBottom = false; // 北側外周 -> 上(外側)
                    } else {
                        isPlaceBottom = false; // 内部梁 -> 上側
                    }
                    const sign = isPlaceBottom ? 1 : -1;

                    const startX = Math.min(x1, x2);
                    const endX = Math.max(x1, x2);
                    const beamY = (y1 + y2) / 2;
                    const lineY = beamY + sign * offsetDist;
                    const midX = (startX + endX) / 2;

                    // 支点位置を正確に合わせる（2重足による2重支点見えの解消）
                    const pX1 = startX;
                    const pX2 = endX;
                    if (pX2 <= pX1) return;

                    const textY = isPlaceBottom ? (lineY + 10) : (lineY - 3);
                    renderedHooks.push({
                        isHorizontal: true,
                        pX1, pX2, beamY, lineY, midX, textY,
                        textX: midX,
                        sym, isPlaceBottom, tickSize
                    });
                } else {
                    // 垂直梁: スラブ存在判定で外側を完全特定
                    const hasSlabLeft = isInsideAnySlab(midCadX - 400, midCadY);
                    const hasSlabRight = isInsideAnySlab(midCadX + 400, midCadY);

                    let isPlaceRight = false;
                    if (!hasSlabRight && hasSlabLeft) {
                        isPlaceRight = true; // 東側外周 -> 右(外側)
                    } else if (!hasSlabLeft && hasSlabRight) {
                        isPlaceRight = false; // 西側外周 -> 左(外側)
                    } else {
                        isPlaceRight = false; // 内部梁 -> 左側
                    }
                    const sign = isPlaceRight ? 1 : -1;

                    const startY = Math.min(y1, y2);
                    const endY = Math.max(y1, y2);
                    const beamX = (x1 + x2) / 2;
                    const lineX = beamX + sign * offsetDist;
                    const midY = (startY + endY) / 2;

                    // 支点位置を正確に合わせる（2重足の解消）
                    const pY1 = startY;
                    const pY2 = endY;
                    if (pY2 <= pY1) return;

                    const textX = isPlaceRight ? (lineX + 9) : (lineX - 9);
                    renderedHooks.push({
                        isHorizontal: false,
                        pY1, pY2, beamX, lineX, midY, textX,
                        textY: midY,
                        sym, isPlaceRight, tickSize
                    });
                }
            });

            // 8. スラブ（隅・角を一点鎖線で結び、枠なしで中央にFS1等の符号を配置 & 梁・柱・梁符号との完全被り回避）
            svg += `  <!-- スラブポリゴン & 対角線 & スラブ符号 (枠なし・被り自動回避) -->\n  <g id="slabs">\n`;
            slabs.forEach((sl, idx) => {
                const rawVerts = sl.polygon || sl.vertices || [];
                if (!rawVerts || rawVerts.length < 3) return;
                const validVerts = rawVerts.map(v => extractPoint(v)).filter(Boolean);
                if (validVerts.length < 3) return;

                const pts = validVerts.map(v => `${toSx(v.x).toFixed(1)},${toSy(v.y).toFixed(1)}`).join(' ');
                svg += `    <polygon points="${pts}" fill="none" stroke="#64748b" stroke-width="1.0" />\n`;

                const vLen = validVerts.length;
                if (vLen === 4) {
                    const p0 = { x: toSx(validVerts[0].x), y: toSy(validVerts[0].y) };
                    const p1 = { x: toSx(validVerts[1].x), y: toSy(validVerts[1].y) };
                    const p2 = { x: toSx(validVerts[2].x), y: toSy(validVerts[2].y) };
                    const p3 = { x: toSx(validVerts[3].x), y: toSy(validVerts[3].y) };
                    svg += `    <line x1="${p0.x.toFixed(1)}" y1="${p0.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="6,3,1.5,3" />\n`;
                    svg += `    <line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p3.x.toFixed(1)}" y2="${p3.y.toFixed(1)}" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="6,3,1.5,3" />\n`;
                } else if (vLen > 4) {
                    const cxM = validVerts.reduce((sum, v) => sum + v.x, 0) / vLen;
                    const cyM = validVerts.reduce((sum, v) => sum + v.y, 0) / vLen;
                    const scxM = toSx(cxM), scyM = toSy(cyM);
                    validVerts.forEach(v => {
                        svg += `    <line x1="${scxM.toFixed(1)}" y1="${scyM.toFixed(1)}" x2="${toSx(v.x).toFixed(1)}" y2="${toSy(v.y).toFixed(1)}" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="6,3,1.5,3" />\n`;
                    });
                }

                const cx = validVerts.reduce((sum, v) => sum + v.x, 0) / validVerts.length;
                const cy = validVerts.reduce((sum, v) => sum + v.y, 0) / validVerts.length;
                let scx = toSx(cx);
                let scy = toSy(cy);

                // 柱との被り回避
                for (const p of pillars) {
                    const pt = extractPoint(p);
                    if (pt) {
                        const px = toSx(pt.x), py = toSy(pt.y);
                        if (Math.hypot(scx - px, scy - py) < 18) {
                            scx += (scx < px) ? -14 : 14;
                            scy += (scy < py) ? -14 : 14;
                        }
                    }
                }

                // 基礎梁躯体（太線）との被り回避
                for (const bs of validRawBeams) {
                    const bx1 = toSx(bs.bP1.x), by1 = toSy(bs.bP1.y);
                    const bx2 = toSx(bs.bP2.x), by2 = toSy(bs.bP2.y);
                    const dist = distToSegment(scx, scy, bx1, by1, bx2, by2);
                    if (dist < 18) {
                        const isH = Math.abs(bx2 - bx1) >= Math.abs(by2 - by1);
                        if (isH) {
                            scy += (scy < (by1 + by2) / 2) ? -18 : 18;
                        } else {
                            scx += (scx < (bx1 + bx2) / 2) ? -18 : 18;
                        }
                    }
                }

                // 基礎梁符号（カギ線テキスト）との被り回避
                for (const hk of renderedHooks) {
                    if (Math.hypot(scx - hk.textX, scy - hk.textY) < 22) {
                        if (hk.isHorizontal) {
                            scy += (scy < hk.textY) ? -16 : 16;
                        } else {
                            scx += (scx < hk.textX) ? -16 : 16;
                        }
                    }
                }

                const sp = sl.props || {};
                const slabName = sl.name || sp.name || `FS${idx + 1}`;

                svg += `    <text x="${scx.toFixed(1)}" y="${(scy + 4).toFixed(1)}" font-size="12" font-weight="bold" fill="#0284c7" text-anchor="middle" style="paint-order:stroke; stroke:#ffffff; stroke-width:3.5px; stroke-linejoin:round;">${slabName}</text>\n`;
            });
            svg += `  </g>\n`;

            // 9. カギ線付き基礎梁符号のSVG描画
            svg += `  <!-- カギ線付き基礎梁符号 -->\n  <g id="beam-hooks">\n`;
            renderedHooks.forEach(hk => {
                if (hk.isHorizontal) {
                    const hookPath = `M ${hk.pX1.toFixed(1)} ${hk.beamY.toFixed(1)} L ${hk.pX1.toFixed(1)} ${hk.lineY.toFixed(1)} L ${hk.pX2.toFixed(1)} ${hk.lineY.toFixed(1)} L ${hk.pX2.toFixed(1)} ${hk.beamY.toFixed(1)}`;
                    svg += `    <path d="${hookPath}" fill="none" stroke="#2563eb" stroke-width="0.85" stroke-linejoin="miter" />\n`;

                    // 右上がり45°スラッシュ
                    svg += `    <line x1="${(hk.pX1 - hk.tickSize).toFixed(1)}" y1="${(hk.lineY + hk.tickSize).toFixed(1)}" x2="${(hk.pX1 + hk.tickSize).toFixed(1)}" y2="${(hk.lineY - hk.tickSize).toFixed(1)}" stroke="#2563eb" stroke-width="1.2" stroke-linecap="round" />\n`;
                    svg += `    <line x1="${(hk.pX2 - hk.tickSize).toFixed(1)}" y1="${(hk.lineY + hk.tickSize).toFixed(1)}" x2="${(hk.pX2 + hk.tickSize).toFixed(1)}" y2="${(hk.lineY - hk.tickSize).toFixed(1)}" stroke="#2563eb" stroke-width="1.2" stroke-linecap="round" />\n`;

                    // 梁符号テキスト
                    svg += `    <text x="${hk.textX.toFixed(1)}" y="${hk.textY.toFixed(1)}" font-size="9" font-weight="bold" fill="#1e40af" text-anchor="middle" style="paint-order:stroke; stroke:#ffffff; stroke-width:3px; stroke-linejoin:round;">${hk.sym}</text>\n`;
                } else {
                    const hookPath = `M ${hk.beamX.toFixed(1)} ${hk.pY1.toFixed(1)} L ${hk.lineX.toFixed(1)} ${hk.pY1.toFixed(1)} L ${hk.lineX.toFixed(1)} ${hk.pY2.toFixed(1)} L ${hk.beamX.toFixed(1)} ${hk.pY2.toFixed(1)}`;
                    svg += `    <path d="${hookPath}" fill="none" stroke="#2563eb" stroke-width="0.85" stroke-linejoin="miter" />\n`;

                    // 右上がり45°スラッシュ
                    svg += `    <line x1="${(hk.lineX - hk.tickSize).toFixed(1)}" y1="${(hk.pY1 + hk.tickSize).toFixed(1)}" x2="${(hk.lineX + hk.tickSize).toFixed(1)}" y2="${(hk.pY1 - hk.tickSize).toFixed(1)}" stroke="#2563eb" stroke-width="1.2" stroke-linecap="round" />\n`;
                    svg += `    <line x1="${(hk.lineX - hk.tickSize).toFixed(1)}" y1="${(hk.pY2 + hk.tickSize).toFixed(1)}" x2="${(hk.lineX + hk.tickSize).toFixed(1)}" y2="${(hk.pY2 - hk.tickSize).toFixed(1)}" stroke="#2563eb" stroke-width="1.2" stroke-linecap="round" />\n`;

                    // 梁符号テキスト (90度回転)
                    svg += `    <text x="${hk.textX.toFixed(1)}" y="${hk.textY.toFixed(1)}" font-size="9" font-weight="bold" fill="#1e40af" text-anchor="middle" dominant-baseline="central" transform="rotate(-90, ${hk.textX.toFixed(1)}, ${hk.textY.toFixed(1)})" style="paint-order:stroke; stroke:#ffffff; stroke-width:3px; stroke-linejoin:round;">${hk.sym}</text>\n`;
                }
            });
            svg += `  </g>\n`;

            // 7. 1F柱 ＆ ホールダウン金物のみ表示（記号: 2, 3, 4, 5, 32）
            svg += `  <!-- 1F柱 & ホールダウン金物 (記号 2,3,4,5,32 表示) -->\n  <g id="pillars">\n`;

            const getHoldDownSymbol = (p) => {
                if (!p) return null;
                const mark = String(p.manualMark || p.nMark || '').trim();
                const hw = String(p.hardware || p.jointMetal || '').trim().toUpperCase();

                const hdMarks = ['2', '3', '4', '5', '32', '10', '15', '20', '25'];
                if (hdMarks.includes(mark)) {
                    const map10toMark = { '10': '2', '15': '3', '20': '4', '25': '5' };
                    return map10toMark[mark] || mark;
                }

                const m = hw.match(/HD[-_]?(\d+)/i);
                if (m) {
                    const num = m[1];
                    const numMap = { '10': '2', '15': '3', '20': '4', '25': '5', '32': '32', '2': '2', '3': '3', '4': '4', '5': '5' };
                    return numMap[num] || num;
                }

                return null;
            };

            pillars.forEach((p, pIdx) => {
                const pt = extractPoint(p);
                if (!pt) return;
                const sx = toSx(pt.x);
                const sy = toSy(pt.y);
                const hdSymbol = getHoldDownSymbol(p);

                if (hdSymbol) {
                    const boxSize = 13.5;
                    const half = boxSize / 2;

                    svg += `    <!-- HD柱 ${p.id || pIdx} (記号: ${hdSymbol}) -->\n`;
                    svg += `    <rect x="${(sx - half).toFixed(1)}" y="${(sy - half).toFixed(1)}" width="${boxSize.toFixed(1)}" height="${boxSize.toFixed(1)}" fill="#ffffff" stroke="#dc2626" stroke-width="1.5" rx="1" />\n`;
                    svg += `    <text x="${sx.toFixed(1)}" y="${(sy + 3.8).toFixed(1)}" font-size="9" font-weight="bold" fill="#dc2626" text-anchor="middle">${hdSymbol}</text>\n`;
                } else {
                    const pSize = 7.5;
                    const half = pSize / 2;
                    svg += `    <!-- 柱 ${p.id || pIdx} -->\n`;
                    svg += `    <rect x="${(sx - half).toFixed(1)}" y="${(sy - half).toFixed(1)}" width="${pSize.toFixed(1)}" height="${pSize.toFixed(1)}" fill="#ffffff" stroke="#0f172a" stroke-width="1.2" />\n`;
                }
            });
            svg += `  </g>\n`;

            // 8. 凡例ボックス (下部)
            svg += `  <!-- 凡例ボックス -->
  <g transform="translate(${padLeft}, ${svgH - padBottom + 65})">
    <rect x="0" y="-10" width="${availW}" height="24" rx="3" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
    <text x="10" y="6" font-size="8.5" fill="#475569">
      <tspan font-weight="bold" fill="#0f172a">【凡例】</tspan>
      <tspan dx="12" font-weight="bold" fill="#1e40af">━ FG* 基礎梁符号（カギ線範囲）</tspan>
      <tspan dx="12" font-weight="bold" fill="#0284c7">✕ FS* スラブ符号（対角一点鎖線）</tspan>
      <tspan dx="12" fill="#0f172a">□ 1F柱</tspan>
      <tspan dx="12" font-weight="bold" fill="#dc2626">🔲 ホールダウン金物柱（記号: 2, 3, 4, 5, 32）</tspan>
    </text>
  </g>\n`;

            svg += `</svg>`;
            return svg;
        }
    };

    // グローバルおよびモジュールエクスポート
    if (typeof exports !== 'undefined') {
        exports.FoundationPlanSvgGenerator = FoundationPlanSvgGenerator;
    }
    if (typeof window !== 'undefined') {
        window.FoundationPlanSvgGenerator = FoundationPlanSvgGenerator;
    }

})(typeof module !== 'undefined' && module.exports ? module.exports : this);
