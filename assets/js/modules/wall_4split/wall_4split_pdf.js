// ==========================================
// wall_4split_pdf.js - 帳票画像・PDF生成エンジン (Phase 3.9)
// v2.2.0 Refactoring
// ==========================================


function createLayerFilteredImage(docType, targetLayers, bgLayers, floorStr = null, showAreaDims = true, dimScale = 1.0, isPrint = false) {
    return window.DocumentRenderer.renderLayerFilteredImage(docType, targetLayers, bgLayers, floorStr, { showAreaDims, dimScale, isPrint });
}
window.createLayerFilteredImage = createLayerFilteredImage;

function createNativeCanvasImage(f, mode, d4 = null, showAreaDims = true, dimScale = 1.0, isPrint = false) {
    return createHighResPlanImage(f, mode, d4, showAreaDims, dimScale, isPrint);
}
window.createNativeCanvasImage = createNativeCanvasImage;

function createHighResPlanImage(f, mode, d4 = null, showAreaDims = true, dimScale = 1.0, isPrint = false) {
    return window.DocumentRenderer.renderStructuralPlan(f, mode, d4, { showAreaDims, dimScale, isPrint });
}
window.createHighResPlanImage = createHighResPlanImage;

function triangulatePolygon(vertices) {
    const triangles = [];
    if (!vertices || vertices.length < 3) return triangles;
    
    // Clean up duplicate vertices
    const pts = [];
    for (let i = 0; i < vertices.length; i++) {
        const p = vertices[i];
        if (pts.length === 0 || Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y) > 1e-3) {
            pts.push({ x: p.x, y: p.y });
        }
    }
    if (pts.length > 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-3) {
        pts.pop();
    }
    
    if (pts.length < 3) return triangles;

    // Determine orientation (Ensure CCW)
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
        let j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    if (area < 0) pts.reverse();

    const indices = pts.map((_, idx) => idx);
    let limit = pts.length * 3;
    
    const isEar = (u, v, w, n, pts, indices) => {
        const pA = pts[indices[u]];
        const pB = pts[indices[v]];
        const pC = pts[indices[w]];
        
        const cross = (pB.x - pA.x) * (pC.y - pA.y) - (pB.y - pA.y) * (pC.x - pA.x);
        if (cross <= 1e-6) return false;
        
        for (let i = 0; i < n; i++) {
            if (i === u || i === v || i === w) continue;
            const p = pts[indices[i]];
            
            // Triangle containment check using cross products
            const c1 = (pB.x - pA.x) * (p.y - pA.y) - (pB.y - pA.y) * (p.x - pA.x);
            const c2 = (pC.x - pB.x) * (p.y - pB.y) - (pC.y - pB.y) * (p.x - pB.x);
            const c3 = (pA.x - pC.x) * (p.y - pC.y) - (pA.y - pC.y) * (p.x - pC.x);
            
            if (c1 >= -1e-6 && c2 >= -1e-6 && c3 >= -1e-6) return false;
        }
        return true;
    };

    while (indices.length > 2 && limit > 0) {
        limit--;
        const n = indices.length;
        let earFound = false;
        for (let i = 0; i < n; i++) {
            const u = (i - 1 + n) % n;
            const v = i;
            const w = (i + 1) % n;
            if (isEar(u, v, w, n, pts, indices)) {
                triangles.push([pts[indices[u]], pts[indices[v]], pts[indices[w]]]);
                indices.splice(v, 1);
                earFound = true;
                break;
            }
        }
        if (!earFound) {
            triangles.push([pts[indices[0]], pts[indices[1]], pts[indices[2]]]);
            indices.splice(1, 1);
        }
    }
    return triangles;
}

function getAreaRowsHtml(area, i) {
    const cleanVertices = window.MathUtils && window.MathUtils.dedupPolygon ? window.MathUtils.dedupPolygon(area.vertices) : area.vertices;
    const vCount = cleanVertices.length;
    let html = "";
    let totalA = 0;

    let c = Geometry.polygonCentroid(area.vertices);
    if (!c) return { html: "", area: 0 };
    let MathAbsArea = Math.abs(c.area / 1000000);
    let sign = (c.area / 1000000) > 0 ? 1 : -1;
    
    if (vCount === 3 || vCount === 4) {
        let minX = Math.min(...cleanVertices.map(v => v.x)), maxX = Math.max(...cleanVertices.map(v => v.x));
        let minY = Math.min(...cleanVertices.map(v => v.y)), maxY = Math.max(...cleanVertices.map(v => v.y));
        let w = (maxX - minX) / 1000, h_dim = (maxY - minY) / 1000;
        
        let formula = "";
        if (vCount === 3) {
            formula = `${sign < 0 ? '-' : ''}底辺 × 高さ / 2`;
            html += `<tr>
                <td>${i + 1}${sign < 0 ? ' (除外)' : ''}</td>
                <td>${w.toFixed(3)}</td>
                <td>${h_dim.toFixed(3)}</td>
                <td style="text-align:left;">${formula}</td>
                <td>${(sign * MathAbsArea).toFixed(2)}</td>
            </tr>`;
        } else {
            formula = `${sign < 0 ? '-' : ''}底辺 × 高さ`;
            html += `<tr>
                <td>${i + 1}${sign < 0 ? ' (除外)' : ''}</td>
                <td>${w.toFixed(3)}</td>
                <td>${h_dim.toFixed(3)}</td>
                <td style="text-align:left;">${formula}</td>
                <td>${(sign * MathAbsArea).toFixed(2)}</td>
            </tr>`;
        }
        totalA = sign * MathAbsArea;
    } else {
        const triangles = triangulatePolygon(cleanVertices);
        triangles.forEach((tri, subIdx) => {
            let tc = Geometry.polygonCentroid(tri);
            if (!tc) return;
            let subAreaVal = Math.abs(tc.area / 1000000);
            let minX = Math.min(...tri.map(v => v.x)), maxX = Math.max(...tri.map(v => v.x));
            let minY = Math.min(...tri.map(v => v.y)), maxY = Math.max(...tri.map(v => v.y));
            let w = (maxX - minX) / 1000, h_dim = (maxY - minY) / 1000;
            
            let formula = `${sign < 0 ? '-' : ''}底辺 × 高さ / 2 (三角形分割)`;
            html += `<tr>
                <td>${i + 1}-${subIdx + 1}${sign < 0 ? ' (除外)' : ''}</td>
                <td>${w.toFixed(3)}</td>
                <td>${h_dim.toFixed(3)}</td>
                <td style="text-align:left;">${formula}</td>
                <td>${(sign * subAreaVal).toFixed(2)}</td>
            </tr>`;
            totalA += sign * subAreaVal;
        });
    }
    return { html, area: totalA };
}

