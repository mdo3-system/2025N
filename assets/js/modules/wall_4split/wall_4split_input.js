/**
 * wall_4split_input.js - マウス・キーボード入力エントリーポイント
 * v2.3.25 リファクタリング
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

        // 右クリックによる入力取り消し (すべての要素に対応)
        if (e.button === 2) {
            const hasActiveInput = 
                (typeof selectedPillar !== 'undefined' && selectedPillar !== null) ||
                (typeof areaDrawPoints !== 'undefined' && areaDrawPoints.length > 0) ||
                (state && state.fdSelectedPillarLike) ||
                (state && state.fdDrawPoints && state.fdDrawPoints.length > 0);

            if (hasActiveInput) {
                e.preventDefault();
                e.stopPropagation();
                cancelDrawing();
                return;
            }
        }

        // 基礎モードへの委譲 (通り芯追加・通り芯削除・通り芯文字編集といった共通操作は委譲から除外して通常実行)
        if (state.currentAppMode === 'foundation' && e.button === 0 && !['add-grid', 'del-grid', 'edit-text'].includes(mode)) {
            if (window.FoundationInputController) window.FoundationInputController.handleMouseDown(e, state);
            return;
        }

        // ドラッグ（パン）開始
        // 左クリック時は、作図・選択・削除のいずれのモードでもない場合にのみドラッグを開始する
        const interactionModes = ['add-pillar', 'draw-area', 'select', 'delete-unified', 'wall', 'window', 'add-grid', 'del-grid', 'edit-text'];
        if (e.button === 1 || e.button === 2 || (e.button === 0 && !hoveredPillar && !interactionModes.includes(mode))) {
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
                handleGridInput(mode, state, mx, my);
            }
            // 通り芯文字の編集
            else if (mode === 'edit-text') {
                handleEditText(e, state);
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
        window.selectedPillar = null; // Clear visual highlight
    }
    window.AppController.refreshAll();
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

    console.log(`🗑️ Deletion Attempt: type=${hit.type}, id=${hit.item.id}`);

    if (hit.type === 'pillar') {
        const pid = hit.item.id;
        const affectedWalls = state.walls.filter(w => w.p1.id == pid || w.p2.id == pid);
        const affectedWins = state.windowsArr.filter(w => w.p1.id == pid || w.p2.id == pid);
        
        if (affectedWalls.length > 0 || affectedWins.length > 0) {
            if (!confirm(`この柱を削除すると、接続されている耐力壁(${affectedWalls.length}箇所)・開口部(${affectedWins.length}箇所)も削除されます。よろしいですか？`)) return;
        }

        hit.item.isDeleted = true;
        state.pillars = state.pillars.filter(p => p.id != pid);
        state.walls = state.walls.filter(w => w.p1.id != pid && w.p2.id != pid);
        state.windowsArr = state.windowsArr.filter(w => w.p1.id != pid && w.p2.id != pid);
        console.log(`✅ Pillar ${pid} and its connections deleted.`);

    } else if (hit.type === 'wall' || hit.item.outPanelId !== undefined) {
        // 耐力壁としての判定 (hit.type が 'wall' か、耐力壁特有のプロパティを持っている場合)
        const targetId = hit.item.id;
        state.walls = state.walls.filter(w => w.id != targetId);
        console.log(`✅ Wall ${targetId} deleted.`);

    } else if (hit.type === 'window' || hit.item.id !== undefined) {
        // 開口部としての判定 (hit.type が 'window' か、IDが存在する場合)
        const targetId = hit.item.id;
        state.windowsArr = state.windowsArr.filter(w => w.id != targetId);
        console.log(`✅ Window ${targetId} deleted.`);
    } else if (hit.type === 'area') {
        state.areaLines = state.areaLines.filter(a => a.id != hit.item.id);
        console.log(`✅ Area deleted.`);
    }

    window.AppController.refreshAll();
}

function handleGridInput(mode, state, clickX, clickY) {
    if (mode === 'add-grid') {
        const snapToModule = (val) => {
            const module = 455;
            const nearest = Math.round(val / module) * module;
            if (Math.abs(val - nearest) < 5) return nearest;
            return Math.round(val);
        };

        const axis = prompt("追加する通り芯の方向を入力してください (X または Y)", "X");
        if (!axis) return;
        const upAxis = axis.toUpperCase().trim();
        if (upAxis !== 'X' && upAxis !== 'Y') return;

        if (upAxis === 'X') {
            let bestGX = 0;
            let minDX = Infinity;
            if (state.gridXCoords && state.gridXCoords.length > 0) {
                state.gridXCoords.forEach(gx => {
                    let d = Math.abs(clickX - (gx * state.scale + state.offsetX));
                    if (d < minDX) { minDX = d; bestGX = gx; }
                });
            }

            // もし既存通り芯が遠すぎる（または無い）場合は、クリック地点を基準にする
            if (minDX > 100 || minDX === Infinity) {
                bestGX = snapToModule((clickX - state.offsetX) / state.scale);
            }

            const offsetStr = prompt(`基準位置 (座標: ${bestGX}) からのオフセット距離を入力してください (mm)\n右方向はプラス、左方向はマイナス`, "910");
            if (offsetStr === null) return;
            const offset = parseFloat(offsetStr);
            if (isNaN(offset)) return;

            const newGX = bestGX + offset;
            const name = prompt("追加するX通りの名称を入力してください", `X_${(state.manualGridX || []).length + 1}`);
            if (!name) return;

            if (!state.manualGridX) state.manualGridX = [];
            state.manualGridX.push({ coord: newGX, name: name.trim() });

            // 削除リストに入っていたら解除
            if (state.deletedGridX) {
                state.deletedGridX = state.deletedGridX.filter(dx => Math.abs(dx - newGX) > 5);
            }
        } else if (upAxis === 'Y') {
            let bestGY = 0;
            let minDY = Infinity;
            if (state.gridYCoords && state.gridYCoords.length > 0) {
                state.gridYCoords.forEach(gy => {
                    let d = Math.abs(clickY - (state.canvas.height - (gy * state.scale + state.offsetY)));
                    if (d < minDY) { minDY = d; bestGY = gy; }
                });
            }

            if (minDY > 100 || minDY === Infinity) {
                bestGY = snapToModule((state.canvas.height - clickY - state.offsetY) / state.scale);
            }

            const offsetStr = prompt(`基準位置 (座標: ${bestGY}) からのオフセット距離を入力してください (mm)\n上方向はプラス、下方向はマイナス`, "910");
            if (offsetStr === null) return;
            const offset = parseFloat(offsetStr);
            if (isNaN(offset)) return;

            const newGY = bestGY + offset;
            const name = prompt("追加するY通りの名称を入力してください", `Y_${(state.manualGridY || []).length + 1}`);
            if (!name) return;

            if (!state.manualGridY) state.manualGridY = [];
            state.manualGridY.push({ coord: newGY, name: name.trim() });

            // 削除リストに入っていたら解除
            if (state.deletedGridY) {
                state.deletedGridY = state.deletedGridY.filter(dy => Math.abs(dy - newGY) > 5);
            }
        }
        if (window.GridEngine) window.GridEngine.analyzeGrids(state);
        window.AppController.refreshAll();
    } else if (mode === 'del-grid') {
        // クリック位置に近いグリッドを検索
        let bestIX = -1, bestIY = -1, minDX = 20, minDY = 20;
        let targetVal = null, targetAxis = null;

        state.gridXCoords.forEach((gx, i) => { 
            let d = Math.abs(clickX - (gx * state.scale + state.offsetX)); 
            if(d < minDX){ minDX=d; bestIX=i; targetVal=gx; targetAxis='X'; } 
        });
        state.gridYCoords.forEach((gy, i) => { 
            let d = Math.abs(clickY - (state.canvas.height - (gy * state.scale + state.offsetY))); 
            if(d < minDY){ minDY=d; bestIY=i; targetVal=gy; targetAxis='Y'; } 
        });
        
        if (targetAxis) {
            // カスケード削除の対象（柱）を確認
            const affectedPillars = state.pillars.filter(p => !p.isDeleted && (targetAxis === 'X' ? p.x === targetVal : p.y === targetVal));
            
            const msg = affectedPillars.length > 0 
                ? `通り芯(${targetAxis}軸)を削除すると、配置されている柱(${affectedPillars.length}本)および関連する耐力壁・開口部も削除されます。\nよろしいですか？`
                : `通り芯(${targetAxis}軸)を削除します。よろしいですか？`;
            
            if (!confirm(msg)) return;

            // 1. 通り芯情報の論理/物理削除
            if (targetAxis === 'X') {
                if (!state.deletedGridX) state.deletedGridX = [];
                state.deletedGridX.push(targetVal);
                state.manualGridX = (state.manualGridX || []).filter(m => Math.abs(m.coord - targetVal) > 5);
            } else {
                if (!state.deletedGridY) state.deletedGridY = [];
                state.deletedGridY.push(targetVal);
                state.manualGridY = (state.manualGridY || []).filter(m => Math.abs(m.coord - targetVal) > 5);
            }

            // 2. 柱の論理削除
            const pillarIdsToRemove = new Set();
            state.pillars.forEach(p => {
                if (!p.isDeleted && (targetAxis === 'X' ? p.x === targetVal : p.y === targetVal)) {
                    p.isDeleted = true;
                    pillarIdsToRemove.add(p.id);
                }
            });

            // 3. 関連する耐力壁・開口部・基礎梁の物理削除
            if (pillarIdsToRemove.size > 0) {
                state.walls = state.walls.filter(w => !pillarIdsToRemove.has(w.p1.id) && !pillarIdsToRemove.has(w.p2.id));
                state.windowsArr = state.windowsArr.filter(w => !pillarIdsToRemove.has(w.p1.id) && !pillarIdsToRemove.has(w.p2.id));
                if (state.foundationBeams) {
                    state.foundationBeams = state.foundationBeams.filter(b => !pillarIdsToRemove.has(b.p1.id) && !pillarIdsToRemove.has(b.p2.id));
                }
            }
        }
    }
    window.AppController.refreshAll();
}

function handleEditText(e, state) {
    let bestGX = null, bestGY = null, minDX = 100, minDY = 100;
    let bestIX = -1, bestIY = -1;
    
    state.gridXCoords.forEach((gx, i) => { 
        let d = Math.abs(e.offsetX - (gx * state.scale + state.offsetX)); 
        if (d < minDX) { minDX = d; bestGX = gx; bestIX = i; } 
    });
    state.gridYCoords.forEach((gy, i) => { 
        let d = Math.abs(e.offsetY - (state.canvas.height - (gy * state.scale + state.offsetY))); 
        if (d < minDY) { minDY = d; bestGY = gy; bestIY = i; } 
    });
    
    if (bestGX !== null && (bestGY === null || minDX <= minDY)) {
        const oldName = state.gridXNames[bestIX] || '';
        const newName = prompt(`X通り (${Math.round(bestGX)} mm) の通り芯名を編集してください:`, oldName);
        if (newName !== null) {
            if (!state.userEditedGridX) state.userEditedGridX = {};
            state.userEditedGridX[bestGX] = newName.trim();
        }
    } else if (bestGY !== null) {
        const oldName = state.gridYNames[bestIY] || '';
        const newName = prompt(`Y通り (${Math.round(bestGY)} mm) の通り芯名を編集してください:`, oldName);
        if (newName !== null) {
            if (!state.userEditedGridY) state.userEditedGridY = {};
            state.userEditedGridY[bestGY] = newName.trim();
        }
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
    // 画面上で 40px 以内ならヒットとする (40 / scale [mm])
    const wallHitRadius = 40 / state.scale;
    const allWalls = [...state.walls, ...state.windowsArr].filter(w => w.floor === floor);
    for (const w of allWalls) {
        if (!w.p1 || !w.p2) continue;
        const dist = window.MathUtils.distToBeamLine(wp.x, wp.y, w.p1.x, w.p1.y, w.p2.x, w.p2.y);
        if (dist < wallHitRadius) {
            // ヒット判定時に、どちらの配列に属しているかを厳密に判定
            const isWall = state.walls.some(wall => wall.id === w.id);
            return { type: isWall ? 'wall' : 'window', item: w };
        }
    }

    // 3. 面積ポリゴン
    for (const a of state.areaLines.filter(a => a.floor === floor)) {
        if (window.MathUtils.isPointInPolygon(wp, a.vertices)) return { type: 'area', item: a };
    }

    return null;
}

function cancelDrawing() {
    areaDrawPoints = []; selectedPillar = null;
    const state = window.AppState;
    if (state) {
        state.fdDrawPoints = [];
        state.fdSelectedPillarLike = null;
    }
    window.AppController.refreshAll();
}
