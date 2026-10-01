/**
 * logic/FoundationSectionEngine.js - Foundation Beam Cross Section Geometry & Rebar Stress Calculation Engine
 * v3.13.39: Single Responsibility Principle (SRP) - Pure Calculation & Geometry Engine
 */

(function(exports) {
    'use strict';

    const REBAR_DATA = {
        'D10': { d: 9.53, r: 4.765, a: 71.33 },
        'D13': { d: 12.7,  r: 6.35,  a: 126.7 },
        'D16': { d: 15.9,  r: 7.95,  a: 198.6 },
        'D19': { d: 19.1,  r: 9.55,  a: 286.5 },
        'D22': { d: 22.2,  r: 11.1,  a: 387.1 }
    };

    const FoundationSectionEngine = {
        REBAR_DATA: REBAR_DATA,

        /**
         * 鉄筋の半径を取得
         */
        getBarRadius: function(str) {
            if (!str) return 6.0;
            if (str.includes('D22')) return 11.1;
            if (str.includes('D19')) return 9.55;
            if (str.includes('D16')) return 7.95;
            if (str.includes('D13')) return 6.35;
            if (str.includes('D10')) return 4.765;
            return 6.0;
        },

        /**
         * 重心距離 dt (mm) および有効梁成 d (mm) を算定
         */
        calcRebarDt: function(spec, isTop, isMatchStem, stirrupStr, incStirrup, isDoubleStem) {
            try {
                const dst = (incStirrup !== false) 
                    ? ((stirrupStr && stirrupStr.includes('D13')) ? REBAR_DATA['D13'].d : REBAR_DATA['D10'].d) 
                    : 0;
                const clearGap = 30;

                if (isTop) {
                    const coverNet = 40 + dst;
                    const is2Row = (spec && (spec.includes('2段') || spec.includes('+')));

                    if (is2Row) {
                        let r1 = REBAR_DATA['D13'].r;
                        let r2 = REBAR_DATA['D13'].r;
                        if (spec.startsWith('2-D16') || spec.includes('D16+')) { r1 = REBAR_DATA['D16'].r; }
                        if (spec.includes('2段2-D16') || spec.includes('2段D16')) { r2 = REBAR_DATA['D16'].r; }

                        const y1 = coverNet + r1;
                        const y2 = y1 + r1 + clearGap + r2;
                        const dt = (y1 + y2) / 2;
                        return { dt: dt, is2Row: true, y1: y1, y2: y2 };
                    } else if (spec && spec.startsWith('2-') && !isDoubleStem) {
                        const dKey = spec.includes('D16') ? 'D16' : 'D13';
                        const db = REBAR_DATA[dKey] || REBAR_DATA['D13'];
                        const y1 = coverNet + db.r;
                        const y2 = y1 + db.r + clearGap + db.r;
                        const dt = (y1 + y2) / 2;
                        return { dt: dt, is2Row: true, y1: y1, y2: y2 };
                    } else {
                        const dKey = (spec && spec.includes('D16')) ? 'D16' : 'D13';
                        const db = REBAR_DATA[dKey] || REBAR_DATA['D13'];
                        const y1 = coverNet + db.r;
                        return { dt: y1, is2Row: false, y1: y1 };
                    }
                } else {
                    const coverNet = 60 + dst;
                    const is2Row = (spec && (spec.includes('2段') || spec.includes('+')));

                    if (is2Row) {
                        let r1 = REBAR_DATA['D13'].r;
                        let r2 = REBAR_DATA['D16'].r;

                        if (spec.startsWith('D16+2段D13')) {
                            r1 = REBAR_DATA['D16'].r;
                            r2 = REBAR_DATA['D13'].r;
                        } else if (spec.startsWith('D13+2段D16') || spec.includes('2-D13+2段2-D16')) {
                            r1 = REBAR_DATA['D13'].r;
                            r2 = REBAR_DATA['D16'].r;
                        } else if (spec.includes('D16')) {
                            r1 = REBAR_DATA['D16'].r;
                            r2 = REBAR_DATA['D16'].r;
                        } else {
                            r1 = REBAR_DATA['D13'].r;
                            r2 = REBAR_DATA['D13'].r;
                        }

                        const y1 = coverNet + r1;
                        const y2 = y1 + r1 + clearGap + r2;
                        const dt = (y1 + y2) / 2;
                        return { dt: dt, is2Row: true, y1: y1, y2: y2 };
                    } else {
                        const dKey = (spec && spec.includes('D16')) ? 'D16' : 'D13';
                        const db = REBAR_DATA[dKey] || REBAR_DATA['D13'];
                        const y1 = coverNet + db.r;
                        return { dt: y1, is2Row: false, y1: y1 };
                    }
                }
            } catch (e) {
                return { dt: isTop ? 56.5 : 76.5, is2Row: false, y1: isTop ? 56.5 : 76.5 };
            }
        },

        /**
         * 基礎梁の断面幾何学パラメータを算定
         */
        calculateGeometry: function(beam, avgGlConfig) {
            const b = beam || {};
            const isFG1 = (b.baseSpec === 'FG1');
            const isDoubleStem = (b.stemArrangement === 'double');
            const isDoubleSlab = (b.slabArrangement === 'double');

            const aboveGl = (typeof b.aboveGl === 'number') ? b.aboveGl : 400;
            const embedH = (typeof b.embedH === 'number') ? b.embedH : 500;
            const totalH = aboveGl + embedH;
            const levelerT = (typeof b.levelerT === 'number') ? b.levelerT : 10;
            const concD = Math.max(totalH - levelerT, 100);

            const stemW = b.stemW || 150;
            const slabT = b.slabT || 180;
            const glToSlab = (typeof b.glToSlab === 'number') ? b.glToSlab : 50;
            const isMatchStem = (b.baseToeWidthType === 'matchStem');
            const totalBaseW = isFG1 ? (isMatchStem ? stemW : 250) : stemW;
            const toeW = Math.max(totalBaseW - stemW, 0);

            // 天端がスラブと揃うケース（FG5等の天端同寸）
            const isSlabFlush = (aboveGl <= glToSlab);

            // 基準レベル（設計GL = 0基準）
            const yFinishTop = aboveGl;
            const yConcTop = aboveGl - levelerT;
            const yGl = 0;
            const ySlabTop = glToSlab;
            const ySlabBot = glToSlab - slabT;
            const yBaseBot = -embedH;

            // 平均GL
            const avgDiff = (avgGlConfig && avgGlConfig.show) ? (avgGlConfig.diff || 0) : 0;
            const yAvgGl = yGl + avgDiff;

            // 配筋と重心距離dt算定
            const dtTopInfo = this.calcRebarDt(b.topSpec, true, isMatchStem, b.stirrupBar, b.incTopStirrup, isDoubleStem);
            const dtBotInfo = this.calcRebarDt(b.botSpec, false, isMatchStem, b.stirrupBar, b.incBotStirrup, isDoubleStem);

            const dEffTop = concD - dtTopInfo.dt;
            const dEffBot = concD - dtBotInfo.dt;

            return {
                isFG1,
                isDoubleStem,
                isDoubleSlab,
                isMatchStem,
                isSlabFlush,
                aboveGl,
                embedH,
                totalH,
                concD,
                stemW,
                slabT,
                glToSlab,
                levelerT,
                totalBaseW,
                toeW,
                levels: {
                    yFinishTop,
                    yConcTop,
                    yGl,
                    ySlabTop,
                    ySlabBot,
                    yBaseBot,
                    yAvgGl,
                    avgDiff
                },
                dtTopInfo,
                dtBotInfo,
                dEffTop,
                dEffBot
            };
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = FoundationSectionEngine;
    }
    if (typeof window !== 'undefined') {
        window.FoundationSectionEngine = FoundationSectionEngine;
        if (window.ServiceContainer) {
            window.ServiceContainer.register('FoundationSectionEngine', FoundationSectionEngine);
        }
    }
})(typeof exports === 'undefined' ? this : exports);
