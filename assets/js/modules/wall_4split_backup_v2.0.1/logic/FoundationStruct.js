/**
 * FoundationStruct.js
 * 連続梁の再構成、スパン分割、スラブの亀甲分割（荷重負担）ロジック
 */

import { clipPolygonStrict, dedupPolygon, distToLineSegment } from './MathUtils.js';

/**
 * 重複する梁セグメントを統合し、1本の連続梁に再構成する
 */
export function reconstructContinuousBeams(beams, pillars) {
    if (!beams || beams.length === 0) return [];

    // 1. 同一線上にあるセグメントをグループ化 (水平・垂直)
    const groups = [];
    beams.forEach(b => {
        const bP1x = Number(b.p1.x), bP1y = Number(b.p1.y);
        const bP2x = Number(b.p2.x), bP2y = Number(b.p2.y);
        
        const p1 = bP1x < bP2x || (bP1x === bP2x && bP1y < bP2y) ? {x:bP1x, y:bP1y} : {x:bP2x, y:bP2y};
        const p2 = bP1x < bP2x || (bP1x === bP2x && bP1y < bP2y) ? {x:bP2x, y:bP2y} : {x:bP1x, y:bP1y};
        
        let found = false;
        const isH = Math.abs(p1.y - p2.y) < 5;
        const isV = Math.abs(p1.x - p2.x) < 5;

        for (const g of groups) {
            const gIsH = Math.abs(g[0].p1.y - g[0].p2.y) < 5;
            const gIsV = Math.abs(g[0].p1.x - g[0].p2.x) < 5;
            if (isH && gIsH && Math.abs(p1.y - g[0].p1.y) < 5) { g.push({b, p1, p2}); found = true; break; }
            if (isV && gIsV && Math.abs(p1.x - g[0].p1.x) < 5) { g.push({b, p1, p2}); found = true; break; }
        }
        if (!found) groups.push([{b, p1, p2}]);
    });

    const newBeams = [];
    groups.forEach(g => {
        const isH = Math.abs(g[0].p1.y - g[0].p2.y) < 5;
        g.sort((a, b) => isH ? a.p1.x - b.p1.x : a.p1.y - b.p1.y);

        let current = null;
        g.forEach(item => {
            if (!current) {
                current = { 
                    ...item.b, 
                    p1: { x: Number(item.p1.x), y: Number(item.p1.y) }, 
                    p2: { x: Number(item.p2.x), y: Number(item.p2.y) }, 
                    originalBeams: [item.b],
                    spans: [] 
                };
            } else {
                const posStart = isH ? item.p1.x : item.p1.y;
                const currEnd = isH ? current.p2.x : current.p2.y;
                if (posStart <= currEnd + 50) {
                    const posEnd = isH ? item.p2.x : item.p2.y;
                    if (posEnd > currEnd) {
                        current.p2 = { x: Number(item.p2.x), y: Number(item.p2.y) };
                    }
                    current.originalBeams.push(item.b);
                } else {
                    newBeams.push(current);
                    current = { 
                        ...item.b, 
                        p1: { x: Number(item.p1.x), y: Number(item.p1.y) }, 
                        p2: { x: Number(item.p2.x), y: Number(item.p2.y) }, 
                        originalBeams: [item.b],
                        spans: []
                    };
                }
            }
        });
        if (current) newBeams.push(current);
    });

    newBeams.forEach(nb => {
        if (nb.originalBeams && nb.originalBeams.length > 0) {
            nb.originalBeams.sort((a, b) => {
                const la = Math.hypot(a.p2.x - a.p1.x, a.p2.y - a.p1.y);
                const lb = Math.hypot(b.p2.x - b.p1.x, b.p2.y - b.p1.y);
                return lb - la;
            });
            nb.props = JSON.parse(JSON.stringify(nb.originalBeams[0].props));
            nb.id = nb.originalBeams[0].id;
        }
        delete nb.originalBeams;
    });

    splitBeamsIntoSpans(newBeams, pillars);
    return newBeams;
}

/**
 * 連続梁を支点(柱・交点)でマーキングし、spans配列へ分割・格納する
 */
