/**
 * WasmBridge.js
 * WebAssembly (Wasm) による計算コア知的財産（IP）保護＆ドメインロック・ブリッジ
 * 
 * - ブラウザ環境: assets/wasm/wall_calculator.wasm をロードし、バイナリ内で保護された高速計算を実行
 * - 対象計算コア: 必要壁量算定、告示1460号柱N値計算、細長比算定、基礎梁応力算定、基礎スラブ応力・断面検定
 * - ドメインロック: 許可されたオリジン (2025.eie.jp / localhost / 127.0.0.1) のみ稼働
 * - 透過的フォールバック: Wasm未完了時・オフライン開発・Node.jsテスト環境では既存JSロジックへ自動委譲
 */

(function(global) {
    'use strict';

    function computeDomainHash(str) {
        if (!str || typeof str !== 'string') return 0;
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash = hash | 0;
        }
        return hash;
    }

    const SUPPORT_TYPE_MAP = {
        '4辺固定': 0,
        '4辺ピン': 1,
        '片持ち': 2,
        '長辺2辺固定短辺2辺ピン': 3,
        '短辺2辺固定長辺2辺ピン': 4,
        '1辺固定3辺ピン（長辺固定）': 5,
        '1辺固定3辺ピン（短辺固定）': 6,
        '2隣辺固定2隣辺ピン': 7,
        '3辺固定1辺ピン（長辺ピン）': 8,
        '3辺固定1辺ピン（短辺ピン）': 9,
        '4辺固定(ピン扱い)': 10
    };

    const WasmBridge = {
        isLoaded: false,
        isLoading: false,
        wasmInstance: null,
        domainHash: 0,
        loadError: null,
        licenseState: {
            isAuthenticated: false,
            isSubscribed: false,
            planKey: null
        },

        /**
         * 認証・ライセンス状態の設定
         */
        setLicenseState: function(state) {
            this.licenseState = Object.assign(this.licenseState, state || {});
            console.log('🛡️ [WasmBridge] License State Updated:', this.licenseState.isSubscribed ? 'Subscribed' : 'Free');
        },

        /**
         * 有効なライセンス（サブスクまたは社内無償）を保有しているか
         */
        isLicenseActive: function() {
            return !!(this.licenseState && this.licenseState.isSubscribed);
        },

        /**
         * Wasmモジュールを非同期初期化
         * @param {string} wasmUrl
         * @returns {Promise<boolean>}
         */
        init: async function(wasmUrl) {
            if (this.isLoaded) return true;
            if (this.isLoading) return false;

            const url = wasmUrl || 'assets/wasm/wall_calculator.wasm';

            // ドメインハッシュの算定 (ブラウザ時)
            if (typeof window !== 'undefined' && window.location && window.location.hostname) {
                this.domainHash = computeDomainHash(window.location.hostname);
            } else {
                // Node.js または開発環境フォールバック
                this.domainHash = 906931598; // localhost hash
            }

            // WebAssembly API が存在しない環境
            if (typeof WebAssembly === 'undefined') {
                console.warn('[WasmBridge] WebAssembly is not supported in this environment. Falling back to JS.');
                return false;
            }

            this.isLoading = true;

            try {
                const isNode = (typeof process !== 'undefined' && process.versions && !!process.versions.node);
                if (isNode) {
                    // Node.js テスト用
                    const fs = require('fs');
                    const path = require('path');
                    let filePath = path.resolve(process.cwd(), 'assets/wasm/wall_calculator.wasm');
                    if (!fs.existsSync(filePath)) {
                        filePath = path.resolve(__dirname, '../../../../../assets/wasm/wall_calculator.wasm');
                    }
                    if (fs.existsSync(filePath)) {
                        const buffer = fs.readFileSync(filePath);
                        const module = await WebAssembly.instantiate(buffer);
                        this.wasmInstance = module.instance;
                    } else {
                        throw new Error('Wasm file not found on local disk: ' + filePath);
                    }
                } else if (typeof fetch !== 'undefined') {
                    // ブラウザ用
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch wasm: ${response.status} ${response.statusText}`);
                    }
                    const bytes = await response.arrayBuffer();
                    const module = await WebAssembly.instantiate(bytes);
                    this.wasmInstance = module.instance;
                }

                if (this.wasmInstance && this.wasmInstance.exports) {
                    this.isLoaded = true;
                    this.loadError = null;
                    console.log('🛡️ [WasmBridge] WebAssembly calculation core initialized with Domain Protection.');
                    return true;
                }
            } catch (err) {
                this.loadError = err;
                console.warn('[WasmBridge] Wasm initialization failed. Falling back to JS core.', err.message);
            } finally {
                this.isLoading = false;
            }

            return false;
        },

        /**
         * Wasmが利用可能か
         */
        isReady: function() {
            return this.isLoaded && !!this.wasmInstance;
        },

        // =====================================================================
        // 1. 必要壁量算定 (Wall Quantity)
        // =====================================================================
        calculateRequiredWall: function(params) {
            params = params || {};

            if (this.isReady()) {
                try {
                    const exports = this.wasmInstance.exports;

                    const h1 = Math.max(1.0, parseFloat(params.floorHeight1F) || 2.70);
                    const h2 = Math.max(1.0, parseFloat(params.floorHeight2F) || 2.70);
                    const roofHeight = Math.max(0.5, parseFloat(params.roofHeight) || 1.71);
                    const overhang = Math.max(0, parseFloat(params.overhang) || 0.75);
                    const roofSlope = Math.max(0.5, parseFloat(params.roofSlope) || 4.0);
                    const area1F = Math.max(0, parseFloat(params.floorArea1F) || 0);
                    const area2F = Math.max(0, parseFloat(params.floorArea2F) || 0);

                    let rawRoofWeight = 500;
                    if (typeof params.roofType === 'number') {
                        rawRoofWeight = params.roofType;
                    } else if (params.roofType === 'slate') {
                        rawRoofWeight = 740;
                    } else if (params.roofType === 'tile') {
                        rawRoofWeight = 990;
                    } else if (params.roofType === 'metal') {
                        rawRoofWeight = 500;
                    } else if (typeof params.roofWeight === 'number') {
                        rawRoofWeight = params.roofWeight;
                    }

                    let rawExtWallWeight = 600;
                    if (typeof params.extWallType === 'number') {
                        rawExtWallWeight = params.extWallType;
                    } else if (params.extWallType === 'mortar' || params.extWallType === 'soil') {
                        rawExtWallWeight = (params.extWallType === 'soil') ? 1000 : 890;
                    } else if (params.extWallType === 'board') {
                        rawExtWallWeight = 350;
                    } else if (params.extWallType === 'metal_sheet') {
                        rawExtWallWeight = 500;
                    } else if (params.extWallType === 'siding') {
                        rawExtWallWeight = 600;
                    } else if (typeof params.extWallWeight === 'number') {
                        rawExtWallWeight = params.extWallWeight;
                    }

                    const hasSolar = (!!params.hasSolar || (parseFloat(params.solarWeight) > 0)) ? 1 : 0;
                    const solarWeight = 200.0;
                    const ceilingIns = (params.ceilingIns !== undefined && params.ceilingIns !== null) ?
                        parseFloat(params.ceilingIns) : 100.0;
                    const wallIns = (params.wallIns !== undefined && params.wallIns !== null) ?
                        parseFloat(params.wallIns) : 70.0;

                    const buildingUseType = (params.buildingUse === 'office' || params.buildingUse === 'non_residential') ? 1 : 0;

                    let standardType = 0;
                    if (params.standard === 'grade1') standardType = 1;
                    else if (params.standard === 'grade2') standardType = 2;
                    else if (params.standard === 'grade3') standardType = 3;

                    const isSnowArea = params.isSnowArea ? 1 : 0;
                    const snowDepth = parseFloat(params.snowDepth) || 0;
                    const snowUnitLoad = parseFloat(params.snowUnitLoad) || 20;

                    const C0 = parseFloat(params.C0) || 0.2;
                    const Z = parseFloat(params.Z) || 1.0;

                    const status = exports.calculateRequiredWallCore(
                        h1, h2, roofHeight, overhang, roofSlope,
                        area1F, area2F,
                        rawRoofWeight, rawExtWallWeight,
                        hasSolar, solarWeight,
                        ceilingIns, wallIns,
                        buildingUseType, standardType,
                        isSnowArea, snowDepth, snowUnitLoad,
                        C0, Z,
                        this.domainHash
                    );

                    if (status === 1) {
                        return {
                            cq1: exports.getCalculatedCQ1(),
                            cq2: exports.getCalculatedCQ2(),
                            q1_cm: exports.getCalculatedQ1(),
                            q2_cm: exports.getCalculatedQ2(),
                            engine: 'wasm',
                            details: {
                                buildingUse: params.buildingUse || 'residential',
                                standard: params.standard || 'kijun',
                                is2Story: (area2F > 0)
                            }
                        };
                    } else if (status === -1) {
                        console.error('🚫 [WasmBridge] Security Error: Unauthorized Domain Lock. Calculation blocked.');
                        return { cq1: 0, cq2: 0, q1_cm: 0, q2_cm: 0, engine: 'wasm_locked', error: 'Unauthorized Domain Lock' };
                    }
                } catch (e) {
                    console.warn('[WasmBridge] Error during Wasm calculation, falling back to JS:', e);
                }
            }

            // フォールバック: 既存JS
            if (global.RequiredWallCalculator && global.RequiredWallCalculator._calculateJS) {
                const jsResult = global.RequiredWallCalculator._calculateJS(params);
                jsResult.engine = 'js_fallback';
                return jsResult;
            }

            return { cq1: 0.29, cq2: 0.15, q1_cm: 29, q2_cm: 15, engine: 'fallback_default' };
        },

        // =====================================================================
        // 2. 柱N値計算 & 細長比 (N-Value & Slenderness Ratio)
        // =====================================================================
        calculateTable314Correction: function(brace1, brace2) {
            if (this.isReady() && this.wasmInstance.exports.calcTable314CorrectionCore) {
                try {
                    const exports = this.wasmInstance.exports;
                    const hasB1 = brace1 ? 1 : 0;
                    const b1_m = brace1 ? (parseFloat(brace1.m) || 0.0) : 0.0;
                    const b1_isP1 = (brace1 && brace1.type === 'P1') ? 1 : 0;
                    const hasB2 = brace2 ? 1 : 0;
                    const b2_m = brace2 ? (parseFloat(brace2.m) || 0.0) : 0.0;
                    const b2_isP1 = (brace2 && brace2.type === 'P1') ? 1 : 0;

                    return exports.calcTable314CorrectionCore(hasB1, b1_m, b1_isP1, hasB2, b2_m, b2_isP1);
                } catch (e) {
                    console.warn('[WasmBridge] Table314Correction Wasm error, fallback to JS:', e);
                }
            }

            // JSフォールバック
            if (!brace1 && !brace2) return 0;
            if ((brace1 && brace1.m === 4.0) || (brace2 && brace2.m === 4.0)) return 0.5;
            if (!brace1 || !brace2) {
                let b = brace1 || brace2;
                if (b.m === 1.5 || b.m === 2.0) return b.type === 'P1' ? -0.5 : 0.5;
                if (b.m === 3.0) return b.type === 'P1' ? -2.0 : 2.0;
                return 0;
            }
            let m = Math.max(brace1.m, brace2.m);
            let types = [brace1.type, brace2.type].sort().join('');
            if (m === 1.5 || m === 2.0) {
                if (types === 'P1P1') return 0;
                if (types === 'P2P2') return 1.0;
                if (types === 'P1P2') return 1.5;
            }
            if (m === 3.0) {
                if (types === 'P1P1') return 0;
                if (types === 'P2P2') return 2.0;
                if (types === 'P1P2') return 2.0;
            }
            return 0;
        },

        calculateSlendernessRatio: function(l_0, d) {
            if (this.isReady() && this.wasmInstance.exports.calcSlendernessRatioCore) {
                try {
                    return this.wasmInstance.exports.calcSlendernessRatioCore(parseFloat(l_0) || 2.7, parseFloat(d) || 105.0);
                } catch (e) {
                    console.warn('[WasmBridge] SlendernessRatio Wasm error, fallback to JS:', e);
                }
            }
            const p_d = parseFloat(d) || 105;
            const p_l0 = parseFloat(l_0) || 2.7;
            return Math.round(((p_l0 * 1000 * Math.sqrt(12)) / p_d) * 10) / 10;
        },

        calculatePillarN: function(params) {
            params = params || {};
            const aX = parseFloat(params.aX) || 0.0;
            const aY = parseFloat(params.aY) || 0.0;
            const b = parseFloat(params.b) || 0.5;
            const k = parseFloat(params.k) || 1.0;
            const L = parseFloat(params.L) || 0.0;
            const upperAx = parseFloat(params.upperAx) || 0.0;
            const upperAy = parseFloat(params.upperAy) || 0.0;
            const upperB = parseFloat(params.upperB) || 0.5;
            const upperK = parseFloat(params.upperK) || 1.0;
            const hasUpper = params.hasUpper ? 1 : 0;

            if (this.isReady() && this.wasmInstance.exports.calculatePillarNValCore) {
                try {
                    const nVal = this.wasmInstance.exports.calculatePillarNValCore(
                        aX, aY, b, k, L,
                        upperAx, upperAy, upperB, upperK,
                        hasUpper, this.domainHash
                    );
                    if (nVal >= 0.0) {
                        return { nValue: nVal, engine: 'wasm' };
                    } else {
                        console.error('🚫 [WasmBridge] PillarN Calculation blocked by Domain Lock.');
                        return { nValue: 0.0, engine: 'wasm_locked' };
                    }
                } catch (e) {
                    console.warn('[WasmBridge] PillarN Wasm error, fallback to JS:', e);
                }
            }

            // JSフォールバック
            let upX = hasUpper ? (upperAx * upperB * upperK) : 0.0;
            let upY = hasUpper ? (upperAy * upperB * upperK) : 0.0;
            let nX = (aX * b * k) + upX - L;
            let nY = (aY * b * k) + upY - L;
            let nFinal = Math.max(0, nX, nY);
            return { nValue: Math.round(nFinal * 100) / 100, engine: 'js_fallback' };
        },

        // =====================================================================
        // 3. 基礎梁応力算定 (Foundation Beam Stress)
        // =====================================================================
        calculateBeamStress: function(params) {
            params = params || {};
            const L = parseFloat(params.length) || 1.82;
            const loadPerM = parseFloat(params.tributaryLoad) || 12.5;
            const b = parseFloat(params.width) || 150.0;
            const D = parseFloat(params.height) || 450.0;
            const rebarArea = parseFloat(params.rebarArea) || 253.4;
            const ft = parseFloat(params.ft) || 195.0;

            if (this.isReady() && this.wasmInstance.exports.calculateBeamStressCore) {
                try {
                    const status = this.wasmInstance.exports.calculateBeamStressCore(
                        L, loadPerM, b, D, rebarArea, ft, this.domainHash
                    );
                    if (status === 1) {
                        const exports = this.wasmInstance.exports;
                        const maxMoment = exports.getBeamMaxMoment();
                        const maxShear = exports.getBeamMaxShear();
                        const allowableMoment = exports.getBeamAllowableMoment();
                        const ratioM = exports.getBeamRatioM();

                        return {
                            beamId: params.beamId || 'FB-1',
                            spanLength: L,
                            unitLoad: loadPerM,
                            maxMoment: maxMoment,
                            maxShear: maxShear,
                            allowableMoment: allowableMoment,
                            isOkMoment: (maxMoment <= allowableMoment),
                            utilizationRatioM: ratioM,
                            recommendedRebar: ratioM > 1.0 ? 'D16 2本' : 'D13 2本',
                            engine: 'wasm'
                        };
                    } else if (status === -1) {
                        console.error('🚫 [WasmBridge] BeamStress Calculation blocked by Domain Lock.');
                        return null;
                    }
                } catch (e) {
                    console.warn('[WasmBridge] BeamStress Wasm error, fallback to JS:', e);
                }
            }

            // JSフォールバック
            const M_max = (loadPerM * L * L) / 8.0;
            const Q_max = (loadPerM * L) / 2.0;
            const d = Math.max(10, D - 70);
            const Ma = (rebarArea * ft * (0.875 * d)) / 1000000;
            const isOkM = M_max <= Ma;
            const ratioM = Ma > 0 ? (M_max / Ma) : 1.0;

            return {
                beamId: params.beamId || 'FB-1',
                spanLength: L,
                unitLoad: loadPerM,
                maxMoment: M_max,
                maxShear: Q_max,
                allowableMoment: Ma,
                isOkMoment: isOkM,
                utilizationRatioM: ratioM,
                recommendedRebar: ratioM > 1.0 ? 'D16 2本' : 'D13 2本',
                engine: 'js_fallback'
            };
        },

        // =====================================================================
        // 4. 基礎スラブ応力算定 (Foundation Slab Analysis)
        // =====================================================================
        calculateSlabStress: function(params) {
            params = params || {};
            const qTotal = parseFloat(params.qTotal) || 0.0;
            const lx = parseFloat(params.lx) || 1.0;
            const ly = parseFloat(params.ly) || 1.0;
            const supportName = params.support || '4辺固定';
            const supportType = SUPPORT_TYPE_MAP.hasOwnProperty(supportName) ? SUPPORT_TYPE_MAP[supportName] : 0;
            const D = parseFloat(params.thickness) || 150.0;
            const dt = parseFloat(params.coverDepth) || 70.0;
            const at_short = parseFloat(params.at_short) || 0.0;
            const at_long = parseFloat(params.at_long) || 0.0;
            const cantileverLength = parseFloat(params.cantileverLength) || 0.9;

            if (this.isReady() && this.wasmInstance.exports.calculateSlabStressCore) {
                try {
                    const status = this.wasmInstance.exports.calculateSlabStressCore(
                        qTotal, lx, ly, supportType, D, dt, at_short, at_long, cantileverLength, this.domainHash
                    );
                    if (status === 1) {
                        const exports = this.wasmInstance.exports;
                        return {
                            Mx_center: exports.getSlabMxCenter(),
                            Mx_end: exports.getSlabMxEnd(),
                            My_center: exports.getSlabMyCenter(),
                            My_end: exports.getSlabMyEnd(),
                            Ma_short: exports.getSlabMaShort(),
                            Ma_long: exports.getSlabMaLong(),
                            ratioShort: exports.getSlabRatioShort(),
                            ratioLong: exports.getSlabRatioLong(),
                            isNG: (exports.getSlabRatioShort() > 1.0 || exports.getSlabRatioLong() > 1.0),
                            engine: 'wasm'
                        };
                    } else if (status === -1) {
                        console.error('🚫 [WasmBridge] SlabStress Calculation blocked by Domain Lock.');
                        return null;
                    }
                } catch (e) {
                    console.warn('[WasmBridge] SlabStress Wasm error, fallback to JS:', e);
                }
            }

            // JSフォールバック (FoundationSlabAnalysisEngine の COEFFS を使用)
            const COEFFS = {
                '4辺固定':                     { mcx: 0.024, max: 0.052, mcy: 0.048, may: 0.082 },
                '4辺ピン':                     { mcx: 0.080, max: 0.000, mcy: 0.050, may: 0.000 },
                '片持ち':                      { mcx: 0.500, max: 0.000, mcy: 0.000, may: 0.000 },
                '長辺2辺固定短辺2辺ピン':      { mcx: 0.040, max: 0.080, mcy: 0.025, may: 0.000 },
                '短辺2辺固定長辺2辺ピン':      { mcx: 0.030, max: 0.000, mcy: 0.060, may: 0.090 },
                '1辺固定3辺ピン（長辺固定）':  { mcx: 0.065, max: 0.100, mcy: 0.040, may: 0.000 },
                '1辺固定3辺ピン（短辺固定）':  { mcx: 0.050, max: 0.000, mcy: 0.075, may: 0.110 },
                '2隣辺固定2隣辺ピン':          { mcx: 0.045, max: 0.085, mcy: 0.035, may: 0.070 },
                '3辺固定1辺ピン（長辺ピン）':  { mcx: 0.030, max: 0.065, mcy: 0.035, may: 0.075 },
                '3辺固定1辺ピン（短辺ピン）':  { mcx: 0.035, max: 0.075, mcy: 0.030, may: 0.065 },
                '4辺固定(ピン扱い)':           { mcx: 0.080, max: 0.000, mcy: 0.050, may: 0.000 }
            };

            const d = Math.max(10, D - dt);
            const j = d * 0.875;
            const Ma_short = 195 * at_short * j / 1e6;
            const Ma_long  = 195 * at_long  * j / 1e6;

            if (supportName === '片持ち') {
                const Mx = 0.5 * qTotal * ((cantileverLength || 0.9) ** 2);
                return {
                    Mx_center: Mx, Mx_end: 0, My_center: 0, My_end: 0,
                    Ma_short: Ma_short, Ma_long: Ma_long,
                    ratioShort: Mx / (Ma_short || 1), ratioLong: 0,
                    isNG: Mx > Ma_short, engine: 'js_fallback'
                };
            }

            const c = COEFFS[supportName] || COEFFS['4辺固定'];
            const Mx_center = c.mcx * qTotal * (lx ** 2);
            const My_center = c.mcy * qTotal * (lx ** 2) * Math.min(1.0, 1.5 / (ly/lx || 1));
            const Mx_end = c.max * qTotal * (lx ** 2);
            const My_end = c.may * qTotal * (lx ** 2) * Math.min(1.0, 1.5 / (ly/lx || 1));

            const ratioShort = Math.max(Mx_center, Mx_end) / (Ma_short || 1);
            const ratioLong = Math.max(My_center, My_end) / (Ma_long || 1);

            return {
                Mx_center, Mx_end, My_center, My_end,
                Ma_short, Ma_long,
                ratioShort, ratioLong,
                isNG: ratioShort > 1.0 || ratioLong > 1.0,
                engine: 'js_fallback'
            };
        }
    };

    if (typeof window !== 'undefined') {
        window.WasmBridge = WasmBridge;
    }
    if (typeof global !== 'undefined') {
        global.WasmBridge = WasmBridge;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = WasmBridge;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
