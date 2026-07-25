/**
 * view/FoundationBeamReportView.js - Foundation Beam Report HTML Component
 * v3.3.0 Refactoring: Single Responsibility Principle - Pure View Component for Beam Stress Report HTML
 */

window.FoundationBeamReportView = {
    /**
     * 基礎梁断面検定 計算書HTMLの生成
     * @param {Object} beam - 基礎梁オブジェクト (fdStress, spans, props を含む)
     * @returns {string} HTML文字列
     */
    generateBeamReportHtml: function(beam) {
        return getFoundationBeamReportHtml_inner(beam);
    }
};

// Inner implementation (extracted from wall_4split_foundation_engine.js)
function getFoundationBeamReportHtml_inner(beam) {
    if (!beam || !beam.fdStress) {
        return '<p style="color:#888; padding:10px;">⚠️ 計算データがありません。作図後に更新を実行してください。</p>';
    }
    const bp = beam.props || {};
    let html = `<div class="foundation-beam-report" style="font-family:'Hiragino Kaku Gothic ProN','Meiryo',sans-serif; font-size:11px; line-height:1.4; color:#333;">
        <div style="background:#2c3e50; color:#fff; padding:6px 10px; font-weight:bold; font-size:12px; margin-bottom:10px; border-radius:3px;">
            📐 基礎梁断面検定 計算書（符号: ${bp.symbol || 'FG1'}）
        </div>
        
        <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:10px; border:1px solid #aaa;">
            <tr style="background:#f2f2f2;">
                <th style="border:1px solid #aaa; padding:4px; text-align:left; width:25%;">符号</th>
                <th style="border:1px solid #aaa; padding:4px; text-align:right; width:25%;">梁幅 W(mm)</th>
                <th style="border:1px solid #aaa; padding:4px; text-align:right; width:25%;">梁成 H(mm)</th>
                <th style="border:1px solid #aaa; padding:4px; text-align:right; width:25%;">根入深さ (mm)</th>
            </tr>
            <tr>
                <td style="border:1px solid #aaa; padding:4px; font-weight:bold;">${bp.symbol || 'FG1'}</td>
                <td style="border:1px solid #aaa; padding:4px; text-align:right;">${bp.width || 150}</td>
                <td style="border:1px solid #aaa; padding:4px; text-align:right;">${bp.height || 640}</td>
                <td style="border:1px solid #aaa; padding:4px; text-align:right;">${bp.embedDepth || 250}</td>
            </tr>
            <tr style="background:#f2f2f2;">
                <th style="border:1px solid #aaa; padding:4px; text-align:left;">上部主筋</th>
                <th style="border:1px solid #aaa; padding:4px; text-align:left;">下部主筋</th>
                <th colspan="2" style="border:1px solid #aaa; padding:4px; text-align:left;">ST筋 (あばら筋)</th>
            </tr>
            <tr>
                <td style="border:1px solid #aaa; padding:4px;">${bp.topRebar || '1-D13'}</td>
                <td style="border:1px solid #aaa; padding:4px;">${bp.bottomRebar || '1-D13'}</td>
                <td colspan="2" style="border:1px solid #aaa; padding:4px;">${bp.stirrup || '1-D10@200'}</td>
            </tr>
        </table>`;

    if (beam.fdStress && beam.fdStress.pillars && beam.fdStress.pillars.length > 0) {
        const pillars = beam.fdStress.pillars;
        const seismic = beam.fdStress.seismic;
        const spans = beam.fdStress.spans || [];

        const B_val = bp.B_val !== undefined ? parseFloat(bp.B_val) : 0.5;
        const modelType = bp.modelType || 'both_ends';
        const dispB = (modelType === 'pillar_supported') ? 1.0 : B_val;

        // Table 1: 応力の算定（水平荷重時）
        html += `<div style="font-weight:bold; margin-top:12px; margin-bottom:4px; font-size:11px;">(1) 応力の算定（水平荷重時）</div>
        <table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:10px; border:1px solid #aaa;">
            <thead>
                <tr style="background:#f2f2f2;">
                    <th rowspan="2" style="border:1px solid #aaa; padding:3px;">柱</th>
                    <th rowspan="2" style="border:1px solid #aaa; padding:3px;">x(m)</th>
                    <th colspan="4" style="border:1px solid #aaa; padding:3px; text-align:center;">左加力 (B=${dispB.toFixed(3)})</th>
                    <th colspan="4" style="border:1px solid #aaa; padding:3px; text-align:center;">右加力 (B=${dispB.toFixed(3)})</th>
                </tr>
                <tr style="background:#f2f2f2;">
                    <th style="border:1px solid #aaa; padding:2px;">Td</th>
                    <th style="border:1px solid #aaa; padding:2px;">R</th>
                    <th style="border:1px solid #aaa; padding:2px;">Qe</th>
                    <th style="border:1px solid #aaa; padding:2px;">Mf</th>
                    <th style="border:1px solid #aaa; padding:2px;">Td</th>
                    <th style="border:1px solid #aaa; padding:2px;">R</th>
                    <th style="border:1px solid #aaa; padding:2px;">Qe</th>
                    <th style="border:1px solid #aaa; padding:2px;">Mf</th>
                </tr>
            </thead>
            <tbody>`;
        pillars.forEach((p, idx) => {
            const l_Td = (seismic.leftward.Td[idx] || 0).toFixed(2);
            const l_R = (seismic.leftward.R ? (seismic.leftward.R[idx] ?? 0) : (idx === 0 ? seismic.leftward.R_left : (idx === pillars.length - 1 ? seismic.leftward.R_right : 0))).toFixed(2);
            const l_Qe = (seismic.leftward.Qe[idx] || 0).toFixed(2);
            const l_Mf = (seismic.leftward.Mf[idx] || 0).toFixed(2);

            const r_Td = (seismic.rightward.Td[idx] || 0).toFixed(2);
            const r_R = (seismic.rightward.R ? (seismic.rightward.R[idx] ?? 0) : (idx === 0 ? seismic.rightward.R_left : (idx === pillars.length - 1 ? seismic.rightward.R_right : 0))).toFixed(2);
            const r_Qe = (seismic.rightward.Qe[idx] || 0).toFixed(2);
            const r_Mf = (seismic.rightward.Mf[idx] || 0).toFixed(2);

            html += `<tr>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${p.name}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${p.x.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${l_Td}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${l_R}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${l_Qe}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${l_Mf}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${r_Td}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${r_R}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${r_Qe}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${r_Mf}</td>
            </tr>`;
        });
        html += `</tbody></table>`;

        // Table 2: 応力の算定（長期）
        html += `<div style="font-weight:bold; margin-top:10px; margin-bottom:4px; font-size:11px;">(2) 応力の算定（長期）</div>
        <table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:10px; border:1px solid #aaa;">
            <thead>
                <tr style="background:#f2f2f2;">
                    <th style="border:1px solid #aaa; padding:3px;">柱間</th>
                    <th style="border:1px solid #aaa; padding:3px;">長さL(m)</th>
                    <th style="border:1px solid #aaa; padding:3px;">σe (kN/㎡)</th>
                    <th style="border:1px solid #aaa; padding:3px;">負担幅 B(m)</th>
                    <th style="border:1px solid #aaa; padding:3px;">M中(kNm)</th>
                    <th style="border:1px solid #aaa; padding:3px;">M端(kNm)</th>
                    <th style="border:1px solid #aaa; padding:3px;">QL(kN)</th>
                </tr>
            </thead>
            <tbody>`;
        spans.forEach(span => {
            html += `<tr>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${span.spanName}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.L.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.sigma_e.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.B_trib.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${span.M_mid.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${span.M_end.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${span.Q_L.toFixed(2)}</td>
            </tr>`;
        });
        html += `</tbody></table>`;

        // Table 3: 応力の算定（短期）
        html += `<div style="font-weight:bold; margin-top:10px; margin-bottom:4px; font-size:11px;">(3) 応力の算定（短期）</div>
        <table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:10px; border:1px solid #aaa;">
            <thead>
                <tr style="background:#f2f2f2;">
                    <th rowspan="2" style="border:1px solid #aaa; padding:3px;">柱間</th>
                    <th colspan="3" style="border:1px solid #aaa; padding:3px; text-align:center;">左加力 (QL + 2.0Qe)</th>
                    <th colspan="3" style="border:1px solid #aaa; padding:3px; text-align:center;">右加力 (QL + 2.0Qe)</th>
                </tr>
                <tr style="background:#f2f2f2;">
                    <th style="border:1px solid #aaa; padding:2px;">M端(左)</th>
                    <th style="border:1px solid #aaa; padding:2px;">M端(右)</th>
                    <th style="border:1px solid #aaa; padding:2px;">QS (kN)</th>
                    <th style="border:1px solid #aaa; padding:2px;">M端(左)</th>
                    <th style="border:1px solid #aaa; padding:2px;">M端(右)</th>
                    <th style="border:1px solid #aaa; padding:2px;">QS (kN)</th>
                </tr>
            </thead>
            <tbody>`;
        spans.forEach(span => {
            html += `<tr>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${span.spanName}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.leftward.M_left.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.leftward.M_right.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${span.leftward.Q.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.rightward.M_left.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.rightward.M_right.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${span.rightward.Q.toFixed(2)}</td>
            </tr>`;
        });
        html += `</tbody></table>`;

        // Table 4: 許容耐力の算定（1）
        html += `<div style="font-weight:bold; margin-top:10px; margin-bottom:4px; font-size:11px;">(4) 許容耐力の算定（1 - 曲げ）</div>
        <table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:10px; border:1px solid #aaa;">
            <thead>
                <tr style="background:#f2f2f2;">
                    <th rowspan="2" style="border:1px solid #aaa; padding:3px;">柱間</th>
                    <th rowspan="2" style="border:1px solid #aaa; padding:3px;">成 D(mm)</th>
                    <th colspan="3" style="border:1px solid #aaa; padding:3px; text-align:center;">上端主筋</th>
                    <th colspan="3" style="border:1px solid #aaa; padding:3px; text-align:center;">下端主筋</th>
                </tr>
                <tr style="background:#f2f2f2;">
                    <th style="border:1px solid #aaa; padding:2px;">鉄筋</th>
                    <th style="border:1px solid #aaa; padding:2px;">at(㎟)</th>
                    <th style="border:1px solid #aaa; padding:2px;">sMa(kNm)</th>
                    <th style="border:1px solid #aaa; padding:2px;">鉄筋</th>
                    <th style="border:1px solid #aaa; padding:2px;">at(㎟)</th>
                    <th style="border:1px solid #aaa; padding:2px;">lMa(kNm)</th>
                </tr>
            </thead>
            <tbody>`;
        spans.forEach(span => {
            html += `<tr>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${span.spanName}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.cap?.h ?? 0}</td>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${bp.topRebar || '1-D13'}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${((span.cap?.lMa_top ?? 0) * 1e6 / 195 / (span.cap?.j || 1) || 0).toFixed(1)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${(span.cap?.sMa_top ?? 0).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${bp.bottomRebar || '1-D13'}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${((span.cap?.lMa_bot ?? 0) * 1e6 / 195 / (span.cap?.j || 1) || 0).toFixed(1)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${(span.cap?.lMa_bot ?? 0).toFixed(2)}</td>
            </tr>`;
        });
        html += `</tbody></table>`;

        // Table 5: 許容耐力の算定（2）
        html += `<div style="font-weight:bold; margin-top:10px; margin-bottom:4px; font-size:11px;">(5) 許容耐力の算定（2 - せん断）</div>
        <table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:10px; border:1px solid #aaa;">
            <thead>
                <tr style="background:#f2f2f2;">
                    <th style="border:1px solid #aaa; padding:3px;">柱間</th>
                    <th style="border:1px solid #aaa; padding:3px;">幅 b</th>
                    <th style="border:1px solid #aaa; padding:3px;">ST筋</th>
                    <th style="border:1px solid #aaa; padding:3px;">pw</th>
                    <th style="border:1px solid #aaa; padding:3px;">長期Qa(kN)</th>
                    <th style="border:1px solid #aaa; padding:3px;">短期Qa_L(kN)</th>
                    <th style="border:1px solid #aaa; padding:3px;">短期Qa_R(kN)</th>
                </tr>
            </thead>
            <tbody>`;
        spans.forEach(span => {
            html += `<tr>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${span.spanName}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.cap?.b ?? 0}</td>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${bp.stirrup || '1-D10@200'}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${(span.cap?.pw ?? 0).toFixed(5)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${(span.cap?.lQa ?? 0).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${(span.cap?.sQa_L ?? 0).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${(span.cap?.sQa_R ?? 0).toFixed(2)}</td>
            </tr>`;
        });
        html += `</tbody></table>`;

        // Table 6: 総合判定表
        html += `<div style="font-weight:bold; margin-top:10px; margin-bottom:4px; font-size:11px;">(6) 総合判定表</div>
        <table style="width:100%; border-collapse:collapse; font-size:10px; border:1px solid #aaa;">
            <thead>
                <tr style="background:#f2f2f2;">
                    <th style="border:1px solid #aaa; padding:3px;">柱間</th>
                    <th style="border:1px solid #aaa; padding:3px; text-align:center;">長期 M_L/Ma</th>
                    <th style="border:1px solid #aaa; padding:3px; text-align:center;">長期 Q_L/Qa</th>
                    <th style="border:1px solid #aaa; padding:3px; text-align:center;">短期左 M_S/Ma</th>
                    <th style="border:1px solid #aaa; padding:3px; text-align:center;">短期左 Q_S/Qa</th>
                    <th style="border:1px solid #aaa; padding:3px; text-align:center;">短期右 M_S/Ma</th>
                    <th style="border:1px solid #aaa; padding:3px; text-align:center;">短期右 Q_S/Qa</th>
                    <th style="border:1px solid #aaa; padding:3px; text-align:center;">判定</th>
                </tr>
            </thead>
            <tbody>`;
        spans.forEach(span => {
            const badge = span.isNG ? `<span style="color:red; font-weight:bold;">NG</span>` : `<span style="color:green; font-weight:bold;">OK</span>`;
            html += `<tr>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${span.spanName}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold; color:${(span.rM_L ?? 0) > 1.0 ? 'red' : 'inherit'}">${(span.rM_L ?? 0).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold; color:${(span.rQ_L ?? 0) > 1.0 ? 'red' : 'inherit'}">${(span.rQ_L ?? 0).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold; color:${Math.max((span.leftward?.rM_left ?? 0), (span.leftward?.rM_right ?? 0)) > 1.0 ? 'red' : 'inherit'}">${Math.max((span.leftward?.rM_left ?? 0), (span.leftward?.rM_right ?? 0)).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold; color:${(span.leftward?.rQ ?? 0) > 1.0 ? 'red' : 'inherit'}">${(span.leftward?.rQ ?? 0).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold; color:${Math.max((span.rightward?.rM_left ?? 0), (span.rightward?.rM_right ?? 0)) > 1.0 ? 'red' : 'inherit'}">${Math.max((span.rightward?.rM_left ?? 0), (span.rightward?.rM_right ?? 0)).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold; color:${(span.rightward?.rQ ?? 0) > 1.0 ? 'red' : 'inherit'}">${(span.rightward?.rQ ?? 0).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:center;">${badge}</td>
            </tr>`;
        });
        html += `</tbody></table>`;
    } else {
        html += `<p style="padding:10px; text-align:center; color:#7f8c8d; font-size:11px;">
            💡 基礎梁のスパン（柱間）が検出されていません。
        </p>`;
    }

    html += `</div>`;
    return html;
}

// Register with ServiceContainer
if (window.ServiceContainer) {
    window.ServiceContainer.register('FoundationBeamReportView', window.FoundationBeamReportView);
}
