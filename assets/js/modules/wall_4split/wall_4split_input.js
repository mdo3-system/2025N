/**
 * wall_4split_input.js - マウス・キーボード入力エントリーポイント
 * v2.3.25 リファクタリング
 */

// Removed local diagGridPoints, now handled in state.diagGridPoints

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
                (state && state.fdDrawPoints && state.fdDrawPoints.length > 0) ||
                (state && state.roofDrawPoints && state.roofDrawPoints.length > 0);

            if (hasActiveInput) {
                e.preventDefault();
                e.stopPropagation();
                cancelDrawing();
                return;
            }
        }

        // 基礎モードへの委譲、または共通操作の「外壁線を引く」モードの場合
        if ((state.currentAppMode === 'foundation' || mode === 'draw-ext-wall') && e.button === 0 && !['add-grid', 'del-grid', 'edit-text', 'add-diag-grid', 'roof-add-grid', 'roof-del-grid'].includes(mode)) {
            const prevFdMode = state.foundationMode;
            if (mode === 'draw-ext-wall') state.foundationMode = 'f_ext_wall';
            if (window.FoundationInputController) window.FoundationInputController.handleMouseDown(e, state);
            if (mode === 'draw-ext-wall') state.foundationMode = prevFdMode;
            return;
        }

        // 屋根モードへの委譲
        if (state.currentAppMode === 'roof' && e.button === 0 && !['add-grid', 'del-grid', 'edit-text', 'add-diag-grid', 'roof-add-grid', 'roof-del-grid'].includes(mode)) {
            if (window.RoofInputController) window.RoofInputController.handleMouseDown(e, state);
            return;
        }

        // ドラッグ（パン）開始
        // 左クリック時は、作図・選択・削除のいずれのモードでもない場合にのみドラッグを開始する
        const interactionModes = ['add-pillar', 'draw-area', 'select', 'delete-unified', 'wall', 'window', 'add-grid', 'del-grid', 'add-diag-grid', 'edit-text', 'roof-add-grid', 'roof-del-grid'];
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
            // 屋根用通り芯追加・削除 [v2.7.3]
            else if (mode === 'roof-add-grid' || mode === 'roof-del-grid') {
                const roofModeConverted = mode === 'roof-add-grid' ? 'add-grid' : 'del-grid';
                handleRoofGridInput(roofModeConverted, state, mx, my);
            }
            // 通り芯文字の編集
            else if (mode === 'edit-text') {
                handleEditText(e, state);
            }
            // [v2.5.0] 斜め通り芯追加
            else if (mode === 'add-diag-grid' && snapPoint) {
                handleDiagGridInput(state);
            }
        }
    });

    // --- マウスムーブ ---
    canvas.addEventListener('mousemove', (e) => {
        const state = window.AppState;
        const mode = getMode();
        state.mouseX = e.offsetX; state.mouseY = e.offsetY;

        if (isDragging) {
            state.offsetX += (e.clientX - lastMouseX);
            state.offsetY -= (e.clientY - lastMouseY);
            lastMouseX = e.clientX; lastMouseY = e.clientY;
            window.AppController.refreshAll();
            return;
        }

        if (state.currentAppMode === 'foundation' || mode === 'draw-ext-wall') {
            const prevFdMode = state.foundationMode;
            if (mode === 'draw-ext-wall') state.foundationMode = 'f_ext_wall';
            if (window.FoundationInputController) window.FoundationInputController.handleMouseMove(e.offsetX, e.offsetY, state);
            if (mode === 'draw-ext-wall') state.foundationMode = prevFdMode;
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

    } else if (hit.type === 'wall') {
        // 耐力壁としての判定 (hit.type が 'wall' の場合のみ処理)
        const targetId = hit.item.id;
        state.walls = state.walls.filter(w => w.id != targetId);
        console.log(`✅ Wall ${targetId} deleted.`);

    } else if (hit.type === 'window') {
        // 開口部としての判定 (hit.type が 'window' の場合のみ処理)
        const targetId = hit.item.id;
        state.windowsArr = state.windowsArr.filter(w => w.id != targetId);
        console.log(`✅ Window ${targetId} deleted.`);
    } else if (hit.type === 'area') {
        if (!confirm(`床面積 (${hit.item.areaType || 'floor'}) を削除しますか？`)) return;
        
        // 1. [v2.5.16 強化] 重複して描画されている背景線（CADポリライン＋単体LINEセグメント両対応）の完全除去
        if (hit.item.vertices && state.bgLinesOriginal) {
            const targetV = hit.item.vertices;
            state.bgLinesOriginal = state.bgLinesOriginal.filter(bgL => {
                if (!bgL.vertices || bgL.vertices.length < 2) return true;

                // 1-a. LWPOLYLINE/POLYLINE として頂点数も一致し、座標群がほぼ一致する場合
                if (bgL.vertices.length === targetV.length) {
                    let allMatch = true;
                    for (let k = 0; k < targetV.length; k++) {
                        if (Math.abs(bgL.vertices[k].x - targetV[k].x) > 10 || Math.abs(bgL.vertices[k].y - targetV[k].y) > 10) {
                            allMatch = false;
                            break;
                        }
                    }
                    if (allMatch) return false; // 一致した場合は背景から削除
                }

                // 1-b. 背景要素が単体 LINE (2頂点) の場合、対象ポリゴンのいずれかの辺(Edge)とぴったり重なるか判定
                if (bgL.vertices.length === 2) {
                    const bp1 = bgL.vertices[0];
                    const bp2 = bgL.vertices[1];
                    for (let i = 0; i < targetV.length; i++) {
                        const tp1 = targetV[i];
                        const tp2 = targetV[(i + 1) % targetV.length];
                        
                        // 順方向の一致判定 (許容誤差 15mm)
                        const matchNormal = (Math.hypot(bp1.x - tp1.x, bp1.y - tp1.y) < 15 && Math.hypot(bp2.x - tp2.x, bp2.y - tp2.y) < 15);
                        // 逆方向の一致判定 (許容誤差 15mm)
                        const matchReverse = (Math.hypot(bp1.x - tp2.x, bp1.y - tp2.y) < 15 && Math.hypot(bp2.x - tp1.x, bp2.y - tp1.y) < 15);
                        
                        if (matchNormal || matchReverse) {
                            return false; // 背景の該当する一辺を削除
                        }
                    }
                }
                return true;
            });
            // キャッシュ更新フラグを立てる
            if (window.AppController && window.AppController.rebuildBgBuffer) {
                 // もし背景キャッシュ化があれば再構築 (今回は無し、refreshAll内で処理される)
            }
        }

        // 2. 構造データの床面積を削除
        state.areaLines = state.areaLines.filter(a => a !== hit.item);
        console.log(`✅ Area deleted along with associated background lines.`);

        // 3. 全ての該当タイプのポリゴンが削除された場合は入力値を0にリセットする
        const f = hit.item.floor;
        const type = hit.item.areaType || 'floor';
        const remaining = state.areaLines.filter(a => a.floor === f && (a.areaType || 'floor') === type);
        if (remaining.length === 0) {
            const lv = f ? f.charAt(0) : '1';
            let inputId = '';
            if (type === 'floor') inputId = 'a-f' + lv;
            else if (type === 'attic') inputId = 'a-attic' + lv;
            else if (type === 'balcony') inputId = 'a-balcony' + lv;
            else if (type === 'porch') inputId = 'a-porch' + lv;
            else if (type === 'void') inputId = 'a-void' + lv;
            
            const el = document.getElementById(inputId);
            if (el) {
                el.value = "0.00";
                console.log(`✅ Reset area input ${inputId} to 0.00 since last polygon was deleted.`);
            }
        }
    } else if (hit.type === 'diag-grid') {
        if (!confirm(`斜め通り芯 (${hit.item.name || 'DA'}) を削除しますか？`)) return;
        state.manualGridAngle = state.manualGridAngle.filter(g => g.id !== hit.item.id);
        console.log(`✅ Diagonal Grid deleted via unified tool.`);
    } else if (hit.type === 'ext_wall') {
        if (!confirm("外壁線を削除しますか？")) return;
        state.exteriorWalls = state.exteriorWalls.filter(ew => ew.id !== hit.item.id);
        console.log(`✅ Exterior Wall ${hit.item.id} deleted via unified tool.`);
    }
    window.AppController.refreshAll();
}

function handleRoofGridInput(mode, state, clickX, clickY) {
    const snapToModule = (val) => {
        const module = 455;
        const nearest = Math.round(val / module) * module;
        if (Math.abs(val - nearest) < 5) return nearest;
        return Math.round(val);
    };

    if (!window.GridEngine) return;
    const roofGrids = window.GridEngine.getRoofGrids(state);

    if (mode === 'add-grid') {
        const axis = prompt("追加する屋根通り芯の方向を入力してください (X または Y)", "X");
        if (!axis) return;
        const upAxis = axis.toUpperCase().trim();
        if (upAxis !== 'X' && upAxis !== 'Y') return;

        if (upAxis === 'X') {
            let bestGX = 0;
            let minDX = Infinity;
            if (roofGrids.x.length > 0) {
                roofGrids.x.forEach(gx => {
                    let d = Math.abs(clickX - (gx * state.scale + state.offsetX));
                    if (d < minDX) { minDX = d; bestGX = gx; }
                });
            }
            if (minDX > 100 || minDX === Infinity) {
                bestGX = snapToModule((clickX - state.offsetX) / state.scale);
            }

            const offsetStr = prompt(`屋根基準位置 (座標: ${bestGX}) からのオフセット距離を入力してください (mm)\n右方向はプラス、左方向はマイナス`, "910");
            if (offsetStr === null) return;
            const offset = parseFloat(offsetStr);
            if (isNaN(offset)) return;

            const typeStr = prompt("追加する屋根用グリッドのタイプを入力してください\n1: 軒の出\n2: ケラバの出\n3: その他", "1");
            let type = 'other';
            if (typeStr === '1') type = 'eaves';
            else if (typeStr === '2') type = 'keraba';

            const newGX = bestGX + offset;
            const countX = (state.roofGridManualX || []).length + 1;
            const defaultNameX = type === 'eaves' ? `${countX} 軒の出` : (type === 'keraba' ? `${countX} ケラバの出` : `${countX} その他`);
            const name = prompt("追加する屋根X通りの名称を入力してください", defaultNameX);
            if (!name) return;

            if (!state.roofGridManualX) state.roofGridManualX = [];
            state.roofGridManualX.push({ coord: newGX, name: name.trim(), type: type, val: offset });
        } else {
            let bestGY = 0;
            let minDY = Infinity;
            if (roofGrids.y.length > 0) {
                roofGrids.y.forEach(gy => {
                    let d = Math.abs(clickY - (state.canvas.height - (gy * state.scale + state.offsetY)));
                    if (d < minDY) { minDY = d; bestGY = gy; }
                });
            }
            if (minDY > 100 || minDY === Infinity) {
                bestGY = snapToModule((state.canvas.height - clickY - state.offsetY) / state.scale);
            }

            const offsetStr = prompt(`屋根基準位置 (座標: ${bestGY}) からのオフセット距離を入力してください (mm)\n上方向はプラス、下方向はマイナス`, "910");
            if (offsetStr === null) return;
            const offset = parseFloat(offsetStr);
            if (isNaN(offset)) return;

            const typeStr = prompt("追加する屋根用グリッドのタイプを入力してください\n1: 軒の出\n2: ケラバの出\n3: その他", "1");
            let type = 'other';
            if (typeStr === '1') type = 'eaves';
            else if (typeStr === '2') type = 'keraba';

            const newGY = bestGY + offset;
            const countY = (state.roofGridManualY || []).length + 1;
            const defaultNameY = type === 'eaves' ? `${countY} 軒の出` : (type === 'keraba' ? `${countY} ケラバの出` : `${countY} その他`);
            const name = prompt("追加する屋根Y通りの名称を入力してください", defaultNameY);
            if (!name) return;

            if (!state.roofGridManualY) state.roofGridManualY = [];
            state.roofGridManualY.push({ coord: newGY, name: name.trim(), type: type, val: offset });
        }
    } else if (mode === 'del-grid') {
        let bestIX = -1, bestIY = -1, minD = 20;
        let targetVal = null, targetAxis = null;

        roofGrids.x.forEach((gx, i) => {
            let d = Math.abs(clickX - (gx * state.scale + state.offsetX));
            if (d < minD) { minD = d; bestIX = i; targetVal = gx; targetAxis = 'X'; }
        });
        roofGrids.y.forEach((gy, i) => {
            let d = Math.abs(clickY - (state.canvas.height - (gy * state.scale + state.offsetY)));
            if (d < minD) { minD = d; bestIY = i; targetVal = gy; targetAxis = 'Y'; }
        });

        if (targetAxis) {
            if (!confirm(`屋根通り芯 (${targetAxis}軸: ${Math.round(targetVal)}mm) を削除しますか？`)) return;

            if (targetAxis === 'X') {
                state.roofGridManualX = (state.roofGridManualX || []).filter(m => Math.abs(m.coord - targetVal) > 5);
            } else {
                state.roofGridManualY = (state.roofGridManualY || []).filter(m => Math.abs(m.coord - targetVal) > 5);
            }
        }
    }
    window.AppController.refreshAll();
}

function handleGridInput(mode, state, clickX, clickY) {
    if (state.currentAppMode === 'roof') {
        handleRoofGridInput(mode, state, clickX, clickY);
        return;
    }
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
        const toC = (x, y) => ({ cx: x * state.scale + state.offsetX, cy: state.canvas.height - (y * state.scale + state.offsetY) });
        let bestIX = -1, bestIY = -1, minD = 20;
        let targetVal = null, targetAxis = null;
        let targetDiag = null;

        // X/Y検索
        state.gridXCoords.forEach((gx, i) => { 
            let d = Math.abs(clickX - (gx * state.scale + state.offsetX)); 
            if(d < minD){ minD=d; bestIX=i; targetVal=gx; targetAxis='X'; } 
        });
        state.gridYCoords.forEach((gy, i) => { 
            let d = Math.abs(clickY - (state.canvas.height - (gy * state.scale + state.offsetY))); 
            if(d < minD){ minD=d; bestIY=i; targetVal=gy; targetAxis='Y'; } 
        });

        // 斜め通り芯検索
        if (state.manualGridAngle) {
            state.manualGridAngle.forEach(g => {
                const c1 = toC(g.p1.x, g.p1.y), c2 = toC(g.p2.x, g.p2.y);
                const dx = c2.cx - c1.cx, dy = c2.cy - c1.cy;
                const den = Math.hypot(dx, dy);
                if (den < 5) return;
                const dist = Math.abs(dy * clickX - dx * clickY + c2.cx * c1.cy - c2.cy * c1.cx) / den;
                if (dist < minD) { minD = dist; targetDiag = g; targetAxis = 'Diag'; }
            });
        }
        
        if (targetAxis) {
            if (targetAxis === 'Diag' && targetDiag) {
                if (!confirm(`斜め通り芯 (${targetDiag.name || 'DA'}) を削除しますか？`)) return;
                state.manualGridAngle = state.manualGridAngle.filter(g => g.id !== targetDiag.id);
            } else {
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
}
    window.AppController.refreshAll();
}

function handleEditText(e, state) {
    const toC = (x, y) => ({ cx: x * state.scale + state.offsetX, cy: state.canvas.height - (y * state.scale + state.offsetY) });
    
    let bestGX = null, bestGY = null, bestDiag = null;
    let minD = 20; // 統合距離閾値（px）
    let winnerType = null;
    let bestIX = -1, bestIY = -1;
    
    // 1. X通りチェック
    state.gridXCoords.forEach((gx, i) => { 
        let d = Math.abs(e.offsetX - (gx * state.scale + state.offsetX)); 
        if (d < minD) { minD = d; bestGX = gx; bestIX = i; winnerType = 'X'; } 
    });
    // 2. Y通りチェック
    state.gridYCoords.forEach((gy, i) => { 
        let d = Math.abs(e.offsetY - (state.canvas.height - (gy * state.scale + state.offsetY))); 
        if (d < minD) { minD = d; bestGY = gy; bestIY = i; winnerType = 'Y'; } 
    });
    // 3. 斜め通り芯チェック
    if (state.manualGridAngle) {
        state.manualGridAngle.forEach(g => {
            const c1 = toC(g.p1.x, g.p1.y), c2 = toC(g.p2.x, g.p2.y);
            const dx = c2.cx - c1.cx, dy = c2.cy - c1.cy;
            const den = Math.hypot(dx, dy);
            if (den < 5) return;
            const dist = Math.abs(dy * e.offsetX - dx * e.offsetY + c2.cx * c1.cy - c2.cy * c1.cx) / den;
            if (dist < minD) { minD = dist; bestDiag = g; winnerType = 'Diag'; }
        });
    }
    
    if (winnerType === 'X' && bestGX !== null) {
        const oldName = state.gridXNames[bestIX] || '';
        const newName = prompt(`X通り (${Math.round(bestGX)} mm) の通り芯名を編集してください:`, oldName);
        if (newName !== null) {
            if (!state.userEditedGridX) state.userEditedGridX = {};
            state.userEditedGridX[bestGX] = newName.trim();
        }
    } else if (winnerType === 'Y' && bestGY !== null) {
        const oldName = state.gridYNames[bestIY] || '';
        const newName = prompt(`Y通り (${Math.round(bestGY)} mm) の通り芯名を編集してください:`, oldName);
        if (newName !== null) {
            if (!state.userEditedGridY) state.userEditedGridY = {};
            state.userEditedGridY[bestGY] = newName.trim();
        }
    } else if (winnerType === 'Diag' && bestDiag) {
        const oldName = bestDiag.name || '';
        const newName = prompt(`斜め通り芯 (${oldName}) の名称を編集してください:`, oldName);
        if (newName !== null) {
            bestDiag.name = newName.trim();
        }
    }
    window.AppController.refreshAll();
}

function handleGeneralMouseMove(mx, my, state) {
    hoveredPillar = null; snapPoint = null;
    const toC = (x, y) => {
        const pt = window.toCanvasPixel(x, y);
        return { cx: pt.cx, cy: pt.cy };
    };
    
    // 柱ホバー判定
    for (const p of state.pillars.filter(p => !p.isDeleted && p.floor === state.currentFloor)) {
        const pt = toC(p.x, p.y);
        if (Math.hypot(mx - pt.cx, my - pt.cy) < 20) { hoveredPillar = p; break; }
    }
    // スナップ点計算
    const mode = getMode();
    if (['add-pillar', 'draw-area', 'add-diag-grid', 'draw-roof', 'set-slope-line'].includes(mode)) {
        let bestD = 30;
        // 1. 柱からのスナップ
        for (const p of state.pillars.filter(p => !p.isDeleted && p.floor === state.currentFloor)) {
            const pt = toC(p.x, p.y);
            const d = Math.hypot(mx - pt.cx, my - pt.cy);
            if (d < bestD) { bestD = d; snapPoint = { x: p.x, y: p.y }; }
        }
        // 2. 通り芯交点からのスナップ
        let xs = state.gridXCoords || [];
        let ys = state.gridYCoords || [];
        if (state.currentAppMode === 'roof' && window.GridEngine) {
            const roofGrids = window.GridEngine.getRoofGrids(state);
            xs = roofGrids.x;
            ys = roofGrids.y;
        }

        xs.forEach(gx => ys.forEach(gy => {
            const pt = toC(gx, gy);
            const d = Math.hypot(mx - pt.cx, my - pt.cy);
            if (d < bestD) { bestD = d; snapPoint = { x: gx, y: gy }; }
        }));
    }
}

function findHitElement(mx, my, state) {
    const wp = window.toWorldCoord(mx, my);
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
        if (!a.vertices || a.vertices.length < 2) continue;
        
        // 3-a. 内部判定 (クリックが中にある場合)
        if (window.MathUtils.isPointInPolygon(wp, a.vertices)) return { type: 'area', item: a };
        
        // 3-b. 境界線（エッジ）判定 [v2.5.14 追加] - ユーザーは枠線をクリックしたいため
        const edgeTolerance = 25 / state.scale;
        const len = a.vertices.length;
        for (let i = 0; i < len; i++) {
            const p1 = a.vertices[i];
            const p2 = a.vertices[(i + 1) % len];
            if (!p1 || !p2) continue;
            const dist = window.MathUtils.distToBeamLine(wp.x, wp.y, p1.x, p1.y, p2.x, p2.y);
            if (dist < edgeTolerance) return { type: 'area', item: a };
        }
    }

    // 3.5. 外壁線
    const extWallHitRadius = 25 / state.scale;
    const activeFloor = state.currentFloor;
    for (const ew of (state.exteriorWalls || []).filter(ew => ew.floor === activeFloor)) {
        if (!ew.vertices || ew.vertices.length < 2) continue;
        const vts = ew.closed ? [...ew.vertices, ew.vertices[0]] : ew.vertices;
        for (let i = 0; i < vts.length - 1; i++) {
            const dist = window.MathUtils.distToBeamLine(wp.x, wp.y, vts[i].x, vts[i].y, vts[i+1].x, vts[i+1].y);
            if (dist < extWallHitRadius) return { type: 'ext_wall', item: ew };
        }
    }

    // 4. 斜め通り芯 (判定優先度 低め) [v2.5.13]
    if (state.manualGridAngle) {
        const diagHitRadius = 25 / state.scale; // 25px 程度の余裕
        for (const g of state.manualGridAngle) {
            const A = g.p2.y - g.p1.y;
            const B = g.p1.x - g.p2.x;
            const C = g.p1.y * g.p2.x - g.p1.x * g.p2.y;
            const len = Math.hypot(A, B);
            if (len > 0) {
                const dist = Math.abs(A * wp.x + B * wp.y + C) / len;
                if (dist < diagHitRadius) return { type: 'diag-grid', item: g };
            }
        }
    }

    return null;
}

function cancelDrawing() {
    areaDrawPoints = []; selectedPillar = null; 
    const state = window.AppState;
    if (state) {
        state.diagGridPoints = [];
        state.fdDrawPoints = [];
        state.fdSelectedPillarLike = null;
        state.roofDrawPoints = [];
        state.roofTempSlopeLine = [];
        state.roofDrawingStep = 'polygon';
    }
    window.AppController.refreshAll();
}
function handleDiagGridInput(state) {
    if (!snapPoint) return;
    if (!state.diagGridPoints) state.diagGridPoints = [];
    state.diagGridPoints.push({ x: snapPoint.x, y: snapPoint.y });
    
    if (state.diagGridPoints.length === 2) {
        const p1 = state.diagGridPoints[0];
        const p2 = state.diagGridPoints[1];
        
        // 同一点チェック
        if (Math.hypot(p1.x - p2.x, p1.y - p2.y) > 5) {
            if (!state.manualGridAngle) state.manualGridAngle = [];
            const id = Date.now();
            // 連番のデフォルト名生成
            const count = state.manualGridAngle.length + 1;
            const name = "DA" + count; 
            
            state.manualGridAngle.push({ id, name, p1, p2 });
            console.log(`📐 Added Diagonal Grid: ${name}`);
        }
        state.diagGridPoints = []; // リセット
    }
    window.AppController.refreshAll();
}
