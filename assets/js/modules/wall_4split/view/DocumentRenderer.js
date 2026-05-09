/**
 * view/DocumentRenderer.js - Report Image Rendering
 * v2.2.0 Refactoring
 */

window.DocumentRenderer = {
    /**
     * Render a filtered image of CAD entities on a canvas
     */
    renderLayerFilteredImage: function(docType, targetLayers, bgLayers, floorStr, options = {}) {
        const { showAreaDims = true, dimScale = 1.0, isPrint = false } = options;
        const state = window.AppState;
        const data = state.docDrawings[docType];
        
        // Handle case where DXF is not loaded but manual areas exist
        const hasManualAreas = floorStr && state.areaLines.some(a => a.floor === floorStr && a.isManualArea);
        if ((!data || !data.loaded) && !hasManualAreas) return null;

        const entities = data ? data.entities : [];
        const filteredEnts = window.DocumentEngine.filterEntities(entities, targetLayers, bgLayers, isPrint);
        const bbox = window.DocumentEngine.calculateBoundingBox(filteredEnts, floorStr, state.areaLines);

        if (bbox.minX === Infinity) return null;

        // Calculate Scale
        const scaleInputId = (docType === 'elev') ? 'scale-sub' : (document.getElementById('scale-plan') ? 'scale-plan' : 'scale-floor');
        const userScale = parseFloat(document.getElementById(scaleInputId)?.value) || 100;
        let sf = (1 / userScale) * 11.81;
        const padCAD = 50 / (1 / userScale);
        
        const adjustedBbox = {
            minX: bbox.minX - padCAD,
            maxX: bbox.maxX + padCAD,
            minY: bbox.minY - padCAD,
            maxY: bbox.maxY + padCAD
        };

        let cW = (adjustedBbox.maxX - adjustedBbox.minX) * sf;
        let cH = (adjustedBbox.maxY - adjustedBbox.minY) * sf;
        
        const MAX_PX = 4096;
        let sfFinal = sf;
        if (cW > MAX_PX || cH > MAX_PX) {
            let ratio = Math.min(MAX_PX / cW, MAX_PX / cH);
            cW *= ratio;
            cH *= ratio;
            sfFinal = sf * ratio;
        }

        const canvas = document.createElement('canvas');
        canvas.width = cW;
        canvas.height = cH;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cW, cH);

        const toC = (x, y) => ({
            cx: (x - adjustedBbox.minX) * sfFinal,
            cy: cH - ((y - adjustedBbox.minY) * sfFinal)
        });

        // Draw Background
        const bgEnts = filteredEnts.filter(e => e.isBg);
        if (bgEnts.length > 0 && typeof _drawCADEntities === 'function') {
            _drawCADEntities(ctx, bgEnts, toC, true, sfFinal, true);
        }

        // Draw Area Lines
        if (floorStr) {
            this.drawAreaPolygons(ctx, state.areaLines.filter(a => a.floor === floorStr), toC, { showAreaDims, dimScale });
        }

        // Draw Target Entities
        const targetEnts = filteredEnts.filter(e => e.isTarget);
        if (targetEnts.length > 0 && typeof _drawCADEntities === 'function') {
            _drawCADEntities(ctx, targetEnts, toC, false, sfFinal);
        }

        // Draw Scale Text
        ctx.font = `bold ${Math.round(24 * (sfFinal / sf))}px sans-serif`;
        ctx.fillStyle = "#333";
        ctx.textAlign = "right";
        ctx.fillText(`S = 1 / ${userScale}`, canvas.width - 40, canvas.height - 40);

        return {
            img: canvas.toDataURL('image/png'),
            physW: (adjustedBbox.maxX - adjustedBbox.minX) / userScale,
            physH: (adjustedBbox.maxY - adjustedBbox.minY) / userScale
        };
    },

    /**
     * Draw Area Polygons and Dimensions
     */
    drawAreaPolygons: function(ctx, areaLines, toC, options) {
        const { showAreaDims, dimScale } = options;
        areaLines.forEach((a, index) => {
            ctx.beginPath();
            a.vertices.forEach((v, i) => {
                let p = toC(v.x, v.y);
                if (i === 0) ctx.moveTo(p.cx, p.cy);
                else ctx.lineTo(p.cx, p.cy);
            });
            if (a.closed) ctx.closePath();
            
            ctx.save();
            let fillCol = 'rgba(173, 216, 230, 0.4)';
            let strokeCol = 'rgba(46, 204, 113, 0.8)';
            if (a.areaType === 'attic') { fillCol = 'rgba(155, 89, 182, 0.3)'; strokeCol = '#8e44ad'; }
            else if (a.areaType === 'balcony') { fillCol = 'rgba(230, 126, 34, 0.3)'; strokeCol = '#e67e22'; }
            else if (a.areaType === 'void') { fillCol = 'rgba(127, 140, 141, 0.3)'; strokeCol = '#7f8c8d'; }
            else if (a.areaType === 'porch') { fillCol = 'rgba(241, 196, 15, 0.3)'; strokeCol = '#f39c12'; }
            ctx.fillStyle = fillCol;
            ctx.fill();
            ctx.strokeStyle = strokeCol;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Label
            let cx = 0, cy = 0;
            a.vertices.forEach(v => { let p = toC(v.x, v.y); cx += p.cx; cy += p.cy; });
            cx /= a.vertices.length; cy /= a.vertices.length;

            let typeName = a.areaType === 'attic' ? '小屋裏' : 
                          a.areaType === 'balcony' ? 'バルコニー' : 
                          a.areaType === 'void' ? '吹き抜け' : 
                          a.areaType === 'porch' ? 'ポーチ・屋根' : '床面積';

            let labelText = `${index + 1}. ${typeName}`;
            ctx.save();
            ctx.font = `bold ${Math.round(20 * dimScale)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = 4 * dimScale;
            ctx.strokeStyle = '#ffffff';
            ctx.strokeText(labelText, cx, cy);
            ctx.fillStyle = '#2c3e50';
            ctx.fillText(labelText, cx, cy);
            ctx.restore();

            // Dimensions
            if (showAreaDims) {
                ctx.font = `bold ${Math.round(18 * dimScale)}px sans-serif`;
                ctx.textAlign = "center";
                for (let i = 0; i < a.vertices.length; i++) {
                    let v1 = a.vertices[i], v2 = a.vertices[(i + 1) % a.vertices.length];
                    let p1 = toC(v1.x, v1.y), p2 = toC(v2.x, v2.y);
                    let d = Math.round(Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2)));
                    let mx = (p1.cx + p2.cx) / 2, my = (p1.cy + p2.cy) / 2;
                    let dxCentroid = mx - cx, dyCentroid = my - cy;
                    let lenCentroid = Math.hypot(dxCentroid, dyCentroid) || 1;
                    let nx = dxCentroid / lenCentroid, ny = dyCentroid / lenCentroid;

                    let offset = 25 * dimScale;
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4 * dimScale;
                    ctx.strokeText(String(d), mx + nx * offset, my + ny * offset);
                    ctx.fillStyle = '#c0392b'; ctx.fillText(String(d), mx + nx * offset, my + ny * offset);
                }
            }
        });
    },

    /**
     * Render a high-resolution structural plan (Wall, N-Value, Area)
     */
    renderStructuralPlan: function(floor, mode, divMode = null, options = {}) {
        const { showAreaDims = true, dimScale = 1.0, isPrint = false } = options;
        const state = window.AppState;

        try {
            // 1. Calculate Bounding Box
            let mx = Infinity, my = Infinity, Mxx = -Infinity, Mxy = -Infinity;
            state.areaLines.filter(a => a.floor === floor).forEach(a => {
                if (a.vertices) a.vertices.forEach(v => {
                    if (v.x != null && !isNaN(v.x)) { if (v.x < mx) mx = v.x; if (v.x > Mxx) Mxx = v.x; if (v.y < my) my = v.y; if (v.y > Mxy) Mxy = v.y; }
                });
            });
            state.pillars.forEach(p => { 
                if (!isPrint && (state.layerVisibility || {})[p.layer] === false) return;
                if (p.x != null && !isNaN(p.x) && (p.floor === floor || p.floor === 'ALL')) { if (p.x < mx) mx = p.x; if (p.x > Mxx) Mxx = p.x; if (p.y < my) my = p.y; if (p.y > Mxy) Mxy = p.y; } 
            });

            if (mx === Infinity) { mx = 0; my = 0; Mxx = 1000; Mxy = 1000; }
            let dx = Mxx - mx || 1000, dy = Mxy - my || 1000;

            const scaleInputId = document.getElementById('scale-plan') ? 'scale-plan' : 'scale-floor';
            const userScale = parseFloat(document.getElementById(scaleInputId)?.value) || 100;
            let sf = (1 / userScale) * 11.81;
            
            const padCAD = 50 / (1 / userScale);
            mx -= padCAD; Mxx += padCAD; my -= padCAD; Mxy += padCAD;
            dx = Mxx - mx; dy = Mxy - my;

            let cW = dx * sf, cH = dy * sf;
            const MAX_PX = 4096; let sfFinal = sf;
            if (cW > MAX_PX || cH > MAX_PX) { let ratio = Math.min(MAX_PX / cW, MAX_PX / cH); cW *= ratio; cH *= ratio; sfFinal = sf * ratio; }

            const canvas = document.createElement('canvas'); canvas.width = cW; canvas.height = cH;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cW, cH);

            const toC = (x, y) => ({ cx: (x - mx) * sfFinal, cy: cH - ((y - my) * sfFinal) });

            // 2. Draw Background
            this.drawBackground(ctx, floor, toC, sfFinal, isPrint);

            // 3. Draw Areas
            if (mode === 'area') {
                this.drawAreaTributaries(ctx, floor, toC, isPrint);
            }
            this.drawAreaPolygons(ctx, state.areaLines.filter(a => a.floor === floor), toC, { showAreaDims, dimScale });

            // 4. Draw Structural Elements
            this.drawStructuralElements(ctx, floor, mode, toC, isPrint);

            // 5. Draw Scale
            ctx.font = "bold 32px sans-serif"; ctx.fillStyle = "#333"; ctx.textAlign = "right";
            ctx.fillText(`S = 1 / ${userScale}`, canvas.width - 60, canvas.height - 60);

            return { img: canvas.toDataURL('image/png'), physW: dx / userScale, physH: dy / userScale };
        } catch (e) {
            console.error("Structural plan generation error:", e);
            return null;
        }
    },

    /**
     * Helper to draw structural elements
     */
    drawStructuralElements: function(ctx, floor, mode, toC, isPrint) {
        const state = window.AppState;
        state.pillars.filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === floor || p.floor === 'ALL')).forEach(p => {
            if (!isPrint && state.layerVisibility[p.layer] === false) return;
            let pt = toC(p.x, p.y);
            ctx.fillStyle = '#333';
            let isC = p.isManualCorner !== null ? p.isManualCorner : p.isCornerAuto;
            if (isC) { ctx.beginPath(); ctx.arc(pt.cx, pt.cy, 18, 0, Math.PI * 2); ctx.fill(); } 
            else { ctx.fillRect(pt.cx - 16, pt.cy - 16, 32, 32); }

            if (mode === 'n-value' && p.nMark && p.nMark !== "不要" && p.nMark !== "-") {
                this.drawNValueLabel(ctx, pt, p.nMark);
            }
        });

        state.walls.filter(w => w.floor === floor).forEach(w => {
            if (!isPrint && (state.layerVisibility || {})[w.layer] === false) return;
            let p1 = toC(w.p1.x, w.p1.y), p2 = toC(w.p2.x, w.p2.y);
            const isWallMode = mode === 'wall';
            ctx.lineWidth = isWallMode ? 10 : 3;
            ctx.strokeStyle = isWallMode ? (floor === '1F' ? '#27ae60' : '#d35400') : '#000';
            ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();

            if (isWallMode) {
                // 壁記号と番号の描画
                this.drawWallDetails(ctx, w, p1, p2, isPrint);
            }
        });
    },

    /**
     * Draw wall symbols and ID marks for reports
     */
    drawWallDetails: function(ctx, w, p1, p2, isPrint) {
        const mX = (p1.cx + p2.cx) / 2, mY = (p1.cy + p2.cy) / 2;
        
        // 1. 筋交いアイコン
        const braceSpec = window.WallEngine.getBraceSpec(w.braceId);
        let braceVal = braceSpec.val || 0;
        let braceText = braceSpec.text || "";
        if (braceVal === 0 && w.braceVal > 0) {
            braceVal = w.braceVal;
            braceText = w.braceName || (w.isTasuki ? "Ｘ" : "／");
        }

        if (braceVal > 0) {
            ctx.save(); ctx.translate(mX, mY); ctx.rotate(Math.atan2(p2.cy - p1.cy, p2.cx - p1.cx));
            ctx.fillStyle = '#e74c3c';
            if (braceText.includes('たすき') || braceText.includes('Ｘ')) {
                ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.lineTo(15, -15); ctx.closePath(); ctx.fill();
                ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-15, 0); ctx.lineTo(-15, -15); ctx.closePath(); ctx.fill();
            } else {
                ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.lineTo(15, -15); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        }

        // 2. 面材記号
        const spec1 = window.WallEngine.getWallSpec(w.outPanelId);
        const spec2 = window.WallEngine.getWallSpec(w.inPanelId);
        let m1 = (spec1 && spec1.id !== "opt0") ? spec1.text.charAt(0) : "";
        let m2 = (spec2 && spec2.id !== "opt0") ? spec2.text.charAt(0) : "";
        if (!m1 && w.outPanelVal > 0) m1 = (w.outPanelName || "P").charAt(0);
        if (!m2 && w.inPanelVal > 0) m2 = (w.inPanelName || "P").charAt(0);
        
        const mark = [m1, m2].filter(x => x).join('+');
        if (mark) {
            ctx.font = 'bold 24px sans-serif'; ctx.textAlign = "center";
            const isVertical = Math.abs(p1.cy - p2.cy) > Math.abs(p1.cx - p2.cx);
            const offX = isVertical ? 35 : 0, offY = isVertical ? 0 : -20;
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            const tw = ctx.measureText(mark).width;
            ctx.fillRect(mX + offX - tw/2 - 5, mY + offY - 20, tw + 10, 30);
            ctx.fillStyle = '#2c3e50';
            ctx.fillText(mark, mX + offX, mY + offY + 5);
        }

        // 3. 耐力壁番号
        if (w.mark) {
            ctx.font = '20px sans-serif'; ctx.fillStyle = '#666'; ctx.textAlign = "center";
            const isV = Math.abs(p1.cy - p2.cy) > Math.abs(p1.cx - p2.cx);
            const ox = isV ? -35 : 0, oy = isV ? 0 : 35;
            ctx.fillText(w.mark, mX + ox, mY + oy);
        }
    },

    drawBackground: function(ctx, floor, toC, sfFinal, isPrint) {
        const state = window.AppState;
        ctx.save();
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#cccccc';
        state.bgLinesOriginal.filter(e => {
            if (!e.isUnderlay) return false;
            if (isPrint) return (e.layer || "").toUpperCase().includes('BG_' + floor);
            return (e.floor === floor || e.floor === 'ALL');
        }).forEach(e => {
            if (!isPrint && (state.layerVisibility || {})[e.layer] === false) return;
            if (e.isGridLine) return;
            ctx.beginPath();
            if (e.type === 'LINE' && e.vertices) { 
                let p1 = toC(e.vertices[0].x, e.vertices[0].y), p2 = toC(e.vertices[1].x, e.vertices[1].y); 
                ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); 
            } else if (['LWPOLYLINE', 'POLYLINE'].includes(e.type) && e.vertices) {
                e.vertices.forEach((v, i) => { let p = toC(v.x, v.y); i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy); });
                if (e.closed) ctx.closePath();
            }
            ctx.stroke();
        });
        ctx.restore();
    },

    drawNValueLabel: function(ctx, pt, mark) {
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 28px sans-serif";
        let textWidth = ctx.measureText(mark).width;
        ctx.fillStyle = '#fff'; ctx.fillRect(pt.cx - textWidth / 2 - 10, pt.cy - 14 - 8, textWidth + 20, 28 + 16);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(pt.cx - textWidth / 2 - 10, pt.cy - 14 - 8, textWidth + 20, 28 + 16);
        ctx.fillStyle = '#c0392b'; ctx.fillText(mark, pt.cx, pt.cy);
    },

    drawAreaTributaries: function(ctx, floor, toC, isPrint) {
        const state = window.AppState;
        ctx.save();
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#27ae60'; ctx.setLineDash([5, 5]);
        state.pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === floor).forEach(p => {
            if (!isPrint && state.layerVisibility[p.layer] === false) return;
            const polys = p.tributaryPolygons || (p.tributaryPolygon ? [p.tributaryPolygon] : []);
            polys.forEach(poly => {
                if (poly && poly.length >= 3) {
                    ctx.fillStyle = 'rgba(46, 204, 113, 0.1)';
                    ctx.beginPath();
                    poly.forEach((v, i) => { let cp = toC(v.x, v.y); if (i === 0) ctx.moveTo(cp.cx, cp.cy); else ctx.lineTo(cp.cx, cp.cy); });
                    ctx.closePath(); ctx.fill(); ctx.stroke();

                    // 面積値の描画
                    const areaVal = p.loadArea || 0;
                    if (areaVal > 0) {
                        const pt = toC(p.x, p.y);
                        const txt = areaVal.toFixed(2) + " ㎡";
                        ctx.save();
                        ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                        const tw = ctx.measureText(txt).width;
                        ctx.fillStyle = "rgba(255,255,255,0.8)";
                        ctx.fillRect(pt.cx - tw/2 - 5, pt.cy + 25, tw + 10, 34);
                        ctx.strokeStyle = "#2ecc71"; ctx.lineWidth = 2;
                        ctx.strokeRect(pt.cx - tw/2 - 5, pt.cy + 25, tw + 10, 34);
                        ctx.fillStyle = "#27ae60";
                        ctx.fillText(txt, pt.cx, pt.cy + 42);
                        ctx.restore();
                    }
                }
            });
        });
        ctx.restore();
    }
};
