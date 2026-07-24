/**
 * view/FoundationRenderer.js - Single Source of Truth for Foundation Canvas, HTML & SVG Rendering
 * Centralized rendering engine for foundation canvas elements, beams, slabs, and stress diagrams.
 */

window.FoundationRenderer = {
    // ==========================================
    // 1. Canvas Rendering Engine (キャンバス描画機能)
    // ==========================================

    /**
     * 基礎レイヤーの描画 (MainRendererから呼び出されるエントリーポイント)
     * @param {Object} state - アプリケーション状態
     * @param {Function} toCanvas - 座標変換関数
     */
    render: function(state, toCanvas) {
        const ctx = state.ctx;
        if (!ctx) return;

        const fdSel = state.fdSelection || { type: null, item: null };

        // 1. スラブ描画
        this.drawSlabs(state, toCanvas, fdSel);

        // 2. 負荷エリア (Tributary)
        this.drawTributary(state, toCanvas);

        // 3. 外壁線
        this.drawExteriorWalls(state, toCanvas, fdSel);

        // 4. 基礎梁
        this.drawBeams(state, toCanvas, fdSel);

        // 5. 人通口
        this.drawManholes(state, toCanvas, fdSel);

        // 6. プレビュー
        this.drawPreviews(state, toCanvas);
    },

    drawSlabs: function(state, toCanvas, fdSel) {
        const ctx = state.ctx;
        const hFd = state.hoveredFdElement || { type: null, item: null };
        (state.foundationSlabs || []).filter(s => !state.elementVisibility || state.elementVisibility.f_slabs !== false).forEach((slab, si) => {
            if (!slab.vertices || slab.vertices.length < 3) return;
            ctx.save();
            const isSelected = (fdSel.type === 'slab' && fdSel.item?.id === slab.id) || (window.highlightedSlabIndex === si);
            const isHovered = hFd.type === 'slab' && hFd.item?.id === slab.id;

            ctx.beginPath();
            slab.vertices.forEach((v, i) => {
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
            const poly = slab.vertices;
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

    drawTributary: function(state, toCanvas) {
        if (state.elementVisibility && state.elementVisibility.f_tributary === false) return;
        const ctx = state.ctx;
        const fdSel = state.fdSelection || { type: null, item: null };
        const selectedBeamId = (fdSel.type === 'beam' || fdSel.type === 'beam_span') ? fdSel.item?.id : null;

        (state.foundationSlabs || []).forEach(slab => {
            if (!slab.tributaryPolygons) return;
            slab.tributaryPolygons.forEach((tribEntry) => {
                const poly = tribEntry.polygon;
                if (!poly || poly.length < 3) return;
                
                const isTarget = selectedBeamId && (selectedBeamId === tribEntry.beamId);

                ctx.save();
                if (isTarget) {
                    ctx.fillStyle = 'rgba(46, 204, 113, 0.25)'; // 選択対象の梁の負担領域を緑色ハイライト
                    ctx.beginPath();
                    poly.forEach((v, idx) => {
                        const p = toCanvas(v, null);
                        if (p.cx != null) idx === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy);
                    });
                    ctx.closePath(); ctx.fill();
                }

                ctx.setLineDash([5, 3]); 
                ctx.strokeStyle = isTarget ? '#27ae60' : '#7f8c8d'; 
                ctx.lineWidth = isTarget ? 2 : 1;
                
                ctx.beginPath();
                poly.forEach((v, idx) => {
                    const p = toCanvas(v, null);
                    if (p.cx != null) idx === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy);
                });
                ctx.closePath(); ctx.stroke();

                // 面積 A (㎡) および 負担幅 B (m) ラベル描画
                let cxSum = poly.reduce((s, v) => s + v.x, 0) / poly.length;
                let cySum = poly.reduce((s, v) => s + v.y, 0) / poly.length;
                const pC = toCanvas({ x: cxSum, y: cySum }, null);
                if (pC.cx != null) {
                    let areaA = tribEntry.area / 1e6 || 0;
                    let widthB = tribEntry.width || 0;
                    ctx.font = isTarget ? 'bold 11px sans-serif' : '9px sans-serif'; 
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
                    
                    const labelA = `A = ${areaA.toFixed(2)} ㎡`;
                    const labelB = widthB > 0 ? `B = ${widthB.toFixed(2)} m` : '';

                    ctx.strokeText(labelA, pC.cx, pC.cy - (labelB ? 6 : 0));
                    ctx.fillStyle = isTarget ? '#1e8449' : '#555555';
                    ctx.fillText(labelA, pC.cx, pC.cy - (labelB ? 6 : 0));
                    
                    if (labelB) {
                        ctx.strokeText(labelB, pC.cx, pC.cy + 6);
                        ctx.fillText(labelB, pC.cx, pC.cy + 6);
                    }
                }
                ctx.restore();
            });
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
                        <option value="both_ends" ${(!bp.modelType || bp.modelType === 'both_ends') ? 'selected' : ''}>両端支点（連続梁）</option>
                        <option value="pillar_supported" ${bp.modelType === 'pillar_supported' ? 'selected' : ''}>柱直下支点（連続梁）</option>
                    </select>
                </div>
            </div>`;
        }

        // 基礎梁負担図（亀甲分割図）
        const tributarySvg = this.generateFoundationTributarySvg(beam, s);
        if (tributarySvg) {
            html += `<div style="font-size:12px; font-weight:bold; color:#2c3e50; border-left:4px solid #27ae60; padding-left:8px; margin:15px 0 6px 0;">■ 基礎梁 負担図（べた基礎接地圧分担域）</div>`;
            html += tributarySvg;
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
        if (!beam || !beam.fdStress || !beam.fdStress.pillars || beam.fdStress.pillars.length === 0) return '';
        const pillars = beam.fdStress.pillars;
        const spans = beam.fdStress.spans || [];
        
        const xMin = pillars[0].x;
        const xMax = pillars[pillars.length - 1].x;
        const totalLength = xMax - xMin;
        if (totalLength <= 0) return '';

        const width = 700;
        const padX = 60;
        const chartW = width - padX * 2;
        
        const getX = (x) => padX + ((x - xMin) / totalLength) * chartW;

        let maxTd = 1;
        let maxM = 1;
        let maxQ = 1;

        const seismic = beam.fdStress.seismic || { leftward: { Td:[], Qe:[], Mf:[] }, rightward: { Td:[], Qe:[], Mf:[] } };
        pillars.forEach((p, idx) => {
            const l_Td = Math.abs(seismic.leftward?.Td?.[idx] || 0);
            const r_Td = Math.abs(seismic.rightward?.Td?.[idx] || 0);
            maxTd = Math.max(maxTd, l_Td, r_Td);
        });

        spans.forEach(s => {
            const l_M = Math.max(Math.abs(s.leftward?.M_left || 0), Math.abs(s.leftward?.M_right || 0));
            const r_M = Math.max(Math.abs(s.rightward?.M_left || 0), Math.abs(s.rightward?.M_right || 0));
            const lt_M = Math.max(Math.abs(s.M_mid || 0), Math.abs(s.M_end || 0));
            maxM = Math.max(maxM, l_M, r_M, lt_M);

            const l_Q = Math.abs(s.leftward?.Q || 0);
            const r_Q = Math.abs(s.rightward?.Q || 0);
            const lt_Q = Math.abs(s.Q_L || 0);
            maxQ = Math.max(maxQ, l_Q, r_Q, lt_Q);
        });

        const h = 100;
        const spacing = 45;
        const svgHeight = (h + spacing) * 3 + 25;

        const getFreshPillarName = (p) => {
            if (!p) return '支点';
            const px = p.globalX ?? (p.x * 1000) ?? 0;
            const py = p.globalY ?? (p.y * 1000) ?? 0;
            const gridName = window.getGridNameAt ? window.getGridNameAt(px, py) : null;
            const isDefault = !p.name || /^(P|M)_?(P|M)?\d+$/i.test(p.name) || p.name.toLowerCase().startsWith('pillar') || p.name === `P_${p.id}` || p.name === p.id || p.name.startsWith('支点') || (p.id && String(p.id).startsWith('support'));
            return isDefault ? (gridName || p.name || `P_${p.id}`) : p.name;
        };

        let svg = `<svg viewBox="0 0 ${width} ${svgHeight}" style="background:#fdfdfd; border:1px solid #cbd5e1; border-radius:8px; margin:15px 0; width:100%; max-width:700px; font-family:sans-serif; box-shadow:0 1px 3px rgba(0,0,0,0.05);">`;

        // 1. 短期軸力図 Td (kN)
        let y1 = 60;
        svg += `<g class="chart-axial">
            <text x="${padX}" y="${y1 - 35}" font-size="11" font-weight="bold" fill="#1e293b">■ 短期軸力図 Td (kN)</text>
            <line x1="${padX - 10}" y1="${y1}" x2="${width - padX + 10}" y2="${y1}" stroke="#94a3b8" stroke-width="1.5" />
        `;
        pillars.forEach((p, idx) => {
            const px = getX(p.x);
            const l_val = seismic.leftward?.Td?.[idx] || 0;
            const r_val = seismic.rightward?.Td?.[idx] || 0;
            
            const ly = y1 - (l_val / maxTd) * 35;
            const ry = y1 - (r_val / maxTd) * 35;
            const pname = getFreshPillarName(p);

            svg += `<line x1="${px}" y1="${y1 - 5}" x2="${px}" y2="${y1 + 5}" stroke="#cbd5e1" stroke-width="1" />`;
            svg += `<text x="${px}" y="${y1 + 15}" font-size="8" text-anchor="middle" fill="#64748b" font-weight="bold">${pname}</text>`;

            svg += `<line x1="${px - 3.5}" y1="${y1}" x2="${px - 3.5}" y2="${ly}" stroke="#3b82f6" stroke-width="3" />`;
            svg += `<line x1="${px + 3.5}" y1="${y1}" x2="${px + 3.5}" y2="${ry}" stroke="#f97316" stroke-width="3" />`;

            // 【案5】短スパン重なり回避: 偶数奇数インデックスでラベルY位置を交互シフト
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

            // 【案5】短スパン・同一節点テキスト重なり回避オフセット
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
     * 各スラブの分担ポリゴンと各辺の負担幅Bを平面図として描画
     */
    generateFoundationTributarySvg: function(beam, state) {
        const s = state || window.AppState;
        const slabs = s?.foundationSlabs || [];
        const beams = s?.foundationBeams || [];
        if (slabs.length === 0 && beams.length === 0) return '';

        // 全頂点のバウンディングボックスを算出
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
        const toSy = (y) => svgH - padSvg - (y - minY) * scaleS; // Y軸反転

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" style="background:#fff; border:1px solid #bdc3c7; border-radius:4px; display:block;">\n`;
        svg += `<text x="${svgW/2}" y="18" font-size="13" font-weight="bold" fill="#2c3e50" text-anchor="middle">基礎梁 負担図（スラブ亀甲分割・接地圧分担域）</text>\n`;

        // 1. スラブ本体の外郭線
        slabs.forEach((slab, si) => {
            if (!slab.vertices || slab.vertices.length < 3) return;
            const pts = slab.vertices.map(v => `${toSx(v.x).toFixed(1)},${toSy(v.y).toFixed(1)}`).join(' ');
            svg += `<polygon points="${pts}" fill="rgba(245,247,250,0.5)" stroke="#34495e" stroke-width="2" />\n`;
        });

        // 2. 亀甲分割ポリゴン（tributaryPolygons）の描画（破線＋分担領域＋A/Bラベル）
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

                // 分割ポリゴンの重心に A (㎡) / B (m) ラベルを描画
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

        // 3. 基礎梁描画（全梁）
        beams.forEach(b => {
            if (!b.p1 || !b.p2) return;
            const isTarget = beam && b.id === beam.id;
            const color = isTarget ? '#8e44ad' : '#34495e';
            const lw = isTarget ? 3.5 : 2;
            svg += `<line x1="${toSx(b.p1.x).toFixed(1)}" y1="${toSy(b.p1.y).toFixed(1)}" x2="${toSx(b.p2.x).toFixed(1)}" y2="${toSy(b.p2.y).toFixed(1)}" stroke="${color}" stroke-width="${lw}" />\n`;
        });

        // 4. 柱・支点描画（ピラー）
        if (beam && beam.fdStress?.pillars) {
            beam.fdStress.pillars.forEach(p => {
                if (p.globalX == null) return;
                const px = toSx(p.globalX);
                const py = toSy(p.globalY);
                svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5" fill="#e74c3c" stroke="#c0392b" stroke-width="1" />\n`;
                svg += `<text x="${px.toFixed(1)}" y="${(py - 8).toFixed(1)}" font-size="9" text-anchor="middle" fill="#c0392b" font-weight="bold">${p.name || ''}</text>\n`;
            });
        }

        // 5. スケールバー
        const scale1m = scaleS * 1000; // 1000mm = 1m のピクセル
        const sbX = padSvg;
        const sbY = svgH - 12;
        svg += `<line x1="${sbX}" y1="${sbY}" x2="${sbX + scale1m}" y2="${sbY}" stroke="#2c3e50" stroke-width="2" />\n`;
        svg += `<text x="${sbX + scale1m / 2}" y="${sbY - 3}" font-size="9" text-anchor="middle" fill="#2c3e50">1m</text>\n`;

        svg += `</svg>\n`;
        return svg;
    }
};
