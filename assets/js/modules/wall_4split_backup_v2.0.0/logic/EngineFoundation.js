/**
 * EngineFoundation.js
 * 基礎（梁・スラブ）の応力解析、解析、検定ロジックを独立させたモジュール
 */

import { polygonArea, isPointInPolygon } from './MathUtils.js';
import { fd_parseRebar, fd_parseStirrups, fd_getSteelStrength, fd_getConcreteAllowable } from './Parsers.js';

/**
 * 基礎梁の許容耐力計算
 */
export function calculateAllowableBeamCapacity(beam, stressData = {}) {
    const p = beam.props || {};
    const b  = p.width  || 150;
    const h  = p.height || 640;
    const dt = p.coverDepth || 70;
    const d  = h - dt;
    const j  = d * 7 / 8;

    const fcVal = window.AppState.concreteFc || 21;
    const conc = fd_getConcreteAllowable(fcVal);

    const topRebarStr = p.topRebar    || '1-D13';
    const botRebarStr = p.bottomRebar || '1-D13';
    const stStr       = p.stirrup     || '1-D10@200';

    const topRebar = fd_parseRebar(topRebarStr);
    const botRebar = fd_parseRebar(botRebarStr);
    const st       = fd_parseStirrups(stStr);

    const topSteel = fd_getSteelStrength(topRebarStr);
    const botSteel = fd_getSteelStrength(botRebarStr);
    const stSteel  = fd_getSteelStrength(stStr);

    const lMa_t = topRebar.area * topSteel.ft * j;
    const lMa_b = botRebar.area * botSteel.ft * j;
    const sMa_t = lMa_t * 1.5;
    const sMa_b = lMa_b * 1.5;

    const ML = Math.abs(stressData.M_long_end_Nmm || 0);
    const QL = Math.abs(stressData.Q_long_N || 0);
    let m_qd_L = (QL * d > 0) ? ML / (QL * d) : 1.0;
    const alpha_L = Math.max(1.0, Math.min(2.0, 4 / (m_qd_L + 1)));

    const MS_sum = Math.abs((stressData.M_long_end_Nmm || 0) + (stressData.M_short_end_Nmm || 0) - (stressData.Mwf_Nmm || 0));
    const QS_sum = Math.abs((stressData.Q_long_N || 0) + (stressData.Qe_N || 0));
    let m_qd_S = (QS_sum * d > 0) ? MS_sum / (QS_sum * d) : 1.0;
    const alpha_S = Math.max(1.0, Math.min(2.0, 4 / (m_qd_S + 1)));

    const pw = (b * st.pitch) > 0 ? st.area / (b * st.pitch) : 0;
    const Qa_steel_L = st.area * (stSteel.fts / 1.5) * j / st.pitch;
    const Qa_steel_S = Qa_steel_L * 1.5;

    const lQa = (alpha_L * conc.fwk_L * b * j) + Qa_steel_L;
    const sQa = (alpha_S * conc.fwk_L * b * j * 1.5) + Qa_steel_S;

    return {
        b, h, d, j, dt, pw,
        lMa_t, lMa_b, sMa_t, sMa_b, lQa, sQa,
        topRebar, botRebar, st,
        fc: fcVal, botSteelType: botSteel.type, stSteelType: stSteel.type,
        alpha_L, alpha_S, m_qd_L, m_qd_S,
        Ma_L: lMa_b, Ma_S: sMa_b, Qa_L: lQa, Qa_S: sQa, At: botRebar.area
    };
}

/**
 * 長期応力解析
 */
