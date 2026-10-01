/**
 * logic/FoundationSectionDxfExporter.js - Foundation Beam Cross Section DXF Exporter
 * v3.13.39: Single Responsibility Principle (SRP) - Pure CAD/DXF Generation
 */

(function(exports) {
    'use strict';

    const FoundationSectionDxfExporter = {
        /**
         * 基礎梁符号リストから完全なAutoCAD R12/2000互換DXF文字列を生成
         * @param {Array<Object>} beamList - 基礎梁仕様リスト
         * @param {Object} avgGlConfig - 平均GL設定
         * @param {Object} slabCommon - スラブ共通配筋仕様
         * @param {Object} options - 出力オプション { filterSymbols: Array<string> }
         * @returns {string} DXF形式の文字列
         */
        generateDXF: function(beamList, avgGlConfig, slabCommon, options = {}) {
            const Engine = (typeof window !== 'undefined' && window.FoundationSectionEngine)
                ? window.FoundationSectionEngine
                : (typeof require !== 'undefined' ? require('./FoundationSectionEngine') : null);

            const REBAR_DATA = Engine ? Engine.REBAR_DATA : {
                'D10': { r: 4.765 }, 'D13': { r: 6.35 }, 'D16': { r: 7.95 }, 'D19': { r: 9.55 }, 'D22': { r: 11.1 }
            };

            let targets = beamList || [];
            if (options.filterSymbols && options.filterSymbols.length > 0) {
                targets = targets.filter(b => options.filterSymbols.includes(b.title || b.id));
            }
            if (targets.length === 0) targets = beamList;

            let dxf = "";
            dxf += "0\r\nSECTION\r\n2\r\nHEADER\r\n";
            dxf += "9\r\n$ACADVER\r\n1\r\nAC1009\r\n";
            dxf += "9\r\n$DWGCODEPAGE\r\n3\r\nANSI_932\r\n";
            dxf += "0\r\nENDSEC\r\n";

            dxf += "0\r\nSECTION\r\n2\r\nTABLES\r\n0\r\nTABLE\r\n2\r\nLAYER\r\n70\r\n9\r\n";
            const layers = [
                { name: "CONCRETE", color: 7 }, // 白
                { name: "REBAR",    color: 1 }, // 赤
                { name: "LEVELER",  color: 4 }, // シアン
                { name: "DIMENSION",color: 2 }, // 黄
                { name: "CENTER",   color: 3 }, // 緑
                { name: "GL_LINE",  color: 3 }, // 緑
                { name: "AVG_GL",   color: 2 }, // 黄
                { name: "TABLE_LINE", color: 4 }, // シアン
                { name: "TEXT",     color: 7 }  // 白
            ];
            layers.forEach(l => {
                dxf += `0\r\nLAYER\r\n${l.name}\r\n70\r\n0\r\n62\r\n${l.color}\r\n6\r\nCONTINUOUS\r\n`;
            });
            dxf += "0\r\nENDTAB\r\n0\r\nENDSEC\r\n";

            dxf += "0\r\nSECTION\r\n2\r\nENTITIES\r\n";

            const dLine = (x1, y1, x2, y2, lay) => 
                `0\r\nLINE\r\n8\r\n${lay}\r\n10\r\n${x1.toFixed(1)}\r\n20\r\n${y1.toFixed(1)}\r\n30\r\n0.0\r\n11\r\n${x2.toFixed(1)}\r\n21\r\n${y2.toFixed(1)}\r\n31\r\n0.0\r\n`;

            const dCircle = (cx, cy, r, lay) => 
                `0\r\nCIRCLE\r\n8\r\n${lay}\r\n10\r\n${cx.toFixed(1)}\r\n20\r\n${cy.toFixed(1)}\r\n30\r\n0.0\r\n40\r\n${r.toFixed(1)}\r\n`;

            const dArc = (cx, cy, r, startAng, endAng, lay) => 
                `0\r\nARC\r\n8\r\n${lay}\r\n10\r\n${cx.toFixed(1)}\r\n20\r\n${cy.toFixed(1)}\r\n30\r\n0.0\r\n40\r\n${r.toFixed(1)}\r\n50\r\n${startAng.toFixed(1)}\r\n51\r\n${endAng.toFixed(1)}\r\n`;

            const dText = (str, x, y, lay, h=18) => 
                `0\r\nTEXT\r\n8\r\n${lay}\r\n10\r\n${x.toFixed(1)}\r\n20\r\n${y.toFixed(1)}\r\n30\r\n0.0\r\n40\r\n${h}\r\n1\r\n${str}\r\n`;

            targets.forEach((b, idx) => {
                const ox = idx * 2100;
                const isFG1 = (b.baseSpec === 'FG1');
                const isDoubleStem = (b.stemArrangement === 'double');
                const isDoubleSlab = (b.slabArrangement === 'double');

                const aboveGl = b.aboveGl !== undefined ? b.aboveGl : 400;
                const embedH = b.embedH !== undefined ? b.embedH : 500;
                const totalH = aboveGl + embedH;
                const levelerT = b.levelerT !== undefined ? b.levelerT : 10;
                const concD = totalH - levelerT;
                const stemW = b.stemW || 150;
                const isMatchStem = (b.baseToeWidthType === 'matchStem');
                const totalBaseW = isFG1 ? (isMatchStem ? stemW : 250) : stemW;

                const yGl = 0;
                const yTop = aboveGl;
                const yConcTop = yTop - levelerT;
                const yBot = -embedH;
                const glToSlab = b.glToSlab !== undefined ? b.glToSlab : 50;
                const slabT = b.slabT || 180;
                const ySlabTop = glToSlab;
                const ySlabBot = ySlabTop - slabT;
                const deltaH = Math.max(ySlabBot - yBot, 0);
                const dxHaunch = Math.min(deltaH, 100);

                const isSlabFlush = (aboveGl <= glToSlab);

                const xOut = ox;
                const xIn = ox + stemW;
                const xStemCenter = (xOut + xIn) / 2;
                const xBaseEnd = ox + totalBaseW;
                const xSlopeEnd = xBaseEnd + dxHaunch;
                const xBreak = ox + 700;

                const signTitle = b.title || b.id || `FG${idx + 1}`;
                dxf += dText(`【 ${signTitle} 】 ${isFG1 ? 'FG1仕様 (外周)' : 'FG2仕様 (内部)'} [梁成D=${concD}mm]`, ox, yTop + 60, "TEXT", 28);

                // 躯体線
                if (isFG1) {
                    const topY = isSlabFlush ? ySlabTop : yTop;
                    dxf += dLine(xOut, topY, xOut, yBot, "CONCRETE");
                    dxf += dLine(xOut, yBot, xBaseEnd, yBot, "CONCRETE");
                    dxf += dLine(xBaseEnd, yBot, xSlopeEnd, ySlabBot, "CONCRETE");
                    dxf += dLine(xSlopeEnd, ySlabBot, xBreak, ySlabBot, "CONCRETE");
                    dxf += dLine(xBreak, ySlabBot, xBreak, ySlabTop, "CONCRETE");
                    if (!isSlabFlush) {
                        dxf += dLine(xBreak, ySlabTop, xIn, ySlabTop, "CONCRETE");
                        dxf += dLine(xIn, ySlabTop, xIn, yConcTop, "CONCRETE");
                        dxf += dLine(xIn, yConcTop, xOut, yConcTop, "CONCRETE");
                    } else {
                        dxf += dLine(xBreak, ySlabTop, xOut, ySlabTop, "CONCRETE");
                    }
                } else {
                    const xBreakL = xOut - 300;
                    const xBreakR = xIn + 300;
                    dxf += dLine(xOut, yConcTop, xIn, yConcTop, "CONCRETE");
                    dxf += dLine(xIn, yConcTop, xIn, ySlabTop, "CONCRETE");
                    dxf += dLine(xIn, ySlabTop, xBreakR, ySlabTop, "CONCRETE");
                    dxf += dLine(xBreakR, ySlabTop, xBreakR, ySlabBot, "CONCRETE");
                    dxf += dLine(xBreakR, ySlabBot, xIn, ySlabBot, "CONCRETE");
                    dxf += dLine(xIn, ySlabBot, xIn, yBot, "CONCRETE");
                    dxf += dLine(xIn, yBot, xOut, yBot, "CONCRETE");
                    dxf += dLine(xOut, yBot, xOut, ySlabBot, "CONCRETE");
                    dxf += dLine(xOut, ySlabBot, xBreakL, ySlabBot, "CONCRETE");
                    dxf += dLine(xBreakL, ySlabBot, xBreakL, ySlabTop, "CONCRETE");
                    dxf += dLine(xBreakL, ySlabTop, xOut, ySlabTop, "CONCRETE");
                    dxf += dLine(xOut, ySlabTop, xOut, yConcTop, "CONCRETE");
                }

                if (!isSlabFlush && levelerT > 0) {
                    dxf += dLine(xOut, yTop, xIn, yTop, "LEVELER");
                }

                // 通り芯 & GL
                dxf += dLine(xStemCenter, yTop + 30, xStemCenter, yBot - 80, "CENTER");
                dxf += dLine(ox - 150, yGl, ox + 800, yGl, "GL_LINE");
                dxf += dText("GL", ox - 180, yGl + 5, "GL_LINE", 18);

                if (avgGlConfig && avgGlConfig.show) {
                    const yAvg = yGl + (avgGlConfig.diff || 0);
                    dxf += dLine(ox - 150, yAvg, ox + 800, yAvg, "AVG_GL");
                    dxf += dText("平均GL", ox - 210, yAvg + 5, "AVG_GL", 18);

                    if (avgGlConfig.diff !== 0) {
                        dxf += dLine(ox - 200, yGl, ox - 200, yAvg, "DIMENSION");
                        dxf += dText(`GL差 ${avgGlConfig.diff > 0 ? '+' : ''}${avgGlConfig.diff}mm`, ox - 320, (yGl + yAvg)/2 - 5, "DIMENSION", 15);
                    }
                }

                // 配筋幾何
                const hoopCover = 35;
                const hoopL = xOut + hoopCover;
                const hoopR = xIn - hoopCover;
                const stY_top = isSlabFlush ? (ySlabTop - 35) : (yConcTop - 50);
                const stY_bot = yBot + 60;
                const bendR = 20;

                const r13 = REBAR_DATA['D13'] ? REBAR_DATA['D13'].r : 6.35;
                const r16 = REBAR_DATA['D16'] ? REBAR_DATA['D16'].r : 7.95;

                const hyp = Math.hypot(dxHaunch, deltaH) || 1;
                const sinTheta = deltaH / hyp;
                const cosTheta = dxHaunch / hyp;

                const shiftX = (sinTheta > 0.02) ? (60 * (1 - cosTheta) / sinTheta) : 0;
                const stSlopeStartX = Math.max(xBaseEnd - shiftX, xStemCenter + 10);

                const dyRebar = (-(stY_bot)) - (-(ySlabTop - 35));
                const stSlopeEndX = stSlopeStartX + dyRebar * (dxHaunch / (deltaH || 1));

                // スターラップ
                if (isDoubleStem) {
                    const rH = 10;
                    dxf += dLine(hoopL + rH, stY_top, hoopR - rH, stY_top, "REBAR");
                    dxf += dArc(hoopR - rH, stY_top - rH, rH, 0, 90, "REBAR");
                    dxf += dLine(hoopR, stY_top - rH, hoopR, stY_bot + rH, "REBAR");
                    dxf += dArc(hoopR - rH, stY_bot + rH, rH, 270, 360, "REBAR");
                    dxf += dLine(hoopR - rH, stY_bot, hoopL + rH, stY_bot, "REBAR");
                    dxf += dArc(hoopL + rH, stY_bot + rH, rH, 180, 270, "REBAR");
                    dxf += dLine(hoopL, stY_bot + rH, hoopL, stY_top - rH, "REBAR");
                    dxf += dArc(hoopL + rH, stY_top - rH, rH, 90, 180, "REBAR");
                } else {
                    const stX = xStemCenter - 10;
                    if (isFG1) {
                        dxf += dLine(stX + 20, stY_top - 10, stX + 15, stY_top, "REBAR");
                        dxf += dArc(stX + 15, stY_top - 15, 15, 90, 180, "REBAR");
                        dxf += dLine(stX, stY_top - 15, stX, stY_bot + bendR, "REBAR");
                        dxf += dArc(stX + bendR, stY_bot + bendR, bendR, 180, 270, "REBAR");
                        
                        const filletDist = Math.min(18, Math.max(5, (stSlopeStartX - (stX + bendR)) / 2));
                        const p1x = stSlopeStartX - filletDist;
                        dxf += dLine(stX + bendR, stY_bot, p1x, stY_bot, "REBAR");

                        const p2x = stSlopeStartX + filletDist * cosTheta;
                        const p2y = stY_bot + filletDist * sinTheta;
                        dxf += dLine(p1x, stY_bot, p2x, p2y, "REBAR");

                        const p3x = stSlopeEndX - filletDist * cosTheta;
                        const p3y = ySlabTop - 35 - filletDist * sinTheta;
                        dxf += dLine(p2x, p2y, p3x, p3y, "REBAR");

                        dxf += dLine(p3x, p3y, stSlopeEndX + filletDist, ySlabTop - 35, "REBAR");
                        dxf += dLine(stSlopeEndX + filletDist, ySlabTop - 35, xBreak, ySlabTop - 35, "REBAR");
                    } else {
                        dxf += dLine(stX, stY_top - 15, stX, stY_bot + bendR, "REBAR");
                        dxf += dArc(stX + bendR, stY_bot + bendR, bendR, 180, 270, "REBAR");
                        dxf += dLine(stX + bendR, stY_bot, stX + 85, stY_bot, "REBAR");
                    }
                }

                // 主筋
                const topSpec = b.topSpec || '1-D13';
                const botSpec = b.botSpec || '1-D13';

                if (isDoubleStem) {
                    const rTop = topSpec.includes('D16') ? r16 : r13;
                    dxf += dCircle(hoopL + 12, stY_top - 12, rTop, "REBAR");
                    dxf += dCircle(hoopR - 12, stY_top - 12, rTop, "REBAR");
                    const rBot = botSpec.includes('D16') ? r16 : r13;
                    dxf += dCircle(hoopL + 12, stY_bot + 12, rBot, "REBAR");
                    dxf += dCircle(hoopR - 12, stY_bot + 12, rBot, "REBAR");
                } else {
                    const rTop = topSpec.includes('D16') ? r16 : r13;
                    dxf += dCircle(xStemCenter, stY_top - 12, rTop, "REBAR");
                    if (topSpec.includes('2段') || topSpec.startsWith('2-')) {
                        const rTop2 = topSpec.includes('2段D16') ? r16 : rTop;
                        dxf += dCircle(xStemCenter, stY_top - 12 - 38, rTop2, "REBAR");
                    }

                    if (isFG1 && !isMatchStem) {
                        const rBot = botSpec.includes('D16') ? r16 : r13;
                        const pL = xStemCenter - 10 + bendR + 8;
                        const pR = Math.max(stSlopeStartX - 15, pL + 40);
                        const pM = (pL + pR) / 2;
                        if (botSpec.startsWith('3-')) {
                            dxf += dCircle(pL, stY_bot + 12, rBot, "REBAR");
                            dxf += dCircle(pM, stY_bot + 12, rBot, "REBAR");
                            dxf += dCircle(pR, stY_bot + 12, rBot, "REBAR");
                        } else if (botSpec.startsWith('2-')) {
                            dxf += dCircle(pL + 4, stY_bot + 12, rBot, "REBAR");
                            dxf += dCircle(pR - 4, stY_bot + 12, rBot, "REBAR");
                        } else {
                            dxf += dCircle(xStemCenter, stY_bot + 12, rBot, "REBAR");
                        }
                    } else {
                        if (botSpec.includes('2段') || botSpec.includes('+')) {
                            const rB1 = botSpec.startsWith('D16') ? r16 : r13;
                            const rB2 = (botSpec.includes('2段D16') || botSpec.endsWith('D16')) ? r16 : r13;
                            dxf += dCircle(xStemCenter, stY_bot + 12, rB1, "REBAR");
                            dxf += dCircle(xStemCenter, stY_bot + 12 + 36, rB2, "REBAR");
                        } else {
                            const rBot = botSpec.includes('D16') ? r16 : r13;
                            dxf += dCircle(xStemCenter, stY_bot + 12, rBot, "REBAR");
                        }
                    }
                }

                // スラブ筋
                const shortBarStr = (slabCommon && slabCommon.shortBar) ? slabCommon.shortBar : 'D13@150';
                const rShort = REBAR_DATA[shortBarStr.substring(0, 3)] ? REBAR_DATA[shortBarStr.substring(0, 3)].r : r13;

                dxf += dLine(xStemCenter - 10, ySlabTop - 35, xBreak, ySlabTop - 35, "REBAR");
                if (isDoubleSlab) {
                    dxf += dLine(xStemCenter - 10, ySlabBot + 40, xBreak, ySlabBot + 40, "REBAR");
                }

                const startShortX = Math.max(stSlopeEndX + 35, xIn + 70);
                let spx = startShortX;
                while (spx < xBreak - 25) {
                    dxf += dCircle(spx, ySlabTop - 35, rShort, "REBAR");
                    if (isDoubleSlab) dxf += dCircle(spx, ySlabBot + 40, rShort, "REBAR");
                    spx += 150;
                }

                // 注記
                dxf += dText(`上主筋: ${topSpec}`, ox + 220, yTop - 30, "TEXT", 16);
                dxf += dText(`下主筋: ${botSpec}`, ox + 220, yBot + 60, "TEXT", 16);
                const dxfStY = isSlabFlush ? (yGl - embedH * 0.4) : (yGl - 30);
                dxf += dText(`縦筋: ${b.stirrupBar || 'D10@200'}`, ox - 110, dxfStY, "TEXT", 16);

                // 基準レベル対比表
                if (avgGlConfig && avgGlConfig.show && Engine) {
                    const dtTop = Engine.calcRebarDt(topSpec, true, isMatchStem, b.stirrupBar, b.incTopStirrup, isDoubleStem);
                    const dtBot = Engine.calcRebarDt(botSpec, false, isMatchStem, b.stirrupBar, b.incBotStirrup, isDoubleStem);

                    const diff = avgGlConfig.diff || 0;
                    const diffStr = (diff >= 0 ? `+${diff}` : `${diff}`) + "mm";

                    const topAvgVal = aboveGl - diff;
                    const botAvgVal = -embedH - diff;
                    const slabAvgVal = glToSlab - diff;

                    const dEffTop = concD - dtTop.dt;
                    const dEffBot = concD - dtBot.dt;

                    const dtTopStr = (Math.round(dtTop.dt * 10) / 10).toFixed(1);
                    const dEffTopStr = (Math.round(dEffTop * 10) / 10).toFixed(1);
                    const dtBotStr = (Math.round(dtBot.dt * 10) / 10).toFixed(1);
                    const dEffBotStr = (Math.round(dEffBot * 10) / 10).toFixed(1);

                    const tx = ox + 820;
                    const ty = yTop + 60;
                    const tw = 620;
                    const th = 460;

                    dxf += dLine(tx, ty, tx + tw, ty, "TABLE_LINE");
                    dxf += dLine(tx + tw, ty, tx + tw, ty - th, "TABLE_LINE");
                    dxf += dLine(tx + tw, ty - th, tx, ty - th, "TABLE_LINE");
                    dxf += dLine(tx, ty - th, tx, ty, "TABLE_LINE");

                    dxf += dText("【 基準レベル対比表 (高さ±表示) 】", tx + 20, ty - 35, "TEXT", 20);
                    dxf += dLine(tx + 15, ty - 50, tx + tw - 15, ty - 50, "TABLE_LINE");

                    dxf += dText("項目", tx + 25, ty - 80, "TEXT", 16);
                    dxf += dText("設計GL基準(±)", tx + 220, ty - 80, "TEXT", 16);
                    dxf += dText("平均GL基準(±)", tx + 420, ty - 80, "TEXT", 16);

                    dxf += dText("立上り天端", tx + 25, ty - 115, "TEXT", 16);
                    dxf += dText(`+${aboveGl} mm`, tx + 220, ty - 115, "TEXT", 16);
                    dxf += dText(`${topAvgVal >= 0 ? '+' : ''}${topAvgVal} mm`, tx + 420, ty - 115, "TEXT", 16);

                    dxf += dText("根入れ底面", tx + 25, ty - 150, "TEXT", 16);
                    dxf += dText(`-${embedH} mm (※H=${embedH})`, tx + 220, ty - 150, "TEXT", 16);
                    dxf += dText(`${botAvgVal >= 0 ? '+' : ''}${botAvgVal} mm`, tx + 420, ty - 150, "TEXT", 16);

                    dxf += dText(`スラブ天端: 設計GL +${glToSlab}mm ／ 平均GL ${slabAvgVal >= 0 ? '+' : ''}${slabAvgVal}mm (差: ${diffStr})`, tx + 25, ty - 185, "TEXT", 15);

                    dxf += dLine(tx + 15, ty - 205, tx + tw - 15, ty - 205, "TABLE_LINE");
                    dxf += dText(`【 梁成D=${concD}mm (レベラー抜) ・ 有効梁成d 自動算定 】`, tx + 20, ty - 235, "TEXT", 19);

                    dxf += dLine(tx + 20, ty - 255, tx + tw/2 - 10, ty - 255, "TABLE_LINE");
                    dxf += dLine(tx + tw/2 - 10, ty - 255, tx + tw/2 - 10, ty - 380, "TABLE_LINE");
                    dxf += dLine(tx + tw/2 - 10, ty - 380, tx + 20, ty - 380, "TABLE_LINE");
                    dxf += dLine(tx + 20, ty - 380, tx + 20, ty - 255, "TABLE_LINE");

                    dxf += dText(`↑ 上主筋 (${topSpec})`, tx + 30, ty - 280, "TEXT", 16);
                    dxf += dText(`重心距離 dt :  ${dtTopStr} mm`, tx + 30, ty - 315, "TEXT", 16);
                    dxf += dText(`有効梁成 d  :  ${dEffTopStr} mm`, tx + 30, ty - 345, "TEXT", 16);
                    dxf += dText(`(天端かぶり40+STP見込み)`, tx + 30, ty - 370, "TEXT", 13);

                    dxf += dLine(tx + tw/2 + 10, ty - 255, tx + tw - 20, ty - 255, "TABLE_LINE");
                    dxf += dLine(tx + tw - 20, ty - 255, tx + tw - 20, ty - 380, "TABLE_LINE");
                    dxf += dLine(tx + tw - 20, ty - 380, tx + tw/2 + 10, ty - 380, "TABLE_LINE");
                    dxf += dLine(tx + tw/2 + 10, ty - 380, tx + tw/2 + 10, ty - 255, "TABLE_LINE");

                    dxf += dText(`↓ 下主筋 (${botSpec})`, tx + tw/2 + 20, ty - 280, "TEXT", 16);
                    dxf += dText(`重心距離 dt :  ${dtBotStr} mm`, tx + tw/2 + 20, ty - 315, "TEXT", 16);
                    dxf += dText(`有効梁成 d  :  ${dEffBotStr} mm`, tx + tw/2 + 20, ty - 345, "TEXT", 16);
                    dxf += dText(`(底面かぶり60+STP見込み)`, tx + tw/2 + 20, ty - 370, "TEXT", 13);

                    dxf += dLine(tx + 15, ty - 400, tx + tw - 15, ty - 400, "TABLE_LINE");
                    dxf += dText("※腹筋はD10＠300以下で配す。", tx + 25, ty - 435, "TEXT", 18);
                }
            });

            dxf += "0\r\nENDSEC\r\n0\r\nEOF\r\n";
            return dxf;
        },

        /**
         * DXFファイルをダウンロード
         */
        downloadDXF: function(dxfString, filename) {
            if (typeof document === 'undefined') return;
            const fname = filename || 'Foundation_Beam_Section_Details.dxf';
            let blob;
            if (typeof Encoding !== 'undefined') {
                const unicodeArray = Encoding.stringToCode(dxfString);
                const sjisArray = Encoding.convert(unicodeArray, { to: 'SJIS', from: 'UNICODE' });
                const u8 = new Uint8Array(sjisArray);
                blob = new Blob([u8], { type: 'application/dxf' });
            } else {
                blob = new Blob([dxfString], { type: 'application/dxf;charset=shift_jis' });
            }

            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fname;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = FoundationSectionDxfExporter;
    }
    if (typeof window !== 'undefined') {
        window.FoundationSectionDxfExporter = FoundationSectionDxfExporter;
        if (window.ServiceContainer) {
            window.ServiceContainer.register('FoundationSectionDxfExporter', FoundationSectionDxfExporter);
        }
    }
})(typeof exports === 'undefined' ? this : exports);