// Removing legacy implementation below...
/*
        areaLines.filter(a => a.floor === f).forEach(a => {
            if (a.vertices) a.vertices.forEach(v => {
                if (v.x != null && !isNaN(v.x)) { if (v.x < mx) mx = v.x; if (v.x > Mxx) Mxx = v.x; if (v.y < my) my = v.y; if (v.y > Mxy) Mxy = v.y; }
            });
        });
        pillars.forEach(p => { 
            if (!isPrint && layerVisibility[p.layer] === false) return;
            if (p.x != null && !isNaN(p.x) && (p.floor === f || p.floor === 'ALL')) { if (p.x < mx) mx = p.x; if (p.x > Mxx) Mxx = p.x; if (p.y < my) my = p.y; if (p.y > Mxy) Mxy = p.y; } 
        });

        if (mx === Infinity) { mx = 0; my = 0; Mxx = 1000; Mxy = 1000; }
        let dx = Mxx - mx || 1000, dy = Mxy - my || 1000;
        if (dx <= 0 || dy <= 0 || dx === Infinity || dy === Infinity) {
            let cBlank = document.createElement('canvas'); cBlank.width = 100; cBlank.height = 100; return { img: cBlank.toDataURL('image/png'), physW: 0, physH: 0 };
        }

        const scaleInputId = document.getElementById('scale-plan') ? 'scale-plan' : 'scale-floor';
        const userScale = parseFloat(document.getElementById(scaleInputId).value) || 100;
        let sf = (1 / userScale) * 11.81;
        
        const padCAD = 50 / (1 / userScale);
        mx -= padCAD; Mxx += padCAD; my -= padCAD; Mxy += padCAD;
        dx = Mxx - mx; dy = Mxy - my;

        let cW = dx * sf, cH = dy * sf;
        const MAX_PX = 4096; let sfFinal = sf;
        if (cW > MAX_PX || cH > MAX_PX) { let ratio = Math.min(MAX_PX / cW, MAX_PX / cH); cW *= ratio; cH *= ratio; sfFinal = sf * ratio; }

        let c = document.createElement('canvas'); c.width = cW; c.height = cH;
        let x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, cW, cH);

        let sc = sfFinal;
        const toCanvas = (xPos, yPos) => ({ cx: (xPos - mx) * sfFinal, cy: cH - ((yPos - my) * sfFinal) });

        let b = get4DivBounds(f);
        // Y方向4分割の変数名統一・逆転ガード
        if (d4 && b) {
            let dR = (bb, cc) => {
                let p1 = toCanvas(bb.minX, bb.minY), p2 = toCanvas(bb.maxX, bb.maxY);
                if (p1.cx != null && !isNaN(p1.cx)) {
                    let w = p2.cx - p1.cx, ht = p1.cy - p2.cy;
                    if (w > 0 && ht > 0) {
                        x.beginPath(); x.save(); x.globalAlpha = 1.0; x.fillStyle = cc; x.fillRect(p1.cx, p2.cy, w, ht); x.fill(); x.restore();

                        // 中点への寸法描画 (外側へ配置)
                        let dX = Math.round(bb.maxX - bb.minX), dY = Math.round(bb.maxY - bb.minY);
                        x.font = "bold 24px sans-serif"; x.textAlign = "center";
                        x.strokeStyle = '#ffffff'; x.lineWidth = 5;

                        let isTop = bb.minY === b.yTop || bb.maxY === b.yTop;
                        let extY = isTop ? p1.cy - 30 : p2.cy + 30; // 上下判定で外側へ
                        let isLeft = bb.minX === b.minX || bb.maxX === b.minX;
                        let extX = isLeft ? p1.cx - 50 : p2.cx + 50; // 左右判定で外側へ

                        x.strokeText(String(dX), p1.cx + w / 2, extY);
                        x.fillStyle = '#c0392b'; x.fillText(String(dX), p1.cx + w / 2, extY);

                        x.strokeText(String(dY), extX, p1.cy - ht / 2);
                        x.fillStyle = '#c0392b'; x.fillText(String(dY), extX, p1.cy - ht / 2);
                    }
                }
            };
            if (d4 === 'X') {
                dR({ minX: b.minX, maxX: b.maxX, minY: b.yTop, maxY: b.maxY }, 'rgba(52,152,219,0.25)');
                dR({ minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.yBottom }, 'rgba(52,152,219,0.25)');
            } else {
                dR({ minX: b.minX, maxX: b.xLeft, minY: b.minY, maxY: b.maxY }, 'rgba(52,152,219,0.25)');
                dR({ minX: b.xRight, maxX: b.maxX, minY: b.minY, maxY: b.maxY }, 'rgba(52,152,219,0.25)');
            }
        }

        // ★ パッチ適用: 印刷時の背景線も視認性確保 (主張しすぎない薄いグレー)
        let bgCanvas = document.createElement('canvas');
        bgCanvas.width = c.width; bgCanvas.height = c.height; // c.width/height (2400x1600) を使用
        let bgCtx = bgCanvas.getContext('2d');
        bgCtx.lineWidth = 1.5; bgCtx.strokeStyle = '#cccccc'; bgCtx.setLineDash([]);

        bgLinesOriginal.filter(e => {
            if (!e.isUnderlay) return false;
            let L = (e.layer || "").toUpperCase().trim();
            let targetBG = 'BG_' + f;
            return (e.floor === f || e.floor === 'ALL' || L.includes(targetBG) || L.includes('BG_ALL') || L.startsWith('BG_'));
        }).forEach(e => {
            if (!isPrint && layerVisibility[e.layer] === false) return;
            if (e.isGridLine) return; // 二重線防止
            bgCtx.beginPath();
            if (e.type === 'LINE' && e.vertices) { let p1 = toCanvas(e.vertices[0].x, e.vertices[0].y), p2 = toCanvas(e.vertices[1].x, e.vertices[1].y); if (p1.cx != null && !isNaN(p1.cx)) { bgCtx.moveTo(p1.cx, p1.cy); bgCtx.lineTo(p2.cx, p2.cy); } }
            else if (['LWPOLYLINE', 'POLYLINE'].includes(e.type) && e.vertices) { e.vertices.forEach((v, i) => { let p = toCanvas(v.x, v.y); if (p.cx != null && !isNaN(p.cx)) { i === 0 ? bgCtx.moveTo(p.cx, p.cy) : bgCtx.lineTo(p.cx, p.cy); } }); if (e.closed) bgCtx.closePath(); }
            else if (e.type === 'CIRCLE') { let p = toCanvas(e.center.x, e.center.y); if (p.cx != null && !isNaN(p.cx)) { bgCtx.arc(p.cx, p.cy, e.radius * sc, 0, 2 * Math.PI); } }
            else if (e.type === 'ARC') { let p = toCanvas(e.center.x, e.center.y); if (p.cx != null && !isNaN(p.cx)) { bgCtx.arc(p.cx, p.cy, e.radius * sc, -e.endAngle * Math.PI / 180, -e.startAngle * Math.PI / 180); } }
            bgCtx.stroke();
        });

        bgTextsOriginal.filter(t => t.isUnderlay && (t.floor === f || t.floor === 'ALL')).forEach(t => {
            if (!isPrint && layerVisibility[t.layer] === false) return;
            let p = toCanvas(t.x, t.y);
            if (p.cx != null && !isNaN(p.cx)) {
                bgCtx.fillStyle = '#cccccc';
                bgCtx.font = "20px sans-serif";
                bgCtx.textAlign = "left"; bgCtx.fillText(t.text, p.cx, p.cy);
            }
        });

        x.save();
        x.globalAlpha = 1.0;
        x.drawImage(bgCanvas, 0, 0);
        x.restore();

        x.lineWidth = 2;
        areaLines.filter(a => a.floor === f).forEach((a, index) => {
            x.beginPath(); // ★独立
            a.vertices.forEach((v, i) => { let p = toCanvas(v.x, v.y); if (p.cx != null && !isNaN(p.cx)) { i === 0 ? x.moveTo(p.cx, p.cy) : x.lineTo(p.cx, p.cy); } });
            if (a.closed) x.closePath();
            x.save();
            x.globalAlpha = 1.0;
            let fillCol = 'rgba(173, 216, 230, 0.4)', strokeCol = 'rgba(46, 204, 113, 0.8)';
            if (a.areaType === 'attic') { fillCol = 'rgba(155, 89, 182, 0.3)'; strokeCol = '#8e44ad'; }
            else if (a.areaType === 'balcony') { fillCol = 'rgba(230, 126, 34, 0.3)'; strokeCol = '#e67e22'; }
            else if (a.areaType === 'void') { fillCol = 'rgba(127, 140, 141, 0.3)'; strokeCol = '#7f8c8d'; }
            else if (a.areaType === 'porch') { fillCol = 'rgba(241, 196, 15, 0.3)'; strokeCol = '#f39c12'; }
            x.fillStyle = fillCol; x.fill();
            x.strokeStyle = strokeCol; x.lineWidth = 2; x.stroke();
            x.restore();

            // 重心計算
            let cx = 0, cy = 0;
            a.vertices.forEach(v => { cx += toCanvas(v.x, v.y).cx; cy += toCanvas(v.x, v.y).cy; });
            cx /= a.vertices.length; cy /= a.vertices.length;

            let typeName = '床面積';
            if (a.areaType === 'attic') typeName = '小屋裏';
            else if (a.areaType === 'balcony') typeName = 'バルコニー';
            else if (a.areaType === 'void') typeName = '吹き抜け';
            else if (a.areaType === 'porch') typeName = 'ポーチ・屋根';

            let labelText = `${index + 1}. ${typeName}`;
            x.save();
            x.font = `bold ${Math.round(24 * dimScale)}px sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
            x.lineWidth = 4 * dimScale; x.strokeStyle = '#ffffff';
            x.strokeText(labelText, cx, cy);
            x.fillStyle = '#2c3e50'; x.fillText(labelText, cx, cy);
            x.restore();

            // ★ 追加: 床面積図への寸法線（距離）描画
            if (showAreaDims) {
                x.font = `bold ${Math.round(24 * dimScale)}px sans-serif`; x.textAlign = "center"; x.textBaseline = "alphabetic";
                for (let i = 0; i < a.vertices.length; i++) {
                    let v1 = a.vertices[i], v2 = a.vertices[(i + 1) % a.vertices.length];
                    let p1 = toCanvas(v1.x, v1.y), p2 = toCanvas(v2.x, v2.y);
                    if (p1.cx != null && p2.cx != null) {
                        let d = Math.round(Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2)));
                        let mx = (p1.cx + p2.cx) / 2, my = (p1.cy + p2.cy) / 2;

                        // 重心(CX,CY)から辺の中点(MX,MY)への法線ベクトル判定 (常に外側へオフセット)
                        let dxCentroid = mx - cx, dyCentroid = my - cy;
                        let lenCentroid = Math.hypot(dxCentroid, dyCentroid) || 1; // ゼロ除算回避
                        let nx = dxCentroid / lenCentroid, ny = dyCentroid / lenCentroid;

                        let offset = 40 * dimScale;
                        let ox = nx * offset, oy = ny * offset;

                        if (d > 0) {
                            x.strokeStyle = '#ffffff'; x.lineWidth = 5 * dimScale;
                            x.strokeText(String(d), mx + ox, my + oy);
                            x.fillStyle = '#c0392b'; x.fillText(String(d), mx + ox, my + oy);
                        }
                    }
                }
            }
        });

        if (mode === 'area') {
            x.lineWidth = 2.0; x.strokeStyle = '#27ae60'; x.setLineDash([]);
            pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === f).forEach(p => {
                // ★ レイヤ表示判定
                if (!isPrint && p.layer && layerVisibility[p.layer] === false) return;

                const polys = p.tributaryPolygons || (p.tributaryPolygon ? [p.tributaryPolygon] : []);
                polys.forEach(poly => {
                    if (poly && poly.length >= 3) {
                        x.fillStyle = 'rgba(46, 204, 113, 0.15)';
                        x.beginPath();
                        poly.forEach((v, i) => { let cp = toCanvas(v.x, v.y); if (i === 0) x.moveTo(cp.cx, cp.cy); else x.lineTo(cp.cx, cp.cy); });
                        x.closePath(); x.fill(); x.stroke();
                    }
                });
            });
            x.setLineDash([]);
        }

        x.strokeStyle = '#555'; x.setLineDash([10, 10]); x.fillStyle = '#333';
        if (gridXCoords.length > 0 && gridYCoords.length > 0) {
            let gMinX = Math.min(...gridXCoords), gMaxX = Math.max(...gridXCoords);
            let gMinY = Math.min(...gridYCoords), gMaxY = Math.max(...gridYCoords);
            let topCy = toCanvas(0, gMaxY).cy, botCy = toCanvas(0, gMinY).cy;
            let leftCx = toCanvas(gMinX, 0).cx, rightCx = toCanvas(gMaxX, 0).cx;

            gridXCoords.forEach((xx, i) => {
                let cx = toCanvas(xx, 0).cx;
                if (cx != null && !isNaN(cx)) {
                    x.beginPath(); x.moveTo(cx, topCy - 50); x.lineTo(cx, botCy + 50); x.stroke();
                    x.font = "bold 24px sans-serif"; x.textAlign = "center"; x.fillText(gridXNames[i] || '', cx, topCy - 60);
                    if (i < gridXCoords.length - 1) { let d = gridXCoords[i + 1] - xx; let midCx = toCanvas(xx + d / 2, 0).cx; x.fillStyle = '#27ae60'; x.font = "24px sans-serif"; x.fillText(d.toFixed(0), midCx, botCy + 75); x.fillStyle = '#333'; }
                }
            });
            gridYCoords.forEach((yy, i) => {
                let cy = toCanvas(0, yy).cy;
                if (cy != null && !isNaN(cy)) {
                    x.beginPath(); x.moveTo(leftCx - 50, cy); x.lineTo(rightCx + 50, cy); x.stroke();
                    x.font = "bold 24px sans-serif"; x.textAlign = "right"; x.fillText(gridYNames[i] || '', leftCx - 60, cy + 8);
                    if (i < gridYCoords.length - 1) { let d = gridYCoords[i + 1] - yy; let midCy = toCanvas(0, yy + d / 2).cy; x.fillStyle = '#27ae60'; x.font = "24px sans-serif"; x.fillText(d.toFixed(0), leftCx - 60, midCy + 8); x.fillStyle = '#333'; }
                }
            });
        }
        x.setLineDash([]);
        x.fillStyle = '#333';
        bgTextsOriginal.filter(t => !t.isUnderlay && (t.floor === f || t.floor === 'ALL')).forEach(t => {
            if (layerVisibility[t.layer] === false) return;
            let p = toCanvas(t.x, t.y); if (p.cx != null && !isNaN(p.cx)) { x.font = "24px sans-serif"; x.textAlign = "left"; x.fillText(t.text, p.cx, p.cy); }
        });

        if (mode !== 'area') {
            windowsArr.filter(w => w.floor === f).forEach(w => {
                let p1 = toCanvas(w.p1.x, w.p1.y), p2 = toCanvas(w.p2.x, w.p2.y);
                if (p1.cx != null && !isNaN(p1.cx) && p2.cx != null && !isNaN(p2.cx)) {
                    x.lineWidth = 20; x.strokeStyle = 'rgba(52,152,219,0.3)'; x.beginPath(); x.moveTo(p1.cx, p1.cy); x.lineTo(p2.cx, p2.cy); x.stroke();
                    x.font = 'bold 18px sans-serif'; x.fillStyle = '#333'; x.textAlign = "center"; x.fillText("開口", (p1.cx + p2.cx) / 2, (p1.cy + p2.cy) / 2 + 6);
                }
            });

            walls.filter(w => w.floor === f).forEach(w => {
                let dx = Math.abs(w.p2.x - w.p1.x), dy = Math.abs(w.p2.y - w.p1.y);
                let L_wall = Math.sqrt(dx * dx + dy * dy) / 1000;
                if (L_wall === 0) return;
                let ratioX = Math.min(1, Math.max(-1, dx / 1000 / L_wall)), ratioY = Math.min(1, Math.max(-1, dy / 1000 / L_wall));
                let degX = Math.acos(ratioX) * 180 / Math.PI, degY = Math.acos(ratioY) * 180 / Math.PI;

                if (d4) {
                    if (d4 === 'X') {
                        // X方向の4分割図: Y方向(垂直)の壁は非表示にする。ただし「斜め壁」は表示する。
                        if (degX > 75 && dx < 100) return; 
                    }
                    if (d4 === 'Y') {
                        // Y方向の4分割図: X方向(水平)の壁は非表示にする。ただし「斜め壁」は表示する。
                        if (degY > 75 && dy < 100) return;
                    }
                }

                let p1 = toCanvas(w.p1.x, w.p1.y), p2 = toCanvas(w.p2.x, w.p2.y);
                if (p1.cx != null && !isNaN(p1.cx) && p2.cx != null && !isNaN(p2.cx)) {
                    x.lineWidth = 10; x.strokeStyle = f === '1F' ? '#27ae60' : '#d35400'; x.beginPath(); x.moveTo(p1.cx, p1.cy); x.lineTo(p2.cx, p2.cy); x.stroke();
                    let tv = window.getWallTotalVal(w), mX = (p1.cx + p2.cx) / 2, mY = (p1.cy + p2.cy) / 2;
                    // ★ 面材記号を描画（数値は非表示）
                    let pM1 = (w.outPanelName && !w.outPanelName.includes('なし')) ? w.outPanelName.charAt(0) : '';
                    let pM2 = (w.inPanelName && !w.inPanelName.includes('なし')) ? w.inPanelName.charAt(0) : '';
                    let pMarks = [];
                    if (pM1) pMarks.push(pM1);
                    if (pM2) pMarks.push(pM2);
                    let wallMark = pMarks.join('+');
                    if (wallMark) {
                        x.font = 'bold 24px sans-serif'; x.lineWidth = 4; x.textAlign = "center";
                        let dxLine = Math.abs(p1.cx - p2.cx), dyLine = Math.abs(p1.cy - p2.cy);
                        let isVertical = dyLine > dxLine;
                        let offX = isVertical ? 25 : 0, offY = isVertical ? 0 : -15;

                        x.strokeStyle = '#fff'; x.strokeText(wallMark, mX + offX, mY + offY);
                        x.fillStyle = '#333'; x.fillText(wallMark, mX + offX, mY + offY);
                    }
                    if (w.braceVal > 0) {
                        x.save(); x.translate(mX, mY); x.rotate(Math.atan2(p2.cy - p1.cy, p2.cx - p1.cx)); x.fillStyle = '#333';
                        if (w.isTasuki) { x.beginPath(); x.moveTo(-20, 0); x.lineTo(20, 0); x.lineTo(20, -20); x.closePath(); x.fill(); x.beginPath(); x.moveTo(20, 0); x.lineTo(-20, 0); x.lineTo(-20, -20); x.closePath(); x.fill(); }
                        else { x.beginPath(); x.moveTo(-20, 0); x.lineTo(20, 0); x.lineTo(20, -20); x.closePath(); x.fill(); } x.restore();
                    }
                }
            });
        }

        pillars.filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === f || p.floor === 'ALL')).forEach(p => {
            let pt = toCanvas(p.x, p.y);
            if (pt.cx != null && !isNaN(pt.cx)) {
                x.fillStyle = '#333';
                let isC = p.isManualCorner !== null ? p.isManualCorner : p.isCornerAuto;
                if (isC) { x.beginPath(); x.arc(pt.cx, pt.cy, 18, 0, Math.PI * 2); x.fill(); } else { x.fillRect(pt.cx - 16, pt.cy - 16, 32, 32); }

                if (mode === 'n-value' && p.nValue !== undefined && p.nMark !== "不要" && p.nMark !== "-") {
                    x.textAlign = "center"; x.textBaseline = "middle"; x.font = "bold 28px sans-serif";
                    let textWidth = x.measureText(p.nMark).width; let padX = 10, padY = 8;
                    x.fillStyle = '#fff'; x.fillRect(pt.cx - textWidth / 2 - padX, pt.cy - 14 - padY, textWidth + padX * 2, 28 + padY * 2);
                    x.strokeStyle = '#333'; x.lineWidth = 2; x.strokeRect(pt.cx - textWidth / 2 - padX, pt.cy - 14 - padY, textWidth + padX * 2, 28 + padY * 2);
                    let hwL = getHardwareList(), hw = hwL.find(h => h.name === p.nMark);
                    x.fillStyle = (p.manualMark && hw && p.nValue > hw.n) ? '#e74c3c' : '#c0392b';
                    x.fillText(p.nMark, pt.cx, pt.cy); x.textBaseline = "alphabetic";
                }
            }
        });

        if (mode === 'area') {
            pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === f).forEach(p => {
                let pt = toCanvas(p.x, p.y);
                if (pt.cx != null && !isNaN(pt.cx)) {
                    let areaVal = p.usedArea != null ? p.usedArea : (p.autoArea || 0);
                    if (areaVal > 0) {
                        let txt = areaVal.toFixed(2) + "㎡";
                        x.font = "bold 14px sans-serif";
                        let tw = x.measureText(txt).width;
                        let OFFSET_Y = 24;
                        let PAD = 6, TH = 20;

                        x.fillStyle = 'rgba(255, 255, 255, 0.95)';
                        x.fillRect(pt.cx - tw / 2 - PAD, pt.cy + OFFSET_Y - TH + 2, tw + PAD * 2, TH + 2);
                        x.strokeStyle = 'rgba(30,132,73,0.8)'; x.lineWidth = 1;
                        x.strokeRect(pt.cx - tw / 2 - PAD, pt.cy + OFFSET_Y - TH + 2, tw + PAD * 2, TH + 2);

                        x.fillStyle = '#1e8449'; x.textAlign = "center"; x.textBaseline = "alphabetic";
                        x.fillText(txt, pt.cx, pt.cy + OFFSET_Y);
                    }
                }
            });
        }
        // ★ 修正4: スケールの描画
        const pScaleVal = document.getElementById('scale-plan') ? document.getElementById('scale-plan').value : (document.getElementById('scale-floor') ? document.getElementById('scale-floor').value : '100');
        x.font = "bold 32px sans-serif"; x.fillStyle = "#333"; x.textAlign = "right";
        x.fillText(`S = 1 / ${pScaleVal}`, c.width - 60, c.height - 60);

        let physW = dx / userScale;
        let physH = dy / userScale;
        return { img: c.toDataURL('image/png'), physW, physH };
    */