export function generateFoundationLongTermStressTable(beam, allSlabs, allBeams) {
    const p = beam.props || {};
    const dx = beam.p2.x - beam.p1.x;
    const dy = beam.p2.y - beam.p1.y;
    const L_mm = Math.hypot(dx, dy);
    if (L_mm < 1) return null;

    let beamTotalLoad_kN = 0;
    let totalTribArea_m2 = 0;
    (allSlabs || []).forEach(slab => {
        const qSlab = slab.fdStress ? slab.fdStress.qTotal : 12.0;
        (slab.tributaryPolygons || []).forEach(tp => {
            if (tp.beamId === beam.id) {
                const area_m2 = tp.area / 1e6;
                beamTotalLoad_kN += qSlab * area_m2;
                totalTribArea_m2 += area_m2;
            }
        });
    });

    const spanM_geom = L_mm / 1000;
    let wL_kN_m = spanM_geom > 0 ? beamTotalLoad_kN / spanM_geom : 0;
    
    const tributaryWidth_m = spanM_geom > 0 ? totalTribArea_m2 / spanM_geom : 0;
    const qTotal           = totalTribArea_m2 > 0 ? beamTotalLoad_kN / totalTribArea_m2 : 0;
    
    const slabTopH = p.slabTopHeight || 50;
    const selfWeight_kN_m = (p.width || 150) * ((p.height || 640) - slabTopH) / 1e6 * 24;
    wL_kN_m += selfWeight_kN_m;

    const spanM = spanM_geom;

    const M_mid_kNm = (wL_kN_m * spanM * spanM) / 8;
    const M_end_kNm = (wL_kN_m * spanM * spanM) / 12;
    const Q_max_kN  = (wL_kN_m * spanM) / 2;

    return {
        L_mm, spanM, wL_kN_m, tributaryWidth_m,
        totalTribArea_m2, qTotal,
        M_mid_kNm, M_end_kNm, Q_max_kN,
        M_mid_Nmm: M_mid_kNm * 1e6,
        M_end_Nmm: M_end_kNm * 1e6,
        Q_L_N:   Q_max_kN  * 1e3,
        M_max_kNm: Math.max(M_mid_kNm, M_end_kNm), 
        M_max_Nmm: Math.max(M_mid_kNm, M_end_kNm) * 1e6, 
        Q_max_N: Q_max_kN * 1e3
    };
}

/**
 * 短期（水平力）応力解析
 */
export function calculateFoundationHorizontalStressData(beam, walls, h1) {
    if (!beam || !beam.spans || beam.spans.length === 0) return null;
    const h_eff = Number(h1) || 2800;

    let nodes = [];
    let currentX = 0;
    nodes.push({ x: 0, node: beam.spans[0].startNode, Td_base: 0 });
    beam.spans.forEach(s => {
        currentX += (Number(s.spanLength) || 0);
        nodes.push({ x: currentX, node: s.endNode, Td_base: 0 });
    });
    const L_total = currentX;

    nodes.forEach(n => {
        if (n.node) {
            const TOL = 15;
            const nodeX = Number(n.node.x);
            const nodeY = Number(n.node.y);
            
            const connectedWalls = (walls || []).filter(w => 
                w.floor === '1F' && (
                    Math.hypot(Number(w.p1.x) - nodeX, Number(w.p1.y) - nodeY) < TOL || 
                    Math.hypot(Number(w.p2.x) - nodeX, Number(w.p2.y) - nodeY) < TOL
                )
            );
            
            connectedWalls.forEach(w => {
                const alpha = Number(w.totalVal) || Number(w.outPanelVal || 0) + Number(w.inPanelVal || 0) + Number(w.braceVal || 0) || 0;
                if (alpha > 0) {
                    const dx_w = Math.abs(Number(w.p1.x) - Number(w.p2.x));
                    const dy_w = Math.abs(Number(w.p1.y) - Number(w.p2.y));
                    const Lw = Math.hypot(dx_w, dy_w) / 1000;
                    if (Lw < 0.1) return;
                    const N = (alpha * 1.96 * Lw) * h_eff / Lw;
                    const isP1 = Math.hypot(Number(w.p1.x) - nodeX, Number(w.p1.y) - nodeY) < TOL;
                    n.Td_base_list = n.Td_base_list || [];
                    n.Td_base_list.push({
                        N: N,
                        isStart: isP1,
                        isLeftRel: isP1 ? (Number(w.p1.x) < Number(w.p2.x) || Number(w.p1.y) < Number(w.p2.y)) : (Number(w.p2.x) < Number(w.p1.x) || Number(w.p2.y) < Number(w.p1.y))
                    });
                }
            });
        }
    });

    const analyzePattern = (isLeftLoading) => {
        let Td = nodes.map(n => {
            let sum = 0;
            (n.Td_base_list || []).forEach(w => {
                let sign = w.isLeftRel ? 1 : -1;
                if (!isLeftLoading) sign *= -1;
                sum += (w.N * sign);
            });
            return sum;
        });
        let sumM = 0;
        nodes.forEach((n, i) => { sumM += Td[i] * n.x; });
        const N_end = L_total > 0 ? sumM / L_total : 0;
        const R_start = -N_end;
        let Qe = [];
        let Mwf = [];
        let currentQe = R_start;
        let currentMwf = 0;
        currentQe += Td[0];
        for (let i = 0; i < beam.spans.length; i++) {
            Qe.push(currentQe);
            Mwf.push(currentMwf);
            const interval = beam.spans[i].spanLength;
            currentMwf += (currentQe * interval / 1000);
            currentQe += Td[i + 1];
        }
        return { Td, R_start, N_end, Qe, Mwf };
    };

    const left = analyzePattern(true);
    const right = analyzePattern(false);
    return { left, right, spanM: L_total / 1000 };
}

