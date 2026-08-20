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
        html += `<div style="font-weight:bold; margin-top:12px; margin-bottom:4px; font-size:11px;">(1) 応力の算定（水平荷重時）</div>`;

        if (modelType === 'simple_beam') {
            // 単純梁専用：スパン別テーブル
            const lSpans = seismic.leftward.simpleBeamSpans  || [];
            const rSpans = seismic.rightward.simpleBeamSpans || [];
            const tdS = 'border:1px solid #aaa; padding:2px; text-align:right; font-size:9px;';
            const thS = 'border:1px solid #aaa; padding:2px; text-align:center; font-size:9px;';
            html += `<table style="width:100%; border-collapse:collapse; font-size:9px; margin-bottom:10px; border:1px solid #aaa;">
                <thead>
                    <tr style="background:#f2f2f2;">
                        <th rowspan="2" style="${thS}">柱間</th>
                        <th rowspan="2" style="${thS}">長さ(m)</th>
                        <th colspan="6" style="${thS}">左加力 (B=${dispB.toFixed(2)})</th>
                        <th colspan="6" style="${thS}">右加力 (B=${dispB.toFixed(2)})</th>
                    </tr>
                    <tr style="background:#f2f2f2;">
                        <th style="${thS}">lTd(kN)</th><th style="${thS}">rTd(kN)</th>
                        <th style="${thS}">M水(kNm)</th><th style="${thS}">Qe(kN)</th>
                        <th style="${thS}">lM水f</th><th style="${thS}">rM水f</th>
                        <th style="${thS}">lTd(kN)</th><th style="${thS}">rTd(kN)</th>
                        <th style="${thS}">M水(kNm)</th><th style="${thS}">Qe(kN)</th>
                        <th style="${thS}">lM水f</th><th style="${thS}">rM水f</th>
                    </tr>
                </thead>
                <tbody>`;
            const maxLen = Math.max(lSpans.length, rSpans.length);
            for (let i = 0; i < maxLen; i++) {
                const ls = lSpans[i] || {};
                const rs = rSpans[i] || {};
                const isWall = ls.isWall || rs.isWall;
                const lp = pillars[ls.idx_l !== undefined ? ls.idx_l : i] || {};
                const rp = pillars[ls.idx_r !== undefined ? ls.idx_r : i + 1] || {};
                const sn = isWall ? `|${lp.name || '?'}-${rp.name || '?'}|` : `${lp.name || '?'}-${rp.name || '?'}`;
                const L_ = (ls.L || rs.L || 0).toFixed(3);
                const ll = v => v != null ? Number(v).toFixed(2) : '';
                html += `<tr style="${isWall ? 'background:#f0fff4' : 'background:#fffbf0'}">
                    <td style="${tdS} font-weight:bold;">${sn}</td>
                    <td style="${tdS}">${L_}</td>
                    <td style="${tdS}">${isWall ? ll(ls.lTd) : ''}</td>
                    <td style="${tdS}">${isWall ? ll(ls.rTd) : ''}</td>
                    <td style="${tdS} font-weight:bold;">${isWall ? ll(ls.M_wf) : ''}</td>
                    <td style="${tdS}">${!isWall && ls.Qe != null ? ll(ls.Qe) : ''}</td>
                    <td style="${tdS}">${!isWall && ls.lM_wf != null ? ll(ls.lM_wf) : ''}</td>
                    <td style="${tdS}">${!isWall && ls.rM_wf != null ? ll(ls.rM_wf) : ''}</td>
                    <td style="${tdS}">${isWall ? ll(rs.lTd) : ''}</td>
                    <td style="${tdS}">${isWall ? ll(rs.rTd) : ''}</td>
                    <td style="${tdS} font-weight:bold;">${isWall ? ll(rs.M_wf) : ''}</td>
                    <td style="${tdS}">${!isWall && rs.Qe != null ? ll(rs.Qe) : ''}</td>
                    <td style="${tdS}">${!isWall && rs.lM_wf != null ? ll(rs.lM_wf) : ''}</td>
                    <td style="${tdS}">${!isWall && rs.rM_wf != null ? ll(rs.rM_wf) : ''}</td>
                </tr>`;
            }
            html += `</tbody></table>`;
        } else {
            // 連続梁モデル：節点別テーブル（「計」行付き）
            html += `<table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:10px; border:1px solid #aaa;">
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
            // 「計」行
            const l_sumTd = (seismic.leftward.sumTd ?? 0).toFixed(2);
            const l_sumR  = (seismic.leftward.sumR  ?? 0).toFixed(2);
            const r_sumTd = (seismic.rightward.sumTd ?? 0).toFixed(2);
            const r_sumR  = (seismic.rightward.sumR  ?? 0).toFixed(2);
            html += `<tr style="background:#ebebeb; font-weight:bold; border-top:2px solid #999;">
                    <td style="border:1px solid #aaa; padding:3px; text-align:center;">計</td>
                    <td style="border:1px solid #aaa; padding:3px;"></td>
                    <td style="border:1px solid #aaa; padding:3px; text-align:right;">${l_sumTd}</td>
                    <td style="border:1px solid #aaa; padding:3px; text-align:right;">${l_sumR}</td>
                    <td style="border:1px solid #aaa; padding:3px;"></td>
                    <td style="border:1px solid #aaa; padding:3px;"></td>
                    <td style="border:1px solid #aaa; padding:3px; text-align:right;">${r_sumTd}</td>
                    <td style="border:1px solid #aaa; padding:3px; text-align:right;">${r_sumR}</td>
                    <td style="border:1px solid #aaa; padding:3px;"></td>
                    <td style="border:1px solid #aaa; padding:3px;"></td>
                </tr>`;
            html += `</tbody></table>`;
        }



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
        html += `<div style="font-weight:bold; margin-top:10px; margin-bottom:4px; font-size:11px;">(3) 応力の算定（短期: 端部・中央曲げモーメント）</div>
        <table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:10px; border:1px solid #aaa;">
            <thead>
                <tr style="background:#f2f2f2;">
                    <th rowspan="2" style="border:1px solid #aaa; padding:3px;">柱間</th>
                    <th colspan="4" style="border:1px solid #aaa; padding:3px; text-align:center;">左加力 (QL + 2.0Qe)</th>
                    <th colspan="4" style="border:1px solid #aaa; padding:3px; text-align:center;">右加力 (QL + 2.0Qe)</th>
                </tr>
                <tr style="background:#f2f2f2;">
                    <th style="border:1px solid #aaa; padding:2px;">M端(左)</th>
                    <th style="border:1px solid #aaa; padding:2px; background:#eef6ff;">M中</th>
                    <th style="border:1px solid #aaa; padding:2px;">M端(右)</th>
                    <th style="border:1px solid #aaa; padding:2px;">QS (kN)</th>
                    <th style="border:1px solid #aaa; padding:2px;">M端(左)</th>
                    <th style="border:1px solid #aaa; padding:2px; background:#eef6ff;">M中</th>
                    <th style="border:1px solid #aaa; padding:2px;">M端(右)</th>
                    <th style="border:1px solid #aaa; padding:2px;">QS (kN)</th>
                </tr>
            </thead>
            <tbody>`;
        spans.forEach(span => {
            const l_Mmid = (span.leftward?.M_mid_S ?? span.M_mid ?? 0).toFixed(2);
            const r_Mmid = (span.rightward?.M_mid_S ?? span.M_mid ?? 0).toFixed(2);
            html += `<tr>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${span.spanName}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.leftward.M_left.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold; background:#f4f9ff;">${l_Mmid}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.leftward.M_right.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${span.leftward.Q.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.rightward.M_left.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold; background:#f4f9ff;">${r_Mmid}</td>
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

        // Table 6: 総合判定表 (添付画像1公式テンプレート準拠)
        html += `<div style="font-weight:bold; margin-top:10px; margin-bottom:4px; font-size:11px;">(6) 総合判定表（長期 M中/上端LMa, M端/下端LMa ＆ 短期 左・右加力 ＆ 配筋補強指針）</div>
        <table style="width:100%; border-collapse:collapse; font-size:9px; border:1px solid #aaa; text-align:center;">
            <thead>
                <tr style="background:#f2f2f2;">
                    <th rowspan="2" style="border:1px solid #aaa; padding:3px;">柱間</th>
                    <th colspan="3" style="border:1px solid #aaa; padding:3px; text-align:center;">長期</th>
                    <th colspan="3" style="border:1px solid #aaa; padding:3px; text-align:center;">短期 左加力</th>
                    <th colspan="3" style="border:1px solid #aaa; padding:3px; text-align:center;">短期 右加力</th>
                    <th rowspan="2" style="border:1px solid #aaa; padding:3px;">判定<br>&lt; 1.0</th>
                    <th rowspan="2" style="border:1px solid #aaa; padding:3px; text-align:left;">💡 補強要否ガイド</th>
                </tr>
                <tr style="background:#f2f2f2; font-size:8px;">
                    <th style="border:1px solid #aaa; padding:2px; font-weight:bold; background:#eef6ff;">M中 / 上端LMa</th>
                    <th style="border:1px solid #aaa; padding:2px; font-weight:bold; background:#fdf2e9;">M端 / 下端LMa</th>
                    <th style="border:1px solid #aaa; padding:2px;">QL / LQa</th>
                    <th style="border:1px solid #aaa; padding:2px;">(M端+M水f)<br>/1.5 LMa (左)</th>
                    <th style="border:1px solid #aaa; padding:2px;">(M端+M水f)<br>/1.5 LMa (右)</th>
                    <th style="border:1px solid #aaa; padding:2px;">(QL+nQe)<br>/sQa</th>
                    <th style="border:1px solid #aaa; padding:2px;">(M端+M水f)<br>/1.5 LMa (左)</th>
                    <th style="border:1px solid #aaa; padding:2px;">(M端+M水f)<br>/1.5 LMa (右)</th>
                    <th style="border:1px solid #aaa; padding:2px;">(QL+nQe)<br>/sQa</th>
                </tr>
            </thead>
            <tbody>`;
        spans.forEach(span => {
            const rM_L_mid = span.rM_L_mid ?? (span.M_mid / (span.cap?.lMa_top || 1));
            const rM_L_end = span.rM_L_end ?? (span.M_end / (span.cap?.lMa_bot || 1));
            const rQ_L = span.rQ_L ?? (span.Q_L / (span.cap?.lQa || 1));

            const l_rM_left = (span.leftward?.rM_left_top ?? (span.leftward?.M_left / (span.cap?.sMa_top || 1))) || 0;
            const l_rM_right = (span.leftward?.rM_right_top ?? (span.leftward?.M_right / (span.cap?.sMa_top || 1))) || 0;
            const l_rQ = span.leftward?.rQ ?? 0;

            const r_rM_left = (span.rightward?.rM_left_top ?? (span.rightward?.M_left / (span.cap?.sMa_top || 1))) || 0;
            const r_rM_right = (span.rightward?.rM_right_top ?? (span.rightward?.M_right / (span.cap?.sMa_top || 1))) || 0;
            const r_rQ = span.rightward?.rQ ?? 0;

            const needTop = (rM_L_mid > 1.0) || (l_rM_left > 1.0) || (l_rM_right > 1.0) || (r_rM_left > 1.0) || (r_rM_right > 1.0);
            const needBot = (rM_L_end > 1.0);
            const needShear = (rQ_L > 1.0) || (l_rQ > 1.0) || (r_rQ > 1.0);
            const isSpanNG = needTop || needBot || needShear;

            const badge = isSpanNG ? `<span style="color:red; font-weight:bold;">NG</span>` : `<span style="color:green; font-weight:bold;">OK</span>`;

            let advice = '';
            if (needTop && needBot) {
                advice = `<span style="color:#900; font-weight:bold; background:#fde8e8; padding:2px 4px; border-radius:3px;">⚠️ 上主筋・下主筋の両方を補強</span>`;
            } else if (needTop) {
                advice = `<span style="color:#c0392b; font-weight:bold; background:#fadbd8; padding:2px 4px; border-radius:3px;">⚠️ 上主筋を補強 (端部曲げ/長期M中)</span>`;
            } else if (needBot) {
                advice = `<span style="color:#c0392b; font-weight:bold; background:#fadbd8; padding:2px 4px; border-radius:3px;">⚠️ 下主筋を補強 (長期M端)</span>`;
            } else if (needShear) {
                advice = `<span style="color:#d35400; font-weight:bold; background:#fef5e7; padding:2px 4px; border-radius:3px;">⚠️ あばら筋(ST筋)を補強 (せん断)</span>`;
            } else {
                advice = `<span style="color:#27ae60;">✅ 既定配筋で適合</span>`;
            }

            html += `<tr style="${isSpanNG ? 'background:#fef5f5;' : ''}">
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${span.spanName}</td>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold; background:#f4f9ff; color:${rM_L_mid > 1.0 ? 'red' : '#1b4f72'};">${rM_L_mid.toFixed(3)}</td>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold; background:#fdf9f4; color:${rM_L_end > 1.0 ? 'red' : '#7e5109'};">${rM_L_end.toFixed(3)}</td>
                <td style="border:1px solid #aaa; padding:3px; color:${rQ_L > 1.0 ? 'red' : 'inherit'};">${rQ_L.toFixed(3)}</td>
                <td style="border:1px solid #aaa; padding:3px; color:${l_rM_left > 1.0 ? 'red' : 'inherit'};">${l_rM_left.toFixed(3)}</td>
                <td style="border:1px solid #aaa; padding:3px; color:${l_rM_right > 1.0 ? 'red' : 'inherit'};">${l_rM_right.toFixed(3)}</td>
                <td style="border:1px solid #aaa; padding:3px; color:${l_rQ > 1.0 ? 'red' : 'inherit'};">${l_rQ.toFixed(3)}</td>
                <td style="border:1px solid #aaa; padding:3px; color:${r_rM_left > 1.0 ? 'red' : 'inherit'};">${r_rM_left.toFixed(3)}</td>
                <td style="border:1px solid #aaa; padding:3px; color:${r_rM_right > 1.0 ? 'red' : 'inherit'};">${r_rM_right.toFixed(3)}</td>
                <td style="border:1px solid #aaa; padding:3px; color:${r_rQ > 1.0 ? 'red' : 'inherit'};">${r_rQ.toFixed(3)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:center;">${badge}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:left;">${advice}</td>
            </tr>`;
        });
        html += `</tbody></table>`;

        // Table 7: 人通口補強計算
        const s = window.AppState || {};
        const beamManholes = (s.manholes || []).filter(m => m.parentBeamId === beam.id);
        const slabThickness = (s.foundationSlabs && s.foundationSlabs.length > 0) ? (s.foundationSlabs[0].props?.slabThickness || 150) : 150;

        html += `<div style="font-weight:bold; margin-top:10px; margin-bottom:4px; font-size:11px;">(7) 人通口補強計算（スラブ内割増筋: 長期・短期耐力検定）</div>
        <table style="width:100%; border-collapse:collapse; font-size:10px; border:1px solid #aaa; text-align:center;">
            <thead>
                <tr style="background:#f2f2f2;">
                    <th style="border:1px solid #aaa; padding:3px;">位置 (グリッド)</th>
                    <th style="border:1px solid #aaa; padding:3px;">仕様</th>
                    <th style="border:1px solid #aaa; padding:3px;">補強筋 本数・径</th>
                    <th style="border:1px solid #aaa; padding:3px;">スラブ厚 t</th>
                    <th style="border:1px solid #aaa; padding:3px;">長期 M / 耐力 Ma,L</th>
                    <th style="border:1px solid #aaa; padding:3px;">長期検定比</th>
                    <th style="border:1px solid #aaa; padding:3px;">短期 M / 耐力 Ma,S</th>
                    <th style="border:1px solid #aaa; padding:3px;">短期検定比</th>
                    <th style="border:1px solid #aaa; padding:3px;">判定</th>
                </tr>
            </thead>
            <tbody>`;

        if (beamManholes.length === 0) {
            html += `<tr><td colspan="9" style="padding:8px; color:#7f8c8d; background:#fafafa;">※ この基礎梁には人通口が配置されていません（配置後自動計算）</td></tr>`;
        } else {
            beamManholes.forEach(mh => {
                const targetSpan = spans[0] || { spanName: '全区間', M_mid: 0, M_end: 0 };
                const spanName = targetSpan.spanName || '柱間';
                const barType = mh.bar_type || 'D13';
                const barCount = parseInt(mh.n_bars) || 2;
                const specName = mh.spec || 'スラブ内割増筋';

                const barAreas = { "D10": 71.0, "D13": 126.7, "D16": 198.6, "D19": 286.5, "D13+D16": 325.3 };
                const at = barCount * (barAreas[barType] || 126.7);
                const d = Math.max(10, slabThickness - 70);
                const j = (7 / 8) * d;

                const Ma_L = (at * 195 * j) / 1000000;
                const Ma_S = (at * 295 * j) / 1000000;

                const M_acting_L = Math.max(targetSpan.M_mid || 0, targetSpan.M_end || 0, 0.1);
                const M_acting_S = Math.max(
                    (targetSpan.leftward?.M_left || 0),
                    (targetSpan.leftward?.M_right || 0),
                    (targetSpan.leftward?.M_mid_S || 0),
                    (targetSpan.rightward?.M_left || 0),
                    (targetSpan.rightward?.M_right || 0),
                    (targetSpan.rightward?.M_mid_S || 0),
                    M_acting_L
                );

                const ratioL = Ma_L > 0 ? (M_acting_L / Ma_L) : 0;
                const ratioS = Ma_S > 0 ? (M_acting_S / Ma_S) : 0;
                const isManholeOk = (ratioL <= 1.0) && (ratioS <= 1.0);

                html += `<tr>
                    <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${spanName}</td>
                    <td style="border:1px solid #aaa; padding:3px;">${specName}</td>
                    <td style="border:1px solid #aaa; padding:3px;">${barCount}本 - ${barType}</td>
                    <td style="border:1px solid #aaa; padding:3px;">${slabThickness} mm</td>
                    <td style="border:1px solid #aaa; padding:3px;">${M_acting_L.toFixed(2)} / ${Ma_L.toFixed(2)} kNm</td>
                    <td style="border:1px solid #aaa; padding:3px; font-weight:bold; color:${ratioL > 1.0 ? 'red' : 'green'};">${(ratioL * 100).toFixed(1)}% ${ratioL <= 1.0 ? 'OK' : 'NG'}</td>
                    <td style="border:1px solid #aaa; padding:3px;">${M_acting_S.toFixed(2)} / ${Ma_S.toFixed(2)} kNm</td>
                    <td style="border:1px solid #aaa; padding:3px; font-weight:bold; color:${ratioS > 1.0 ? 'red' : 'green'};">${(ratioS * 100).toFixed(1)}% ${ratioS <= 1.0 ? 'OK' : 'NG'}</td>
                    <td style="border:1px solid #aaa; padding:3px;">
                        <span style="color:${isManholeOk ? 'green' : 'red'}; font-weight:bold;">${isManholeOk ? 'OK' : 'NG'}</span>
                    </td>
                </tr>`;
            });
        }
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
