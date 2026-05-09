/**
 * FoundationView.js
 * 基礎計算結果のHTMLレポート生成、SVG図面、UI表示を扱うモジュール
 */

/**
 * 座標から通り芯名への逆引き (AppState依存のため、引数で座標リストを受け取るか AppStateを参照)
 * 暫定的に AppState を参照
 */
function getGridNameFromCoords(x, y) {
    const TOL = 15;
    let xName = "", yName = "";
    const gXC = window.AppState.gridXCoords || [];
    const gXN = window.AppState.gridXNames || [];
    const gYC = window.AppState.gridYCoords || [];
    const gYN = window.AppState.gridYNames || [];
    for(let i=0; i<gXC.length; i++) { if(Math.abs(Number(gXC[i]) - Number(x)) < TOL) { xName = gXN[i]; break; } }
    for(let i=0; i<gYC.length; i++) { if(Math.abs(Number(gYC[i]) - Number(y)) < TOL) { yName = gYN[i]; break; } }
    if(xName && yName) return `${xName}-${yName}`;
    if(xName) return `${xName}通り上`;
    if(yName) return `${yName}通り上`;
    return `(${Math.round(x)}, ${Math.round(y)})`;
}

/**
 * 基礎梁の応力図 (N・M・Q図) の SVG 生成
 */
