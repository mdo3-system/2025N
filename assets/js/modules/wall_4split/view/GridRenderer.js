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
        if (state.currentAppMode === 'roof' && typeof window.drawRoofGrids === 'function') {
            window.drawRoofGrids(state);
        }
    },

    /**
     * 標準通り芯（X/Y軸線・端部ラベル）の描画
     */
    drawStandardGrids: function(state) {
        const ctx = state.ctx;
        if (!ctx || !state.canvas) return;

        ctx.save();
        ctx.strokeStyle = state.isPrintMode ? '#555' : '#8e44ad';
        ctx.setLineDash([5, 5]);
        
        const hasY = state.gridYCoords && state.gridYCoords.length > 0;
        const hasX = state.gridXCoords && state.gridXCoords.length > 0;

        const gMinY = hasY ? Math.min(...state.gridYCoords) : 0;
        const gMaxY = hasY ? Math.max(...state.gridYCoords) : 0;
        const gMinX = hasX ? Math.min(...state.gridXCoords) : 0;
        const gMaxX = hasX ? Math.max(...state.gridXCoords) : 0;

        const toCanvas = (x, y) => {
            const p = window.toCanvasPixel ? window.toCanvasPixel(x, y) : { cx: x, cy: y };
            return { cx: p.cx, cy: p.cy };
        };

        const pTop = hasY ? toCanvas(0, gMaxY) : { cy: 0 };
        const pBot = hasY ? toCanvas(0, gMinY) : { cy: state.canvas.height };
        const pLeft = hasX ? toCanvas(gMinX, 0) : { cx: 0 };
        const pRight = hasX ? toCanvas(gMaxX, 0) : { cx: state.canvas.width };

        const botY = hasY ? pBot.cy + 30 : state.canvas.height;
        const rightX = hasX ? pRight.cx + 30 : state.canvas.width;

        const visibleLeft = -state.offsetX / state.scale;
        const visibleTop = (state.canvas.height - state.offsetY) / state.scale;
        const labelFontSize = Math.max(10, Math.min(20, 14 / state.scale));
        const labelPad = 10 / state.scale;

        // X方向通り芯描画（上端端部ラベル＋グリッド線）
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

        // Y方向通り芯描画（左端端部ラベル＋グリッド線）
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

        ctx.restore();
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('GridRenderer', window.GridRenderer);
}
