$path = "wall_4split_calc.js"
$text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

$text = [System.Text.RegularExpressions.Regex]::Replace($text, '(?s)function calcNValues\(\) \{.*?function calcDirectSupportRatio\(\) \{', "function calcNValues() {
    if (window.EngineNValue && window.EngineNValue.calculateNValues) {
        let params = {
            h1: getVal('n-h1') || 2.7,
            h2: getVal('n-h2') || 2.7,
            wRoof: (window.AppState.roofWeight + window.AppState.solarWeight + window.AppState.ceilingInsWeight) / 1000,
            wFloor: 0.60,
            hwList: getHardwareList(),
            p_d1: getVal('p-d1') || 105,
            p_d2: getVal('p-d2') || 105,
            getPillarName: window.getPillarName
        };
        window.EngineNValue.calculateNValues(pillars, walls, params);
    }
}

function calcDirectSupportRatio() {")

$updateCalcEndRegex = '(?s)        setIfEmpty\(`e-y-l\$\{suffix\}`.*?    \}\);\s*\}'
$updateCalcEndReplacement = '        setIfEmpty(`e-y-l${suffix}`, q_yl); setIfEmpty(`e-y-r${suffix}`, q_yr);
    });

    // --- Phase 1: 抽出した純粋エンジンの呼び出しと結果の単一ソース化 ---
    window.AppState.calcResults = window.AppState.calcResults || {};
    [''1F'', ''2F''].forEach(f => {
        let b = get4DivBounds(f);
        let cq = getVal(`c-q${f[0]}`);
        let reqDiv4Base = {
            ext: getVal(`e-x-t${f[0]}`),
            exb: getVal(`e-x-b${f[0]}`),
            eyl: getVal(`e-y-l${f[0]}`),
            eyr: getVal(`e-y-r${f[0]}`)
        };
        
        let wallAmt = null, div4Bal = null, cog = null;
        
        if (window.EngineWallAmount) {
            wallAmt = window.EngineWallAmount.calculateWallAmount(f, walls, b);
            div4Bal = window.EngineWallAmount.evaluate4SplitBalance(f, wallAmt.div4, reqDiv4Base, cq);
        }
        if (window.EngineCenterOfGravity) {
            cog = window.EngineCenterOfGravity.calculateCenterOfGravity(f, areaLines, pillars);
        }
        
        window.AppState.calcResults[`wallAmount_${f}`] = wallAmt;
        window.AppState.calcResults[`div4Balance_${f}`] = div4Bal;
        window.AppState.calcResults[`cog_${f}`] = cog;
        
        let wallOk = wallAmt && reqWall[f] && (wallAmt.existX >= reqWall[f].qX) && (wallAmt.existY >= reqWall[f].qY);
        let div4Ok = div4Bal && div4Bal.isOk;
        let lamOk = !pillars.some(p => !p.isDeleted && !p.isInvalidPos && p.floor === f && p.lambda != null && !p.lambdaOK);
        window.AppState.calcResults[`summary_${f}`] = { wallOk, div4Ok, lamOk, floorOk: wallOk && div4Ok && lamOk };
    });
}'

$text = [System.Text.RegularExpressions.Regex]::Replace($text, $updateCalcEndRegex, $updateCalcEndReplacement)
[System.IO.File]::WriteAllText($path, $text, [System.Text.Encoding]::UTF8)
