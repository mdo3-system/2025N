/**
 * view/ElevationRenderer.js - Elevation Axial Force Diagram Rendering
 * v2.3.11 Refactoring
 */

window.ElevationRenderer = {
    /**
     * 特定の通りの拡大軸力図（立面）を SVG で生成する
     */
    generateAxialDiagramSvg: function(axisName, loadDirection = 'left', state) {
        const s = state || window.AppState;
        const floorsDesc = ['2F', '1F'];
        const floorDataMap = [];
        const h1 = (s.config.floorHeight1F || 2.7) * 1000;
        const h2 = (s.config.floorHeight2F || 2.7) * 1000;

        floorsDesc.forEach(f => {
            const h = (f === '2F') ? h2 : h1;
            const wallsOnAxis = s.walls.filter(w => {
                if (w.floor !== f) return false;
                const n1 = window.GridEngine.getPillarName(w.p1, s);
                const n2 = window.GridEngine.getPillarName(w.p2, s);
                return (n1 && (n1.startsWith(axisName) || n1.endsWith(axisName))) && 
                       (n2 && (n2.startsWith(axisName) || n2.endsWith(axisName)));
            });

            const pillarsOnAxis = s.pillars.filter(p => {
                if (p.floor !== f && p.floor !== 'ALL') return false;
                if (p.isDeleted) return false;
                const nm = window.GridEngine.getPillarName(p, s);
                return nm && (nm.startsWith(axisName) || nm.endsWith(axisName));
            });

            if (wallsOnAxis.length > 0 || pillarsOnAxis.length > 0) {
                floorDataMap.push({ floor: f, walls: wallsOnAxis, columns: pillarsOnAxis, floorHeight: h });
            }
        });

        if (floorDataMap.length === 0) return `<div style="padding:20px; color:#666;">通りのデータが見つかりません: ${axisName}</div>`;

        const allP = floorDataMap.flatMap(fm => [
            ...fm.walls.flatMap(w => [w.p1, w.p2]),
            ...fm.columns
        ]);
        const minX = Math.min(...allP.map(p => p.x)), maxX = Math.max(...allP.map(p => p.x));
        const minY = Math.min(...allP.map(p => p.y)), maxY = Math.max(...allP.map(p => p.y));
        const dx = maxX - minX, dy = maxY - minY;
        
        const isXHorizontal = dx >= dy;
        const getPos = (p) => isXHorizontal ? p.x : p.y;
        const startPos = isXHorizontal ? minX : minY;
        const totalW = Math.max(isXHorizontal ? dx : dy, 100);

        const padding = 60;
        const svgW = 800;
        const totalH_val = floorDataMap.reduce((sum, fm) => sum + fm.floorHeight, 0);
        const scaleVal = Math.min((svgW - padding * 2) / totalW, 500 / (totalH_val || 1));
        const W = svgW;
        const H = totalH_val * scaleVal + padding * 2;
        const getX = (pos) => padding + (pos - startPos) * scaleVal + (W - totalW * scaleVal - padding * 2) / 2;

        const floorYMap_Top = {};
        const floorYMap_Bot = {};
        const groundY = H - padding;
        let accH = 0;
        const sortedMap = [...floorDataMap].reverse(); 
        sortedMap.forEach(fm => {
            floorYMap_Bot[fm.floor] = groundY - (accH * scaleVal);
            accH += fm.floorHeight;
            floorYMap_Top[fm.floor] = groundY - (accH * scaleVal);
        });

        let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family: sans-serif;">`;
        
        sortedMap.forEach(fm => {
            const y = floorYMap_Bot[fm.floor];
            svg += `<line x1="${padding/2}" y1="${y}" x2="${W-padding/2}" y2="${y}" stroke="#ccc" stroke-width="1" />`;
            svg += `<text x="5" y="${y+4}" font-size="12" fill="#666">${fm.floor}${fm.floor==='1F'?'/GL':''}</text>`;
        });
        
        if (floorDataMap.length > 0) {
            const topFloorY = floorYMap_Top[floorDataMap[0].floor];
            svg += `<line x1="${padding/2}" y1="${topFloorY}" x2="${W-padding/2}" y2="${topFloorY}" stroke="#ccc" stroke-width="1" />`;
            svg += `<text x="5" y="${topFloorY+4}" font-size="12" fill="#666">R/屋根</text>`;
        }
        svg += `<line x1="${padding/2}" y1="${groundY}" x2="${W-padding/2}" y2="${groundY}" stroke="#333" stroke-width="2" />`;

        floorDataMap.forEach(fm => {
            const yTop = floorYMap_Top[fm.floor];
            const yBot = floorYMap_Bot[fm.floor];

            fm.walls.forEach(w => {
                const x1 = getX(getPos(w.p1)), x2 = getX(getPos(w.p2));
                const xL = Math.min(x1, x2), xR = Math.max(x1, x2), width = xR - xL;
                const tv = window.WallEngine.getTotalMultiplier(w);
                const fill = tv > 0 ? "rgba(91,138,254,0.08)" : "none";
                const stroke = tv > 0 ? "#5b8afe" : "#999";
                
                svg += `<rect x="${xL}" y="${yTop}" width="${width}" height="${yBot - yTop}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />`;
                if (tv > 0) {
                    svg += `<line x1="${xL}" y1="${yTop}" x2="${xR}" y2="${yBot}" stroke="${stroke}" stroke-width="0.5" opacity="0.5" />`;
                    svg += `<line x1="${xR}" y1="${yTop}" x2="${xL}" y2="${yBot}" stroke="${stroke}" stroke-width="0.5" opacity="0.5" />`;
                    
                    const wallL = (xR - xL) / scaleVal / 1000;
                    const wallH = fm.floorHeight / 1000;
                    const Pa = tv * 1.96 * wallL * 1000;
                    const wallN = tv * 1.96 * wallH * 1000;
                    
                    svg += `<text x="${(xL+xR)/2}" y="${(yTop+yBot)/2 - 12}" font-size="9" fill="#2c3e50" font-weight="bold" text-anchor="middle">
                                <tspan x="${(xL+xR)/2}" dy="0">α = ${tv.toFixed(3)}</tspan>
                                <tspan x="${(xL+xR)/2}" dy="11">Pa = ${Pa.toFixed(0)} N</tspan>
                                <tspan x="${(xL+xR)/2}" dy="11">N = ${wallN.toFixed(0)} N</tspan>
                            </text>`;
                }
            });

            const axisPosSet = new Set();
            fm.walls.forEach(w => { axisPosSet.add(getPos(w.p1)); axisPosSet.add(getPos(w.p2)); });
            fm.columns.forEach(p => { axisPosSet.add(getPos(p)); });

            Array.from(axisPosSet).sort((a,b)=>a-b).forEach((pPos, pIdx) => {
                const x = getX(pPos);
                svg += `<line x1="${x}" y1="${yTop}" x2="${x}" y2="${yBot}" stroke="#666" stroke-width="1" stroke-dasharray="2,2" />`;
                
                const col = fm.columns.find(c => Math.abs(getPos(c) - pPos) < 5);
                if (col && col.nValue !== undefined) {
                    const nVal = col.nValue || 0;
                    const nValN = nVal * 1000;
                    const color = nValN > 0 ? '#e74c3c' : '#3498db';
                    const anchor = (loadDirection === 'left') ? 'end' : 'start';
                    const dx = (loadDirection === 'left') ? -5 : 5;
                    const offY = (pIdx % 2 === 0) ? 12 : 24;
                    svg += `<text x="${x + dx}" y="${yTop + offY}" font-size="9" fill="${color}" font-weight="bold" text-anchor="${anchor}">Ni:${nValN.toFixed(0)} N</text>`;
                    
                    if (fm.floor === '1F') {
                        const TN = nVal * 1000;
                        const tColor = TN > 0 ? '#e74c3c' : '#3498db';
                        const tText = TN > 0 ? `(+) ${TN.toFixed(0)} N` : `- ${Math.abs(TN).toFixed(0)} N`;
                        const tx = (loadDirection === 'left') ? x - 6 : x + 6;
                        const ta = (loadDirection === 'left') ? 'end' : 'start';
                        const ty = (pIdx % 2 === 0) ? 12 : -8;
                        svg += `<text x="${tx}" y="${yBot + ty}" font-size="11" fill="${tColor}" font-weight="bold" text-anchor="${ta}">${tText}</text>`;
                        svg += `<text x="${tx}" y="${yBot + ty + 12}" font-size="9" fill="#7f8c8d" text-anchor="${ta}">${col.nMark || '-'}</text>`;
                    }
                }
            });
        });

        svg += `</svg>`;
        return svg;
    }
};
