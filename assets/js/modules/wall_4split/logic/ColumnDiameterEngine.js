/**
 * ColumnDiameterEngine.js
 * 令和7年（2025年）施行 改正建築基準法対応
 * 公益財団法人 日本住宅・木材技術センター「設計支援ツール」および確認申請・審査マニュアル完全準拠
 * 
 * 柱の小径算定（表2-1, 表2-2, 表2-3）および各階の最大負担面積による適否判定エンジン
 */

(function(global) {
    'use strict';

    const ColumnDiameterEngine = {
        /**
         * 基準強度定数 (N/mm2)
         */
        FC: {
            SUGI_MUTOOKYU: 17.7,    // すぎ・無等級材（表2-1標準）
            HINOKI_MUTOOKYU: 20.1,  // ひのき・無等級材（表2-2標準例）
            GLULAM_E105_F300: 22.2  // 集成材例
        },

        /**
         * 各階の横架材間距離 l (mm) を算出
         * マニュアル規定:
         * 2階建ての1階: 階高 - 梁せい 120mm
         * 2階建ての2階および平屋: 階高 - 梁せい 105mm
         */
        getClearSpan: function(floor, state) {
            const s = state || global.AppState || {};
            const config = s.config || {};
            const is2Story = !config.isFlat;
            const h = (floor === '1F') ? (config.height1F || 2.7) : (config.height2F || 2.7);
            const h_mm = h * 1000;
            const beamDepth = (floor === '1F' && is2Story) ? 120 : 105;
            return Math.max(1000, h_mm - beamDepth);
        },

        /**
         * 各階の床面積当たり外周部柱負担荷重 W_d (N/mm2) を算出
         */
        getUnitLoad: function(floor, state) {
            const s = state || global.AppState || {};
            // RequiredWallCalculator が存在する場合は高精度な荷重を取得
            if (global.RequiredWallCalculator && typeof global.RequiredWallCalculator._calculateJS === 'function') {
                try {
                    const c = s.config || {};
                    const calcRes = global.RequiredWallCalculator._calculateJS({
                        roofType: c.roofType || 'metal',
                        extWallType: c.extWallType || 'siding',
                        standard: c.calcStandard || 'kijun',
                        isSolar: c.solarPower || false,
                        buildingUse: c.buildingUse || 'residential',
                        h1: c.height1F || 2.7,
                        h2: c.height2F || 2.7,
                        roofHeight: c.roofHeight || 1.8,
                        area1F: s.area1F || 50,
                        area2F: (c.isFlat ? 0 : (s.area2F || 50))
                    });
                    if (calcRes && calcRes.details) {
                        const d = calcRes.details;
                        // Z41, Z42 は kN/m2 なので 10^-3 で N/mm2 に換算
                        if (floor === '2F' && d.Z41) return d.Z41 * 0.001;
                        if (floor === '1F' && d.Z42) return d.Z42 * 0.001;
                    }
                } catch (e) {
                    // fallback below
                }
            }
            // 標準的な住宅モデルのフォールバック値 (N/mm2)
            // 2F: 約 2.2 kN/m2 -> 0.0022 N/mm2
            // 1F: 約 4.5 kN/m2 -> 0.0045 N/mm2
            return (floor === '2F') ? 0.0022 : 0.0045;
        },

        /**
         * 柱の有効細長比による必要小径 d_se (mm)
         * d_se = (sqrt(12) / 150) * l
         */
        calcDse: function(l) {
            return (Math.sqrt(12) / 150) * l;
        },

        /**
         * 柱の座屈検討による必要小径 d_be (mm)
         * @param {number} Wd - 単位面積当たり荷重 (N/mm2)
         * @param {number} Ae - 負担面積 (mm2)
         * @param {number} l  - 横架材間距離 (mm)
         * @param {number} Fc - 圧縮基準強度 (N/mm2)
         */
        calcDbe: function(Wd, Ae, l, Fc) {
            const P = (1.1 / 3.0) * Fc;
            const term = Math.sqrt((Wd * Ae) / P);

            const bound1 = l / 8.66;
            const bound2 = l / 52.70;

            if (term >= bound1) {
                return term;
            } else if (term >= bound2) {
                const l_75 = l / 75.05;
                return l_75 + Math.sqrt(Math.pow(l_75, 2) + (1.0 / 1.3) * ((Wd * Ae) / P));
            } else {
                return Math.pow((12 * Math.pow(l, 2) / 3000) * ((Wd * Ae) / P), 0.25);
            }
        },

        /**
         * 柱の小径別に柱の負担可能面積 A_a (m2) を算出（表2-3の計算式）
         * @param {number} db - 柱の座屈方向の材せい (mm) (例: 105 または 120)
         * @param {number} l  - 横架材間距離 (mm)
         * @param {number} w0 - 柱の床面積当たり負担荷重 (N/mm2)
         * @param {number} Fc - 圧縮基準強度 (N/mm2)
         */
        calcAllowableArea: function(db, l, w0, Fc) {
            const P = (1.1 / 3.0) * Fc;
            const Ace = Math.pow(db, 2); // 正角柱の断面積 (mm2)
            const slenderness = (3.464 * l) / db;

            let Aa_mm2 = 0;
            if (slenderness <= 30) {
                Aa_mm2 = (P * Ace) / w0;
            } else if (slenderness <= 100) {
                const factor = 1.3 - (0.03464 * l) / db;
                Aa_mm2 = (P * factor * Ace) / w0;
            } else {
                const factor = (3000 * Math.pow(db, 2)) / Math.pow(3.464 * l, 2);
                Aa_mm2 = (P * factor * Ace) / w0;
            }

            // mm2 から m2 に換算
            return Math.max(0, Aa_mm2 / 1000000);
        },

        /**
         * 各階の柱データから最大負担面積 A_max (m2) を抽出
         */
        getMaxLoadArea: function(floor, state) {
            const s = state || global.AppState || {};
            const pillars = s.pillars || [];
            const floorPillars = pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === floor);
            if (floorPillars.length === 0) return 0;
            const areas = floorPillars.map(p => (p.usedArea != null ? parseFloat(p.usedArea) : (p.loadArea || 0)));
            return Math.round(Math.max(0, ...areas) * 100) / 100;
        },

        /**
         * 各階ごとの柱の小径算定（表2-1, 2-2, 2-3）の適否判定を実行
         */
        evaluateFloor: function(floor, state) {
            const s = state || global.AppState || {};
            const config = s.config || {};
            const l = this.getClearSpan(floor, s);
            const Wd = this.getUnitLoad(floor, s);
            const maxArea = this.getMaxLoadArea(floor, s);

            // 柱小径（設定値またはデフォルト105mm）
            const d_config = (floor === '1F') ? (config.pillarDepth1F || 105) : (config.pillarDepth2F || 105);
            const currentD = parseFloat(d_config) || 105;

            // --- 表2-1: すぎ無等級材・負担面積5.0㎡仮定 ---
            const Ae_standard = 5.0 * 1000000; // 5.0 m2 -> mm2
            const Fc_2_1 = this.FC.SUGI_MUTOOKYU;
            const dbe_2_1 = this.calcDbe(Wd, Ae_standard, l, Fc_2_1);
            const dse_2_1 = this.calcDse(l);
            const de_2_1 = Math.ceil(Math.max(dbe_2_1, dse_2_1));
            // 前提条件: 実際の最大負担面積が 5.0㎡ 以下かつ柱小径が必要小径以上
            const ok_2_1 = (maxArea <= 5.0 && currentD >= de_2_1);

            // --- 表2-2: 樹種指定（ひのき等）・負担面積5.0㎡仮定 ---
            const Fc_2_2 = this.FC.HINOKI_MUTOOKYU;
            const dbe_2_2 = this.calcDbe(Wd, Ae_standard, l, Fc_2_2);
            const dse_2_2 = dse_2_1;
            const de_2_2 = Math.ceil(Math.max(dbe_2_2, dse_2_2));
            const ok_2_2 = (maxArea <= 5.0 && currentD >= de_2_2);

            // --- 表2-3: 柱の小径別 負担可能面積 Aa による判定 ---
            const Aa_105 = Math.round(this.calcAllowableArea(105, l, Wd, Fc_2_1) * 100) / 100;
            const Aa_120 = Math.round(this.calcAllowableArea(120, l, Wd, Fc_2_1) * 100) / 100;
            const Aa_current = Math.round(this.calcAllowableArea(currentD, l, Wd, Fc_2_1) * 100) / 100;
            // 実際の最大負担面積が負担可能面積以下であればOK
            const ok_2_3 = (maxArea <= Aa_current && (Math.sqrt(12) * l / currentD) <= 150);

            // --- 適用される算出方法の判定 ---
            let adoptedMethod = '';
            let isOverallOk = false;

            if (ok_2_1) {
                adoptedMethod = '方法2-1（標準・すぎ無等級）適用可能';
                isOverallOk = true;
            } else if (ok_2_2) {
                adoptedMethod = '方法2-2（樹種・等級指定）適用';
                isOverallOk = true;
            } else if (ok_2_3) {
                adoptedMethod = `方法2-3（負担可能面積照査 Aa=${Aa_current}㎡）適用`;
                isOverallOk = true;
            } else {
                adoptedMethod = (currentD < 120 && maxArea <= Aa_120)
                    ? '要検討（120角への小径拡大で方法2-3適合可能）'
                    : '要検討（柱の増設または断面拡大が必要です）';
                isOverallOk = false;
            }

            return {
                floor,
                clearSpan: l,
                unitLoad: Wd,
                maxArea,
                currentD,
                table2_1: {
                    name: '表2-1（算定式・無等級すぎ）',
                    condition: '負担面積≦5.0㎡',
                    requiredD: de_2_1,
                    isOk: ok_2_1
                },
                table2_2: {
                    name: '表2-2（樹種指定・ひのき等）',
                    condition: '負担面積≦5.0㎡',
                    requiredD: de_2_2,
                    isOk: ok_2_2
                },
                table2_3: {
                    name: '表2-3（負担可能面積照査）',
                    condition: `最大負担面積≦Aa(${Aa_current}㎡)`,
                    allowableArea: Aa_current,
                    allowableArea105: Aa_105,
                    allowableArea120: Aa_120,
                    isOk: ok_2_3
                },
                adoptedMethod,
                isOverallOk
            };
        },

        /**
         * HTML形式の適否判定サマリーテーブルを生成
         */
        generateHtmlSummary: function(floor, state, isForPdf = false) {
            const res = this.evaluateFloor(floor, state);
            const badge = (ok) => ok 
                ? '<span style="color:#27ae60;font-weight:bold;background:#e8f8f5;padding:2px 6px;border-radius:3px;border:1px solid #a3e4d7;">OK (適)</span>'
                : '<span style="color:#c0392b;font-weight:bold;background:#fdedec;padding:2px 6px;border-radius:3px;border:1px solid #f5b7b1;">NG (否)</span>';

            const summaryColor = res.isOverallOk ? '#27ae60' : '#d35400';
            const bgBox = isForPdf ? '#fdfefe' : 'rgba(255,255,255,0.03)';
            const borderColor = isForPdf ? '#bdc3c7' : 'rgba(255,255,255,0.15)';

            return `
            <div class="column-diameter-check-box" style="margin-top:12px; margin-bottom:18px; padding:12px 14px; background:${bgBox}; border:1px solid ${borderColor}; border-radius:6px; font-size:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid ${borderColor}; padding-bottom:6px;">
                    <div style="font-weight:bold; color:#0056b3;">
                        📐 【${floor}】柱の小径算定方法の適否判定（ボロノイ最大負担面積照査）
                    </div>
                    <div>
                        最大負担面積: <strong style="color:#e67e22; font-size:13px;">${res.maxArea.toFixed(2)} ㎡</strong>
                        （採用小径: <strong>${res.currentD} mm</strong>）
                    </div>
                </div>
                <table class="report-table" style="width:100%; margin-bottom:8px; font-size:11.5px; border-collapse:collapse;">
                    <thead>
                        <tr style="background:${isForPdf ? '#f2f4f4' : 'rgba(255,255,255,0.06)'};">
                            <th style="padding:5px; text-align:left;">算定手法（早見表区分）</th>
                            <th style="padding:5px; text-align:center;">適用前提条件</th>
                            <th style="padding:5px; text-align:center;">必要小径 / 負担可能限度</th>
                            <th style="padding:5px; text-align:center; width:90px;">適否判定</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding:5px; font-weight:bold;">表 2-1（標準・無等級すぎ）</td>
                            <td style="padding:5px; text-align:center;">負担面積 ≦ 5.0 ㎡</td>
                            <td style="padding:5px; text-align:center;">必要小径: ${res.table2_1.requiredD} mm</td>
                            <td style="padding:5px; text-align:center;">${badge(res.table2_1.isOk)}</td>
                        </tr>
                        <tr>
                            <td style="padding:5px; font-weight:bold;">表 2-2（樹種・等級指定）</td>
                            <td style="padding:5px; text-align:center;">負担面積 ≦ 5.0 ㎡</td>
                            <td style="padding:5px; text-align:center;">必要小径: ${res.table2_2.requiredD} mm</td>
                            <td style="padding:5px; text-align:center;">${badge(res.table2_2.isOk)}</td>
                        </tr>
                        <tr>
                            <td style="padding:5px; font-weight:bold;">表 2-3（負担可能面積照査）</td>
                            <td style="padding:5px; text-align:center;">最大負担面積 ≦ Aa</td>
                            <td style="padding:5px; text-align:center;">負担可能面積 Aa: <strong>${res.table2_3.allowableArea} ㎡</strong> (120角: ${res.table2_3.allowableArea120}㎡)</td>
                            <td style="padding:5px; text-align:center;">${badge(res.table2_3.isOk)}</td>
                        </tr>
                    </tbody>
                </table>
                <div style="font-size:11.5px; background:${isForPdf ? '#fbfcfc' : 'rgba(255,255,255,0.04)'}; padding:6px 10px; border-radius:4px; border-left:3px solid ${summaryColor};">
                    <strong>【適用される算出方法】:</strong> 
                    <span style="font-weight:bold; color:${summaryColor}; margin-left:6px;">${res.adoptedMethod}</span>
                    <span style="color:#7f8c8d; margin-left:8px; font-size:10.5px;">（※横架材間距離 l = ${res.clearSpan} mm, 単位荷重 Wd = ${(res.unitLoad * 1000).toFixed(2)} kN/㎡）</span>
                </div>
            </div>
            `;
        }
    };

    global.ColumnDiameterEngine = ColumnDiameterEngine;

})(typeof window !== 'undefined' ? window : global);
