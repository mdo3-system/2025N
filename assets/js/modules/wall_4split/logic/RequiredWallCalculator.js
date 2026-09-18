/**
 * RequiredWallCalculator.js
 * 公益財団法人 日本住宅・木材技術センター配布
 * 「壁量等の基準（令和7年施行）に対応した表計算ツール（多機能版 ver1.2.1）」完全準拠
 * 
 * 建物荷重仕様（屋根・外壁・太陽光・断熱材・階高・床面積・用途・耐震等級）から
 * 1階・2階の単位必要壁量 cq1, cq2 (m/㎡) を高精度に自動算定し、アプリへ自動転記するエンジン。
 */

(function(global) {
    'use strict';

    const RequiredWallCalculator = {
        /**
         * 各種荷重マスター定数
         */
        CONSTANTS: {
            // 屋根材単重 (N/㎡)
            ROOF_WEIGHTS: {
                metal: 500,     // 金属板ぶき (ガルバリウム鋼板等)
                slate: 740,     // スレートぶき (コロニアル等)
                tile: 990       // 瓦屋根 (ふき土無)
            },
            // 太陽光発電設備 (N/㎡)
            SOLAR_WEIGHT: 200,

            // 天井断熱材 (N/㎡) - 標準初期値
            CEILING_INSULATION_DEFAULT: 100,

            // 外壁材単重 (N/㎡)
            EXTERIOR_WALL_WEIGHTS: {
                soil: 1000,       // 土塗り壁等
                mortar: 890,      // モルタル等
                siding: 600,      // サイディング
                metal_sheet: 500, // 金属板張
                wood_board: 350   // 下見板張
            },

            // 壁断熱材 (N/㎡) - 標準初期値
            WALL_INSULATION_DEFAULT: 70,

            // 開口部荷重 (N/㎡)
            OPENING_WEIGHT: 400,
            OPENING_RATIO: 0.09, // 9%

            // 内壁 (せっこうボード)
            INTERIOR_WALL_BASE: 200, // 階高2.8mあたり 200 N/㎡

            // 床固定荷重 (N/㎡)
            FLOOR_DEAD_LOAD: 610,

            // 積載荷重 (地震力算定用 N/㎡)
            LIVE_LOAD: {
                residential: 600, // 住宅・共同住宅
                office: 800       // 事務所・店舗・非住宅
            },

            // 耐力壁せん断耐力換算係数
            WALL_STRENGTH_COEFF: 0.0196 // kN/cm (1.96 kN/m)
        },

        /**
         * 表計算ツール ver1.2.1 完全準拠の単位必要壁量算定
         * @param {Object} params
         * @returns {Object} { cq1, cq2, q1_cm, q2_cm, details }
         */
        calculate: function(params) {
            params = params || {};

            // 1. 階高 (m)
            const h1 = Math.max(1.0, parseFloat(params.floorHeight1F) || 2.70);
            const h2 = Math.max(1.0, parseFloat(params.floorHeight2F) || 2.70);
            
            // 2. 屋根高さ (m) & 軒の出 (m) & 屋根勾配 (寸)
            const roofHeight = Math.max(0.5, parseFloat(params.roofHeight) || 1.71);
            const overhang = Math.max(0, parseFloat(params.overhang) || 0.75);
            const roofSlope = Math.max(0.5, parseFloat(params.roofSlope) || 4.0);

            // 3. 床面積 (㎡)
            const area1F = Math.max(0, parseFloat(params.floorArea1F) || 0);
            const area2F = Math.max(0, parseFloat(params.floorArea2F) || 0);
            const is2Story = (area2F > 0);

            // 4. 用途・耐震等級・基準
            const buildingUse = params.buildingUse || 'residential'; // 'residential' | 'office' | 'non_residential'
            const standard = params.standard || 'kijun'; // 'kijun' | 'grade1' | 'grade2' | 'grade3'
            const C0 = parseFloat(params.C0) || 0.2;
            const Z = parseFloat(params.Z) || 1.0;

            // 5. 屋根割増係数 Z2 (勾配・軒出補正)
            const k_slope = Math.sqrt(Math.pow(roofSlope, 2) + Math.pow(10, 2)) / 10;
            const Z2 = ((16.5 + overhang * 2) * (6.0 + overhang * 2) * k_slope) / (16.5 * 6.0);

            // 6. 屋根材仕様
            let rawRoofWeight = 500;
            if (typeof params.roofType === 'number') {
                rawRoofWeight = params.roofType;
            } else if (params.roofType === 'slate') {
                rawRoofWeight = this.CONSTANTS.ROOF_WEIGHTS.slate;
            } else if (params.roofType === 'tile') {
                rawRoofWeight = this.CONSTANTS.ROOF_WEIGHTS.tile;
            } else if (params.roofType === 'metal') {
                rawRoofWeight = this.CONSTANTS.ROOF_WEIGHTS.metal;
            } else if (typeof params.roofWeight === 'number') {
                rawRoofWeight = params.roofWeight;
            }
            const roofWeightPerArea = rawRoofWeight * Z2;

            // 7. 太陽光発電
            const hasSolar = !!params.hasSolar || (parseFloat(params.solarWeight) > 0);
            const solarWeightPerArea = hasSolar ? (this.CONSTANTS.SOLAR_WEIGHT * Z2) : 0;

            // 8. 天井断熱材
            const ceilingIns = (params.ceilingIns !== undefined && params.ceilingIns !== null) ?
                parseFloat(params.ceilingIns) : this.CONSTANTS.CEILING_INSULATION_DEFAULT;

            // 9. 積雪荷重 (多雪区域指定時)
            let snowWeightPerArea = 0;
            if (params.isSnowArea) {
                const snowDepth = parseFloat(params.snowDepth) || 0; // cm
                const snowUnitLoad = parseFloat(params.snowUnitLoad) || 20; // N/㎡/cm
                if (snowDepth > 0 && snowUnitLoad > 0) {
                    snowWeightPerArea = (snowDepth * snowUnitLoad * 0.35 * Z2) / k_slope;
                }
            }

            // 屋根トータル荷重 (N/㎡)
            const totalRoofLoadPerArea = roofWeightPerArea + solarWeightPerArea + ceilingIns + snowWeightPerArea;

            // 10. 外壁仕様
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

            // 外壁壁面積比率 (モデル建物 16.5m × 6.0m = 99㎡)
            const wallRatio1F = (6.0 * h1 * 2 + 16.5 * h1 * 2) / (6.0 * 16.5);
            const wallRatio2F = (6.0 * h2 * 2 + 16.5 * h2 * 2) / (6.0 * 16.5);

            // 各階の外壁・断熱・開口・内壁荷重
            const w_ext1 = Math.ceil((rawExtWallWeight * wallRatio1F * (1.0 - this.CONSTANTS.OPENING_RATIO)) / 10) * 10;
            const w_ext2 = Math.ceil((rawExtWallWeight * wallRatio2F * (1.0 - this.CONSTANTS.OPENING_RATIO)) / 10) * 10;

            const w_open1 = Math.ceil((this.CONSTANTS.OPENING_WEIGHT * wallRatio1F * this.CONSTANTS.OPENING_RATIO) / 10) * 10;
            const w_open2 = Math.ceil((this.CONSTANTS.OPENING_WEIGHT * wallRatio2F * this.CONSTANTS.OPENING_RATIO) / 10) * 10;

            const wallInsDefault = (params.wallIns !== undefined && params.wallIns !== null) ?
                parseFloat(params.wallIns) : this.CONSTANTS.WALL_INSULATION_DEFAULT;
            const w_ins1 = Math.ceil((wallInsDefault * wallRatio1F * (1.0 - this.CONSTANTS.OPENING_RATIO)) / 10) * 10;
            const w_ins2 = Math.ceil((wallInsDefault * wallRatio2F * (1.0 - this.CONSTANTS.OPENING_RATIO)) / 10) * 10;

            const w_int1 = this.CONSTANTS.INTERIOR_WALL_BASE * (h1 / 2.8);
            const w_int2 = this.CONSTANTS.INTERIOR_WALL_BASE * (h2 / 2.8);

            const wallLoad1F = (w_ext1 + w_int1 + w_ins1 + w_open1) / 1000.0; // kN/㎡
            const wallLoad2F = (w_ext2 + w_int2 + w_ins2 + w_open2) / 1000.0; // kN/㎡

            // 11. 床荷重
            const liveLoad = (buildingUse === 'office' || buildingUse === 'non_residential') ?
                this.CONSTANTS.LIVE_LOAD.office : this.CONSTANTS.LIVE_LOAD.residential;
            const floorLoadTotal = (this.CONSTANTS.FLOOR_DEAD_LOAD + liveLoad) / 1000.0; // kN/㎡

            let q1_cm = 0;
            let q2_cm = 0;

            if (is2Story && area1F > 0) {
                // === 2階建て計算 ===
                const R_area = area2F / area1F;

                const W_rf2 = (totalRoofLoadPerArea * R_area) / 1000.0; // kN/㎡
                const W_rf1 = (R_area < 1.0) ? ((1.0 - R_area) * totalRoofLoadPerArea) / 1000.0 : 0.0; // kN/㎡

                const W_wall2 = wallLoad2F * R_area; // kN/㎡
                const W_wall1 = wallLoad1F;          // kN/㎡
                const W_floor = floorLoadTotal * R_area; // kN/㎡

                // 2階が支える部分の荷重 Z41 (kN/㎡)
                const Z41 = W_rf2 + 0.5 * W_wall2;
                // 1階が支える部分の荷重 Z42 (kN/㎡)
                const Z42 = W_rf2 + W_wall2 + W_floor + 0.5 * W_wall1 + W_rf1;

                // 算定用建築物の高さ Heff
                const Heff = (roofHeight / 2.0) + h1 + h2 + 0.5;
                const beta = (2.0 * 0.03 * Heff) / (1.0 + 3.0 * 0.03 * Heff);

                // 層せん断力分布係数 Ai
                const alpha1 = 1.0;
                const Ai1 = 1.0;

                const alpha2 = Math.max(0.001, Z41 / Z42);
                const Ai2 = 1.0 + (1.0 / Math.sqrt(alpha2) - alpha2) * beta;

                // 基準法単位必要壁量 (cm/㎡)
                const q1_base = Math.ceil(((Ai1 * C0 * Z) / this.CONSTANTS.WALL_STRENGTH_COEFF) * Z42);
                const q2_base = Math.ceil((((Ai2 * C0 * Z) / this.CONSTANTS.WALL_STRENGTH_COEFF) * Z41) / R_area);

                // 耐震等級倍率
                let gradeMultiplier = 1.0;
                if (standard === 'grade2') {
                    gradeMultiplier = 1.25;
                } else if (standard === 'grade3') {
                    gradeMultiplier = 1.50;
                }

                q1_cm = Math.ceil(q1_base * gradeMultiplier);
                q2_cm = Math.ceil(q2_base * gradeMultiplier);

            } else if (area1F > 0) {
                // === 平屋建て計算 ===
                const W_rf = totalRoofLoadPerArea / 1000.0;
                const W_wall = wallLoad1F;
                const Z37 = W_rf + 0.5 * W_wall;

                const Heff = (roofHeight / 2.0) + h1 + 0.5;
                const q1_base = Math.ceil(((C0 * Z) / this.CONSTANTS.WALL_STRENGTH_COEFF) * Z37);

                let gradeMultiplier = 1.0;
                if (standard === 'grade2') {
                    gradeMultiplier = 1.25;
                } else if (standard === 'grade3') {
                    gradeMultiplier = 1.50;
                }

                q1_cm = Math.ceil(q1_base * gradeMultiplier);
                q2_cm = 0;
            } else {
                // 床面積未設定時のデフォルトフォールバック
                q1_cm = 29;
                q2_cm = 15;
            }

            // m/㎡ への換算（cm/㎡ を 100 で除算）
            const cq1 = Math.round((q1_cm / 100.0) * 1000) / 1000;
            const cq2 = Math.round((q2_cm / 100.0) * 1000) / 1000;

            return {
                cq1: cq1, // m/㎡ (例: 0.40)
                cq2: cq2, // m/㎡ (例: 0.28)
                q1_cm: q1_cm, // cm/㎡ (例: 40)
                q2_cm: q2_cm, // cm/㎡ (例: 28)
                details: {
                    buildingUse: buildingUse,
                    standard: standard,
                    is2Story: is2Story,
                    totalRoofLoadPerArea: totalRoofLoadPerArea,
                    wallLoad1F: wallLoad1F,
                    wallLoad2F: wallLoad2F,
                    Z2: Z2
                }
            };
        },

        /**
         * DOMおよびAppStateから自動同期して c-q1, c-q2 を更新する
         * @param {Object} appState Optional window.AppState
         * @returns {Object|null}
         */
        syncAndCalculateFromUI: function(appState) {
            const state = appState || (typeof window !== 'undefined' ? window.AppState : null);
            if (!state || typeof document === 'undefined') return null;

            // 自動算定トグルがOFFの場合はスキップ
            const toggleEl = document.getElementById('auto-calc-wall-coeff');
            if (toggleEl && !toggleEl.checked) return null;

            const getNum = (id, def = 0) => {
                const el = document.getElementById(id);
                return el ? (parseFloat(el.value) || def) : def;
            };
            const getVal = (id, def = '') => {
                const el = document.getElementById(id);
                return el ? el.value : def;
            };

            // 屋根仕様
            const roofVal = getNum('left-prop-roof-type', getNum('prop-roof-type', 500));
            // 太陽光
            const solarVal = getNum('left-prop-solar', getNum('prop-solar', 0));
            // 外壁仕様
            const extWallVal = getNum('left-prop-ext-wall', getNum('prop-ext-wall', 600));
            // 断熱
            const ceilingIns = getNum('left-prop-ceiling-ins', getNum('prop-ceiling-ins', 100));
            const wallIns = getNum('left-prop-wall-ins', getNum('prop-wall-ins', 70));

            // 階高
            const h1 = getNum('n-h1', 2.70);
            const h2 = getNum('n-h2', 2.70);

            // 床面積 (AppState または DOM)
            let a1 = getNum('a-f1', 0);
            let a2 = getNum('a-f2', 0);
            if (state.config && state.config.floorAreas) {
                if (a1 === 0 && state.config.floorAreas['1F']) a1 = state.config.floorAreas['1F'];
                if (a2 === 0 && state.config.floorAreas['2F']) a2 = state.config.floorAreas['2F'];
            }

            // 建築用途 (住宅 / 事務所・非住宅)
            const buildingUse = getVal('calc-building-use', 'residential');

            // 耐震等級・基準 (基準法・等級1 / 等級2 / 等級3)
            let standard = getVal('calc-seismic-grade', 'kijun');
            if (!standard || standard === '') {
                const modeSelect = getVal('calc-mode-select', 'kijun');
                standard = (modeSelect === 'seinou') ? 'grade1' : 'kijun';
            }

            // 屋根高さ・勾配・軒の出 (RoofEngine 等)
            let roofHeight = 1.71;
            let roofSlope = 4.0;
            let overhang = 0.75;
            if (state.roofs && state.roofs.length > 0) {
                const firstRoof = state.roofs[0];
                if (firstRoof && firstRoof.slope) roofSlope = parseFloat(firstRoof.slope) || 4.0;
            }

            const calcResult = this.calculate({
                floorHeight1F: h1,
                floorHeight2F: h2,
                roofHeight: roofHeight,
                overhang: overhang,
                roofSlope: roofSlope,
                floorArea1F: a1,
                floorArea2F: a2,
                roofType: roofVal,
                extWallType: extWallVal,
                hasSolar: solarVal > 0,
                ceilingIns: ceilingIns,
                wallIns: wallIns,
                buildingUse: buildingUse,
                standard: standard
            });

            // DOMスロット (c-q1, c-q2) へ自動転記
            const cq1El = document.getElementById('c-q1');
            const cq2El = document.getElementById('c-q2');
            if (cq1El) cq1El.value = calcResult.cq1.toFixed(2);
            if (cq2El) cq2El.value = calcResult.cq2.toFixed(2);

            // AppState への同期
            if (state.config && state.config.reqWallCoeffs) {
                if (state.config.reqWallCoeffs['1F']) state.config.reqWallCoeffs['1F'].seismic = calcResult.cq1;
                if (state.config.reqWallCoeffs['2F']) state.config.reqWallCoeffs['2F'].seismic = calcResult.cq2;
            }

            // バッジ表示の更新
            const badgeEl = document.getElementById('auto-calc-badge');
            if (badgeEl) {
                badgeEl.textContent = `⚡ 表計算ver1.2.1連動: 1F=${calcResult.q1_cm}cm/㎡, 2F=${calcResult.q2_cm}cm/㎡`;
                badgeEl.style.display = 'inline-block';
            }

            return calcResult;
        }
    };

    if (typeof window !== 'undefined') {
        window.RequiredWallCalculator = RequiredWallCalculator;
    }
    if (typeof global !== 'undefined') {
        global.RequiredWallCalculator = RequiredWallCalculator;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = RequiredWallCalculator;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
