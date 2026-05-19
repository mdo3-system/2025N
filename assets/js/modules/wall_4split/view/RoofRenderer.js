/**
 * view/RoofRenderer.js - Roof Face Rendering Module
 * v2.7.0 New Implementation
 */

window.RoofRenderer = {
    /**
     * Draw roof faces layer on interactive canvas
     */
    drawRoofLayer: function(state, ctx) {
        const floor = state.currentFloor;
        const faces = state.roofFaces || [];
        const isPrintMode = state.isPrintMode || false;

        faces.forEach(face => {
            if (face.floor !== floor) return;
            if (!face.vertices || face.vertices.length < 3) return;

            // 1. Draw the polygon face
            ctx.save();
            ctx.beginPath();
            face.vertices.forEach((v, idx) => {
                const cp = this.toCanvas(v.x, v.y, state);
                idx === 0 ? ctx.moveTo(cp.cx, cp.cy) : ctx.lineTo(cp.cx, cp.cy);
            });
            ctx.closePath();

            // Translucent beautiful fill
            ctx.fillStyle = isPrintMode ? 'rgba(52, 152, 219, 0.18)' : 'rgba(52, 152, 219, 0.35)';
            ctx.fill();

            // Slate-blue border
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = isPrintMode ? '#1b4f72' : '#2980b9';
            ctx.stroke();
            ctx.restore();

            // 2. Draw Slope Line (Dashed low-opacity guide inside the face)
            if (face.slopeLine && face.slopeLine.length === 2) {
                ctx.save();
                ctx.lineWidth = 1.2;
                ctx.strokeStyle = isPrintMode ? 'rgba(230, 126, 34, 0.6)' : 'rgba(230, 126, 34, 0.8)';
                ctx.setLineDash([4, 4]);
                
                const lp1 = this.toCanvas(face.slopeLine[0].x, face.slopeLine[0].y, state);
                const lp2 = this.toCanvas(face.slopeLine[1].x, face.slopeLine[1].y, state);
                ctx.beginPath();
                ctx.moveTo(lp1.cx, lp1.cy);
                ctx.lineTo(lp2.cx, lp2.cy);
                ctx.stroke();
                ctx.restore();
            }

            // 3. Draw Centered Slope Arrow and Label
            this.drawSlopeArrowAndLabels(face, state, ctx, isPrintMode);
        });
    },

    /**
     * Draw slope directed arrow and property labels at face centroid
     */
    drawSlopeArrowAndLabels: function(face, state, ctx, isPrintMode) {
        // Calculate centroid of the polygon vertices
        let sumX = 0, sumY = 0;
        face.vertices.forEach(v => { sumX += v.x; sumY += v.y; });
        const cx = sumX / face.vertices.length;
        const cy = sumY / face.vertices.length;

        const cpCenter = this.toCanvas(cx, cy, state);

        // Get slope direction vector (p1 -> p2)
        const p1 = face.slopeLine ? face.slopeLine[0] : { x: cx, y: cy };
        const p2 = face.slopeLine ? face.slopeLine[1] : { x: cx, y: cy + 1000 };

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);

        const ux = len > 0 ? dx / len : 0;
        const uy = len > 0 ? dy / len : 1;

        // Since canvas coordinates are Y-flipped relative to logical coordinates:
        // We calculate screen orientation using canvas offsets
        const cpP1 = this.toCanvas(p1.x, p1.y, state);
        const cpP2 = this.toCanvas(p2.x, p2.y, state);
        const sdx = cpP2.cx - cpP1.cx;
        const sdy = cpP2.cy - cpP1.cy;
        const slen = Math.hypot(sdx, sdy);
        const sux = slen > 0 ? sdx / slen : 0;
        const suy = slen > 0 ? sdy / slen : 1;

        ctx.save();
        // 1. Draw directed arrow pointing in the direction of rise (p1 -> p2)
        const arrowLength = 36; // screen pixels
        const halfL = arrowLength / 2;

        const startCx = cpCenter.cx - sux * halfL;
        const startCy = cpCenter.cy - suy * halfL;
        const endCx = cpCenter.cx + sux * halfL;
        const endCy = cpCenter.cy + suy * halfL;

        ctx.lineWidth = 2.0;
        ctx.strokeStyle = isPrintMode ? '#d35400' : '#e67e22'; // orange
        ctx.beginPath();
        ctx.moveTo(startCx, startCy);
        ctx.lineTo(endCx, endCy);
        ctx.stroke();

        // Draw arrowhead at end point
        const headSize = 6;
        const angle = Math.atan2(suy, sux);
        ctx.fillStyle = isPrintMode ? '#d35400' : '#e67e22';
        ctx.beginPath();
        ctx.moveTo(endCx, endCy);
        ctx.lineTo(endCx - headSize * Math.cos(angle - Math.PI / 6), endCy - headSize * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(endCx - headSize * Math.cos(angle + Math.PI / 6), endCy - headSize * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();

        // 2. Draw Text Labels (Label, Slope, Area)
        const textOffset = 22;
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = isPrintMode ? '#1b4f72' : '#ecf0f1';
        ctx.shadowColor = isPrintMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.textAlign = 'center';

        // Face Label
        ctx.fillText(face.label || '屋根', cpCenter.cx, cpCenter.cy - textOffset);

        // Slope
        ctx.font = '10px sans-serif';
        ctx.fillText(`${face.slope.toFixed(1)}寸勾配`, cpCenter.cx, cpCenter.cy + textOffset - 4);

        // Areas (Horizontal projected area and sloped real area)
        const projArea = window.RoofEngine.calculatePolygonArea2D(face.vertices.map(v => ({ u: v.x/1000, v: v.y/1000 })));
        const slopeVal = face.slope / 10;
        const slopedArea = projArea * Math.sqrt(1 + slopeVal * slopeVal);
        ctx.fillText(`投影: ${projArea.toFixed(2)}㎡`, cpCenter.cx, cpCenter.cy + textOffset + 8);
        ctx.fillText(`実積: ${slopedArea.toFixed(2)}㎡`, cpCenter.cx, cpCenter.cy + textOffset + 19);

        ctx.restore();
    },

    /**
     * Map logical coordinates to canvas pixels
     */
    toCanvas: function(x, y, state) {
        if (state.toCanvasReportBridge) {
            return state.toCanvasReportBridge(x, y);
        }
        return window.MainRenderer.toCanvas({ x, y }, null, state);
    },

    /**
     * Generate report-ready clean high-resolution canvas for the given floor
     */
    generateReportCanvas: function(state, floor) {
        const c = document.createElement('canvas');
        c.width = 1200;
        c.height = 900;
        const ctx = c.getContext('2d');

        // Fit coordinates dynamically
        const transform = this.calculateFitTransform(state, c.width, c.height);
        
        // Setup bridge coordinates map for the offline canvas
        const localBridgeState = {
            scale: transform.scale,
            offsetX: transform.offsetX,
            offsetY: transform.offsetY,
            canvas: c,
            toCanvasReportBridge: function(x, y) {
                return {
                    cx: x * transform.scale + transform.offsetX,
                    cy: c.height - (y * transform.scale + transform.offsetY)
                };
            }
        };

        // Draw clear background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);

        // Draw standard grids with low opacity as guidelines
        ctx.save();
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = '#e0e0e0';
        const xs = state.gridXCoords || [];
        const ys = state.gridYCoords || [];

        xs.forEach(x => {
            const p1 = localBridgeState.toCanvasReportBridge(x, ys[0] || 0);
            const p2 = localBridgeState.toCanvasReportBridge(x, ys[ys.length - 1] || 10000);
            ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
        });
        ys.forEach(y => {
            const p1 = localBridgeState.toCanvasReportBridge(xs[0] || 0, y);
            const p2 = localBridgeState.toCanvasReportBridge(xs[xs.length - 1] || 10000, y);
            ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
        });
        ctx.restore();

        // Draw standard walls as non-obtrusive grey wireframes
        ctx.save();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#bdc3c7';
        const walls = (state.walls || []).filter(w => w.floor === floor);
        walls.forEach(w => {
            const p1 = localBridgeState.toCanvasReportBridge(w.p1.x, w.p1.y);
            const p2 = localBridgeState.toCanvasReportBridge(w.p2.x, w.p2.y);
            ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
        });
        ctx.restore();

        // Draw roof grids
        ctx.save();
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.4)';
        ctx.setLineDash([3, 3]);
        const rgrids = window.GridEngine ? window.GridEngine.getRoofGrids(state) : { x: [], y: [] };
        rgrids.x.forEach(x => {
            const p1 = localBridgeState.toCanvasReportBridge(x, rgrids.y[0] || 0);
            const p2 = localBridgeState.toCanvasReportBridge(x, rgrids.y[rgrids.y.length - 1] || 10000);
            ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
        });
        rgrids.y.forEach(y => {
            const p1 = localBridgeState.toCanvasReportBridge(rgrids.x[0] || 0, y);
            const p2 = localBridgeState.toCanvasReportBridge(rgrids.x[rgrids.x.length - 1] || 10000, y);
            ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
        });
        ctx.restore();

        // Draw the roof faces
        const oldPrintState = state.isPrintMode;
        state.isPrintMode = true; // force print-style drawing
        
        const faces = state.roofFaces || [];
        faces.forEach(face => {
            if (face.floor !== floor) return;
            if (!face.vertices || face.vertices.length < 3) return;

            // Polygon
            ctx.save();
            ctx.beginPath();
            face.vertices.forEach((v, idx) => {
                const cp = localBridgeState.toCanvasReportBridge(v.x, v.y);
                idx === 0 ? ctx.moveTo(cp.cx, cp.cy) : ctx.lineTo(cp.cx, cp.cy);
            });
            ctx.closePath();
            ctx.fillStyle = 'rgba(52, 152, 219, 0.15)';
            ctx.fill();
            ctx.lineWidth = 2.0;
            ctx.strokeStyle = '#1b4f72';
            ctx.stroke();
            ctx.restore();

            // Arrow & Labels
            this.drawSlopeArrowAndLabels(face, localBridgeState, ctx, true);
        });

        state.isPrintMode = oldPrintState;

        // Draw Canvas Title
        ctx.save();
        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#2c3e50';
        ctx.textAlign = 'left';
        ctx.fillText(`🏠 ${floor === '2F' ? '2階' : '1階'} 屋根伏図 (見付面積算定用)`, 40, 50);
        ctx.restore();

        return c;
    },

    /**
     * Auto fit calculation
     */
    calculateFitTransform: function(state, canvasWidth, canvasHeight) {
        const coordsX = state.gridXCoords || [];
        const coordsY = state.gridYCoords || [];
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        coordsX.forEach(x => { if(x < minX) minX = x; if(x > maxX) maxX = x; });
        coordsY.forEach(y => { if(y < minY) minY = y; if(y > maxY) maxY = y; });

        const roofGrids = window.GridEngine ? window.GridEngine.getRoofGrids(state) : { x: [], y: [] };
        roofGrids.x.forEach(x => { if(x < minX) minX = x; if(x > maxX) maxX = x; });
        roofGrids.y.forEach(y => { if(y < minY) minY = y; if(y > maxY) maxY = y; });

        if (minX === Infinity) {
            minX = 0; maxX = 10000; minY = 0; maxY = 10000;
        }

        minX -= 1200; maxX += 1200;
        minY -= 1200; maxY += 1200;

        const w = maxX - minX;
        const h = maxY - minY;

        const scaleX = (canvasWidth - 100) / w;
        const scaleY = (canvasHeight - 100) / h;
        const scale = Math.min(scaleX, scaleY);

        const offsetX = (canvasWidth - w * scale) / 2 - minX * scale;
        const offsetY = (canvasHeight - h * scale) / 2 - minY * scale;

        return { scale, offsetX, offsetY };
    }
};
