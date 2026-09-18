/**
 * WasmBridge.js
 * WebAssembly (Wasm) による計算コア知的財産（IP）保護＆ドメインロック・ブリッジ
 * 
 * - ブラウザ環境: assets/wasm/wall_calculator.wasm をロードし、バイナリ内で保護された高速計算を実行
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

    const WasmBridge = {
        isLoaded: false,
        isLoading: false,
        wasmInstance: null,
        domainHash: 0,
        loadError: null,

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

        /**
         * 必要壁量算定（Wasmバイナリコア優先 ＆ JSフォールバック）
         * @param {Object} params
         * @returns {Object} { cq1, cq2, q1_cm, q2_cm, details }
         */
        calculateRequiredWall: function(params) {
            params = params || {};

            // Wasmが利用可能な場合
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

                    // 屋根材
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

                    // 外壁材
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

                    // 用途
                    const buildingUseType = (params.buildingUse === 'office' || params.buildingUse === 'non_residential') ? 1 : 0;

                    // 基準・耐震等級
                    let standardType = 0; // kijun
                    if (params.standard === 'grade1') standardType = 1;
                    else if (params.standard === 'grade2') standardType = 2;
                    else if (params.standard === 'grade3') standardType = 3;

                    // 積雪
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
                        return {
                            cq1: 0,
                            cq2: 0,
                            q1_cm: 0,
                            q2_cm: 0,
                            engine: 'wasm_locked',
                            error: 'Unauthorized Domain Lock'
                        };
                    }
                } catch (e) {
                    console.warn('[WasmBridge] Error during Wasm calculation, falling back to JS:', e);
                }
            }

            // フォールバック: 既存JS計算エンジンを呼び出し
            if (global.RequiredWallCalculator && global.RequiredWallCalculator._calculateJS) {
                const jsResult = global.RequiredWallCalculator._calculateJS(params);
                jsResult.engine = 'js_fallback';
                return jsResult;
            }

            return { cq1: 0.29, cq2: 0.15, q1_cm: 29, q2_cm: 15, engine: 'fallback_default' };
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