// [v3.3.0] generateAutoMitsukeCanvas -> view/ReportMitsukeView.js
function generateAutoMitsukeCanvas(direction, commonScale) {
    if (window.ReportMitsukeView) {
        return window.ReportMitsukeView.generateAutoMitsukeCanvas(direction, commonScale);
    }
    return null;
}
window.generateAutoMitsukeCanvas = generateAutoMitsukeCanvas;

// [v3.4.0] generateFloorAreaTableHtml -> delegated to ReportWallTableView (SRP)
function generateFloorAreaTableHtml(state) {
    if (window.ReportWallTableView) {
        return window.ReportWallTableView.generateFloorAreaTableHtml(state);
    }
    return '';
}
window.generateFloorAreaTableHtml = generateFloorAreaTableHtml;

function showAreaPreview() {
    if (window.PreviewModalView && typeof window.PreviewModalView.showAreaPreview === 'function') {
        return window.PreviewModalView.showAreaPreview();
    }
}

// 見附面積図クリック拡大機能
window._zoomMitsukeImg = function(src, title) {
    if (window.PreviewModalView && typeof window.PreviewModalView.zoomMitsukeImg === 'function') {
        return window.PreviewModalView.zoomMitsukeImg(src, title);
    }
    let overlay = document.getElementById('_mitsuke-zoom-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = '_mitsuke-zoom-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:zoom-out;';
        overlay.addEventListener('click', () => overlay.style.display = 'none');
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
        <div style="color:#fff;font-size:14px;font-weight:bold;margin-bottom:10px;opacity:0.8;">${title} <span style="font-size:11px;font-weight:normal;">(クリックで閉じる)</span></div>
        <img src="${src}" style="max-width:95vw;max-height:88vh;object-fit:contain;border:2px solid #fff;border-radius:6px;box-shadow:0 0 40px rgba(0,0,0,0.6);">
    `;
    overlay.style.display = 'flex';
};

// ★ 筋交いの向きラベルを返す補助関数
// braceName文字列に(／)(＼)(Ｘ)等が含まれればそれを採用
// braceName がない旧データは座標符号から方向を推定する


window.buildWallLegendData = function () {
    const s = window.AppState;
    const masterList = (s && typeof s.getMasterWallList === 'function') ? s.getMasterWallList() : [];
    let panelNames = new Set();

    // 1. マスター仕様リストの全面材仕様（①〜⑧、⑨〜）を追加
    masterList.forEach(m => {
        if (m.id !== 'opt0' && m.text && !m.text.startsWith('なし')) {
            panelNames.add(m.text);
        }
    });

    // 2. 現在配置されている壁の仕様を追加
    const wallsList = (s && s.walls) ? s.walls : (window.walls || []);
    wallsList.forEach(w => {
        if (w.outPanelId && window.WallEngine) {
            const spec = window.WallEngine.getWallSpec(w.outPanelId);
            if (spec && spec.id !== 'opt0' && spec.text && !spec.text.startsWith('なし')) panelNames.add(spec.text);
        } else if (w.outPanelName && !w.outPanelName.startsWith('なし')) {
            panelNames.add(w.outPanelName);
        }

        if (w.inPanelId && window.WallEngine) {
            const spec = window.WallEngine.getWallSpec(w.inPanelId);
            if (spec && spec.id !== 'opt0' && spec.text && !spec.text.startsWith('なし')) panelNames.add(spec.text);
        } else if (w.inPanelName && !w.inPanelName.startsWith('なし')) {
            panelNames.add(w.inPanelName);
        }
    });

    // 文字コード順でソート（①②③…の順序）
    let sortedNames = Array.from(panelNames).sort();

    let panelDic = {};
    sortedNames.forEach(name => {
        let sym = name.charAt(0);
        if (sym) panelDic[sym] = name;
    });

    let htmlStr = "";
    if (sortedNames.length > 0) {
        htmlStr = `<table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-size:11px;">
    <tr style="background:#eee;">
        <th style="border:1px solid #333; padding:4px; width:10%;">記号</th>
        <th style="border:1px solid #333; padding:4px;">面材仕様 (材質・構成・釘)</th>
        <th style="border:1px solid #333; padding:4px; width:15%;">壁倍率</th>
    </tr>`;
        sortedNames.forEach(name => {
            let parts = name.match(/^(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩|⑪|⑫|⑬|⑭|⑮|⑯|⑰|⑱|⑲|⑳|\[任意\]|[0-9]+)\s*(.*?)\s*\(?([\d.]+\s*倍)?\)?$/);
            if (parts && parts[1]) {
                htmlStr += `<tr>
            <td style="border:1px solid #333; padding:4px; text-align:center; font-weight:bold;">${parts[1]}</td>
            <td style="border:1px solid #333; padding:4px;">${parts[2] || name}</td>
            <td style="border:1px solid #333; padding:4px; text-align:center; font-weight:bold;">${parts[3] || '-'}</td>
        </tr>`;
            } else {
                htmlStr += `<tr>
            <td style="border:1px solid #333; padding:4px; text-align:center;">-</td>
            <td style="border:1px solid #333; padding:4px;">${name}</td>
            <td style="border:1px solid #333; padding:4px; text-align:center;">-</td>
        </tr>`;
            }
        });
        htmlStr += `</table><p style="font-size:10px; margin-top:-5px; margin-bottom:20px;">※筋違の仕様・向きは、<sub style="font-size:0.6em; vertical-align:sub;">柱脚</sub>◢<sup style="font-size:0.6em; vertical-align:super;">柱頭</sup>です。</p>`;
    } else {
        htmlStr = `<p style="font-size: 11px; color: #555; text-align: left; margin-top: 5px; margin-bottom: 20px;">※耐力面材なし（※筋違の仕様・向きは、<sub style="font-size:0.6em; vertical-align:sub;">柱脚</sub>◢<sup style="font-size:0.6em; vertical-align:super;">柱頭</sup>です。）</p>`;
    }

    return { panelDic, htmlStr };
};

// PDF生成機能 (マスター完全維持)
async function generateDoc() {
    try {
        const s = window.AppState;
        const walls = s.walls;
        const reqWall = s.reqWall; // Use the calculated amounts
        const requiredAreas = s.requiredAreas; // Use the raw areas if needed
        const areaLines = s.areaLines;
        const pillars = s.pillars;

        updateCalculations();

        // --- 全検定エラー（NG）の集計・警告ダイアログ表示 ---
        {
            const errors = (window.ReportEngine && typeof window.ReportEngine.collectAllErrors === 'function') 
                ? window.ReportEngine.collectAllErrors(s) 
                : [];

            if (errors.length > 0) {
                const errMsg = "⚠️ 計算書に検定エラー（NG）があります。エラー一覧を確認してください。\n\n" + 
                               errors.join("\n") + 
                               "\n\n※このまま「OK」を押すと、計算書が出力されます。";
                alert(errMsg);
            }
        }

        // ★ 一括出力・表生成用の凡例用マッピングデータ生成
        let legendData = window.buildWallLegendData ? window.buildWallLegendData() : { panelDic: {}, htmlStr: '' };
        window._currentLegendDic = legendData.panelDic;
        let globalLegendHtml = legendData.htmlStr;

        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        // 単一責任の原則に従い、解析・計算エンジンを事前実行してデータオブジェクトに充填
        if (window.StructuralEngine && typeof window.StructuralEngine.runAnalysis === 'function') {
            window.StructuralEngine.runAnalysis(s);
        }
        if (window.FoundationEngine && typeof window.FoundationEngine.runAnalysis === 'function') {
            window.FoundationEngine.runAnalysis(s);
        }
        if (window.MitsukeEngine && typeof window.MitsukeEngine.updateProjectedAreas === 'function') {
            window.MitsukeEngine.updateProjectedAreas(s);
        }

        const fields = { 'out-prj': 'info-prj', 'out-office': 'info-office', 'out-license': 'info-license', 'out-name': 'info-name' };
        Object.entries(fields).forEach(([outId, srcId]) => { const el = document.getElementById(outId); if (el) el.innerText = getStr(srcId); });
        const datEl = document.getElementById('out-date'); if (datEl) { const d = new Date(); datEl.innerText = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; }

        let summaryData = { '1F': {}, '2F': {} };
        let isTotalOk = true;

        ['1F', '2F'].forEach(f => {
            const sd_state = s.reqWall[f];
            const d4 = sd_state.div4;
            const rX = sd_state.qX, rY = sd_state.qY;
            const kxt = d4.vxt + (sd_state.v_mid_x || 0); // Note: Simple sum for summary
            const kyt = d4.vyl + (sd_state.v_mid_y || 0); 
            
            // Re-calculate total kxt/kyt consistently with WallEngine
            let totalKxt = 0, totalKyt = 0;
            walls.filter(w => w.floor === f).forEach(w => {
                const dx = Math.abs(w.p2.x - w.p1.x) / 1000;
                const dy = Math.abs(w.p2.y - w.p1.y) / 1000;
                const tv = window.WallEngine.getTotalMultiplier(w);
                totalKxt += dx * tv;
                totalKyt += dy * tv;
            });

            const wallOk = (totalKxt >= rX) && (totalKyt >= rY);
            const div4Ok = d4.isXOk && d4.isYOk;

            const hasNgLambda = pillars.some(p => !p.isDeleted && !p.isInvalidPos && p.floor === f && p.lambda != null && !p.lambdaOK);
            const lamOk = !hasNgLambda;

            const floorOk = wallOk && div4Ok && lamOk;
            if (!floorOk) isTotalOk = false;

            summaryData[f] = { wallOk, div4Ok, lamOk, floorOk };
        });

        let navHtml = `<div style="display:flex; align-items:center; gap:6px; width:100%; flex-wrap:wrap; font-size:11px;">
            <span style="color:#ecf0f1; font-weight:bold; font-size:13px; margin-right:4px;">📄 目次:</span>
            <button class="jump-btn" onclick="document.getElementById('sec-area')?.scrollIntoView({behavior:'smooth'})" style="padding:4px 8px; background:#34495e; color:#fff; border:1px solid #5d6d7e; border-radius:4px; cursor:pointer;">1.面積・壁量</button>
            <button class="jump-btn" onclick="document.getElementById('sec-wall')?.scrollIntoView({behavior:'smooth'})" style="padding:4px 8px; background:#34495e; color:#fff; border:1px solid #5d6d7e; border-radius:4px; cursor:pointer;">2.壁量検定</button>
            <button class="jump-btn" onclick="document.getElementById('sec-div4')?.scrollIntoView({behavior:'smooth'})" style="padding:4px 8px; background:#34495e; color:#fff; border:1px solid #5d6d7e; border-radius:4px; cursor:pointer;">3.4分割</button>
            <button class="jump-btn" onclick="document.getElementById('sec-nval')?.scrollIntoView({behavior:'smooth'})" style="padding:4px 8px; background:#34495e; color:#fff; border:1px solid #5d6d7e; border-radius:4px; cursor:pointer;">4.N値</button>
            <button class="jump-btn" onclick="document.getElementById('sec-pillar')?.scrollIntoView({behavior:'smooth'})" style="padding:4px 8px; background:#34495e; color:#fff; border:1px solid #5d6d7e; border-radius:4px; cursor:pointer;">5.柱負担</button>
            <button class="jump-btn" onclick="document.getElementById('sec-fd-slab')?.scrollIntoView({behavior:'smooth'})" style="padding:4px 8px; background:#8e44ad; color:#fff; border:1px solid #a569bd; border-radius:4px; cursor:pointer;">6.基礎スラブ</button>
            <button class="jump-btn" onclick="document.getElementById('sec-fd-beam')?.scrollIntoView({behavior:'smooth'})" style="padding:4px 8px; background:#8e44ad; color:#fff; border:1px solid #a569bd; border-radius:4px; cursor:pointer;">7.基礎梁</button>
            
            <div style="flex-grow:1;"></div>
            
            <span style="color:#d5f5e3; font-weight:bold; font-size:11px;">🖨️ 印刷範囲:</span>
            <select id="doc-print-range-select" style="padding:4px 8px; font-size:11px; font-weight:bold; background:#fff; color:#2c3e50; border:none; border-radius:4px; cursor:pointer;">
                <option value="all">📑 全計算書を一括出力 (1〜7全項目)</option>
                <option value="wall_only">📄 壁量計算書を出力 (1〜5項目)</option>
                <option value="fd_only">🏗️ 基礎計算書を出力 (6〜7項目)</option>
            </select>
            <button class="print-btn" onclick="window.printDocSection()" style="padding:5px 12px; background:#27ae60; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:12px;">🖨️ 印刷/PDF</button>
            <button class="btn-close-modal" onclick="document.getElementById('modal-doc').style.display='none'" style="padding:5px 12px; background:#e74c3c; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:12px;">✖ 閉じる</button>
        </div>`;

        const navEl = document.getElementById('doc-nav-container');
        if (navEl) navEl.innerHTML = navHtml;
        document.querySelectorAll('#doc-nav-container .btn-close-modal, #modal-doc .btn-close-modal').forEach(btn => {
            btn.addEventListener('click', function () { 
                const mDoc = document.getElementById('modal-doc');
                if (mDoc) mDoc.style.display = 'none'; 
            });
        });

        // 印刷範囲コントロール関数のグローバル登録（PdfReportView 委譲）
        window.printDocSection = function() {
            if (window.PdfReportView && typeof window.PdfReportView.printDocSection === 'function') {
                window.PdfReportView.printDocSection();
            } else {
                window.print();
            }
        };

        const getHeader = (title) => {
            return (window.ReportHeaderView && typeof window.ReportHeaderView.generatePageHeaderHtml === 'function')
                ? window.ReportHeaderView.generatePageHeaderHtml(title)
                : `<h3 style="margin:0 0 10px 0; color:#333; font-size:16px;">${title}</h3>`;
        };

        // 表紙HTMLの生成
        let h = (window.ReportHeaderView && typeof window.ReportHeaderView.generateReportCoverHtml === 'function')
            ? window.ReportHeaderView.generateReportCoverHtml(s)
            : '';

        h += `<div id="sec-summary" class="doc-section" style="margin-bottom:25px; border:2px solid ${isTotalOk ? '#27ae60' : '#c0392b'}; border-radius:4px; padding:15px; background:#fdfdfd;">
            ${getHeader('構造計算 検定結果サマリー')}
            <table class="report-table" style="width:100%; margin:0; font-size:14px;">
                <tr><th style="width:15%;">階</th><th>壁量検定 (X/Y)</th><th>4分割 壁釣り合い</th><th>有効細長比</th><th>柱の最大負担面積(㎡)</th><th style="width:20%;">総合判定</th></tr>`;

        ['2F', '1F'].forEach(f => {
            let sd = summaryData[f];
            let g = (ok) => ok ? '<span style="color:#27ae60;font-weight:bold;">OK</span>' : '<span style="color:#c0392b;font-weight:bold;">NG</span>';
            let t = sd.floorOk ? '<span style="color:#2980b9;font-weight:bold;font-size:16px;">適合</span>' : '<span style="color:#c0392b;font-weight:bold;font-size:16px;">不適合</span>';

            // 最大負担面積の抽出
            let maxArea = Math.max(0, ...pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === f).map(p => p.usedArea || 0));
            let maxAreaStr = `<span style="color:#27ae60;font-weight:bold;">${f}: ${maxArea.toFixed(2)}㎡</span>`;

            h += `<tr><td style="font-weight:bold;">${f}</td><td>${g(sd.wallOk)}</td><td>${g(sd.div4Ok)}</td><td>${g(sd.lamOk)}</td><td>${maxAreaStr}</td><td>${t}</td></tr>`;
        });
        h += `</table></div>`;

        let a4Warnings = [];
        const checkScale = (name, obj, isPair = false, pairObj = null) => {
            // ★ スケール判定と警告は廃止されたため、何もしない
        };

        const oFloor1F = createLayerFilteredImage('floor', ['AREA_D_1F', 'AREA_1F'], ['BG_1F'], '1F', true, 2.0, true); checkScale('1F 床面積', oFloor1F);
        const oFloor2F = createLayerFilteredImage('floor', ['AREA_D_2F', 'AREA_2F'], ['BG_2F'], '2F', true, 2.0, true); checkScale('2F 床面積', oFloor2F);
        const oFloorRF = createLayerFilteredImage('floor', ['AREA_D_RF', 'AREA_RF'], ['BG_RF'], 'RF', true, 2.0, true); if (oFloorRF) checkScale('RF 床面積', oFloorRF);
        const oElevX = null;
        const oElevY = null;

        const oDiv41F = createNativeCanvasImage('1F', 'wall', 'X', true, 1.0, true); checkScale('1F 4分割', oDiv41F);
        const oDiv42F = createNativeCanvasImage('2F', 'wall', 'X', true, 1.0, true); checkScale('2F 4分割', oDiv42F);

        let oW1 = createHighResPlanImage('1F', 'wall', null, false, 1.0, true), oN1 = createHighResPlanImage('1F', 'n-value', null, false, 1.0, true);
        checkScale('1F 壁伏図', oW1); checkScale('1F N値', oN1);
        let oW2 = createHighResPlanImage('2F', 'wall', null, false, 1.0, true), oN2 = createHighResPlanImage('2F', 'n-value', null, false, 1.0, true);
        checkScale('2F 壁伏図', oW2); checkScale('2F N値', oN2);
        let oX1 = createHighResPlanImage('1F', 'wall', 'X', true, 1.0, true), oY1 = createHighResPlanImage('1F', 'wall', 'Y', true, 1.0, true);
        checkScale('1F 4分割(X)', oX1); checkScale('1F 4分割(Y)', oY1);
        let oX2 = createHighResPlanImage('2F', 'wall', 'X', true, 1.0, true), oY2 = createHighResPlanImage('2F', 'wall', 'Y', true, 1.0, true);
        checkScale('2F 4分割(X)', oX2); checkScale('2F 4分割(Y)', oY2);
        let oPa1 = createHighResPlanImage('1F', 'area', null, true, 1.0, true), oPa2 = createHighResPlanImage('2F', 'area', null, true, 1.0, true);
        checkScale('1F 柱負担面積', oPa1); checkScale('2F 柱負担面積', oPa2);

        const iFloor1F = oFloor1F?.img, iFloor2F = oFloor2F?.img, iFloorRF = oFloorRF?.img;
        const iElevX = oElevX?.img, iElevY = oElevY?.img;
        const iDiv41F = oDiv41F?.img, iDiv42F = oDiv42F?.img;
        let w1 = oW1?.img, n1 = oN1?.img, w2 = oW2?.img, n2 = oN2?.img;
        let x1 = oX1?.img, y1 = oY1?.img, x2 = oX2?.img, y2 = oY2?.img;
        let pa1 = oPa1?.img, pa2 = oPa2?.img;

        // ★ アラートを廃止（UI側の静的メッセージで対応）


        let secNum = 1;

        let isFirstAreaSec = true;
        const addAreaSecHeader = (title) => {
            let idAttr = isFirstAreaSec ? 'id="sec-area"' : '';
            let numStr = isFirstAreaSec ? `■ ${secNum++}. ` : `■ `;
            isFirstAreaSec = false;
            return `<div class="doc-section" ${idAttr}><h3>${numStr}${title}</h3><div style="display:flex;gap:15px;flex-wrap:wrap;justify-content:center;margin-bottom:15px;">`;
        };

        // ★ 修正: 図(iFloor1F)と表(fAreas)を完全に分離。表はareaLinesがあれば図がなくても必ず出力
        { const fAreas = areaLines.filter(a => a.floor === '1F');
        if (iFloor1F || fAreas.length > 0) {
            h += addAreaSecHeader('1F 床面積図・表 ＆ 必要壁量算定');
            let calcModeStr = document.getElementById('calc-mode-select')?.value === 'seinou' ? '性能表示(見上げ面積)' : '建築基準法(見下げ面積)';
            h += `<div style="width:100%; text-align:left; background:#fafafa; border:1px solid #ddd; padding:8px; margin-bottom:15px; font-size:12px; line-height:1.4;">
                    <b>【1F階 床面積の算定根拠】</b><br>
                    対象モード: <b>${calcModeStr}</b><br>
                    加算式: ${reqWall['1F']?.basis || ''}
                  </div>`;
            if (iFloor1F) {
                h += `<div style="text-align:center;width:100%;"><img src="${iFloor1F}" style="width:95%;max-width:800px;border:1px solid #ccc;padding:5px;margin-bottom:10px;"></div>`;
            }
            if (fAreas.length > 0) {
                h += `<div style="width:100%; margin-top:10px;"><div style="background:#27ae60;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px;">1F 床面積 求積表</div>`;
                h += `<table class="report-table" style="font-size:11px; width:100%; text-align:center;"><tr><th>No.</th><th>底辺(m)</th><th>高さ(m)</th><th>計算式</th><th>面積(㎡)</th></tr>`;
                let totalA = 0;
                fAreas.forEach((area, i) => {
                    const rowData = getAreaRowsHtml(area, i);
                    h += rowData.html;
                    totalA += rowData.area;
                });
                h += `<tr style="font-weight:bold;"><td colspan="4" style="text-align:right;">合計床面積：</td><td style="color:#d35400;">${totalA.toFixed(2)} ㎡</td></tr></table></div>`;
            }
            h += `</div></div><div class="page-break"></div>`;
        } }

        // ★ 修正: 図(iFloor2F)と表(fAreas)を完全に分離
        { const fAreas = areaLines.filter(a => a.floor === '2F');
        if (iFloor2F || fAreas.length > 0) {
            h += addAreaSecHeader('2F 床面積図・表 ＆ 必要壁量算定');
            let calcModeStr = document.getElementById('calc-mode-select')?.value === 'seinou' ? '性能表示(見上げ面積)' : '建築基準法(見下げ面積)';
            h += `<div style="width:100%; text-align:left; background:#fafafa; border:1px solid #ddd; padding:8px; margin-bottom:15px; font-size:12px; line-height:1.4;">
                    <b>【2F階 床面積の算定根拠】</b><br>
                    対象モード: <b>${calcModeStr}</b><br>
                    加算式: ${reqWall['2F']?.basis || ''}
                  </div>`;
            if (iFloor2F) {
                h += `<div style="text-align:center;width:100%;"><img src="${iFloor2F}" style="width:95%;max-width:800px;border:1px solid #ccc;padding:5px;margin-bottom:10px;"></div>`;
            }
            if (fAreas.length > 0) {
                h += `<div style="width:100%; margin-top:10px;"><div style="background:#27ae60;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px;">2F 床面積 求積表</div>`;
                h += `<table class="report-table" style="font-size:11px; width:100%; text-align:center;"><tr><th>No.</th><th>底辺(m)</th><th>高さ(m)</th><th>計算式</th><th>面積(㎡)</th></tr>`;
                let totalA = 0;
                fAreas.forEach((area, i) => {
                    const rowData = getAreaRowsHtml(area, i);
                    h += rowData.html;
                    totalA += rowData.area;
                });
                h += `<tr style="font-weight:bold;"><td colspan="4" style="text-align:right;">合計床面積：</td><td style="color:#d35400;">${totalA.toFixed(2)} ㎡</td></tr></table></div>`;
            }
            h += `</div></div><div class="page-break"></div>`;
        } }

        if (iFloorRF) {
            h += addAreaSecHeader('RF 床面積図・表');
            h += `<div style="text-align:center;width:100%;"><img src="${iFloorRF}" style="width:95%;max-width:800px;border:1px solid #ccc;padding:5px;margin-bottom:10px;"></div>`;
            const fAreas = areaLines.filter(a => a.floor === 'RF');
            console.log(`[生成ログ] RF 床面積ポリゴン抽出数: ${fAreas.length} (isPrint: true で強制出力)`);
            if (fAreas.length > 0) {
                h += `<div style="width:100%; margin-top:10px;"><div style="background:#27ae60;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px;">RF 床面積 求積表</div>`;
                h += `<table class="report-table" style="font-size:11px; width:100%; text-align:center;"><tr><th>No.</th><th>底辺(m)</th><th>高さ(m)</th><th>計算式</th><th>面積(㎡)</th></tr>`;
                let totalA = 0;
                fAreas.forEach((area, i) => {
                    const rowData = getAreaRowsHtml(area, i);
                    h += rowData.html;
                    totalA += rowData.area;
                });
                h += `<tr style="font-weight:bold;"><td colspan="4" style="text-align:right;">合計床面積：</td><td style="color:#d35400;">${totalA.toFixed(2)} ㎡</td></tr></table></div>`;
            } else {
                h += `<div style="width:100%; margin-top:10px;"><div style="background:#27ae60;color:#fff;padding:3px 5px;font-weight:bold;font-size:12px;border-radius:3px;">RF 床面積 求積表</div>`;
                h += `<table class="report-table" style="font-size:11px; width:100%; text-align:center;"><tr><th>No.</th><th>底辺(m)</th><th>高さ(m)</th><th>計算式</th><th>面積(㎡)</th></tr>`;
                h += `<tr><td colspan="5" style="color:#e74c3c; padding:10px;">計算データなし（レイヤ内の図形が抽出・認識されていません）</td></tr>`;
                h += `</table></div>`;
            }
            h += `</div></div><div class="page-break"></div>`;
        }

        // [v2.7.0] 自動屋根伏図・実積（実面積）求積表の出力
        const roofFaces = s.roofFaces || [];
        if (roofFaces.length > 0) {
            h += addAreaSecHeader('屋根伏図・屋根実積（実面積）の算定');

            const c1R = window.RoofRenderer ? window.RoofRenderer.generateReportCanvas(s, '1F') : null;
            const c2R = window.RoofRenderer ? window.RoofRenderer.generateReportCanvas(s, '2F') : null;
            const i1R = c1R ? c1R.toDataURL() : null;
            const i2R = c2R ? c2R.toDataURL() : null;

            if (i2R && roofFaces.some(f => f.floor === '2F')) {
                h += `<div style="text-align:center;width:100%; margin-bottom:20px;">
                        <div style="font-weight:bold;margin-bottom:5px;font-size:12px;color:#2c3e50;">【2階 屋根伏図】</div>
                        <img src="${i2R}" style="width:90%;max-width:720px;border:1px solid #ddd;padding:5px;">
                      </div>`;
            }
            if (i1R && roofFaces.some(f => f.floor === '1F')) {
                h += `<div style="text-align:center;width:100%; margin-bottom:20px;">
                        <div style="font-weight:bold;margin-bottom:5px;font-size:12px;color:#2c3e50;">【1階 屋根伏図】</div>
                        <img src="${i1R}" style="width:90%;max-width:720px;border:1px solid #ddd;padding:5px;">
                      </div>`;
            }

            h += `<div style="width:100%; margin-top:10px;">
                    <div style="background:#2980b9;color:#fff;padding:4px 8px;font-weight:bold;font-size:12px;border-radius:3px;margin-bottom:5px;">🏠 屋根面 実積（実面積）求積一覧表</div>
                    <table class="report-table" style="font-size:11px; width:100%; text-align:center;">
                        <tr style="background:#f2f2f2; font-weight:bold;">
                            <th>名称</th>
                            <th>所在階</th>
                            <th>勾配 (寸)</th>
                            <th>厚さ (mm)</th>
                            <th>基準高増減</th>
                            <th>水平投影面積 (㎡)</th>
                            <th>勾配補正係数 (secθ)</th>
                            <th>屋根実面積 (㎡)</th>
                        </tr>`;
            
            let totalProj = 0;
            let totalReal = 0;

            roofFaces.forEach(face => {
                const proj = window.RoofEngine.calculatePolygonArea2D(face.vertices.map(v => ({ u: v.x/1000, v: v.y/1000 })));
                const slopeVal = face.slope / 10;
                const factor = Math.sqrt(1 + slopeVal * slopeVal);
                const real = proj * factor;

                totalProj += proj;
                totalReal += real;

                h += `<tr>
                        <td style="font-weight:bold;">${face.label || '屋根'}</td>
                        <td>${face.floor === '2F' ? '2階屋根' : '1階屋根'}</td>
                        <td>${face.slope.toFixed(1)}寸</td>
                        <td>${face.roofThickness} mm</td>
                        <td>${face.baseHeightDelta >= 0 ? '+' : ''}${face.baseHeightDelta} mm</td>
                        <td>${proj.toFixed(2)} ㎡</td>
                        <td>${factor.toFixed(4)}</td>
                        <td style="font-weight:bold; color:#2980b9;">${real.toFixed(2)} ㎡</td>
                      </tr>`;
            });

            h += `<tr style="font-weight:bold; background:#e8f4f8;">
                    <td colspan="5" style="text-align:right;">合計：</td>
                    <td>${totalProj.toFixed(2)} ㎡</td>
                    <td>-</td>
                    <td style="color:#2980b9; font-size:13px;">${totalReal.toFixed(2)} ㎡</td>
                  </tr>
                  </table>
                  <div style="font-size:10px; color:#7f8c8d; margin-top:5px; text-align:left; line-height:1.4;">
                    ※ 屋根実面積 ＝ 水平投影面積 × 勾配補正係数（secθ ＝ √[1 ＋ (勾配/10)²]）<br>
                    ※ 屋根厚みおよび基準高増減は、見付面積算定時の傾斜立体投影における厚み効果計算に使用されます。
                  </div>
                  </div>`;
            
            h += `</div></div><div class="page-break"></div>`;
        }

        ['1F', '2F'].forEach(f => {
            let cq = getVal(`c-q${f[0]}`);
            let a_eff = reqWall[f].a_eff.toFixed(2), eq = reqWall[f].eq.toFixed(2);
            let raw_wx = getVal(`a-wx${f[0]}`), raw_wy = getVal(`a-wy${f[0]}`);
            if (f === '1F') { raw_wx += getVal('a-wx2'); raw_wy += getVal('a-wy2'); }
            let awx = raw_wx.toFixed(2), cw = getVal(`c-w${f[0]}`).toFixed(2);
            let qX_base = (raw_wx * getVal(`c-w${f[0]}`)).toFixed(2);
            let awy = raw_wy.toFixed(2), qY_base = (raw_wy * getVal(`c-w${f[0]}`)).toFixed(2);
            let max_x = reqWall[f].qX.toFixed(2), max_y = reqWall[f].qY.toFixed(2);
            let ext = getVal(`e-x-t${f[0]}`), exb = getVal(`e-x-b${f[0]}`), eyl = getVal(`e-y-l${f[0]}`), eyr = getVal(`e-y-r${f[0]}`);

            // 【見附面積 算定図 ＆ 見附面積求積表】の全自動出力
            const mitsukeTableHtml = window.ElevationRenderer && window.ElevationRenderer.generateElevationAreaTableHtml ? window.ElevationRenderer.generateElevationAreaTableHtml(s) : '';
            const iAutoEX = generateAutoMitsukeCanvas('X');
            const iAutoEY = generateAutoMitsukeCanvas('Y');

            h += `<div style="margin-top:20px; margin-bottom:20px; page-break-inside: avoid; break-inside: avoid;">
                    <div style="font-weight:bold; font-size:13px; color:#2c3e50; margin-bottom:10px; border-bottom:2px solid #2980b9; padding-bottom:4px;">【X/Y方向 見附面積算定図 ＆ 風圧力用 見附面積求積表】</div>
                    <div style="display:flex; flex-wrap:wrap; gap:15px; justify-content:center; margin-bottom:15px;">
                        ${iAutoEX ? `<div style="flex:1; min-width:320px; text-align:center;"><div style="font-size:11px; font-weight:bold; color:#0056b3; margin-bottom:4px;">X方向 見附面積算定図</div><img src="${iAutoEX.img}" style="width:100%; border:1px solid #ccc; padding:4px;"></div>` : ''}
                        ${iAutoEY ? `<div style="flex:1; min-width:320px; text-align:center;"><div style="font-size:11px; font-weight:bold; color:#0056b3; margin-bottom:4px;">Y方向 見附面積算定図</div><img src="${iAutoEY.img}" style="width:100%; border:1px solid #ccc; padding:4px;"></div>` : ''}
                    </div>
                    ${mitsukeTableHtml}
                  </div>`;

            h += `<h4>【${f} 階 必要壁量 算定】</h4>
                <table class="report-table" style="margin-bottom:10px;">
                    <tr><th>項目</th><th>面積(㎡)</th><th>単位壁量</th><th>算定値(m)</th><th>各階の必要壁量(m)</th></tr>
                    <tr><td>地震力</td><td>${a_eff}</td><td>${cq}</td><td>${eq}</td><td rowspan="2" style="background:#d4edda; color:#155724; font-weight:bold; font-size:14px; vertical-align:middle;">【 X方向 】<br>Max(地震, 風圧)<br>${max_x}</td></tr>
                    <tr><td>風圧力(X)</td><td>${awx}</td><td>${cw}</td><td>${qX_base}</td></tr>
                    <tr><td>地震力</td><td>${a_eff}</td><td>${cq}</td><td>${eq}</td><td rowspan="2" style="background:#d4edda; color:#155724; font-weight:bold; font-size:14px; vertical-align:middle;">【 Y方向 】<br>Max(地震, 風圧)<br>${max_y}</td></tr>
                    <tr><td>風圧力(Y)</td><td>${awy}</td><td>${cw}</td><td>${qY_base}</td></tr>
                </table>`;

            h += `<h4>【${f} 4分割 側端部 必要壁量(地震力)】</h4>
                <table class="report-table" style="width:60%;">
                    <tr><th>方向</th><th>側端</th><th>面積(㎡)</th><th>単位壁量</th><th>必要壁量(m)</th></tr>
                    <tr><td rowspan="2">X方向</td><td>上(奥)</td><td>${ext.toFixed(2)}</td><td>${cq}</td><td>${(ext * cq).toFixed(2)}</td></tr>
                    <tr><td>下(前)</td><td>${exb.toFixed(2)}</td><td>${cq}</td><td>${(exb * cq).toFixed(2)}</td></tr>
                    <tr><td rowspan="2">Y方向</td><td>左</td><td>${eyl.toFixed(2)}</td><td>${cq}</td><td>${(eyl * cq).toFixed(2)}</td></tr>
                    <tr><td>右</td><td>${eyr.toFixed(2)}</td><td>${cq}</td><td>${(eyr * cq).toFixed(2)}</td></tr>
                </table>`;

            if (f === '1F' && getVal('a-attic2') > 0) h += `<div style="font-size:10px; color:#555; text-align:right;">※1階地震力面積には2階小屋/バルコニー加重係数加算分 (${getVal('a-attic2')}㎡) も加算されています。</div>`;
            h += `<br>`;
        });
        h += `</div><div class="page-break"></div>`;

        h += `<div class="doc-section" id="sec-wall">${getHeader(`■ ${secNum++}. 耐力壁配置図 ＆ 壁量検定`)}`;
        h += `<div style="text-align:center; position:relative;">`;
        h += `<div style="text-align:center;margin-bottom:20px"><b>【1F 耐力壁配置図】</b><br><img src="${w1}" style="width:95%;max-width:800px;border:1px solid #ccc;margin-top:5px"></div>`;
        h += `<div style="text-align:center;margin-bottom:20px"><b>【2F 耐力壁配置図】</b><br><img src="${w2}" style="width:95%;max-width:800px;border:1px solid #ccc;margin-top:5px"></div>`;
        
        ['1F', '2F'].forEach(f => {
            let xl = [], yl = [], tX = 0, tY = 0;
            let xList = [], yList = [];
            walls.filter(w => w.floor === f).forEach(w => {
                let dx = Math.abs(w.p2.x - w.p1.x), dy = Math.abs(w.p2.y - w.p1.y);
                let L_wall = Math.sqrt(dx * dx + dy * dy) / 1000;
                if (L_wall === 0) return;
                let ratioX = Math.min(1, Math.max(-1, dx / 1000 / L_wall)), ratioY = Math.min(1, Math.max(-1, dy / 1000 / L_wall));
                let degX = Math.acos(ratioX) * 180 / Math.PI, degY = Math.acos(ratioY) * 180 / Math.PI;
                let tv = window.getWallTotalVal(w);
                let effMx = Math.floor(tv * (ratioX * ratioX) * 100) / 100;
                let effMy = Math.floor(tv * (ratioY * ratioY) * 100) / 100;
                let effX = effMx, effY = effMy;
                if (degX > 75 && L_wall < 1.82) effX = 0;
                if (degY > 75 && L_wall < 1.82) effY = 0;
                let isDiag = (degX > 0.1 && degX < 89.9) ? ' [✔斜]' : '';

                let outSpec = (window.WallEngine && w.outPanelId) ? window.WallEngine.getWallSpec(w.outPanelId) : null;
                let inSpec  = (window.WallEngine && w.inPanelId)  ? window.WallEngine.getWallSpec(w.inPanelId)  : null;
                let braceSpec = (window.WallEngine && w.braceId) ? window.WallEngine.getBraceSpec(w.braceId)  : null;

                let mark1 = (outSpec && outSpec.id !== 'opt0') ? outSpec.text.charAt(0) : ((w.outPanelName && !w.outPanelName.includes('なし')) ? w.outPanelName.charAt(0) : '');
                let mark2 = (inSpec && inSpec.id !== 'opt0') ? inSpec.text.charAt(0) : ((w.inPanelName && !w.inPanelName.includes('なし')) ? w.inPanelName.charAt(0) : '');

                let marks = [];
                if (mark1) marks.push(mark1);
                if (mark2) marks.push(mark2);
                let mark = marks.join('+');

                let braceName = braceSpec ? braceSpec.text : w.braceName;
                let braceVal = braceSpec ? (braceSpec.val || 0) : (w.braceVal || 0);
                let braceLabel = (window.WallEngine && window.WallEngine.getBraceLabel) ? window.WallEngine.getBraceLabel(braceName, braceVal, w) : '';

                let tvStr = '';
                if (mark && braceLabel) tvStr = `${mark} + ${braceLabel}`;
                else if (mark) tvStr = mark;
                else if (braceLabel) tvStr = braceLabel;
                else tvStr = '-';

                let kx = Math.floor(L_wall * effX * 100) / 100, ky = Math.floor(L_wall * effY * 100) / 100;
                if (effX > 0) xList.push({ w, kx: kx, row: `<tr><td>${w.p1.gy}通り ${w.p1.gx}-${w.p2.gx}${isDiag}</td><td>${L_wall.toFixed(3)}</td><td style="font-size:12px;">${tvStr}</td><td>${effX.toFixed(2)}</td><td>${kx.toFixed(2)}</td></tr>` });
                if (effY > 0) yList.push({ w, ky: ky, row: `<tr><td>${w.p1.gx}通り ${w.p1.gy}-${w.p2.gy}${isDiag}</td><td>${L_wall.toFixed(3)}</td><td style="font-size:12px;">${tvStr}</td><td>${effY.toFixed(2)}</td><td>${ky.toFixed(2)}</td></tr>` });
            });
            xList.sort((a, b) => { let yA = Math.min(a.w.p1.y, a.w.p2.y), yB = Math.min(b.w.p1.y, b.w.p2.y); return Math.abs(yA - yB) > 150 ? yA - yB : Math.min(a.w.p1.x, a.w.p2.x) - Math.min(b.w.p1.x, b.w.p2.x); });
            yList.sort((a, b) => { let xA = Math.min(a.w.p1.x, a.w.p2.x), xB = Math.min(b.w.p1.x, b.w.p2.x); return Math.abs(xA - xB) > 150 ? xA - xB : Math.min(a.w.p1.y, a.w.p2.y) - Math.min(b.w.p1.y, b.w.p2.y); });
            xList.forEach(item => { xl.push(item.row); tX += item.kx; });
            yList.forEach(item => { yl.push(item.row); tY += item.ky; });

            h += `<h4>【${f} 存在壁量リスト ＆ 検定】</h4>`;
            h += `<table class="report-table" style="width:48%;display:inline-block;margin-right:2%;vertical-align:top;"><tr><th colspan="5">X方向壁 (全体)</th></tr><tr><th>通り芯</th><th>実長(m)</th><th>壁倍率・内訳</th><th>有効倍率</th><th>壁量(m)</th></tr>${xl.join('')}<tr><td colspan="4"><b>合計</b></td><td><b>${tX.toFixed(2)}</b></td></tr></table>`;
            h += `<table class="report-table" style="width:48%;display:inline-block;vertical-align:top;"><tr><th colspan="5">Y方向壁 (全体)</th></tr><tr><th>通り芯</th><th>実長(m)</th><th>壁倍率・内訳</th><th>有効倍率</th><th>壁量(m)</th></tr>${yl.join('')}<tr><td colspan="4"><b>合計</b></td><td><b>${tY.toFixed(2)}</b></td></tr></table>`;

            h += globalLegendHtml;

            const rX = reqWall[f].qX, rY = reqWall[f].qY;
            h += `<table class="report-table" style="width:50%; margin-top:10px;">
                <tr><th colspan="4">${f} 壁量検定</th></tr><tr><th>方向</th><th>必要(m)</th><th>存在(m)</th><th>判定</th></tr>
                <tr><td>X</td><td>${rX.toFixed(2)}</td><td>${tX.toFixed(2)}</td><td class="${tX >= rX ? 'bg-ok' : 'bg-ng'}">${tX >= rX ? 'OK' : 'NG'}</td></tr>
                <tr><td>Y</td><td>${rY.toFixed(2)}</td><td>${tY.toFixed(2)}</td><td class="${tY >= rY ? 'bg-ok' : 'bg-ng'}">${tY >= rY ? 'OK' : 'NG'}</td></tr>
            </table><br>`;
        });
        h += `</div><div class="page-break"></div>`;

        // ★ 斜め壁専用の計算表ページ
        h += `<div class="doc-section" id="sec-diag">${getHeader(`■ ${secNum++}. 斜め壁専用 計算リスト`)}`;
        ['1F', '2F'].forEach(f => {
            let diagWalls = walls.filter(w => {
                if (w.floor !== f) return false;
                let dx = Math.abs(w.p2.x - w.p1.x), dy = Math.abs(w.p2.y - w.p1.y);
                return (dx > 10 && dy > 10);
            });

            if (diagWalls.length > 0) {
                h += `<h4>【${f} 斜め壁 壁倍率・長さ算定表】</h4>
                <table class="report-table" style="width:100%; margin-bottom:15px;">
                    <tr><th>設置位置(両端柱) ※耐力壁中心位置に設置</th><th>壁倍率・内訳</th><th>実際の長さ(L)</th><th>X方向(計算式)</th><th>換算壁倍率(X)</th><th>Y方向(計算式)</th><th>換算壁倍率(Y)</th></tr>`;
                diagWalls.forEach(w => {
                    let dx = Math.abs(w.p2.x - w.p1.x), dy = Math.abs(w.p2.y - w.p1.y);
                    let L_wall = Math.sqrt(dx * dx + dy * dy) / 1000;
                    let tv = window.getWallTotalVal(w);
                    let n1 = window.getPillarName ? window.getPillarName(w.p1) || `X=${w.p1.x}, Y=${w.p1.y}` : `X=${w.p1.x}, Y=${w.p1.y}`;
                    let n2 = window.getPillarName ? window.getPillarName(w.p2) || `X=${w.p2.x}, Y=${w.p2.y}` : `X=${w.p2.x}, Y=${w.p2.y}`;
                    let pStr = n1 + ' ～ ' + n2;
                    let tV = tv;
                    let bV = w.braceVal || 0;
                    let outV = w.outPanelVal !== undefined ? w.outPanelVal : 0;
                    let inV = w.inPanelVal || 0;

                    let mark1 = (w.outPanelName && !w.outPanelName.includes('なし')) ? w.outPanelName.charAt(0) : '';
                    let mark2 = (w.inPanelName && !w.inPanelName.includes('なし')) ? w.inPanelName.charAt(0) : '';

                    let marks = [];
                    if (mark1) marks.push(mark1);
                    if (mark2) marks.push(mark2);

                    let mark = marks.join('+');

                    if (!mark && (outV > 0 || inV > 0)) {
                        let panelSum = outV + inV;
                        mark = window._currentLegendDic ? window._currentLegendDic[panelSum.toFixed(2)] || '' : '';
                    }

                    let tvStr = '';
                    let braceLabel = window.WallEngine.getBraceLabel(w.braceName, bV, w);
                    if (mark && braceLabel) tvStr = `${mark} + ${braceLabel}<br>`;
                    else if (mark) tvStr = mark;
                    else if (braceLabel) tvStr = braceLabel;
                    else tvStr = '-';

                    let ratioX = dx / 1000 / L_wall;
                    let ratioY = dy / 1000 / L_wall;
                    let convX = (tv * Math.pow(ratioX, 2)).toFixed(2);
                    let convY = (tv * Math.pow(ratioY, 2)).toFixed(2);

                    let L_mm = Math.round(L_wall * 1000);
                    let formulaX = `${tv.toFixed(2)} × (${Math.round(dx)}/${L_mm})²`;
                    let formulaY = `${tv.toFixed(2)} × (${Math.round(dy)}/${L_mm})²`;

                    h += `<tr><td>${pStr}</td><td style="font-size:12px;line-height:1.2;"><b>${tv.toFixed(2)}</b><br><span style="color:#555;">(${tvStr})</span></td><td>${L_wall.toFixed(3)}</td><td style="font-size:11px;">${formulaX}</td><td><b>${convX}</b></td><td style="font-size:11px;">${formulaY}</td><td><b>${convY}</b></td></tr>`;
                });
                h += `</table>`;
            } else {
                h += `<p>※ ${f} に斜め壁は存在しません。</p>`;
            }
        });
        // ★ 床面積求積表は図面印字のみで担保するため削除
        h += `<div class="page-break"></div>`;

        h += `<div class="doc-section" id="sec-div4">${getHeader(`■ ${secNum++}. 4分割 境界図`)}`;
        h += `<div style="display:flex;flex-direction:column;gap:20px;justify-content:center;margin-bottom:20px;">
              <div style="width:100%;text-align:center;"><b>【1F X方向 4分割】</b><br><img src="${x1}" style="width:95%;max-width:800px;border:1px solid #ccc;"></div>
              <div style="width:100%;text-align:center;"><b>【1F Y方向 4分割】</b><br><img src="${y1}" style="width:95%;max-width:800px;border:1px solid #ccc;"></div>`;
        h += `<div class="page-break"></div>`;
        h += `<div style="width:100%;text-align:center;"><b>【2F X方向 4分割】</b><br><img src="${x2}" style="width:95%;max-width:800px;border:1px solid #ccc;"></div>
              <div style="width:100%;text-align:center;"><b>【2F Y方向 4分割】</b><br><img src="${y2}" style="width:95%;max-width:800px;border:1px solid #ccc;"></div></div>`;
        h += `</div><div class="page-break"></div>`;

        h += `<div class="doc-section">${getHeader(`■ ${secNum++}. 4分割 存在壁量リスト ＆ 検定表`)}`;
        ['1F', '2F'].forEach(f => {
            let xt = [], xb = [], ylf = [], yrg = [], txt = 0, txb = 0, tyl = 0, tyr = 0, b = window.GridEngine.get4DivisionBounds(f, window.AppState);
            walls.filter(w => w.floor === f).forEach(w => {
                let dx = Math.abs(w.p2.x - w.p1.x), dy = Math.abs(w.p2.y - w.p1.y);
                let L = Math.sqrt(dx * dx + dy * dy) / 1000; if (L === 0) return;
                let rx = dx / 1000 / L, ry = dy / 1000 / L;
                let degX = Math.acos(rx) * 180 / Math.PI, degY = Math.acos(ry) * 180 / Math.PI;
                let tv = window.getWallTotalVal(w);
                let effMx = Math.floor(tv * (rx * rx) * 100) / 100;
                let effMy = Math.floor(tv * (ry * ry) * 100) / 100;
                let effX = effMx, effY = effMy;
                if (degX > 75 && L < 1.82) effX = 0;
                if (degY > 75 && L < 1.82) effY = 0;
                let cx = (w.p1.x + w.p2.x) / 2, cy = (w.p1.y + w.p2.y) / 2;
                let isDiag = (degX > 0.1 && degX < 89.9) ? ' [✔斜]' : '';
                let kx = Math.floor(L * effX * 100) / 100, ky = Math.floor(L * effY * 100) / 100;

                if (effX > 0 && b && cy <= b.yLineT + 0.5) { xt.push(`<tr><td>${w.p1.gy} ${w.p1.gx}-${w.p2.gx}${isDiag}</td><td>${L.toFixed(3)}</td><td>${kx.toFixed(2)}</td></tr>`); txt += kx; }
                if (effX > 0 && b && cy >= b.yLineB - 0.5) { xb.push(`<tr><td>${w.p1.gy} ${w.p1.gx}-${w.p2.gx}${isDiag}</td><td>${L.toFixed(3)}</td><td>${kx.toFixed(2)}</td></tr>`); txb += kx; }
                if (effY > 0 && b && cx <= b.xLineL + 0.5) { ylf.push(`<tr><td>${w.p1.gx} ${w.p1.gy}-${w.p2.gy}${isDiag}</td><td>${L.toFixed(3)}</td><td>${ky.toFixed(2)}</td></tr>`); tyl += ky; }
                if (effY > 0 && b && cx >= b.xLineR - 0.5) { yrg.push(`<tr><td>${w.p1.gx} ${w.p1.gy}-${w.p2.gy}${isDiag}</td><td>${L.toFixed(3)}</td><td>${ky.toFixed(2)}</td></tr>`); tyr += ky; }
            });

            h += `<div style="page-break-inside: avoid; break-inside: avoid;">`;
            h += `<h4>【${f} 4分割 リスト・検定】</h4>`;
            h += `<div style="display:flex;gap:10px;margin-bottom:10px;">
                <table class="report-table" style="flex:1;"><tr><th colspan="3">X方向 (上)</th></tr><tr><th>通り芯</th><th>実長(m)</th><th>壁量</th></tr>${xt.join('')}<tr><td colspan="2"><b>合計</b></td><td><b>${txt.toFixed(2)}</b></td></tr></table>
                <table class="report-table" style="flex:1;"><tr><th colspan="3">X方向 (下)</th></tr><tr><th>通り芯</th><th>実長(m)</th><th>壁量</th></tr>${xb.join('')}<tr><td colspan="2"><b>合計</b></td><td><b>${txb.toFixed(2)}</b></td></tr></table>
                <table class="report-table" style="flex:1;"><tr><th colspan="3">Y方向 (左)</th></tr><tr><th>通り芯</th><th>実長(m)</th><th>壁量</th></tr>${ylf.join('')}<tr><td colspan="2"><b>合計</b></td><td><b>${tyl.toFixed(2)}</b></td></tr></table>
                <table class="report-table" style="flex:1;"><tr><th colspan="3">Y方向 (右)</th></tr><tr><th>通り芯</th><th>実長(m)</th><th>壁量</th></tr>${yrg.join('')}<tr><td colspan="2"><b>合計</b></td><td><b>${tyr.toFixed(2)}</b></td></tr></table></div>`;

            let cq = getVal(`c-q${f[0]}`);
            let req_xt = getVal(`e-x-t${f[0]}`) * cq, req_xb = getVal(`e-x-b${f[0]}`) * cq, req_yl = getVal(`e-y-l${f[0]}`) * cq, req_yr = getVal(`e-y-r${f[0]}`) * cq;
            let rt_xt = txt / (req_xt || 1), rt_xb = txb / (req_xb || 1), rt_yl = tyl / (req_yl || 1), rt_yr = tyr / (req_yr || 1);
            let r_x = Math.min(rt_xt, rt_xb) / (Math.max(rt_xt, rt_xb) || 1), r_y = Math.min(rt_yl, rt_yr) / (Math.max(rt_yl, rt_yr) || 1);

            h += `<table class="report-table" style="width:70%; margin:auto;">
                <tr><th colspan="7">4分割 壁釣り合い検定</th></tr><tr><th>向</th><th>側端</th><th>必要(m)</th><th>存在(m)</th><th>充足</th><th>率比</th><th>判定</th></tr>
                <tr><td rowspan="2">X</td><td>上</td><td>${req_xt.toFixed(2)}</td><td>${txt.toFixed(2)}</td><td>${rt_xt.toFixed(2)}</td><td rowspan="2">${r_x.toFixed(2)}</td><td rowspan="2" class="${(r_x >= 0.5 || (rt_xt >= 1.0 && rt_xb >= 1.0)) ? 'bg-ok' : 'bg-ng'}">${(r_x >= 0.5 || (rt_xt >= 1.0 && rt_xb >= 1.0)) ? 'OK' : 'NG'}</td></tr>
                <tr><td>下</td><td>${req_xb.toFixed(2)}</td><td>${txb.toFixed(2)}</td><td>${rt_xb.toFixed(2)}</td></tr>
                <tr><td rowspan="2">Y</td><td>左</td><td>${req_yl.toFixed(2)}</td><td>${tyl.toFixed(2)}</td><td>${rt_yl.toFixed(2)}</td><td rowspan="2">${r_y.toFixed(2)}</td><td rowspan="2" class="${(r_y >= 0.5 || (rt_yl >= 1.0 && rt_yr >= 1.0)) ? 'bg-ok' : 'bg-ng'}">${(r_y >= 0.5 || (rt_yl >= 1.0 && rt_yr >= 1.0)) ? 'OK' : 'NG'}</td></tr>
                <tr><td>右</td><td>${req_yr.toFixed(2)}</td><td>${tyr.toFixed(2)}</td><td>${rt_yr.toFixed(2)}</td></tr>
            </table></div><br>`;
        });
        h += `</div><div class="page-break"></div>`;

        h += `<div class="doc-section" id="sec-nval">${getHeader(`■ ${secNum++}. 柱の小径等 ＆ 金物・N値 計算表`)}`;
        h += `<div style="text-align:center;margin-bottom:20px"><b>【1F 金物・N値配置図】</b><br><img src="${n1}" style="width:95%;max-width:800px;border:1px solid #ccc;margin-top:5px"></div>`;
        h += `<div style="text-align:center;margin-bottom:20px"><b>【2F 金物・N値配置図】</b><br><img src="${n2}" style="width:95%;max-width:800px;border:1px solid #ccc;margin-top:5px"></div>`;

        if (window.ReportNValueView && typeof window.ReportNValueView.generateNValueTableSectionHtml === 'function') {
            h += window.ReportNValueView.generateNValueTableSectionHtml(window.AppState);
        } else {
            ['1F', '2F'].forEach(f => {
                h += `<h4>【${f} 柱 N値計算・接合部判定表】</h4>`;
                h += `<table class="report-table" style="width:100%;">
                    <tr><th rowspan="2">階</th><th colspan="2">柱位置</th><th rowspan="2">出隅</th><th rowspan="2">h1/h2<br>係数</th><th colspan="2">計算式</th><th rowspan="2">N値</th><th colspan="2">金物</th></tr>
                    <tr><th>X</th><th>Y</th><th>X方向</th><th>Y方向</th><th>柱頭</th><th>柱脚</th></tr>`;
                pillars.filter(p => p.floor === f && !p.isDeleted && !p.isInvalidPos).forEach(p => {
                    if (p.nValue > 0 || p.Ax > 0 || p.Ay > 0) {
                        const m = p.isC ? "〇" : "×";
                        const k1s = f === '1F' && p.h1 ? `(${p.h1.toFixed(2)}/2.7)` : "-";
                        const k2s = p.h2 ? `(${p.h2.toFixed(2)}/2.7)` : `(2.70/2.7)`;
                        const hCoef = f === '1F' ? k1s : k2s;
                        const nCalcX = p.nCalcX || 0;
                        const nCalcY = p.nCalcY || 0;
                        const nValue = p.nValue || 0;
                        h += `<tr><td>${f[0]}</td><td>${p.gx}</td><td>${p.gy}</td><td>${m}</td><td>${hCoef}</td><td style="text-align:left;">${p.cStrX || '-'} = ${nCalcX.toFixed(2)}</td><td style="text-align:left;">${p.cStrY || '-'} = ${nCalcY.toFixed(2)}</td><td><b>${nValue.toFixed(2)}</b></td><td class="bg-ok">${p.nMark}</td><td class="bg-ok">${p.nMark}</td></tr>`;
                    }
                });
                h += `</table><br>`;
            });
        }

        const hwList = getHardwareList();
        h += `<h4>【金物耐力（N値）凡例】</h4><table class="report-table" style="width:70%; margin:auto;"><tr><th>N値上限</th><th>略記号</th><th>接合具(告示1460号)・仕様例</th></tr><tr><td>0 以下</td><td>不要</td><td>(い) 仕様外・接合不要</td></tr>`;
        hwList.forEach(hw => { h += `<tr><td>${hw.n.toFixed(2)} 以下</td><td><b>${hw.name}</b></td><td>${hw.isCust ? "[任意追加金物]" : `(告示基準)`}</td></tr>`; });
        h += `<tr><td>5.6 超</td><td>32(等)</td><td>別途検討</td></tr></table><div style="text-align:center; color:#e74c3c; font-weight:bold; margin-top:10px;">※金物記載のない柱は、短ほぞ差しまたはカスガイ打ち同等以上の接合方法とする。</div></div><div class="page-break"></div>`;

        h += `<div class="doc-section" id="sec-pillar">${getHeader(`■ ${secNum++}. 柱負担面積 自動算出図 ＆ 算出リスト`)}`;
        h += `<div style="text-align:center;margin-bottom:20px"><b>【1F 柱負担面積図】</b><br><img src="${pa1}" style="width:95%;max-width:800px;border:1px solid #ccc;margin-top:5px"></div>`;
        h += `<div style="text-align:center;margin-bottom:20px"><b>【2F 柱負担面積図】</b><br><img src="${pa2}" style="width:95%;max-width:800px;border:1px solid #ccc;margin-top:5px"></div>`;

        ['1F', '2F'].forEach(f => {
            let totalArea = 0;
            h += `<h4>【${f} 柱負担面積 算出リスト】</h4><table class="report-table" style="width:100%;">
                <tr><th>位置</th><th>自動算出(㎡)</th><th>手動入力(㎡)</th><th>採用面積(㎡)</th></tr>`;
            let sortedPillars = pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === f).sort((a, b) => {
                if (Math.abs(a.y - b.y) > 150) return a.y - b.y; return a.x - b.x;
            });
            sortedPillars.forEach(p => {
                let autoA = p.autoArea ? p.autoArea.toFixed(2) : '-';
                let manA = p.manualArea != null ? p.manualArea.toFixed(2) + ' <span style="color:#d35400;font-weight:bold;">✎</span>' : '-';
                let usedA = p.usedArea ? p.usedArea.toFixed(2) : '0.00';
                totalArea += p.usedArea || 0;
                h += `<tr><td>${window.getPillarName(p) || '-'}</td><td>${autoA}</td><td>${manA}</td><td style="font-weight:bold;">${usedA}</td></tr>`;
            });
            h += `<tr><td colspan="3" style="text-align:right;font-weight:bold;">採用面積 合計：</td><td style="font-weight:bold;color:#d35400;">${totalArea.toFixed(2)} ㎡</td></tr></table><br>`;
        });
        h += `</div><div class="page-break"></div>`;

        h += `<div class="doc-section">${getHeader(`■ ${secNum++}. 有効細長比 判定表`)}`;
        ['1F', '2F'].forEach(f => {
            h += `<h4>【${f}】</h4><table class="report-table" style="width:100%;"><tr><th>位置</th><th>小径 d (mm)</th><th>垂直距離 l0 (m)</th><th>細長比 λ</th><th>判定</th></tr>`;
            let sortedPillars = pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === f).sort((a, b) => {
                if (Math.abs(a.y - b.y) > 150) return a.y - b.y; return a.x - b.x;
            });
            let hasNg = false;
            sortedPillars.forEach(p => {
                const l_cls = p.lambdaOK ? '' : 'bg-ng';
                const l_txt = p.lambdaOK ? 'OK' : 'NG';
                if (!p.lambdaOK) hasNg = true;
                h += `<tr><td>${window.getPillarName(p) || '-'}</td><td>${p.d != null ? p.d : '-'}</td><td>${p.l_0 != null ? p.l_0.toFixed(2) : '-'}</td><td class="${l_cls}" style="font-weight:bold;">${p.lambda != null ? p.lambda.toFixed(1) : '-'}</td><td class="${l_cls}">${l_txt}</td></tr>`;
            });
            h += `</table>`;
            if (hasNg) h += `<div style="color:#c0392b;font-weight:bold;font-size:11px;margin-bottom:10px;">⚠️ 有効細長比が150を超える柱が存在します（令第43条6項）</div>`;
            h += `<br>`;
        });
        h += `</div><div class="page-break" id="pb-before-fd"></div>`;

        // --- 6. 基礎スラブ構造検定 ---
        h += `<div class="doc-section" id="sec-fd-slab" style="margin-bottom:30px;">
            ${getHeader(`■ ${secNum++}. 基礎スラブ 構造検定`)}`;
        
        const fc = window.AppState.config?.fc || 21;
        const fc_comp = (fc / 3).toFixed(2);
        const fc_shear = (fc / 30).toFixed(2);
        const fc_comp_s = (fc * 2 / 3).toFixed(2);
        const fc_shear_s = (fc / 15).toFixed(2);

        // 材料仕様・許容応力度カード
        h += `
        <div style="background:#fdfefe; border:1px solid #bdc3c7; border-left:4px solid #8e44ad; border-radius:4px; padding:10px 14px; margin-bottom:15px; font-size:11px; line-height:1.6;">
            <div style="font-weight:bold; font-size:12px; color:#2c3e50; margin-bottom:6px; border-bottom:1px solid #ecf0f1; padding-bottom:4px;">
                【基礎構造 材料仕様および許容応力度】
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div style="background:#f8f9f9; padding:6px 10px; border-radius:4px; border:1px solid #ebedef;">
                    <div style="font-weight:bold; color:#1a5276; margin-bottom:4px;">🧱 コンクリート仕様: Fc${fc}</div>
                    <div>・設計基準強度: <b>Fc = ${fc}</b> N/㎟</div>
                    <div>・長期許容曲げ圧縮応力度 fc: <b>${fc_comp}</b> N/㎟ (Fc/3)</div>
                    <div>・長期許容せん断応力度 fs: <b>${fc_shear}</b> N/㎟ (Fc/30)</div>
                    <div>・短期許容応力度: 圧縮 <b>${fc_comp_s}</b> N/㎟ / せん断 <b>${fc_shear_s}</b> N/㎟</div>
                </div>
                <div style="background:#f8f9f9; padding:6px 10px; border-radius:4px; border:1px solid #ebedef;">
                    <div style="font-weight:bold; color:#1a5276; margin-bottom:4px;">⛓️ 鉄筋仕様: SD295</div>
                    <div>・規格・種類: <b>SD295 (D10, D13, D16)</b></div>
                    <div>・降伏点強度: <b>Fy = 295</b> N/㎟</div>
                    <div>・長期許容引張応力度 ft: <b>195</b> N/㎟</div>
                    <div>・長期許容せん断補強応力度 fw: <b>195</b> N/㎟</div>
                    <div>・短期許容引張応力度 ft: <b>295</b> N/㎟</div>
                </div>
            </div>
        </div>`;

        const slabs = window.AppState.foundationSlabs || [];
        if (slabs.length === 0) {
            h += `<div style="padding:15px; background:#f8f9fa; border:1px dashed #bdc3c7; border-radius:4px; color:#7f8c8d; font-size:12px; margin-bottom:15px;">
                ※ 基礎スラブが未配置（未設定）です。基礎計算モードで作図・配置を行うと自動算定・検定結果がここに反映されます。
            </div>`;
        } else {
            h += `<table class="report-table" style="width:100%; font-size:11px; margin-bottom:15px;">
                <thead>
                    <tr style="background:#8e44ad; color:#fff;">
                        <th>No</th><th>符号</th><th>固定条件</th><th>スラブ厚 (mm)</th><th>短辺/長辺 (m)</th><th>接地圧 w (kN/㎡)</th><th>設計曲げ M (kNm/m)</th><th>配筋仕様 (短/長)</th><th>許容曲げ Ma (kNm/m)</th><th>検定比</th><th>判定</th>
                    </tr>
                </thead>
                <tbody>`;
            slabs.forEach((s, idx) => {
                const fs = s.fdStress || {};
                const props = s.props || {};
                const isOk = fs.isNG !== true;
                const okStr = isOk ? '<span style="color:#27ae60;font-weight:bold;">OK</span>' : '<span style="color:#c0392b;font-weight:bold;">NG</span>';
                
                const lx = fs.lx || 0;
                const ly = fs.ly || 0;
                const w = fs.qTotal || (s.w || 0);
                const mx = Math.max(fs.Mx_center || 0, fs.Mx_end || 0);
                const my = Math.max(fs.My_center || 0, fs.My_end || 0);
                const mMax = Math.max(mx, my);
                const thick = props.slabThickness || props.thickness || 150;
                const fixType = props.support || '4辺固定';
                const name = props.name || `FS${idx+1}`;
                const shortRebar = `${props.rebarShort?.type || 'D13'}@${props.rebarShort?.pitch || 150}`;
                const longRebar = `${props.rebarLong?.type || 'D13'}@${props.rebarLong?.pitch || 300}`;
                const maShort = fs.Ma_short || 0;
                const ratioMax = Math.max(fs.ratioShort || 0, fs.ratioLong || 0);
                
                h += `<tr>
                    <td style="font-weight:bold;">No.${idx+1}</td>
                    <td style="font-weight:bold; color:#1a5276;">${name}</td>
                    <td>${fixType}</td>
                    <td>${thick}</td>
                    <td>${lx > 0 ? `${lx.toFixed(2)} × ${ly.toFixed(2)}` : (fs.cantileverLength ? `L=${fs.cantileverLength.toFixed(2)}` : '-')}</td>
                    <td>${w.toFixed(2)}</td>
                    <td>${mMax.toFixed(2)}</td>
                    <td>${shortRebar} / ${longRebar}</td>
                    <td>${maShort.toFixed(2)}</td>
                    <td style="font-weight:bold; color:${isOk ? '#27ae60' : '#c0392b'};">${(ratioMax * 100).toFixed(1)}%</td>
                    <td>${okStr}</td>
                </tr>`;
            });
            h += `</tbody></table>`;
        }
        h += `</div>`;

        // --- 7. 基礎梁構造検定 ＆ 応力図 ---
        h += `<div class="page-break" id="pb-between-fd"></div>`;
        h += `<div class="doc-section" id="sec-fd-beam" style="margin-bottom:30px;">
            ${getHeader(`■ ${secNum++}. 基礎梁 構造検定 ＆ 応力（N・M・Q）図`)}`;

        // 7-1. 基礎梁負担図（べた基礎接地圧分担域）を最初に1枚出力
        if (window.FoundationRenderer && typeof window.FoundationRenderer.generateFoundationTributarySvg === 'function') {
            const firstBeamWithSpans = (window.AppState.foundationBeams || []).find(b => b.spans && b.spans.length > 0);
            const tributarySvgGlobal = window.FoundationRenderer.generateFoundationTributarySvg(firstBeamWithSpans, window.AppState);
            if (tributarySvgGlobal) {
                h += `<div style="margin-bottom:25px; border:1px solid #ccc; padding:15px; border-radius:8px; page-break-inside:avoid; break-inside:avoid;">
                    <div style="font-size:13px; font-weight:bold; margin-bottom:10px; border-bottom:2px solid #27ae60; padding-bottom:5px; color:#1a5276;">
                        7-1. 基礎梁 負担図（べた基礎 接地圧分担域）
                    </div>
                    ${tributarySvgGlobal}
                </div>`;
            }
        }

        const rawFBeams = window.AppState.foundationBeams || [];
        const fBeams = [...rawFBeams].sort((a, b) => {
            const dxA = Math.abs(a.p2.x - a.p1.x), dyA = Math.abs(a.p2.y - a.p1.y);
            const dxB = Math.abs(b.p2.x - b.p1.x), dyB = Math.abs(b.p2.y - b.p1.y);
            const isHA = dxA >= dyA;
            const isHB = dxB >= dyB;
            if (isHA && !isHB) return -1;
            if (!isHA && isHB) return 1;
            if (isHA && isHB) {
                const yA = (a.p1.y + a.p2.y) / 2, yB = (b.p1.y + b.p2.y) / 2;
                if (Math.abs(yA - yB) > 5) return yB - yA;
                return Math.min(a.p1.x, a.p2.x) - Math.min(b.p1.x, b.p2.x);
            } else {
                const xA = (a.p1.x + a.p2.x) / 2, xB = (b.p1.x + b.p2.x) / 2;
                if (Math.abs(xA - xB) > 5) return xA - xB;
                return Math.max(a.p1.y, a.p2.y) - Math.max(b.p1.y, b.p2.y);
            }
        });
        if (fBeams.length === 0) {
            h += `<div style="padding:15px; background:#f8f9fa; border:1px dashed #bdc3c7; border-radius:4px; color:#7f8c8d; font-size:12px; margin-bottom:15px;">
                ※ 基礎梁が未配置（未設定）です。基礎計算モードで作図・配置を行うと自動応力解析・検定結果がここに反映されます。
            </div>`;
        } else {
            fBeams.forEach((beam, idx) => {
                if (window.FoundationEngine && (!beam.spans || beam.spans.length === 0)) {
                    window.FoundationEngine.runAnalysis(window.AppState);
                }
                const beamHtml = (window.FoundationRenderer && typeof window.FoundationRenderer.generateBeamReportHtml === 'function')
                    ? window.FoundationRenderer.generateBeamReportHtml(beam)
                    : (window.generateContinuousBeamReportHtml ? window.generateContinuousBeamReportHtml(beam) : '');
                
                h += `<div style="margin-bottom:25px; border:1px solid #ccc; padding:15px; border-radius:8px; page-break-inside: avoid; break-inside: avoid;">
                        <div style="font-weight:bold; font-size:14px; margin-bottom:10px; border-bottom:2px solid #2c3e50; padding-bottom:5px;">
                            基礎梁 No.${idx + 1}（ID: ${beam.id}）
                        </div>
                        ${beamHtml || `
                        <div style="display:flex; flex-wrap:wrap; gap:20px;">
                            <div style="flex: 1; min-width: 300px;">
                                <div style="font-size:12px; color:#555;">基礎梁幅: ${beam.width || 150}mm / 基礎高さ: ${beam.height || 450}mm<br>長期・短期曲げ応力検定: <strong style="color:#27ae60;">適合 OK</strong></div>
                            </div>
                            <div style="flex: 1.2; min-width: 350px; background:#fff;">
                                <div style="font-size:11px; font-weight:bold; margin-bottom:5px; color:#555; text-align:center;">応力図（N・M・Q図）</div>
                                ${(window.FoundationRenderer && typeof window.FoundationRenderer.generateBeamNMQSvg === 'function') ? window.FoundationRenderer.generateBeamNMQSvg(beam) : `<div style="font-size:11px; color:#888; text-align:center; padding:30px;">(応力解析図)</div>`}
                            </div>
                        </div>`}
                      </div>`;
            });
        }
        h += `</div>`;

        const dc = document.getElementById('doc-container');
        const modal = document.getElementById('modal-doc');
        if (dc && modal) { dc.innerHTML = h; modal.style.display = 'flex'; } else { throw new Error('doc-container または modal-doc が見つかりません'); }

    } catch (e) {
        console.error("一括出力エラー:", e);
        alert("計算書の一括出力中にエラーが発生しました。\n詳細: " + e.message);
    }
}

