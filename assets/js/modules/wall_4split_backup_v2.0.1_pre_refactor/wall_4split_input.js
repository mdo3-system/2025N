// ==========================================
// wall_4split_input.js - 入力・マウス操作ロジック
// ==========================================

function initCanvasInput(canvas) {
        if (canvas) {
            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                let zoomFactor = e.deltaY > 0 ? 1.15 : 0.87; // CAD標準(↑で拡大, ↓で縮小)に反転
                let rect = canvas.getBoundingClientRect();
                let cx = e.clientX - rect.left, cy = e.clientY - rect.top;
                offsetX = cx - (cx - offsetX) * zoomFactor;
                offsetY = cy - (cy - offsetY) * zoomFactor;
                scale *= zoomFactor;
                requestAnimationFrame(draw);
            }, { passive: false });

            canvas.addEventListener('mousedown', (e) => {
                let m = getMode();

                // [基礎計算追加 Phase2] 基礎モードの場合、独自ハンドラに委譲して戻る
                if (getAppMode() === 'foundation' && e.button === 0) {
                    handleFoundationMouseDown(e);
                    return;
                }

                if (e.button === 1 || e.button === 2 || (e.button === 0 && !hoveredPillar && m !== 'add-grid' && m !== 'del-wall' && m !== 'add-pillar' && m !== 'edit-wall' && m !== 'edit-text' && m !== 'del-grid' && m !== 'draw-area' && m !== 'select')) { isDragging = true; lastMouseX = e.clientX; lastMouseY = e.clientY; return; }
                if (e.button === 0) {
                    // --- [機能追加] 統合選択モード (Select Mode) ---
                    if (m === 'select') {
                        let hitElement = null;

                        // 1. 柱 (最優先)
                        if (hoveredPillar) {
                            hitElement = { type: 'pillar', item: hoveredPillar };
                        }

                        // 2. 壁・開口 (線要素)
                        if (!hitElement) {
                            const toCanvas = (x, y) => ({ cx: x * scale + offsetX, cy: canvas.height - (y * scale + offsetY) });
                            // 壁の判定
                            for (let w of walls.filter(w => w.floor === currentFloor)) {
                                let p1 = toCanvas(w.p1.x, w.p1.y), p2 = toCanvas(w.p2.x, w.p2.y);
                                let l2 = (p2.cx - p1.cx) ** 2 + (p2.cy - p1.cy) ** 2;
                                let t = Math.max(0, Math.min(1, ((mouseX - p1.cx) * (p2.cx - p1.cx) + (mouseY - p1.cy) * (p2.cy - p1.cy)) / (l2 || 1)));
                                let dist = Math.hypot(mouseX - (p1.cx + t * (p2.cx - p1.cx)), mouseY - (p1.cy + t * (p2.cy - p1.cy)));
                                if (dist < 10) { hitElement = { type: 'wall', item: w }; break; }
                            }
                            // 開口の判定
                            if (!hitElement) {
                                for (let w of windowsArr.filter(w => w.floor === currentFloor)) {
                                    let p1 = toCanvas(w.p1.x, w.p1.y), p2 = toCanvas(w.p2.x, w.p2.y);
                                    let l2 = (p2.cx - p1.cx) ** 2 + (p2.cy - p1.cy) ** 2;
                                    let t = Math.max(0, Math.min(1, ((mouseX - p1.cx) * (p2.cx - p1.cx) + (mouseY - p1.cy) * (p2.cy - p1.cy)) / (l2 || 1)));
                                    let dist = Math.hypot(mouseX - (p1.cx + t * (p2.cx - p1.cx)), mouseY - (p1.cy + t * (p2.cy - p1.cy)));
                                    if (dist < 15) { hitElement = { type: 'window', item: w }; break; }
                                }
                            }
                        }

                        // 3. 面積 (面要素)
                        if (!hitElement) {
                            const isPointInPolygon = (p, poly) => {
                                let inside = false;
                                let x = p.x, y = p.y;
                                for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                                    if (((poly[i].y > y) !== (poly[j].y > y)) && (x < (poly[j].x - poly[i].x) * (y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)) inside = !inside;
                                }
                                return inside;
                            };
                            const wx = (mouseX - offsetX) / scale;
                            const wy = (canvas.height - mouseY - offsetY) / scale;
                            for (let a of areaLines.filter(a => a.floor === currentFloor)) {
                                if (a.vertices && isPointInPolygon({ x: wx, y: wy }, a.vertices)) {
                                    hitElement = { type: 'area', item: a };
                                    break;
                                }
                            }
                        }

                        if (hitElement) {
                            selectedElement = hitElement;
                            if (typeof openPropertyModal === 'function') openPropertyModal(hitElement);
                        } else {
                            selectedElement = null;
                        }
                        triggerUpdate();
                        return;
                    }

                    if ((m === 'wall' || m === 'window') && hoveredPillar) {
                        if (!selectedPillar) { selectedPillar = hoveredPillar; if (m === 'wall') showPillarProps(hoveredPillar); }
                        else if (selectedPillar.id !== hoveredPillar.id) {
                            let l = Math.floor(Math.sqrt((hoveredPillar.x - selectedPillar.x) ** 2 + (hoveredPillar.y - selectedPillar.y) ** 2));
                            if (m === 'wall') {
                                if (windowsArr.some(w => (w.p1.id === selectedPillar.id && w.p2.id === hoveredPillar.id) || (w.p1.id === hoveredPillar.id && w.p2.id === selectedPillar.id))) { alert("⚠️ 既に開口部が配置されています。"); selectedPillar = null; draw(); return; }
                                let p1Val = getPanelVal('wall-p1');
                                let p2Val = getPanelVal('wall-p2');
                                let bVal = getVal('wall-b');
                                let sumVal = p1Val + p2Val + bVal;
                                if (sumVal > 7.0) {
                                    alert("壁倍率の合計が7.0倍を超えています。7.0倍以下の組み合わせに修正してください。");
                                    selectedPillar = null; draw(); return;
                                }
                                let bSel = document.getElementById('wall-b');
                                let bSelOpt = bSel && bSel.selectedIndex >= 0 ? bSel.options[bSel.selectedIndex] : null;
                                let braceName = bSelOpt ? bSelOpt.text : '';
                                let t = braceName.includes('たすき');
                                let p1El = document.getElementById('wall-p1');
                                let p2El = document.getElementById('wall-p2');
                                let outName = p1El && p1El.selectedIndex >= 0 ? p1El.options[p1El.selectedIndex].text : '';
                                let inName = p2El && p2El.selectedIndex >= 0 ? p2El.options[p2El.selectedIndex].text : '';
                                // 選択IDを保存（updateWallSelects時にvalue=savedIdで正確に復元）
                                if (p1El) p1El.dataset.savedId = p1El.value;
                                if (p2El) p2El.dataset.savedId = p2El.value;
                                let nw = { 
                                    id: Date.now(), p1: selectedPillar, p2: hoveredPillar, length: l, floor: currentFloor,
                                    outPanelId: p1El ? p1El.value : 'opt0', 
                                    inPanelId: p2El ? p2El.value : 'opt0', 
                                    braceId: bSel ? bSel.value : 'b0',
                                    outPanelVal: p1Val, inPanelVal: p2Val, braceVal: bVal, totalVal: sumVal,
                                    outPanelName: outName, inPanelName: inName, braceName: braceName,
                                    isTasuki: t
                                };
                                walls.push(nw); pushHistory({ type: 'add_wall', obj: nw });
                            } else {
                                let nw = { id: Date.now(), p1: selectedPillar, p2: hoveredPillar, length: l, floor: currentFloor };
                                windowsArr.push(nw); pushHistory({ type: 'add_win', obj: nw });
                            } selectedPillar = null; triggerUpdate();
                        }
                    } else if (m === 'draw-area' && snapPoint) {
                        let aType = document.getElementById('area-type-select') ? document.getElementById('area-type-select').value : 'floor';
                        if (currentFloor === '1F' && aType === 'void') {
                            alert('吹き抜けは2階作図でしか使えません。');
                            areaDrawPoints = [];
                            return;
                        }

                        const pt = { x: snapPoint.x, y: snapPoint.y };
                        if (areaDrawPoints.length > 2 && areaDrawPoints[0].x === pt.x && areaDrawPoints[0].y === pt.y) {
                            let vts = areaDrawPoints.map(p => ({ x: p.x, y: p.y }));
                            let isRectangleOrTrapezoid = true;
                            if (vts.length === 3) {
                                isRectangleOrTrapezoid = true; // ★課題4：三角形を許可
                            } else if (vts.length !== 4) {
                                isRectangleOrTrapezoid = false;
                            } else {
                                const isParallel = (p1, p2, p3, p4) => {
                                    let v1 = { x: p2.x - p1.x, y: p2.y - p1.y }, v2 = { x: p4.x - p3.x, y: p4.y - p3.y };
                                    let cross = Math.abs(v1.x * v2.y - v1.y * v2.x), mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y), mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
                                    return (cross / (mag1 * mag2 || 1)) < 0.05;
                                };
                                if (!isParallel(vts[0], vts[1], vts[2], vts[3]) && !isParallel(vts[1], vts[2], vts[3], vts[0])) isRectangleOrTrapezoid = false;
                            }
                            if (!isRectangleOrTrapezoid && !confirm("入力された形状は長方形・台形以外の多角形（または不整形）です。このまま続けますか？")) {
                                areaDrawPoints = []; return;
                            }
                            let aType = document.getElementById('area-type-select') ? document.getElementById('area-type-select').value : 'floor';

                            // ===== 重なり判定 =====
                            if (aType !== 'attic') {
                                const isPolygonsOverlap = (polyA, polyB) => {
                                    const eps = 1e-4;
                                    const isPtInside = (pt, poly) => {
                                        let inside = false;
                                        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                                            let xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
                                            if (((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) inside = !inside;
                                        }
                                        return inside;
                                    };
                                    // 境界付近（共有エッジ・接触）はエラーとしないための遊び
                                    const isObjOnBoundary = (pt, poly) => {
                                        for (let i = 0; i < poly.length; i++) {
                                            let p1 = poly[i], p2 = poly[(i + 1) % poly.length];
                                            let l2 = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2; if (l2 === 0) continue;
                                            let t = ((pt.x - p1.x) * (p2.x - p1.x) + (pt.y - p1.y) * (p2.y - p1.y)) / l2;
                                            t = Math.max(0, Math.min(1, t));
                                            if (Math.hypot(pt.x - (p1.x + t * (p2.x - p1.x)), pt.y - (p1.y + t * (p2.y - p1.y))) <= 5) return true;
                                        }
                                        return false;
                                    };

                                    const isPointStrictlyInside = (pt, poly) => isPtInside(pt, poly) && !isObjOnBoundary(pt, poly);

                                    const segIntersect = (p1, p2, p3, p4) => {
                                        let ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
                                        let cr1 = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
                                        let cr2 = (p2.x - p1.x) * (p4.y - p1.y) - (p2.y - p1.y) * (p4.x - p1.x);
                                        let cr3 = (p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x);
                                        let cr4 = (p4.x - p3.x) * (p2.y - p3.y) - (p4.y - p3.y) * (p2.x - p3.x);
                                        if (Math.abs(cr1) < eps || Math.abs(cr2) < eps || Math.abs(cr3) < eps || Math.abs(cr4) < eps) return false;
                                        return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
                                    };

                                    for (let i = 0; i < polyA.length; i++) {
                                        let a1 = polyA[i], a2 = polyA[(i + 1) % polyA.length];
                                        for (let j = 0; j < polyB.length; j++) {
                                            if (segIntersect(a1, a2, polyB[j], polyB[(j + 1) % polyB.length])) return true;
                                        }
                                    }

                                    for (let pt of polyA) if (isPointStrictlyInside(pt, polyB)) return true;
                                    for (let pt of polyB) if (isPointStrictlyInside(pt, polyA)) return true;

                                    for (let i = 0; i < polyA.length; i++) {
                                        let p1 = polyA[i], p2 = polyA[(i + 1) % polyA.length], mid = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
                                        if (isPointStrictlyInside(mid, polyB)) return true;
                                    }
                                    for (let i = 0; i < polyB.length; i++) {
                                        let p1 = polyB[i], p2 = polyB[(i + 1) % polyB.length], mid = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
                                        if (isPointStrictlyInside(mid, polyA)) return true;
                                    }
                                    return false;
                                };

                                let hasOverlap = false;
                                for (let a of areaLines) {
                                    if (a.floor === currentFloor && a.areaType !== 'attic' && a.vertices) {
                                        if (isPolygonsOverlap(vts, a.vertices)) {
                                            hasOverlap = true; break;
                                        }
                                    }
                                }
                                if (hasOverlap) {
                                    alert('小屋裏面積以外は、他の面積と重なるように作図することはできません。');
                                    areaDrawPoints = []; return;
                                }
                            }

                            // ★ 修正3: layer名を 'AREA_1F'/'AREA_2F'/'AREA_RF' 形式に統一
                            // （cad.js の createLayerFilteredImage が検索する 'AREA_1F' に合わせる）
                            let na = { type: 'LWPOLYLINE', closed: true, layer: 'AREA_' + currentFloor, vertices: vts, floor: currentFloor, areaType: aType, isManualArea: true, id: Date.now() };
                            areaLines.push(na); pushHistory({ type: 'add_area', obj: na }); areaDrawPoints = []; triggerUpdate();
                        } else if (areaDrawPoints.length > 0 && areaDrawPoints[areaDrawPoints.length - 1].x === pt.x && areaDrawPoints[areaDrawPoints.length - 1].y === pt.y) { }
                        else { areaDrawPoints.push(pt); draw(); }
                    } else if (m === 'del-wall' || m === 'edit-wall') {
                        let cW = null, cWin = null, cA = null;
                        const toCanvas = (x, y) => ({ cx: x * scale + offsetX, cy: canvas.height - (y * scale + offsetY) });
                        for (let w of walls.filter(w => w.floor === currentFloor)) {
                            let p1 = toCanvas(w.p1.x, w.p1.y), p2 = toCanvas(w.p2.x, w.p2.y);
                            let l2 = (p2.cx - p1.cx) ** 2 + (p2.cy - p1.cy) ** 2, t = Math.max(0, Math.min(1, ((mouseX - p1.cx) * (p2.cx - p1.cx) + (mouseY - p1.cy) * (p2.cy - p1.cy)) / (l2 || 1)));
                            if (Math.sqrt((mouseX - (p1.cx + t * (p2.cx - p1.cx))) ** 2 + (mouseY - (p1.cy + t * (p2.cy - p1.cy))) ** 2) < 10) { cW = w; break; }
                        }
                        if (!cW && m === 'del-wall') {
                            for (let w of windowsArr.filter(w => w.floor === currentFloor)) {
                                let p1 = toCanvas(w.p1.x, w.p1.y), p2 = toCanvas(w.p2.x, w.p2.y);
                                let l2 = (p2.cx - p1.cx) ** 2 + (p2.cy - p1.cy) ** 2, t = Math.max(0, Math.min(1, ((mouseX - p1.cx) * (p2.cx - p1.cx) + (mouseY - p1.cy) * (p2.cy - p1.cy)) / (l2 || 1)));
                                if (Math.sqrt((mouseX - (p1.cx + t * (p2.cx - p1.cx))) ** 2 + (mouseY - (p1.cy + t * (p2.cy - p1.cy))) ** 2) < 15) { cWin = w; break; }
                            }
                            if (!cWin) {
                                for (let a of areaLines.filter(a => a.isManualArea && a.floor === currentFloor)) {
                                    for (let i = 0; i < a.vertices.length; i++) {
                                        let p1 = toCanvas(a.vertices[i].x, a.vertices[i].y), p2 = toCanvas(a.vertices[(i + 1) % a.vertices.length].x, a.vertices[(i + 1) % a.vertices.length].y);
                                        let l2 = (p2.cx - p1.cx) ** 2 + (p2.cy - p1.cy) ** 2, t = Math.max(0, Math.min(1, ((mouseX - p1.cx) * (p2.cx - p1.cx) + (mouseY - p1.cy) * (p2.cy - p1.cy)) / (l2 || 1)));
                                        if (Math.sqrt((mouseX - (p1.cx + t * (p2.cx - p1.cx))) ** 2 + (mouseY - (p1.cy + t * (p2.cy - p1.cy))) ** 2) < 15) { cA = a; break; }
                                    } if (cA) break;
                                }
                            }
                        }
                        if (cW) {
                            if (m === 'del-wall') {
                                walls = walls.filter(w => w.id !== cW.id); pushHistory({ type: 'del_wall', obj: cW });
                            } else {
                                let p1Val = getPanelVal('wall-p1');
                                let p2Val = getPanelVal('wall-p2');
                                let bVal = getVal('wall-b');
                                let sumVal = p1Val + p2Val + bVal;
                                if (sumVal > 7.0) {
                                    alert("壁倍率の合計が7.0倍を超えています。7.0倍以下の組み合わせに修正してください。");
                                    return;
                                }
                                let ow = JSON.parse(JSON.stringify(cW));
                                cW.outPanelVal = p1Val;
                                cW.inPanelVal = p2Val;
                                cW.braceVal = bVal;
                                cW.totalVal = sumVal;
                                let p1El2 = document.getElementById('wall-p1');
                                let p2El2 = document.getElementById('wall-p2');
                                cW.outPanelName = p1El2 && p1El2.selectedIndex >= 0 ? p1El2.options[p1El2.selectedIndex].text : (cW.outPanelName || '');
                                cW.inPanelName = p2El2 && p2El2.selectedIndex >= 0 ? p2El2.options[p2El2.selectedIndex].text : (cW.inPanelName || '');
                                let bSelE = document.getElementById('wall-b');
                                let bSelEOpt = bSelE && bSelE.selectedIndex >= 0 ? bSelE.options[bSelE.selectedIndex] : null;
                                cW.isTasuki = bSelEOpt ? bSelEOpt.text.includes('たすき') : (cW.isTasuki || false);
                                cW.braceName = bSelEOpt ? bSelEOpt.text : (cW.braceName || '');
                                // 選択IDを保存
                                if (p1El2) p1El2.dataset.savedId = p1El2.value;
                                if (p2El2) p2El2.dataset.savedId = p2El2.value;
                                pushHistory({ type: 'edit_wall', obj: cW, oldObj: ow });
                            } triggerUpdate();
                        }
                        else if (cWin && m === 'del-wall') { windowsArr = windowsArr.filter(w => w.id !== cWin.id); pushHistory({ type: 'del_win', obj: cWin }); requestAnimationFrame(draw); }
                        else if (cA && m === 'del-wall') { areaLines = areaLines.filter(a => a.id !== cA.id); pushHistory({ type: 'del_area', obj: cA }); triggerUpdate(); }
                    } else if (m === 'edit-text') {
                        const toCanvas = (x, y) => ({ cx: x * scale + offsetX, cy: canvas.height - (y * scale + offsetY) });
                        let cT = null; for (let t of bgTextsOriginal.filter(t => t.floor === currentFloor || t.floor === 'ALL')) {
                            let p = toCanvas(t.x, t.y);
                            if (Math.abs(mouseX - p.cx) < 30 && Math.abs(mouseY - p.cy) < 20) { cT = t; break; }
                        }
                        if (cT) {
                            let ns = prompt("文字を編集:", cT.text);
                            if (ns !== null) { let os = cT.text; cT.text = ns; if (cT.isGrid) triggerUpdate(); else { pushHistory({ type: 'edit_text', obj: cT, oldStr: os }); requestAnimationFrame(draw); } }
                        } else {
                            // 通り芯文字のクリック判定（ビューポート追従版）
                            // ★ ビューポート端のワールド座標を計算
                            const visibleLeft = -offsetX / scale;
                            const visibleTop = (canvas.height - offsetY) / scale;
                            const labelPad = 10 / scale;

                            // X方向通り芯名の表示位置（ビューポート上端付近）
                            let labelYForX = toCanvas(0, visibleTop - labelPad).cy;
                            labelYForX = Math.max(labelYForX, 15);

                            // Y方向通り芯名の表示位置（ビューポート左端付近）
                            let labelXForY = toCanvas(visibleLeft + labelPad, 0).cx;
                            labelXForY = Math.max(labelXForY, 5);

                            let clickedGridX = -1;
                            for (let i = 0; i < gridXCoords.length; i++) {
                                let cx = toCanvas(gridXCoords[i], 0).cx;
                                if (Math.abs(mouseX - cx) < 30 && Math.abs(mouseY - labelYForX) < 25) { clickedGridX = i; break; }
                            }

                            if (clickedGridX >= 0) {
                                let newName = prompt("X方向の通り芯名を編集:", gridXNames[clickedGridX]);
                                if (newName !== null && newName.trim() !== '') {
                                    pushHistory({ type: 'edit_grid_name_x', idx: clickedGridX, oldName: gridXNames[clickedGridX] });
                                    gridXNames[clickedGridX] = newName.trim();
                                    window.userEditedGridX[gridXCoords[clickedGridX]] = newName.trim(); // 永続保存
                                    triggerUpdate();
                                }
                            } else {
                                let clickedGridY = -1;
                                for (let i = 0; i < gridYCoords.length; i++) {
                                    let cy = toCanvas(0, gridYCoords[i]).cy;
                                    if (Math.abs(mouseY - cy) < 25 && Math.abs(mouseX - labelXForY) < 40) { clickedGridY = i; break; }
                                }
                                if (clickedGridY >= 0) {
                                    let newName = prompt("Y方向の通り芯名を編集:", gridYNames[clickedGridY]);
                                    if (newName !== null && newName.trim() !== '') {
                                        pushHistory({ type: 'edit_grid_name_y', idx: clickedGridY, oldName: gridYNames[clickedGridY] });
                                        gridYNames[clickedGridY] = newName.trim();
                                        window.userEditedGridY[gridYCoords[clickedGridY]] = newName.trim(); // 永続保存
                                        triggerUpdate();
                                    }
                                }
                            }
                        }
                    } else if (m === 'add-pillar' && snapPoint) {
                        let np = { id: `M${pIdCounter++}`, x: snapPoint.x, y: snapPoint.y, isManual: true, isDeleted: false, floor: currentFloor, isCornerAuto: false, isManualCorner: null, manualMark: null, isInvalidPos: false };
                        if (!pillars.some(p => !p.isDeleted && p.floor === currentFloor && p.x === np.x && p.y === np.y)) { pillars.push(np); pushHistory({ type: 'add_pillar', obj: np }); triggerUpdate(); }
                    } else if (m === 'add-grid') {
                        // ★課題：クリック位置、または吸着点(snapPoint)からワールド座標を正確に取得
                        const rx = snapPoint ? snapPoint.x : (mouseX - offsetX) / scale;
                        const ry = snapPoint ? snapPoint.y : (canvas.height - mouseY - offsetY) / scale;
                        
                        let cX = null, dX = Infinity, cY = null, dY = Infinity;
                        gridXCoords.forEach((x, i) => { let d = Math.abs(rx - x); if (d < dX) { dX = d; cX = { coord: x, name: gridXNames[i] }; } });
                        gridYCoords.forEach((y, i) => { let d = Math.abs(ry - y); if (d < dY) { dY = d; cY = { coord: y, name: gridYNames[i] }; } });

                        // 基準線が見つからない場合（初期状態など）も考慮し、制限を大幅に緩和
                        if (dX < 10000 || dY < 10000 || (gridXCoords.length === 0 && gridYCoords.length === 0)) {
                            // XかYか、クリック位置に近い方を判定（基準がない場合はrx/ryをそのまま使用）
                            if (dX <= dY) {
                                let baseName = cX ? cX.name : "X0";
                                let baseCoord = cX ? cX.coord : rx;
                                let defOs = snapPoint ? "0" : (cX ? "910" : "0");
                                let os = prompt(`基準: 【${baseName}】通り\nオフセット距離(mm)を入力 (右:+ / 左:-):`, defOs);
                                if (os !== null && !isNaN(parseFloat(os))) {
                                    let nn = prompt("新しい通り芯名:", baseName + "a");
                                    if (nn) {
                                        let ob = { name: nn, coord: baseCoord + parseFloat(os) };
                                        manualGridX.push(ob);
                                        pushHistory({ type: 'add_grid', obj: ob, isX: true });
                                        analyzeGrids(); triggerUpdate();
                                    }
                                }
                            } else {
                                let baseName = cY ? cY.name : "Y0";
                                let baseCoord = cY ? cY.coord : ry;
                                let defOs = snapPoint ? "0" : (cY ? "910" : "0");
                                let os = prompt(`基準: 【${baseName}】通り\nオフセット距離(mm)を入力 (上:+ / 下:-):`, defOs);
                                if (os !== null && !isNaN(parseFloat(os))) {
                                    let nn = prompt("新しい通り芯名:", baseName + "a");
                                    if (nn) {
                                        let ob = { name: nn, coord: baseCoord + parseFloat(os) };
                                        manualGridY.push(ob);
                                        pushHistory({ type: 'add_grid', obj: ob, isX: false });
                                        analyzeGrids(); triggerUpdate();
                                    }
                                }
                            }
                        } else { alert("基準となる位置が見つかりません。"); }
                    } else if (m === 'del-grid') {
                        const rx = (mouseX - offsetX) / scale, ry = (canvas.height - mouseY - offsetY) / scale;
                        
                        // マニュアルグリッドの削除
                        let dxIdx = manualGridX.findIndex(m => Math.abs(m.coord - rx) < 15 / scale);
                        let dyIdx = manualGridY.findIndex(m => Math.abs(m.coord - ry) < 15 / scale);
                        
                        // ★ 課題2: ブラックリストへの追加（自動抽出グリッドを消すため）
                        let clickedX = gridXCoords.find(x => Math.abs(x - rx) < 15 / scale);
                        let clickedY = gridYCoords.find(y => Math.abs(y - ry) < 15 / scale);

                        if (dxIdx >= 0) {
                            pushHistory({ type: 'del_grid', obj: manualGridX[dxIdx], isX: true });
                            manualGridX.splice(dxIdx, 1);
                        } else if (dyIdx >= 0) {
                            pushHistory({ type: 'del_grid', obj: manualGridY[dyIdx], isX: false });
                            manualGridY.splice(dyIdx, 1);
                        } else if (clickedX !== undefined) {
                            deletedGridX.push(clickedX);
                            pushHistory({ type: 'blacklist_grid', coord: clickedX, isX: true });
                        } else if (clickedY !== undefined) {
                            deletedGridY.push(clickedY);
                            pushHistory({ type: 'blacklist_grid', coord: clickedY, isX: false });
                        }
                        analyzeGrids(); triggerUpdate();
                    } else if (m === 'del-pillar' && hoveredPillar) {
                        hoveredPillar.isDeleted = true; let cw = walls.filter(w => w.p1.id === hoveredPillar.id || w.p2.id === hoveredPillar.id); walls = walls.filter(w => w.p1.id !== hoveredPillar.id && w.p2.id !== hoveredPillar.id);
                        pushHistory({ type: 'del_pillar', obj: hoveredPillar, connectedWalls: cw }); hidePillarProps(); triggerUpdate();
                    } else if (hoveredPillar) { showPillarProps(hoveredPillar); }
                }
            });
            canvas.addEventListener('mousemove', (e) => {
                mouseX = e.offsetX; mouseY = e.offsetY;
                // パン（移動）の挙動反転: マウスの動きと同じ方向にマップを移動させて標準CAD互換にする
                if (isDragging) {
                    offsetX += (e.clientX - lastMouseX);
                    offsetY -= (e.clientY - lastMouseY); // CanvasY is inverted, leaving this inverted correctly mirrors view
                    lastMouseX = e.clientX;
                    lastMouseY = e.clientY;
                }

                // [基礎計算追加 Phase2] 基礎モードの場合、スナップ計算のみ行い早期リターン
                if (getAppMode() === 'foundation') {
                    if (!isDragging) handleFoundationMouseMove(e.offsetX, e.offsetY);
                    else requestAnimationFrame(draw);
                    return;
                }

                hoveredPillar = null; snapPoint = null; const m = getMode();
                const tC = (x, y) => ({ cx: x * scale + offsetX, cy: canvas.height - (y * scale + offsetY) });
                if (!['add-pillar', 'del-wall', 'edit-wall', 'edit-text', 'add-grid', 'del-grid'].includes(m)) {
                    for (const p of pillars.filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === currentFloor || p.floor === 'ALL'))) {
                        const pt = tC(p.x, p.y);
                        if (pt.cx != null && !isNaN(pt.cx) && Math.sqrt((mouseX - pt.cx) ** 2 + (mouseY - pt.cy) ** 2) < 20) { hoveredPillar = p; break; }
                    }
                }
                if (m === 'add-pillar' || m === 'draw-area') {
                    let md = 30;
                    gridXCoords.forEach(gx => gridYCoords.forEach(gy => {
                        const pt = tC(gx, gy);
                        if (pt.cx != null && !isNaN(pt.cx)) {
                            let d = Math.sqrt((mouseX - pt.cx) ** 2 + (mouseY - pt.cy) ** 2);
                            if (d < md) { md = d; snapPoint = { x: gx, y: gy, sx: pt.cx, sy: pt.cy }; }
                        }
                    }));
                }
                requestAnimationFrame(draw);
            });
            canvas.addEventListener('mouseup', () => isDragging = false);
            canvas.addEventListener('contextmenu', e => {
                e.preventDefault();
                // [基礎計算追加 Phase2] 基礎モードでの右クリックキャンセル
                if (getAppMode() === 'foundation') {
                    fdDrawPoints = []; fdSelectedPillarLike = null;
                    requestAnimationFrame(draw);
                    return;
                }
                // ★課題5：作図中の右クリックによるキャンセル
                if (areaDrawPoints.length > 0) {
                    areaDrawPoints = [];
                    draw();
                    triggerUpdate();
                }
            });
        }

        triggerUpdate();
        window.addEventListener('resize', () => { resizeCanvas(); requestAnimationFrame(draw); });

        // ★ 十字キーによるパンニング機能
        window.addEventListener('keydown', (e) => {
            // 入力要素にフォーカスがある場合は無効化
            if (document.activeElement && (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable)) return;

            // [基礎計算追加 Phase2] Escキーで基礎作図をキャンセル
            if (e.key === 'Escape' && getAppMode() === 'foundation') {
                fdDrawPoints = []; fdSelectedPillarLike = null;
                requestAnimationFrame(draw);
                return;
            }

            const step = 50;
            if (e.key === 'ArrowUp') { e.preventDefault(); offsetY -= step; requestAnimationFrame(draw); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); offsetY += step; requestAnimationFrame(draw); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); offsetX += step; requestAnimationFrame(draw); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); offsetX -= step; requestAnimationFrame(draw); }
        });

}