export function generateBeamNMQSvg(beam) {
    if (!beam || !beam.spans || beam.spans.length === 0) return '';
    const totalL_mm = beam.spans.reduce((sum, s) => sum + (s.spanLength || 0), 0);
    const totalL_m = totalL_mm / 1000;
    const w = 840, hSection = 140, pad = 50;
    const hTotal = hSection * 3 + pad * 2;
    const viewBox = `0 0 ${w} ${hTotal}`;
    const beamStartX = pad * 2, beamEndX = w - pad * 2, beamW = beamEndX - beamStartX;
    const toX = (posM) => beamStartX + (posM / totalL_m) * beamW;
    let maxM = 1.0, maxQ = 1.0, maxN = 10.0;
    beam.spans.forEach(s => {
        const fs = s.fdStress;
        if (fs && fs.stressData) {
            const mC_Long = fs.stressData.M_long_mid_Nmm / 1e6;
            const mC_Short = (fs.stressData.M_short_end_Nmm || 0) / 2;
            const mE_Short = (fs.stressData.M_short_end_Nmm || 0) / 1e6;
            maxM = Math.max(maxM, mC_Long + mC_Short, mE_Short);
            maxQ = Math.max(maxQ, (fs.stressData.Q_long_N + fs.stressData.Qe_N) / 1e3);
            maxN = Math.max(maxN, (fs.leftPat?.Td_kN || 0), (fs.rightPat?.Td_kN || 0));
        }
    });
    const fmt = (v) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(2) : '0';
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" style="background:#fff; font-family:'Meiryo',sans-serif;">`;
    const nY = pad + hSection / 2, mY = pad + hSection + hSection / 2, qY = pad + hSection * 2 + hSection / 2;
    svg += `<g stroke="#eee" stroke-width="1"><line x1="${beamStartX}" y1="${nY}" x2="${beamEndX}" y2="${nY}" /><line x1="${beamStartX}" y1="${mY}" x2="${beamEndX}" y2="${mY}" /><line x1="${beamStartX}" y1="${qY}" x2="${beamEndX}" y2="${qY}" /></g>`;
    svg += `<text x="${pad}" y="${pad + 15}" font-size="12" font-weight="bold" fill="#2c3e50">N図 (軸力) [kN]</text><text x="${pad}" y="${pad + hSection + 15}" font-size="12" font-weight="bold" fill="#2c3e50">M図 (曲げモーメント) [kN・m]</text><text x="${pad}" y="${pad + hSection * 2 + 15}" font-size="12" font-weight="bold" fill="#2c3e50">Q図 (せん断力) [kN]</text>`;
    let currentPosM = 0;
    svg += `<g stroke="#bdc3c7" stroke-width="1" stroke-dasharray="5,3"><line x1="${toX(0)}" y1="${pad}" x2="${toX(0)}" y2="${hTotal - pad}" />`;
    beam.spans.forEach(s => { currentPosM += (s.spanLength || 0) / 1000; const x = toX(currentPosM); svg += `<line x1="${x}" y1="${pad}" x2="${x}" y2="${hTotal - pad}" />`; });
    svg += `</g>`;
    currentPosM = 0;
    beam.spans.forEach((s, idx) => {
        const spanL = (s.spanLength || 0) / 1000, xStart = toX(currentPosM), xEnd = toX(currentPosM + spanL), fs = s.fdStress;
        if (!fs) { currentPosM += spanL; return; }
        const mScale = (hSection * 0.4) / maxM, qScale = (hSection * 0.4) / maxQ, nScale = (hSection * 0.3) / maxN;
        const nVal = fs.cap?.N_kN || 0;
        if (nVal > 0) { const nH = nVal * nScale; svg += `<rect x="${xStart}" y="${nY - nH}" width="${xEnd - xStart}" height="${nH}" fill="rgba(231, 76, 60, 0.15)" stroke="#e74c3c" stroke-width="1" /><text x="${(xStart + xEnd) / 2}" y="${nY - nH - 5}" font-size="10" text-anchor="middle" fill="#c0392b">${fmt(nVal)}</text>`; }
        const mL_mid = fs.stressData.M_long_mid_Nmm / 1e6, mS_mid = (fs.stressData.M_short_end_Nmm || 0) / 2, mS_end = (fs.stressData.M_short_end_Nmm || 0) / 1e6;
        let mPathTotal = `M ${xStart} ${mY + mS_end * mScale}`;
        for (let i = 1; i <= 20; i++) { const localX = (spanL * i) / 20, factorML = 4 * (localX / spanL) * (1 - localX / spanL), factorMS = (localX <= spanL / 2) ? (2 * localX / spanL) : (2 * (1 - localX / spanL)), val = (mL_mid * factorML) + (mS_mid * factorMS) - (mS_end * (1 - factorMS)); mPathTotal += ` L ${toX(currentPosM + localX)} ${mY + val * mScale}`; }
        svg += `<path d="${mPathTotal}" fill="none" stroke="#2980b9" stroke-width="2" /><text x="${(xStart + xEnd) / 2}" y="${mY + (mL_mid + mS_mid) * mScale + 12}" font-size="10" text-anchor="middle" fill="#2980b9">${fmt(mL_mid + mS_mid)}</text>`;
        if (idx === 0) svg += `<text x="${xStart}" y="${mY - mS_end * mScale - 5}" font-size="9" text-anchor="start" fill="#2980b9">-${fmt(mS_end)}</text>`;
        svg += `<text x="${xEnd}" y="${mY - mS_end * mScale - 5}" font-size="9" text-anchor="end" fill="#2980b9">-${fmt(mS_end)}</text>`;
        const qL = fs.stressData.Q_long_N / 1e3, qS = fs.stressData.Qe_N / 1e3, qTotal = qL + qS, qH1 = qTotal * qScale, qH2 = -qTotal * qScale;
        svg += `<path d="M ${xStart} ${qY} L ${xStart} ${qY - qH1} L ${xEnd} ${qY - qH2} L ${xEnd} ${qY} Z" fill="rgba(155, 89, 182, 0.15)" stroke="#8e44ad" stroke-width="1.5" /><text x="${xStart + 3}" y="${qY - qH1 - 5}" font-size="10" text-anchor="start" fill="#8e44ad">${fmt(qTotal)}</text><text x="${xEnd - 3}" y="${qY - qH2 + 12}" font-size="10" text-anchor="end" fill="#8e44ad">-${fmt(qTotal)}</text>`;
        currentPosM += spanL;
    });
    svg += `</svg>`;
    return svg;
}

/**
 * 連続梁構造計算書HTML生成
 */
