/**
 * logic/GridEngine.js - 通り芯解析エンジン
 * v2.3.25 Refactoring
 */

window.GridEngine = {
    /**
     * キャンバス上の線分、柱、手動設定から通り芯を解析・統合します
     * @param {Object} state - アプリケーション状態
     */
    analyzeGrids: function(state) {
        let validPillars = state.pillars.filter(p => !p.isDeleted);
        const TOL_SNAP = 3; // 近接グリッドのマージ制限 (105mm等のダブル壁偏芯通り芯を保持するため3mmに厳密化)

        // 座標を標準モジュール(455mm)に「近い場合のみ」吸着させる補助関数
        const snapToModule = (val) => {
            const module = 455;
            const nearest = Math.round(val / module) * module;
            // 5mm以内の誤差であれば標準モジュールに吸着
            if (Math.abs(val - nearest) < 5) return nearest;
            // 105mm/120mm等のダブル壁偏芯通り芯を含む任意のオフセット位置は1mm単位の精度でそのまま維持
            return Math.round(val);
        };

        let masterXs = [], masterYs = [];

        if (state.isGridFixed && state.gridXCoords && state.gridXCoords.length > 0 && state.gridYCoords && state.gridYCoords.length > 0) {
            // スパン修正または手動確定済みのグリッド座標をベースとしつつ、手動追加グリッドを確実にマージ
            masterXs = [...state.gridXCoords];
            masterYs = [...state.gridYCoords];

            // 手動追加グリッドをマージ
            (state.manualGridX || []).forEach(m => {
                let sx = snapToModule(m.coord);
                if (!masterXs.some(x => Math.abs(x - sx) < TOL_SNAP)) masterXs.push(sx);
                if (m.name && (!state.userEditedGridX || !state.userEditedGridX[sx])) {
                    if (!state.userEditedGridX) state.userEditedGridX = {};
                    state.userEditedGridX[sx] = m.name;
                }
            });
            (state.manualGridY || []).forEach(m => {
                let sy = snapToModule(m.coord);
                if (!masterYs.some(y => Math.abs(y - sy) < TOL_SNAP)) masterYs.push(sy);
                if (m.name && (!state.userEditedGridY || !state.userEditedGridY[sy])) {
                    if (!state.userEditedGridY) state.userEditedGridY = {};
                    state.userEditedGridY[sy] = m.name;
                }
            });

            // 削除済みグリッドを除外
            const manualXCoords = (state.manualGridX || []).map(m => snapToModule(m.coord));
            masterXs = masterXs.filter(mx => {
                if (manualXCoords.includes(mx)) return true;
                return !(state.deletedGridX || []).some(dx => Math.abs(dx - mx) < TOL_SNAP);
            });
            const manualYCoords = (state.manualGridY || []).map(m => snapToModule(m.coord));
            masterYs = masterYs.filter(my => {
                if (manualYCoords.includes(my)) return true;
                return !(state.deletedGridY || []).some(dy => Math.abs(dy - my) < TOL_SNAP);
            });

            masterXs.sort((a, b) => a - b);
            masterYs.sort((a, b) => a - b);
        } else {
            let gridLineXs = [], gridLineYs = [];

            // 1. 背景図面(DXF)のグリッド線から座標を抽出
            const addGridCoord = (p1, p2) => {
                if (!p1 || !p2) return;
                let dx = Math.abs(p1.x - p2.x), dy = Math.abs(p1.y - p2.y);
                if (Math.hypot(dx, dy) > 500) {
                    if (dx < 15) gridLineXs.push(snapToModule((p1.x + p2.x) / 2));
                    if (dy < 15) gridLineYs.push(snapToModule((p1.y + p2.y) / 2));
                }
            };

            state.bgLinesOriginal.forEach(e => {
                if (e.isGridLine) {
                    if (e.type === 'LINE' && e.vertices && e.vertices.length === 2) {
                        addGridCoord(e.vertices[0], e.vertices[1]);
                    } else if (['LWPOLYLINE', 'POLYLINE'].includes(e.type) && e.vertices && e.vertices.length >= 2) {
                        for (let i = 0; i < e.vertices.length - 1; i++) {
                            addGridCoord(e.vertices[i], e.vertices[i + 1]);
                        }
                    }
                }
            });

            // 2. 柱の座標を標準モジュールに揃える & グリッド線にスナップ
            validPillars.forEach(p => {
                p.x = snapToModule(p.x);
                p.y = snapToModule(p.y);
                
                let gx = gridLineXs.find(x => Math.abs(x - p.x) < TOL_SNAP);
                if (gx !== undefined) p.x = gx;
                let gy = gridLineYs.find(y => Math.abs(y - p.y) < TOL_SNAP);
                if (gy !== undefined) p.y = gy;
            });

            // 3. 通り芯の座標マスターリストを作成
            gridLineXs.forEach(x => { 
                let sx = snapToModule(x);
                if (!masterXs.some(mx => Math.abs(mx - sx) < TOL_SNAP)) masterXs.push(sx); 
            });
            gridLineYs.forEach(y => { 
                let sy = snapToModule(y);
                if (!masterYs.some(my => Math.abs(my - sy) < TOL_SNAP)) masterYs.push(sy); 
            });

            // 手動追加グリッド
            (state.manualGridX || []).forEach(m => { 
                let sx = snapToModule(m.coord);
                if (!masterXs.some(x => Math.abs(x - sx) < TOL_SNAP)) masterXs.push(sx); 
                if (m.name && (!state.userEditedGridX || !state.userEditedGridX[sx])) {
                    if (!state.userEditedGridX) state.userEditedGridX = {};
                    state.userEditedGridX[sx] = m.name;
                }
            });
            (state.manualGridY || []).forEach(m => { 
                let sy = snapToModule(m.coord);
                if (!masterYs.some(y => Math.abs(y - sy) < TOL_SNAP)) masterYs.push(sy); 
                if (m.name && (!state.userEditedGridY || !state.userEditedGridY[sy])) {
                    if (!state.userEditedGridY) state.userEditedGridY = {};
                    state.userEditedGridY[sy] = m.name;
                }
            });

            // 基礎梁の端点（基礎モード時の通り芯維持）
            (state.foundationBeams || []).forEach(b => {
                let s1x = snapToModule(b.p1.x), s1y = snapToModule(b.p1.y);
                let s2x = snapToModule(b.p2.x), s2y = snapToModule(b.p2.y);
                if (!masterXs.some(x => Math.abs(x - s1x) < TOL_SNAP)) masterXs.push(s1x);
                if (!masterYs.some(y => Math.abs(y - s1y) < TOL_SNAP)) masterYs.push(s1y);
                if (!masterXs.some(x => Math.abs(x - s2x) < TOL_SNAP)) masterXs.push(s2x);
                if (!masterYs.some(y => Math.abs(y - s2y) < TOL_SNAP)) masterYs.push(s2y);
            });

            masterXs.sort((a, b) => a - b); masterYs.sort((a, b) => a - b);
            
            // ブラックリスト（削除済みグリッド）を除外
            const manualXCoords = (state.manualGridX || []).map(m => snapToModule(m.coord));
            masterXs = masterXs.filter(mx => {
                if (manualXCoords.includes(mx)) return true;
                return !(state.deletedGridX || []).some(dx => Math.abs(dx - mx) < TOL_SNAP);
            });

            const manualYCoords = (state.manualGridY || []).map(m => snapToModule(m.coord));
            masterYs = masterYs.filter(my => {
                if (manualYCoords.includes(my)) return true;
                return !(state.deletedGridY || []).some(dy => Math.abs(dy - my) < TOL_SNAP);
            });
        }

        state.masterXs = masterXs; 
        state.masterYs = masterYs;

        // 通り芯名称の決定 (ユーザー手動変更優先 > 復元済み配列優先 > 自動連番 X1, X2... / Y1, Y2...)
        const resolveGridXName = (x, i) => {
            const rx = Math.round(x);
            if (state.userEditedGridX) {
                if (state.userEditedGridX[x] !== undefined) return state.userEditedGridX[x];
                if (state.userEditedGridX[rx] !== undefined) return state.userEditedGridX[rx];
                if (state.userEditedGridX[String(rx)] !== undefined) return state.userEditedGridX[String(rx)];
                for (const k in state.userEditedGridX) {
                    if (Math.abs(parseFloat(k) - x) < 3) return state.userEditedGridX[k];
                }
            }
            if (state.gridXNames && state.gridXNames[i]) return state.gridXNames[i];
            return `X${i + 1}`;
        };

        const resolveGridYName = (y, i) => {
            const ry = Math.round(y);
            if (state.userEditedGridY) {
                if (state.userEditedGridY[y] !== undefined) return state.userEditedGridY[y];
                if (state.userEditedGridY[ry] !== undefined) return state.userEditedGridY[ry];
                if (state.userEditedGridY[String(ry)] !== undefined) return state.userEditedGridY[String(ry)];
                for (const k in state.userEditedGridY) {
                    if (Math.abs(parseFloat(k) - y) < 3) return state.userEditedGridY[k];
                }
            }
            if (state.gridYNames && state.gridYNames[i]) return state.gridYNames[i];
            return `Y${i + 1}`;
        };

        let nx = masterXs.map((x, i) => {
            const name = resolveGridXName(x, i);
            if (!state.userEditedGridX) state.userEditedGridX = {};
            state.userEditedGridX[Math.round(x)] = name;
            return name;
        });

        let ny = masterYs.map((y, i) => {
            const name = resolveGridYName(y, i);
            if (!state.userEditedGridY) state.userEditedGridY = {};
            state.userEditedGridY[Math.round(y)] = name;
            return name;
        });

        state.gridXCoords = masterXs; state.gridXNames = nx;
        state.gridYCoords = masterYs; state.gridYNames = ny;

        // 4. すべての柱をマスター通り芯の交点に厳密に吸着配置（削除防止）
        validPillars.forEach(p => {
            let bestXIdx = -1, minDx = Infinity;
            masterXs.forEach((mx, idx) => {
                let d = Math.abs(mx - p.x);
                if (d < minDx) { minDx = d; bestXIdx = idx; }
            });

            let bestYIdx = -1, minDy = Infinity;
            masterYs.forEach((my, idx) => {
                let d = Math.abs(my - p.y);
                if (d < minDy) { minDy = d; bestYIdx = idx; }
            });

            if (bestXIdx >= 0 && bestYIdx >= 0) {
                p.x = masterXs[bestXIdx];
                p.y = masterYs[bestYIdx];
                p.gx = nx[bestXIdx];
                p.gy = ny[bestYIdx];
                p.gName = `${p.gx}${p.gy}`;
                p.isInvalidPos = false;
            }
        });
    },

    /**
     * グリッド間隔（スパン）を変更
     * - 中間スパンの場合は境界通り芯を移動（右隣のスパンが自動増減し元幅を維持）
     * - 端部スパンの場合は全体幅を増減
     */
    updateGridSpan: function(axis, spanIndex, newSpan, state) {
        const s = state || window.AppState;
        if (!s) return;
        newSpan = Math.round(parseFloat(newSpan));
        if (isNaN(newSpan) || newSpan <= 0) return;

        const isX = (axis.toUpperCase() === 'X');
        let coords = isX ? [...(s.gridXCoords || [])] : [...(s.gridYCoords || [])];
        if (spanIndex < 0 || spanIndex >= coords.length - 1) return;

        const oldCoords = [...coords];
        const oldSpan = coords[spanIndex + 1] - coords[spanIndex];
        const delta = newSpan - oldSpan;
        if (delta === 0) return;

        // 【確定修正①】spanIndex より後ろの全通り芯(idx > spanIndex)を一斉に +delta シフト移動させる
        const newCoords = coords.map((c, idx) => {
            if (idx > spanIndex) return Math.round(c + delta);
            return Math.round(c);
        });

        // 1. 全要素(柱, 壁, 開口, スラブ, 基礎梁, 人通口, 作図面積枠)の座標を新グリッド交点へ100%精密再配置
        this.rebindAllElements(isX ? 'X' : 'Y', oldCoords, newCoords, s);

        // 2. グリッド座標および名称マップの固定と連動更新
        s.isGridFixed = true;
        if (isX) {
            s.gridXCoords = newCoords;
            s.masterXs = newCoords;
            if (s.manualGridX) {
                s.manualGridX.forEach(m => {
                    oldCoords.forEach((oc, i) => {
                        if (Math.abs(m.coord - oc) < 5) m.coord = newCoords[i];
                    });
                });
            }
            if (s.userEditedGridX) {
                const newEdited = {};
                Object.keys(s.userEditedGridX).forEach(k => {
                    const val = s.userEditedGridX[k];
                    const numK = parseFloat(k);
                    let mapped = false;
                    oldCoords.forEach((oc, i) => {
                        if (Math.abs(numK - oc) < 5) {
                            newEdited[newCoords[i]] = val;
                            mapped = true;
                        }
                    });
                    if (!mapped) newEdited[k] = val;
                });
                s.userEditedGridX = newEdited;
            }
        } else {
            s.gridYCoords = newCoords;
            s.masterYs = newCoords;
            if (s.manualGridY) {
                s.manualGridY.forEach(m => {
                    oldCoords.forEach((oc, i) => {
                        if (Math.abs(m.coord - oc) < 5) m.coord = newCoords[i];
                    });
                });
            }
            if (s.userEditedGridY) {
                const newEdited = {};
                Object.keys(s.userEditedGridY).forEach(k => {
                    const val = s.userEditedGridY[k];
                    const numK = parseFloat(k);
                    let mapped = false;
                    oldCoords.forEach((oc, i) => {
                        if (Math.abs(numK - oc) < 5) {
                            newEdited[newCoords[i]] = val;
                            mapped = true;
                        }
                    });
                    if (!mapped) newEdited[k] = val;
                });
                s.userEditedGridY = newEdited;
            }
        }

        // 3. 通り芯・要素全体の再解析と描画更新
        this.analyzeGrids(s);
        if (window.AppController) window.AppController.refreshAll();
    },

    /**
     * グリッド座標変更に伴い、配置されている全要素の座標をマッピングして100%精密再配置
     */
    rebindAllElements: function(axis, oldCoords, newCoords, state) {
        const isX = (axis === 'X');
        const mapCoord = (val) => {
            if (val == null || !isFinite(val)) return val;
            let bestIdx = -1, minD = Infinity;
            oldCoords.forEach((oc, idx) => {
                const d = Math.abs(oc - val);
                if (d < minD) { minD = d; bestIdx = idx; }
            });
            // 【確定修正③】旧グリッド交点100mm以内の頂点のみを新通り芯座標へダイレクト100%代入（誤吸着リスク排除）
            if (bestIdx !== -1 && minD < 100) {
                return Math.round(newCoords[bestIdx]);
            }
            return val;
        };

        const mapPoint = (p) => {
            if (!p) return;
            if (isX) p.x = mapCoord(p.x);
            else p.y = mapCoord(p.y);
        };

        // 1. 柱
        (state.pillars || []).forEach(p => mapPoint(p));
        // 2. 壁
        (state.walls || []).forEach(w => { mapPoint(w.p1); mapPoint(w.p2); });
        // 3. 開口部
        (state.windows || []).forEach(win => { mapPoint(win.p1); mapPoint(win.p2); });
        // 4. 作図面積ポリゴン (areaLines) -> 100% グリッド同期
        (state.areaLines || []).forEach(a => {
            (a.vertices || []).forEach(v => mapPoint(v));
        });
        // 5. 基礎梁
        (state.foundationBeams || []).forEach(b => { mapPoint(b.p1); mapPoint(b.p2); });
        // 6. 基礎スラブ
        (state.foundationSlabs || []).forEach(sl => {
            (sl.vertices || []).forEach(v => mapPoint(v));
        });
        // 7. 人通口
        (state.manholes || []).forEach(mh => mapPoint(mh));
    },

    /**
     * 通り芯名の更新および全要素（柱等）の名称一括同期
     */
    updateGridName: function(axis, index, newName, state) {
        const s = state || window.AppState;
        if (!s) return;
        const name = (newName || '').trim();
        if (!name) return;

        s.isGridFixed = true;

        if (axis === 'X') {
            if (!s.gridXNames) s.gridXNames = [];
            s.gridXNames[index] = name;
            if (!s.userEditedGridX) s.userEditedGridX = {};
            if (s.gridXCoords && s.gridXCoords[index] != null) {
                const coord = s.gridXCoords[index];
                s.userEditedGridX[coord] = name;
                s.userEditedGridX[Math.round(coord)] = name;
            }
        } else if (axis === 'Y') {
            if (!s.gridYNames) s.gridYNames = [];
            s.gridYNames[index] = name;
            if (!s.userEditedGridY) s.userEditedGridY = {};
            if (s.gridYCoords && s.gridYCoords[index] != null) {
                const coord = s.gridYCoords[index];
                s.userEditedGridY[coord] = name;
                s.userEditedGridY[Math.round(coord)] = name;
            }
        }

        // 全柱および関連要素の名称を即座に再同期
        this.syncAllElementNames(s);
    },

    /**
     * 全柱および関連要素の名称・通り芯プロパティを再同期
     */
    syncAllElementNames: function(state) {
        const s = state || window.AppState;
        if (!s) return;

        (s.pillars || []).forEach(p => {
            if (p.isDeleted) return;
            const nm = this.getPillarName(p, s);
            p.name = nm;
            
            // gx, gy の同期
            const TOL = 250;
            const gXC = s.gridXCoords || [];
            const gXN = s.gridXNames || [];
            for (let i = 0; i < gXC.length; i++) {
                if (Math.abs(Number(gXC[i]) - Number(p.x)) < TOL) {
                    p.gx = gXN[i] || `X${i+1}`;
                    break;
                }
            }
            const gYC = s.gridYCoords || [];
            const gYN = s.gridYNames || [];
            for (let i = 0; i < gYC.length; i++) {
                if (Math.abs(Number(gYC[i]) - Number(p.y)) < TOL) {
                    p.gy = gYN[i] || `Y${i+1}`;
                    break;
                }
            }
        });

        // 選択中の柱プロパティパネルが表示されている場合は即座に再描画
        if (s.selectedPillar && window.PillarPropertyController && typeof window.PillarPropertyController.showPillarProps === 'function') {
            window.PillarPropertyController.showPillarProps(s.selectedPillar);
        }
    },

    /**
     * 柱の現在の座標から通り芯名を取得します
     */
    getPillarName: function(p, state) {
        if (!p) return '位置不明';
        const s = state || window.AppState || {};
        const TOL = 250;
        
        let bestXIndex = -1;
        let minXDist = Infinity;
        const gXC = s.gridXCoords || [];
        const gXN = s.gridXNames || [];
        for (let i = 0; i < gXC.length; i++) {
            const dist = Math.abs(Number(gXC[i]) - Number(p.x));
            if (dist < minXDist) {
                minXDist = dist;
                bestXIndex = i;
            }
        }
        let gx = (bestXIndex !== -1 && minXDist < TOL && gXN[bestXIndex]) ? gXN[bestXIndex] : (p.gx || '?');

        let bestYIndex = -1;
        let minYDist = Infinity;
        const gYC = s.gridYCoords || [];
        const gYN = s.gridYNames || [];
        for (let i = 0; i < gYC.length; i++) {
            const dist = Math.abs(Number(gYC[i]) - Number(p.y));
            if (dist < minYDist) {
                minYDist = dist;
                bestYIndex = i;
            }
        }
        let gy = (bestYIndex !== -1 && minYDist < TOL && gYN[bestYIndex]) ? gYN[bestYIndex] : (p.gy || '?');
        
        if (s.userEditedGridX && s.userEditedGridX[p.x]) gx = s.userEditedGridX[p.x];
        if (s.userEditedGridY && s.userEditedGridY[p.y]) gy = s.userEditedGridY[p.y];
        
        if (gx === '?' && gy === '?') return `(${Math.round(p.x)}, ${Math.round(p.y)})`;
        if (gx === '?') return `${gy}通り上`;
        if (gy === '?') return `${gx}通り上`;
        return `${gx}${gy}`;
    },

    /**
     * 4分割図の境界範囲を計算します
     */
    /**
     * 4分割図の境界範囲を計算します
     */
    get4DivisionBounds: function(floor, state) {
        const s = state || window.AppState;
        let xs = [], ys = [];
        // 床求積ポリゴン（AREA）を最優先として建物本体の範囲を算出
        const floorPolys = s.areaLines.filter(a => a.floor === floor && a.areaType !== 'attic' && a.areaType !== 'balcony');
        
        if (floorPolys.length > 0) {
            floorPolys.forEach(a => a.vertices.forEach(v => { xs.push(v.x); ys.push(v.y); }));
        } else if (s.areaLines && s.areaLines.length > 0) {
            s.areaLines.forEach(a => (a.vertices || []).forEach(v => { xs.push(v.x); ys.push(v.y); }));
        } else {
            // 柱から外郭範囲を判定（削除済みおよび位置無効な柱を除外）
            const validPillars = s.pillars.filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === floor || p.floor === 'ALL'));
            validPillars.forEach(p => { xs.push(p.x); ys.push(p.y); });
        }
        
        if (xs.length === 0 || ys.length === 0) return null;
        
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const W = maxX - minX, H = maxY - minY;
        if (W <= 0 || H <= 0) return null;

        const c = s.config || {};
        const zones = (c.div4Zones && c.div4Zones[floor]) ? c.div4Zones[floor] : { xt: null, xb: null, yl: null, yr: null };
        const zxt = zones.xt || (H / 4);
        const zxb = zones.xb || (H / 4);
        const zyl = zones.yl || (W / 4);
        const zyr = zones.yr || (W / 4);
        
        return { 
            minX, maxX, minY, maxY, W, H, 
            xLineL: minX + zyl, 
            xLineR: maxX - zyr, 
            yLineT: maxY - zxt, 
            yLineB: minY + zxb 
        };
    },

    /**
     * 梁または壁（線分）が属する通り芯名を統一的に取得します
     */
    getLineAxisName: function(p1, p2, state) {
        const s = state || window.AppState;
        const n1 = this.getPillarName(p1, s);
        const n2 = this.getPillarName(p2, s);

        // 0. [v2.5.0] 斜め通り芯の判定 (幾何学的一致を優先)
        if (s.manualGridAngle && s.manualGridAngle.length > 0) {
            for (const g of s.manualGridAngle) {
                if (!g.p1 || !g.p2) continue;
                // 直線の方程式 Ax + By + C = 0
                const A = g.p2.y - g.p1.y;
                const B = g.p1.x - g.p2.x;
                const C = g.p1.y * g.p2.x - g.p1.x * g.p2.y;
                const den = Math.hypot(A, B);
                if (den < 1) continue;

                // 線分の両端点から直線への距離を算出
                const d1 = Math.abs(A * p1.x + B * p1.y + C) / den;
                const d2 = Math.abs(A * p2.x + B * p2.y + C) / den;

                // [v2.5.21 堅牢化] 許容誤差を100mmから、極めて安全な「15mm」に縮小。
                // これにより1mm程度のグリッド座標ズレは完璧に許容しつつ、近接する隣の通り芯を誤認するリスクをゼロにします。
                if (d1 < 15 && d2 < 15) {
                    return g.name || 'DA';
                }
            }
        }
        
        const dx = Math.abs(p2.x - p1.x);
        const dy = Math.abs(p2.y - p1.y);
        const isHorizontal = dx >= dy;

        // 1. 両端の柱名の共通項から通りを特定 (X1Y1, X5Y1 -> Y1)
        if (n1 && n2) {
            const xNames = s.gridXNames || [];
            const yNames = s.gridYNames || [];
            const allNames = [...xNames, ...yNames];
            const common = allNames.filter(name => name && n1.includes(name) && n2.includes(name));
            if (common.length > 0) {
                // [v2.4.77] 長さが長いものを優先（例：X5よりもX5aを優先する）
                return common.sort((a, b) => b.length - a.length)[0];
            }
            
            // 正規表現による抽出試行 ([v2.4.77] 末尾のアルファベット枝番に対応)
            const axisRegex = /[A-Z]+\d+[a-zA-Z]*/gi;
            const m1 = n1.match(axisRegex);
            const m2 = n2.match(axisRegex);
            if (m1 && m2) {
                const commonFallback = m1.filter(pt => m2.includes(pt));
                if (commonFallback.length > 0) return commonFallback.sort((a, b) => b.length - a.length)[0];
            }
        }

        // 2. 共通項がない場合、中点から最も近いグリッド座標を探す
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        let best = '', minD = Infinity;
        if (isHorizontal) {
            (s.gridYCoords || []).forEach((gy, i) => { 
                const d = Math.abs(gy - mid.y);
                if (d < minD) { minD = d; best = s.gridYNames[i]; } 
            });
        } else {
            (s.gridXCoords || []).forEach((gx, i) => { 
                const d = Math.abs(gx - mid.x);
                if (d < minD) { minD = d; best = s.gridXNames[i]; } 
            });
        }
        return (minD < 250) ? best : '';
    },

    /**
     * [v2.7.0] Analyze and return the roof grid coordinates (combining standard grids + overhang offsets + manual roof grids)
     */
    getRoofGrids: function(state) {
        const s = state || window.AppState;

        let xs = [...(s.gridXCoords || [])];
        let ys = [...(s.gridYCoords || [])];

        // Add manual roof grids (containing eaves, keraba, or other types)
        const manualX = s.roofGridManualX || [];
        const manualY = s.roofGridManualY || [];
        xs = xs.concat(manualX.map(m => m.coord));
        ys = ys.concat(manualY.map(m => m.coord));

        // Deduplicate and sort
        const TOL = 5;
        const uniqX = [];
        xs.forEach(x => {
            if (!uniqX.some(ux => Math.abs(ux - x) < TOL)) uniqX.push(x);
        });
        const uniqY = [];
        ys.forEach(y => {
            if (!uniqY.some(uy => Math.abs(uy - y) < TOL)) uniqY.push(y);
        });

        uniqX.sort((a, b) => a - b);
        uniqY.sort((a, b) => a - b);

        return { x: uniqX, y: uniqY };
    }
};

window.getGridNameAt = function(x, y) {
    const state = window.AppState;
    if (!state) return `(${Math.round(x)}, ${Math.round(y)})`;
    return window.GridEngine.getPillarName({ x, y }, state);
};
