/**
 * logic/WallEngine.js - Wall Property & Calculation Engine
 * v2.3.25 Refactoring
 */

window.WallEngine = {
    /**
     * Get the full specification for a wall panel ID
     */
    getWallSpec: function(id) {
        if (!id) return { id: "opt0", val: 0, text: "なし" };
        const master = window.AppState.getMasterWallList();
        return master.find(m => m.id === id) || { id: "opt0", val: 0, text: "なし" };
    },

    getMasterBraceList: function() {
        return window.AppState.getMasterBraceList();
    },

    /**
     * Get the full specification for a brace ID
     */
    getBraceSpec: function(id) {
        if (!id) return { id: "b0", val: 0, text: "なし" };
        const master = this.getMasterBraceList();
        // Fallback for direct numerical value
        if (!isNaN(id) && id !== "" && typeof id !== 'object') {
            return { id: "custom", val: parseFloat(id), text: "カスタム" };
        }
        return master.find(m => m.id === id) || { id: "b0", val: 0, text: "なし" };
    },

    getTotalMultiplier: function(wall) {
        if (!wall) return 0;
        
        // Lookup specs from master lists using IDs
        const outPanel = this.getWallSpec(wall.outPanelId);
        const inPanel  = this.getWallSpec(wall.inPanelId);
        const brace    = this.getBraceSpec(wall.braceId);

        let total = (outPanel.val || 0) + (inPanel.val || 0) + (brace.val || 0);

        // Fallback for legacy data (numerical values stored directly on the object)
        if (total === 0) {
            total = (wall.outPanelVal || 0) + (wall.inPanelVal || 0) + (wall.braceVal || 0);
        }
        return total;
    },

    /**
     * Determine if a wall is effectively an opening
     */
    isOpening: function(wall) {
        if (!wall) return false;
        const outSpec = this.getWallSpec(wall.outPanelId);
        return outSpec.type === 'opening';
    },

    /**
     * 筋交いの表示ラベルを取得します
     */
    getBraceLabel: function(braceName, braceVal, wall) {
        if (braceVal <= 0) return '';
        if (braceName) {
            if (braceName.includes('たすき') || braceName.includes('X')) return `筋 ${braceVal.toFixed(1)}(X)`;
            if (braceName.includes('◣') || braceName.includes('◣')) return `筋 ${braceVal.toFixed(1)}(◣)`;
            if (braceName.includes('／')) return `筋 ${braceVal.toFixed(1)}(／)`;
        }
        // 旧データ互換フォールバック
        if (wall && wall.isTasuki) return `筋 ${braceVal.toFixed(1)}(X)`;
        if (braceVal >= 4.0) return `筋 ${braceVal.toFixed(1)}(X)`;
        if (wall && wall.p1 && wall.p2) {
            let sdx = wall.p2.x - wall.p1.x;
            let sdy = wall.p2.y - wall.p1.y;
            if (Math.abs(sdx) > 100 && Math.abs(sdy) > 100) {
                return (sdx * sdy > 0) ? `筋 ${braceVal.toFixed(1)}(◣)` : `筋 ${braceVal.toFixed(1)}(／)`;
            }
        }
        return `筋 ${braceVal.toFixed(1)}`;
    },

    /**
     * Get the label (mark) for canvas rendering
     */
    getRenderMark: function(wall) {
        const outSpec = this.getWallSpec(wall.outPanelId);
        const inSpec  = this.getWallSpec(wall.inPanelId);
        
        let marks = [];
        if (outSpec.id !== "opt0") marks.push(outSpec.text.charAt(0));
        if (inSpec.id  !== "opt0") marks.push(inSpec.text.charAt(0));
        
        return marks.join('+');
    },

    /**
     * Calculate required wall amounts (Faithful Port v2.1.1)
     */
    calculateRequirements: function(state) {
        const s = state || window.AppState;
        const config = s.config;
        const isSeinou = config.calcMode === 'seinou';
        const atticH = config.atticHeight || 1.4;
        const atticRatio = atticH / 2.1;

        // Helper for area definitions and Step A generation
        const getAreaDef = (f, type, name) => {
            const manualKey = f + (type === 'floor' ? '' : '_' + type);
            const manualVal = s.config.floorAreas[manualKey] || 0;

            let target = s.areaLines.filter(a => a.floor === f && a.areaType === type);
            if (target.length > 0) {
                let parts = []; let total = 0;
                target.forEach(a => {
                    let area = window.MathUtils.polygonArea(a.vertices) / 1000000;
                    let formula = window.MathUtils.getAreaFormula(a.vertices);
                    parts.push({ area, formula }); 
                    total += area;
                });
                
                // If drawn total matches manual total (within rounding), show breakdown
                if (Math.abs(total - manualVal) < 0.01) {
                    let stepA = `[作図の${name}面積合算]<br>` + parts.map((p, i) => ` ・図形(${i+1}): ${p.formula}`).join('<br>') + `<br> ＝ 合計 ${total.toFixed(2)}㎡`;
                    return { val: manualVal, stepA };
                } else {
                    let breakdown = parts.map((p, i) => ` ・図形(${i+1}): ${p.formula}`).join('<br>');
                    return { val: manualVal, stepA: `[手動修正済み] ${manualVal.toFixed(2)}㎡<br>${breakdown}<br>(※作図合計:${total.toFixed(2)}㎡)` };
                }
            }
            // Fallback for manual inputs
            return { val: manualVal, stepA: manualVal > 0 ? `[入力値] = ${manualVal.toFixed(2)}㎡` : null };
        };

        const af1 = getAreaDef('1F', 'floor', '1F床');
        const aa1 = getAreaDef('1F', 'attic', '1F小屋裏');
        const ab1 = getAreaDef('1F', 'balcony', '1Fバルコニー');
        const ap1 = getAreaDef('1F', 'porch', '1Fポーチ・屋根');
        const af2 = getAreaDef('2F', 'floor', '2F床');
        const aa2 = getAreaDef('2F', 'attic', '2F小屋裏');
        const ab2 = getAreaDef('2F', 'balcony', '2Fバルコニー');
        const av2 = getAreaDef('2F', 'void', '2F吹き抜け');

        const makeStepB = (name, rawVal, loadFactor, factorStr) => {
            if (rawVal <= 0) return null;
            if (loadFactor === 1.0) return `[${name}の加算分] = ${rawVal.toFixed(2)}㎡ (そのまま加算)`;
            return `[${name}の加算分] = ${rawVal.toFixed(2)}㎡ × ${factorStr} = ${(rawVal * loadFactor).toFixed(2)}㎡`;
        };

        // --- 1F ---
        let steps1F = [`<div style="margin-top:4px;"><b>【ステップA】面積要素の抽出 (${isSeinou ? '見上げ' : '見下げ'})</b></div>`];
        [af1, aa1, aa2, ap1, ab1].forEach(a => { if (a.stepA) steps1F.push(a.stepA); });
        
        steps1F.push('<div style="margin-top:8px;"><b>【ステップB】地震力算定用面積への換算</b></div>');
        if (af1.val > 0) steps1F.push(makeStepB('1F床', af1.val, 1.0));
        if (aa1.val > 0) steps1F.push(makeStepB('1F小屋裏', aa1.val, atticRatio, `(${atticH}/2.1)`));
        if (aa2.val > 0) steps1F.push(makeStepB('2F小屋裏(1F荷重)', aa2.val, atticRatio, `(${atticH}/2.1)`));
        
        if (isSeinou) {
            if (av2.val > 0) steps1F.push(makeStepB('2F吹き抜け(荷重加算)', av2.val, 1.0));
            if (ap1.val > 0) steps1F.push(makeStepB('1Fポーチ・屋根(性能表示加算)', ap1.val, 1.0));
            if (ab1.val > 0) steps1F.push(makeStepB('1Fバルコニー(性能表示加算)', ab1.val, 0.4, '0.4'));
        } else {
            steps1F.push('<div style="font-size:9px;color:#888;">※基準法モードのため加算なし</div>');
        }

        let a1_seismic = af1.val + (aa1.val * atticRatio) + (aa2.val * atticRatio);
        if (isSeinou) a1_seismic += av2.val + ap1.val + (ab1.val * 0.4);

        // --- 2F ---
        let steps2F = [`<div style="margin-top:4px;"><b>【ステップA】面積要素の抽出 (${isSeinou ? '見上げ' : '見下げ'})</b></div>`];
        [af2, aa2, av2, ap1, ab1].forEach(a => { if (a.stepA) steps2F.push(a.stepA); });
 
        steps2F.push('<div style="margin-top:8px;"><b>【ステップB】地震力算定用面積への換算</b></div>');
        if (af2.val > 0) steps2F.push(makeStepB('2F床', af2.val, 1.0));
        if (aa2.val > 0) steps2F.push(makeStepB('2F小屋裏', aa2.val, atticRatio, `(${atticH}/2.1)`));
        
        if (isSeinou) {
            if (av2.val > 0) steps2F.push(makeStepB('2F吹き抜け(性能表示加算)', av2.val, 1.0));
            if (ap1.val > 0) steps2F.push(makeStepB('1Fポーチ・屋根(荷重加算)', ap1.val, 1.0));
            if (ab1.val > 0) steps2F.push(makeStepB('1Fバルコニー(荷重加算)', ab1.val, 0.4, '0.4'));
        } else {
            steps2F.push('<div style="font-size:9px;color:#888;">※基準法モードのため加算なし</div>');
        }

        let a2_seismic = af2.val + (aa2.val * atticRatio);
        if (isSeinou) a2_seismic += av2.val + ap1.val + (ab1.val * 0.4);

        // Apply results to state
        s.reqWall['1F'].a_eff = a1_seismic;
        s.reqWall['1F'].basis = steps1F.join('<br>');
        s.reqWall['2F'].a_eff = a2_seismic;
        s.reqWall['2F'].basis = steps2F.join('<br>');

        return s.reqWall;
    },

    /**
     * Calculate final design wall quantities including wind pressure checks
     */
    calculateDesignWalls: function(state) {
        const s = state || window.AppState;
        const config = s.config;
        const triMult = config.triangleMultiplier || 1.33;

        ['1F', '2F'].forEach(f => {
            const suffix = f === '1F' ? '1' : '2';
            const cq = config.reqWallCoeffs[f].seismic;
            const cw = config.reqWallCoeffs[f].wind;
            let awx = config.projectedAreas[f].x;
            let awy = config.projectedAreas[f].y;
            
            // 1F includes 2F's wind pressure area
            if (f === '1F') {
                awx += config.projectedAreas['2F'].x;
                awy += config.projectedAreas['2F'].y;
            }

            const a_seismic = s.reqWall[f].a_eff || 0;
            const eq = a_seismic * cq;
            
            // Seismic force vs Wind pressure (with triangle multiplier)
            const qX = Math.max(eq, awx * cw * triMult);
            const qY = Math.max(eq, awy * cw * triMult);

            s.reqWall[f].qX = qX;
            s.reqWall[f].qY = qY;
            s.reqWall[f].eq = eq;
        });

        return s.reqWall;
    },

    calculateSlabAt: function(typeStr, pitch) {
        const diaTbl = { 'D10': 71.3, 'D13': 126.7, 'D16': 198.6 };
        let area = 0;
        const normalized = (typeStr || '').replace(/\s+/g, '').replace('/', '');
        if (normalized === 'D10D13') area = (diaTbl['D10'] + diaTbl['D13']) / 2;
        else if (normalized === 'D13D16') area = (diaTbl['D13'] + diaTbl['D16']) / 2;
        else area = diaTbl[normalized] || 0;
        
        if (!pitch || pitch <= 0) return 0;
        return area * (1000 / pitch);
    }
};
