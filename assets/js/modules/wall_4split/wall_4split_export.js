// ==========================================
// wall_4split_export.js - 出力・保存・モーダル関連 (Phase 2)
// ==========================================

window.AppExport = {

    exportCSV: function () {
        if (typeof updateCalculations === 'function') updateCalculations();
        const { pillars } = window.AppState;
        
        // CSVヘッダー生成
        let c = '\uFEFF工事名,' + getStr('info-prj') + '\n事務所,' + getStr('info-office') + '\n設計者,' + getStr('info-name') + '\n\n■ N値計算結果\n階,X,Y,出隅,X方向計算式,X_N値,Y方向計算式,Y_N値,採用N値,金物\n';
        
        ['2F', '1F'].forEach(f => {
            pillars.filter(p => p.floor === f && !p.isDeleted && !p.isInvalidPos).forEach(p => {
                if (p.nValue > 0 || p.Ax > 0 || p.Ay > 0) {
                    c += `${f[0]},${p.gx},${p.gy},${p.isC ? '〇' : '×'},"${p.cStrX || ''}",${(p.nCalcX || 0).toFixed(2)},"${p.cStrY || ''}",${(p.nCalcY || 0).toFixed(2)},${(p.nValue || 0).toFixed(2)},${p.nMark || '-'}\n`;
                }
            });
        });
        
        let a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([c], { type: 'text/csv' }));
        a.download = 'jyouzen_n-value.csv';
        a.click();
    },

    exportDXF: function () {
        // AppStateから必要な変数を展開
        const { pillars, walls, gridXCoords, gridYCoords, gridXNames, gridYNames } = window.AppState;

        if (pillars.length === 0 && walls.length === 0) {
            alert("出力するデータがありません。");
            return;
        }

        const dxfHeader = () => {
            let dxf = "  0\nSECTION\n  2\nHEADER\n  9\n$ACADVER\n  1\nAC1009\n  9\n$DWGCODEPAGE\n  3\nANSI_932\n  0\nENDSEC\n";
            return dxf;
        };

        const dxfTables = () => {
            return "  0\nSECTION\n  2\nTABLES\n  0\nTABLE\n  2\nSTYLE\n 70\n1\n  0\nSTYLE\n  2\nSTANDARD\n 70\n0\n 40\n0.0\n 41\n1.0\n 50\n0.0\n 71\n0\n 42\n300.0\n  3\ntxt.shx\n  4\nextfont2.shx\n  0\nENDTAB\n  0\nENDSEC\n  0\nSECTION\n  2\nBLOCKS\n  0\nENDSEC\n";
        };

        const entities = [];
        const addLine = (layer, x1, y1, x2, y2) => {
            entities.push(`0\nLINE\n8\n${layer}\n10\n${x1.toFixed(3)}\n20\n${y1.toFixed(3)}\n30\n0.0\n11\n${x2.toFixed(3)}\n21\n${y2.toFixed(3)}\n31\n0.0`);
        };
        const addSquare = (layer, x, y, size = 150) => {
            let hs = size / 2;
            addLine(layer, x - hs, y - hs, x + hs, y - hs);
            addLine(layer, x + hs, y - hs, x + hs, y + hs);
            addLine(layer, x + hs, y + hs, x - hs, y + hs);
            addLine(layer, x - hs, y + hs, x - hs, y - hs);
        };
        const addText = (layer, x, y, text, height = 300) => {
            entities.push(`  0\nTEXT\n  8\n${layer}\n 10\n${x.toFixed(2)}\n 20\n${y.toFixed(2)}\n 40\n${height}\n  1\n${text}`);
        };

        if (gridXCoords.length > 0 && gridYCoords.length > 0) {
            let minX = Math.min(...gridXCoords) - 2000, maxX = Math.max(...gridXCoords) + 2000;
            let minY = Math.min(...gridYCoords) - 2000, maxY = Math.max(...gridYCoords) + 2000;
            gridXCoords.forEach((x, i) => {
                addLine('GRID', x, minY, x, maxY);
                if (gridXNames[i]) addText('GRID', x, maxY + 300, gridXNames[i], 300);
            });
            gridYCoords.forEach((y, i) => {
                addLine('GRID', minX, y, maxX, y);
                if (gridYNames[i]) addText('GRID', minX - 600, y, gridYNames[i], 300);
            });
        }

        pillars.filter(p => !p.isDeleted && !p.isInvalidPos).forEach(p => {
            const mark = p.manualMark || p.nMark;
            if (mark && mark !== '不要' && mark !== '-') {
                addSquare(`HW_${p.floor}`, p.x, p.y, 150);
                addText(`HW_${p.floor}`, p.x, p.y, mark, 300);
            }
            const metalText = p.hardware || p.jointMetal || "";
            if (metalText) addText('METAL_TEXT', p.x + 200, p.y + 200, metalText, 300);
        });

        let legendMinX = (gridXCoords.length > 0) ? Math.min(...gridXCoords) - 4000 : -2000;
        let legendMaxY = (gridYCoords.length > 0) ? Math.max(...gridYCoords) + 1000 : 2000;

        const legends = [
            "【金物凡例】", "L  : 平金物・かど金物", "V  : 山形プレート (VP)", 
            "Is : 柱頭柱脚金物 (は)", "Ps : 柱頭柱脚金物 (に)", "2  : 10kN用 (HD10等)", 
            "3  : 15kN用 (HD15等)", "4  : 20kN用 (HD20等)", "5  : 25kN用 (HD25等)", "32 : 32kN用等"
        ];
        let legY = legendMaxY;
        legends.forEach(t => { addText('METAL_TEXT', legendMinX, legY, t, 300); legY -= 450; });

        walls.forEach(w => {
            const layer = `WALL_${w.floor}`;
            const mx = (w.p1.x + w.p2.x) / 2, my = (w.p1.y + w.p2.y) / 2;
            addLine(layer, w.p1.x, w.p1.y, w.p2.x, w.p2.y);
            if (w.totalVal && w.totalVal > 0) addText(layer, mx, my + 100, w.totalVal.toFixed(1), 300);
            if (w.isTasuki && w.braceVal > 0) addText(layer, mx, my - 150, `た${w.braceVal.toFixed(1)}`, 300);
        });

        let dxfEntities = "  0\nSECTION\n  2\nENTITIES\n" + (entities.length > 0 ? entities.join('\n') + "\n" : "") + "  0\nENDSEC\n  0\nEOF\n";
        const dxfContent = dxfHeader() + dxfTables() + dxfEntities;

        const unicodeArray = Encoding.stringToCode(dxfContent);
        const sjisArray = Encoding.convert(unicodeArray, { to: 'SJIS', from: 'UNICODE' });
        const blob = new Blob([new Uint8Array(sjisArray)], { type: 'application/x-dxf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        const d = new Date();
        const prj = getStr('info-prj') || 'project';
        a.download = `${prj}_壁量計算_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.dxf`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    },

    saveData: function () {
        const state = window.AppState;
        let customWalls = [];
        document.querySelectorAll('.cust-wall-row').forEach(row => {
            let n = row.querySelector('.cust-w-n').value, v = row.querySelector('.cust-w-v').value;
            if (n || v) customWalls.push({ n, v });
        });
        let customHws = [];
        document.querySelectorAll('.cust-hw-row').forEach(row => {
            let n = row.querySelector('.cust-h-n').value, v = row.querySelector('.cust-h-v').value;
            if (n || v) customHws.push({ n, v });
        });

        let minimalBgLines = state.bgLinesOriginal.map(e => {
            let minE = { type: e.type, floor: e.floor, isUnderlay: e.isUnderlay, isGridLine: e.isGridLine, closed: e.closed };
            if (e.vertices) minE.vertices = e.vertices.map(v => ({ x: v.x, y: v.y }));
            if (e.center) minE.center = { x: e.center.x, y: e.center.y };
            if (e.radius !== undefined) minE.radius = e.radius;
            if (e.startAngle !== undefined) minE.startAngle = e.startAngle;
            if (e.endAngle !== undefined) minE.endAngle = e.endAngle;
            return minE;
        });

        let docDrawingsRaw = {
            floor: state.docDrawings.floor?.rawDxf || null,
            elev: state.docDrawings.elev?.rawDxf || null,
            div4: state.docDrawings.div4?.rawDxf || null
        };

        let d = {
            inputs: {}, pillars: state.pillars, walls: state.walls, windows: state.windowsArr,
            texts: state.bgTextsOriginal, gridBubbles: state.gridBubbles, pIdCounter: state.pIdCounter,
            gx: state.gridXNames, gy: state.gridYNames, gxc: state.gridXCoords, gyc: state.gridYCoords,
            bgLines: minimalBgLines, areaLines: state.areaLines, mgX: state.manualGridX, mgY: state.manualGridY, mgAngle: state.manualGridAngle || [],
            roofFaces: state.roofFaces || [], // [v2.7.0]
            roofGridManualX: state.roofGridManualX || [], // [v2.7.0]
            roofGridManualY: state.roofGridManualY || [], // [v2.7.0]
            scale: state.scale, offsetX: state.offsetX, offsetY: state.offsetY, customWalls, customHws,
            layerVisibility: typeof appLayerVisibility !== 'undefined' ? appLayerVisibility : {},
            ueGX: state.userEditedGridX, ueGY: state.userEditedGridY,
            docDrawingsRaw: docDrawingsRaw,
            deletedGX: state.deletedGridX, deletedGY: state.deletedGridY,
            // [バグ修正 基礎データのセーブ・ロード対応] 基礎用データを追加
            foundationSlabs: state.foundationSlabs || [],
            exteriorWalls: state.exteriorWalls || [],
            foundationBeams: state.foundationBeams || [],
            manholes: state.manholes || [],
            concreteFc: state.concreteFc || 21,
            averageGroundPressure: Math.max(0, state.averageGroundPressure || 0)
        };
        
        document.querySelectorAll('input:not([type="file"]),select').forEach(e => { if (e.id) d.inputs[e.id] = e.value; });
        let a = document.createElement('a'); 
        a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' })); 
        a.download = 'jyouzen_data.json'; a.click();
    },

    showRatioModal: function () {
        if (!window.StructuralEngine || !window.StructuralEngine.calculateDirectSupportRatio) return;
        let r = window.StructuralEngine.calculateDirectSupportRatio(window.AppState);

        let getJ = (val, th1, th2) => {
            if (val < th1) return `<span style="background:#e74c3c;color:#fff;padding:2px 5px;border-radius:3px;">危険</span>`;
            if (val < th2) return `<span style="background:#f1c40f;color:#333;padding:2px 5px;border-radius:3px;">注意</span>`;
            return `<span style="background:#3498db;color:#fff;padding:2px 5px;border-radius:3px;">良好</span>`;
        };

        let html = `
        <table class="report-table" style="width:100%; font-size:14px;">
            <tr><th colspan="5">柱 直下率</th></tr>
            <tr><td>2階 柱数</td><td>${r.pCount2F} 本</td><td>直下柱数</td><td>${r.pMatch} 本</td><td>${getJ(r.pRatio, 50, 60)}</td></tr>
            <tr><td colspan="4" style="text-align:right; font-weight:bold;">柱 直下率：</td><td style="font-weight:bold; color:#0056b3; font-size:16px;">${r.pRatio.toFixed(1)} %</td></tr>
        </table>
        <table class="report-table" style="width:100%; font-size:14px; margin-top:15px;">
            <tr><th colspan="5">壁 直下率</th></tr>
            <tr><td>X方向 2階実長</td><td>${r.wLen2FX.toFixed(2)} m</td><td>直下壁長</td><td>${r.wMatchX.toFixed(2)} m</td><td>${getJ(r.wRatioX, 40, 60)}</td></tr>
            <tr><td colspan="4" style="text-align:right; font-weight:bold;">X方向 直下率：</td><td style="font-weight:bold; color:#0056b3; font-size:16px;">${r.wRatioX.toFixed(1)} %</td></tr>
            <tr><td colspan="5"></td></tr>
            <tr><td>Y方向 2階実長</td><td>${r.wLen2FY.toFixed(2)} m</td><td>直下壁長</td><td>${r.wMatchY.toFixed(2)} m</td><td>${getJ(r.wRatioY, 40, 60)}</td></tr>
            <tr><td colspan="4" style="text-align:right; font-weight:bold;">Y方向 直下率：</td><td style="font-weight:bold; color:#0056b3; font-size:16px;">${r.wRatioY.toFixed(1)} %</td></tr>
            <tr style="background:#f9f9f9;"><td colspan="4" style="text-align:right; font-weight:bold;">壁 総合直下率：</td><td style="font-weight:bold; color:#d35400; font-size:16px;">${r.wRatioTotal.toFixed(1)} %</td></tr>
        </table>`;
        
        let rc = document.getElementById('ratio-container');
        if (rc) { rc.innerHTML = html; document.getElementById('modal-ratio').style.display = 'flex'; }
    },

    /**
     * 一括出力の「2. 耐力壁配置図 ＆ 壁量検定」をモーダル表示
     */
    showWallSummaryModal: function() {
        const modal = document.getElementById('modal-wall-summary');
        const container = document.getElementById('wall-summary-modal-container');
        if (!modal || !container) return;

        if (typeof updateCalculations === 'function') updateCalculations();
        
        const state = window.AppState;
        const walls = state.walls || [];
        const reqWall = state.reqWall || {};
        const getVal = window.MathUtils ? window.MathUtils.getVal : ((id) => parseFloat(document.getElementById(id)?.value) || 0);

        let globalLegendHtml = `
        <div style="font-size:11px; margin-top:8px; margin-bottom:12px; background:#f8f9fa; padding:8px; border:1px solid #e9ecef; border-radius:4px; line-height:1.6;">
            <b>【凡例・記号】</b><br>
            面材記号: <b>P</b>(構造用合板等) / <b>P1</b>(1面) / <b>P2</b>(2面) / <b>P+P</b>(両面張)<br>
            筋交記号: <b>／, ＼</b> (片掛け 1.5倍〜3.0倍) / <b>Ｘ</b> (たすき掛け 4.0倍〜5.0倍)
        </div>`;

        let html = `<div style="font-family:sans-serif; color:#333; line-height:1.5;">`;
        html += `<h3 style="color:#27ae60; border-bottom:2px solid #27ae60; padding-bottom:6px; margin-top:0;">■ 存在壁量リスト ＆ 壁量検定</h3>`;

        ['1F', '2F'].forEach(f => {
            let xl = [], yl = [], tX = 0, tY = 0;
            let xList = [], yList = [];
            walls.filter(w => w.floor === f).forEach(w => {
                let dx = Math.abs(w.p2.x - w.p1.x), dy = Math.abs(w.p2.y - w.p1.y);
                let L_wall = Math.sqrt(dx * dx + dy * dy) / 1000;
                if (L_wall === 0) return;
                let ratioX = Math.min(1, Math.max(-1, dx / 1000 / L_wall)), ratioY = Math.min(1, Math.max(-1, dy / 1000 / L_wall));
                let degX = Math.acos(ratioX) * 180 / Math.PI, degY = Math.acos(ratioY) * 180 / Math.PI;
                let tv = window.getWallTotalVal ? window.getWallTotalVal(w) : ((w.totalVal) || 0);
                let effMx = Math.floor(tv * (ratioX * ratioX) * 100) / 100;
                let effMy = Math.floor(tv * (ratioY * ratioY) * 100) / 100;
                let effX = effMx, effY = effMy;
                if (degX > 75 && L_wall < 1.82) effX = 0;
                if (degY > 75 && L_wall < 1.82) effY = 0;
                let isDiag = (degX > 0.1 && degX < 89.9) ? ' [✔斜]' : '';

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
                let braceLabel = (window.WallEngine && window.WallEngine.getBraceLabel) ? window.WallEngine.getBraceLabel(w.braceName, bV, w) : '';
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

            html += `<h4 style="margin-top:15px; color:#2c3e50;">【${f} 存在壁量リスト ＆ 検定】</h4>`;
            html += `<div style="display:flex; gap:15px; flex-wrap:wrap;">`;
            html += `<div style="flex:1; min-width:300px;"><table class="report-table" style="width:100%;"><tr><th colspan="5" style="background:#e8f4f8; color:#0056b3;">X方向壁 (${f})</th></tr><tr><th>通り芯</th><th>実長(m)</th><th>壁倍率・内訳</th><th>有効倍率</th><th>壁量(m)</th></tr>${xl.join('') || '<tr><td colspan="5">壁なし</td></tr>'}<tr style="background:#f1f9f5;"><b><td colspan="4">合計</td><td>${tX.toFixed(2)}m</td></b></tr></table></div>`;
            html += `<div style="flex:1; min-width:300px;"><table class="report-table" style="width:100%;"><tr><th colspan="5" style="background:#e8f4f8; color:#0056b3;">Y方向壁 (${f})</th></tr><tr><th>通り芯</th><th>実長(m)</th><th>壁倍率・内訳</th><th>有効倍率</th><th>壁量(m)</th></tr>${yl.join('') || '<tr><td colspan="5">壁なし</td></tr>'}<tr style="background:#f1f9f5;"><b><td colspan="4">合計</td><td>${tY.toFixed(2)}m</td></b></tr></table></div>`;
            html += `</div>`;

            html += globalLegendHtml;

            const rX = reqWall[f] ? reqWall[f].qX : 0;
            const rY = reqWall[f] ? reqWall[f].qY : 0;
            const okX = tX >= rX, okY = tY >= rY;

            html += `<table class="report-table" style="width:100%; max-width:500px; margin-top:10px; margin-bottom:25px;">
                <tr><th colspan="4" style="background:#27ae60; color:#fff;">${f} 壁量判定結果 (必要壁量 vs 存在壁量)</th></tr>
                <tr><th>加力方向</th><th>必要壁量(m)</th><th>存在壁量(m)</th><th>判定結果</th></tr>
                <tr><td>X方向 (間口)</td><td>${rX.toFixed(2)} m</td><td>${tX.toFixed(2)} m</td><td style="font-weight:bold; color:${okX ? '#27ae60' : '#e74c3c'};">${okX ? '✅ OK' : '❌ NG'}</td></tr>
                <tr><td>Y方向 (奥行)</td><td>${rY.toFixed(2)} m</td><td>${tY.toFixed(2)} m</td><td style="font-weight:bold; color:${okY ? '#27ae60' : '#e74c3c'};">${okY ? '✅ OK' : '❌ NG'}</td></tr>
            </table><hr style="border:0; border-top:1px dashed #ccc; margin:20px 0;">`;
        });

        html += `</div>`;
        container.innerHTML = html;
        modal.style.display = 'flex';
    }
};

window.showWallSummaryModal = function() {
    if (window.AppExport && window.AppExport.showWallSummaryModal) {
        window.AppExport.showWallSummaryModal();
    }
};
