/**
 * view/GridRenderer.js - Pure CAD Grid & Axis Renderer
 * v3.2.1 Refactoring: Single Responsibility Principle & Pure View Component
 */

window.GridRenderer = {
    /**
     * グリッドと通り芯を描画
     */
    drawGrids: function(state) {
        const ctx = state.ctx;
        const isPrintMode = state.isPrintMode;
        const grids = state.grids || [];
        const floorPillars = (state.pillars || []).filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === state.currentFloor || p.floor === 'ALL'));
        
        let activeX = new Set(), activeY = new Set();
        floorPillars.forEach(p => {
            if (p.gx) activeX.add(p.gx);
            if (p.gy) activeY.add(p.gy);
        });

        const gxCoords = (state.gridXCoords && state.gridXCoords.length > 0) 
            ? state.gridXCoords 
            : [...new Set(grids.map(g => g.x))].sort((a, b) => a - b);
        const gyCoords = (state.gridYCoords && state.gridYCoords.length > 0) 
            ? state.gridYCoords 
            : [...new Set(grids.map(g => g.y))].sort((a, b) => a - b);

        const xMin = gxCoords.length > 0 ? gxCoords[0] : 0;
        const xMax = gxCoords.length > 0 ? gxCoords[gxCoords.length - 1] : 10000;
        const yMin = gyCoords.length > 0 ? gyCoords[0] : 0;
        const yMax = gyCoords.length > 0 ? gyCoords[gyCoords.length - 1] : 10000;

        const toCanvas = (x, y) => {
            const p = window.toCanvasPixel ? window.toCanvasPixel(x, y) : { cx: x, cy: y };
            return { cx: p.cx, cy: p.cy };
        };

        // 1. X方向通り芯
        gxCoords.forEach((xVal, idx) => {
            const name = state.gridXNames?.[idx] || (window.GridEngine ? window.GridEngine.getGridXName(idx) : `X${idx+1}`);
            const isActive = activeX.has(name);
            const p1 = toCanvas(xVal, yMin - 1500);
            const p2 = toCanvas(xVal, yMax + 1500);
            if (p1.cx == null) return;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(p1.cx, p1.cy);
            ctx.lineTo(p2.cx, p2.cy);
            ctx.strokeStyle = isPrintMode ? (isActive ? '#333' : '#ccc') : (isActive ? '#4b6584' : '#2f3640');
            ctx.lineWidth = isActive ? 1.5 : 1;
            if (!isActive) ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.restore();

            // 通り芯名バッジ
            ctx.save();
            ctx.fillStyle = isActive ? (isPrintMode ? '#2c3e50' : '#4b6584') : (isPrintMode ? '#95a5a6' : '#718093');
            ctx.beginPath();
            ctx.arc(p1.cx, p1.cy - 12, 10, 0, Math.PI * 2);
            ctx.arc(p2.cx, p2.cy + 12, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(name, p1.cx, p1.cy - 12);
            ctx.fillText(name, p2.cx, p2.cy + 12);
            ctx.restore();
        });

        // 2. Y方向通り芯
        gyCoords.forEach((yVal, idx) => {
            const name = state.gridYNames?.[idx] || (window.GridEngine ? window.GridEngine.getGridYName(idx) : `Y${idx+1}`);
            const isActive = activeY.has(name);
            const p1 = toCanvas(xMin - 1500, yVal);
            const p2 = toCanvas(xMax + 1500, yVal);
            if (p1.cx == null) return;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(p1.cx, p1.cy);
            ctx.lineTo(p2.cx, p2.cy);
            ctx.strokeStyle = isPrintMode ? (isActive ? '#333' : '#ccc') : (isActive ? '#4b6584' : '#2f3640');
            ctx.lineWidth = isActive ? 1.5 : 1;
            if (!isActive) ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.restore();

            // 通り芯名バッジ
            ctx.save();
            ctx.fillStyle = isActive ? (isPrintMode ? '#2c3e50' : '#4b6584') : (isPrintMode ? '#95a5a6' : '#718093');
            ctx.beginPath();
            ctx.arc(p1.cx - 12, p1.cy, 10, 0, Math.PI * 2);
            ctx.arc(p2.cx + 12, p2.cy, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(name, p1.cx - 12, p1.cy);
            ctx.fillText(name, p2.cx + 12, p2.cy);
            ctx.restore();
        });
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('GridRenderer', window.GridRenderer);
}
