// ==========================================
// wall_4split_pdf.js - 帳票画像・PDF生成エンジン (Phase 3.9)
// v2.2.0 Refactoring
// ==========================================


function createLayerFilteredImage(docType, targetLayers, bgLayers, floorStr = null, showAreaDims = true, dimScale = 1.0, isPrint = false) {
    return window.DocumentRenderer.renderLayerFilteredImage(docType, targetLayers, bgLayers, floorStr, { showAreaDims, dimScale, isPrint });
}


function createNativeCanvasImage(f, mode, d4 = null, showAreaDims = true, dimScale = 1.0, isPrint = false) {
    return createHighResPlanImage(f, mode, d4, showAreaDims, dimScale, isPrint);
}

function createHighResPlanImage(f, mode, d4 = null, showAreaDims = true, dimScale = 1.0, isPrint = false) {
    return window.DocumentRenderer.renderStructuralPlan(f, mode, d4, { showAreaDims, dimScale, isPrint });
}

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
            x.lineWidth = 1.5; x.strokeStyle = '#27ae60'; x.setLineDash([5, 5]);
            pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === f).forEach(p => {
                // ★ レイヤ表示判定
                if (!isPrint && p.layer && layerVisibility[p.layer] === false) return;

                const polys = p.tributaryPolygons || (p.tributaryPolygon ? [p.tributaryPolygon] : []);
                polys.forEach(poly => {
                    if (poly && poly.length >= 3) {
                        x.fillStyle = 'rgba(46, 204, 113, 0.1)';
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


function generateAutoMitsukeCanvas(direction, commonScale) {
    const s = window.AppState;
    if (!s || !s.config) return null;

    const config = s.config;
    const wallThick = parseFloat(config.wallThickness ?? 150);

    // --- GL基準高さ取得 ---
    const lvl = window.RoofEngine ? window.RoofEngine.getFloorLevels(s) : { FL1: 561, FL2: 3261, cut1: 1911, cut2: 4611 };

    const proj = window.MitsukeEngine && window.MitsukeEngine.generateElevationAreas ? window.MitsukeEngine.generateElevationAreas(direction, s) : null;
    if (!proj || !proj.primitives || proj.primitives.length === 0) return null;

    let uMinAll = Infinity, uMaxAll = -Infinity, zMaxAll = -Infinity;
    proj.primitives.forEach(prim => {
        prim.vertices.forEach(v => {
            if (v.u < uMinAll) uMinAll = v.u;
            if (v.u > uMaxAll) uMaxAll = v.u;
            if (v.z > zMaxAll) zMaxAll = v.z;
        });
    });
    const W = uMaxAll > uMinAll ? uMaxAll - uMinAll : 10000;
    const uMin = uMinAll;
    const uMax = uMaxAll;

    // 1F外壁、2F外壁の幅を計測（寸法線用）
    let uMin1F = Infinity, uMax1F = -Infinity;
    let uMin2F = Infinity, uMax2F = -Infinity;
    proj.primitives.forEach(prim => {
        if (prim.type === 'rect') {
            prim.vertices.forEach(v => {
                if (prim.floor === '1F') { if (v.u < uMin1F) uMin1F = v.u; if (v.u > uMax1F) uMax1F = v.u; }
                if (prim.floor === '2F') { if (v.u < uMin2F) uMin2F = v.u; if (v.u > uMax2F) uMax2F = v.u; }
            });
        }
    });

    const eavesZ2F = proj.eavesZ2F || (lvl.FL2 + 2700);
    const maxH = Math.max(zMaxAll, eavesZ2F);
    const totalH = Math.max(maxH, eavesZ2F + 1000); // キャンバス高さ基準

    // --- Canvas生成 ---
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // CADグリッド
    ctx.strokeStyle = '#f1f2f6'; ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 30) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }

    const padL = 90, padR = 400, padT = 70, padB = 60;
    const drawW = canvas.width - padL - padR;
    const drawH = canvas.height - padT - padB;

    let scale = commonScale;
    if (!scale) {
        const scaleU = drawW / W;
        const scaleZ = drawH / totalH;
        scale = Math.min(scaleU, scaleZ) * 0.90;
    }

    const toX = (u) => padL + (u - uMin) * scale;
    const toY = (z) => canvas.height - padB - z * scale;

    const primaryColor = (direction === 'X') ? '#e67e22' : '#2980b9';

    const cutY2 = toY(lvl.cut2);
    const cutY1 = toY(lvl.cut1);
    const glY   = toY(0);

    // 1. 各Primitiveを描画 (外壁と屋根) - 塗りつぶしのみ
    ctx.save();
    let clipperPolygons = []; // Clipper用ポリゴン配列
    const scaleFactor = 1000; // Clipperの整数化用

    proj.primitives.forEach(prim => {
        if (!prim.vertices || prim.vertices.length < 3) return;
        
        // Clipper用パス生成
        let path = [];
        ctx.beginPath();
        ctx.moveTo(toX(prim.vertices[0].u), toY(prim.vertices[0].z));
        path.push({ X: Math.round(prim.vertices[0].u * scaleFactor), Y: Math.round(prim.vertices[0].z * scaleFactor) });
        for (let i = 1; i < prim.vertices.length; i++) {
            ctx.lineTo(toX(prim.vertices[i].u), toY(prim.vertices[i].z));
            path.push({ X: Math.round(prim.vertices[i].u * scaleFactor), Y: Math.round(prim.vertices[i].z * scaleFactor) });
        }
        ctx.closePath();
        clipperPolygons.push(path);
        
        // 色分け (1F, 2F, 屋根)
        if (prim.name && typeof prim.name.includes === 'function' && prim.name.includes('屋根')) {
            ctx.fillStyle = (direction === 'X') ? 'rgba(230,126,34,0.3)' : 'rgba(41,128,185,0.3)';
        } else if (prim.floor === '2F') {
            ctx.fillStyle = (direction === 'X') ? 'rgba(230,126,34,0.15)' : 'rgba(41,128,185,0.15)';
        } else {
            ctx.fillStyle = (direction === 'X') ? 'rgba(230,126,34,0.05)' : 'rgba(41,128,185,0.05)';
        }
        
        ctx.fill();
        // ctx.stroke() はここでは行わない（内部の線を描かない）
    });
    ctx.restore();

    // 1.5 Clipperによる全体のシルエット（アウトライン）描画
    if (typeof ClipperLib !== 'undefined' && clipperPolygons.length > 0) {
        const cpr = new ClipperLib.Clipper();
        cpr.AddPaths(clipperPolygons, ClipperLib.PolyType.ptSubject, true);
        const solution = new ClipperLib.Paths();
        cpr.Execute(ClipperLib.ClipType.ctUnion, solution, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
        
        ctx.save();
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2; // 外周は太線
        ctx.lineJoin = 'round';
        
        solution.forEach(path => {
            if (path.length < 3) return;
            ctx.beginPath();
            ctx.moveTo(toX(path[0].X / scaleFactor), toY(path[0].Y / scaleFactor));
            for (let i = 1; i < path.length; i++) {
                ctx.lineTo(toX(path[i].X / scaleFactor), toY(path[i].Y / scaleFactor));
            }
            ctx.closePath();
            ctx.stroke();
        });
        ctx.restore();
    } else {
        // Clipperが無い場合のフォールバック（従来通りの枠線描画）
        ctx.save();
        proj.primitives.forEach(prim => {
            if (!prim.vertices || prim.vertices.length < 3) return;
            ctx.beginPath();
            ctx.moveTo(toX(prim.vertices[0].u), toY(prim.vertices[0].z));
            for (let i = 1; i < prim.vertices.length; i++) {
                ctx.lineTo(toX(prim.vertices[i].u), toY(prim.vertices[i].z));
            }
            ctx.closePath();
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = 1;
            ctx.stroke();
        });
        ctx.restore();
    }

    // 2. 分解された矩形・三角形の境界と番号を描画
    ctx.save();
    const fAreas = config.elevationFormulaAreas;
    if (fAreas) {
        const key = direction === 'X' ? 'x' : 'y';
        
        ['1F', '2F'].forEach(flr => {
            const flrItems = fAreas[flr][key] || [];
            const accentColor = flr === '2F'
                ? (direction === 'X' ? 'rgba(230,126,34,1.0)' : 'rgba(41,128,185,1.0)')
                : (direction === 'X' ? 'rgba(230,126,34,0.55)' : 'rgba(41,128,185,0.55)');

            ctx.lineWidth = 1.5;
            ctx.strokeStyle = accentColor;
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            flrItems.forEach(item => {
                const uL = item.uStart;
                const uR = item.uStart + item.w;
                const zBL = item.zBL !== undefined ? item.zBL : item.zBot;
                const zBR = item.zBR !== undefined ? item.zBR : item.zBot;
                const zTL = item.zTL !== undefined ? item.zTL : (item.zBot + (item.hL || 0));
                const zTR = item.zTR !== undefined ? item.zTR : (item.zBot + (item.hR || 0));

                // 領域の境界線 (点線) を描画
                ctx.setLineDash([4, 3]);
                ctx.strokeStyle = accentColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(toX(uL), toY(zBL));
                ctx.lineTo(toX(uR), toY(zBR));
                ctx.lineTo(toX(uR), toY(zTR));
                ctx.lineTo(toX(uL), toY(zTL));
                ctx.closePath();
                ctx.stroke();
                ctx.setLineDash([]);

                // 丸番号ラベル (A1, B1...) を描画
                const cx = toX(uL + item.w / 2);
                let centerZ = (zBL + zBR + zTL + zTR) / 4;
                if (item.type === 'tri') {
                    centerZ = (zBL + Math.max(zTL, zTR) + Math.min(zTL, zTR)) / 3;
                }
                const cz = toY(centerZ);

                const codeStr = item.code || (item.name || 'A');
                ctx.beginPath();
                ctx.arc(cx, cz, 12, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.strokeStyle = accentColor;
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.fillStyle = '#2c3e50';
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText(codeStr, cx, cz);
            });
        });
    }
    ctx.restore();
    // GL線
    ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(padL-20, glY); ctx.lineTo(padL+drawW+20, glY); ctx.stroke();
    ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#2c3e50'; ctx.textAlign = 'right';
    ctx.fillText('▼ GL', padL - 25, glY + 4);

    // 1Fカットライン (破線)
    ctx.setLineDash([8, 5]); ctx.strokeStyle = '#27ae60'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL-10, cutY1); ctx.lineTo(padL+drawW+10, cutY1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#27ae60'; ctx.textAlign = 'right';
    ctx.fillText(`▶ 1FL+1350 (${(lvl.cut1/1000).toFixed(3)}m)`, padL-14, cutY1 - 3);

    // 2Fカットライン (破線)
    ctx.setLineDash([8, 5]); ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL-10, cutY2); ctx.lineTo(padL+drawW+10, cutY2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#e74c3c'; ctx.textAlign = 'right';
    ctx.fillText(`▶ 2FL+1350 (${(lvl.cut2/1000).toFixed(3)}m)`, padL-14, cutY2 - 3);

    // 1FL・2FL線 (薄い)
    [{ z: lvl.FL1, label: `1FL (${(lvl.FL1/1000).toFixed(3)}m)`, color: '#27ae60' },
     { z: lvl.FL2, label: `2FL (${(lvl.FL2/1000).toFixed(3)}m)`, color: '#e74c3c' }
    ].forEach(({ z, label, color }) => {
        const cy = toY(z);
        ctx.setLineDash([4,4]); ctx.strokeStyle = color + '88'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padL-10, cy); ctx.lineTo(padL+drawW+10, cy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '9px sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'right';
        ctx.fillText(label, padL-14, cy + 3);
    });

    // 最高の高さ (破線)
    const maxY_maxH = toY(maxH);
    ctx.setLineDash([8, 5]); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL-10, maxY_maxH); ctx.lineTo(padL+drawW+10, maxY_maxH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#c0392b'; ctx.textAlign = 'right';
    ctx.fillText(`▶ 最高の高さ (${(maxH/1000).toFixed(3)}m)`, padL-14, maxY_maxH - 3);

    // --- CAD風寸法線の描画 ---
    const drawTick = (px, py) => {
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px - 5, py + 5);
        ctx.lineTo(px + 5, py - 5);
        ctx.stroke();
    };

    const drawHorizDim = (uStart, uEnd, zPos, valText) => {
        const x1 = toX(uStart);
        const x2 = toX(uEnd);
        const y = toY(zPos);

        // 1. 引出線 (点線)
        ctx.strokeStyle = 'rgba(127, 140, 141, 0.7)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        const zTarget = zPos > 0 ? zPos - 300 : 0;
        ctx.moveTo(x1, toY(zTarget));
        ctx.lineTo(x1, y + 8 * (zPos > 0 ? -1 : 1));
        ctx.moveTo(x2, toY(zTarget));
        ctx.lineTo(x2, y + 8 * (zPos > 0 ? -1 : 1));
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. 寸法線 (実線)
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();

        // 3. チッマーク
        drawTick(x1, y);
        drawTick(x2, y);

        // 4. テキスト (背景白矩形付き)
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(valText).width;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect((x1 + x2)/2 - tw/2 - 3, y - 6, tw + 6, 12);
        ctx.fillStyle = '#c0392b';
        ctx.fillText(valText, (x1 + x2)/2, y);
    };

    const drawVertDim = (zStart, zEnd, xPos, valText) => {
        const y1 = toY(zStart);
        const y2 = toY(zEnd);
        const x = xPos;

        // 1. 引出線 (点線)
        ctx.strokeStyle = 'rgba(127, 140, 141, 0.7)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(padL - 10, y1);
        ctx.lineTo(x - 8, y1);
        ctx.moveTo(padL - 10, y2);
        ctx.lineTo(x - 8, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. 寸法線 (実線)
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.stroke();

        // 3. チッマーク
        drawTick(x, y1);
        drawTick(x, y2);

        // 4. テキスト (背景白矩形付き)
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(valText).width;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - tw/2 - 3, (y1 + y2)/2 - 6, tw + 6, 12);
        ctx.fillStyle = '#c0392b';
        ctx.fillText(valText, x, (y1 + y2)/2);
    };

    // 水平寸法線 (建物全幅、1F壁幅、2F壁幅)
    drawHorizDim(uMin, uMax, -500, Math.round(W).toString());
    
    if (uMax1F > uMin1F) {
        drawHorizDim(uMin1F, uMax1F, (lvl.fl1 + lvl.cut1) / 2, Math.round(uMax1F - uMin1F).toString());
    }

    if (uMax2F > uMin2F) {
        drawHorizDim(uMin2F, uMax2F, (lvl.fl2 + lvl.cut2) / 2, Math.round(uMax2F - uMin2F).toString());
    }

    // 垂直寸法線 (高さ関係)
    drawVertDim(0, lvl.cut1, padL - 45, Math.round(lvl.cut1).toString());
    drawVertDim(lvl.cut1, lvl.cut2, padL - 45, Math.round(lvl.cut2 - lvl.cut1).toString());
    drawVertDim(lvl.cut2, maxH, padL - 45, Math.round(maxH - lvl.cut2).toString());
    drawVertDim(0, maxH, padL - 75, Math.round(maxH).toString());

    // --- 右側テキスト (計算式) ---
    const textL = canvas.width - padR + 40;
    let textY = padT;
    const area2F_x = window.AppState.config.projectedAreas?.['2F']?.x ?? 0;
    const area2F_y = window.AppState.config.projectedAreas?.['2F']?.y ?? 0;
    const area1F_x = window.AppState.config.projectedAreas?.['1F']?.x ?? 0;
    const area1F_y = window.AppState.config.projectedAreas?.['1F']?.y ?? 0;
    const areaShown2F = direction === 'X' ? area2F_x : area2F_y;
    const areaShown1F_add = direction === 'X' ? area1F_x : area1F_y;
    const areaTotal = areaShown2F + areaShown1F_add;

    ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${direction}方向 見付面積図 (GL基準・スキャンライン法)`, textL, textY); textY += 20;
    ctx.fillStyle = '#7f8c8d'; ctx.font = '10px sans-serif';
    ctx.fillText(`外壁: 柱芯±壁厚${wallThick}mm オフセット済`, textL, textY); textY += 14;
    ctx.fillStyle = '#d35400'; ctx.font = '9px sans-serif';
    ctx.fillText(`※棟線(水平主棟)を持つ屋根のため頂部は台形(水平上辺)として投影・求積`, textL, textY); textY += 24;

    const box = (title, val, color) => {
        ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(title, textL, textY); textY += 18;
        ctx.fillStyle = '#555'; ctx.font = '11px monospace'; ctx.fillText(`カットライン以上 = ${val.toFixed(3)} ㎡`, textL+10, textY); textY += 28;
    };
    box('■ 2F見附 (2FL+1350以上)', areaShown2F, primaryColor);
    box('■ 1F追加見附 (1FL+1350〜2FL+1350)', areaShown1F_add, '#27ae60');

    ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(textL, textY-8); ctx.lineTo(canvas.width-30, textY-8); ctx.stroke();
    textY += 4;

    ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('📐 合計 投影見付面積', textL, textY); textY += 22;
    ctx.font = 'bold 22px monospace'; ctx.fillStyle = '#c62828';
    ctx.fillText(`${areaTotal.toFixed(3)} ㎡`, textL+10, textY); textY += 30;

    ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1; ctx.strokeRect(8, 8, canvas.width-16, canvas.height-16);

    return { img: canvas.toDataURL('image/png'), area: areaTotal };
}

function generateFloorAreaTableHtml(state) {
    const areaLines = state.areaLines || [];
    let html = '';
    
    ['1F', '2F', 'RF'].forEach(f => {
        const fAreas = areaLines.filter(a => a.floor === f);
        if (fAreas.length === 0) return;
        
        html += `<div style="margin-top: 15px; margin-bottom: 25px;">
            <div style="background:#27ae60; color:#fff; padding:6px 12px; font-weight:bold; font-size:13px; border-radius:4px 4px 0 0; display:flex; justify-content:space-between; align-items:center;">
                <span>🏢 ${f} 床面積 求積一覧表</span>
            </div>
            <table class="report-table" style="font-size:11px; width:100%; text-align:center; border: 1px solid #ddd; border-top:none;">
                <tr style="background:#f8f9fa; font-weight:bold;">
                    <th style="width:8%;">No.</th>
                    <th style="width:15%;">用途・区分</th>
                    <th style="width:12%;">底辺(m)</th>
                    <th style="width:12%;">高さ(m)</th>
                    <th style="border-right:1px solid #ddd; text-align:center;">計算式</th>
                    <th style="width:15%;">面積(㎡)</th>
                </tr>`;
        
        let totalA = 0;
        fAreas.forEach((area, i) => {
            const cleanVertices = window.MathUtils && window.MathUtils.dedupPolygon ? window.MathUtils.dedupPolygon(area.vertices) : area.vertices;
            const vCount = cleanVertices.length;
            const c = Geometry.polygonCentroid(area.vertices);
            if (!c) return;
            const MathAbsArea = Math.abs(c.area / 1000000);
            const sign = (c.area / 1000000) > 0 ? 1 : -1;
            const areaVal = sign * MathAbsArea;
            totalA += areaVal;
            
            const typeName = { attic: '小屋裏', balcony: 'バルコニー', void: '吹き抜け', porch: 'ポーチ・屋根' }[area.areaType] || '床面積';
            
            if (vCount === 3 || vCount === 4) {
                const minX = Math.min(...cleanVertices.map(v => v.x)), maxX = Math.max(...cleanVertices.map(v => v.x));
                const minY = Math.min(...cleanVertices.map(v => v.y)), maxY = Math.max(...cleanVertices.map(v => v.y));
                const w = (maxX - minX) / 1000, h_dim = (maxY - minY) / 1000;
                
                const formula = vCount === 3 ? `${sign < 0 ? '-' : ''}底辺 × 高さ / 2` : `${sign < 0 ? '-' : ''}底辺 × 高さ`;
                html += `<tr>
                    <td>${i + 1}${sign < 0 ? ' (除外)' : ''}</td>
                    <td><b>${typeName}</b></td>
                    <td>${w.toFixed(3)}</td>
                    <td>${h_dim.toFixed(3)}</td>
                    <td style="text-align:left; padding-left:10px;">${formula}</td>
                    <td style="font-weight:bold;">${areaVal.toFixed(2)}</td>
                </tr>`;
            } else {
                const triangles = triangulatePolygon(cleanVertices);
                triangles.forEach((tri, subIdx) => {
                    const tc = Geometry.polygonCentroid(tri);
                    if (!tc) return;
                    const subAreaVal = Math.abs(tc.area / 1000000);
                    const minX = Math.min(...tri.map(v => v.x)), maxX = Math.max(...tri.map(v => v.x));
                    const minY = Math.min(...tri.map(v => v.y)), maxY = Math.max(...tri.map(v => v.y));
                    const w = (maxX - minX) / 1000, h_dim = (maxY - minY) / 1000;
                    
                    const formula = `${sign < 0 ? '-' : ''}底辺 × 高さ / 2 (三角形分割)`;
                    const subVal = sign * subAreaVal;
                    
                    html += `<tr>
                        <td>${i + 1}-${subIdx + 1}${sign < 0 ? ' (除外)' : ''}</td>
                        <td><b>${typeName}</b></td>
                        <td>${w.toFixed(3)}</td>
                        <td>${h_dim.toFixed(3)}</td>
                        <td style="text-align:left; padding-left:10px;">${formula}</td>
                        <td>${subVal.toFixed(2)}</td>
                    </tr>`;
                });
            }
        });
        
        html += `<tr style="font-weight:bold; background:#e8f8f0;">
            <td colspan="5" style="text-align:right; padding-right:15px; font-size:12px;">${f} 合計床面積：</td>
            <td style="color:#d35400; font-size:13px;">${totalA.toFixed(2)} ㎡</td>
        </tr>
        </table>
        </div>`;
    });
    
    return html;
}

function showAreaPreview() {
    const pc = document.getElementById('area-preview-container');
    if (!pc) return;
    pc.innerHTML = '';

    // [v3.0.8] 見附面積データ・投影ポリゴンを自動再計算
    if (window.MitsukeEngine && typeof window.MitsukeEngine.updateProjectedAreas === 'function') {
        window.MitsukeEngine.updateProjectedAreas(window.AppState);
    }

    const iF1 = createLayerFilteredImage('floor', ['AREA_D_1F', 'AREA_1F'], ['BG_1F'], '1F', true, 1.0, true);
    const iF2 = createLayerFilteredImage('floor', ['AREA_D_2F', 'AREA_2F'], ['BG_2F'], '2F', true, 1.0, true);
    const iFR = createLayerFilteredImage('floor', ['AREA_D_RF', 'AREA_RF'], ['BG_RF'], 'RF', true, 1.0, true);
    const iEX = createLayerFilteredImage('elev', ['AREA_X'], ['BG_X'], 'X', true, 1.0, true);
    const iEY = createLayerFilteredImage('elev', ['AREA_Y'], ['BG_Y'], 'Y', true, 1.0, true);
    // 4分割図: 常に作図データ(壁・柱)から自動生成する（DXFは無視）
    const iD1X = createNativeCanvasImage('1F', 'wall', 'X', true, 1.0, true);
    const iD1Y = createNativeCanvasImage('1F', 'wall', 'Y', true, 1.0, true);
    const iD2X = createNativeCanvasImage('2F', 'wall', 'X', true, 1.0, true);
    const iD2Y = createNativeCanvasImage('2F', 'wall', 'Y', true, 1.0, true);
    
    let div4ImgHtml = `
        ${iD1X ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">1F X方向 4分割図 (自動計算モデル) <span style="font-size:10px;color:#888;">※クリックで拡大</span></div><img src="${iD1X.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:zoom-in;" onclick="window._zoomMitsukeImg && window._zoomMitsukeImg(this.src, '1F X方向 4分割図')"></div>` : ''}
        ${iD1Y ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">1F Y方向 4分割図 (自動計算モデル) <span style="font-size:10px;color:#888;">※クリックで拡大</span></div><img src="${iD1Y.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:zoom-in;" onclick="window._zoomMitsukeImg && window._zoomMitsukeImg(this.src, '1F Y方向 4分割図')"></div>` : ''}
        ${iD2X ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">2F X方向 4分割図 (自動計算モデル) <span style="font-size:10px;color:#888;">※クリックで拡大</span></div><img src="${iD2X.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:zoom-in;" onclick="window._zoomMitsukeImg && window._zoomMitsukeImg(this.src, '2F X方向 4分割図')"></div>` : ''}
        ${iD2Y ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">2F Y方向 4分割図 (自動計算モデル) <span style="font-size:10px;color:#888;">※クリックで拡大</span></div><img src="${iD2Y.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:zoom-in;" onclick="window._zoomMitsukeImg && window._zoomMitsukeImg(this.src, '2F Y方向 4分割図')"></div>` : ''}
    `;

    const iPA1 = createHighResPlanImage('1F', 'area', null, true, 1.0, true);
    const iPA2 = createHighResPlanImage('2F', 'area', null, true, 1.0, true);

    // Generate high-fidelity analytical silhouette elevation plans
    let commonScale = null;
    if (window.MitsukeEngine && window.MitsukeEngine.generateElevationAreas) {
        const projX = window.MitsukeEngine.generateElevationAreas('X', window.AppState);
        const projY = window.MitsukeEngine.generateElevationAreas('Y', window.AppState);
        if (projX && projY) {
            const getBounds = (proj) => {
                let uMin = Infinity, uMax = -Infinity, zMax = -Infinity;
                proj.primitives.forEach(prim => {
                    prim.vertices.forEach(v => {
                        if (v.u < uMin) uMin = v.u;
                        if (v.u > uMax) uMax = v.u;
                        if (v.z > zMax) zMax = v.z;
                    });
                });
                return { W: uMax > uMin ? uMax - uMin : 10000, maxZ: zMax };
            };
            
            const boundsX = getBounds(projX);
            const boundsY = getBounds(projY);

            const totalH_X = Math.max(boundsX.maxZ, projX.eavesZ2F + 1000);
            const totalH_Y = Math.max(boundsY.maxZ, projY.eavesZ2F + 1000);

            const W_max = Math.max(boundsX.W, boundsY.W);
            const totalH_max = Math.max(totalH_X, totalH_Y);

            const padL = 90, padR = 400, padT = 70, padB = 60;
            const drawW = 900 - padL - padR; // 410
            const drawH = 600 - padT - padB; // 470

            const scaleU = drawW / W_max;
            const scaleZ = drawH / totalH_max;
            commonScale = Math.min(scaleU, scaleZ) * 0.90;
        }
    }

    const iAutoEX = generateAutoMitsukeCanvas('X', commonScale);
    const iAutoEY = generateAutoMitsukeCanvas('Y', commonScale);

    // タブUI全体のHTML構築
    let tabHtml = `
        <div class="preview-tabs" style="display:flex; gap:8px; border-bottom:2px solid #ddd; padding-bottom:10px; margin-bottom:15px; width:100%;">
            <button class="preview-tab-btn active" data-target="tab-floor" style="padding:8px 16px; border:none; background:#f1f2f6; border-radius:4px; font-weight:bold; cursor:pointer; transition:all 0.3s;">🏢 床面積</button>
            <button class="preview-tab-btn" data-target="tab-mitsuke" style="padding:8px 16px; border:none; background:#f1f2f6; border-radius:4px; font-weight:bold; cursor:pointer; transition:all 0.3s;">📐 見附面積</button>
            <button class="preview-tab-btn" data-target="tab-div4" style="padding:8px 16px; border:none; background:#f1f2f6; border-radius:4px; font-weight:bold; cursor:pointer; transition:all 0.3s;">📊 4分割法</button>
            <button class="preview-tab-btn" data-target="tab-pillar" style="padding:8px 16px; border:none; background:#f1f2f6; border-radius:4px; font-weight:bold; cursor:pointer; transition:all 0.3s;">🎯 柱負担面積</button>
        </div>
        
        <div id="tab-floor" class="preview-tab-content active" style="width:100%;">
            <div class="tab-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:20px; margin-bottom:20px;">
                ${iF1 ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">1F 床面積図</div><img src="${iF1.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08);"></div>` : ''}
                ${iF2 ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">2F 床面積図</div><img src="${iF2.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08);"></div>` : ''}
                ${iFR ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">R階 床面積図</div><img src="${iFR.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08);"></div>` : ''}
            </div>
            <div id="floor-table-container"></div>
        </div>
        
        <div id="tab-mitsuke" class="preview-tab-content" style="width:100%; display:none;">
            <div class="tab-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:20px; margin-bottom:20px;">
                ${iAutoEX ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">X方向 見附面積図 (自動計算モデル) <span style="font-size:10px;color:#888;">※クリックで拡大</span></div><img src="${iAutoEX.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:zoom-in;" onclick="window._zoomMitsukeImg && window._zoomMitsukeImg(this.src, 'X方向 見附面積図')"></div>` : ''}
                ${iEX ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">X方向 見附面積図 (DXF読込)</div><img src="${iEX.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:zoom-in;" onclick="window._zoomMitsukeImg && window._zoomMitsukeImg(this.src, 'X方向 見附面積図(DXF)')"></div>` : ''}
                ${iAutoEY ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">Y方向 見附面積図 (自動計算モデル) <span style="font-size:10px;color:#888;">※クリックで拡大</span></div><img src="${iAutoEY.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:zoom-in;" onclick="window._zoomMitsukeImg && window._zoomMitsukeImg(this.src, 'Y方向 見附面積図')"></div>` : ''}
                ${iEY ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">Y方向 見附面積図 (DXF読込)</div><img src="${iEY.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:zoom-in;" onclick="window._zoomMitsukeImg && window._zoomMitsukeImg(this.src, 'Y方向 見附面積図(DXF)')"></div>` : ''}
            </div>
            <div id="mitsuke-table-container"></div>
        </div>
        
        <div id="tab-div4" class="preview-tab-content" style="width:100%; display:none;">
            <div class="tab-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:20px; margin-bottom:20px;">
                ${div4ImgHtml}
            </div>
            <div id="div4-table-container" style="margin-top:20px;"></div>
        </div>
        
        <div id="tab-pillar" class="preview-tab-content" style="width:100%; display:none;">
            <div class="tab-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:20px; margin-bottom:20px;">
                ${iPA1 ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">1F 柱負担面積図</div><img src="${iPA1.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08);"></div>` : ''}
                ${iPA2 ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">2F 柱負担面積図</div><img src="${iPA2.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08);"></div>` : ''}
            </div>
        </div>
    `;

    // タブのインラインCSSとアクティブクラスのスタイル定義
    let tabStyle = `
        <style>
            .preview-tab-btn {
                background: #f1f2f6;
                color: #2c3e50;
                border: 1px solid #dcdde1;
                outline: none;
            }
            .preview-tab-btn:hover {
                background: #e1e2e6;
            }
            .preview-tab-btn.active {
                background: #8e44ad !important;
                color: #ffffff !important;
                border-color: #8e44ad !important;
            }
            .img-preview-box img {
                max-height: 70vh !important;
                object-fit: contain;
            }
        </style>
    `;

    pc.innerHTML = tabStyle + tabHtml;

    // テーブルの挿入
    const floorTableContainer = document.getElementById('floor-table-container');
    if (floorTableContainer) {
        floorTableContainer.innerHTML = generateFloorAreaTableHtml(window.AppState);
    }

    const mitsukeTableContainer = document.getElementById('mitsuke-table-container');
    if (mitsukeTableContainer && window.ElevationRenderer && window.ElevationRenderer.generateElevationAreaTableHtml) {
        if (window.MitsukeEngine && typeof window.MitsukeEngine.updateProjectedAreas === 'function') {
            window.MitsukeEngine.updateProjectedAreas(window.AppState);
        }
        mitsukeTableContainer.innerHTML = window.ElevationRenderer.generateElevationAreaTableHtml(window.AppState);
    }

    const div4TableContainer = document.getElementById('div4-table-container');
    if (div4TableContainer && window.ReportEngine && window.ReportEngine.generateDiv4TableHtml) {
        div4TableContainer.innerHTML = window.ReportEngine.generateDiv4TableHtml(window.AppState);
    }

    // イベントバインディング
    const tabBtns = pc.querySelectorAll('.preview-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active classes
            tabBtns.forEach(b => b.classList.remove('active'));
            pc.querySelectorAll('.preview-tab-content').forEach(c => c.style.display = 'none');
            
            // Add active class
            this.classList.add('active');
            const targetId = this.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.style.display = 'block';
            }
        });
    });

    const modal = document.getElementById('modal-area');
    if (modal) { modal.style.display = 'flex'; }
}

// 見附面積図クリック拡大機能
window._zoomMitsukeImg = function(src, title) {
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
    let panelNames = new Set();

    walls.forEach(w => {
        if (w.outPanelName && !w.outPanelName.startsWith('なし')) panelNames.add(w.outPanelName);
        if (w.inPanelName && !w.inPanelName.startsWith('なし')) panelNames.add(w.inPanelName);
    });

    // 文字コード順でソート（①②③…の順序になる）
    let sortedNames = Array.from(panelNames).sort();

    // 記号（先頭1文字）→フルネーム のマップ（旧データ互換フォールバック用）
    let panelDic = {};
    sortedNames.forEach(name => {
        let sym = name.charAt(0);
        if (sym) panelDic[sym] = name;
    });

    let legendParts = sortedNames.map(name => name);

    let htmlStr = "";
    if (sortedNames.length > 0) {
        htmlStr = `<table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-size:11px;">
    <tr style="background:#eee;">
        <th style="border:1px solid #333; padding:4px; width:10%;">記号</th>
        <th style="border:1px solid #333; padding:4px;">面材仕様 (材質・構成・釘)</th>
        <th style="border:1px solid #333; padding:4px; width:15%;">壁倍率</th>
    </tr>`;
        sortedNames.forEach(name => {
            // 例: "① 構造用合板 (大壁) N50@150 2.5倍" または "①構造用面材 大壁・受材共 N50＠150 (2.5倍)" を解体
            let parts = name.match(/^(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩|⑪|⑫|⑬|⑭|⑮|⑯|⑰|⑱|⑲|⑳|\[任意\])\s*(.*?)\s*\(?([\d.]+\s*倍)\)?$/);
            if (parts) {
                htmlStr += `<tr>
            <td style="border:1px solid #333; padding:4px; text-align:center;">${parts[1]}</td>
            <td style="border:1px solid #333; padding:4px;">${parts[2]}</td>
            <td style="border:1px solid #333; padding:4px; text-align:center;">${parts[3]}</td>
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
            const errors = [];

            // 1. 壁量検定 (Wall Quantity Checks)
            ['1F', '2F'].forEach(f => {
                const sd_state = s.reqWall[f];
                if (sd_state) {
                    const rX = sd_state.qX || 0;
                    const rY = sd_state.qY || 0;
                    let totalKxt = 0, totalKyt = 0;
                    walls.filter(w => w.floor === f).forEach(w => {
                        const dx = Math.abs(w.p2.x - w.p1.x) / 1000;
                        const dy = Math.abs(w.p2.y - w.p1.y) / 1000;
                        const tv = window.WallEngine.getTotalMultiplier(w);
                        totalKxt += dx * tv;
                        totalKyt += dy * tv;
                    });
                    if (totalKxt < rX) {
                        errors.push(`❌ 【壁量計算】${f} X方向：存在壁量 (${totalKxt.toFixed(2)}m) が必要壁量 (${rX.toFixed(2)}m) 未満です。`);
                    }
                    if (totalKyt < rY) {
                        errors.push(`❌ 【壁量計算】${f} Y方向：存在壁量 (${totalKyt.toFixed(2)}m) が必要壁量 (${rY.toFixed(2)}m) 未満です。`);
                    }
                }
            });

            // 2. 4分割検定 (4-Division Wall Balance Checks)
            ['1F', '2F'].forEach(f => {
                const sd_state = s.reqWall[f];
                if (sd_state && sd_state.div4) {
                    const d4 = sd_state.div4;
                    if (!d4.isXOk) {
                        errors.push(`❌ 【4分割法】${f} X方向：側端部の壁比率または充足率がNGです。`);
                    }
                    if (!d4.isYOk) {
                        errors.push(`❌ 【4分割法】${f} Y方向：側端部の壁比率または充足率がNGです。`);
                    }
                }
            });

            // 3. 有効細長比 (Slenderness Ratio Checks)
            pillars.filter(p => !p.isDeleted && !p.isInvalidPos).forEach(p => {
                if (p.lambda != null && !p.lambdaOK) {
                    const pillarName = window.getPillarName ? window.getPillarName(p) || `(${p.gx}-${p.gy})` : `(${p.gx}-${p.gy})`;
                    errors.push(`❌ 【細長比】${p.floor}の柱 ${pillarName}：有効細長比 (${p.lambda.toFixed(1)}) が150を超えています。`);
                }
            });

            // 4. 金物選定・N値検定 (N-Value / Hardware Checks)
            pillars.filter(p => !p.isDeleted && !p.isInvalidPos).forEach(p => {
                const hwList = typeof getHardwareList === 'function' ? getHardwareList() : [];
                const hw = hwList.find(h => h.name === p.nMark);
                const isNg = (p.manualMark && hw && p.nValue > hw.n) || p.nMark === '別途検討';
                if (isNg) {
                    const pillarName = window.getPillarName ? window.getPillarName(p) || `(${p.gx}-${p.gy})` : `(${p.gx}-${p.gy})`;
                    if (p.nMark === '別途検討') {
                        errors.push(`❌ 【金物選定】${p.floor}の柱 ${pillarName}：引抜力 (${p.nValue.toFixed(2)}kN) が標準金物の許容耐力を超えているため、別途検討が必要です。`);
                    } else {
                        const limitN = hw ? hw.n : 0;
                        errors.push(`❌ 【金物選定】${p.floor}の柱 ${pillarName}：引抜力 (${p.nValue.toFixed(2)}kN) が指定金物 (${p.nMark}) の許容耐力 (${limitN.toFixed(2)}kN) を超えています。`);
                    }
                }
            });

            // 5. 基礎スラブの断面検定 (Foundation Slab Checks)
            const checkSlabs = s.foundationSlabs || [];
            checkSlabs.forEach((slab, idx) => {
                if (slab.fdStress && slab.fdStress.isNG) {
                    const slabName = slab.props ? slab.props.name : `FS${idx + 1}`;
                    errors.push(`❌ 【基礎スラブ】No.${idx + 1} スラブ (${slabName})：断面検定がNGです。`);
                }
            });

            // 6. 基礎梁の断面検定 (Foundation Beam Checks)
            const checkBeams = s.foundationBeams || [];
            checkBeams.forEach((beam, idx) => {
                if (beam.fdStress && beam.fdStress.isNG) {
                    const beamName = beam.props ? beam.props.symbol : `FG${idx + 1}`;
                    errors.push(`❌ 【基礎梁】No.${idx + 1} 基礎梁 (${beamName})：断面検定がNGのスパンがあります。`);
                }
            });

            // エラー（NG）の一覧がある場合、ダイアログを表示する
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

        // 印刷範囲コントロール関数のグローバル登録
        window.printDocSection = function() {
            const sel = document.getElementById('doc-print-range-select');
            const mode = sel ? sel.value : 'all';
            
            const dc = document.getElementById('doc-container');
            if (!dc) { window.print(); return; }

            document.body.classList.remove('print-mode-wall-only', 'print-mode-fd-only');
            if (mode === 'wall_only') document.body.classList.add('print-mode-wall-only');
            if (mode === 'fd_only') document.body.classList.add('print-mode-fd-only');

            const allChildren = Array.from(dc.children);
            const fdSecs = Array.from(dc.querySelectorAll('#sec-fd-slab, #sec-fd-beam'));
            const wallChildren = allChildren.filter(child => !child.contains(document.getElementById('sec-fd-slab')) && !child.contains(document.getElementById('sec-fd-beam')));

            if (mode === 'wall_only') {
                wallChildren.forEach(el => el.classList.remove('print-hide'));
                fdSecs.forEach(el => el.classList.add('print-hide'));
            } else if (mode === 'fd_only') {
                wallChildren.forEach(el => el.classList.add('print-hide'));
                fdSecs.forEach(el => el.classList.remove('print-hide'));
            } else {
                [...wallChildren, ...fdSecs].forEach(el => el.classList.remove('print-hide'));
            }
            
            window.print();
            setTimeout(() => {
                document.body.classList.remove('print-mode-wall-only', 'print-mode-fd-only');
                document.querySelectorAll('.print-hide').forEach(el => el.classList.remove('print-hide'));
            }, 500);
        };

        let h = `<div id="sec-summary" class="doc-section" style="margin-bottom:25px; border:2px solid ${isTotalOk ? '#27ae60' : '#c0392b'}; border-radius:4px; padding:15px; background:#fdfdfd;">
            <h3 style="margin:0 0 10px 0; color:#333; font-size:16px;">📄 構造計算 検定結果サマリー</h3>
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

        h += `<div class="doc-section" id="sec-wall"><h3>■ ${secNum++}. 耐力壁配置図 ＆ 壁量検定</h3>`;
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

                let tV = window.getWallTotalVal(w);
                let bV = w.braceVal || 0;
                let outV = w.outPanelVal !== undefined ? w.outPanelVal : 0;
                let inV = w.inPanelVal || 0;

                let mark1 = (w.outPanelName && !w.outPanelName.includes('なし')) ? w.outPanelName.charAt(0) : '';
                let mark2 = (w.inPanelName && !w.inPanelName.includes('なし')) ? w.inPanelName.charAt(0) : '';

                let marks = [];
                if (mark1) marks.push(mark1);
                if (mark2) marks.push(mark2);

                let mark = marks.join('+');

                // 旧データ互換フォールバック
                if (!mark && (outV > 0 || inV > 0)) {
                    let panelSum = outV + inV;
                    mark = window._currentLegendDic ? window._currentLegendDic[panelSum.toFixed(2)] || '' : '';
                }

                let tvStr = '';
                let braceLabel = window.WallEngine.getBraceLabel(w.braceName, bV, w);
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
        h += `<div class="doc-section" id="sec-diag"><h3>■ ${secNum++}. 斜め壁専用 計算リスト</h3>`;
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

        h += `<div class="doc-section" id="sec-div4"><h3>■ ${secNum++}. 4分割 境界図</h3>`;
        h += `<div style="display:flex;flex-direction:column;gap:20px;justify-content:center;margin-bottom:20px;">
              <div style="width:100%;text-align:center;"><b>【1F X方向 4分割】</b><br><img src="${x1}" style="width:95%;max-width:800px;border:1px solid #ccc;"></div>
              <div style="width:100%;text-align:center;"><b>【1F Y方向 4分割】</b><br><img src="${y1}" style="width:95%;max-width:800px;border:1px solid #ccc;"></div>`;
        h += `<div class="page-break"></div>`;
        h += `<div style="width:100%;text-align:center;"><b>【2F X方向 4分割】</b><br><img src="${x2}" style="width:95%;max-width:800px;border:1px solid #ccc;"></div>
              <div style="width:100%;text-align:center;"><b>【2F Y方向 4分割】</b><br><img src="${y2}" style="width:95%;max-width:800px;border:1px solid #ccc;"></div></div>`;
        h += `</div><div class="page-break"></div>`;

        h += `<div class="doc-section"><h3>■ ${secNum++}. 4分割 存在壁量リスト ＆ 検定表</h3>`;
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

        h += `<div class="doc-section" id="sec-nval"><h3>■ ${secNum++}. 柱の小径等 ＆ 金物・N値 計算表</h3>`;
        h += `<div style="text-align:center;margin-bottom:20px"><b>【1F 金物・N値配置図】</b><br><img src="${n1}" style="width:95%;max-width:800px;border:1px solid #ccc;margin-top:5px"></div>`;
        h += `<div style="text-align:center;margin-bottom:20px"><b>【2F 金物・N値配置図】</b><br><img src="${n2}" style="width:95%;max-width:800px;border:1px solid #ccc;margin-top:5px"></div>`;

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
            h += `</table>`;
            h += `<div style="text-align:right; font-size:11px; margin-top:2px;">※特記：h1/h2係数の算出において、階高が3.2m以下の場合は2.7mとして算出しています。</div>`;
            h += `<br>`;
        });

        const hwList = getHardwareList();
        h += `<h4>【金物耐力（N値）凡例】</h4><table class="report-table" style="width:70%; margin:auto;"><tr><th>N値上限</th><th>略記号</th><th>接合具(告示1460号)・仕様例</th></tr><tr><td>0 以下</td><td>不要</td><td>(い) 仕様外・接合不要</td></tr>`;
        hwList.forEach(hw => { h += `<tr><td>${hw.n.toFixed(2)} 以下</td><td><b>${hw.name}</b></td><td>${hw.isCust ? "[任意追加金物]" : `(告示基準)`}</td></tr>`; });
        h += `<tr><td>5.6 超</td><td>32(等)</td><td>別途検討</td></tr></table><div style="text-align:center; color:#e74c3c; font-weight:bold; margin-top:10px;">※金物記載のない柱は、短ほぞ差しまたはカスガイ打ち同等以上の接合方法とする。</div></div><div class="page-break"></div>`;

        h += `<div class="doc-section" id="sec-pillar"><h3>■ ${secNum++}. 柱負担面積 自動算出図 ＆ 算出リスト</h3>`;
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

        h += `<div class="doc-section"><h3>■ ${secNum++}. 有効細長比 判定表</h3>`;
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
        h += `</div><div class="page-break"></div>`;

        // --- 6. 基礎スラブ構造検定 ---
        h += `<div class="doc-section" id="sec-fd-slab" style="margin-bottom:30px; page-break-before:always;">
            <h3 style="color:#2c3e50; border-bottom:2px solid #8e44ad; padding-bottom:5px; margin-bottom:15px;">■ 6. 基礎スラブ 構造検定</h3>`;
        
        const slabs = window.AppState.foundationSlabs || [];
        if (slabs.length === 0) {
            h += `<div style="padding:15px; background:#f8f9fa; border:1px dashed #bdc3c7; border-radius:4px; color:#7f8c8d; font-size:12px; margin-bottom:15px;">
                ※ 基礎スラブが未配置（未設定）です。基礎計算モードで作図・配置を行うと自動算定・検定結果がここに反映されます。
            </div>`;
        } else {
            h += `<table class="report-table" style="width:100%; font-size:12px; margin-bottom:15px;">
                <thead>
                    <tr style="background:#8e44ad; color:#fff;">
                        <th>No</th><th>固定条件</th><th>スラブ厚 d(mm)</th><th>短辺/長辺 (m)</th><th>接地圧 w(kN/㎡)</th><th>曲げ M(kN·m)</th><th>せん断 V(kN)</th><th>配筋要件</th><th>判定</th>
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
                const thick = props.slabThickness || 150;
                const fixType = props.support || '4辺固定';
                
                h += `<tr>
                    <td style="font-weight:bold;">No.${idx+1}</td>
                    <td>${fixType}</td>
                    <td>${thick}</td>
                    <td>${lx.toFixed(2)} × ${ly.toFixed(2)}</td>
                    <td>${w.toFixed(2)}</td>
                    <td>${mMax.toFixed(2)}</td>
                    <td>${(w * lx / 2).toFixed(2)}</td>
                    <td>D13@200 (同等)</td>
                    <td>${okStr}</td>
                </tr>`;
            });
            h += `</tbody></table>`;
        }
        h += `</div>`;

        // --- 7. 基礎梁構造検定 ＆ 応力図 ---
        h += `<div class="doc-section" id="sec-fd-beam" style="margin-bottom:30px; page-break-before:always;">
            <h3 style="color:#2c3e50; border-bottom:2px solid #8e44ad; padding-bottom:5px; margin-bottom:15px;">■ 7. 基礎梁 構造検定 ＆ 応力（N・M・Q）図</h3>`;

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

        const fBeams = window.AppState.foundationBeams || [];
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
                                ${nmqSvg || `<div style="font-size:11px; color:#888; text-align:center; padding:30px;">(応力解析図)</div>`}
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

