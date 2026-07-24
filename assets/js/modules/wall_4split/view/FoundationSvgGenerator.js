/**
 * view/FoundationSvgGenerator.js - Pure SVG Generation Engine for Foundation Stress & Tributary Charts
 * v3.2.0 Refactoring: Single Responsibility Principle & Pure View Component
 */

window.FoundationSvgGenerator = {
    /**
     * N・M・Q 応力図 SVG生成
     */
    generateBeamNMQSvg: function(beam) {
        if (!beam || !beam.fdStress || !beam.fdStress.pillars || beam.fdStress.pillars.length === 0) {
            return `<div style="font-size:11px; color:#888; text-align:center; padding:30px; border:1px dashed #ccc; border-radius:4px;">(応力解析データなし)</div>`;
        }

        const pillars = beam.fdStress.pillars;
        const spans = beam.fdStress.spans || [];
        const seismic = beam.fdStress.seismic || { leftward: { Td:[], Qe:[], Mf:[] }, rightward: { Td:[], Qe:[], Mf:[] } };

        const width = 650;
        const height = 450;
        const padX = 50;
        const padY = 30;
        const chartWidth = width - padX * 2;
        const h = 75;
        const spacing = 45;

        const minX = 0;
        const maxX = Math.max(1, ...pillars.map(p => p.x ?? 0));
        const rangeX = maxX - minX || 1;
        const getX = (x) => padX + ((x - minX) / rangeX) * chartWidth;

        let maxTd = 0.1, maxM = 0.1, maxQ = 0.1;
        pillars.forEach((p, idx) => {
            maxTd = Math.max(maxTd, Math.abs(seismic.leftward.Td?.[idx] || 0), Math.abs(seismic.rightward.Td?.[idx] || 0));
        });
        spans.forEach((span, sIdx) => {
            maxM = Math.max(maxM, Math.abs(span.M_mid || 0), Math.abs(span.M_end || 0));
            maxM = Math.max(maxM, Math.abs(seismic.leftward.Mf?.[sIdx] || 0), Math.abs(seismic.leftward.Mf?.[sIdx + 1] || 0));
            maxM = Math.max(maxM, Math.abs(seismic.rightward.Mf?.[sIdx] || 0), Math.abs(seismic.rightward.Mf?.[sIdx + 1] || 0));
            maxQ = Math.max(maxQ, Math.abs(span.Q_L || 0), Math.abs(span.leftward?.Q || 0), Math.abs(span.rightward?.Q || 0));
        });

        const getFreshPillarName = (p) => {
            if (!p) return '支点';
            const px = p.globalX ?? (p.x * 1000) ?? 0;
            const py = p.globalY ?? (p.y * 1000) ?? 0;
            const gridName = window.getGridNameAt ? window.getGridNameAt(px, py) : null;
            const isDefault = !p.name || /^(P|M)_?(P|M)?\d+$/i.test(p.name) || p.name.toLowerCase().startsWith('pillar') || p.name === `P_${p.id}` || p.name === p.id || p.name.startsWith('支点') || (p.id && String(p.id).startsWith('support'));
            return isDefault ? (gridName || p.name || `P_${p.id}`) : p.name;
        };

        const svgHeight = padY + (h + spacing) * 3 + 30;
        let svg = `<svg width="100%" height="${svgHeight}" viewBox="0 0 ${width} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; margin:10px 0;">`;

        // 1. 引抜力図 N (Td: kN)
        let y1 = padY + 30;
        svg += `<g class="chart-axial">
            <text x="${padX}" y="${y1 - 35}" font-size="11" font-weight="bold" fill="#1e293b">■ 節点引抜力図 Td (kN)</text>
            <line x1="${padX - 10}" y1="${y1}" x2="${width - padX + 10}" y2="${y1}" stroke="#94a3b8" stroke-width="1.5" />
        `;
        pillars.forEach((p, idx) => {
            const px = getX(p.x);
            const l_val = seismic.leftward.Td?.[idx] || 0;
            const r_val = seismic.rightward.Td?.[idx] || 0;
            const ly = y1 - (l_val / maxTd) * 35;
            const ry = y1 - (r_val / maxTd) * 35;
            const pname = getFreshPillarName(p);

            svg += `<line x1="${px}" y1="${y1 - 5}" x2="${px}" y2="${y1 + 5}" stroke="#cbd5e1" stroke-width="1" />`;
            svg += `<text x="${px}" y="${y1 + 15}" font-size="8" text-anchor="middle" fill="#64748b" font-weight="bold">${pname}</text>`;

            svg += `<line x1="${px - 3.5}" y1="${y1}" x2="${px - 3.5}" y2="${ly}" stroke="#3b82f6" stroke-width="3" />`;
            svg += `<line x1="${px + 3.5}" y1="${y1}" x2="${px + 3.5}" y2="${ry}" stroke="#f97316" stroke-width="3" />`;

            const yShiftL = (idx % 2 === 0) ? (l_val >= 0 ? -4 : 8) : (l_val >= 0 ? -12 : 16);
            const yShiftR = (idx % 2 === 0) ? (r_val >= 0 ? -4 : 8) : (r_val >= 0 ? -12 : 16);

            if (Math.abs(l_val) > 0.001) {
                svg += `<text x="${px - 6}" y="${ly + yShiftL}" font-size="8" text-anchor="end" fill="#1d4ed8" font-weight="bold">${l_val.toFixed(3)}</text>`;
            }
            if (Math.abs(r_val) > 0.001) {
                svg += `<text x="${px + 6}" y="${ry + yShiftR}" font-size="8" text-anchor="start" fill="#c2410c" font-weight="bold">${r_val.toFixed(3)}</text>`;
            }
        });
        svg += `</g>`;

        // 2. 曲げモーメント図 M (kNm)
        let y2 = y1 + h + spacing;
        svg += `<g class="chart-moment">
            <text x="${padX}" y="${y2 - 35}" font-size="11" font-weight="bold" fill="#1e293b">■ 曲げモーメント図 M (kNm)</text>
            <line x1="${padX - 10}" y1="${y2}" x2="${width - padX + 10}" y2="${y2}" stroke="#94a3b8" stroke-width="1.5" />
        `;
        pillars.forEach((p) => {
            const px = getX(p.x);
            svg += `<line x1="${px}" y1="${y2 - 5}" x2="${px}" y2="${y2 + 5}" stroke="#cbd5e1" stroke-width="1" />`;
        });
        spans.forEach((span, sIdx) => {
            const pLeft = pillars[sIdx];
            const pRight = pillars[sIdx + 1];
            if (!pLeft || !pRight) return;

            const xL = getX(pLeft.x);
            const xR = getX(pRight.x);
            const xMid = (xL + xR) / 2;

            const mE_left = span.M_end_left !== undefined ? span.M_end_left : (span.M_end || 0);
            const mE_right = span.M_end_right !== undefined ? span.M_end_right : (span.M_end || 0);
            const mM = span.M_mid || 0;
            const lt_yLeft = y2 + (mE_left / maxM) * 35;
            const lt_yRight = y2 + (mE_right / maxM) * 35;
            const lt_yMid = y2 + (mM / maxM) * 35;
            svg += `<path d="M ${xL} ${lt_yLeft} Q ${xMid} ${lt_yMid} ${xR} ${lt_yRight}" fill="none" stroke="#10b981" stroke-width="1.5" stroke-dasharray="2,2" />`;

            const l_mL = seismic.leftward?.Mf?.[sIdx] || 0;
            const l_mR = seismic.leftward?.Mf?.[sIdx + 1] || 0;
            const l_yL = y2 + (l_mL / maxM) * 35;
            const l_yR = y2 + (l_mR / maxM) * 35;
            svg += `<line x1="${xL}" y1="${l_yL}" x2="${xR}" y2="${l_yR}" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />`;

            const r_mL = seismic.rightward?.Mf?.[sIdx] || 0;
            const r_mR = seismic.rightward?.Mf?.[sIdx + 1] || 0;
            const r_yL = y2 + (r_mL / maxM) * 35;
            const r_yR = y2 + (r_mR / maxM) * 35;
            svg += `<line x1="${xL}" y1="${r_yL}" x2="${xR}" y2="${r_yR}" stroke="#f97316" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />`;

            const shiftL_blue = (sIdx % 2 === 0) ? -6 : -14;
            const shiftL_orange = (sIdx % 2 === 0) ? 12 : 18;

            if (sIdx === 0) {
                svg += `<text x="${xL}" y="${l_yL + shiftL_blue}" font-size="8" text-anchor="middle" fill="#1d4ed8" font-weight="bold">${l_mL.toFixed(3)}</text>`;
                svg += `<text x="${xL}" y="${r_yL + shiftL_orange}" font-size="8" text-anchor="middle" fill="#c2410c" font-weight="bold">${r_mL.toFixed(3)}</text>`;
            }
            svg += `<text x="${xR}" y="${l_yR + shiftL_blue}" font-size="8" text-anchor="middle" fill="#1d4ed8" font-weight="bold">${l_mR.toFixed(3)}</text>`;
            svg += `<text x="${xR}" y="${r_yR + shiftL_orange}" font-size="8" text-anchor="middle" fill="#c2410c" font-weight="bold">${r_mR.toFixed(3)}</text>`;
        });
        svg += `</g>`;

        // 3. Q図 (せん断力図)
        let y3 = y2 + h + spacing;
        svg += `<g class="chart-shear">
            <text x="${padX}" y="${y3 - 35}" font-size="11" font-weight="bold" fill="#1e293b">■ せん断力図 Q (kN)</text>
            <line x1="${padX - 10}" y1="${y3}" x2="${width - padX + 10}" y2="${y3}" stroke="#94a3b8" stroke-width="1.5" />
        `;
        pillars.forEach((p) => {
            const px = getX(p.x);
            svg += `<line x1="${px}" y1="${y3 - 5}" x2="${px}" y2="${y3 + 5}" stroke="#cbd5e1" stroke-width="1" />`;
        });
        spans.forEach((span, sIdx) => {
            const pLeft = pillars[sIdx];
            const pRight = pillars[sIdx + 1];
            if (!pLeft || !pRight) return;

            const xL = getX(pLeft.x);
            const xR = getX(pRight.x);
            const xMid = (xL + xR) / 2;

            const q_L = span.Q_L || 0;
            const lt_y1 = y3 - (q_L / maxQ) * 35;
            const lt_y2 = y3 + (q_L / maxQ) * 35;
            svg += `<line x1="${xL}" y1="${lt_y1}" x2="${xMid}" y2="${lt_y1}" stroke="#10b981" stroke-width="1" stroke-dasharray="2,2" />`;
            svg += `<line x1="${xMid}" y1="${lt_y1}" x2="${xMid}" y2="${lt_y2}" stroke="#10b981" stroke-width="1" stroke-dasharray="2,2" />`;
            svg += `<line x1="${xMid}" y1="${lt_y2}" x2="${xR}" y2="${lt_y2}" stroke="#10b981" stroke-width="1" stroke-dasharray="2,2" />`;

            const l_q = span.leftward?.Q || 0;
            const l_y = y3 - (l_q / maxQ) * 35;
            svg += `<line x1="${xL}" y1="${l_y}" x2="${xR}" y2="${l_y}" stroke="#3b82f6" stroke-width="1.5" />`;
            if (sIdx > 0) {
                const prev_l_q = spans[sIdx - 1].leftward?.Q || 0;
                const prev_l_y = y3 - (prev_l_q / maxQ) * 35;
                svg += `<line x1="${xL}" y1="${prev_l_y}" x2="${xL}" y2="${l_y}" stroke="#3b82f6" stroke-width="1.5" />`;
            }

            const r_q = span.rightward?.Q || 0;
            const r_y = y3 - (r_q / maxQ) * 35;
            svg += `<line x1="${xL}" y1="${r_y}" x2="${xR}" y2="${r_y}" stroke="#f97316" stroke-width="1.5" />`;
            if (sIdx > 0) {
                const prev_r_q = spans[sIdx - 1].rightward?.Q || 0;
                const prev_r_y = y3 - (prev_r_q / maxQ) * 35;
                svg += `<line x1="${xL}" y1="${prev_r_y}" x2="${xL}" y2="${r_y}" stroke="#f97316" stroke-width="1.5" />`;
            }

            const yShiftQ_blue = (sIdx % 2 === 0) ? -4 : -12;
            const yShiftQ_orange = (sIdx % 2 === 0) ? 12 : 18;

            if (Math.abs(l_q) > 0.001) {
                svg += `<text x="${xMid}" y="${l_y + yShiftQ_blue}" font-size="8" text-anchor="middle" fill="#1d4ed8" font-weight="bold">${l_q.toFixed(3)}</text>`;
            }
            if (Math.abs(r_q) > 0.001) {
                svg += `<text x="${xMid}" y="${r_y + yShiftQ_orange}" font-size="8" text-anchor="middle" fill="#c2410c" font-weight="bold">${r_q.toFixed(3)}</text>`;
            }
        });
        svg += `</g>`;

        // 凡例
        svg += `<g class="legend" transform="translate(${padX}, ${svgHeight - 15})">
            <line x1="0" y1="0" x2="15" y2="0" stroke="#3b82f6" stroke-width="2" />
            <text x="20" y="3" font-size="9" fill="#1e293b">左加力(下加力)</text>
            
            <line x1="100" y1="0" x2="115" y2="0" stroke="#f97316" stroke-width="2" />
            <text x="120" y="3" font-size="9" fill="#1e293b">右加力(上加力)</text>
            
            <line x1="200" y1="0" x2="215" y2="0" stroke="#10b981" stroke-width="1.5" stroke-dasharray="2,2" />
            <text x="220" y="3" font-size="9" fill="#1e293b">長期荷重</text>
        </g>`;

        svg += `</svg>`;
        return svg;
    },

    /**
     * 基礎梁負担図（べた基礎接地圧分担域）SVG生成
     */
    generateFoundationTributarySvg: function(beam, state) {
        const s = state || window.AppState;
        const slabs = s?.foundationSlabs || [];
        const beams = s?.foundationBeams || [];
        if (slabs.length === 0 && beams.length === 0) return '';

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        slabs.forEach(sl => {
            (sl.vertices || []).forEach(v => {
                minX = Math.min(minX, v.x); minY = Math.min(minY, v.y);
                maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y);
            });
        });
        beams.forEach(b => {
            [b.p1, b.p2].forEach(p => {
                if (!p) return;
                minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
            });
        });
        if (!isFinite(minX)) return '';

        const padSvg = 40;
        const svgW = 750, svgH = 500;
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const scaleS = Math.min((svgW - padSvg * 2) / rangeX, (svgH - padSvg * 2) / rangeY);
        const toSx = (x) => padSvg + (x - minX) * scaleS;
        const toSy = (y) => svgH - padSvg - (y - minY) * scaleS;

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" style="background:#fff; border:1px solid #bdc3c7; border-radius:4px; display:block;">\n`;
        svg += `<text x="${svgW/2}" y="18" font-size="13" font-weight="bold" fill="#2c3e50" text-anchor="middle">基礎梁 負担図（スラブ亀甲分割・接地圧分担域）</text>\n`;

        slabs.forEach((slab, si) => {
            if (!slab.vertices || slab.vertices.length < 3) return;
            const pts = slab.vertices.map(v => `${toSx(v.x).toFixed(1)},${toSy(v.y).toFixed(1)}`).join(' ');
            svg += `<polygon points="${pts}" fill="rgba(245,247,250,0.5)" stroke="#34495e" stroke-width="2" />\n`;
        });

        const slabColors = ['rgba(52,152,219,0.12)', 'rgba(46,204,113,0.12)', 'rgba(155,89,182,0.12)', 'rgba(241,196,15,0.12)', 'rgba(231,76,60,0.12)'];
        slabs.forEach((slab, si) => {
            if (!slab.tributaryPolygons) return;
            slab.tributaryPolygons.forEach((tp, ti) => {
                if (!tp.polygon || tp.polygon.length < 3) return;
                const pts = tp.polygon.map(v => `${toSx(v.x).toFixed(1)},${toSy(v.y).toFixed(1)}`).join(' ');
                const isTarget = beam && (tp.beamId === beam.id);
                const fillColor = isTarget ? 'rgba(46,204,113,0.3)' : slabColors[(si + ti) % slabColors.length];
                const strokeColor = isTarget ? '#27ae60' : '#7f8c8d';
                const strokeWidth = isTarget ? '2' : '1';

                svg += `<polygon points="${pts}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="4,3" />\n`;

                const cx = tp.polygon.reduce((s, v) => s + v.x, 0) / tp.polygon.length;
                const cy = tp.polygon.reduce((s, v) => s + v.y, 0) / tp.polygon.length;
                const areaA = (tp.area / 1e6) || 0;
                const widthB = tp.width || 0;
                const sx = toSx(cx).toFixed(1);
                const sy = toSy(cy).toFixed(1);

                svg += `<text x="${sx}" y="${(sy - 5)}" font-size="9" text-anchor="middle" font-weight="${isTarget ? 'bold' : 'normal'}" fill="${isTarget ? '#1e8449' : '#444'}">A=${areaA.toFixed(2)}㎡</text>\n`;
                if (widthB > 0) {
                    svg += `<text x="${sx}" y="${(parseFloat(sy) + 7).toFixed(1)}" font-size="8" text-anchor="middle" fill="${isTarget ? '#1e8449' : '#666'}">B=${widthB.toFixed(2)}m</text>\n`;
                }
            });
        });

        beams.forEach(b => {
            if (!b.p1 || !b.p2) return;
            const isTarget = beam && b.id === beam.id;
            const color = isTarget ? '#8e44ad' : '#34495e';
            const lw = isTarget ? 3.5 : 2;
            svg += `<line x1="${toSx(b.p1.x).toFixed(1)}" y1="${toSy(b.p1.y).toFixed(1)}" x2="${toSx(b.p2.x).toFixed(1)}" y2="${toSy(b.p2.y).toFixed(1)}" stroke="${color}" stroke-width="${lw}" />\n`;
        });

        if (beam && beam.fdStress?.pillars) {
            beam.fdStress.pillars.forEach(p => {
                if (p.globalX == null) return;
                const px = toSx(p.globalX);
                const py = toSy(p.globalY);
                svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5" fill="#e74c3c" stroke="#c0392b" stroke-width="1" />\n`;
                svg += `<text x="${px.toFixed(1)}" y="${(py - 8).toFixed(1)}" font-size="9" text-anchor="middle" fill="#c0392b" font-weight="bold">${p.name || ''}</text>\n`;
            });
        }

        const scale1m = scaleS * 1000;
        const sbX = padSvg;
        const sbY = svgH - 12;
        svg += `<line x1="${sbX}" y1="${sbY}" x2="${sbX + scale1m}" y2="${sbY}" stroke="#2c3e50" stroke-width="2" />\n`;
        svg += `<text x="${sbX + scale1m / 2}" y="${sbY - 3}" font-size="9" text-anchor="middle" fill="#2c3e50">1m</text>\n`;

        svg += `</svg>\n`;
        return svg;
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('FoundationSvgGenerator', window.FoundationSvgGenerator);
}
