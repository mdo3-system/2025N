/**
 * view/FoundationRenderer.js - Single Source of Truth for Foundation HTML/SVG Rendering
 * Centralized rendering engine for foundation beams, slabs, and stress diagrams.
 */

window.FoundationRenderer = {
    /**
     * Format helper for numeric values
     */
    fmt: function(val, digits = 2) {
        if (typeof val !== 'number' || !isFinite(val)) return '-';
        return val.toFixed(digits);
    },

    /**
     * Format helper for ratio check status
     */
    fmtRatio: function(r) {
        if (!isFinite(r)) return '-';
        const ok = r <= 1.0;
        return `<span style="color:${ok ? '#27ae60' : '#e74c3c'}; font-weight:bold;">${(r * 100).toFixed(1)}% ${ok ? 'OK' : 'NG'}</span>`;
    },

    /**
     * Generate complete Foundation Beam Report HTML (Used in both property modal and print report)
     * @param {Object} beam - Foundation beam object with fdStress
     * @param {Object} options - Optional rendering flags (e.g. isPrintModal, showInputs)
     */
    generateBeamReportHtml: function(beam, options = {}) {
        if (!beam || !beam.fdStress || !beam.fdStress.pillars || beam.fdStress.pillars.length === 0) {
            return '<div style="padding:15px; color:#7f8c8d; background:#f8f9fa; border:1px dashed #ccc; border-radius:6px; font-family:sans-serif;">※ 基礎梁の計算データがありません。基礎モードで配置後、解析を実行してください。</div>';
        }

        const s = window.AppState;
        const bp = beam.props || {};
        const beamAxisName = window.GridEngine ? window.GridEngine.getLineAxisName(beam.p1, beam.p2, s) : '';

        const getFreshPillarName = (p) => {
            if (!p) return '支点';
            const px = p.globalX ?? (p.x * 1000) ?? 0;
            const py = p.globalY ?? (p.y * 1000) ?? 0;
            const gridName = window.getGridNameAt ? window.getGridNameAt(px, py) : null;
            const isDefault = !p.name || /^(P|M)_?(P|M)?\d+$/i.test(p.name) || p.name.toLowerCase().startsWith('pillar') || p.name === `P_${p.id}` || p.name === p.id || p.name.startsWith('支点') || (p.id && String(p.id).startsWith('support'));
            let rawName = isDefault ? (gridName || p.name || `P_${p.id}`) : p.name;
            
            if (beamAxisName && rawName.includes(beamAxisName)) {
                rawName = rawName.replace(beamAxisName, '').replace(/^[ -]+|[ -]+$/g, '');
            }
            return rawName || '支点';
        };

        const getFreshSpanName = (span) => {
            if (!span) return '柱間';
            const p1Name = getFreshPillarName(span.startNode);
            const p2Name = getFreshPillarName(span.endNode);
            return `${p1Name}-${p2Name}`;
        };

        let html = `<div class="foundation-beam-report" style="color:#2c3e50; font-family:'Hiragino Kaku Gothic ProN','Meiryo',sans-serif; padding:5px; box-sizing:border-box;">`;

        // 1. 基本プロパティヘッダー (オプションで入力制御可)
        if (options.showInputs) {
            html += `
            <div style="font-size:12px; font-weight:bold; color:#2c3e50; border-bottom:2px solid #8e44ad; margin-bottom:10px; padding-bottom:5px;">🏗️ 基礎梁 計算条件</div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; background:#fdfafa; padding:8px; border-radius:6px; margin-bottom:12px; border:1px solid #f1e5f5; font-size:11px;">
                <div>
                    <label style="font-weight:bold; color:#7d3c98; display:block; margin-bottom:2px;">配置通り芯</label>
                    <div style="background:#fff; border:1px solid #ddd; padding:4px; border-radius:4px; font-weight:bold; color:#2c3e50; text-align:center;">${beamAxisName ? beamAxisName + '通り' : '個別計算'}</div>
                </div>
                <div>
                    <label style="font-weight:bold; color:#7d3c98; display:block; margin-bottom:2px;">B (反曲点高比)</label>
                    <input type="number" step="0.05" min="0" max="1" value="${bp.B_val !== undefined ? bp.B_val : 0.5}" onchange="window.PropertyController.updateFdProp('beam', ${beam.id}, 'B_val', this.value)" style="width:100%; box-sizing:border-box; padding:4px; border:1px solid #ccc; border-radius:4px;">
                </div>
                <div>
                    <label style="font-weight:bold; color:#7d3c98; display:block; margin-bottom:2px;">モデル選択</label>
                    <select onchange="window.PropertyController.updateFdProp('beam', ${beam.id}, 'modelType', this.value)" style="width:100%; box-sizing:border-box; padding:4px; border:1px solid #ccc; border-radius:4px; background:#fff;">
                        <option value="both_ends" ${bp.modelType !== 'pillar_supported' ? 'selected' : ''}>両端支点（連続梁）</option>
                        <option value="pillar_supported" ${bp.modelType === 'pillar_supported' ? 'selected' : ''}>柱直下支点（連続梁）</option>
                    </select>
                </div>
            </div>`;
        }

        // 2. 応力分布図 (N・M・Q図)
        html += `<div style="font-size:12px; font-weight:bold; color:#2c3e50; border-left:4px solid #8e44ad; padding-left:8px; margin:15px 0 10px 0;">■ 基礎梁の断面と配筋の検定 (N・M・Q図)</div>`;
        html += this.generateBeamNMQSvg(beam);

        // 3. (1) 応力の算定 (水平荷重時) - 全節点の高精度テーブル
        html += `<div style="font-size:12px; font-weight:bold; color:#2c3e50; border-left:4px solid #34495e; padding-left:8px; margin:15px 0 6px 0;">① 節点応力 (水平時引抜力・反力・せん断・曲げ)</div>`;
        const B_val = bp.B_val !== undefined ? parseFloat(bp.B_val) : 0.5;
        const modelType = bp.modelType || 'both_ends';
        const dispB = (modelType === 'pillar_supported') ? 1.0 : B_val;

        let table1 = `<table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:15px; border:1px solid #bdc3c7;">
            <thead>
                <tr style="background:#34495e; color:#fff; border-bottom:1px solid #bdc3c7;">
                    <th rowspan="2" style="border:1px solid #bdc3c7; padding:4px; width:60px;">柱/節点</th>
                    <th rowspan="2" style="border:1px solid #bdc3c7; padding:4px; width:45px;">x(m)</th>
                    <th colspan="4" style="border:1px solid #bdc3c7; padding:4px; text-align:center; background:#ebf5fb; color:#1b4f72;">左加力 (B=${dispB.toFixed(3)})</th>
                    <th colspan="4" style="border:1px solid #bdc3c7; padding:4px; text-align:center; background:#fdf2e9; color:#7e5109;">右加力 (B=${dispB.toFixed(3)})</th>
                </tr>
                <tr style="background:#f2f4f4; color:#2c3e50; border-bottom:1px solid #bdc3c7;">
                    <th style="border:1px solid #bdc3c7; padding:3px;">Td(kN)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">R(kN)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">Qe(kN)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">Mf(kNm)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">Td(kN)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">R(kN)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">Qe(kN)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">Mf(kNm)</th>
                </tr>
            </thead>
            <tbody>`;

        const pillars = beam.fdStress.pillars;
        const seismic = beam.fdStress.seismic || { leftward: { Td:[], Qe:[], Mf:[] }, rightward: { Td:[], Qe:[], Mf:[] } };

        pillars.forEach((p, idx) => {
            const l_Td = (seismic.leftward.Td?.[idx] ?? 0).toFixed(3);
            const l_R_val = seismic.leftward.R ? (seismic.leftward.R[idx] ?? 0) : (idx === seismic.leftward.supportIdx1 ? (seismic.leftward.R_left ?? 0) : (idx === seismic.leftward.supportIdx2 ? (seismic.leftward.R_right ?? 0) : 0));
            const l_Qe = (seismic.leftward.Qe?.[idx] ?? 0).toFixed(3);
            const l_Mf = (seismic.leftward.Mf?.[idx] ?? 0).toFixed(3);

            const r_Td = (seismic.rightward.Td?.[idx] ?? 0).toFixed(3);
            const r_R_val = seismic.rightward.R ? (seismic.rightward.R[idx] ?? 0) : (idx === seismic.rightward.supportIdx1 ? (seismic.rightward.R_left ?? 0) : (idx === seismic.rightward.supportIdx2 ? (seismic.rightward.R_right ?? 0) : 0));
            const r_Qe = (seismic.rightward.Qe?.[idx] ?? 0).toFixed(3);
            const r_Mf = (seismic.rightward.Mf?.[idx] ?? 0).toFixed(3);

            table1 += `<tr>
                <td style="border:1px solid #bdc3c7; padding:4px; font-weight:bold; text-align:center;">${getFreshPillarName(p)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right;">${(p.x ?? 0).toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#e74c3c; background:#fef5f5;">${l_Td}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; background:#f4f6f7;">${l_R_val.toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#2980b9;">${l_Qe}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#27ae60;">${l_Mf}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#e74c3c; background:#fef5f5;">${r_Td}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; background:#fdfefe;">${r_R_val.toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#c0392b;">${r_Qe}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#d35400;">${r_Mf}</td>
            </tr>`;
        });
        table1 += `</tbody></table>`;
        html += table1;

        // 4. (2) 応力の算定 (長期)
        html += `<div style="font-size:12px; font-weight:bold; color:#2c3e50; border-left:4px solid #34495e; padding-left:8px; margin:15px 0 6px 0;">② 応力の算定 (長期)</div>`;
        let table2 = `<table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:15px; border:1px solid #bdc3c7; text-align:center;">
            <thead>
                <tr style="background:#34495e; color:#fff;">
                    <th style="border:1px solid #bdc3c7; padding:4px;">柱間 (スパン)</th>
                    <th style="border:1px solid #bdc3c7; padding:4px;">長さL(m)</th>
                    <th style="border:1px solid #bdc3c7; padding:4px;">σe (kN/㎡)</th>
                    <th style="border:1px solid #bdc3c7; padding:4px;">負担幅 B(m)</th>
                    <th style="border:1px solid #bdc3c7; padding:4px;">M中央(kNm)</th>
                    <th style="border:1px solid #bdc3c7; padding:4px;">M端部(kNm)</th>
                    <th style="border:1px solid #bdc3c7; padding:4px;">QL (kN)</th>
                </tr>
            </thead>
            <tbody>`;
        
        const spans = beam.fdStress.spans || [];
        spans.forEach(span => {
            const sigmaDisplay = span.isSyncFailed 
                ? `<div style="color:#c0392b; font-size:9px; font-weight:bold; line-height:1.2;">⚠️スラブ未同期</div>`
                : `${(span.sigma_e ?? 0).toFixed(3)}`;

            table2 += `<tr>
                <td style="border:1px solid #bdc3c7; padding:4px; font-weight:bold;">${getFreshSpanName(span)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right;">${(span.L ?? 0).toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:center;">${sigmaDisplay}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right;">${(span.B_trib ?? 0).toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#27ae60;">${(span.M_mid ?? 0).toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#2980b9;">${(span.M_end ?? 0).toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#7d3c98;">${(span.Q_L ?? 0).toFixed(3)}</td>
            </tr>`;
        });
        table2 += `</tbody></table>`;
        html += table2;

        // 5. (3) 応力の算定 (短期)
        html += `<div style="font-size:12px; font-weight:bold; color:#2c3e50; border-left:4px solid #34495e; padding-left:8px; margin:15px 0 6px 0;">③ 応力の算定 (短期組み合わせ)</div>`;
        let table3 = `<table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:15px; border:1px solid #bdc3c7; text-align:center;">
            <thead>
                <tr style="background:#34495e; color:#fff;">
                    <th rowspan="2" style="border:1px solid #bdc3c7; padding:4px;">柱間</th>
                    <th colspan="3" style="border:1px solid #bdc3c7; padding:4px; text-align:center; background:#ebf5fb; color:#1b4f72;">左加力 (QL + Qe)</th>
                    <th colspan="3" style="border:1px solid #bdc3c7; padding:4px; text-align:center; background:#fdf2e9; color:#7e5109;">右加力 (QL + Qe)</th>
                </tr>
                <tr style="background:#f2f4f4; color:#2c3e50; border-bottom:1px solid #bdc3c7;">
                    <th style="border:1px solid #bdc3c7; padding:3px;">M端(左)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">M端(右)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">QS (kN)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">M端(左)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">M端(右)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">QS (kN)</th>
                </tr>
            </thead>
            <tbody>`;
        
        spans.forEach(span => {
            table3 += `<tr>
                <td style="border:1px solid #bdc3c7; padding:4px; font-weight:bold;">${getFreshSpanName(span)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; color:#2980b9;">${(span.leftward?.M_left ?? 0).toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; color:#27ae60;">${(span.leftward?.M_right ?? 0).toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#7d3c98;">${(span.leftward?.Q ?? 0).toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; color:#c0392b;">${(span.rightward?.M_left ?? 0).toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; color:#e67e22;">${(span.rightward?.M_right ?? 0).toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#e74c3c;">${(span.rightward?.Q ?? 0).toFixed(3)}</td>
            </tr>`;
        });
        table3 += `</tbody></table>`;
        html += table3;

        // 6. (4) 判定表 (検定比)
        html += `<div style="font-size:12px; font-weight:bold; color:#2c3e50; border-left:4px solid #34495e; padding-left:8px; margin:15px 0 6px 0;">④ 断面判定 (検定比)</div>`;
        let table4 = `<table style="width:100%; border-collapse:collapse; font-size:10px; border:2px solid #34495e; text-align:center; background:#fff;">
            <thead>
                <tr style="background:#34495e; color:#fff;">
                    <th style="border:1px solid #bdc3c7; padding:6px;">スパン No.</th>
                    <th style="border:1px solid #bdc3c7; padding:6px;">曲げ (長期)</th>
                    <th style="border:1px solid #bdc3c7; padding:6px;">せん断 (長期)</th>
                    <th style="border:1px solid #bdc3c7; padding:6px;">曲げ (短期)</th>
                    <th style="border:1px solid #bdc3c7; padding:6px;">せん断 (短期)</th>
                    <th style="border:1px solid #bdc3c7; padding:6px;">判定</th>
                </tr>
            </thead>
            <tbody>`;
        
        spans.forEach((span, i) => {
            table4 += `
            <tr style="${span.isNG ? 'background:#fef5f5;' : ''}">
                <td style="border:1px solid #bdc3c7; padding:6px; font-weight:bold;">${getFreshSpanName(span)}</td>
                <td style="border:1px solid #bdc3c7; padding:6px;">${this.fmtRatio(span.ratioM_L)}</td>
                <td style="border:1px solid #bdc3c7; padding:6px;">${this.fmtRatio(span.ratioQ_L)}</td>
                <td style="border:1px solid #bdc3c7; padding:6px;">${this.fmtRatio(span.ratioM_S)}</td>
                <td style="border:1px solid #bdc3c7; padding:6px;">${this.fmtRatio(span.ratioQ_S)}</td>
                <td style="border:1px solid #bdc3c7; padding:6px;">
                    <span style="background:${span.isNG ? '#e74c3c' : '#27ae60'}; color:#fff; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:bold;">
                        ${span.isNG ? 'NG' : 'OK'}
                    </span>
                </td>
            </tr>`;
        });
        table4 += `</tbody></table>`;
        html += table4;

        html += `</div>`;
        return html;
    },

    /**
     * Centralized SVG renderer for Foundation Beam N-M-Q diagrams
     */
    generateBeamNMQSvg: function(beam) {
        if (!beam || !beam.spans || beam.spans.length === 0) return '';
        
        const totalL_mm = beam.spans.reduce((sum, s) => sum + (s.spanLength || (s.L * 1000) || 0), 0);
        const totalL_m = totalL_mm / 1000;
        if (totalL_m <= 0) return '';
        
        const w = 840;
        const hSection = 140;
        const pad = 50;
        const hTotal = hSection * 3 + pad * 2;
        const viewBox = `0 0 ${w} ${hTotal}`;
        
        const beamStartX = pad * 2;
        const beamEndX = w - pad * 2;
        const beamW = beamEndX - beamStartX;
        const toX = (posM) => beamStartX + (totalL_m > 0 ? (posM / totalL_m) * beamW : 0);

        let maxM = 1.0, maxQ = 1.0, maxN = 10.0;
        beam.spans.forEach(s => {
            const mL_mid = s.M_mid || (s.fdStress?.stressData?.M_long_mid_Nmm / 1e6) || 0;
            const mL_end = s.M_end || (s.fdStress?.stressData?.M_long_end_Nmm / 1e6) || 0;
            const mS_max = Math.max(
                s.leftward?.M_left || 0, s.leftward?.M_right || 0,
                s.rightward?.M_left || 0, s.rightward?.M_right || 0,
                ((s.fdStress?.stressData?.M_short_end_Nmm || 0) / 1e6)
            );
            const q_max = Math.max(
                s.Q_L || 0,
                s.leftward?.Q || 0, s.rightward?.Q || 0,
                (((s.fdStress?.stressData?.Q_long_N || 0) + (s.fdStress?.stressData?.Qe_N || 0)) / 1e3)
            );
            const n_max = Math.max(
                Math.abs(s.leftward?.Td || 0), Math.abs(s.rightward?.Td || 0),
                (s.fdStress?.leftPat?.Td_kN || 0), (s.fdStress?.rightPat?.Td_kN || 0)
            );

            maxM = Math.max(maxM, mL_mid + mS_max, mL_end + mS_max);
            maxQ = Math.max(maxQ, q_max);
            maxN = Math.max(maxN, n_max);
        });

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" style="background:#fff; font-family:'Meiryo',sans-serif;">`;
        
        const nY = pad + hSection / 2;
        const mY = pad + hSection + hSection / 2;
        const qY = pad + hSection * 2 + hSection / 2;

        svg += `<g stroke="#eee" stroke-width="1">
            <line x1="${beamStartX}" y1="${nY}" x2="${beamEndX}" y2="${nY}" />
            <line x1="${beamStartX}" y1="${mY}" x2="${beamEndX}" y2="${mY}" />
            <line x1="${beamStartX}" y1="${qY}" x2="${beamEndX}" y2="${qY}" />
        </g>`;
        svg += `<text x="${pad}" y="${pad + 15}" font-size="12" font-weight="bold" fill="#2c3e50">N図 (軸力) [kN]</text>`;
        svg += `<text x="${pad}" y="${pad + hSection + 15}" font-size="12" font-weight="bold" fill="#2c3e50">M図 (曲げモーメント) [kN・m]</text>`;
        svg += `<text x="${pad}" y="${pad + hSection * 2 + 15}" font-size="12" font-weight="bold" fill="#2c3e50">Q図 (せん断力) [kN]</text>`;

        let currentPosM = 0;
        svg += `<g stroke="#bdc3c7" stroke-width="1" stroke-dasharray="5,3">`;
        svg += `<line x1="${toX(0)}" y1="${pad}" x2="${toX(0)}" y2="${hTotal - pad}" />`;
        beam.spans.forEach(s => {
            currentPosM += s.L || (s.spanLength || 0) / 1000;
            const x = toX(currentPosM);
            svg += `<line x1="${x}" y1="${pad}" x2="${x}" y2="${hTotal - pad}" />`;
        });
        svg += `</g>`;

        currentPosM = 0;
        beam.spans.forEach((s, idx) => {
            const spanL = s.L || (s.spanLength || 0) / 1000;
            if (spanL <= 0) return;
            const xStart = toX(currentPosM);
            const xEnd = toX(currentPosM + spanL);

            const mScale = (hSection * 0.4) / (maxM || 1);
            const qScale = (hSection * 0.4) / (maxQ || 1);
            const nScale = (hSection * 0.3) / (maxN || 1);

            const seismic = beam.fdStress?.seismic || {};
            const lTd_start = seismic.leftward?.Td?.[idx] ?? 0;
            const rTd_start = seismic.rightward?.Td?.[idx] ?? 0;
            const lTd_end = seismic.leftward?.Td?.[idx + 1] ?? 0;
            const rTd_end = seismic.rightward?.Td?.[idx + 1] ?? 0;
            const nVal = Math.max(
                Math.abs(lTd_start), Math.abs(rTd_start),
                Math.abs(lTd_end), Math.abs(rTd_end),
                Math.abs(s.leftward?.Td || 0), Math.abs(s.rightward?.Td || 0),
                s.fdStress?.cap?.N_kN || 0
            );
            if (nVal > 0) {
                const nH = nVal * nScale;
                svg += `<rect x="${xStart}" y="${nY - nH}" width="${xEnd - xStart}" height="${nH}" fill="rgba(231, 76, 60, 0.15)" stroke="#e74c3c" stroke-width="1" />`;
                svg += `<text x="${(xStart + xEnd) / 2}" y="${nY - nH - 5}" font-size="10" text-anchor="middle" fill="#c0392b">${this.fmt(nVal)}</text>`;
            }

            const mL_mid = s.M_mid || (s.fdStress?.stressData?.M_long_mid_Nmm / 1e6) || 0;
            const mS_mid = (Math.max(s.leftward?.M_left || 0, s.rightward?.M_left || 0) / 2) || ((s.fdStress?.stressData?.M_short_end_Nmm || 0) / 2 / 1e6);
            const mS_end = Math.max(s.leftward?.M_right || s.leftward?.M_left || 0, s.rightward?.M_right || s.rightward?.M_left || 0) || ((s.fdStress?.stressData?.M_short_end_Nmm || 0) / 1e6);
            
            let mPathTotal = `M ${xStart} ${mY + mS_end * mScale}`;
            for (let i = 1; i <= 20; i++) {
                const localX = (spanL * i) / 20;
                const factorML = 4 * (localX / spanL) * (1 - localX / spanL);
                const factorMS = (localX <= spanL / 2) ? (2 * localX / spanL) : (2 * (1 - localX / spanL));
                const val = (mL_mid * factorML) + (mS_mid * factorMS) - (mS_end * (1 - factorMS));
                mPathTotal += ` L ${toX(currentPosM + localX)} ${mY + val * mScale}`;
            }

            svg += `<path d="${mPathTotal}" fill="none" stroke="#2980b9" stroke-width="1.5" />`;
            if (mL_mid > 0) svg += `<text x="${(xStart + xEnd) / 2}" y="${mY + (mL_mid + mS_mid) * mScale + 12}" font-size="10" text-anchor="middle" fill="#2980b9">${this.fmt(mL_mid)}</text>`;

            const qVal = s.Q_L || s.leftward?.Q || s.rightward?.Q || 0;
            if (qVal > 0) {
                const qH = qVal * qScale;
                const qPath = `M ${xStart} ${qY - qH} L ${xEnd} ${qY + qH} L ${xEnd} ${qY} L ${xStart} ${qY} Z`;
                svg += `<path d="${qPath}" fill="rgba(142, 68, 173, 0.1)" stroke="#8e44ad" stroke-width="1" />`;
                svg += `<text x="${xStart + 15}" y="${qY - qH - 5}" font-size="9" fill="#8e44ad">${this.fmt(qVal)}</text>`;
                svg += `<text x="${xEnd - 15}" y="${qY + qH + 12}" font-size="9" text-anchor="end" fill="#8e44ad">-${this.fmt(qVal)}</text>`;
            }

            currentPosM += spanL;
        });

        svg += `</svg>`;
        return svg;
    }
};