export function splitBeamsIntoSpans(beams, pillars) {
    beams.forEach(beam => {
        if (!beam.p1 || !beam.p2 || isNaN(beam.p1.x) || isNaN(beam.p1.y)) return;
        const nodes = [];
        const beamP1x = Number(beam.p1.x), beamP1y = Number(beam.p1.y);
        const beamP2x = Number(beam.p2.x), beamP2y = Number(beam.p2.y);
        const isH = Math.abs(beamP1y - beamP2y) < 5;
        const isV = Math.abs(beamP1x - beamP2x) < 5;
        nodes.push({ x: beamP1x, y: beamP1y, type: 'end' });
        nodes.push({ x: beamP2x, y: beamP2y, type: 'end' });
        (pillars || []).forEach(p => {
            if (p.isDeleted) return;
            const px = Number(p.x), py = Number(p.y);
            let onBeam = false;
            if (isH && Math.abs(py - beamP1y) < 10 && px >= Math.min(beamP1x, beamP2x) - 10 && px <= Math.max(beamP1x, beamP2x) + 10) onBeam = true;
            else if (isV && Math.abs(px - beamP1x) < 10 && py >= Math.min(beamP1y, beamP2y) - 10 && py <= Math.max(beamP1y, beamP2y) + 10) onBeam = true;
            if (onBeam) nodes.push({ x: px, y: py, type: 'pillar', pillarId: p.id });
        });
        beams.forEach(ob => {
            if (ob.id === beam.id || !ob.p1 || !ob.p2) return;
            const obP1x = Number(ob.p1.x), obP1y = Number(ob.p1.y);
            const obP2x = Number(ob.p2.x), obP2y = Number(ob.p2.y);
            const obIsH = Math.abs(obP1y - obP2y) < 5, obIsV = Math.abs(obP1x - obP2x) < 5;
            if (isH && obIsV) {
                if (obP1x >= Math.min(beamP1x, beamP2x) - 5 && obP1x <= Math.max(beamP1x, beamP2x) + 5 && 
                    beamP1y >= Math.min(obP1y, obP2y) - 5 && beamP1y <= Math.max(obP1y, obP2y) + 5) nodes.push({ x: obP1x, y: beamP1y, type: 'intersect', beamId: ob.id });
            } else if (isV && obIsH) {
                if (obP1y >= Math.min(beamP1y, beamP2y) - 5 && obP1y <= Math.max(beamP1y, beamP2y) + 5 && 
                    beamP1x >= Math.min(obP1x, obP2x) - 5 && beamP1x <= Math.max(obP1x, obP2x) + 5) nodes.push({ x: beamP1x, y: obP1y, type: 'intersect', beamId: ob.id });
            }
        });
        const uniqueNodes = [];
        nodes.forEach(n => {
            let existing = uniqueNodes.find(un => Math.abs(un.x - n.x) < 20 && Math.abs(un.y - n.y) < 20);
            if (!existing) uniqueNodes.push(n);
            else if (n.type === 'pillar') { existing.type = 'pillar'; existing.pillarId = n.pillarId; }
        });
        uniqueNodes.sort((a, b) => isH ? a.x - b.x : a.y - b.y);
        const spans = [];
        for (let i = 0; i < uniqueNodes.length - 1; i++) {
            const n1 = uniqueNodes[i], n2 = uniqueNodes[i + 1], spanLen = Math.hypot(n2.x - n1.x, n2.y - n1.y);
            if (spanLen > 50) spans.push({ startNode: n1, endNode: n2, spanLength: spanLen, connectedSlabIds: [] });
        }
        if (spans.length === 0) spans.push({ startNode: { x: beamP1x, y: beamP1y, type: 'end' }, endNode: { x: beamP2x, y: beamP2y, type: 'end' }, spanLength: Math.hypot(beamP2x - beamP1x, beamP2y - beamP1y), connectedSlabIds: [] });
        beam.spans = spans;
    });
}

/**
 * 亀甲分割によるスラブ荷重の基礎梁への負担計算
 */
export function calculateSlabTributary(slabs, beams, triMult = 1.33, gPressure = 15.0) {
    if (!slabs || slabs.length === 0) return;
    (beams || []).forEach(b => { b.slabLoad = 0; b.tributaryArea = 0; b.tributaryWidth = 0; });

    slabs.forEach(slab => {
        if (!slab.vertices || slab.vertices.length < 3) { slab.tributaryPolygons = []; slab.edgeLs = []; return; }
        let initialPts = slab.vertices.map(v => ({ x: v.x, y: v.y }));
        let signedArea = 0;
        for (let i = 0; i < initialPts.length; i++) {
            const p1 = initialPts[i], p2 = initialPts[(i + 1) % initialPts.length];
            signedArea += (p1.x * p2.y - p2.x * p1.y);
        }
        if (signedArea < 0) initialPts.reverse();
        const n = initialPts.length, edges = [];
        for (let i = 0; i < n; i++) {
            const p1 = initialPts[i], p2 = initialPts[(i + 1) % n], dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
            const nx = -dy / (L || 1), ny = dx / (L || 1);
            edges.push({ p1, p2, nx, ny, d: nx * p1.x + ny * p1.y, L });
        }
        const tributaryPolygons = [], edgeLs = [];
        for (let i = 0; i < n; i++) {
            let poly = [...initialPts];
            const Ei = edges[i];
            for (let j = 0; j < n; j++) {
                if (i === j) continue;
                const Ej = edges[j], coeffA = Ei.nx - Ej.nx, coeffB = Ei.ny - Ej.ny, coeffC = Ej.d - Ei.d;
                if (Math.abs(coeffA) > 1e-7 || Math.abs(coeffB) > 1e-7) poly = clipPolygonStrict(poly, coeffA, coeffB, coeffC);
            }
            poly = dedupPolygon(poly, 5);
            let area = 0;
            for (let k = 0; k < poly.length; k++) { const j = (k + 1) % poly.length; area += poly[k].x * poly[j].y - poly[j].x * poly[k].y; }
            area = Math.abs(area) / 2;
            const L = Ei.L || 1;
            if (area > 100) {
                let currentWidth = area / L;
                if (poly.length === 3) currentWidth = (area * triMult) / L;
                const tribEntry = { beamId: null, polygon: poly, area: area, width: currentWidth, edgeLength: L };
                tributaryPolygons.push(tribEntry);
                edgeLs.push(currentWidth);
                const mx = (Ei.p1.x + Ei.p2.x) / 2, my = (Ei.p1.y + Ei.p2.y) / 2;
                let bestBeam = null, minDist = 50; 
                (beams || []).forEach(b => {
                    if (!b.p1 || !b.p2) return;
                    const d = distToLineSegment(mx, my, b.p1.x, b.p1.y, b.p2.x, b.p2.y);
                    if (d < minDist) { minDist = d; bestBeam = b; }
                });
                if (bestBeam) { tribEntry.beamId = bestBeam.id; bestBeam.tributaryArea += area; bestBeam.tributaryWidth += currentWidth; bestBeam.slabLoad += (area / 1000000) * gPressure; }
            } else { edgeLs.push(0); }
        }
        slab.tributaryPolygons = tributaryPolygons; slab.edgeLs = edgeLs;
    });
}