export function generateContinuousBeamReportHtml(beam) {
    if (!beam || !beam.spans || beam.spans.length === 0) return '<p>計算データがありません。</p>';
    const fmt = (v, d = 2) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(d) : '-';
    const fmtR = (r) => { if (!isFinite(r)) return '-'; const ok = r <= 1.0; return `<span style="color:${ok ? '#27ae60' : '#e74c3c'}; font-weight:bold;">${(r * 100).toFixed(1)}% ${ok ? 'OK' : 'NG'}</span>`; };
    let html = `<div class="beam-report-container" style="color:#2c3e50; font-family:'Meiryo',sans-serif; padding:10px;"><div style="margin-bottom:30px; background:#fff; border:1px solid #ddd; border-radius:8px; padding:15px; box-shadow:0 2px 4px rgba(0,0,0,0.05);"><div style="font-weight:bold; border-left:4px solid #2980b9; padding-left:10px; margin-bottom:15px; font-size:16px;">■ 基礎梁の断面と配筋の検定 (N・M・Q図)</div>${generateBeamNMQSvg(beam)}</div><div style="display:grid; grid-template-columns: 1fr; gap:25px;"><section><div style="font-weight:bold; margin-bottom:10px; font-size:14px; background:#f8f9fa; padding:5px 10px; border-left:4px solid #34495e;">① 節点応力 (水平時引抜力)</div><table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid #bdc3c7;"><tr style="background:#34495e; color:#fff;"><th style="border:1px solid #bdc3c7; padding:8px;">節点No.</th><th style="border:1px solid #bdc3c7; padding:8px;">種別 / 位置</th><th style="border:1px solid #bdc3c7; padding:8px;">引抜力 N (kN)</th><th style="border:1px solid #bdc3c7; padding:8px;">備考</th></tr>${beam.spans.map((s, i) => `<tr><td style="border:1px solid #bdc3c7; padding:8px; text-align:center;">${i+1}</td><td style="border:1px solid #bdc3c7; padding:8px;">${s.startNode.type === 'pillar' ? '柱位置' : '交差/端点'}: <strong>${getGridNameFromCoords(s.startNode.x, s.startNode.y)}</strong></td><td style="border:1px solid #bdc3c7; padding:8px; text-align:right; font-weight:bold; color:#e74c3c;">${fmt(Math.abs(s.fdStress?.leftPat?.Td_kN || 0), 2)}</td><td style="border:1px solid #bdc3c7; padding:8px; color:#7f8c8d; font-size:11px;">${i === 0 ? '始端部' : `中間節点`}</td></tr>`).join('')}<tr><td style="border:1px solid #bdc3c7; padding:8px; text-align:center;">${beam.spans.length + 1}</td><td style="border:1px solid #bdc3c7; padding:8px;">終端点: <strong>${getGridNameFromCoords(beam.spans[beam.spans.length-1].endNode.x, beam.spans[beam.spans.length-1].endNode.y)}</strong></td><td style="border:1px solid #bdc3c7; padding:8px; text-align:right; font-weight:bold; color:#e74c3c;">${fmt(Math.abs(beam.spans[beam.spans.length - 1].fdStress?.leftPat?.lastTd_kN || 0), 2)}</td><td style="border:1px solid #bdc3c7; padding:8px; color:#7f8c8d; font-size:11px;">終端部</td></tr></table></section><section><div style="font-weight:bold; margin-bottom:10px; font-size:14px; background:#f8f9fa; padding:5px 10px; border-left:4px solid #34495e;">② 設計応力 (長期・短期組み合わせ)</div><table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid #bdc3c7; text-align:center;"><tr style="background:#34495e; color:#fff;"><th rowspan="2" style="border:1px solid #bdc3c7; padding:8px;">柱間</th><th rowspan="2" style="border:1px solid #bdc3c7; padding:8px;">長さ(m)</th><th colspan="2" style="border:1px solid #bdc3c7; padding:8px;">長期 (L)</th><th colspan="2" style="border:1px solid #bdc3c7; padding:8px;">短期 左加力 (S L)</th><th colspan="2" style="border:1px solid #bdc3c7; padding:8px;">短期 右加力 (S R)</th></tr><tr style="background:#ecf0f1; color:#333;"><th style="border:1px solid #bdc3c7; padding:5px;">中央 M</th><th style="border:1px solid #bdc3c7; padding:5px;">せん断 Q</th><th style="border:1px solid #bdc3c7; padding:5px;">端部 M</th><th style="border:1px solid #bdc3c7; padding:5px;">せん断 Q</th><th style="border:1px solid #bdc3c7; padding:5px;">端部 M</th><th style="border:1px solid #bdc3c7; padding:5px;">せん断 Q</th></tr>${beam.spans.map((s, i) => `<tr><td style="border:1px solid #bdc3c7; padding:8px; font-weight:bold;">${i+1}</td><td style="border:1px solid #bdc3c7; padding:8px;">${fmt(s.spanLength/1000, 2)}</td><td style="border:1px solid #bdc3c7; padding:8px;">${fmt(s.fdStress?.stressData?.M_long_mid_Nmm/1e6)}</td><td style="border:1px solid #bdc3c7; padding:8px;">${fmt(s.fdStress?.stressData?.Q_long_N/1e3)}</td><td style="border:1px solid #bdc3c7; padding:8px; background:#fdf9f9;">${fmt((s.fdStress?.stressData?.M_long_end_Nmm + (s.fdStress?.leftPat?.Mwf_kNm || 0)*1e6)/1e6)}</td><td style="border:1px solid #bdc3c7; padding:8px; background:#fdf9f9;">${fmt((s.fdStress?.stressData?.Q_long_N + (s.fdStress?.leftPat?.Qe_kN || 0)*1e3)/1e3)}</td><td style="border:1px solid #bdc3c7; padding:8px; background:#f9fdfa;">${fmt((s.fdStress?.stressData?.M_long_end_Nmm + (s.fdStress?.rightPat?.Mwf_kNm || 0)*1e6)/1e6)}</td><td style="border:1px solid #bdc3c7; padding:8px; background:#f9fdfa;">${fmt((s.fdStress?.stressData?.Q_long_N + (s.fdStress?.rightPat?.Qe_kN || 0)*1e3)/1e3)}</td></tr>`).join('')}</table></section><section><div style="font-weight:bold; margin-bottom:10px; font-size:14px; background:#f8f9fa; padding:5px 10px; border-left:4px solid #34495e;">③ 断面定数・許容耐力</div><table style="width:100%; border-collapse:collapse; font-size:11px; border:1px solid #bdc3c7; text-align:center;"><tr style="background:#34495e; color:#fff;"><th style="border:1px solid #bdc3c7; padding:8px;">Span</th><th style="border:1px solid #bdc3c7; padding:8px;">幅</th><th style="border:1px solid #bdc3c7; padding:8px;">高さ</th><th style="border:1px solid #bdc3c7; padding:8px;">上端主筋</th><th style="border:1px solid #bdc3c7; padding:8px;">下端主筋</th><th style="border:1px solid #bdc3c7; padding:8px;">スターラップ</th><th style="border:1px solid #bdc3c7; padding:8px;">断面積 (mm²)</th><th style="border:1px solid #bdc3c7; padding:8px;">ピッチ</th></tr>${beam.spans.map((s, i) => { const p = s.props || beam.props; const c = s.fdStress?.cap; return `<tr><td style="border:1px solid #bdc3c7; padding:8px; font-weight:bold;">${i+1}</td><td style="border:1px solid #bdc3c7; padding:8px;">${p.width}</td><td style="border:1px solid #bdc3c7; padding:8px;">${p.height}</td><td style="border:1px solid #bdc3c7; padding:8px;">${p.topRebar}</td><td style="border:1px solid #bdc3c7; padding:8px;">${p.bottomRebar}</td><td style="border:1px solid #bdc3c7; padding:8px;">${p.stirrup}</td><td style="border:1px solid #bdc3c7; padding:8px;">${fmt(c?.botRebar?.area, 1)}</td><td style="border:1px solid #bdc3c7; padding:8px;">${c?.st?.pitch || '-'}</td></tr>`; }).join('')}</table></section><section style="background:#fcfcfc; border:1px solid #bdc3c7; padding:15px; border-radius:4px;"><div style="font-weight:bold; margin-bottom:10px; font-size:14px; color:#2c3e50;">④ 断面判定 (検定比)</div><table style="width:100%; border-collapse:collapse; font-size:12px; border:2px solid #34495e; text-align:center; background:#fff;"><tr style="background:#34495e; color:#fff;"><th style="border:1px solid #bdc3c7; padding:10px;">Span No.</th><th style="border:1px solid #bdc3c7; padding:10px;">曲げ (長期)</th><th style="border:1px solid #bdc3c7; padding:10px;">せん断 (長期)</th><th style="border:1px solid #bdc3c7; padding:10px;">曲げ (短期)</th><th style="border:1px solid #bdc3c7; padding:10px;">せん断 (短期)</th><th style="border:1px solid #bdc3c7; padding:10px;">判定</th></tr>${beam.spans.map((s, i) => `<tr style="${s.isNG ? 'background:#fef5f5;' : ''}"><td style="border:1px solid #bdc3c7; padding:10px; font-weight:bold;">Span ${i+1}</td><td style="border:1px solid #bdc3c7; padding:10px;">${fmtR(s.fdStress?.ratioM_L)}</td><td style="border:1px solid #bdc3c7; padding:10px;">${fmtR(s.fdStress?.ratioQ_L)}</td><td style="border:1px solid #bdc3c7; padding:10px;">${fmtR(s.fdStress?.ratioM_S)}</td><td style="border:1px solid #bdc3c7; padding:10px;">${fmtR(s.fdStress?.ratioQ_S)}</td><td style="border:1px solid #bdc3c7; padding:10px;"><span style="background:${s.isNG ? '#e74c3c' : '#27ae60'}; color:#fff; padding:4px 12px; border-radius:15px; font-size:12px; font-weight:bold; box-shadow:0 1px 3px rgba(0,0,0,0.1);">${s.isNG ? 'NG' : 'OK'}</span></td></tr>`).join('')}</table></section></div></div>`;
    return html;
}

