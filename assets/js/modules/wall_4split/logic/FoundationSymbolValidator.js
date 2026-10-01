/**
 * logic/FoundationSymbolValidator.js - Foundation Beam Symbol & Specification Consistency Validator
 * v3.13.39: Single Responsibility Principle (SRP)
 */

(function(exports) {
    'use strict';

    const FoundationSymbolValidator = {
        /**
         * 伏図全体の基礎梁スパン間で、同一符号なのに仕様が異なる不整合を検出
         * @param {Object} state - AppState
         * @returns {Array<Object>} 不整合警告オブジェクトのリスト
         */
        validateSymbolsConsistency: function(state) {
            const s = state || (typeof window !== 'undefined' ? window.AppState : null);
            if (!s || !s.foundationBeams) return [];

            // 符号ごとにスパン情報を収集
            const symbolGroups = {};

            s.foundationBeams.forEach(beam => {
                const bp = beam.props || {};
                const beamAxis = (beam.p1 && beam.p2 && typeof window !== 'undefined' && window.GridEngine) 
                    ? window.GridEngine.getLineAxisName(beam.p1, beam.p2, s) 
                    : '';
                const axisStr = beamAxis ? `${beamAxis}通り` : (beam.id ? `梁#${beam.id}` : '梁');

                if (beam.spans && beam.spans.length > 0) {
                    beam.spans.forEach((span, sIdx) => {
                        const spProps = span.props || {};
                        const symbol = (spProps.symbol || span.symbol || bp.symbol || `FG${sIdx + 1}`).trim();
                        if (!symbol) return;

                        const spanName = this._getSpanDisplayName(span, sIdx, beam, s);
                        const spec = {
                            beamId: beam.id,
                            spanIndex: sIdx,
                            axisStr: axisStr,
                            spanName: spanName,
                            fullLocation: `${axisStr} (${spanName})`,
                            symbol: symbol,
                            width: spProps.width !== undefined ? spProps.width : (bp.width || 150),
                            height: spProps.height !== undefined ? spProps.height : (bp.height || 640),
                            embedDepth: spProps.embedDepth !== undefined ? spProps.embedDepth : (bp.embedDepth ?? 250),
                            topRebar: (spProps.topRebar || bp.topRebar || '1-D13').trim(),
                            bottomRebar: (spProps.bottomRebar || bp.bottomRebar || '1-D13').trim(),
                            stirrup: (spProps.stirrup || bp.stirrup || '1-D10@200').trim()
                        };

                        if (!symbolGroups[symbol]) {
                            symbolGroups[symbol] = [];
                        }
                        symbolGroups[symbol].push(spec);
                    });
                } else if (beam.p1 && beam.p2) {
                    const symbol = (bp.symbol || bp.beamName || 'FG1').trim();
                    const spec = {
                        beamId: beam.id,
                        spanIndex: 0,
                        axisStr: axisStr,
                        spanName: '全区間',
                        fullLocation: `${axisStr} (全区間)`,
                        symbol: symbol,
                        width: bp.width || 150,
                        height: bp.height || 640,
                        embedDepth: bp.embedDepth ?? 250,
                        topRebar: (bp.topRebar || '1-D13').trim(),
                        bottomRebar: (bp.bottomRebar || '1-D13').trim(),
                        stirrup: (bp.stirrup || '1-D10@200').trim()
                    };

                    if (!symbolGroups[symbol]) {
                        symbolGroups[symbol] = [];
                    }
                    symbolGroups[symbol].push(spec);
                }
            });

            // 仕様の相違を判定
            const inconsistencies = [];

            Object.keys(symbolGroups).forEach(symbol => {
                const spans = symbolGroups[symbol];
                if (spans.length <= 1) return;

                const baseSpec = spans[0];
                const diffSpans = [];

                for (let i = 1; i < spans.length; i++) {
                    const cur = spans[i];
                    const diffs = [];

                    if (cur.width !== baseSpec.width) diffs.push(`梁幅: ${baseSpec.width}mm vs ${cur.width}mm`);
                    if (cur.height !== baseSpec.height) diffs.push(`梁成: ${baseSpec.height}mm vs ${cur.height}mm`);
                    if (cur.embedDepth !== baseSpec.embedDepth) diffs.push(`根入れ: ${baseSpec.embedDepth}mm vs ${cur.embedDepth}mm`);
                    if (cur.topRebar !== baseSpec.topRebar) diffs.push(`上主筋: ${baseSpec.topRebar} vs ${cur.topRebar}`);
                    if (cur.bottomRebar !== baseSpec.bottomRebar) diffs.push(`下主筋: ${baseSpec.bottomRebar} vs ${cur.bottomRebar}`);
                    if (cur.stirrup !== baseSpec.stirrup) diffs.push(`STP筋: ${baseSpec.stirrup} vs ${cur.stirrup}`);

                    if (diffs.length > 0) {
                        diffSpans.push({
                            locationA: baseSpec.fullLocation,
                            locationB: cur.fullLocation,
                            diffDetails: diffs
                        });
                    }
                }

                if (diffSpans.length > 0) {
                    inconsistencies.push({
                        symbol: symbol,
                        count: spans.length,
                        conflicts: diffSpans,
                        message: `符号『${symbol}』において、スパン間で形状・主筋仕様が異なっています。符号を分けるか仕様を統一してください。`
                    });
                }
            });

            return inconsistencies;
        },

        _getSpanDisplayName: function(span, sIdx, beam, s) {
            const getPName = (p) => {
                if (!p) return `支点${sIdx}`;
                const px = p.globalX ?? (p.x * 1000) ?? 0;
                const py = p.globalY ?? (p.y * 1000) ?? 0;
                if (typeof window !== 'undefined' && window.getGridNameAt) {
                    const gName = window.getGridNameAt(px, py);
                    if (gName) return gName;
                }
                return p.name || `P${sIdx}`;
            };
            const p1Name = getPName(span.startNode);
            const p2Name = getPName(span.endNode);
            return `${p1Name}-${p2Name}`;
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = FoundationSymbolValidator;
    }
    if (typeof window !== 'undefined') {
        window.FoundationSymbolValidator = FoundationSymbolValidator;
        if (window.ServiceContainer) {
            window.ServiceContainer.register('FoundationSymbolValidator', FoundationSymbolValidator);
        }
    }
})(typeof exports === 'undefined' ? this : exports);
