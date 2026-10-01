/**
 * view/FoundationPlanSvgGenerator.js - SVG Generator for Foundation Plan (基礎伏図)
 * v3.14.0: Single Responsibility Principle (SRP) - Visual CAD generator for Foundation Plan
 * Displays: 
 *  1. Foundation beam symbols with hook lines & 45-degree sloped ticks, rotated parallel for vertical beams, 
 *     exterior beams positioned outside, and separated per beam span/specification.
 *  2. Slab symbols without rect boxes at the center of diagonal dashed lines.
 *  3. 1F pillars as square frames with Hold-down symbols (2, 3, 4, 5, 32) only.
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
            const gridXC = s.gridXCoords || [];
            const gridYC = s.gridYCoords || [];
            const gridXN = s.gridXNames || [];
            const gridYN = s.gridYNames || [];

            // 1. バウンディングボックスの算出
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            gridXC.forEach(x => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); });
            gridYC.forEach(y => { minY = Math.min(minY, y); maxY = Math.max(maxY, y); });

            beams.forEach(b => {
                [b.p1, b.p2].forEach(p => {
                    if (p) {
                        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
                    }
                });
                if (b.spans) {
                    b.spans.forEach(sp => {
                        const p1 = sp.startNode || sp.p1;
                        const p2 = sp.endNode || sp.p2;
                        if (p1) { minX = Math.min(minX, p1.x); minY = Math.min(minY, p1.y); maxX = Math.max(maxX, p1.x); maxY = Math.max(maxY, p1.y); }
                        if (p2) { minX = Math.min(minX, p2.x); minY = Math.min(minY, p2.y); maxX = Math.max(maxX, p2.x); maxY = Math.max(maxY, p2.y); }
                    });
                }
            });

            slabs.forEach(sl => {
                (sl.vertices || []).forEach(v => {
                    minX = Math.min(minX, v.x); minY = Math.min(minY, v.y);
                    maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y);
                });
            });

            pillars.forEach(p => {
                minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
            });

            if (!isFinite(minX) || !isFinite(maxX)) {
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
            const scale = Math.min(availW / modelW, availH / modelH);

            const offsetX = padLeft + (availW - modelW * scale) / 2;
            const offsetY = padTop + (availH - modelH * scale) / 2;

            // 座標変換関数 (CAD: Y上向き -> SVG: Y下向き)
            const toSx = (x) => offsetX + (x - minX) * scale;
            const toSy = (y) => svgH - (offsetY + (y - minY) * scale);

            let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" height="auto" style="background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; display:block; font-family:'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'BIZ UDPGothic', sans-serif;">\n`;

            // タイトルバー & 方位記号
            svg += `  <!-- タイトル & 情報 -->
  <text x="${padLeft}" y="28" font-size="14" font-weight="bold" fill="#0f172a">基礎伏図（基礎梁符号・スラブ符号・1F柱・柱脚金物）</text>
  <text x="${svgW - padRight}" y="28" font-size="11" fill="#64748b" text-anchor="end">S = 1 : ${(1 / scale * 10).toFixed(0)} (AUTO)</text>
  
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

            // 5. スラブ（隅・角を一点鎖線で結び、枠なしで中央にFS1などの符号を配置）
            svg += `  <!-- スラブポリゴン & 対角線 & スラブ符号 (枠なし) -->\n  <g id="slabs">\n`;
            slabs.forEach((sl, idx) => {
                if (!sl.vertices || sl.vertices.length < 3) return;
                const pts = sl.vertices.map(v => `${toSx(v.x).toFixed(1)},${toSy(v.y).toFixed(1)}`).join(' ');
                svg += `    <polygon points="${pts}" fill="none" stroke="#64748b" stroke-width="1.2" />\n`;

                const vLen = sl.vertices.length;
                if (vLen === 4) {
                    const p0 = { x: toSx(sl.vertices[0].x), y: toSy(sl.vertices[0].y) };
                    const p1 = { x: toSx(sl.vertices[1].x), y: toSy(sl.vertices[1].y) };
                    const p2 = { x: toSx(sl.vertices[2].x), y: toSy(sl.vertices[2].y) };
                    const p3 = { x: toSx(sl.vertices[3].x), y: toSy(sl.vertices[3].y) };
                    svg += `    <line x1="${p0.x.toFixed(1)}" y1="${p0.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="6,3,1.5,3" />\n`;
                    svg += `    <line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p3.x.toFixed(1)}" y2="${p3.y.toFixed(1)}" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="6,3,1.5,3" />\n`;
                } else if (vLen > 4) {
                    const cxM = sl.vertices.reduce((sum, v) => sum + v.x, 0) / vLen;
                    const cyM = sl.vertices.reduce((sum, v) => sum + v.y, 0) / vLen;
                    const scxM = toSx(cxM), scyM = toSy(cyM);
                    sl.vertices.forEach(v => {
                        svg += `    <line x1="${scxM.toFixed(1)}" y1="${scyM.toFixed(1)}" x2="${toSx(v.x).toFixed(1)}" y2="${toSy(v.y).toFixed(1)}" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="6,3,1.5,3" />\n`;
                    });
                }

                const cx = sl.vertices.reduce((sum, v) => sum + v.x, 0) / sl.vertices.length;
                const cy = sl.vertices.reduce((sum, v) => sum + v.y, 0) / sl.vertices.length;
                const scx = toSx(cx);
                const scy = toSy(cy);

                const sp = sl.props || {};
                const slabName = sp.name || `FS${idx + 1}`;

                svg += `    <text x="${scx.toFixed(1)}" y="${(scy + 4).toFixed(1)}" font-size="12" font-weight="bold" fill="#0284c7" text-anchor="middle" style="paint-order:stroke; stroke:#ffffff; stroke-width:3.5px; stroke-linejoin:round;">${slabName}</text>\n`;
            });
            svg += `  </g>\n`;

            // 6. 基礎梁（梁躯体 ＆ スパン別カギ線・端部45度傾斜ティック・外周外側配置・縦梁90度回転平行表示）
            svg += `  <!-- 基礎梁躯体 & スパン別カギ線付き梁符号 (枠なし) -->\n  <g id="beams">\n`;

            // 梁ごとの描画項目（スパン分割を厳密に抽出）
            const allItemsToDraw = [];

            beams.forEach((beam, bIdx) => {
                if (!beam.p1 || !beam.p2) return;
                const sx1 = toSx(beam.p1.x), sy1 = toSy(beam.p1.y);
                const sx2 = toSx(beam.p2.x), sy2 = toSy(beam.p2.y);
                const bp = beam.props || {};
                const widthMm = bp.width || 150;
                const strokeW = Math.max(2.5, Math.min(6, widthMm * scale));

                // 梁躯体太線（濃色）
                svg += `    <line x1="${sx1.toFixed(1)}" y1="${sy1.toFixed(1)}" x2="${sx2.toFixed(1)}" y2="${sy2.toFixed(1)}" stroke="#0f172a" stroke-width="${strokeW.toFixed(1)}" stroke-linecap="square" />\n`;

                if (beam.spans && beam.spans.length > 0) {
                    // スパンごとに仕様と符号を取得
                    beam.spans.forEach((span, sIdx) => {
                        const sp1 = span.startNode || span.p1 || beam.p1;
                        const sp2 = span.endNode || span.p2 || beam.p2;
                        const spProps = span.props || {};
                        const sym = (spProps.symbol || span.symbol || bp.symbol || `FG${sIdx + 1}`).trim();
                        allItemsToDraw.push({
                            p1: sp1,
                            p2: sp2,
                            symbol: sym,
                            beam: beam,
                            spanIndex: sIdx
                        });
                    });
                } else {
                    const sym = (bp.symbol || bp.beamName || `FG${bIdx + 1}`).trim();
                    allItemsToDraw.push({
                        p1: beam.p1,
                        p2: beam.p2,
                        symbol: sym,
                        beam: beam,
                        spanIndex: 0
                    });
                }
            });

            // 各アイテムのカギ線と符号の描画
            allItemsToDraw.forEach(item => {
                const sym = item.symbol;
                if (!sym) return;

                const x1 = toSx(item.p1.x), y1 = toSy(item.p1.y);
                const x2 = toSx(item.p2.x), y2 = toSy(item.p2.y);
                const dx = x2 - x1;
                const dy = y2 - y1;
                const isHorizontal = Math.abs(dx) >= Math.abs(dy);

                // 外周判定（建物の最外周にあるか判定）
                const midCadX = (item.p1.x + item.p2.x) / 2;
                const midCadY = (item.p1.y + item.p2.y) / 2;

                const isNearMinY = Math.abs(midCadY - minY) < 300;
                const isNearMaxY = Math.abs(midCadY - maxY) < 300;
                const isNearMinX = Math.abs(midCadX - minX) < 300;
                const isNearMaxX = Math.abs(midCadX - maxX) < 300;

                const offsetDist = 15; // 梁線からの離隔距離
                const tickLen = 4;     // 端部の45度傾斜ティック長さ

                if (isHorizontal) {
                    // 水平梁
                    // 外周部のカギ線はすべて外側に配置:
                    // 下端外周 (y ≈ minY) なら下側 (+offsetDist), それ以外 (上端外周 y ≈ maxY または内部) は上側 (-offsetDist)
                    const isPlaceBottom = isNearMinY;
                    const sign = isPlaceBottom ? 1 : -1;

                    const startX = Math.min(x1, x2);
                    const endX = Math.max(x1, x2);
                    const beamY = (y1 + y2) / 2;
                    const lineY = beamY + sign * offsetDist;
                    const hookBaseY = beamY + sign * 3;
                    const midX = (startX + endX) / 2;

                    // カギ線 (主線 + 端部立ち上がり)
                    const hookPath = `M ${startX.toFixed(1)} ${hookBaseY.toFixed(1)} L ${startX.toFixed(1)} ${lineY.toFixed(1)} L ${endX.toFixed(1)} ${lineY.toFixed(1)} L ${endX.toFixed(1)} ${hookBaseY.toFixed(1)}`;
                    svg += `    <path d="${hookPath}" fill="none" stroke="#2563eb" stroke-width="0.9" />\n`;

                    // 端部の45度傾斜ティック (わかりやすいスラッシュ傾斜)
                    svg += `    <line x1="${(startX - tickLen).toFixed(1)}" y1="${(lineY - tickLen * sign).toFixed(1)}" x2="${(startX + tickLen).toFixed(1)}" y2="${(lineY + tickLen * sign).toFixed(1)}" stroke="#2563eb" stroke-width="1.2" />\n`;
                    svg += `    <line x1="${(endX - tickLen).toFixed(1)}" y1="${(lineY - tickLen * sign).toFixed(1)}" x2="${(endX + tickLen).toFixed(1)}" y2="${(lineY + tickLen * sign).toFixed(1)}" stroke="#2563eb" stroke-width="1.2" />\n`;

                    // 梁符号テキスト (水平・枠なし)
                    const textY = isPlaceBottom ? (lineY + 11) : (lineY - 3);
                    svg += `    <text x="${midX.toFixed(1)}" y="${textY.toFixed(1)}" font-size="9" font-weight="bold" fill="#1e40af" text-anchor="middle" style="paint-order:stroke; stroke:#ffffff; stroke-width:3px; stroke-linejoin:round;">${sym}</text>\n`;

                } else {
                    // 垂直梁 (縦カギ線)
                    // 外周部のカギ線はすべて外側に配置:
                    // 右端外周 (x ≈ maxX) なら右側 (+offsetDist), それ以外 (左端外周 x ≈ minX または内部) は左側 (-offsetDist)
                    const isPlaceRight = isNearMaxX;
                    const sign = isPlaceRight ? 1 : -1;

                    const startY = Math.min(y1, y2);
                    const endY = Math.max(y1, y2);
                    const beamX = (x1 + x2) / 2;
                    const lineX = beamX + sign * offsetDist;
                    const hookBaseX = beamX + sign * 3;
                    const midY = (startY + endY) / 2;

                    // カギ線 (主線 + 端部立ち上がり)
                    const hookPath = `M ${hookBaseX.toFixed(1)} ${startY.toFixed(1)} L ${lineX.toFixed(1)} ${startY.toFixed(1)} L ${lineX.toFixed(1)} ${endY.toFixed(1)} L ${hookBaseX.toFixed(1)} ${endY.toFixed(1)}`;
                    svg += `    <path d="${hookPath}" fill="none" stroke="#2563eb" stroke-width="0.9" />\n`;

                    // 端部の45度傾斜ティック (わかりやすいスラッシュ傾斜)
                    svg += `    <line x1="${(lineX - tickLen * sign).toFixed(1)}" y1="${(startY - tickLen).toFixed(1)}" x2="${(lineX + tickLen * sign).toFixed(1)}" y2="${(startY + tickLen).toFixed(1)}" stroke="#2563eb" stroke-width="1.2" />\n`;
                    svg += `    <line x1="${(lineX - tickLen * sign).toFixed(1)}" y1="${(endY - tickLen).toFixed(1)}" x2="${(lineX + tickLen * sign).toFixed(1)}" y2="${(endY + tickLen).toFixed(1)}" stroke="#2563eb" stroke-width="1.2" />\n`;

                    // 梁符号テキスト (縦カギ線と平行になるよう90度回転・枠なし)
                    // rotate(-90) または rotate(90): 文字列を縦カギ線に沿わせて平行表示
                    const textX = isPlaceRight ? (lineX + 9) : (lineX - 9);
                    svg += `    <text x="${textX.toFixed(1)}" y="${midY.toFixed(1)}" font-size="9" font-weight="bold" fill="#1e40af" text-anchor="middle" transform="rotate(-90, ${textX.toFixed(1)}, ${midY.toFixed(1)})" style="paint-order:stroke; stroke:#ffffff; stroke-width:3px; stroke-linejoin:round;">${sym}</text>\n`;
                }
            });

            svg += `  </g>\n`;

            // 7. 1F柱 ＆ ホールダウン金物のみ表示（記号: 2, 3, 4, 5, 32）
            svg += `  <!-- 1F柱 & ホールダウン金物 (記号 2,3,4,5,32 表示) -->\n  <g id="pillars">\n`;

            // ホールダウン金物の記号抽出ヘルパー (3, 4, 5 等)
            const getHoldDownSymbol = (p) => {
                if (!p) return null;
                const mark = String(p.manualMark || p.nMark || '').trim();
                const hw = String(p.hardware || p.jointMetal || '').trim().toUpperCase();

                // 記号そのものが 2, 3, 4, 5, 32, 10, 15, 20, 25 の場合
                const hdMarks = ['2', '3', '4', '5', '32', '10', '15', '20', '25'];
                if (hdMarks.includes(mark)) {
                    // 10, 15, 20, 25 は 2, 3, 4, 5 に統一
                    const map10toMark = { '10': '2', '15': '3', '20': '4', '25': '5' };
                    return map10toMark[mark] || mark;
                }

                // 金物名から抽出 (例: HD25 -> 5, HD15 -> 3, HD20 -> 4, HD10 -> 2, HD32 -> 32)
                const m = hw.match(/HD[-_]?(\d+)/i);
                if (m) {
                    const num = m[1];
                    const numMap = { '10': '2', '15': '3', '20': '4', '25': '5', '32': '32', '2': '2', '3': '3', '4': '4', '5': '5' };
                    return numMap[num] || num;
                }

                return null;
            };

            pillars.forEach((p, pIdx) => {
                const sx = toSx(p.x);
                const sy = toSy(p.y);
                const hdSymbol = getHoldDownSymbol(p);

                if (hdSymbol) {
                    // ホールダウン金物がある柱: 赤色四角枠の中に記号（3, 4, 5 等）を表示
                    const boxSize = 13.5;
                    const half = boxSize / 2;

                    svg += `    <!-- HD柱 ${p.id || pIdx} (記号: ${hdSymbol}) -->\n`;
                    svg += `    <rect x="${(sx - half).toFixed(1)}" y="${(sy - half).toFixed(1)}" width="${boxSize.toFixed(1)}" height="${boxSize.toFixed(1)}" fill="#ffffff" stroke="#dc2626" stroke-width="1.5" rx="1" />\n`;
                    svg += `    <text x="${sx.toFixed(1)}" y="${(sy + 3.8).toFixed(1)}" font-size="9" font-weight="bold" fill="#dc2626" text-anchor="middle">${hdSymbol}</text>\n`;
                } else {
                    // ホールダウン金物以外の柱: シンプルな四角枠 (文字なし)
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
