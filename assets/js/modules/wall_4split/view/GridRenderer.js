/**
 * view/GridRenderer.js - Pure CAD Grid & Axis Renderer
 * v3.2.3 Refactoring: Restored Original Viewport Grid & Staggered Label Rendering
 */

window.GridRenderer = {
    /**
     * グリッドと通り芯を描画（メインエントリーポイント）
     */
    drawGrids: function(state) {
        const hasStandardGrids = state.gridXCoords && state.gridYCoords && (state.gridXCoords.length > 0 || state.gridYCoords.length > 0);
        
        // 1. 標準グリッドの描画
        if (state.elementVisibility && state.elementVisibility.grids && hasStandardGrids) {
            if (state.currentAppMode === 'roof') {
                const ctx = state.ctx;
                ctx.save();
                ctx.globalAlpha = 0.25;
                this.drawStandardGrids(state);
                ctx.restore();
            } else {
                this.drawStandardGrids(state);
            }
        }
        
        // 2. 屋根グリッドの描画
        if (state.currentAppMode === 'roof') {
            if (typeof window.drawRoofGrids === 'function') {
                window.drawRoofGrids(state);
            } else if (window.MainRenderer && typeof window.MainRenderer.drawRoofGrids === 'function') {
                window.MainRenderer.drawRoofGrids(state);
            }
        }
    },

    /**
     * 標準通り芯（X/Y軸線・端部ラベル）の描画
     */
    drawStandardGrids: function(state) {
        const ctx = state.ctx;
        if (!ctx || !state.canvas) return;

        const _dprGR = window.devicePixelRatio || 1;
        const cssW = state.canvas.width / _dprGR;
        const cssH = state.canvas.height / _dprGR;

        ctx.save();
        ctx.strokeStyle = state.isPrintMode ? '#555' : '#8e44ad';
        ctx.setLineDash([5, 5]);
        
        const hasY = state.gridYCoords && state.gridYCoords.length > 0;
        const hasX = state.gridXCoords && state.gridXCoords.length > 0;

        const toCanvas = (x, y) => {
            const p = window.toCanvasPixel ? window.toCanvasPixel(x, y) : { cx: x, cy: y };
            return { cx: p.cx, cy: p.cy };
        };

        // グリッド線および寸法線の境界をキャンバス全体（最外周部）に設定
        const botY = cssH - 45;
        const rightX = cssW - 65;

        const visibleLeft = -state.offsetX / state.scale;
        const visibleTop = (state.canvas.height - state.offsetY) / state.scale;
        const labelFontSize = Math.max(10, Math.min(20, 14 / state.scale));
        const labelPad = 10 / state.scale;

        // X方向通り芯描画（上端端部ラベル＋キャンバス最下部まで伸ばすグリッド線）
        let lastCx = -Infinity;
        let staggerLevelX = 0;
        const sortedXIndices = state.gridXCoords.map((v, i) => i).sort((a, b) => state.gridXCoords[a] - state.gridXCoords[b]);

        sortedXIndices.forEach(i => {
            const x = state.gridXCoords[i];
            const cx = toCanvas(x, 0).cx;
            if (cx != null) {
                const baseLabelY = Math.max(toCanvas(0, visibleTop - labelPad).cy, 15);
                const textEstWidth = labelFontSize * 1.8;
                if (cx - lastCx < textEstWidth) {
                    staggerLevelX = (staggerLevelX + 1) % 3;
                } else {
                    staggerLevelX = 0;
                }
                lastCx = cx;
                
                const labelY = baseLabelY + staggerLevelX * (labelFontSize + 4);

                ctx.save();
                ctx.font = `bold ${labelFontSize}px sans-serif`;
                
                const lineTopY = labelY + 6; 
                ctx.beginPath(); 
                ctx.moveTo(cx, lineTopY); 
                ctx.lineTo(cx, botY); 
                ctx.stroke();

                const txt = state.gridXNames?.[i] || `X${i+1}`;
                ctx.textAlign = "center";
                ctx.strokeStyle = state.isPrintMode ? '#fff' : 'rgba(30,30,30,0.7)'; 
                ctx.lineWidth = 3;
                ctx.strokeText(txt, cx, labelY);
                ctx.fillStyle = state.isPrintMode ? '#2c3e50' : '#2ecc71';
                ctx.fillText(txt, cx, labelY);
                ctx.restore();
            }
        });

        // Y方向通り芯描画（左端端部ラベル＋キャンバス最右部まで伸ばすグリッド線）
        let lastCy = -Infinity;
        let staggerLevelY = 0;
        const sortedYIndices = state.gridYCoords.map((v, i) => i).sort((a, b) => {
            const cyA = toCanvas(0, state.gridYCoords[a]).cy;
            const cyB = toCanvas(0, state.gridYCoords[b]).cy;
            return cyA - cyB;
        });

        sortedYIndices.forEach(i => {
            const y = state.gridYCoords[i];
            const cy = toCanvas(0, y).cy;
            if (cy != null) {
                const baseLabelX = Math.max(toCanvas(visibleLeft + labelPad, 0).cx, 5);
                const textEstHeight = labelFontSize * 1.2;
                if (cy - lastCy < textEstHeight) {
                    staggerLevelY = (staggerLevelY + 1) % 3;
                } else {
                    staggerLevelY = 0;
                }
                lastCy = cy;

                const labelX = baseLabelX + staggerLevelY * (labelFontSize * 2);

                ctx.save();
                ctx.font = `bold ${labelFontSize}px sans-serif`;
                
                const txt = state.gridYNames?.[i] || `Y${i+1}`;
                const tw = ctx.measureText(txt).width;
                const lineStartX = labelX + tw + 6;

                ctx.beginPath(); 
                ctx.moveTo(lineStartX, cy); 
                ctx.lineTo(rightX, cy); 
                ctx.stroke();

                ctx.textAlign = "left";
                ctx.strokeStyle = state.isPrintMode ? '#fff' : 'rgba(30,30,30,0.7)'; 
                ctx.lineWidth = 3;
                ctx.strokeText(txt, labelX, cy + 5);
                ctx.fillStyle = state.isPrintMode ? '#2c3e50' : '#2ecc71';
                ctx.fillText(txt, labelX, cy + 5);
                ctx.restore();
            }
        });

        // 斜め通り芯描画
        if (state.manualGridAngle && state.manualGridAngle.length > 0) {
            state.manualGridAngle.forEach(g => {
                const c1 = toCanvas(g.p1.x, g.p1.y);
                const c2 = toCanvas(g.p2.x, g.p2.y);
                if (!c1 || !c2) return;

                const dx = c2.cx - c1.cx, dy = c2.cy - c1.cy;
                const len = Math.hypot(dx, dy);
                if (len < 5) return; 

                const ux = dx / len, uy = dy / len;
                const extension = 10000;
                const startX = c1.cx - ux * extension;
                const startY = c1.cy - uy * extension;
                const endX = c2.cx + ux * extension;
                const endY = c2.cy + uy * extension;

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = state.isPrintMode ? '#e74c3c' : '#f1c40f';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([6, 4]);
                ctx.stroke();
                ctx.restore();
            });
        }

        // 5. 通り芯間寸法線（X方向下側、Y方向右側）の描画
        this.drawGridDimensions(state, ctx, toCanvas, sortedXIndices, sortedYIndices, botY, rightX);

        ctx.restore();
    },

    /**
     * 通り芯（グリッド）間寸法線の描画 (X方向: 下側, Y方向: 右側)
     */
    drawGridDimensions: function(state, ctx, toCanvas, sortedXIndices, sortedYIndices, botY, rightX) {
        state.gridDimHitBoxes = [];
        const fontSize = Math.max(9, Math.min(13, 11 / (state.scale || 1)));
        ctx.save();
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.strokeStyle = state.isPrintMode ? '#333' : '#2980b9';
        ctx.fillStyle = state.isPrintMode ? '#111' : '#1b4f72';
        ctx.lineWidth = 1;
        ctx.setLineDash([]); // 実線

        const _dprGD = window.devicePixelRatio || 1;
        const cssW = state.canvas.width / _dprGD;
        const cssH = state.canvas.height / _dprGD;
        const tickSize = 4;

        // --- X方向 グリッド間寸法 (キャンバス最下部固定) ---
        if (sortedXIndices && sortedXIndices.length >= 2) {
            const dimY = cssH - 35;
            const totalDimY = cssH - 16;

            // スパン個別寸法
            for (let k = 0; k < sortedXIndices.length - 1; k++) {
                const i1 = sortedXIndices[k];
                const i2 = sortedXIndices[k + 1];
                const x1 = state.gridXCoords[i1];
                const x2 = state.gridXCoords[i2];
                const cx1 = toCanvas(x1, 0).cx;
                const cx2 = toCanvas(x2, 0).cx;
                const span = Math.round(x2 - x1);

                // 引き出し補助線（グリッド下端から寸法線まで）
                ctx.save();
                ctx.strokeStyle = state.isPrintMode ? '#bbb' : 'rgba(41, 128, 185, 0.4)';
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(cx1, botY);
                ctx.lineTo(cx1, totalDimY + 4);
                if (k === sortedXIndices.length - 2) {
                    ctx.moveTo(cx2, botY);
                    ctx.lineTo(cx2, totalDimY + 4);
                }
                ctx.stroke();
                ctx.restore();

                // 寸法線
                ctx.beginPath();
                ctx.moveTo(cx1, dimY);
                ctx.lineTo(cx2, dimY);
                // 45度スラッシュ目盛り
                ctx.moveTo(cx1 - tickSize, dimY + tickSize);
                ctx.lineTo(cx1 + tickSize, dimY - tickSize);
                ctx.moveTo(cx2 - tickSize, dimY + tickSize);
                ctx.lineTo(cx2 + tickSize, dimY - tickSize);
                ctx.stroke();

                // 寸法テキスト
                const midX = (cx1 + cx2) / 2;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(`${span}`, midX, dimY - 2);

                // クリック判定領域を登録
                state.gridDimHitBoxes.push({
                    axis: 'X',
                    spanIndex: k,
                    span: span,
                    x: midX,
                    y: dimY - 7,
                    w: Math.max(30, Math.abs(cx2 - cx1)),
                    h: fontSize + 10
                });
            }

            // 全体総スパン寸法
            const firstIdx = sortedXIndices[0];
            const lastIdx = sortedXIndices[sortedXIndices.length - 1];
            const startCx = toCanvas(state.gridXCoords[firstIdx], 0).cx;
            const endCx = toCanvas(state.gridXCoords[lastIdx], 0).cx;
            const totalSpanX = Math.round(state.gridXCoords[lastIdx] - state.gridXCoords[firstIdx]);

            ctx.beginPath();
            ctx.moveTo(startCx, totalDimY);
            ctx.lineTo(endCx, totalDimY);
            ctx.moveTo(startCx - tickSize, totalDimY + tickSize);
            ctx.lineTo(startCx + tickSize, totalDimY - tickSize);
            ctx.moveTo(endCx - tickSize, totalDimY + tickSize);
            ctx.lineTo(endCx + tickSize, totalDimY - tickSize);
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`全体 ${totalSpanX}`, (startCx + endCx) / 2, totalDimY - 2);
        }

        // --- Y方向 グリッド間寸法 (キャンバス最右部固定) ---
        if (sortedYIndices && sortedYIndices.length >= 2) {
            const dimX = cssW - 55;
            const totalDimX = cssW - 20;

            // スパン個別寸法
            for (let k = 0; k < sortedYIndices.length - 1; k++) {
                const i1 = sortedYIndices[k];
                const i2 = sortedYIndices[k + 1];
                const y1 = state.gridYCoords[i1];
                const y2 = state.gridYCoords[i2];
                const cy1 = toCanvas(0, y1).cy;
                const cy2 = toCanvas(0, y2).cy;
                const span = Math.round(Math.abs(y2 - y1));

                // 引き出し補助線（グリッド右端から寸法線まで）
                ctx.save();
                ctx.strokeStyle = state.isPrintMode ? '#bbb' : 'rgba(41, 128, 185, 0.4)';
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(rightX, cy1);
                ctx.lineTo(totalDimX + 4, cy1);
                if (k === sortedYIndices.length - 2) {
                    ctx.moveTo(rightX, cy2);
                    ctx.lineTo(totalDimX + 4, cy2);
                }
                ctx.stroke();
                ctx.restore();

                // 寸法線
                ctx.beginPath();
                ctx.moveTo(dimX, cy1);
                ctx.lineTo(dimX, cy2);
                // 45度スラッシュ目盛り
                ctx.moveTo(dimX - tickSize, cy1 + tickSize);
                ctx.lineTo(dimX + tickSize, cy1 - tickSize);
                ctx.moveTo(dimX - tickSize, cy2 + tickSize);
                ctx.lineTo(dimX + tickSize, cy2 - tickSize);
                ctx.stroke();

                // 寸法テキスト
                const midY = (cy1 + cy2) / 2;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${span}`, dimX + 5, midY);

                // クリック判定領域を登録
                state.gridDimHitBoxes.push({
                    axis: 'Y',
                    spanIndex: k,
                    span: span,
                    x: dimX + 15,
                    y: midY,
                    w: fontSize * 3 + 10,
                    h: Math.max(20, Math.abs(cy2 - cy1))
                });
            }

            // 全体総スパン寸法
            const firstIdx = sortedYIndices[0];
            const lastIdx = sortedYIndices[sortedYIndices.length - 1];
            const startCy = toCanvas(0, state.gridYCoords[firstIdx]).cy;
            const endCy = toCanvas(0, state.gridYCoords[lastIdx]).cy;
            const totalSpanY = Math.round(Math.abs(state.gridYCoords[lastIdx] - state.gridYCoords[firstIdx]));

            ctx.beginPath();
            ctx.moveTo(totalDimX, startCy);
            ctx.lineTo(totalDimX, endCy);
            ctx.moveTo(totalDimX - tickSize, startCy + tickSize);
            ctx.lineTo(totalDimX + tickSize, startCy - tickSize);
            ctx.moveTo(totalDimX - tickSize, endCy + tickSize);
            ctx.lineTo(totalDimX + tickSize, endCy - tickSize);
            ctx.stroke();

            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`全体 ${totalSpanY}`, totalDimX + 5, (startCy + endCy) / 2);
        }

        ctx.restore();
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('GridRenderer', window.GridRenderer);
}
