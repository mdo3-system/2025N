/**
 * view/FoundationRenderer.js - Single Source of Truth for Foundation Canvas, HTML & SVG Rendering
 * Centralized rendering engine for foundation canvas elements, beams, slabs, and stress diagrams.
 */

window.FoundationRenderer = {
    // ==========================================
    // 1. Canvas Rendering Engine (キャンバス描画機能)
    // ==========================================

    drawSlabs: function(state, toCanvas, fdSel) {
        if (!state.elementVisibility || state.elementVisibility.f_slabs === false) return;
        const ctx = state.ctx;
        const hFd = state.hoveredFdElement || { type: null, item: null };
        (state.foundationSlabs || []).forEach(slab => {
            if (!slab.polygon || slab.polygon.length < 3) return;
            const isSelected = fdSel.type === 'slab' && fdSel.item?.id === slab.id;
            const isHovered = hFd.type === 'slab' && hFd.item?.id === slab.id;
            
            ctx.save();
            ctx.beginPath();
            slab.polygon.forEach((v, i) => {
                const p = toCanvas(v, null);
                if (p.cx != null) i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy);
            });
            ctx.closePath();
            
            if (isSelected) {
                ctx.fillStyle = 'rgba(231, 76, 60, 0.45)';
                ctx.strokeStyle = '#c0392b';
                ctx.lineWidth = 3;
            } else if (isHovered) {
                ctx.fillStyle = 'rgba(243, 156, 18, 0.4)'; // ホバー時はオレンジ黄色
                ctx.strokeStyle = '#d35400';
                ctx.lineWidth = 3;
            } else {
                ctx.fillStyle = 'rgba(52, 152, 219, 0.25)';
                ctx.strokeStyle = '#2980b9';
                ctx.lineWidth = 1.5;
            }
            ctx.fill();
            ctx.stroke();

            // Label
            const poly = slab.polygon;
            const cxM = poly.reduce((sum, p) => sum + p.x, 0) / poly.length;
            const cyM = poly.reduce((sum, p) => sum + p.y, 0) / poly.length;
            const pC = toCanvas({ x: cxM, y: cyM }, null);
            
            if (pC.cx != null) {
                ctx.font = 'bold 11px sans-serif';
                const sp = slab.props || {};
                const labelA = `${sp.name || 'スラブ'}`;
                const labelB = `t=${sp.thickness || 150} / D${sp.rebarDiameter || 13}@${sp.rebarPitch || 200}`;
                const wA = ctx.measureText(labelA).width;
                const wB = ctx.measureText(labelB).width;
                const boxW = Math.max(wA, wB) + 16;
                const boxH = 32;
                const rx = pC.cx - boxW / 2;
                const ry = pC.cy - boxH / 2;

                const isTarget = isSelected || isHovered;
                ctx.fillStyle = isTarget ? 'rgba(255, 243, 224, 0.95)' : 'rgba(255, 255, 255, 0.9)';
                ctx.fillRect(rx, ry, boxW, boxH);

                ctx.strokeStyle = isTarget ? '#d35400' : '#7f8c8d';
                ctx.lineWidth = isTarget ? 2 : 1;
                ctx.strokeRect(rx, ry, boxW, boxH);

                ctx.fillStyle = isTarget ? '#d35400' : '#2c3e50';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                if (labelB) {
                    ctx.fillText(labelA, pC.cx, pC.cy - 6);
                    ctx.fillText(labelB, pC.cx, pC.cy + 6);
                } else {
                    ctx.fillText(labelA, pC.cx, pC.cy);
                }
            }
            ctx.restore();
        });
    },

    drawExteriorWalls: function(state, toCanvas, fdSel) {
        if (!state.elementVisibility || !state.elementVisibility.f_ext_walls) return;
        const ctx = state.ctx;
        (state.exteriorWalls || []).filter(ew => ew.floor === state.currentFloor).forEach(ew => {
            if (!ew.vertices || ew.vertices.length < 2) return;
            ctx.save();
            const isSelected = fdSel.type === 'ext_wall' && fdSel.item?.id === ew.id;
            ctx.strokeStyle = isSelected ? '#ff00ff' : '#0044ff';
            ctx.lineWidth = isSelected ? 8 : 5;
            ctx.setLineDash(isSelected ? [] : [8, 4]);
            ctx.beginPath();
            ew.vertices.forEach((v, i) => {
                const p = toCanvas(v, null);
                if (p.cx != null) i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy);
            });
            if (ew.closed) ctx.closePath();
            ctx.stroke();
            ctx.restore();
        });
    },

    drawBeams: function(state, toCanvas, fdSel) {
        if (!state.elementVisibility || state.elementVisibility.f_beams === false) return;
        const ctx = state.ctx;
        const hFd = state.hoveredFdElement || { type: null, item: null };
        (state.foundationBeams || []).forEach(b => {
            const bp = b.props || {};
            if (b.spans && b.spans.length > 0) {
                b.spans.forEach((span, idx) => {
                    if (!span || !span.startNode || !span.endNode) return;
                    const isSelected = fdSel.type === 'beam_span' && fdSel.item?.id === b.id && fdSel.spanIndex === idx;
                    const isHovered = hFd.type === 'beam_span' && hFd.item?.id === b.id && hFd.spanIndex === idx;
                    const effectiveProps = { ...bp, ...(span.props || {}) };
                    this.drawBeamSegment(ctx, span.startNode, span.endNode, effectiveProps, isSelected, isHovered, span.isNG, toCanvas);
                });
            } else {
                if (!b.p1 || !b.p2) return;
                const isSelected = fdSel.type === 'beam' && fdSel.item?.id === b.id;
                const isHovered = hFd.type === 'beam' && hFd.item?.id === b.id;
                this.drawBeamSegment(ctx, b.p1, b.p2, bp, isSelected, isHovered, b.isNG, toCanvas);
            }
        });
    },

    drawBeamSegment: function(ctx, p1Obj, p2Obj, props, isSelected, isHovered, isNG, toCanvas) {
        const p1 = toCanvas(p1Obj, null), p2 = toCanvas(p2Obj, null);
        if (p1.cx == null) return;

        ctx.save();
        ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy);
        ctx.globalAlpha = 1.0;
        
        if (isSelected) {
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 8;
        } else if (isHovered) {
            ctx.strokeStyle = '#f39c12'; // ホバー時はオレンジ黄色
            ctx.lineWidth = 7.5;
        } else {
            ctx.strokeStyle = '#ff33aa';
            ctx.lineWidth = 7;
        }
        ctx.lineCap = 'round';
        ctx.stroke();

        const mx = (p1.cx + p2.cx) / 2, my = (p1.cy + p2.cy) / 2;
        const lstr = `${props?.width || 150}x${props?.height || 640}`;
        ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = isSelected ? '#ff00ff' : (isHovered ? '#d35400' : '#2c3e50');
        ctx.fillText(lstr, mx, my);

        if (isNG) {
            ctx.fillStyle = '#e74c3c'; ctx.fillText('判定 NG', mx, my - 14);
        }
        ctx.restore();
    },

    drawManholes: function(state, toCanvas, fdSel) {
        if (!state.elementVisibility || !state.elementVisibility.f_manholes) return;
        const ctx = state.ctx;
        (state.manholes || []).forEach(mh => {
            const mp = toCanvas(mh, null);
            if (mp.cx == null) return;
            const beam = (state.foundationBeams || []).find(b => b.id === mh.parentBeamId);
            const beamWidthPx = Math.max(8, (beam?.props?.width || 150) * state.scale);
            const mhHalfW = (mh.width / 2) * state.scale;
            const mhHalfH = beamWidthPx / 2;
            
            ctx.save();
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fillRect(mp.cx - mhHalfW, mp.cy - mhHalfH, mhHalfW * 2, mhHalfH * 2);
            ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2;
            ctx.strokeRect(mp.cx - mhHalfW, mp.cy - mhHalfH, mhHalfW * 2, mhHalfH * 2);
            ctx.beginPath();
            ctx.moveTo(mp.cx - mhHalfW, mp.cy - mhHalfH); ctx.lineTo(mp.cx + mhHalfW, mp.cy + mhHalfH);
            ctx.moveTo(mp.cx + mhHalfW, mp.cy - mhHalfH); ctx.lineTo(mp.cx - mhHalfW, mp.cy + mhHalfH);
            ctx.stroke();
            
            const isSelected = fdSel.type === 'manhole' && fdSel.item?.id === mh.id;
            if (isSelected) {
                ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(mp.cx, mp.cy, mhHalfW + 10, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
        });
    },

    drawPreviews: function(state, toCanvas) {
        const fm = state.foundationMode || 'f_beam';
        const fdPts = state.fdDrawPoints || [];
        const fdSel = state.fdSelectedPillarLike;
        const ctx = state.ctx;

        if (fm === 'f_beam' && fdSel) {
            const sp = toCanvas(fdSel, null);
            if (sp.cx != null) {
                ctx.save(); ctx.fillStyle = '#f39c12';
                ctx.beginPath(); ctx.arc(sp.cx, sp.cy, 8, 0, Math.PI * 2); ctx.fill();
                let previewEp = state.snapPoint ? { x: state.snapPoint.x, y: state.snapPoint.y } : { x: (state.mouseX - state.offsetX) / state.scale, y: (state.canvas.height - state.mouseY - state.offsetY) / state.scale };
                const ep = toCanvas(previewEp, null);
                ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
                ctx.beginPath(); ctx.moveTo(sp.cx, sp.cy); ctx.lineTo(ep.cx, ep.cy); ctx.stroke();
                ctx.restore();
            }
        }
        if ((fm === 'f_ext_wall' || fm === 'f_slab') && fdPts.length > 0) {
            ctx.save(); ctx.strokeStyle = fm === 'f_ext_wall' ? '#0044ff' : '#2980b9';
            ctx.lineWidth = fm === 'f_ext_wall' ? 4 : 2; ctx.setLineDash(fm === 'f_ext_wall' ? [8, 4] : [5, 5]);
            ctx.beginPath();
            fdPts.forEach((pt, i) => {
                const p = toCanvas(pt, null);
                if (p.cx != null) i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy);
            });
            const ep = state.snapPoint ? toCanvas(state.snapPoint, null) : { cx: state.mouseX, cy: state.mouseY };
            ctx.lineTo(ep.cx, ep.cy); ctx.stroke();
            ctx.restore();
        }
    },

    // ==========================================
    // 2. HTML & SVG Structural Report Engine (構造計算書・応力図生成機能)
    // ==========================================

    fmt: function(val, digits = 2) {
        if (typeof val !== 'number' || !isFinite(val)) return '-';
        return val.toFixed(digits);
    },

    fmtRatio: function(r) {
        if (!isFinite(r)) return '-';
        const ok = r <= 1.0;
        return `<span style="color:${ok ? '#27ae60' : '#e74c3c'}; font-weight:bold;">${(r * 100).toFixed(1)}% ${ok ? 'OK' : 'NG'}</span>`;
    },

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

        html += `<div style="font-size:12px; font-weight:bold; color:#2c3e50; border-left:4px solid #8e44ad; padding-left:8px; margin:15px 0 10px 0;">■ 基礎梁の断面と配筋の検定 (N・M・Q図)</div>`;
        html += this.generateBeamNMQSvg(beam);

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

        // 5. (4) 許容耐力の算定（1 - 曲げ）
        html += `<div style="font-size:12px; font-weight:bold; color:#2c3e50; border-left:4px solid #34495e; padding-left:8px; margin:15px 0 6px 0;">④ 許容耐力の算定（1 - 曲げ）</div>`;
        
        const parseRebarInput = (str) => {
            const m = (str || '1-D13').match(/^(\d+)-D([A-Za-z0-9]+)/i);
            if (!m) return { count: 1, type: 'D13' };
            return { count: parseInt(m[1]) || 1, type: 'D' + m[2].toUpperCase() };
        };

        const parseStirrupInput = (str) => {
            const m = (str || '1-D10@200').match(/^(\d+)-D(\d+)@(\d+)/i);
            if (!m) return { count: 1, type: 'D10', pitch: '200' };
            return { count: parseInt(m[1]) || 1, type: 'D' + m[2], pitch: m[3] };
        };

        let table4 = `<table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:15px; border:1px solid #bdc3c7;">
            <thead>
                <tr style="background:#34495e; color:#fff; border-bottom:1px solid #bdc3c7;">
                    <th rowspan="2" style="border:1px solid #bdc3c7; padding:4px;">柱間</th>
                    <th rowspan="2" style="border:1px solid #bdc3c7; padding:4px; width:45px;">成 D(mm)</th>
                    <th rowspan="2" style="border:1px solid #bdc3c7; padding:4px; width:45px;">根入れ h(mm)</th>
                    <th colspan="4" style="border:1px solid #bdc3c7; padding:4px; text-align:center; background:#ebf5fb; color:#1b4f72;">上端主筋</th>
                    <th colspan="4" style="border:1px solid #bdc3c7; padding:4px; text-align:center; background:#fdf2e9; color:#7e5109;">下端主筋</th>
                </tr>
                <tr style="background:#f2f4f4; color:#2c3e50; border-bottom:1px solid #bdc3c7;">
                    <th style="border:1px solid #bdc3c7; padding:3px;">鉄筋</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">at(㎟)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">lMa(長期)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">sMa(短期)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">鉄筋</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">at(㎟)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">lMa(長期)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">sMa(短期)</th>
                </tr>
            </thead>
            <tbody>`;

        spans.forEach((span, sIdx) => {
            const sTopRebar = span.props?.topRebar || bp.topRebar || '1-D13';
            const sBottomRebar = span.props?.bottomRebar || bp.bottomRebar || '1-D13';
            const currentTop = parseRebarInput(sTopRebar);
            const currentBot = parseRebarInput(sBottomRebar);

            const topCountId = `top-count-${beam.id}-${sIdx}`;
            const topTypeId = `top-type-${beam.id}-${sIdx}`;
            const botCountId = `bot-count-${beam.id}-${sIdx}`;
            const botTypeId = `bot-type-${beam.id}-${sIdx}`;

            const topArea = (window.FoundationEngine && window.FoundationEngine.parseRebar) ? window.FoundationEngine.parseRebar(sTopRebar).area : 127;
            const botArea = (window.FoundationEngine && window.FoundationEngine.parseRebar) ? window.FoundationEngine.parseRebar(sBottomRebar).area : 127;

            const topControlHtml = options.showInputs ? `
                <input type="number" id="${topCountId}" min="1" value="${currentTop.count}" onchange="const typeVal = document.getElementById('${topTypeId}').value; window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'topRebar', this.value + '-' + typeVal, ${sIdx})" style="width:30px; padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; text-align:right;">-
                <select id="${topTypeId}" onchange="const countVal = document.getElementById('${topCountId}').value; window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'topRebar', countVal + '-' + this.value, ${sIdx})" style="padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; background:#fff; max-width:65px;">
                    <option value="D13" ${currentTop.type === 'D13' ? 'selected' : ''}>D13</option>
                    <option value="D16" ${currentTop.type === 'D16' ? 'selected' : ''}>D16</option>
                    <option value="D19" ${currentTop.type === 'D19' ? 'selected' : ''}>D19</option>
                    <option value="D13D16" ${currentTop.type === 'D13D16' ? 'selected' : ''}>D13D16</option>
                    <option value="D13D19" ${currentTop.type === 'D13D19' ? 'selected' : ''}>D13D19</option>
                    <option value="D16D19" ${currentTop.type === 'D16D19' ? 'selected' : ''}>D16D19</option>
                </select>` : `${sTopRebar}`;

            const botControlHtml = options.showInputs ? `
                <input type="number" id="${botCountId}" min="1" value="${currentBot.count}" onchange="const typeVal = document.getElementById('${botTypeId}').value; window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'bottomRebar', this.value + '-' + typeVal, ${sIdx})" style="width:30px; padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; text-align:right;">-
                <select id="${botTypeId}" onchange="const countVal = document.getElementById('${botCountId}').value; window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'bottomRebar', countVal + '-' + this.value, ${sIdx})" style="padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; background:#fff; max-width:65px;">
                    <option value="D13" ${currentBot.type === 'D13' ? 'selected' : ''}>D13</option>
                    <option value="D16" ${currentBot.type === 'D16' ? 'selected' : ''}>D16</option>
                    <option value="D19" ${currentBot.type === 'D19' ? 'selected' : ''}>D19</option>
                    <option value="D13D16" ${currentBot.type === 'D13D16' ? 'selected' : ''}>D13D16</option>
                    <option value="D13D19" ${currentBot.type === 'D13D19' ? 'selected' : ''}>D13D19</option>
                    <option value="D16D19" ${currentBot.type === 'D16D19' ? 'selected' : ''}>D16D19</option>
                </select>` : `${sBottomRebar}`;

            const heightInputHtml = options.showInputs ? `
                <input type="number" step="10" value="${span.props?.height || bp.height || 640}" onchange="window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'height', this.value, ${sIdx})" style="width:40px; padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; text-align:right;">` : `${span.props?.height || bp.height || 640}`;

            const embedInputHtml = options.showInputs ? `
                <input type="number" step="10" value="${span.props?.embedDepth !== undefined ? span.props.embedDepth : (bp.embedDepth !== undefined ? bp.embedDepth : 250)}" onchange="window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'embedDepth', this.value, ${sIdx})" style="width:40px; padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; text-align:right;">` : `${span.props?.embedDepth !== undefined ? span.props.embedDepth : (bp.embedDepth !== undefined ? bp.embedDepth : 250)}`;

            table4 += `<tr>
                <td style="border:1px solid #bdc3c7; padding:4px; font-weight:bold; text-align:center;">${getFreshSpanName(span)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:center;">${heightInputHtml}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:center;">${embedInputHtml}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:center; white-space:nowrap;">${topControlHtml}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right;">${topArea.toFixed(1)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#27ae60;">${(span.cap?.lMa_top ?? 0).toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#16a085;">${(span.cap?.sMa_top ?? 0).toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:center; white-space:nowrap;">${botControlHtml}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right;">${botArea.toFixed(1)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#2980b9;">${(span.cap?.lMa_bot ?? 0).toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#2e4053;">${(span.cap?.sMa_bot ?? 0).toFixed(3)}</td>
            </tr>`;
        });
        table4 += `</tbody></table>`;
        html += table4;

        // 6. (5) 許容耐力の算定（2 - せん断）
        html += `<div style="font-size:12px; font-weight:bold; color:#2c3e50; border-left:4px solid #34495e; padding-left:8px; margin:15px 0 6px 0;">⑤ 許容耐力の算定（2 - せん断）</div>`;
        let table5 = `<table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:15px; border:1px solid #bdc3c7;">
            <thead>
                <tr style="background:#34495e; color:#fff; border-bottom:1px solid #bdc3c7;">
                    <th rowspan="2" style="border:1px solid #bdc3c7; padding:4px;">柱間</th>
                    <th rowspan="2" style="border:1px solid #bdc3c7; padding:4px; width:45px;">幅 b(mm)</th>
                    <th colspan="3" style="border:1px solid #bdc3c7; padding:4px; text-align:center; background:#ebf5fb; color:#1b4f72;">スターラップ筋 (あばら筋)</th>
                    <th rowspan="2" style="border:1px solid #bdc3c7; padding:4px;">pw</th>
                    <th colspan="2" style="border:1px solid #bdc3c7; padding:4px; text-align:center; background:#e8f8f5; color:#117a65;">せん断長期</th>
                    <th colspan="4" style="border:1px solid #bdc3c7; padding:4px; text-align:center; background:#fef9e7; color:#7e5109;">せん断短期</th>
                </tr>
                <tr style="background:#f2f4f4; color:#2c3e50; border-bottom:1px solid #bdc3c7;">
                    <th style="border:1px solid #bdc3c7; padding:3px;">鉄筋</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">at(㎟)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">ピッチ(mm)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">α</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">lQa (kN)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">α(左)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">sQa_L (kN)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">α(右)</th>
                    <th style="border:1px solid #bdc3c7; padding:3px;">sQa_R (kN)</th>
                </tr>
            </thead>
            <tbody>`;

        spans.forEach((span, sIdx) => {
            const sStirrup = span.props?.stirrup || bp.stirrup || '1-D10@200';
            const currentSt = parseStirrupInput(sStirrup);

            const stCountId = `st-count-${beam.id}-${sIdx}`;
            const stTypeId = `st-type-${beam.id}-${sIdx}`;
            const stPitchId = `st-pitch-${beam.id}-${sIdx}`;

            const stArea = (window.FoundationEngine && window.FoundationEngine.parseStirrups) ? window.FoundationEngine.parseStirrups(sStirrup).area : 71;

            const alpha_L = span.cap?.alpha_L != null ? span.cap.alpha_L.toFixed(3) : '--';
            const alpha_S_L = span.cap?.alpha_S_L != null ? span.cap.alpha_S_L.toFixed(3) : '--';
            const alpha_S_R = span.cap?.alpha_S_R != null ? span.cap.alpha_S_R.toFixed(3) : '--';

            const pwValue = span.cap?.pw ?? 0;
            const pwWarning = pwValue < 0.002 ? 'background:#fff9c4; color:#d32f2f; font-weight:bold;' : '';

            const widthInputHtml = options.showInputs ? `
                <input type="number" step="10" value="${span.props?.width || bp.width || 150}" onchange="window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'width', this.value, ${sIdx})" style="width:40px; padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; text-align:right;">` : `${span.props?.width || bp.width || 150}`;

            const stirrupControlHtml = options.showInputs ? `
                <input type="number" id="${stCountId}" min="1" value="${currentSt.count}" onchange="const typeVal = document.getElementById('${stTypeId}').value; const pitchVal = document.getElementById('${stPitchId}').value; window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'stirrup', this.value + '-' + typeVal + '@' + pitchVal, ${sIdx})" style="width:30px; padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; text-align:right;">-
                <select id="${stTypeId}" onchange="const countVal = document.getElementById('${stCountId}').value; const pitchVal = document.getElementById('${stPitchId}').value; window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'stirrup', countVal + '-' + this.value + '@' + pitchVal, ${sIdx})" style="padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; background:#fff; max-width:60px;">
                    <option value="D10" ${currentSt.type === 'D10' ? 'selected' : ''}>D10</option>
                    <option value="D13" ${currentSt.type === 'D13' ? 'selected' : ''}>D13</option>
                </select>` : `${currentSt.count}-${currentSt.type}`;

            const pitchControlHtml = options.showInputs ? `
                <select id="${stPitchId}" onchange="const countVal = document.getElementById('${stCountId}').value; const typeVal = document.getElementById('${stTypeId}').value; window.PropertyController.updateFdProp('beam_span', ${beam.id}, 'stirrup', countVal + '-' + typeVal + '@' + this.value, ${sIdx})" style="padding:2px; font-size:9px; border:1px solid #ccc; border-radius:3px; background:#fff; max-width:70px;">
                    <option value="300" ${currentSt.pitch === '300' ? 'selected' : ''}>@300</option>
                    <option value="200" ${currentSt.pitch === '200' ? 'selected' : ''}>@200</option>
                    <option value="150" ${currentSt.pitch === '150' ? 'selected' : ''}>@150</option>
                    <option value="100" ${currentSt.pitch === '100' ? 'selected' : ''}>@100</option>
                </select>` : `@${currentSt.pitch}`;

            table5 += `<tr>
                <td style="border:1px solid #bdc3c7; padding:4px; font-weight:bold; text-align:center;">${getFreshSpanName(span)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:center;">${widthInputHtml}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:center; white-space:nowrap;">${stirrupControlHtml}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right;">${stArea.toFixed(1)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:center;">${pitchControlHtml}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; ${pwWarning}">${pwValue.toFixed(5)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#117a65;">${alpha_L}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#27ae60;">${(span.cap?.lQa ?? 0).toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#117a65;">${alpha_S_L}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#2980b9;">${(span.cap?.sQa_L ?? 0).toFixed(3)}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#117a65;">${alpha_S_R}</td>
                <td style="border:1px solid #bdc3c7; padding:4px; text-align:right; font-weight:bold; color:#7d3c98;">${(span.cap?.sQa_R ?? 0).toFixed(3)}</td>
            </tr>`;
        });
        table5 += `</tbody></table>`;

        if (spans.some(s => (s.cap?.pw ?? 0) < 0.002)) {
            html += `<div style="background:#fff9c4; border-left:4px solid #fbc02d; padding:8px; margin-bottom:12px; font-size:10px; color:#856404; font-weight:bold;">
                ⚠️ せん断補強筋比(pw)が0.002を下回っています。鉄筋の本数・径を増やすか、ピッチを細かく(例:@100)修正してください。
            </div>`;
        }
        html += table5;

        // 7. (6) 総合判定表 (検定比)
        html += `<div style="font-size:12px; font-weight:bold; color:#2c3e50; border-left:4px solid #34495e; padding-left:8px; margin:15px 0 6px 0;">⑥ 総合判定 (検定比)</div>`;
        let table6 = `<table style="width:100%; border-collapse:collapse; font-size:10px; border:2px solid #34495e; text-align:center; background:#fff;">
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
            table6 += `
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
        table6 += `</tbody></table>`;
        html += table6;

        html += `</div>`;
        return html;
    },

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