/**
 * 全基礎梁の解析実行
 */
export function runFoundationBeamAnalysis(beams, slabs) {
    if (!beams || beams.length === 0) return;
    const h1 = (typeof getVal === 'function' ? getVal('n-h1') : 2.7) || 2.7;
    const walls = window.AppState.walls || [];

    (beams || []).forEach(beam => {
        const lt_total = generateFoundationLongTermStressTable(beam, slabs, beams);
        if (!lt_total) { beam.spans = []; beam.fdStress = null; return; }
        const st_total = calculateFoundationHorizontalStressData(beam, walls, h1);
        let beamIsNG = false;
        const wL_kN_m = lt_total.wL_kN_m;

        if (beam.spans && beam.spans.length > 0) {
            beam.spans.forEach((span, i) => {
                const sL_mm = span.spanLength || 0;
                const spanM = sL_mm / 1000;
                const sM_long_mid_kNm = (wL_kN_m * spanM * spanM) / 8;
                const sM_long_end_kNm = (wL_kN_m * spanM * spanM) / 12;
                const sQ_long_kNm = (wL_kN_m * spanM) / 2;
                const stressData = {
                    M_long_mid_Nmm: sM_long_mid_kNm * 1e6,
                    M_long_end_Nmm: sM_long_end_kNm * 1e6,
                    Q_long_N: sQ_long_kNm * 1e3
                };
                const stL = st_total ? st_total.left : null;
                const stR = st_total ? st_total.right : null;
                const Qe_max_N = Math.max(stL ? Math.abs(stL.Qe[i] * 1000) : 0, stR ? Math.abs(stR.Qe[i] * 1000) : 0);
                const Mwf_max_Nmm = Math.max(stL ? Math.abs(stL.Mwf[i] * 1e6) : 0, stR ? Math.abs(stR.Mwf[i] * 1e6) : 0);
                stressData.Qe_N = Qe_max_N;
                stressData.Mwf_Nmm = Mwf_max_Nmm;
                stressData.M_short_end_Nmm = Mwf_max_Nmm;
                const spProps = span.props || beam.props;
                const cap = calculateAllowableBeamCapacity({ props: spProps }, stressData);
                const ratioM_L = Math.max(stressData.M_long_mid_Nmm / cap.lMa_b, stressData.M_long_end_Nmm / cap.lMa_t);
                const ratioQ_L = stressData.Q_long_N / cap.lQa;
                const M_short_mid_Nmm = Mwf_max_Nmm / 2;
                const ratioM_S = Math.max((stressData.M_long_mid_Nmm + M_short_mid_Nmm) / cap.sMa_b, (stressData.M_long_end_Nmm + stressData.M_short_end_Nmm) / cap.sMa_t);
                const ratioQ_S = (stressData.Q_long_N + stressData.Qe_N) / cap.sQa;
                const isNG = (ratioM_L > 1.0 || ratioQ_L > 1.0 || ratioM_S > 1.0 || ratioQ_S > 1.0);
                if (isNG) beamIsNG = true;
                span.fdStress = { spanM, wL_kN_m, stressData, leftPat: stL ? {Td_kN: stL.Td[i], Qe_kN: stL.Qe[i], Mwf_kNm: stL.Mwf[i]} : null, rightPat: stR ? {Td_kN: stR.Td[i], Qe_kN: stR.Qe[i], Mwf_kNm: stR.Mwf[i]} : null, cap, ratioM_L, ratioQ_L, ratioM_S, ratioQ_S, isNG };
                if (i === beam.spans.length - 1) {
                    if (stL) span.fdStress.leftPat.lastTd_kN = stL.Td[i+1];
                    if (stR) span.fdStress.rightPat.lastTd_kN = stR.Td[i+1];
                }
                span.isNG = isNG;
            });
        }
        beam.isNG = beamIsNG;
        if (beam.spans && beam.spans[0]) { beam.fdStress = beam.spans[0].fdStress; }
    });
}

