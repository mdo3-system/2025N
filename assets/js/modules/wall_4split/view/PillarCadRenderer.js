if (typeof window.isFloorMatched !== 'function') {
    window.isFloorMatched = function(itemFloor, currentFloor) {
        if (!itemFloor || itemFloor === 'ALL') return true;
        if (itemFloor === currentFloor) return true;
        const cur = String(currentFloor || '1F').toUpperCase().trim();
        const item = String(itemFloor).toUpperCase().trim();
        if (cur === item) return true;
        const is1FGroup = (f) => f === '1F' || f === '1R' || f === '1RF' || f === '1F_R';
        const is2FGroup = (f) => f === '2F' || f === '2R' || f === '2RF' || f === '2F_R' || f === 'RF';
        if (is1FGroup(cur) && is1FGroup(item)) return true;
        if (is2FGroup(cur) && is2FGroup(item)) return true;
        return false;
    };
}

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
            .filter(p => !p.isDeleted && !p.isInvalidPos && window.isFloorMatched(p.floor, state.currentFloor))
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
        ctx.lineWidth   = 1.0;
        ctx.strokeStyle = '#27ae60';
        ctx.setLineDash([4, 4]); // v1.16b 準拠の緑破線

        const renderer = window.MainRenderer;

        state.pillars
            .filter(p => !p.isDeleted && !p.isInvalidPos && window.isFloorMatched(p.floor, state.currentFloor))
            .forEach(p => {
                const polys = p.tributaryPolygons || (p.tributaryPolygon ? (Array.isArray(p.tributaryPolygon[0]) ? p.tributaryPolygon : [p.tributaryPolygon]) : []);
                if (polys.length === 0) return;

                // ボロノイ境界線（破線）の描画
                ctx.fillStyle = 'rgba(46, 204, 113, 0.08)';
                ctx.setLineDash([4, 4]);
                polys.forEach(poly => {
                    if (!poly || poly.length < 3) return;
                    ctx.beginPath();
                    poly.forEach((v, i) => {
                        const c = renderer ? renderer.toCanvas(v, null, state) : { cx: 0, cy: 0 };
                        i === 0 ? ctx.moveTo(c.cx, c.cy) : ctx.lineTo(c.cx, c.cy);
                    });
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                });

                // 負担面積数値ラベル（白背景バッジ＋緑文字）
                const areaVal = p.loadArea || 0;
                if (areaVal > 0) {
                    ctx.setLineDash([]); // バッジ枠は実線
                    const pt  = renderer ? renderer.toCanvas(p, null, state) : { cx: 0, cy: 0 };
                    const txt = areaVal.toFixed(2) + ' ㎡';
                    ctx.font         = 'bold 12px sans-serif';
                    ctx.textAlign    = 'center';
                    ctx.textBaseline = 'middle';

                    const metrics = ctx.measureText(txt);
                    const padding = 3;
                    const rectW   = metrics.width + padding * 2;
                    const rectH   = 16;
                    const rx      = pt.cx - rectW / 2;
                    const ry      = pt.cy + 10;

                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(rx, ry, rectW, rectH, 3);
                    else ctx.rect(rx, ry, rectW, rectH);
                    ctx.fill();

                    ctx.strokeStyle = '#27ae60';
                    ctx.lineWidth   = 1.0;
                    ctx.stroke();

                    ctx.fillStyle = '#27ae60';
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
