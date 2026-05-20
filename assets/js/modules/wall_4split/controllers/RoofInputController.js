/**
 * controllers/RoofInputController.js - Roof Face Input controller
 * v2.7.0 New Implementation
 */

window.RoofInputController = {
    /**
     * Mouse down handler in roof mode
     */
    handleMouseDown: function(e, state) {
        const mode = window.getMode();
        if (mode === 'draw-roof') {
            this.handleDrawRoofClick(state);
        } else if (mode === 'delete-roof') {
            this.handleDeleteRoofClick(e, state);
        }
    },

    /**
     * Polygon vertices and slope line drawing state machine
     */
    handleDrawRoofClick: function(state) {
        if (!window.snapPoint) return;
        const pt = { x: window.snapPoint.x, y: window.snapPoint.y };

        if (!state.roofDrawingStep) state.roofDrawingStep = 'polygon';
        if (!state.roofDrawPoints) state.roofDrawPoints = [];
        if (!state.roofTempSlopeLine) state.roofTempSlopeLine = [];

        if (state.roofDrawingStep === 'polygon') {
            const pts = state.roofDrawPoints;
            // Check if we are closing the polygon
            if (pts.length > 2 && Math.hypot(pts[0].x - pt.x, pts[0].y - pt.y) < 5) {
                // Closed the polygon! Now switch to selecting the slope line
                state.roofDrawingStep = 'slope-line';
                alert("屋根面が閉じられました。\n次に、基準となる桁線を指定してください。\n1点目: 桁線の始点\n2点目: 桁線の終点\n3点目: 勾配の上り方向（高い側）の点");
            } else {
                pts.push(pt);
            }
        } else if (state.roofDrawingStep === 'slope-line') {
            const line = state.roofTempSlopeLine;
            if (line.length === 0) {
                line.push(pt);
                alert("桁線の1点目（始点）を設定しました。次に、桁線の2点目（終点）をクリックしてください。");
            } else if (line.length === 1) {
                // Ensure same point is not clicked
                if (Math.hypot(line[0].x - pt.x, line[0].y - pt.y) < 5) {
                    alert("同じ点は選択できません。別の点を選択してください。");
                    return;
                }
                line.push(pt);
                alert("桁線を設定しました。次に、勾配の上り方向（高い側）の点をクリックしてください。");
            } else if (line.length === 2) {
                // Same point validation
                if (Math.hypot(line[0].x - pt.x, line[0].y - pt.y) < 5 || Math.hypot(line[1].x - pt.x, line[1].y - pt.y) < 5) {
                    alert("桁線と同じ点は選択できません。勾配の高い方向にある点を選択してください。");
                    return;
                }
                line.push(pt);
                
                // Both are set! Show property popup!
                this.showPropertyPopup(state);
            }
        }
        window.AppController.refreshAll();
    },

    /**
     * Delete roof face handler
     */
    handleDeleteRoofClick: function(e, state) {
        const mx = e.offsetX;
        const my = e.offsetY;
        
        // Find which roof face polygon contains the click point using inside-polygon test
        const toC = (x, y) => ({ cx: x * state.scale + state.offsetX, cy: state.canvas.height - (y * state.scale + state.offsetY) });
        
        let hitFace = null;
        let bestArea = Infinity;

        const faces = state.roofFaces || [];
        faces.forEach(face => {
            const canvasPts = face.vertices.map(v => toC(v.x, v.y));
            if (this.isPointInPolygon(mx, my, canvasPts)) {
                const area = window.RoofEngine.calculatePolygonArea2D(face.vertices.map(v => ({ u: v.x/1000, v: v.y/1000 })));
                if (area < bestArea) {
                    bestArea = area;
                    hitFace = face;
                }
            }
        });

        if (hitFace) {
            if (confirm(`屋根面 (${hitFace.label || '屋根'}) を削除しますか？`)) {
                state.roofFaces = state.roofFaces.filter(f => f.id !== hitFace.id);
                window.AppController.refreshAll();
            }
        }
    },

    isPointInPolygon: function(x, y, vs) {
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].cx, yi = vs[i].cy;
            const xj = vs[j].cx, yj = vs[j].cy;
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    },

    /**
     * Show floating properties popup for the drawn roof face
     */
    showPropertyPopup: function(state) {
        const popup = document.getElementById('roof-property-popup');
        const content = document.getElementById('roof-popup-content');
        if (!popup || !content) {
            this.handlePropertyFallback(state);
            return;
        }

        const defaultLabel = `R${(state.roofFaces || []).length + 1}`;
        
        content.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px; font-size:12px; color:#2c3e50;">
                <div class="calc-row" style="display:flex; justify-content:space-between; align-items:center;">
                    <label style="font-weight:bold; width:150px;">屋根面の名称</label>
                    <input type="text" id="prop-roof-label" value="${defaultLabel}" style="width:160px; padding:4px; box-sizing:border-box;">
                </div>
                <div class="calc-row" style="display:flex; justify-content:space-between; align-items:center;">
                    <label style="font-weight:bold; width:150px;">屋根勾配 (寸)</label>
                    <input type="number" id="prop-roof-slope" value="4.5" step="0.1" min="0" style="width:160px; padding:4px; box-sizing:border-box; text-align:right;">
                </div>
                <div class="calc-row" style="display:flex; justify-content:space-between; align-items:center;">
                    <label style="font-weight:bold; width:150px;">屋根厚さ (mm)</label>
                    <input type="number" id="prop-roof-thickness" value="150" step="10" min="0" style="width:160px; padding:4px; box-sizing:border-box; text-align:right;">
                </div>
                <div class="calc-row" style="display:flex; justify-content:space-between; align-items:center;">
                    <label style="font-weight:bold; width:150px;">基準高からの増減 (mm)</label>
                    <input type="number" id="prop-roof-delta" value="0" step="50" style="width:160px; padding:4px; box-sizing:border-box; text-align:right;">
                </div>
                <div class="calc-row" style="display:flex; justify-content:space-between; align-items:center;">
                    <label style="font-weight:bold; width:150px;">所属階</label>
                    <select id="prop-roof-floor" style="width:160px; padding:4px; box-sizing:border-box;">
                        <option value="2F" ${state.currentFloor === '2F' ? 'selected' : ''}>2階屋根 (標準)</option>
                        <option value="1F" ${state.currentFloor === '1F' ? 'selected' : ''}>1階屋根 (下屋など)</option>
                    </select>
                </div>
                <div style="margin-top:15px; display:flex; gap:10px; justify-content:flex-end;">
                    <button type="button" id="btn-roof-popup-cancel" style="padding:6px 12px; background:#bdc3c7; color:#2c3e50; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">キャンセル</button>
                    <button type="button" id="btn-roof-popup-save" style="padding:6px 12px; background:#2980b9; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">💾 屋根面を登録</button>
                </div>
            </div>
        `;

        // Set floating popup center
        popup.style.display = 'block';
        popup.style.left = '50%';
        popup.style.top = '50%';
        popup.style.transform = 'translate(-50%, -50%)';

        // Bind events
        document.getElementById('btn-roof-popup-cancel').onclick = () => {
            this.cancelDrawing(state);
            popup.style.display = 'none';
        };

        document.getElementById('btn-roof-popup-save').onclick = () => {
            const label = document.getElementById('prop-roof-label').value.trim() || defaultLabel;
            const slope = parseFloat(document.getElementById('prop-roof-slope').value) || 0;
            const thickness = parseFloat(document.getElementById('prop-roof-thickness').value) || 150;
            const delta = parseFloat(document.getElementById('prop-roof-delta').value) || 0;
            const floor = document.getElementById('prop-roof-floor').value;

            const face = {
                id: Date.now(),
                label: label,
                vertices: [...state.roofDrawPoints],
                slopeLine: [...state.roofTempSlopeLine],
                slope: slope,
                roofThickness: thickness,
                baseHeightDelta: delta,
                floor: floor
            };

            if (!state.roofFaces) state.roofFaces = [];
            state.roofFaces.push(face);

            // Clear temp states
            state.roofDrawPoints = [];
            state.roofTempSlopeLine = [];
            state.roofDrawingStep = 'polygon';

            popup.style.display = 'none';
            window.AppController.refreshAll();
        };
    },

    handlePropertyFallback: function(state) {
        const label = prompt("屋根面の名称を入力してください", `R${(state.roofFaces || []).length + 1}`) || `R${(state.roofFaces || []).length + 1}`;
        const slopeStr = prompt("屋根勾配を「寸」で入力してください (例: 4.5)", "4.5");
        const thicknessStr = prompt("屋根厚みを「mm」で入力してください", "150");
        const deltaStr = prompt("基準高からの増減を「mm」で入力してください (基本: 0)", "0");

        const slope = parseFloat(slopeStr) || 4.5;
        const thickness = parseFloat(thicknessStr) || 150;
        const delta = parseFloat(deltaStr) || 0;

        const face = {
            id: Date.now(),
            label: label,
            vertices: [...state.roofDrawPoints],
            slopeLine: [...state.roofTempSlopeLine],
            slope: slope,
            roofThickness: thickness,
            baseHeightDelta: delta,
            floor: state.currentFloor
        };

        if (!state.roofFaces) state.roofFaces = [];
        state.roofFaces.push(face);

        state.roofDrawPoints = [];
        state.roofTempSlopeLine = [];
        state.roofDrawingStep = 'polygon';
        window.AppController.refreshAll();
    },

    cancelDrawing: function(state) {
        state.roofDrawPoints = [];
        state.roofTempSlopeLine = [];
        state.roofDrawingStep = 'polygon';
        window.AppController.refreshAll();
    }
};
