/**
 * view/FoundationSectionSvgRenderer.js - Foundation Beam Cross Section SVG Renderer
 * v3.13.39: Single Responsibility Principle (SRP) - Pure View Component for SVG CAD Rendering
 */

(function(exports) {
    'use strict';

    const FoundationSectionSvgRenderer = {
        /**
         * 基礎梁の断面詳細図 SVG マークアップを生成またはグループ要素に描画
         * @param {Object} beam - 基礎梁仕様オブジェクト
         * @param {Object} avgGlConfig - 平均GL設定
         * @param {Object} slabCommon - スラブ配筋設定
         * @param {SVGGElement} containerG - 描画対象の <g> 要素 (省略時はSVG文字列を返却)
         * @returns {string|SVGGElement}
         */
        renderSectionSvg: function(beam, avgGlConfig, slabCommon, containerG) {
            const Engine = (typeof window !== 'undefined' && window.FoundationSectionEngine)
                ? window.FoundationSectionEngine
                : (typeof require !== 'undefined' ? require('../logic/FoundationSectionEngine') : null);

            if (!Engine || !beam) return '';

            const geo = Engine.calculateGeometry(beam, avgGlConfig);
            const b = beam;
            const ns = "http://www.w3.org/2000/svg";

            const isFG1 = geo.isFG1;
            const isDoubleStem = geo.isDoubleStem;
            const isDoubleSlab = geo.isDoubleSlab;
            const isMatchStem = geo.isMatchStem;
            const isSlabFlush = geo.isSlabFlush;

            const aboveGl = geo.aboveGl;
            const embedH = geo.embedH;
            const totalH = geo.totalH;
            const concD = geo.concD;
            const stemW = geo.stemW;
            const totalBaseW = geo.totalBaseW;
            const toeW = geo.toeW;

            const originX = 380;
            const originY = 140;

            const yFinishTop = originY;
            const yConcTop = yFinishTop + geo.levelerT;
            const yGl = yFinishTop + aboveGl;
            const ySlabTop = yGl - geo.glToSlab;
            const ySlabBot = ySlabTop + geo.slabT;
            const yBaseBot = yGl + embedH;
            const subThick = 60;
            const yAvgGl = yGl - (avgGlConfig ? (avgGlConfig.diff || 0) : 0);

            const xOutFace = originX;
            const xInFace = xOutFace + stemW;
            const xStemCenter = (xOutFace + xInFace) / 2;

            // DOM描画か文字列生成かの振り分け
            const useDom = !!(containerG && typeof containerG.appendChild === 'function');
            let g = containerG;
            let svgStr = '';

            if (useDom) {
                g.innerHTML = '';
            }

            const appendLine = (x1, y1, x2, y2, stroke, sw = 1.5, dash = "") => {
                if (useDom) {
                    const l = document.createElementNS(ns, "line");
                    l.setAttribute("x1", x1); l.setAttribute("y1", y1);
                    l.setAttribute("x2", x2); l.setAttribute("y2", y2);
                    l.setAttribute("stroke", stroke);
                    l.setAttribute("stroke-width", sw);
                    if (dash) l.setAttribute("stroke-dasharray", dash);
                    g.appendChild(l);
                    return l;
                } else {
                    const dStr = dash ? ` stroke-dasharray="${dash}"` : '';
                    svgStr += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"${dStr} />`;
                }
            };

            const appendPoly = (pts, stroke, fill = "none", sw = 2) => {
                const ptStr = pts.map(pt => pt.join(",")).join(" ");
                if (useDom) {
                    const p = document.createElementNS(ns, "polygon");
                    p.setAttribute("points", ptStr);
                    p.setAttribute("stroke", stroke);
                    p.setAttribute("fill", fill);
                    p.setAttribute("stroke-width", sw);
                    p.setAttribute("stroke-linejoin", "round");
                    g.appendChild(p);
                    return p;
                } else {
                    svgStr += `<polygon points="${ptStr}" stroke="${stroke}" fill="${fill}" stroke-width="${sw}" stroke-linejoin="round" />`;
                }
            };

            const appendPath = (d, stroke, sw = 2.5) => {
                if (useDom) {
                    const p = document.createElementNS(ns, "path");
                    p.setAttribute("d", d);
                    p.setAttribute("stroke", stroke);
                    p.setAttribute("fill", "none");
                    p.setAttribute("stroke-width", sw);
                    p.setAttribute("stroke-linejoin", "round");
                    p.setAttribute("stroke-linecap", "round");
                    g.appendChild(p);
                    return p;
                } else {
                    svgStr += `<path d="${d}" stroke="${stroke}" fill="none" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" />`;
                }
            };

            const appendCircle = (cx, cy, r, fill = "#ef4444") => {
                if (useDom) {
                    const c = document.createElementNS(ns, "circle");
                    c.setAttribute("cx", cx); c.setAttribute("cy", cy);
                    c.setAttribute("r", r);
                    c.setAttribute("fill", fill);
                    g.appendChild(c);
                    return c;
                } else {
                    svgStr += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" />`;
                }
            };

            const appendText = (str, x, y, fill = "#e2e8f0", size = 13, anchor = "start", bold = false) => {
                if (useDom) {
                    const t = document.createElementNS(ns, "text");
                    t.setAttribute("x", x); t.setAttribute("y", y);
                    t.setAttribute("fill", fill);
                    t.setAttribute("font-size", size);
                    t.setAttribute("font-family", "monospace, sans-serif");
                    t.setAttribute("text-anchor", anchor);
                    if (bold) t.setAttribute("font-weight", "bold");
                    t.textContent = str;
                    g.appendChild(t);
                    return t;
                } else {
                    const bStr = bold ? ' font-weight="bold"' : '';
                    svgStr += `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-family="monospace, sans-serif" text-anchor="${anchor}"${bStr}>${str}</text>`;
                }
            };

            const drawCallout = (targetX, targetY, elbowX, elbowY, labelX, label, anchor = "start") => {
                appendLine(targetX, targetY, elbowX, elbowY, "#f87171", 1);
                appendLine(elbowX, elbowY, labelX, elbowY, "#f87171", 1);
                appendText(label, labelX + (anchor === "start" ? 6 : -6), elbowY + 4, "#f8fafc", 12, anchor, true);
            };

            const drawBreak = (bx, y1, y2) => {
                const midY = (y1 + y2) / 2;
                const d = `M ${bx} ${y1} L ${bx} ${midY - 15} L ${bx - 8} ${midY - 7} L ${bx + 8} ${midY + 7} L ${bx} ${midY + 15} L ${bx} ${y2}`;
                appendPath(d, "#06b6d4", 1.5);
            };

            // 1. タイトル
            const toeStr = isMatchStem ? `底盤同寸${stemW}mm` : `底盤250mm`;
            const typeLabel = isFG1 ? `FG1仕様 (外周/ポーチ・${toeStr})` : 'FG2仕様 (内部T型梁)';
            const stemTypeDesc = isDoubleStem ? '立上りW' : '立上りS';
            const slabTypeDesc = isDoubleSlab ? 'スラブW' : 'スラブS';
            const signTitle = b.title || b.id || 'FG1';

            appendText(`【 符号 : ${signTitle} 】 ${typeLabel}`, xStemCenter, originY - 60, "#38bdf8", 18, "middle", true);
            appendText(`仕様: ${stemTypeDesc}・${slabTypeDesc} | 幅${stemW}×梁成D${concD}mm (全高${totalH}mm)`, xStemCenter, originY - 38, "#94a3b8", 11, "middle");

            // 通り芯
            appendLine(xStemCenter, originY - 20, xStemCenter, yBaseBot + 90, "#4ade80", 1, "6,4,2,4");
            appendText(`通り芯`, xStemCenter, yBaseBot + 105, "#4ade80", 10, "middle");

            // 2. 躯体コンクリート幾何
            const xBreak = originX + 700;
            const xBreakL = xOutFace - 300;
            const xBreakR = xInFace + 300;

            const xBaseEnd = xOutFace + totalBaseW;
            const deltaH = Math.max(yBaseBot - ySlabBot, 0);
            const dxHaunch = Math.min(deltaH, 100);
            const xSlopeEnd = xBaseEnd + dxHaunch;

            if (isFG1) {
                const topY = isSlabFlush ? ySlabTop : yConcTop;
                const concPts = [
                    [xOutFace, topY],
                    [xOutFace, yBaseBot],
                    [xBaseEnd, yBaseBot],
                    [xSlopeEnd, ySlabBot],
                    [xBreak, ySlabBot],
                    [xBreak, ySlabTop]
                ];

                if (!isSlabFlush) {
                    concPts.push([xInFace, ySlabTop]);
                    concPts.push([xInFace, yConcTop]);
                }
                appendPoly(concPts, "#ffffff", "none", 2);

                const gravelPts = [
                    [xOutFace - 40, yBaseBot],
                    [xBaseEnd, yBaseBot],
                    [xSlopeEnd, ySlabBot],
                    [xBreak, ySlabBot],
                    [xBreak, ySlabBot + subThick],
                    [xSlopeEnd + 20, ySlabBot + subThick],
                    [xBaseEnd + 20, yBaseBot + subThick],
                    [xOutFace - 40, yBaseBot + subThick]
                ];
                appendPoly(gravelPts, "#64748b", "rgba(100,116,139,0.15)", 1);
                drawBreak(xBreak, ySlabTop - 25, ySlabBot + subThick + 25);
            } else {
                let concPts = [];
                if (yBaseBot > ySlabBot) {
                    concPts = [
                        [xOutFace, yConcTop], [xInFace, yConcTop], [xInFace, ySlabTop], [xBreakR, ySlabTop],
                        [xBreakR, ySlabBot], [xInFace, ySlabBot], [xInFace, yBaseBot], [xOutFace, yBaseBot],
                        [xOutFace, ySlabBot], [xBreakL, ySlabBot], [xBreakL, ySlabTop], [xOutFace, ySlabTop]
                    ];
                } else {
                    concPts = [
                        [xOutFace, yConcTop], [xInFace, yConcTop], [xInFace, ySlabTop], [xBreakR, ySlabTop],
                        [xBreakR, yBaseBot], [xBreakL, yBaseBot], [xBreakL, ySlabTop], [xOutFace, ySlabTop]
                    ];
                }
                appendPoly(concPts, "#ffffff", "none", 2);

                appendPoly([
                    [xBreakL, yBaseBot], [xBreakR, yBaseBot], [xBreakR, yBaseBot + subThick], [xBreakL, yBaseBot + subThick]
                ], "#64748b", "rgba(100,116,139,0.15)", 1);

                drawBreak(xBreakL, ySlabTop - 25, yBaseBot + subThick + 25);
                drawBreak(xBreakR, ySlabTop - 25, yBaseBot + subThick + 25);
            }

            // レベラー
            if (!isSlabFlush && geo.levelerT > 0) {
                appendPoly([[xOutFace, yFinishTop], [xInFace, yFinishTop], [xInFace, yConcTop], [xOutFace, yConcTop]], "#38bdf8", "#0284c7", 1);
                appendText(`レベラー ${geo.levelerT}mm`, xOutFace - 10, yFinishTop + geo.levelerT / 2 + 4, "#38bdf8", 10, "end");
            }

            // 設計GLライン
            appendLine(xOutFace - 340, yGl, xInFace + 360, yGl, "#4ade80", 1.5, "8,4");
            appendText("▽ 設計GL", xOutFace - 345, yGl - 6, "#4ade80", 13, "end", true);

            // 平均GLライン
            if (avgGlConfig && avgGlConfig.show) {
                appendLine(xOutFace - 340, yAvgGl, xInFace + 360, yAvgGl, "#fbbf24", 1.5, "6,3,1,3");
                appendText("▽ 平均GL", xOutFace - 345, yAvgGl - 6, "#fbbf24", 13, "end", true);
            }

            // 3. 鉄筋配置
            const coverTop = 50;
            const coverBot = 60;
            const bendR = 20;

            const shortBarSpec = (slabCommon && slabCommon.shortBar) || 'D13@150';
            const longBarSpec = (slabCommon && slabCommon.longBar) || 'D10@300';
            const rShort = Engine.getBarRadius(shortBarSpec);
            const rLong = Engine.getBarRadius(longBarSpec);

            const yTopShort = ySlabTop + 35 + rShort;
            const yTopLong = yTopShort + rShort + rLong + 3;
            const yBotShort = ySlabBot - 60 + rShort;
            const yBotLong = yBotShort - (rShort + rLong + 3);

            const hoopCover = 35;
            const hoopL = xOutFace + hoopCover;
            const hoopR = xInFace - hoopCover;
            const stY_top = isSlabFlush ? (ySlabTop + 35) : (yConcTop + coverTop);
            const stY_bot = yBaseBot - coverBot;

            // 法線離隔60mm幾何学計算
            const hyp = Math.hypot(dxHaunch, deltaH) || 1;
            const sinTheta = deltaH / hyp;
            const cosTheta = dxHaunch / hyp;

            const shiftX = (sinTheta > 0.02) ? (60 * (1 - cosTheta) / sinTheta) : 0;
            const stSlopeStartX = Math.max(xBaseEnd - shiftX, xStemCenter + 10);

            const stTargetTopY = yTopLong;
            const dyRebar = stY_bot - stTargetTopY;
            const stSlopeEndX = stSlopeStartX + dyRebar * (dxHaunch / (deltaH || 1));

            // 縦筋
            if (isDoubleStem) {
                const hoopPath = 
                    `M ${hoopL + 12} ${stY_top} L ${hoopR - 12} ${stY_top} ` +
                    `A 10 10 0 0 1 ${hoopR} ${stY_top + 10} L ${hoopR} ${stY_bot - 10} ` +
                    `A 10 10 0 0 1 ${hoopR - 10} ${stY_bot} L ${hoopL + 10} ${stY_bot} ` +
                    `A 10 10 0 0 1 ${hoopL} ${stY_bot - 10} L ${hoopL} ${stY_top + 10} ` +
                    `A 10 10 0 0 1 ${hoopL + 10} ${stY_top} Z`;
                appendPath(hoopPath, "#ef4444", 2.6);

                if (isFG1) {
                    appendPath(`M ${hoopR} ${stY_bot} L ${stSlopeStartX} ${stY_bot} L ${stSlopeEndX} ${stTargetTopY}`, "#ef4444", 2.4);
                }
            } else {
                if (isFG1) {
                    const stX_out = xStemCenter - 10;
                    const filletDist = Math.min(18, Math.max(5, (stSlopeStartX - (stX_out + bendR)) / 2));

                    const p1x = stSlopeStartX - filletDist;
                    const p1y = stY_bot;
                    const cx1 = stSlopeStartX;
                    const cy1 = stY_bot;
                    const p2x = stSlopeStartX + filletDist * cosTheta;
                    const p2y = stY_bot - filletDist * sinTheta;

                    const p3x = stSlopeEndX - filletDist * cosTheta;
                    const p3y = stTargetTopY + filletDist * sinTheta;
                    const cx2 = stSlopeEndX;
                    const cy2 = stTargetTopY;
                    const p4x = stSlopeEndX + filletDist;
                    const p4y = stTargetTopY;

                    const stirrupPath = 
                        `M ${stX_out + 20} ${stY_top + 10} ` +
                        `Q ${stX_out} ${stY_top} ${stX_out} ${stY_top + 15} ` +
                        `L ${stX_out} ${stY_bot - bendR} ` +
                        `Q ${stX_out} ${stY_bot} ${stX_out + bendR} ${stY_bot} ` +
                        `L ${p1x} ${p1y} ` +
                        `Q ${cx1} ${cy1} ${p2x} ${p2y} ` +
                        `L ${p3x} ${p3y} ` +
                        `Q ${cx2} ${cy2} ${p4x} ${p4y} ` +
                        `L ${p4x + 120} ${stTargetTopY}`;
                    appendPath(stirrupPath, "#ef4444", 2.6);
                } else {
                    const inStX = xStemCenter - 10;
                    appendPath(`M ${inStX + 20} ${stY_top + 10} Q ${inStX} ${stY_top} ${inStX} ${stY_top + 15} L ${inStX} ${stY_bot - bendR} Q ${inStX} ${stY_bot} ${inStX + bendR} ${stY_bot} L ${inStX + 85} ${stY_bot}`, "#ef4444", 2.6);
                }
            }

            // ★ 天端同寸時のスターラップ引出線の干渉完全解消
            const stTargetPtX = isDoubleStem ? hoopL : (xStemCenter - 10);
            if (isSlabFlush) {
                const safeMidY = yGl + embedH * 0.4;
                drawCallout(stTargetPtX, safeMidY, xOutFace - 45, safeMidY, xOutFace - 110, `${b.stirrupBar || 'D10@200'}${isDoubleStem ? ' (フープ)' : ''}`, "end");
            } else {
                const stLabelY = Math.min(yGl - 30, stY_top + 120);
                drawCallout(stTargetPtX, (stY_top + yGl) / 2, xOutFace - 35, stLabelY, xOutFace - 110, `${b.stirrupBar || 'D10@200'}${isDoubleStem ? ' (フープ)' : ''}`, "end");
            }

            // 主筋
            const topSpec = b.topSpec || '1-D13';
            const botSpec = b.botSpec || '1-D13';
            let topLabel = topSpec;
            const r13 = Engine.getBarRadius('D13');
            const r16 = Engine.getBarRadius('D16');

            if (isDoubleStem) {
                const rTopBar = topSpec.includes('D16') ? r16 : r13;
                appendCircle(hoopL + 12, stY_top + 12, rTopBar);
                appendCircle(hoopR - 12, stY_top + 12, rTopBar);
                if (topSpec.includes('2段')) {
                    const r2 = topSpec.includes('2段2-D16') ? r16 : r13;
                    appendCircle(hoopL + 12, stY_top + 12 + 38, r2);
                    appendCircle(hoopR - 12, stY_top + 12 + 38, r2);
                }
            } else {
                if (topSpec === '1-D13') {
                    appendCircle(xStemCenter, stY_top + 12, r13);
                } else if (topSpec === '2-D13') {
                    appendCircle(xStemCenter, stY_top + 12, r13);
                    appendCircle(xStemCenter, stY_top + 12 + 38, r13);
                } else if (topSpec === '1-D16') {
                    appendCircle(xStemCenter, stY_top + 12, r16);
                } else if (topSpec === '2-D16') {
                    appendCircle(xStemCenter, stY_top + 12, r16);
                    appendCircle(xStemCenter, stY_top + 12 + 40, r16);
                } else if (topSpec.includes('D16')) {
                    appendCircle(xStemCenter, stY_top + 12, r13);
                    appendCircle(xStemCenter, stY_top + 12 + 40, r16);
                    topLabel = "上D13 / 2段D16";
                }
            }

            const topCalloutElbowY = isSlabFlush ? (stY_top - 30) : (stY_top - 20);
            drawCallout(xStemCenter, stY_top + 12, xInFace + 60, topCalloutElbowY, xInFace + 180, `上主筋: ${topLabel}`, "start");

            const botBaseY = stY_bot - 12;
            const stLeftInnerX = xStemCenter - 10 + bendR;
            let botLabel = botSpec;

            if (isDoubleStem) {
                const rBotBar = botSpec.includes('D16') ? r16 : r13;
                appendCircle(hoopL + 12, botBaseY, rBotBar);
                appendCircle(hoopR - 12, botBaseY, rBotBar);
                if (botSpec.includes('2段')) {
                    const r2 = botSpec.includes('2段2-D16') ? r16 : r13;
                    appendCircle(hoopL + 12, botBaseY - 38, r2);
                    appendCircle(hoopR - 12, botBaseY - 38, r2);
                }
                drawCallout(hoopR - 12, botBaseY, xInFace + 60, botBaseY + 30, xInFace + 180, `下主筋: ${botLabel} (W配筋)`, "start");
            } else if (isFG1 && !isMatchStem) {
                const rBotBar = Engine.getBarRadius(botSpec);
                const pL = stLeftInnerX + 8;
                const pR = Math.max(stSlopeStartX - 15, pL + 40);
                const pM = (pL + pR) / 2;
                if (botSpec.startsWith('3-')) {
                    appendCircle(pL, botBaseY, rBotBar);
                    appendCircle(pM, botBaseY, rBotBar);
                    appendCircle(pR, botBaseY, rBotBar);
                    botLabel = `${botSpec} (並列3本)`;
                    drawCallout(pR, botBaseY, xInFace + 60, botBaseY + 30, xInFace + 180, `下主筋: ${botLabel}`, "start");
                } else if (botSpec.startsWith('2-')) {
                    appendCircle(pL + 4, botBaseY, rBotBar);
                    appendCircle(pR - 4, botBaseY, rBotBar);
                    botLabel = `${botSpec} (並列2本)`;
                    drawCallout(pR, botBaseY, xInFace + 60, botBaseY + 30, xInFace + 180, `下主筋: ${botLabel}`, "start");
                } else {
                    appendCircle(xStemCenter, botBaseY, rBotBar);
                    drawCallout(xStemCenter, botBaseY, xInFace + 60, botBaseY + 30, xInFace + 180, `下主筋: ${botLabel}`, "start");
                }
            } else {
                if (botSpec.includes('2段') || botSpec.includes('+')) {
                    const r1 = botSpec.startsWith('D16') ? r16 : r13;
                    const r2 = (botSpec.includes('2段D16') || botSpec.endsWith('D16')) ? r16 : r13;
                    appendCircle(xStemCenter, botBaseY, r1);
                    appendCircle(xStemCenter, botBaseY - 36, r2);
                    botLabel = `${botSpec}`;
                    drawCallout(xStemCenter, botBaseY, xInFace + 60, botBaseY + 30, xInFace + 180, `下主筋: ${botLabel} (縦2段各1本)`, "start");
                } else {
                    const rBar = Engine.getBarRadius(botSpec);
                    appendCircle(xStemCenter, botBaseY, rBar);
                    drawCallout(xStemCenter, botBaseY, xInFace + 60, botBaseY + 30, xInFace + 180, `下主筋: ${botLabel} (1本)`, "start");
                }
            }

            // スラブ配筋
            const sPitch = shortBarSpec.includes('@100') ? 100 : (shortBarSpec.includes('@200') ? 200 : 150);

            if (isFG1) {
                const longStartX = xStemCenter - 10;
                appendLine(longStartX, yTopLong, xBreak, yTopLong, "#ef4444", 2.2);
                if (isDoubleSlab) {
                    appendLine(longStartX, yBotLong, xBreak, yBotLong, "#ef4444", 2.2);
                }

                const startShortX = Math.max(stSlopeEndX + 35, xInFace + 70);
                let px = startShortX;
                const pts = [];
                while (px < xBreak - 25) {
                    appendCircle(px, yTopShort, rShort);
                    if (isDoubleSlab) {
                        appendCircle(px, yBotShort, rShort);
                    }
                    pts.push(px);
                    px += sPitch;
                }

                if (pts.length >= 1) {
                    const slabTypeStr = isDoubleSlab ? ' (W配筋)' : '';
                    const shortCalloutY = isSlabFlush ? (ySlabTop - 30) : (ySlabTop - 45);
                    drawCallout(pts[0], yTopShort, pts[0] + 35, shortCalloutY, pts[0] + 130, `スラブ短辺: ${shortBarSpec}${slabTypeStr}`, "start");
                }
                drawCallout(xBreak - 80, yTopLong, xBreak - 50, ySlabTop + 70, xBreak + 80, `スラブ長辺: ${longBarSpec} (立上りへ延長)`, "start");
            } else {
                appendLine(xBreakL, yTopLong, xBreakR, yTopLong, "#ef4444", 2.2);
                if (isDoubleSlab) {
                    appendLine(xBreakL, yBotLong, xBreakR, yBotLong, "#ef4444", 2.2);
                }

                let px = xBreakL + 25;
                let firstPtX = null;
                while (px < xBreakR - 20) {
                    if (px < (xOutFace - 20) || px > (xInFace + 20)) {
                        appendCircle(px, yTopShort, rShort);
                        if (isDoubleSlab) {
                            appendCircle(px, yBotShort, rShort);
                        }
                        if (!firstPtX && px > xInFace + 15) firstPtX = px;
                    }
                    px += sPitch;
                }

                if (firstPtX) {
                    const slabTypeStr = isDoubleSlab ? ' (W配筋)' : '';
                    drawCallout(firstPtX, yTopShort, firstPtX + 30, ySlabTop - 40, xBreakR + 30, `スラブ短辺: ${shortBarSpec}${slabTypeStr}`, "start");
                }
                drawCallout(xBreakR - 60, yTopLong, xBreakR - 20, ySlabTop + 70, xBreakR + 30, `スラブ長辺: ${longBarSpec}`, "start");
            }

            // 4. 寸法線
            const dimL = (x1, y1, x2, y2, label, isVert = false, offset = 0, side = 1, color = "#facc15") => {
                const dx = x2 - x1, dy = y2 - y1;
                const len = Math.hypot(dx, dy) || 1;
                const nx = -dy / len * offset, ny = dx / len * offset;
                const sx1 = x1 + nx, sy1 = y1 + ny;
                const sx2 = x2 + nx, sy2 = y2 + ny;
                appendLine(sx1, sy1, sx2, sy2, color, 1.2);
                appendLine(sx1 - 4, sy1 + 4, sx1 + 4, sy1 - 4, color, 1.2);
                appendLine(sx2 - 4, sy2 + 4, sx2 + 4, sy2 - 4, color, 1.2);
                const mx = (sx1 + sx2) / 2, my = (sy1 + sy2) / 2;
                if (isVert) {
                    appendText(label, mx + 6 * side, my + 4, color, 11, side > 0 ? "start" : "end", true);
                } else {
                    appendText(label, mx, my - 6 * side, color, 11, "middle", true);
                }
            };

            dimL(xOutFace, yFinishTop - 25, xInFace, yFinishTop - 25, `${stemW}mm`, false, 0, 1);
            dimL(xOutFace - 25, ySlabTop, xOutFace - 25, yGl, `+${geo.glToSlab}`, true, 0, -1);
            dimL(xOutFace - 80, yFinishTop, xOutFace - 80, yGl, `天端高 ${aboveGl}mm`, true, 0, -1);
            dimL(xOutFace - 80, yGl, xOutFace - 80, yBaseBot, `※H=${embedH}mm`, true, 0, -1);
            dimL(xOutFace - 140, yFinishTop, xOutFace - 140, yBaseBot, `全高 ${totalH}mm`, true, 0, -1);

            if (avgGlConfig && avgGlConfig.show && avgGlConfig.diff !== 0) {
                const diffVal = avgGlConfig.diff;
                const diffSign = diffVal > 0 ? `+${diffVal}` : `${diffVal}`;
                dimL(xOutFace - 200, yGl, xOutFace - 200, yAvgGl, `GL差 ${diffSign}mm`, true, 0, -1, "#fbbf24");
            }

            dimL(xInFace + 60, stY_bot, xInFace + 60, yBaseBot, `かぶり 60mm`, true, 0, 1);

            if (isFG1) {
                if (!isMatchStem && toeW > 0) {
                    dimL(xOutFace, yBaseBot + 30, xInFace, yBaseBot + 30, `${stemW}mm`, false, 0, -1);
                    dimL(xInFace, yBaseBot + 30, xBaseEnd, yBaseBot + 30, `${toeW}mm`, false, 0, -1);
                    dimL(xOutFace, yBaseBot + 65, xBaseEnd, yBaseBot + 65, `底盤幅 ${totalBaseW}mm`, false, 0, -1);
                } else {
                    dimL(xOutFace, yBaseBot + 30, xBaseEnd, yBaseBot + 30, `${totalBaseW}mm`, false, 0, -1);
                }
            }

            // 5. 基準レベル対比表 ＆ 【dt・有効梁成d 計算値表示】
            if (avgGlConfig && avgGlConfig.show) {
                const tblX = originX + 740;
                const tblY = originY - 70;
                const tblW = 410;
                const tblH = 288;

                appendPoly([
                    [tblX, tblY], [tblX + tblW, tblY], [tblX + tblW, tblY + tblH], [tblX, tblY + tblH]
                ], "#1e293b", "rgba(15, 23, 42, 0.95)", 1.5);

                appendText("【 基準レベル対比表 (高さ±表示) 】", tblX + 12, tblY + 20, "#fbbf24", 12, "start", true);
                appendLine(tblX + 10, tblY + 28, tblX + tblW - 10, tblY + 28, "#334155", 1);

                const diff = avgGlConfig.diff || 0;
                const diffStr = (diff >= 0 ? `+${diff}` : `${diff}`) + 'mm';

                const topDesGlStr = `+${aboveGl} mm`;
                const botDesGlStr = `-${embedH} mm (※H=${embedH})`;

                const topAvgGlVal = aboveGl - diff;
                const botAvgGlVal = -embedH - diff;
                const slabAvgGlVal = geo.glToSlab - diff;

                const topAvgGlStr = (topAvgGlVal >= 0 ? `+${topAvgGlVal}` : `${topAvgGlVal}`) + ' mm';
                const botAvgGlStr = (botAvgGlVal >= 0 ? `+${botAvgGlVal}` : `${botAvgGlVal}`) + ' mm';
                const slabAvgGlStr = (slabAvgGlVal >= 0 ? `+${slabAvgGlVal}` : `${slabAvgGlVal}`) + ' mm';

                appendText("項目", tblX + 15, tblY + 48, "#94a3b8", 11);
                appendText("設計GL基準 (±)", tblX + 130, tblY + 48, "#4ade80", 11);
                appendText("平均GL基準 (±)", tblX + 250, tblY + 48, "#fbbf24", 11);

                appendText("立上り天端", tblX + 15, tblY + 70, "#e2e8f0", 11);
                appendText(topDesGlStr, tblX + 130, tblY + 70, "#e2e8f0", 11);
                appendText(topAvgGlStr, tblX + 250, tblY + 70, "#e2e8f0", 11, "start", true);

                appendText("根入れ底面", tblX + 15, tblY + 92, "#e2e8f0", 11);
                appendText(botDesGlStr, tblX + 130, tblY + 92, "#e2e8f0", 11);
                appendText(botAvgGlStr, tblX + 250, tblY + 92, "#e2e8f0", 11, "start", true);

                appendText(`スラブ天端: 設計GL +${geo.glToSlab}mm ／ 平均GL ${slabAvgGlStr} (差: ${diffStr})`, tblX + 15, tblY + 114, "#38bdf8", 10.5);

                appendLine(tblX + 10, tblY + 126, tblX + tblW - 10, tblY + 126, "#3b82f6", 1.2);
                appendText(`【 梁成D=${concD}mm (レベラー抜) ・ 有効梁成d 自動算定 】`, tblX + 12, tblY + 144, "#60a5fa", 12, "start", true);

                const dtTopStr = (Math.round(geo.dtTopInfo.dt * 10) / 10).toFixed(1);
                const dEffTopStr = (Math.round(geo.dEffTop * 10) / 10).toFixed(1);
                const dtBotStr = (Math.round(geo.dtBotInfo.dt * 10) / 10).toFixed(1);
                const dEffBotStr = (Math.round(geo.dEffBot * 10) / 10).toFixed(1);

                const stpTopStatus = (b.incTopStirrup !== false) ? 'STP加算有' : 'STP無';
                const stpBotStatus = (b.incBotStirrup !== false) ? 'STP加算有' : 'STP無';

                appendPoly([[tblX + 10, tblY + 155], [tblX + tblW/2 - 5, tblY + 155], [tblX + tblW/2 - 5, tblY + 252], [tblX + 10, tblY + 252]], "#0f172a", "rgba(30, 41, 59, 0.7)", 1);
                appendText(`↑ 上主筋 (${topLabel})`, tblX + 16, tblY + 172, "#93c5fd", 11, "start", true);
                appendText(`重心距離 dt:`, tblX + 16, tblY + 192, "#94a3b8", 10.5);
                appendText(`${dtTopStr} mm`, tblX + 100, tblY + 192, "#38bdf8", 11, "start", true);
                appendText(`有効梁成 d :`, tblX + 16, tblY + 212, "#94a3b8", 10.5);
                appendText(`${dEffTopStr} mm`, tblX + 100, tblY + 212, "#4ade80", 11, "start", true);
                appendText(`(天端かぶり40+${stpTopStatus})`, tblX + 16, tblY + 236, "#64748b", 9.5);

                appendPoly([[tblX + tblW/2 + 5, tblY + 155], [tblX + tblW - 10, tblY + 155], [tblX + tblW - 10, tblY + 252], [tblX + tblW/2 + 5, tblY + 252]], "#0f172a", "rgba(30, 41, 59, 0.7)", 1);
                appendText(`↓ 下主筋 (${botLabel})`, tblX + tblW/2 + 11, tblY + 172, "#fca5a5", 11, "start", true);
                appendText(`重心距離 dt:`, tblX + tblW/2 + 11, tblY + 192, "#94a3b8", 10.5);
                appendText(`${dtBotStr} mm`, tblX + tblW/2 + 95, tblY + 192, "#f87171", 11, "start", true);
                appendText(`有効梁成 d :`, tblX + tblW/2 + 11, tblY + 212, "#94a3b8", 10.5);
                appendText(`${dEffBotStr} mm`, tblX + tblW/2 + 95, tblY + 212, "#4ade80", 11, "start", true);
                
                let botArrangeDesc = '1段配筋';
                if (isDoubleStem) {
                    botArrangeDesc = geo.dtBotInfo.is2Row ? 'W縦2段' : 'W配筋(各1本)';
                } else if (isFG1 && !isMatchStem) {
                    botArrangeDesc = '底盤250並列(1段)';
                } else if (geo.dtBotInfo.is2Row) {
                    botArrangeDesc = '縦2段(上下各1本)';
                }
                appendText(`(底面かぶり60+${stpBotStatus}・${botArrangeDesc})`, tblX + tblW/2 + 11, tblY + 236, "#64748b", 9);

                appendLine(tblX + 10, tblY + 260, tblX + tblW - 10, tblY + 260, "#334155", 0.8);
                appendText("※腹筋はD10＠300以下で配す。", tblX + 15, tblY + 276, "#fde047", 11, "start", true);
            }

            return useDom ? g : svgStr;
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = FoundationSectionSvgRenderer;
    }
    if (typeof window !== 'undefined') {
        window.FoundationSectionSvgRenderer = FoundationSectionSvgRenderer;
        if (window.ServiceContainer) {
            window.ServiceContainer.register('FoundationSectionSvgRenderer', FoundationSectionSvgRenderer);
        }
    }
})(typeof exports === 'undefined' ? this : exports);
