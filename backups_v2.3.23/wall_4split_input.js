/**
 * wall_4split_input.js - マウス・キーボード入力エントリーポイント
 * v2.3.0 リファクタリング
 */

function initCanvasInput(canvas) {
    if (!canvas) return;

    // --- ズーム制御 ---
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const state = window.AppState;
        let zoomFactor = e.deltaY > 0 ? 1.15 : 0.87;
        let rect = canvas.getBoundingClientRect();
        let cx = e.clientX - rect.left, cy = e.clientY - rect.top;
        state.offsetX = cx - (cx - state.offsetX) * zoomFactor;
        state.offsetY = cy - (cy - state.offsetY) * zoomFactor;
        state.scale *= zoomFactor;
        window.AppController.refreshAll();
    }, { passive: false });

    // --- マウスダウン ---
    canvas.addEventListener('mousedown', (e) => {
        const state = window.AppState;
        const mode = getMode();

        // 基礎モードへの委譲
        if (state.currentAppMode === 'foundation' && e.button === 0) {
            if (window.FoundationInputController) window.FoundationInputController.handleMouseDown(e, state);
            return;
        }

        // ドラッグ（パン）開始
        if (e.button === 1 || e.button === 2 || (e.button === 0 && !hoveredPillar && !['add-pillar', 'draw-area', 'select', 'del-pillar'].includes(mode))) {
            isDragging = true; lastMouseX = e.clientX; lastMouseY = e.clientY;
            return;
        }

        if (e.button === 0) {
            const mx = e.offsetX, my = e.offsetY;
            // 統合選択モード
            if (mode === 'select') {
                handleSelectMode(e, state);
                return;
            }

            // 統合削除モード
            if (mode === 'delete-unified') {
                handleUnifiedDeletion(e, state);
                return;
            }


            // 耐力壁・開口配置
            if ((mode === 'wall' || mode === 'window') && hoveredPillar) {
                handleWallPillarInput(mode, state);
            }
            // 面積作図
            else if (mode === 'draw-area' && snapPoint) {
                handleAreaInput(state);
            }
            // 柱追加
            else if (mode === 'add-pillar' && snapPoint) {
                handleAddPillar(state);
            }
            // 通り芯追加・削除
            else if (mode === 'add-grid' || mode === 'del-grid') {
                handleGridInput(mode, state);
            }
        }
    });

    // --- マウスムーブ ---
    canvas.addEventListener('mousemove', (e) => {
        const state = window.AppState;
        state.mouseX = e.offsetX; state.mouseY = e.offsetY;

        if (isDragging) {
            state.offsetX += (e.clientX - lastMouseX);
            state.offsetY -= (e.clientY - lastMouseY);
            lastMouseX = e.clientX; lastMouseY = e.clientY;
            window.AppController.refreshAll();
            return;
        }

        if (state.currentAppMode === 'foundation') {
            if (window.FoundationInputController) window.FoundationInputController.handleMouseMove(e.offsetX, e.offsetY, state);
        } else {
            handleGeneralMouseMove(e.offsetX, e.offsetY, state);
        }
        window.AppController.refreshAll();
    });

    canvas.addEventListener('mouseup', () => isDragging = false);
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); cancelDrawing(); });

    // --- キーボード ---
    window.addEventListener('keydown', (e) => {
        if (document.activeElement && (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable)) return;
        if (e.key === 'Escape') cancelDrawing();
        // パンニング
        const step = 50;
        if (e.key === 'ArrowUp') window.AppState.offsetY -= step;
        else if (e.key === 'ArrowDown') window.AppState.offsetY += step;
        else if (e.key === 'ArrowLeft') window.AppState.offsetX += step;
        else if (e.key === 'ArrowRight') window.AppState.offsetX -= step;
        else return;
        window.AppController.refreshAll();
    });
}

/**
 * モード・入力関連のヘルパー (将来的に CanvasInputController へ移動可能)
 */

function handleSelectMode(e, state) {
    let hit = findHitElement(e.offsetX, e.offsetY, state);
    if (hit) {
        state.selectedElement = hit;
        window.PropertyController.openGeneralModal(hit);
    } else {
        state.selectedElement = null;
    }
}

function handleWallPillarInput(mode, state) {
    if (!selectedPillar) {
        selectedPillar = hoveredPillar;
    } else if (selectedPillar.id !== hoveredPillar.id) {
        const p1 = selectedPillar, p2 = hoveredPillar;
        const len = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (mode === 'wall') {
            const p1Id = document.getElementById('wall-p1')?.value || 'opt0';
            const p2Id = document.getElementById('wall-p2')?.value || 'opt0';
            const bId = document.getElementById('wall-b')?.value || 'b0';
            
            const nw = { 
                id: Date.now(), p1, p2, floor: state.currentFloor, 
                outPanelId: p1Id, inPanelId: p2Id, braceId: bId,
                totalVal: 0 // Will be updated by refreshAll -> WallEngine
            };
            state.walls.push(nw);
        } else {
            state.windowsArr.push({ id: Date.now(), p1, p2, floor: state.currentFloor });
        }
        selectedPillar = null;
        window.AppController.refreshAll();
    }
}

function handleAreaInput(state) {
    const pt = { x: snapPoint.x, y: snapPoint.y };
    const pts = areaDrawPoints;
    if (pts.length > 2 && pts[0].x === pt.x && pts[0].y === pt.y) {
        const aType = document.getElementById('area-type-select')?.value || 'floor';
        const na = { id: Date.now(), vertices: pts.map(p=>({x:p.x,y:p.y})), closed: true, floor: state.currentFloor, areaType: aType };
        state.areaLines.push(na);
        areaDrawPoints = [];
    } else {
        pts.push(pt);
    }
    window.AppController.refreshAll();
}

