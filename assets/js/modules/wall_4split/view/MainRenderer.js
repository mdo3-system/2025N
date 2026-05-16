/**
 * view/MainRenderer.js - メイン描画エンジン
 * v2.3.19 リファクタリング
 */

window.MainRenderer = {
    /**
     * メインの描画エントリーポイント
     * @param {Object} state - アプリケーション状態
     */
    render: function(state) {
        const ctx = state.ctx;
        const canvas = state.canvas;
        if (!ctx || !canvas) return;

        const isPrintMode = state.isPrintMode || false;
        const appMode = state.currentAppMode || 'wall';
        const existingAlpha = (appMode === 'foundation') ? 0.5 : 1.0;

        // 1. 背景のクリア
        const bgC = isPrintMode ? '#fff' : '#1e1e1e';
        const logicalW = canvas.clientWidth || (canvas.width / (window.devicePixelRatio || 1));
        const logicalH = canvas.clientHeight || (canvas.height / (window.devicePixelRatio || 1));
        
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // 物理サイズでクリア
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = bgC;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        // 凡例マッピングの更新
        if (typeof window.buildWallLegendData === 'function') {
            window._currentLegendDic = window.buildWallLegendData().panelDic;
        }

        // 2. 4分割計算の境界表示
        this.draw4DivisionBounds(state);

        const isAreaMode = (document.querySelector('input[name="mode"]:checked')?.value === 'area');

        // 3. 背景図面 (DXF)
        if (!isAreaMode) {
            this.drawBackground(state);
        }

        // 4. グリッドと通り芯
        this.drawGrids(state);

        // 5. 文字要素
        this.drawTexts(state);

        // 6. 面積ポリゴン
        this.drawAreas(state);

        // 7. 構造要素 (透過設定あり)
        ctx.save();
        ctx.globalAlpha = existingAlpha;
        if (!isAreaMode) {
            this.drawWindows(state);
            this.drawWalls(state);
        }
        this.drawPillars(state);
        ctx.restore();

        // 8. 重心・剛心の描画
        this.drawCenters(state);

        // 9. インタラクション (選択、スナップ、プレビュー)
        this.drawInteractions(state);

        // 9. 基礎レイヤー (基礎モード時)
        if (appMode === 'foundation') {
            this.drawFoundationLayer(state);
        }

        // 10. 凡例の描画 (非印刷時のみ)
        if (!isPrintMode) {
            this.drawLegend(state);
        }
    },

    /**
     * 座標変換ヘルパー (ブリッジ関数へ委譲)
     */
    toCanvas: function(x, y, state) {
        const p = window.toCanvasPixel(x, y);
        return { cx: p.cx, cy: p.cy };
    },

    draw4DivisionBounds: function(state) {
        if (!state.elementVisibility.div4 || state.isPrintMode) return;
        const b = window.GridEngine ? window.GridEngine.get4DivisionBounds(state.currentFloor, state) : null;
        if (!b) return;

        const ctx = state.ctx;
        const drawRect = (bb, cc) => {
            const p1 = this.toCanvas(bb.minX, bb.minY, state);
            const p2 = this.toCanvas(bb.maxX, bb.maxY, state);
            if (p1.cx != null) {
                const w = p2.cx - p1.cx, h = p1.cy - p2.cy;
                if (w > 0 && h > 0) {
                    ctx.fillStyle = cc;
                    ctx.fillRect(p1.cx, p2.cy, w, h);
                }
            }
        };
        drawRect({ minX: b.minX, maxX: b.xLineL, minY: b.minY, maxY: b.maxY }, 'rgba(52,152,219,0.25)');
        drawRect({ minX: b.xLineR, maxX: b.maxX, minY: b.minY, maxY: b.maxY }, 'rgba(52,152,219,0.25)');
        drawRect({ minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.yLineT }, 'rgba(231,76,60,0.25)');
        drawRect({ minX: b.minX, maxX: b.maxX, minY: b.yLineB, maxY: b.maxY }, 'rgba(231,76,60,0.25)');
    },

    drawBackground: function(state) {
        const ctx = state.ctx;
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = state.isPrintMode ? '#aaa' : 'rgba(170, 170, 170, 0.5)';
        
        state.bgLinesOriginal.forEach(e => {
            if ((state.layerVisibility || {})[e.layer] === false) return;
            if (e.isGridLine) return; // スナップ用GRID線は除外
            if (e.floor !== state.currentFloor && e.floor !== 'ALL') return;

            ctx.beginPath();
            if (e.type === 'LINE' && e.vertices) {
                const p1 = this.toCanvas(e.vertices[0], null, state);
                const p2 = this.toCanvas(e.vertices[1], null, state);
                if (p1.cx != null) { ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); }
            } else if (['LWPOLYLINE', 'POLYLINE'].includes(e.type) && e.vertices) {
                e.vertices.forEach((v, i) => {
                    const p = this.toCanvas(v, null, state);
                    if (p.cx != null) { i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy); }
                });
                if (e.closed) ctx.closePath();
            } else if (e.type === 'CIRCLE') {
                const p = this.toCanvas(e.center, null, state);
                if (p.cx != null) ctx.arc(p.cx, p.cy, e.radius * state.scale, 0, 2 * Math.PI);
            } else if (e.type === 'ARC') {
                const p = this.toCanvas(e.center, null, state);
                if (p.cx != null) ctx.arc(p.cx, p.cy, e.radius * state.scale, -e.endAngle * Math.PI / 180, -e.startAngle * Math.PI / 180);
            }
            ctx.stroke();
        });
    },

    drawGrids: function(state) {
        if (!state.elementVisibility.grids || (state.gridXCoords.length === 0 && state.gridYCoords.length === 0)) return;
        const ctx = state.ctx;
        ctx.save();
        ctx.strokeStyle = state.isPrintMode ? '#555' : '#8e44ad';
        ctx.setLineDash([5, 5]);
        
        const hasY = state.gridYCoords && state.gridYCoords.length > 0;
        const hasX = state.gridXCoords && state.gridXCoords.length > 0;

        const gMinY = hasY ? Math.min(...state.gridYCoords) : 0;
        const gMaxY = hasY ? Math.max(...state.gridYCoords) : 0;
        const gMinX = hasX ? Math.min(...state.gridXCoords) : 0;
        const gMaxX = hasX ? Math.max(...state.gridXCoords) : 0;

        const pTop = hasY ? this.toCanvas(0, gMaxY, state) : { cy: 0 };
        const pBot = hasY ? this.toCanvas(0, gMinY, state) : { cy: state.canvas.height };
        const pLeft = hasX ? this.toCanvas(gMinX, 0, state) : { cx: 0 };
        const pRight = hasX ? this.toCanvas(gMaxX, 0, state) : { cx: state.canvas.width };

        const topY = hasY ? pTop.cy - 30 : 0;
        const botY = hasY ? pBot.cy + 30 : state.canvas.height;
        const leftX = hasX ? pLeft.cx - 30 : 0;
        const rightX = hasX ? pRight.cx + 30 : state.canvas.width;

        const visibleLeft = -state.offsetX / state.scale;
        const visibleTop = (state.canvas.height - state.offsetY) / state.scale;
        const labelFontSize = Math.max(10, Math.min(20, 14 / state.scale));
        const labelPad = 10 / state.scale;

        let lastCx = -Infinity;
        let staggerLevelX = 0;
        const sortedXIndices = state.gridXCoords.map((v, i) => i).sort((a, b) => state.gridXCoords[a] - state.gridXCoords[b]);

        sortedXIndices.forEach(i => {
            const x = state.gridXCoords[i];
            const cx = this.toCanvas(x, 0, state).cx;
            if (cx != null) {
                
                const baseLabelY = Math.max(this.toCanvas(0, visibleTop - labelPad, state).cy, 15);
                // [v2.4.78] 近接判定: ラベルが重なるほど近い場合は段階的に下げる (3段階)
                const textEstWidth = labelFontSize * 1.8;
                if (cx - lastCx < textEstWidth) {
                    staggerLevelX = (staggerLevelX + 1) % 3;
                } else {
                    staggerLevelX = 0;
                }
                lastCx = cx;
                
                const labelY = baseLabelY + staggerLevelX * (labelFontSize + 4);

                ctx.save();
                ctx.font = `bold ${labelFontSize}px sans-serif`;
                
                // [v2.4.79 延長] labelY(文字のベースライン)の少し下からグリッド線を引く
                const lineTopY = labelY + 6; 
                ctx.beginPath(); ctx.moveTo(cx, lineTopY); ctx.lineTo(cx, botY); ctx.stroke();

                ctx.textAlign = "center";
                ctx.strokeStyle = state.isPrintMode ? '#fff' : 'rgba(30,30,30,0.7)'; ctx.lineWidth = 3;
                ctx.strokeText(state.gridXNames[i] || '', cx, labelY);
                ctx.fillStyle = state.isPrintMode ? '#2c3e50' : '#2ecc71';
                ctx.fillText(state.gridXNames[i] || '', cx, labelY);
                ctx.restore();
            }
        });

        let lastCy = -Infinity;
        let staggerLevelY = 0;
        // Y座標は下から上に並んでいる（キャンバス座標は上から下）ため、キャンバス座標順にソートして判定
        const sortedYIndices = state.gridYCoords.map((v, i) => i).sort((a, b) => {
            const cyA = this.toCanvas(0, state.gridYCoords[a], state).cy;
            const cyB = this.toCanvas(0, state.gridYCoords[b], state).cy;
            return cyA - cyB;
        });

        sortedYIndices.forEach(i => {
            const y = state.gridYCoords[i];
            const cy = this.toCanvas(0, y, state).cy;
            if (cy != null) {
                const baseLabelX = Math.max(this.toCanvas(visibleLeft + labelPad, 0, state).cx, 5);
                // [v2.4.78] Y軸方向の近接判定 (フォント高さ分重ならないようにずらす)
                const textEstHeight = labelFontSize * 1.2;
                if (cy - lastCy < textEstHeight) {
                    staggerLevelY = (staggerLevelY + 1) % 3;
                } else {
                    staggerLevelY = 0;
                }
                lastCy = cy;

                const labelX = baseLabelX + staggerLevelY * (labelFontSize * 2);

                ctx.save();
                ctx.font = `bold ${labelFontSize}px sans-serif`;
                
                // [v2.4.79 延長] 文字の幅を測定し、文字の右側からグリッド線を引く
                const txt = state.gridYNames[i] || '';
                const tw = ctx.measureText(txt).width;
                const lineStartX = labelX + tw + 6;

                ctx.beginPath(); ctx.moveTo(lineStartX, cy); ctx.lineTo(rightX, cy); ctx.stroke();

                ctx.textAlign = "left";
                ctx.strokeStyle = state.isPrintMode ? '#fff' : 'rgba(30,30,30,0.7)'; ctx.lineWidth = 3;
                ctx.strokeText(txt, labelX, cy + 5);
                ctx.fillStyle = state.isPrintMode ? '#2c3e50' : '#2ecc71';
                ctx.fillText(txt, labelX, cy + 5);
                ctx.restore();
            }
        });

        // --- [v2.5.0] 斜め通り芯描画 ---
        if (state.manualGridAngle && state.manualGridAngle.length > 0) {
            const labelFontSize = 12;
            state.manualGridAngle.forEach(g => {
                const c1 = this.toCanvas(g.p1.x, g.p1.y, state);
                const c2 = this.toCanvas(g.p2.x, g.p2.y, state);
                if (!c1 || !c2) return;

                const dx = c2.cx - c1.cx, dy = c2.cy - c1.cy;
                const len = Math.hypot(dx, dy);
                if (len < 5) return; 

                const ux = dx / len, uy = dy / len;

                // ビューポートを十分に横切る破線を描画
                const drawLen = 8000; 
                ctx.beginPath();
                ctx.moveTo(c1.cx - ux * drawLen, c1.cy - uy * drawLen);
                ctx.lineTo(c1.cx + ux * drawLen, c1.cy + uy * drawLen);
                ctx.stroke();

                // ラベル描画: 「上/左」にある方を始点にオフセット
                const isC1Hi = (c1.cy < c2.cy) || (Math.abs(c1.cy - c2.cy) < 2 && c1.cx < c2.cx);
                const anchor = isC1Hi ? c1 : c2;
                const dir = isC1Hi ? -1 : 1;
                const lx = anchor.cx + ux * dir * 35, ly = anchor.cy + uy * dir * 35;

                ctx.save();
                ctx.setLineDash([]); 
                ctx.font = `bold ${labelFontSize}px sans-serif`;
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                
                const txt = g.name || 'DA';
                ctx.strokeStyle = state.isPrintMode ? '#fff' : 'rgba(30,30,30,0.7)'; ctx.lineWidth = 3;
                ctx.strokeText(txt, lx, ly);
                ctx.fillStyle = state.isPrintMode ? '#2c3e50' : '#e74c3c'; 
                ctx.fillText(txt, lx, ly);
                ctx.restore();
            });
        }
        ctx.restore();
    },

    drawTexts: function(state) {
        const ctx = state.ctx;
        ctx.textAlign = "left";
        state.bgTextsOriginal.filter(t => t.floor === state.currentFloor || t.floor === 'ALL').forEach(t => {
            if ((state.layerVisibility || {})[t.layer] === false) return;
            const p = this.toCanvas(t, null, state);
            if (p.cx != null) {
                ctx.fillStyle = t.isUnderlay ? '#666' : (state.isPrintMode ? '#333' : '#aaaaaa');
                ctx.font = "14px sans-serif";
                ctx.fillText(t.text, p.cx, p.cy);
            }
        });
    },

    drawAreas: function(state) {
        if (!state.elementVisibility.areas) return;
        const ctx = state.ctx;
        state.areaLines.filter(a => a.floor === state.currentFloor).forEach((a, index) => {
            ctx.beginPath();
            a.vertices.forEach((v, i) => {
                const p = this.toCanvas(v, null, state);
                if (p.cx != null) i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy);
            });
            if (a.closed) ctx.closePath();

            // 色分け
            const colors = {
                attic: { fill: 'rgba(155, 89, 182, 0.3)', stroke: '#8e44ad' },
                balcony: { fill: 'rgba(230, 126, 34, 0.3)', stroke: '#e67e22' },
                void: { fill: 'rgba(127, 140, 141, 0.3)', stroke: '#7f8c8d' },
                porch: { fill: 'rgba(241, 196, 15, 0.3)', stroke: '#f39c12' },
                default: { fill: 'rgba(46, 204, 113, 0.2)', stroke: 'rgba(46, 204, 113, 0.8)' }
            };
            const c = colors[a.areaType] || colors.default;
            ctx.fillStyle = c.fill; ctx.strokeStyle = c.stroke;
            ctx.fill(); ctx.stroke();

            // ラベル
            const cx = a.vertices.reduce((s, v) => s + v.x, 0) / a.vertices.length;
            const cy = a.vertices.reduce((s, v) => s + v.y, 0) / a.vertices.length;
            const p = this.toCanvas(cx, cy, state);
            if (p.cx != null) {
                const label = `${index + 1}. ${this.getAreaTypeName(a.areaType)}`;
                ctx.save();
                ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
                ctx.strokeText(label, p.cx, p.cy);
                ctx.fillStyle = '#2c3e50';
                ctx.fillText(label, p.cx, p.cy);
                ctx.restore();
            }
        });
    },

    getAreaTypeName: function(type) {
        return { attic: '小屋裏', balcony: 'バルコニー', void: '吹き抜け', porch: 'ポーチ・屋根' }[type] || '床面積';
    },

    drawWindows: function(state) {
        if (!state.elementVisibility.windows) return;
        const ctx = state.ctx;
        const winC = state.isPrintMode ? 'rgba(52,152,219,0.2)' : 'rgba(52,152,219,0.4)';
        state.windowsArr.filter(w => w.floor === state.currentFloor).forEach(w => {
            const p1 = this.toCanvas(w.p1, null, state), p2 = this.toCanvas(w.p2, null, state);
            if (p1.cx != null) {
                ctx.lineWidth = 15; ctx.strokeStyle = winC; ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
                ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = state.isPrintMode ? '#333' : '#fff'; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText("開口", (p1.cx + p2.cx) / 2, (p1.cy + p2.cy) / 2);
            }
        });
    },

    drawWalls: function(state) {
        if (!state.elementVisibility.walls) return;
        const ctx = state.ctx;
        const w1C = state.isPrintMode ? '#27ae60' : '#2ecc71', w2C = state.isPrintMode ? '#d35400' : '#f39c12';
        state.walls.filter(w => w.floor === state.currentFloor).forEach(w => {
            const p1 = this.toCanvas(w.p1, null, state), p2 = this.toCanvas(w.p2, null, state);
            if (p1.cx != null) {
                ctx.lineWidth = 5; ctx.strokeStyle = state.currentFloor === '1F' ? w1C : w2C;
                ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
                
                // 記号描画
                this.drawWallSymbols(ctx, w, p1, p2, state);
            }
        });
    },

    drawWallSymbols: function(ctx, w, p1, p2, state) {
        const mX = (p1.cx + p2.cx) / 2, mY = (p1.cy + p2.cy) / 2;
        const isPrintMode = state.isPrintMode;

        // 1. 筋交いアイコン (IDベースで取得)
        const braceSpec = window.WallEngine.getBraceSpec(w.braceId);
        let braceVal = braceSpec.val || 0;
        let braceText = braceSpec.text || "";

        // Fallback for legacy numerical data
        if (braceVal === 0 && w.braceVal > 0) {
            braceVal = w.braceVal;
            braceText = w.braceName || (w.isTasuki ? "Ｘ" : "／");
        }

        if (braceVal > 0) {
            ctx.save(); ctx.translate(mX, mY); ctx.rotate(Math.atan2(p2.cy - p1.cy, p2.cx - p1.cx));
            ctx.fillStyle = isPrintMode ? '#333' : '#e74c3c';
            if (braceText.includes('たすき') || braceText.includes('Ｘ')) {
                // 左からの三角形
                ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(12, -12); ctx.closePath(); ctx.fill();
                // 右からの三角形 (対称)
                ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-12, 0); ctx.lineTo(-12, -12); ctx.closePath(); ctx.fill();
            } else {
                ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(12, -12); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        }

        // 2. 面材記号
        const spec1 = window.WallEngine.getWallSpec(w.outPanelId);
        const spec2 = window.WallEngine.getWallSpec(w.inPanelId);

        let mark1 = (spec1 && spec1.id !== "opt0") ? spec1.text.charAt(0) : "";
        let mark2 = (spec2 && spec2.id !== "opt0") ? spec2.text.charAt(0) : "";

        // Fallback for legacy numerical data
        if (!mark1 && w.outPanelVal > 0) mark1 = (w.outPanelName || "P").charAt(0);
        if (!mark2 && w.inPanelVal > 0) mark2 = (w.inPanelName || "P").charAt(0);

        let marks = []; if (mark1) marks.push(mark1); if (mark2) marks.push(mark2);
        let mark = marks.join('+');

        // カスタム面材などの記号マッピング (凡例辞書がある場合のみ)
        if (!mark) {
            const totalMultiplier = window.WallEngine.getTotalMultiplier(w);
            const panelSum = totalMultiplier - braceVal;
            if (panelSum > 0) {
                mark = window._currentLegendDic ? window._currentLegendDic[panelSum.toFixed(2)] || '' : '';
            }
        }

        if (mark) {
            ctx.font = 'bold 13px sans-serif'; ctx.textAlign = "center";
            const tw = ctx.measureText(mark).width;
            const isVertical = Math.abs(p1.cy - p2.cy) > Math.abs(p1.cx - p2.cx);
            const offX = isVertical ? 15 : 0, offY = isVertical ? 0 : -8;
            ctx.fillStyle = isPrintMode ? 'rgba(255,255,255,0.9)' : 'rgba(30,30,30,0.8)';
            ctx.fillRect(mX - tw/2 + offX - 3, mY + offY - 11, tw + 6, 16);
            ctx.fillStyle = isPrintMode ? '#2c3e50' : '#f1c40f';
            ctx.fillText(mark, mX + offX, mY + offY);
        }
    },

    drawPillars: function(state) {
        if (!state.elementVisibility.pillars) return;
        const ctx = state.ctx;
        state.pillars.filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === state.currentFloor || p.floor === 'ALL')).forEach(p => {
            const pt = this.toCanvas(p, null, state);
            if (pt.cx != null) {
                const isSelected = state.selectedPillar === p;
                const isHovered = state.hoveredPillar === p;
                ctx.fillStyle = state.isPrintMode ? '#333' : (isSelected ? '#e74c3c' : (isHovered ? '#e67e22' : (p.isManual ? '#2ecc71' : '#3498db')));
                const isC = p.isManualCorner !== null ? p.isManualCorner : p.isCornerAuto;
                if (isC) { ctx.beginPath(); ctx.arc(pt.cx, pt.cy, 8, 0, Math.PI * 2); ctx.fill(); }
                else { ctx.fillRect(pt.cx - 7, pt.cy - 7, 14, 14); }

                // N値表示
                if (state.elementVisibility.pillarNValues && (window.getMode() === 'n-value' || window.getMode() === 'select') && p.nValue !== undefined && !['不要', '-'].includes(p.nMark)) {
                    this.drawPillarNValue(ctx, p, pt, state);
                }

                // 柱番号表示 (選択モード時)
                if (window.getMode() === 'select' || window.getMode() === 'add-pillar') {
                    ctx.fillStyle = isPrintMode ? "#333" : "#aaa";
                    ctx.font = "9px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText(p.pId || p.id, pt.cx, pt.cy + 15);
                }
            }
        });
    },

    drawPillarNValue: function(ctx, p, pt, state) {
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 12px sans-serif";
        const tw = ctx.measureText(p.nMark).width;
        ctx.fillStyle = state.isPrintMode ? '#fff' : 'rgba(255,255,255,0.9)';
        ctx.fillRect(pt.cx - tw/2 - 4, pt.cy - 8, tw + 8, 16);
        ctx.fillStyle = '#c0392b';
        ctx.fillText(p.nMark, pt.cx, pt.cy);
    },

    drawInteractions: function(state) {
        if (state.isPrintMode) return;
        const ctx = state.ctx;

        // スナップ点
        if (state.snapPoint) {
            const p = this.toCanvas(state.snapPoint, null, state);
            ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(p.cx - 10, p.cy); ctx.lineTo(p.cx + 10, p.cy);
            ctx.moveTo(p.cx, p.cy - 10); ctx.lineTo(p.cx, p.cy + 10); ctx.stroke();
        }

        // 柱負担面積図 (m === 'area' の時)
        const mode = window.getMode();
        if (mode === 'area') {
            ctx.lineWidth = 1.5; ctx.strokeStyle = '#27ae60'; ctx.setLineDash([5, 5]);
            state.pillars.filter(p => !p.isDeleted && !p.isInvalidPos && p.floor === state.currentFloor).forEach(p => {
                if (p.tributaryPolygon && p.tributaryPolygon.length > 0) {
                    ctx.fillStyle = 'rgba(46, 204, 113, 0.1)';
                    p.tributaryPolygon.forEach(poly => {
                        ctx.beginPath();
                        poly.forEach((v, i) => {
                            const c = this.toCanvas(v, null, state);
                            i === 0 ? ctx.moveTo(c.cx, c.cy) : ctx.lineTo(c.cx, c.cy);
                        });
                        ctx.closePath();
                        ctx.fill(); ctx.stroke();
                    });

                    // 負担面積の数値表示
                    const areaVal = p.loadArea || 0;
                    if (areaVal > 0) {
                        const pt = this.toCanvas(p, null, state);
                        const txt = areaVal.toFixed(2) + " ㎡";
                        ctx.font = "bold 13px sans-serif";
                        ctx.textAlign = "center"; ctx.textBaseline = "middle";
                        
                        // 背景ボックスの描画
                        const metrics = ctx.measureText(txt);
                        const padding = 4;
                        const rectW = metrics.width + padding * 2;
                        const rectH = 18;
                        const rx = pt.cx - rectW / 2;
                        const ry = pt.cy + 12;

                        ctx.fillStyle = "#ffffff";
                        ctx.beginPath();
                        if (ctx.roundRect) ctx.roundRect(rx, ry, rectW, rectH, 4);
                        else ctx.rect(rx, ry, rectW, rectH);
                        ctx.fill();

                        // 緑の枠線
                        ctx.strokeStyle = "#2ecc71";
                        ctx.lineWidth = 1.5;
                        ctx.stroke();

                        // 緑のメインテキスト
                        ctx.fillStyle = "#2ecc71";
                        ctx.font = "bold 13px sans-serif";
                        ctx.fillText(txt, pt.cx, ry + rectH / 2);
                    }
                }
            });
            ctx.setLineDash([]);
        }

        // 壁・開口のハイライト (選択ツールまたは仕様変更ツール時)
        if (['select', 'edit-wall', 'del-wall'].includes(mode)) {
            const hit = state.selectedElement;
            if (hit && (hit.type === 'wall' || hit.type === 'window')) {
                const w = hit.item;
                const p1 = this.toCanvas(w.p1, null, state), p2 = this.toCanvas(w.p2, null, state);
                ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(241, 196, 15, 0.6)';
                ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
            }
        }

        // 作図中プレビュー (面積など)
        if (mode === 'draw-area' && state.areaDrawPoints.length > 0) {
            ctx.lineWidth = 2; ctx.strokeStyle = '#e74c3c'; ctx.setLineDash([5, 5]); ctx.beginPath();
            state.areaDrawPoints.forEach((pt, i) => {
                const p = this.toCanvas(pt, null, state);
                i === 0 ? ctx.moveTo(p.cx, p.cy) : ctx.lineTo(p.cx, p.cy);
            });
            const last = state.snapPoint ? state.snapPoint : { x: (state.mouseX - state.offsetX)/state.scale, y: (state.canvas.height - state.mouseY - state.offsetY)/state.scale };
            const lp = this.toCanvas(last, null, state);
            ctx.lineTo(lp.cx, lp.cy); ctx.stroke(); ctx.setLineDash([]);
        }

        // [v2.5.10] 斜め通り芯の作図プレビュー
        if (mode === 'add-diag-grid' && state.diagGridPoints && state.diagGridPoints.length > 0) {
            ctx.lineWidth = 2; ctx.strokeStyle = '#8e44ad'; ctx.setLineDash([4, 4]);
            const p1 = this.toCanvas(state.diagGridPoints[0], null, state);
            const curr = state.snapPoint ? state.snapPoint : { x: (state.mouseX - state.offsetX)/state.scale, y: (state.canvas.height - state.mouseY - state.offsetY)/state.scale };
            const p2 = this.toCanvas(curr, null, state);
            ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
            ctx.setLineDash([]);
        }
    },

    /**
     * 壁・金物の凡例を描画
     */
    drawLegend: function(state) {
        const ctx = state.ctx;
        const canvas = state.canvas;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // リセット
        
        const x = 10, y = canvas.height - 110;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x, y, 180, 100);
        
        ctx.fillStyle = "#fff";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("■ 凡例 (耐力壁)", x + 10, y + 20);
        
        ctx.font = "10px sans-serif";
        ctx.fillText("緑線: 1F壁 / 橙線: 2F壁", x + 10, y + 40);
        ctx.fillText("数字: 壁倍率の合計", x + 10, y + 55);
        ctx.fillText("記号: 面材種類(外+内)", x + 10, y + 70);
        ctx.fillText("赤三角: 筋交い", x + 10, y + 85);
        
        ctx.restore();
    },

    drawCenters: function(state) {
        if (state.isPrintMode) return;
        const ctx = state.ctx;
        const floor = state.currentFloor;
        const data = (state.centerData || {})[floor];
        if (!data || !data.G || !data.C) return;

        const drawMark = (pt, label, color) => {
            const p = this.toCanvas(pt, null, state);
            if (p.cx == null) return;
            
            ctx.beginPath();
            ctx.strokeStyle = color; ctx.lineWidth = 2;
            ctx.moveTo(p.cx - 15, p.cy); ctx.lineTo(p.cx + 15, p.cy);
            ctx.moveTo(p.cx, p.cy - 15); ctx.lineTo(p.cx, p.cy + 15);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(p.cx, p.cy, 5, 0, Math.PI*2);
            ctx.fillStyle = color; ctx.fill();

            ctx.font = "bold 14px sans-serif";
            ctx.textAlign = "left";
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
            ctx.strokeText(label, p.cx + 8, p.cy - 8);
            ctx.fillStyle = color;
            ctx.fillText(label, p.cx + 8, p.cy - 8);
        };

        drawMark(data.G, "G (重心)", "#2ecc71");
        drawMark(data.C, "C (剛芯)", "#e74c3c");
    },

    drawFoundationLayer: function(state) {
        if (window.FoundationRenderer) {
            window.FoundationRenderer.render(state, (x, y) => this.toCanvas(x, y, state));
        }
    }
};