/**
 * スラブ断面検定レポートHTML
 */
export function getFoundationSlabReportHtml(slab) {
    if (!slab || !slab.fdStress) return '<p style="color:#888;">検定データなし</p>';
    const s = slab.fdStress;
    const fmt = (v, d = 2) => v != null ? v.toFixed(d) : '—';
    const fmtR = (r) => { const ok = r <= 1.0; return `<span style="color:${ok ? '#27ae60' : '#e74c3c'};font-weight:bold;">${(r * 100).toFixed(1)}% ${ok ? 'OK' : 'NG'}</span>`; };
    if (slab.props && slab.props.support === '片持ち') {
        return `<div style="background:#fef9e7; border:1px solid #f1c40f; border-radius:4px; padding:8px; font-size:11px;"><div style="font-weight:bold; color:#7d6608; border-bottom:1px solid #f1c40f; margin-bottom:5px;">📋 片持ちスラブ断面検定</div><table style="width:100%; border-collapse:collapse;"><tr><td>接地圧 q</td><td style="text-align:right; font-weight:bold;">${fmt(s.qTotal, 2)}</td><td>kN/㎡</td></tr><tr><td>片持ち長さ L</td><td style="text-align:right; font-weight:bold;">${fmt(s.cantileverLength, 2)}</td><td>m</td></tr><tr style="background:#eee;"><td colspan="3" style="font-weight:bold; height:1px;"></td></tr><tr style="font-size:10px; color:#666;"><td colspan="3">算定式: M = 1/2 ・ q ・ L²</td></tr><tr><td>モーメント M</td><td colspan="2" style="text-align:right; font-weight:bold;">${fmt(s.Mx_center, 2)} kN・m/m</td></tr><tr><td>許容耐力 Ma</td><td colspan="2" style="text-align:right; font-weight:bold;">${fmt(s.Ma_short, 2)} kN・m/m</td></tr><tr style="font-size:9px; color:#888;"><td colspan="3">(※短辺配筋を主筋として計算)</td></tr><tr style="background:#eee;"><td colspan="3" style="font-weight:bold; height:1px;"></td></tr><tr><td>検定比 M/Ma</td><td colspan="2" style="text-align:right;">${fmtR(s.ratioShort)}</td></tr></table></div>`;
    }
    return `<div style="background:#f8f9fa; border:1px solid #ddd; border-radius:4px; padding:8px; font-size:11px;"><div style="font-weight:bold; color:#2c3e50; border-bottom:1px solid #ccc; margin-bottom:5px;">📋 断面検定結果</div><table style="width:100%; border-collapse:collapse;"><tr><td>総接地圧 q</td><td style="text-align:right; font-weight:bold;">${fmt(s.qTotal, 2)}</td><td>kN/㎡</td></tr><tr style="font-size:10px; color:#666;"><td colspan="3">(建物:${fmt(s.avgBuildingPressure, 1)} + 自重:${fmt(s.wSelf, 1)} + 積載:${fmt(s.wLive, 1)})</td></tr><tr style="background:#eee;"><td colspan="3" style="font-weight:bold; height:1px;"></td></tr><tr><td>短辺 M/Ma</td><td colspan="2" style="text-align:right;">${fmt(Math.max(s.Mx_center, s.Mx_end), 2)} / ${fmt(s.Ma_short, 2)}</td></tr><tr><td>短辺 判定</td><td colspan="2" style="text-align:right;">${fmtR(s.ratioShort)}</td></tr><tr style="background:#eee;"><td colspan="3" style="font-weight:bold; height:1px;"></td></tr><tr><td>長辺 M/Ma</td><td colspan="2" style="text-align:right;">${fmt(Math.max(s.My_center, s.My_end), 2)} / ${fmt(s.Ma_long, 2)}</td></tr><tr><td>長辺 判定</td><td colspan="2" style="text-align:right;">${fmtR(s.ratioLong)}</td></tr></table></div>`;
}