function handleAddPillar(state) {
    const np = { id: `M${pIdCounter++}`, x: snapPoint.x, y: snapPoint.y, floor: state.currentFloor, isManual: true };
    state.pillars.push(np);
    window.AppController.refreshAll();
}

function handleUnifiedDeletion(e, state) {
    const hit = findHitElement(e.offsetX, e.offsetY, state);
    if (!hit) return;

    if (hit.type === 'pillar') {
        hit.item.isDeleted = true;
    } else if (hit.type === 'wall') {
        state.walls = state.walls.filter(w => w.id !== hit.item.id);
    } else if (hit.type === 'window') {
        state.windowsArr = state.windowsArr.filter(w => w.id !== hit.item.id);
    } else if (hit.type === 'area') {
        state.areaLines = state.areaLines.filter(a => a.id !== hit.item.id);
    }

    window.AppController.refreshAll();
}

function handleGridInput(mode, state) {
    if (mode === 'add-grid') {
        // 近似グリッドを検索してオフセット
        let bestGX = null, bestGY = null, minDX = 200, minDY = 200;
        state.gridXCoords.forEach(gx => { let d = Math.abs(state.mouseX - (gx * state.scale + state.offsetX)); if(d < minDX){ minDX=d; bestGX=gx; } });
        state.gridYCoords.forEach(gy => { let d = Math.abs(state.mouseY - (state.canvas.height - (gy * state.scale + state.offsetY))); if(d < minDY){ minDY=d; bestGY=gy; } });
        
        if (bestGX !== null) {
            const newGX = bestGX + 910; // デフォルト 910mm
            state.gridXCoords.push(newGX);
            state.gridXNames.push('?');
        } else if (bestGY !== null) {
            const newGY = bestGY + 910;
            state.gridYCoords.push(newGY);
            state.gridYNames.push('?');
        }
    } else if (mode === 'del-grid') {
        // クリック位置に近いグリッドを削除
        let bestIX = -1, bestIY = -1, minDX = 20, minDY = 20;
        state.gridXCoords.forEach((gx, i) => { let d = Math.abs(state.mouseX - (gx * state.scale + state.offsetX)); if(d < minDX){ minDX=d; bestIX=i; } });
        state.gridYCoords.forEach((gy, i) => { let d = Math.abs(state.mouseY - (state.canvas.height - (gy * state.scale + state.offsetY))); if(d < minDY){ minDY=d; bestIY=i; } });
        
        if (bestIX !== -1) { state.gridXCoords.splice(bestIX, 1); state.gridXNames.splice(bestIX, 1); }
        if (bestIY !== -1) { state.gridYCoords.splice(bestIY, 1); state.gridYNames.splice(bestIY, 1); }
    }
    window.AppController.refreshAll();
}

function handleGeneralMouseMove(mx, my, state) {
    hoveredPillar = null; snapPoint = null;
    const toC = (x, y) => ({ cx: x * state.scale + state.offsetX, cy: state.canvas.height - (y * state.scale + state.offsetY) });
    
    // 柱ホバー判定
    for (const p of state.pillars.filter(p => !p.isDeleted && p.floor === state.currentFloor)) {
        const pt = toC(p.x, p.y);
        if (Math.hypot(mx - pt.cx, my - pt.cy) < 20) { hoveredPillar = p; break; }
    }
    // スナップ点計算
    const mode = getMode();
    if (['add-pillar', 'draw-area'].includes(mode)) {
        let bestD = 30;
        state.gridXCoords.forEach(gx => state.gridYCoords.forEach(gy => {
            const pt = toC(gx, gy);
            const d = Math.hypot(mx - pt.cx, my - pt.cy);
            if (d < bestD) { bestD = d; snapPoint = { x: gx, y: gy }; }
        }));
    }
}

function findHitElement(mx, my, state) {
    const wp = { x: (mx - state.offsetX) / state.scale, y: (state.canvas.height - my - state.offsetY) / state.scale };
    const floor = state.currentFloor;

    // 1. 柱 (判定優先度 高)
    // 画面上で 20px 以内ならヒットとする (20 / scale [mm])
    const pillarHitRadius = 20 / state.scale;
    for (const p of state.pillars.filter(p => !p.isDeleted && (p.floor === floor || p.floor === 'ALL'))) {
        if (Math.hypot(wp.x - p.x, wp.y - p.y) < pillarHitRadius) return { type: 'pillar', item: p };
    }

    // 2. 耐力壁・開口部
    // 画面上で 15px 以内ならヒットとする
    const wallHitRadius = 15 / state.scale;
    const allWalls = [...state.walls, ...state.windowsArr].filter(w => w.floor === floor);
    for (const w of allWalls) {
        if (!w.p1 || !w.p2) continue;
        const dist = window.MathUtils.distToBeamLine(wp.x, wp.y, w.p1.x, w.p1.y, w.p2.x, w.p2.y);
        if (dist < wallHitRadius) return { type: (state.walls.includes(w) ? 'wall' : 'window'), item: w };
    }

    // 3. 面積ポリゴン
    for (const a of state.areaLines.filter(a => a.floor === floor)) {
        if (window.MathUtils.isPointInPolygon(wp, a.vertices)) return { type: 'area', item: a };
    }

    return null;
}

function cancelDrawing() {
    areaDrawPoints = []; selectedPillar = null;
    window.AppController.refreshAll();
}