const FD_SLAB_COEFFS = {
    '4辺固定':                     { mcx: 0.025, max: 0.045, mcy: 0.015, may: 0.035 },
    '3辺固定1辺ピン（長辺ピン）':  { mcx: 0.035, max: 0.055, mcy: 0.020, may: 0.040 },
    '3辺固定1辺ピン（短辺ピン）':  { mcx: 0.040, max: 0.065, mcy: 0.025, may: 0.050 },
    '2隣辺固定2隣辺ピン':          { mcx: 0.045, max: 0.075, mcy: 0.035, may: 0.065 },
    '長辺2辺固定短辺2辺ピン':      { mcx: 0.060, max: 0.090, mcy: 0.030, may: 0.000 },
    '短辺2辺固定長辺2辺ピン':      { mcx: 0.030, max: 0.000, mcy: 0.060, may: 0.090 },
    '1辺固定3辺ピン（長辺固定）':  { mcx: 0.065, max: 0.100, mcy: 0.040, may: 0.000 },
    '1辺固定3辺ピン（短辺固定）':  { mcx: 0.050, max: 0.000, mcy: 0.075, may: 0.110 },
    '4辺ピン':                     { mcx: 0.080, max: 0.000, mcy: 0.050, may: 0.000 }
};

/**
 * スラブ解析
 */
export function calculateFoundationSlabAnalysis(slabs, avgBuildingPressure) {
    if (!slabs || slabs.length === 0) return;
    slabs.forEach(slab => {
        const p = slab.props || {};
        const D = p.slabThickness || 150;
        const dt = p.coverDepth || 70;
        const topH = p.slabTopHeight || 50;
        const bp = Number(avgBuildingPressure) || 0;
        const wSelf = Number(((Number(D) + Number(topH)) / 1000) * 24.0) || 0;
        const wLive = 1.3;
        const qTotal = bp + wSelf + wLive;
        p.groundPressure = qTotal;
        const bounds = getSlabBounds(slab); 
        const lx = Math.min(bounds.width, bounds.height) / 1000;
        const ly = Math.max(bounds.width, bounds.height) / 1000;
        const lambda = ly / lx;

        if (p.support === '片持ち') {
            const L = Number(p.cantileverLength) || 0.9;
            const Mx_center = 0.5 * qTotal * (L ** 2);
            const d = D - dt;
            const j = d * (7/8);
            const steelShort = fd_getSteelStrength(p.rebarShort?.type || 'D13');
            const Ma_short = steelShort.ft * (p.rebarShort?.at || 0) * j / 1e6;
            const ratioShort = Mx_center / (Ma_short || 1);
            slab.fdStress = { qTotal, wSelf, wLive, avgBuildingPressure, cantileverLength: L, Mx_center, Ma_short, ratioShort, isNG: (ratioShort > 1.0) };
        } else {
            const coeffs = FD_SLAB_COEFFS[p.support] || FD_SLAB_COEFFS['4辺固定'];
            const lambdaFactor = Math.min(1.0, 1.5 / lambda); 
            const Mx_center = coeffs.mcx * qTotal * (lx ** 2);
            const Mx_end    = coeffs.max * qTotal * (lx ** 2);
            const My_center = coeffs.mcy * qTotal * (lx ** 2) * lambdaFactor;
            const My_end    = coeffs.may * qTotal * (lx ** 2) * lambdaFactor;
            const d = D - dt;
            const j = d * (7/8);
            const steelShort = fd_getSteelStrength(p.rebarShort?.type || 'D13');
            const steelLong  = fd_getSteelStrength(p.rebarLong?.type || 'D13');
            const Ma_short = steelShort.ft * (p.rebarShort?.at || 0) * j / 1e6;
            const Ma_long  = steelLong.ft  * (p.rebarLong?.at || 0)  * j / 1e6;
            const ratioShort = Math.max(Mx_center, Mx_end) / (Ma_short || 1);
            const ratioLong  = Math.max(My_center, My_end) / (Ma_long || 1);
            slab.fdStress = { qTotal, wSelf, wLive, avgBuildingPressure, lx, ly, lambda, Mx_center, Mx_end, My_center, My_end, Ma_short, Ma_long, ratioShort, ratioLong, isNG: (ratioShort > 1.0 || ratioLong > 1.0) };
        }
    });
}

function getSlabBounds(slab) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    slab.vertices.forEach(v => {
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    });
    return { width: maxX - minX, height: maxY - minY };
}
