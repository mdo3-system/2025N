/**
 * view/WallCadRenderer.js - Pure CAD Wall Renderer
 * v3.2.1 Refactoring: Single Responsibility Principle & Pure View Component
 */

window.WallCadRenderer = {
    /**
     * 耐力壁を描画
     */
    drawWalls: function(state) {
        const ctx = state.ctx;
        const isPrintMode = state.isPrintMode;
        const walls = (state.walls || []).filter(w => w.floor === state.currentFloor);
        const getWallTotalVal = window.getWallTotalVal || ((w) => (w.braceVal || 0) + (w.outPanelVal || 0) + (w.inPanelVal || 0));

        const toCanvas = (x, y) => {
            const p = window.toCanvasPixel ? window.toCanvasPixel(x, y) : { cx: x, cy: y };
            return { cx: p.cx, cy: p.cy };
        };

        walls.forEach(w => {
            const p1 = toCanvas(w.p1.x, w.p1.y);
            const p2 = toCanvas(w.p2.x, w.p2.y);
            if (p1.cx == null) return;

            const tv = getWallTotalVal(w);
            const isDiag = (Math.abs(w.p1.x - w.p2.x) > 10 && Math.abs(w.p1.y - w.p2.y) > 10);
            
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(p1.cx, p1.cy);
            ctx.lineTo(p2.cx, p2.cy);

            if (tv > 0) {
                ctx.strokeStyle = isPrintMode ? '#000' : (isDiag ? '#e74c3c' : '#2ecc71');
                ctx.lineWidth = 4;
            } else {
                ctx.strokeStyle = isPrintMode ? '#777' : '#95a5a6';
                ctx.lineWidth = 2;
                ctx.setLineDash([3, 3]);
            }
            ctx.stroke();
            ctx.restore();

            // 筋交い（X印・斜線）の描画
            if (w.braceVal > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(p1.cx, p1.cy);
                ctx.lineTo(p2.cx, p2.cy);
                ctx.strokeStyle = isPrintMode ? '#333' : '#e67e22';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }

            // 倍率・内訳テキストラベル
            if (tv > 0 && !isPrintMode) {
                const mx = (p1.cx + p2.cx) / 2;
                const my = (p1.cy + p2.cy) / 2;
                ctx.save();
                ctx.font = 'bold 9px sans-serif';
                ctx.fillStyle = '#2c3e50';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`×${tv.toFixed(1)}`, mx, my - 8);
                ctx.restore();
            }
        });
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('WallCadRenderer', window.WallCadRenderer);
}
