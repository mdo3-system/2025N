/**
 * view/WallCadRenderer.js - Pure CAD Wall & Brace Renderer
 * v3.4.3 Refactoring: Clean Wall Label Display (Restore v3.2.x Style)
 */

window.WallCadRenderer = {
    /**
     * 耐力壁・筋かい・壁番号を描画
     * @param {Object} state - AppStateへの参照
     */
    drawWalls: function(state) {
        if (!state.elementVisibility || !state.elementVisibility.walls) return;
        const ctx = state.ctx;
        if (!ctx) return;

        const isPrintMode = state.isPrintMode;
        const walls = (state.walls || []).filter(w => w.floor === state.currentFloor);
        const w1C = isPrintMode ? '#27ae60' : '#2ecc71';
        const w2C = isPrintMode ? '#d35400' : '#f39c12';

        const toCanvas = (x, y) => {
            if (window.toCanvasPixel) return window.toCanvasPixel(x, y);
            if (window.MainRenderer && typeof window.MainRenderer.toCanvas === 'function') {
                return window.MainRenderer.toCanvas({ x, y }, null, state);
            }
            return { cx: x, cy: y };
        };

        walls.forEach((w, index) => {
            if (!w.p1 || !w.p2) return;
            const p1 = toCanvas(w.p1.x, w.p1.y);
            const p2 = toCanvas(w.p2.x, w.p2.y);
            if (p1.cx == null || p2.cx == null) return;

            const totalMultiplier = window.WallEngine ? window.WallEngine.getTotalMultiplier(w) : (w.totalVal || 0);

            // 1. 耐力壁ベースラインの描画
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(p1.cx, p1.cy);
            ctx.lineTo(p2.cx, p2.cy);

            if (totalMultiplier > 0) {
                ctx.lineWidth = 5;
                ctx.strokeStyle = state.currentFloor === '1F' ? w1C : w2C;
            } else {
                ctx.lineWidth = 2;
                ctx.strokeStyle = isPrintMode ? '#777' : '#95a5a6';
                ctx.setLineDash([4, 4]);
            }
            ctx.stroke();
            ctx.restore();

            // 2. 筋かい・壁番号の描画 (v3.2.x スタイル)
            this.drawWallSymbols(ctx, w, p1, p2, totalMultiplier, index + 1, state);
        });
    },

    /**
     * 筋かいグラフィックおよび壁番号 (W1, W2...) の描画
     */
    drawWallSymbols: function(ctx, w, p1, p2, totalMultiplier, wallNo, state) {
        const mX = (p1.cx + p2.cx) / 2;
        const mY = (p1.cy + p2.cy) / 2;
        const isPrintMode = state.isPrintMode;

        // 筋かいスペックの取得
        const braceSpec = window.WallEngine ? window.WallEngine.getBraceSpec(w.braceId) : { val: 0, text: '' };
        let braceVal = braceSpec.val || 0;
        let braceText = braceSpec.text || "";

        if (braceVal === 0 && w.braceVal > 0) {
            braceVal = w.braceVal;
            braceText = w.braceName || (w.isTasuki ? "Ｘ" : "／");
        }

        // --- A. 筋かいグラフィック描画 (たすき X / シングル) ---
        if (braceVal > 0) {
            ctx.save();
            ctx.translate(mX, mY);
            ctx.rotate(Math.atan2(p2.cy - p1.cy, p2.cx - p1.cx));
            ctx.fillStyle = isPrintMode ? '#333' : '#e74c3c';

            if (braceText.includes('たすき') || braceText.includes('Ｘ') || w.isTasuki) {
                // 左からの対角
                ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(12, -12); ctx.closePath(); ctx.fill();
                // 右からの対角
                ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-12, 0); ctx.lineTo(-12, -12); ctx.closePath(); ctx.fill();
            } else {
                // 片筋かい
                ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(12, -12); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        }

        // --- B. 面材記号マークの取得 ---
        const spec1 = window.WallEngine ? window.WallEngine.getWallSpec(w.outPanelId) : null;
        const spec2 = window.WallEngine ? window.WallEngine.getWallSpec(w.inPanelId) : null;

        let mark1 = (spec1 && spec1.id !== "opt0") ? spec1.text.charAt(0) : "";
        let mark2 = (spec2 && spec2.id !== "opt0") ? spec2.text.charAt(0) : "";

        if (!mark1 && w.outPanelVal > 0) mark1 = (w.outPanelName || "P").charAt(0);
        if (!mark2 && w.inPanelVal > 0) mark2 = (w.inPanelName || "P").charAt(0);

        let marks = [];
        if (mark1) marks.push(mark1);
        if (mark2) marks.push(mark2);
        let mark = marks.join('+');

        // --- C. 壁番号 (W1, W2...) のシンプル描画 (v3.2.x スタイル: 倍率表記を除外) ---
        const isVertical = Math.abs(p1.cy - p2.cy) > Math.abs(p1.cx - p2.cx);
        const offX = isVertical ? 16 : 0;
        const offY = isVertical ? 0 : -10;

        // 表示テキスト: 壁番号 (W1, W2) または 面材記号 (なければ W1, W2)
        const wallName = w.name || `W${wallNo}`;
        const displayText = wallName || mark || `W${wallNo}`;

        if (totalMultiplier > 0) {
            ctx.save();
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            const tw = ctx.measureText(displayText).width;
            ctx.fillStyle = isPrintMode ? 'rgba(255,255,255,0.95)' : 'rgba(30,30,30,0.85)';
            ctx.fillRect(mX + offX - tw/2 - 3, mY + offY - 8, tw + 6, 16);

            ctx.fillStyle = isPrintMode ? '#2c3e50' : '#f1c40f';
            ctx.fillText(displayText, mX + offX, mY + offY);
            ctx.restore();
        }
    }
};

// Register with ServiceContainer
if (window.ServiceContainer) {
    window.ServiceContainer.register('WallCadRenderer', window.WallCadRenderer);
}
