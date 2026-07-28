/**
 * view/PillarCadRenderer.js - Pillar CAD Drawing Module
 * v3.3.0 Refactoring: Single Responsibility Principle
 * 
 * Responsible for: Drawing pillar symbols, N-value labels, tributary area polygons on canvas.
 * Extracted from: MainRenderer.js (drawPillars, drawPillarNValue methods)
 */

window.PillarCadRenderer = {
    /**
     * 柱シンボル・N値ラベルを描画する
     * @param {Object} state - AppStateへの参照（ctx, pillars, currentFloor, etc.）
     */
    drawPillars: function(state) {
        if (!state.elementVisibility.pillars) return;
        const ctx = state.ctx;
        const isPrintMode = state.isPrintMode;

        state.pillars
            .filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === state.currentFloor || p.floor === 'ALL' || !p.floor))
            .filter(p => !state.layerVisibility || !p.layer || state.layerVisibility[p.layer] !== false)
            .forEach(p => {
                const renderer = window.MainRenderer;
                const pt = renderer ? renderer.toCanvas(p, null, state) : { cx: null, cy: null };
                if (pt.cx == null) return;

                const isSelected = state.selectedPillar === p;
                const isHovered  = state.hoveredPillar === p;

                ctx.fillStyle   = isPrintMode ? '#333' : (isSelected ? '#e74c3c' : (isHovered ? '#e67e22' : (p.isManual ? '#2ecc71' : '#3498db')));
                ctx.strokeStyle = isPrintMode ? '#000000' : '#ffffff';
                ctx.lineWidth   = 1.5;

                const isCorner = p.isManualCorner !== null ? p.isManualCorner : p.isCornerAuto;
                if (isCorner) {
                    ctx.beginPath();
                    ctx.arc(pt.cx, pt.cy, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.rect(pt.cx - 7, pt.cy - 7, 14, 14);
                    ctx.fill();
                    ctx.stroke();
                }

                // N値ラベル
                if (
                    state.elementVisibility.pillarNValues &&
                    (window.getMode() === 'n-value' || window.getMode() === 'select') &&
                    p.nValue !== undefined &&
                    !['不要', '-'].includes(p.nMark)
                ) {
                    this.drawPillarNValue(ctx, p, pt, state);
                }

                // 柱番号 (選択・追加モード時)
                if (window.getMode() === 'select' || window.getMode() === 'add-pillar') {
                    ctx.fillStyle = isPrintMode ? '#333' : '#aaa';
                    ctx.font      = '9px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(p.pId || p.id, pt.cx, pt.cy + 15);
                }
            });
    },

    /**
     * 柱のN値ラベルを描画する
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} p - pillar
     * @param {Object} pt - {cx, cy}
     * @param {Object} state
     */
    drawPillarNValue: function(ctx, p, pt, state) {
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = 'bold 12px sans-serif';
        const tw         = ctx.measureText(p.nMark).width;
        ctx.fillStyle    = state.isPrintMode ? '#fff' : 'rgba(255,255,255,0.9)';
        ctx.fillRect(pt.cx - tw / 2 - 4, pt.cy - 8, tw + 8, 16);
        ctx.fillStyle = '#c0392b';
        ctx.fillText(p.nMark, pt.cx, pt.cy);
    },

    /**
     * 負担面積ポリゴン・数値ラベルを描画する（面積モード時）
     * @param {Object} state
     */
    drawTributaryAreas: function(state) {
        const ctx = state.ctx;
        ctx.save();
        ctx.lineWidth    = 2.0;
        ctx.strokeStyle  = '#27ae60';
        ctx.setLineDash([]); // [v3.3.0] 破線を廃止し、ボロノイ境界分割線をクッキリした実線で可視化

        const renderer = window.MainRenderer;

        state.pillars
            .filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === state.currentFloor)
            .forEach(p => {
                if (!p.tributaryPolygon || p.tributaryPolygon.length === 0) return;

                ctx.fillStyle = 'rgba(46, 204, 113, 0.15)';
                p.tributaryPolygon.forEach(poly => {
                    ctx.beginPath();
                    poly.forEach((v, i) => {
                        const c = renderer ? renderer.toCanvas(v, null, state) : { cx: 0, cy: 0 };
                        i === 0 ? ctx.moveTo(c.cx, c.cy) : ctx.lineTo(c.cx, c.cy);
                    });
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                });

                // 負担面積数値
                const areaVal = p.loadArea || 0;
                if (areaVal > 0) {
                    const pt  = renderer ? renderer.toCanvas(p, null, state) : { cx: 0, cy: 0 };
                    const txt = areaVal.toFixed(2) + ' ㎡';
                    ctx.font          = 'bold 13px sans-serif';
                    ctx.textAlign     = 'center';
                    ctx.textBaseline  = 'middle';

                    const metrics = ctx.measureText(txt);
                    const padding = 4;
                    const rectW   = metrics.width + padding * 2;
                    const rectH   = 18;
                    const rx      = pt.cx - rectW / 2;
                    const ry      = pt.cy + 12;

                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(rx, ry, rectW, rectH, 4);
                    else ctx.rect(rx, ry, rectW, rectH);
                    ctx.fill();

                    ctx.strokeStyle = '#2ecc71';
                    ctx.lineWidth   = 1.5;
                    ctx.stroke();

                    ctx.fillStyle = '#2ecc71';
                    ctx.font      = 'bold 13px sans-serif';
                    ctx.fillText(txt, pt.cx, ry + rectH / 2);
                }
            });

        ctx.setLineDash([]);
        ctx.restore();
    }
};

// Register with ServiceContainer
if (window.ServiceContainer) {
    window.ServiceContainer.register('PillarCadRenderer', window.PillarCadRenderer);
}
