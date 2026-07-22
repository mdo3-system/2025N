// ==========================================
// wall_4split_foundation_engine.js
// [基礎計算追加 Phase4] 基礎梁 応力解析・断面検定エンジン
//
// 依存: wall_4split_state.js (AppState), wall_4split_calc.js (polygonArea等)
// ==========================================

// ============================================================
// 鉄筋コンクリート設計定数
// ============================================================
// [機能拡張 スラブ設計条件と自動判定]
// コンクリートと鉄筋の設計定数は、これまで定数だったものを関数またはAppState参照に切り替えます
const FD_COVER = 40; // かぶり厚さ (mm)

// コンクリート許容応力度計算ヘルパー
function fd_getConcreteAllowable(fc) {
    return {
        fc: fc,
        fck_L: fc / 3,
        ftk_L: 0.49 * Math.pow(fc, 1/3),
        fwk_L: fc / 3 / Math.sqrt(3)
    };
}

// ============================================================
// [基礎計算追加 Phase4] 鉄筋解析ヘルパー
// "1-D13" | "2-D16" 等の文字列から本数・直径・断面積を返す
// ============================================================
function fd_parseRebar(str) {
    if (!str || typeof str !== 'string') return { count: 0, dia: 0, area: 0 };
    const m = str.trim().match(/^(\d+)-D([A-Za-z0-9]+)/i);
    if (!m) return { count: 0, dia: 0, area: 0 };
    const count = parseInt(m[1], 10);
    const typeStr = m[2].toUpperCase();
    
    const diaTbl = { 10: 71.33, 13: 126.7, 16: 198.6, 19: 286.5, 22: 387.1, 25: 506.7, 29: 642.4, 32: 794.2 };
    
    let area1 = 0;
    let dia = 0;
    if (typeStr === '13D16') {
        area1 = diaTbl[13] + diaTbl[16];
        dia = 16;
    } else if (typeStr === '13D19') {
        area1 = diaTbl[13] + diaTbl[19];
        dia = 19;
    } else if (typeStr === '16D19') {
        area1 = diaTbl[16] + diaTbl[19];
        dia = 19;
    } else {
        dia = parseInt(typeStr, 10);
        area1 = diaTbl[dia] || (Math.PI * dia * dia / 4);
    }
    
    return { count, dia, area: count * area1 };
}

// ============================================================
// [機能拡張 スラブ設計条件と自動判定] 鉄筋強度の自動判定
// 文字列に '19' または '22' が含まれる場合は SD345、それ以外は SD295
// ============================================================
function fd_getSteelStrength(str) {
    if (!str) return { ft: 195, fts: 295, type: 'SD295' };
    const isSD345 = /19|22/.test(str);
    if (isSD345) {
        return { ft: 215, fts: 345, type: 'SD345' };
    }
    return { ft: 195, fts: 295, type: 'SD295' };
}

// ============================================================
// [基礎計算追加 Phase4] せん断補強筋解析
// "1-D10@200" → { count, dia, pitch }
// ============================================================
function fd_parseStirrups(str) {
    if (!str || typeof str !== 'string') return { count: 1, dia: 10, pitch: 200, area: 71.33 };
    const m = str.trim().match(/^(\d+)-D(\d+)@(\d+)/i);
    if (!m) return { count: 1, dia: 10, pitch: 200, area: 71.33 };
    const count = parseInt(m[1], 10);
    const dia   = parseInt(m[2], 10);
    const pitch = parseInt(m[3], 10);
    const diaTbl = { 10: 71.33, 13: 126.7, 16: 198.6, 19: 286.5, 22: 387.1 };
    const area1 = diaTbl[dia] || (Math.PI * dia * dia / 4);
    return { count, dia, pitch, area: count * area1 };
}

// ============================================================
// [機能追加 応力計算ロジックの厳密化] 断面許容耐力の計算 (割増係数αの厳密化)
function calculateAllowableBeamCapacity(beam, stressData = {}) {
    const p = beam.props || {};
    const b  = p.width  || 150;   // 梁幅 (mm)
    const h  = p.height || 640;   // 梁成 (mm)
    const dt = p.coverDepth || 70; // 有効せい算出用のかぶり (mm)
    const d  = h - dt;            // 有効せい (mm)
    const j  = d * 7 / 8;         // 応力中心距離

    const fcVal = window.AppState.concreteFc || 21;
    const conc = fd_getConcreteAllowable(fcVal);

    const topRebarStr = p.topRebar    || '1-D13';
    const botRebarStr = p.bottomRebar || '1-D13';
    const stStr       = p.stirrup     || '1-D10@200';

    const topRebar = fd_parseRebar(topRebarStr);
    const botRebar = fd_parseRebar(botRebarStr);
    const st       = fd_parseStirrups(stStr);

    const topSteel = fd_getSteelStrength(topRebarStr);
    const botSteel = fd_getSteelStrength(botRebarStr);
    const stSteel  = fd_getSteelStrength(stStr);

    // 曲げ耐力 (上端・下端)
    const lMa_t = topRebar.area * topSteel.ft * j;
    const lMa_b = botRebar.area * botSteel.ft * j;
    const sMa_t = lMa_t * 1.5;
    const sMa_b = lMa_b * 1.5;

    // --- せん断割増係数 α の厳密計算 ---
    // 長期 α = 4 / ((M_end_L / (Q_L * d)) + 1)
    const ML = Math.abs(stressData.M_long_end_Nmm || 0);
    const QL = Math.abs(stressData.Q_long_N || 0);
    let m_qd_L = (QL * d > 0) ? ML / (QL * d) : 1.0;
    const alpha_L = Math.max(1.0, Math.min(2.0, 4 / (m_qd_L + 1)));

    // 短期 α = 4 / (((M_end_L + M_short_end - Mwf) / ((Q_L + Qe) * d)) + 1)
    // ※ ここでは M_short_end と Mwf を区別して扱う仕様に基づき計算
    const MS_sum = Math.abs((stressData.M_long_end_Nmm || 0) + (stressData.M_short_end_Nmm || 0) - (stressData.Mwf_Nmm || 0));
    const QS_sum = Math.abs((stressData.Q_long_N || 0) + (stressData.Qe_N || 0));
    let m_qd_S = (QS_sum * d > 0) ? MS_sum / (QS_sum * d) : 1.0;
    const alpha_S = Math.max(1.0, Math.min(2.0, 4 / (m_qd_S + 1)));

    const pw = (b * st.pitch) > 0 ? st.area / (b * st.pitch) : 0;
    const Qa_steel_L = st.area * (stSteel.fts / 1.5) * j / st.pitch;
    const Qa_steel_S = Qa_steel_L * 1.5;

    const lQa = (alpha_L * conc.fwk_L * b * j) + Qa_steel_L;
    const sQa = (alpha_S * conc.fwk_L * b * j * 1.5) + Qa_steel_S;

    return {
        b, h, d, j, dt, pw,
        lMa_t, lMa_b, sMa_t, sMa_b, lQa, sQa,
        topRebar, botRebar, st,
        fc: fcVal, botSteelType: botSteel.type, stSteelType: stSteel.type,
        alpha_L, alpha_S, m_qd_L, m_qd_S,
        // UI互換用
        Ma_L: lMa_b, Ma_S: sMa_b, Qa_L: lQa, Qa_S: sQa, At: botRebar.area
    };
}

// ============================================================
// [機能追加 応力計算ロジックの厳密化] 長期応力解析 (両端固定/連続梁モデル)
function generateFoundationLongTermStressTable(beam, allSlabs, allBeams) {
    const p = beam.props || {};
    const dx = beam.p2.x - beam.p1.x;
    const dy = beam.p2.y - beam.p1.y;
    const L_mm = Math.hypot(dx, dy);
    if (L_mm < 1) return null;

    // ---- 1. 荷重集計 ----
    let beamTotalLoad_kN = 0;
    let totalTribArea_m2 = 0;
    (allSlabs || []).forEach(slab => {
        const qSlab = slab.fdStress ? slab.fdStress.qTotal : 12.0;
        (slab.tributaryPolygons || []).forEach(tp => {
            if (tp.beamId === beam.id) {
                const area_m2 = tp.area / 1e6;
                beamTotalLoad_kN += qSlab * area_m2;
                totalTribArea_m2 += area_m2;
            }
        });
    });

    const spanM_geom = L_mm / 1000;
    let wL_kN_m = spanM_geom > 0 ? beamTotalLoad_kN / spanM_geom : 0;
    
    const tributaryWidth_m = spanM_geom > 0 ? totalTribArea_m2 / spanM_geom : 0;
    const qTotal           = totalTribArea_m2 > 0 ? beamTotalLoad_kN / totalTribArea_m2 : 0;
    
    // 梁自重
    const slabTopH = p.slabTopHeight || 50;
    const selfWeight_kN_m = (p.width || 150) * ((p.height || 640) - slabTopH) / 1e6 * 24;
    wL_kN_m += selfWeight_kN_m;

    const spanM = spanM_geom;

    // --- 両端固定モデルによる応力算定 ---
    const M_mid_kNm = (wL_kN_m * spanM * spanM) / 8;  // 中央 1/8 (実務上、安全側に 1/8 を採用する場合が多い)
    const M_end_kNm = (wL_kN_m * spanM * spanM) / 12; // 端部 1/12
    const Q_max_kN  = (wL_kN_m * spanM) / 2;          // せん断 1/2

    return {
        L_mm, spanM, wL_kN_m, tributaryWidth_m,
        totalTribArea_m2, qTotal,
        M_mid_kNm, M_end_kNm, Q_max_kN,
        M_mid_Nmm: M_mid_kNm * 1e6,
        M_end_Nmm: M_end_kNm * 1e6,
        Q_L_N:   Q_max_kN  * 1e3,
        M_max_kNm: Math.max(M_mid_kNm, M_end_kNm), 
        M_max_Nmm: Math.max(M_mid_kNm, M_end_kNm) * 1e6, 
        Q_max_N: Q_max_kN * 1e3
    };
}

// [バグ修正 通り芯名変換と応力伝達の型安全化] 座標から通り芯名への逆引き
window.getGridNameAt = function(x, y) {
    const TOL = 250; // Generous tolerance as pillars are guaranteed to be at grid intersections
    let xName = "", yName = "";
    const gXC = window.AppState.gridXCoords || [];
    const gXN = window.AppState.gridXNames || [];
    const gYC = window.AppState.gridYCoords || [];
    const gYN = window.AppState.gridYNames || [];
    
    let bestXIndex = -1;
    let minXDist = Infinity;
    for(let i=0; i<gXC.length; i++) {
        const dist = Math.abs(Number(gXC[i]) - Number(x));
        if (dist < minXDist) {
            minXDist = dist;
            bestXIndex = i;
        }
    }
    if (bestXIndex !== -1 && minXDist < TOL) xName = gXN[bestXIndex];

    let bestYIndex = -1;
    let minYDist = Infinity;
    for(let i=0; i<gYC.length; i++) {
        const dist = Math.abs(Number(gYC[i]) - Number(y));
        if (dist < minYDist) {
            minYDist = dist;
            bestYIndex = i;
        }
    }
    if (bestYIndex !== -1 && minYDist < TOL) yName = gYN[bestYIndex];
    
    // [バグ修正 文字化けの物理的修復] 通り芯名の結合 (ハイフンなしで美しく結合)
    if(xName && yName) return `${xName}${yName}`;
    if(xName) return `${xName}通り上`;
    if(yName) return `${yName}通り上`;
    return `(${Math.round(x)}, ${Math.round(y)})`;
};
const getGridNameFromCoords = window.getGridNameAt;

// ============================================================
// [機能追加 応力計算ロジックの厳密化] 短期(水平時)応力解析 (連続梁・耐力壁軸力ベース)
function calculateFoundationHorizontalStressData(beam, walls, h1) {
    if (!beam || !beam.spans || beam.spans.length === 0) return null;

    // [バグ修正 通り芯名変換と応力伝達の型安全化] 階高のフォールバック
    const h_eff = Number(h1) || 2800;

    // 1. ノードリストの作成と節点荷重 Td の集計
    // 連続梁の開始点からの相対距離で管理
    let nodes = [];
    let currentX = 0;
    nodes.push({ x: 0, node: beam.spans[0].startNode, Td_base: 0 });
    beam.spans.forEach(s => {
        currentX += (Number(s.spanLength) || 0);
        nodes.push({ x: currentX, node: s.endNode, Td_base: 0 });
    });
    const L_total = currentX;

    // 各ノードの Td_base ( α * 1.96 * H ) を算出
    // 注意: Td は壁の両端で逆方向（引抜/押え）に働く
    nodes.forEach(n => {
        // [バグ修正 座標マッチングの許容誤差導入] 判定条件を座標優先に修正。柱以外の交点ノードでも壁端点があれば受ける。
        if (n.node) {
            const TOL = 15;
            const nodeX = Number(n.node.x);
            const nodeY = Number(n.node.y);
            
            const connectedWalls = (walls || []).filter(w => 
                w.floor === '1F' && (
                    Math.hypot(Number(w.p1.x) - nodeX, Number(w.p1.y) - nodeY) < TOL || 
                    Math.hypot(Number(w.p2.x) - nodeX, Number(w.p2.y) - nodeY) < TOL
                )
            );
            
            connectedWalls.forEach(w => {
                // [バグ修正 通り芯名変換と応力伝達の型安全化] 堅牢な壁倍率取得
                const alpha = window.getWallTotalVal(w);
                
                if (alpha > 0) {
                    // [機能追加 上部データ連携と一括UI] 指定された算定式を用いて Td を算出
                    const dx_w = Math.abs(Number(w.p1.x) - Number(w.p2.x));
                    const dy_w = Math.abs(Number(w.p1.y) - Number(w.p2.y));
                    const Lw = Math.hypot(dx_w, dy_w) / 1000; // 壁長 (m)
                    if (Lw < 0.1) return;

                    const h_m = h_eff > 100 ? h_eff / 1000 : h_eff;
                    const N = (alpha * 1.96 * Lw) * h_m * 0.5 / Lw; // Td = (許容耐力 P = α * 1.96 * L) * H * B(0.5) / L

                    const isP1 = Math.hypot(Number(w.p1.x) - nodeX, Number(w.p1.y) - nodeY) < TOL;
                    
                    // 壁の他方の端点の X 座標を確認して方向を特定
                    const wallIsHorizontal = Math.abs(Number(w.p1.y) - Number(w.p2.y)) < 50; // [バグ修正 通り芯名変換と応力伝達の型安全化] 数値キャスト
                    const wallIsVertical = Math.abs(Number(w.p1.x) - Number(w.p2.x)) < 50;   // [バグ修正 通り芯名変換と応力伝達の型安全化] 数値キャスト
                    
                    // 梁の方向と同じ方向の壁のみ寄与させる（簡易化）
                    n.Td_base_list = n.Td_base_list || [];
                    n.Td_base_list.push({
                        N: N,
                        isStart: isP1, // 壁の定義上の始点
                        isLeftRel: isP1 ? (Number(w.p1.x) < Number(w.p2.x) || Number(w.p1.y) < Number(w.p2.y)) : (Number(w.p2.x) < Number(w.p1.x) || Number(w.p2.y) < Number(w.p1.y)) // [バグ修正 通り芯名変換と応力伝達の型安全化] 数値キャスト
                    });
                }
            });
        }
    });

    // 解析実行ヘルパー（加力方向を指定）
    const analyzePattern = (isLeftLoading) => {
        // Td の確定
        let Td = nodes.map(n => {
            let sum = 0;
            (n.Td_base_list || []).forEach(w => {
                // 左加力の場合: 左端が引抜(+)、右端が押え(-)
                // 右加力の場合: 逆
                let sign = w.isLeftRel ? 1 : -1;
                if (!isLeftLoading) sign *= -1;
                sum += (w.N * sign);
            });
            return sum;
        });

        // 回転モーメントの合計 ΣM = Σ(Td * x)
        let sumM = 0;
        nodes.forEach((n, i) => {
            sumM += Td[i] * n.x;
        });

        // 支点反力 R (両端支点を仮定)
        // N_0 = ΣM / L_total (右端の反力)
        const N_end = L_total > 0 ? sumM / L_total : 0;
        const R_start = -N_end; // 左端の反力 (簡易釣合)

        // Qe, Mwf の累積計算
        let Qe = [];
        let Mwf = [];
        let currentQe = R_start;
        let currentMwf = 0;

        // 初期ノード荷重の加算
        currentQe += Td[0];

        for (let i = 0; i < beam.spans.length; i++) {
            Qe.push(currentQe);
            Mwf.push(currentMwf);

            const interval = beam.spans[i].spanLength;
            currentMwf += (currentQe * interval / 1000); // kN·m
            currentQe += Td[i + 1];
        }

        return { Td, R_start, N_end, Qe, Mwf };
    };

    const left = analyzePattern(true);
    const right = analyzePattern(false);

    return {
        left,
        right,
        spanM: L_total / 1000
    };
}

// ============================================================
// [基礎梁計算Step1 応力耐力エンジン] 全基礎梁の応力解析・断面検定を実行
// 各 beam オブジェクトに spans 配列として詳細データを格納
// ============================================================
// [機能追加 応力計算ロジックの厳密化] 全基礎梁の応力解析・断面検定を実行
function OBSOLETE_runFoundationBeamAnalysis(beams, slabs) {
    if (!beams || beams.length === 0) return;

    // 階高の取得 (デフォルト 2.7m)
    const h1 = (typeof getVal === 'function' ? getVal('n-h1') : 2.7) || 2.7;
    const walls = window.AppState.walls || [];

    (beams || []).forEach(beam => {
        // --- 1. 長期応力解析 (連続梁全体/代表) ---
        const lt_total = generateFoundationLongTermStressTable(beam, slabs, beams);
        if (!lt_total) { beam.spans = []; beam.fdStress = null; return; }

        // --- 2. 短期応力解析 (左右加力パターンの累積計算) ---
        const st_total = calculateFoundationHorizontalStressData(beam, walls, h1);

        let beamIsNG = false;
        const wL_kN_m = lt_total.wL_kN_m;

        if (beam.spans && beam.spans.length > 0) {
            beam.spans.forEach((span, i) => {
                const sL_mm = span.spanLength || 0;
                const spanM = sL_mm / 1000;
                
                // --- A. 長期応力 (スパンごと) ---
                // 両端固定モデル: 中央 wL^2/8, 端部 wL^2/12
                const sM_long_mid_kNm = (wL_kN_m * spanM * spanM) / 8;
                const sM_long_end_kNm = (wL_kN_m * spanM * spanM) / 12;
                const sQ_long_kNm = (wL_kN_m * spanM) / 2;

                const stressData = {
                    M_long_mid_Nmm: sM_long_mid_kNm * 1e6,
                    M_long_end_Nmm: sM_long_end_kNm * 1e6,
                    Q_long_N: sQ_long_kNm * 1e3
                };

                // --- B. 短期応力 (左右加力パターン) ---
                const stL = st_total ? st_total.left : null;
                const stR = st_total ? st_total.right : null;

                const leftPat = stL ? {
                    Td_kN: stL.Td[i],
                    Qe_kN: stL.Qe[i],
                    Mwf_kNm: stL.Mwf[i]
                } : null;

                const rightPat = stR ? {
                    Td_kN: stR.Td[i],
                    Qe_kN: stR.Qe[i],
                    Mwf_kNm: stR.Mwf[i]
                } : null;

                // --- C. 検定用の包絡応力 (Envelope) ---
                // α計算および検定には左・右パターンのうち不利な方を採用
                const Qe_max_N = Math.max(
                    leftPat ? Math.abs(leftPat.Qe_kN * 1000) : 0,
                    rightPat ? Math.abs(rightPat.Qe_kN * 1000) : 0
                );
                const Mwf_max_Nmm = Math.max(
                    leftPat ? Math.abs(leftPat.Mwf_kNm * 1e6) : 0,
                    rightPat ? Math.abs(rightPat.Mwf_kNm * 1e6) : 0
                );

                // calculateAllowableBeamCapacity 用に短期成分をセット
                // (ここでは簡易的に最大値を渡すが、本来は組み合わせごとに計算)
                stressData.Qe_N = Qe_max_N;
                stressData.Mwf_Nmm = Mwf_max_Nmm;
                stressData.M_short_end_Nmm = Mwf_max_Nmm; // フェイスモーメントを短期端部モーメントとして扱う

                // --- D. 断面検定 ---
                const spProps = span.props || beam.props;
                const cap = calculateAllowableBeamCapacity({ props: spProps }, stressData);

                // 検定比
                const ratioM_L = Math.max(stressData.M_long_mid_Nmm / cap.lMa_b, stressData.M_long_end_Nmm / cap.lMa_t);
                const ratioQ_L = stressData.Q_long_N / cap.lQa;

                const M_short_mid_Nmm = Mwf_max_Nmm / 2; // 短期中央モーメントの簡易想定
                const ratioM_S = Math.max(
                    (stressData.M_long_mid_Nmm + M_short_mid_Nmm) / cap.sMa_b,
                    (stressData.M_long_end_Nmm + stressData.M_short_end_Nmm) / cap.sMa_t
                );
                const ratioQ_S = (stressData.Q_long_N + stressData.Qe_N) / cap.sQa;

                const isNG = (ratioM_L > 1.0 || ratioQ_L > 1.0 || ratioM_S > 1.0 || ratioQ_S > 1.0);
                if (isNG) beamIsNG = true;

                // スパンデータへの格納
                span.fdStress = {
                    spanM, wL_kN_m,
                    stressData,
                    leftPat, rightPat,
                    cap,
                    ratioM_L, ratioQ_L, ratioM_S, ratioQ_S,
                    isNG
                };
                
                // [バグ修正 通り芯名変換と応力伝達の型安全化] スパンの終端ノードのTdも保持 (レポート表示用)
                if (i === beam.spans.length - 1) {
                    if (stL) span.fdStress.leftPat.lastTd_kN = stL.Td[i+1];
                    if (stR) span.fdStress.rightPat.lastTd_kN = stR.Td[i+1];
                }

                span.isNG = isNG;
            });
        }

        // 梁全体のサマリー (旧UI/帳票との互換性のためのフォールバック)
        beam.isNG = beamIsNG;
        if (beam.spans && beam.spans[0]) {
            beam.fdStress = beam.spans[0].fdStress; // 代表スパンをセット
        }
    });
}

// ============================================================
// [基礎計算追加 Phase4] HTML レポート生成
// 選択梁の応力・断面検定結果を ARCHITREND スタイルの表で返す
// ============================================================
function getFoundationBeamReportHtml(beam) {
    if (!beam || !beam.fdStress) {
        return '<p style="color:#888; padding:10px;">⚠️ 計算データがありません。作図後に更新を実行してください。</p>';
    }
    const bp = beam.props || {};
    let html = `<div class="foundation-beam-report" style="font-family:'Hiragino Kaku Gothic ProN','Meiryo',sans-serif; font-size:11px; line-height:1.4; color:#333;">
        <div style="background:#2c3e50; color:#fff; padding:6px 10px; font-weight:bold; font-size:12px; margin-bottom:10px; border-radius:3px;">
            📐 基礎梁断面検定 計算書（符号: ${bp.symbol || 'FG1'}）
        </div>
        
        <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:10px; border:1px solid #aaa;">
            <tr style="background:#f2f2f2;">
                <th style="border:1px solid #aaa; padding:4px; text-align:left; width:25%;">符号</th>
                <th style="border:1px solid #aaa; padding:4px; text-align:right; width:25%;">梁幅 W(mm)</th>
                <th style="border:1px solid #aaa; padding:4px; text-align:right; width:25%;">梁成 H(mm)</th>
                <th style="border:1px solid #aaa; padding:4px; text-align:right; width:25%;">根入深さ (mm)</th>
            </tr>
            <tr>
                <td style="border:1px solid #aaa; padding:4px; font-weight:bold;">${bp.symbol || 'FG1'}</td>
                <td style="border:1px solid #aaa; padding:4px; text-align:right;">${bp.width || 150}</td>
                <td style="border:1px solid #aaa; padding:4px; text-align:right;">${bp.height || 640}</td>
                <td style="border:1px solid #aaa; padding:4px; text-align:right;">${bp.embedDepth || 250}</td>
            </tr>
            <tr style="background:#f2f2f2;">
                <th style="border:1px solid #aaa; padding:4px; text-align:left;">上部主筋</th>
                <th style="border:1px solid #aaa; padding:4px; text-align:left;">下部主筋</th>
                <th colspan="2" style="border:1px solid #aaa; padding:4px; text-align:left;">ST筋 (あばら筋)</th>
            </tr>
            <tr>
                <td style="border:1px solid #aaa; padding:4px;">${bp.topRebar || '1-D13'}</td>
                <td style="border:1px solid #aaa; padding:4px;">${bp.bottomRebar || '1-D13'}</td>
                <td colspan="2" style="border:1px solid #aaa; padding:4px;">${bp.stirrup || '1-D10@200'}</td>
            </tr>
        </table>`;

    if (beam.fdStress && beam.fdStress.pillars && beam.fdStress.pillars.length > 0) {
        const pillars = beam.fdStress.pillars;
        const seismic = beam.fdStress.seismic;
        const spans = beam.fdStress.spans || [];

        const B_val = bp.B_val !== undefined ? parseFloat(bp.B_val) : 0.5;
        const modelType = bp.modelType || 'both_ends';
        const dispB = (modelType === 'pillar_supported') ? 1.0 : B_val;

        // Table 1: 応力の算定（水平荷重時）
        html += `<div style="font-weight:bold; margin-top:12px; margin-bottom:4px; font-size:11px;">(1) 応力の算定（水平荷重時）</div>
        <table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:10px; border:1px solid #aaa;">
            <thead>
                <tr style="background:#f2f2f2;">
                    <th rowspan="2" style="border:1px solid #aaa; padding:3px;">柱</th>
                    <th rowspan="2" style="border:1px solid #aaa; padding:3px;">x(m)</th>
                    <th colspan="4" style="border:1px solid #aaa; padding:3px; text-align:center;">左加力 (B=${dispB.toFixed(3)})</th>
                    <th colspan="4" style="border:1px solid #aaa; padding:3px; text-align:center;">右加力 (B=${dispB.toFixed(3)})</th>
                </tr>
                <tr style="background:#f2f2f2;">
                    <th style="border:1px solid #aaa; padding:2px;">Td</th>
                    <th style="border:1px solid #aaa; padding:2px;">R</th>
                    <th style="border:1px solid #aaa; padding:2px;">Qe</th>
                    <th style="border:1px solid #aaa; padding:2px;">Mf</th>
                    <th style="border:1px solid #aaa; padding:2px;">Td</th>
                    <th style="border:1px solid #aaa; padding:2px;">R</th>
                    <th style="border:1px solid #aaa; padding:2px;">Qe</th>
                    <th style="border:1px solid #aaa; padding:2px;">Mf</th>
                </tr>
            </thead>
            <tbody>`;
        pillars.forEach((p, idx) => {
            const l_Td = (seismic.leftward.Td[idx] || 0).toFixed(2);
            const l_R = (seismic.leftward.R ? (seismic.leftward.R[idx] ?? 0) : (idx === 0 ? seismic.leftward.R_left : (idx === pillars.length - 1 ? seismic.leftward.R_right : 0))).toFixed(2);
            const l_Qe = (seismic.leftward.Qe[idx] || 0).toFixed(2);
            const l_Mf = (seismic.leftward.Mf[idx] || 0).toFixed(2);

            const r_Td = (seismic.rightward.Td[idx] || 0).toFixed(2);
            const r_R = (seismic.rightward.R ? (seismic.rightward.R[idx] ?? 0) : (idx === 0 ? seismic.rightward.R_left : (idx === pillars.length - 1 ? seismic.rightward.R_right : 0))).toFixed(2);
            const r_Qe = (seismic.rightward.Qe[idx] || 0).toFixed(2);
            const r_Mf = (seismic.rightward.Mf[idx] || 0).toFixed(2);

            html += `<tr>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${p.name}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${p.x.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${l_Td}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${l_R}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${l_Qe}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${l_Mf}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${r_Td}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${r_R}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${r_Qe}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${r_Mf}</td>
            </tr>`;
        });
        html += `</tbody></table>`;

        // Table 2: 応力の算定（長期）
        html += `<div style="font-weight:bold; margin-top:10px; margin-bottom:4px; font-size:11px;">(2) 応力の算定（長期）</div>
        <table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:10px; border:1px solid #aaa;">
            <thead>
                <tr style="background:#f2f2f2;">
                    <th style="border:1px solid #aaa; padding:3px;">柱間</th>
                    <th style="border:1px solid #aaa; padding:3px;">長さL(m)</th>
                    <th style="border:1px solid #aaa; padding:3px;">σe (kN/㎡)</th>
                    <th style="border:1px solid #aaa; padding:3px;">負担幅 B(m)</th>
                    <th style="border:1px solid #aaa; padding:3px;">M中(kNm)</th>
                    <th style="border:1px solid #aaa; padding:3px;">M端(kNm)</th>
                    <th style="border:1px solid #aaa; padding:3px;">QL(kN)</th>
                </tr>
            </thead>
            <tbody>`;
        spans.forEach(span => {
            html += `<tr>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${span.spanName}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.L.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.sigma_e.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.B_trib.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${span.M_mid.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${span.M_end.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${span.Q_L.toFixed(2)}</td>
            </tr>`;
        });
        html += `</tbody></table>`;

        // Table 3: 応力の算定（短期）
        html += `<div style="font-weight:bold; margin-top:10px; margin-bottom:4px; font-size:11px;">(3) 応力の算定（短期）</div>
        <table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:10px; border:1px solid #aaa;">
            <thead>
                <tr style="background:#f2f2f2;">
                    <th rowspan="2" style="border:1px solid #aaa; padding:3px;">柱間</th>
                    <th colspan="3" style="border:1px solid #aaa; padding:3px; text-align:center;">左加力 (QL + 2.0Qe)</th>
                    <th colspan="3" style="border:1px solid #aaa; padding:3px; text-align:center;">右加力 (QL + 2.0Qe)</th>
                </tr>
                <tr style="background:#f2f2f2;">
                    <th style="border:1px solid #aaa; padding:2px;">M端(左)</th>
                    <th style="border:1px solid #aaa; padding:2px;">M端(右)</th>
                    <th style="border:1px solid #aaa; padding:2px;">QS (kN)</th>
                    <th style="border:1px solid #aaa; padding:2px;">M端(左)</th>
                    <th style="border:1px solid #aaa; padding:2px;">M端(右)</th>
                    <th style="border:1px solid #aaa; padding:2px;">QS (kN)</th>
                </tr>
            </thead>
            <tbody>`;
        spans.forEach(span => {
            html += `<tr>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${span.spanName}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.leftward.M_left.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.leftward.M_right.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${span.leftward.Q.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.rightward.M_left.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.rightward.M_right.toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${span.rightward.Q.toFixed(2)}</td>
            </tr>`;
        });
        html += `</tbody></table>`;

        // Table 4: 許容耐力の算定（1）
        html += `<div style="font-weight:bold; margin-top:10px; margin-bottom:4px; font-size:11px;">(4) 許容耐力の算定（1 - 曲げ）</div>
        <table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:10px; border:1px solid #aaa;">
            <thead>
                <tr style="background:#f2f2f2;">
                    <th rowspan="2" style="border:1px solid #aaa; padding:3px;">柱間</th>
                    <th rowspan="2" style="border:1px solid #aaa; padding:3px;">成 D(mm)</th>
                    <th colspan="3" style="border:1px solid #aaa; padding:3px; text-align:center;">上端主筋</th>
                    <th colspan="3" style="border:1px solid #aaa; padding:3px; text-align:center;">下端主筋</th>
                </tr>
                <tr style="background:#f2f2f2;">
                    <th style="border:1px solid #aaa; padding:2px;">鉄筋</th>
                    <th style="border:1px solid #aaa; padding:2px;">at(㎟)</th>
                    <th style="border:1px solid #aaa; padding:2px;">sMa(kNm)</th>
                    <th style="border:1px solid #aaa; padding:2px;">鉄筋</th>
                    <th style="border:1px solid #aaa; padding:2px;">at(㎟)</th>
                    <th style="border:1px solid #aaa; padding:2px;">lMa(kNm)</th>
                </tr>
            </thead>
            <tbody>`;
        spans.forEach(span => {
            html += `<tr>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${span.spanName}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.cap?.h ?? 0}</td>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${bp.topRebar || '1-D13'}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${((span.cap?.lMa_top ?? 0) * 1e6 / 195 / (span.cap?.j || 1) || 0).toFixed(1)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${(span.cap?.sMa_top ?? 0).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${bp.bottomRebar || '1-D13'}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${((span.cap?.lMa_bot ?? 0) * 1e6 / 195 / (span.cap?.j || 1) || 0).toFixed(1)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${(span.cap?.lMa_bot ?? 0).toFixed(2)}</td>
            </tr>`;
        });
        html += `</tbody></table>`;

        // Table 5: 許容耐力の算定（2）
        html += `<div style="font-weight:bold; margin-top:10px; margin-bottom:4px; font-size:11px;">(5) 許容耐力の算定（2 - せん断）</div>
        <table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:10px; border:1px solid #aaa;">
            <thead>
                <tr style="background:#f2f2f2;">
                    <th style="border:1px solid #aaa; padding:3px;">柱間</th>
                    <th style="border:1px solid #aaa; padding:3px;">幅 b</th>
                    <th style="border:1px solid #aaa; padding:3px;">ST筋</th>
                    <th style="border:1px solid #aaa; padding:3px;">pw</th>
                    <th style="border:1px solid #aaa; padding:3px;">長期Qa(kN)</th>
                    <th style="border:1px solid #aaa; padding:3px;">短期Qa_L(kN)</th>
                    <th style="border:1px solid #aaa; padding:3px;">短期Qa_R(kN)</th>
                </tr>
            </thead>
            <tbody>`;
        spans.forEach(span => {
            html += `<tr>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${span.spanName}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${span.cap?.b ?? 0}</td>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${bp.stirrup || '1-D10@200'}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right;">${(span.cap?.pw ?? 0).toFixed(5)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${(span.cap?.lQa ?? 0).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${(span.cap?.sQa_L ?? 0).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold;">${(span.cap?.sQa_R ?? 0).toFixed(2)}</td>
            </tr>`;
        });
        html += `</tbody></table>`;

        // Table 6: 総合判定表
        html += `<div style="font-weight:bold; margin-top:10px; margin-bottom:4px; font-size:11px;">(6) 総合判定表</div>
        <table style="width:100%; border-collapse:collapse; font-size:10px; border:1px solid #aaa;">
            <thead>
                <tr style="background:#f2f2f2;">
                    <th style="border:1px solid #aaa; padding:3px;">柱間</th>
                    <th style="border:1px solid #aaa; padding:3px; text-align:center;">長期 M_L/Ma</th>
                    <th style="border:1px solid #aaa; padding:3px; text-align:center;">長期 Q_L/Qa</th>
                    <th style="border:1px solid #aaa; padding:3px; text-align:center;">短期左 M_S/Ma</th>
                    <th style="border:1px solid #aaa; padding:3px; text-align:center;">短期左 Q_S/Qa</th>
                    <th style="border:1px solid #aaa; padding:3px; text-align:center;">短期右 M_S/Ma</th>
                    <th style="border:1px solid #aaa; padding:3px; text-align:center;">短期右 Q_S/Qa</th>
                    <th style="border:1px solid #aaa; padding:3px; text-align:center;">判定</th>
                </tr>
            </thead>
            <tbody>`;
        spans.forEach(span => {
            const badge = span.isNG ? `<span style="color:red; font-weight:bold;">NG</span>` : `<span style="color:green; font-weight:bold;">OK</span>`;
            html += `<tr>
                <td style="border:1px solid #aaa; padding:3px; font-weight:bold;">${span.spanName}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold; color:${(span.rM_L ?? 0) > 1.0 ? 'red' : 'inherit'}">${(span.rM_L ?? 0).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold; color:${(span.rQ_L ?? 0) > 1.0 ? 'red' : 'inherit'}">${(span.rQ_L ?? 0).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold; color:${Math.max((span.leftward?.rM_left ?? 0), (span.leftward?.rM_right ?? 0)) > 1.0 ? 'red' : 'inherit'}">${Math.max((span.leftward?.rM_left ?? 0), (span.leftward?.rM_right ?? 0)).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold; color:${(span.leftward?.rQ ?? 0) > 1.0 ? 'red' : 'inherit'}">${(span.leftward?.rQ ?? 0).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold; color:${Math.max((span.rightward?.rM_left ?? 0), (span.rightward?.rM_right ?? 0)) > 1.0 ? 'red' : 'inherit'}">${Math.max((span.rightward?.rM_left ?? 0), (span.rightward?.rM_right ?? 0)).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:right; font-weight:bold; color:${(span.rightward?.rQ ?? 0) > 1.0 ? 'red' : 'inherit'}">${(span.rightward?.rQ ?? 0).toFixed(2)}</td>
                <td style="border:1px solid #aaa; padding:3px; text-align:center;">${badge}</td>
            </tr>`;
        });
        html += `</tbody></table>`;
    } else {
        html += `<p style="padding:10px; text-align:center; color:#7f8c8d; font-size:11px;">
            💡 基礎梁のスパン（柱間）が検出されていません。
        </p>`;
    }

    html += `</div>`;
    return html;
}

// ============================================================
// [バグ修正 構文エラー解消] [機能補完 スラブ検定実装] モーメント係数テーブル (Standard Alpha values for Mx=α*q*lx^2)
// 簡略化した安全側の係数テーブルを使用します
// ============================================================
/* 
const FD_SLAB_COEFFS = {
    '4辺固定':                     { mcx: 0.025, max: 0.045, mcy: 0.015, may: 0.035 },
    '3辺固定1辺ピン（長辺ピン）':  { mcx: 0.035, max: 0.055, mcy: 0.020, may: 0.040 },
    '3辺固定1辺ピン（短辺ピン）':  { mcx: 0.040, max: 0.065, mcy: 0.025, may: 0.050 },
    '2隣辺固定2隣辺ピン':          { mcx: 0.045, max: 0.075, mcy: 0.035, may: 0.065 },
    '長辺2辺固定短辺2辺ピン':      { mcx: 0.060, max: 0.090, mcy: 0.030, may: 0.000 },
    '短辺2辺固定長辺2辺ピン':      { mcx: 0.030, max: 0.000, mcy: 0.060, may: 0.090 },
    '1辺固定3辺ピン（長辺固定）':  { mcx: 0.065, max: 0.100, mcy: 0.040, may: 0.000 },
    '1辺固定3辺ピン（短辺固定）':  { mcx: 0.050, max: 0.000, mcy: 0.075, may: 0.110 },
    '4辺ピン':                     { mcx: 0.080, max: 0.000, mcy: 0.050, may: 0.000 }
};
*/


/**
 * [機能補完 スラブ検定実装] スラブ断面検定の実行
 */
function OBSOLETE_calculateFoundationSlabAnalysis(slabs, avgBuildingPressure) {
    if (!slabs || slabs.length === 0) return;

    slabs.forEach(slab => {
        const p = slab.props || {};
        const D = p.slabThickness || 150;
        const dt = p.coverDepth || 70; // [機能補完 スラブ計算全結合] 標準かぶりを70mmへ
        const topH = p.slabTopHeight || 50;
        
        // [バグ修正 NaNカスケード防止と描画復旧] 接地圧算出の数値安全化
        const bp = Number(avgBuildingPressure) || 0;
        const wSelf = Number(((Number(D) + Number(topH)) / 1000) * 24.0) || 0;
        const wLive = 1.3; // 木造積載荷重 (通常1.3)
        const qTotal = bp + wSelf + wLive;
        p.groundPressure = qTotal;

        // 2. 形状特性
        const bounds = getSlabBounds(slab); 
        const lx = Math.min(bounds.width, bounds.height) / 1000;
        const ly = Math.max(bounds.width, bounds.height) / 1000;
        const lambda = ly / lx;

        // 3. モーメント算出 Mx = α * q * lx^2
        if (p.support === '片持ち') { // [機能改善 片持ちスラブ対応]
            const L = Number(p.cantileverLength) || 0.9;
            const Mx_center = 0.5 * qTotal * (L ** 2);
            const Mx_end = 0;
            const My_center = 0;
            const My_end = 0;

            const d = D - dt;
            const j = d * (7/8);
            const steelShort = fd_getSteelStrength(p.rebarShort?.type || 'D13');
            const Ma_short = steelShort.ft * (p.rebarShort?.at || 0) * j / 1e6;
            const Ma_long = 0;

            const ratioShort = Mx_center / (Ma_short || 1);
            const ratioLong = 0;

            slab.fdStress = {
                qTotal, wSelf, wLive, avgBuildingPressure,
                cantileverLength: L,
                Mx_center, Mx_end, My_center, My_end,
                Ma_short, Ma_long,
                ratioShort, ratioLong,
                isNG: (ratioShort > 1.0)
            };
        } else {
            const coeffs = FD_SLAB_COEFFS[p.support] || FD_SLAB_COEFFS['4辺固定'];
            
            // 長辺/短辺比 lambda による補正 (簡易: 1.5以上の場合は1方向板に近づく)
            const lambdaFactor = Math.min(1.0, 1.5 / lambda); 

            const Mx_center = coeffs.mcx * qTotal * (lx ** 2);
            const Mx_end    = coeffs.max * qTotal * (lx ** 2);
            const My_center = coeffs.mcy * qTotal * (lx ** 2) * lambdaFactor;
            const My_end    = coeffs.may * qTotal * (lx ** 2) * lambdaFactor;

            // 4. 許容耐力算出 Ma = ft * at * (7/8 * d) / 1e6 (kN·m/m)
            const d = D - dt;
            const j = d * (7/8);
            
            const steelShort = fd_getSteelStrength(p.rebarShort?.type || 'D13');
            const steelLong  = fd_getSteelStrength(p.rebarLong?.type || 'D13');

            const Ma_short = steelShort.ft * (p.rebarShort?.at || 0) * j / 1e6;
            const Ma_long  = steelLong.ft  * (p.rebarLong?.at || 0)  * j / 1e6;

            // 5. 判定 (最大値を採用)
            const ratioShort = Math.max(Mx_center, Mx_end) / (Ma_short || 1);
            const ratioLong  = Math.max(My_center, My_end) / (Ma_long || 1);

            slab.fdStress = {
                qTotal, wSelf, wLive, avgBuildingPressure,
                lx, ly, lambda,
                Mx_center, Mx_end, My_center, My_end,
                Ma_short, Ma_long,
                ratioShort, ratioLong,
                isNG: (ratioShort > 1.0 || ratioLong > 1.0)
            };
        }
    });
}

function getSlabBounds(slab) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    slab.vertices.forEach(v => {
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    });
    return { width: maxX - minX, height: maxY - minY };
}

function generateBeamNMQSvg(beam) {
    if (window.FoundationRenderer && typeof window.FoundationRenderer.generateBeamNMQSvg === 'function') {
        return window.FoundationRenderer.generateBeamNMQSvg(beam);
    }
    return '';
}

/**
 * [機能補完 スラブ検定実装] スラブ断面検定レポートHTML
 */
function OBSOLETE_getFoundationSlabReportHtml(slab) {
    if (!slab || !slab.fdStress) return '<p style="color:#888;">検定データなし</p>';
    const s = slab.fdStress;
    const fmt = (v, d = 2) => v != null ? v.toFixed(d) : '—';
    const fmtR = (r) => {
        const ok = r <= 1.0;
        return `<span style="color:${ok ? '#27ae60' : '#e74c3c'};font-weight:bold;">${(r * 100).toFixed(1)}% ${ok ? 'OK' : 'NG'}</span>`;
    };

    if (slab.props && slab.props.support === '片持ち') { // [機能改善 片持ちスラブ対応]
        return `
        <div style="background:#fef9e7; border:1px solid #f1c40f; border-radius:4px; padding:8px; font-size:11px;">
            <div style="font-weight:bold; color:#7d6608; border-bottom:1px solid #f1c40f; margin-bottom:5px;">📋 片持ちスラブ断面検定</div>
            <table style="width:100%; border-collapse:collapse;">
                <tr><td>接地圧 q</td><td style="text-align:right; font-weight:bold;">${fmt(s.qTotal, 3)}</td><td>kN/㎡</td></tr>
                <tr><td>片持ち長さ L</td><td style="text-align:right; font-weight:bold;">${fmt(s.cantileverLength, 2)}</td><td>m</td></tr>
                <tr style="background:#eee;"><td colspan="3" style="font-weight:bold; height:1px;"></td></tr>
                <tr style="font-size:10px; color:#666;"><td colspan="3">算定式: M = 1/2 ・ q ・ L²</td></tr>
                <tr><td>モーメント M</td><td colspan="2" style="text-align:right; font-weight:bold;">${fmt(s.Mx_center, 2)} kN・m/m</td></tr>
                <tr><td>許容耐力 Ma</td><td colspan="2" style="text-align:right; font-weight:bold;">${fmt(s.Ma_short, 2)} kN・m/m</td></tr>
                <tr style="font-size:9px; color:#888;"><td colspan="3">(※短辺配筋を主筋として計算)</td></tr>
                <tr style="background:#eee;"><td colspan="3" style="font-weight:bold; height:1px;"></td></tr>
                <tr><td>検定比 M/Ma</td><td colspan="2" style="text-align:right;">${fmtR(s.ratioShort)}</td></tr>
            </table>
        </div>`;
    }

    return `
    <div style="background:#f8f9fa; border:1px solid #ddd; border-radius:4px; padding:8px; font-size:11px;">
        <div style="font-weight:bold; color:#2c3e50; border-bottom:1px solid #ccc; margin-bottom:5px;">📋 断面検定結果</div>
        <table style="width:100%; border-collapse:collapse;">
            <tr><td>総接地圧 q</td><td style="text-align:right; font-weight:bold;">${fmt(s.qTotal, 3)}</td><td>kN/㎡</td></tr>
            <tr style="font-size:10px; color:#666;">
                <td colspan="3">(建物:${fmt(s.avgBuildingPressure, 1)} + 自重:${fmt(s.wSelf, 1)} + 積載:${fmt(s.wLive, 1)})</td>
            </tr>
            <tr style="background:#eee;"><td colspan="3" style="font-weight:bold; height:1px;"></td></tr>
            <tr><td>短辺 M/Ma</td><td colspan="2" style="text-align:right;">${fmt(Math.max(s.Mx_center, s.Mx_end), 2)} / ${fmt(s.Ma_short, 2)}</td></tr>
            <tr><td>短辺 判定</td><td colspan="2" style="text-align:right;">${fmtR(s.ratioShort)}</td></tr>
            <tr style="background:#eee;"><td colspan="3" style="font-weight:bold; height:1px;"></td></tr>
            <tr><td>長辺 M/Ma</td><td colspan="2" style="text-align:right;">${fmt(Math.max(s.My_center, s.My_end), 2)} / ${fmt(s.Ma_long, 2)}</td></tr>
            <tr><td>長辺 判定</td><td colspan="2" style="text-align:right;">${fmtR(s.ratioLong)}</td></tr>
        </table>
    </div>`;
}


// ============================================================
// [機能改善 連続梁・スパンモデル化] 連続梁・スパン管理ロジック
// ============================================================

/**
 * 重複する梁セグメントを統合し、1本の連続梁に再構成する
 */
window.reconstructContinuousBeams = function() {
    const oldBeams = window.AppState.foundationBeams ? JSON.parse(JSON.stringify(window.AppState.foundationBeams)) : [];
    const beams = window.AppState.foundationBeams || [];
    const pillars = window.AppState.pillars || [];
    if (beams.length === 0) return;

    // 1. 同一線上にあるセグメントをグループ化 (水平・垂直)
    const groups = [];
    beams.forEach(b => {
        // [バグ修正 スパンデータ生成の正常化] 数値型を保証
        const bP1x = Number(b.p1.x), bP1y = Number(b.p1.y);
        const bP2x = Number(b.p2.x), bP2y = Number(b.p2.y);
        
        // 正規化 (必ず p1 < p2 にする)
        const p1 = bP1x < bP2x || (bP1x === bP2x && bP1y < bP2y) ? {x:bP1x, y:bP1y} : {x:bP2x, y:bP2y};
        const p2 = bP1x < bP2x || (bP1x === bP2x && bP1y < bP2y) ? {x:bP2x, y:bP2y} : {x:bP1x, y:bP1y};
        
        let found = false;
        const isH = Math.abs(p1.y - p2.y) < 0.5;
        const isV = Math.abs(p1.x - p2.x) < 0.5;

        for (const g of groups) {
            const gIsH = Math.abs(g[0].p1.y - g[0].p2.y) < 0.5;
            const gIsV = Math.abs(g[0].p1.x - g[0].p2.x) < 0.5;

            if (isH && gIsH && Math.abs(p1.y - g[0].p1.y) < 0.5) { g.push({b, p1, p2}); found = true; break; }
            if (isV && gIsV && Math.abs(p1.x - g[0].p1.x) < 0.5) { g.push({b, p1, p2}); found = true; break; }
        }
        if (!found) groups.push([{b, p1, p2}]);
    });

    const newBeams = [];
    groups.forEach(g => {
        const isH = Math.abs(g[0].p1.y - g[0].p2.y) < 0.5;
        const isV = Math.abs(g[0].p1.x - g[0].p2.x) < 0.5;
        // 開始座標でソート
        g.sort((a, b) => isH ? a.p1.x - b.p1.x : a.p1.y - b.p1.y);

        let current = null;
        g.forEach(item => {
            if (!current) {
                // [バグ修正 基礎梁・スパンの座標欠損修復] 新しいオブジェクトとして座標をコピー
                current = { 
                    ...item.b, 
                    p1: { x: Number(item.p1.x), y: Number(item.p1.y) }, 
                    p2: { x: Number(item.p2.x), y: Number(item.p2.y) }, 
                    originalBeams: [item.b],
                    spans: [] 
                };
            } else {
                const posEnd = isH ? item.p2.x : item.p2.y;
                const currEnd = isH ? current.p2.x : current.p2.y;
                if (posEnd > currEnd) {
                    // [バグ修正 基礎梁・スパンの座標欠損修復] 終点を更新
                    current.p2 = { x: Number(item.p2.x), y: Number(item.p2.y) };
                }
                current.originalBeams.push(item.b);
            }
        });
        if (current) {
            // [重要] 斜め梁を許容するため、強制的な直交化クランプを解除
            /* 
            if (isH) {
                current.p2.y = current.p1.y; 
            } else if (isV) {
                current.p2.x = current.p1.x; 
            }
            */
            newBeams.push(current);
        }
    });

    // プロパティの継承 (最も長い元のセグメントから引き継ぐ)
    newBeams.forEach(nb => {
        if (nb.originalBeams && nb.originalBeams.length > 0) {
            nb.originalBeams.sort((a, b) => {
                const la = Math.hypot(a.p2.x - a.p1.x, a.p2.y - a.p1.y);
                const lb = Math.hypot(b.p2.x - b.p1.x, b.p2.y - b.p1.y);
                return lb - la;
            });
            // 最長のセグメントのプロパティとIDを代表として採用
            nb.props = nb.originalBeams[0].props ? JSON.parse(JSON.stringify(nb.originalBeams[0].props)) : { symbol: 'FG1', width: 150, height: 640, embedDepth: 250, topRebar: '1-D13', bottomRebar: '1-D13', stirrup: '1-D10@200' };
            nb.id = nb.originalBeams[0].id;
        }
        delete nb.originalBeams;
    });

    // 状態の更新
    window.AppState.foundationBeams = newBeams;
    
    // [バグ修正 基礎梁描画の絶対可視化] 診断プロット: エンジン層での生成確認
    console.log(`[基礎エンジンデバッグ] reconstructContinuousBeams finished. New beams count: ${newBeams.length}`);

    // スパン分割処理の呼び出し
    window.splitBeamsIntoSpans(newBeams, pillars);
    const spanCount = newBeams.reduce((sum, b) => sum + (b.spans ? b.spans.length : 0), 0);
    console.log(`[基礎エンジンデバッグ] splitBeamsIntoSpans finished. Total spans across all beams: ${spanCount}`);

    // Carry over old span props
    newBeams.forEach(nb => {
        const oldB = oldBeams.find(ob => ob.id === nb.id);
        if (oldB && oldB.spans && nb.spans) {
            nb.spans.forEach((ns, idx) => {
                const oldS = oldB.spans[idx];
                if (oldS && oldS.props) {
                    ns.props = JSON.parse(JSON.stringify(oldS.props));
                }
            });
        }
    });
};

/**
 * 連続梁を支点(柱・交点)でマーキングし、spans配列へ分割・格納する
 */
window.splitBeamsIntoSpans = function(beams, pillars) {
    beams.forEach(beam => {
        // [バグ修正 スパンデータ生成の正常化] 明確な数値座標オブジェクトを保証
        if (!beam.p1 || !beam.p2 || isNaN(beam.p1.x) || isNaN(beam.p1.y)) return;

        // 計算エンジン側の支点判定ロジックと100%揃え、スパンのインデックスや配列整合を完全同期させる
        if (window.FoundationEngine && typeof window.FoundationEngine.getBeamPillars === 'function') {
            const beamPillars = window.FoundationEngine.getBeamPillars(beam, window.AppState);
            const spans = [];
            const bP1x = Number(beam.p1.x), bP1y = Number(beam.p1.y);
            const bP2x = Number(beam.p2.x), bP2y = Number(beam.p2.y);
            const isH = Math.abs(bP1y - bP2y) < 5;
            const isV = Math.abs(bP1x - bP2x) < 5;

            for (let i = 0; i < beamPillars.length - 1; i++) {
                const p1 = beamPillars[i];
                const p2 = beamPillars[i + 1];
                
                // [最重要] 投影座標の強制適用
                // 柱の実際座標が理想的な直線からズレていても、投影座標を使用して完璧な直線を維持する
                const L_ideal = Math.hypot(bP2x - bP1x, bP2y - bP1y);
                const dx_beam = bP2x - bP1x;
                const dy_beam = bP2y - bP1y;

                const getProjected = (pt) => {
                    const vx = pt.globalX - bP1x, vy = pt.globalY - bP1y;
                    const t = (vx * dx_beam + vy * dy_beam) / (L_ideal * L_ideal || 1);
                    const clampedT = Math.max(0, Math.min(1, t));
                    return {
                        x: bP1x + clampedT * dx_beam,
                        y: bP1y + clampedT * dy_beam
                    };
                };

                const proj1 = getProjected(p1);
                const proj2 = getProjected(p2);

                let sNodeX = proj1.x, sNodeY = proj1.y;
                let eNodeX = proj2.x, eNodeY = proj2.y;

                // [バグ修正] 以前の単純な isH/isV 判定による座標上書きは、投影座標の導入により不要になったため削除
                // 全ての角度の梁に対して投影座標が適用されるため、常に直線性が保証される

                const spanLen = Math.hypot(eNodeX - sNodeX, eNodeY - sNodeY);
                if (spanLen > 50) {
                    spans.push({
                        startNode: { x: sNodeX, y: sNodeY, type: 'pillar', name: p1.name },
                        endNode: { x: eNodeX, y: eNodeY, type: 'pillar', name: p2.name },
                        spanLength: spanLen,
                        connectedSlabIds: []
                    });
                }
            }
            if (spans.length === 0) {
                spans.push({
                    startNode: { x: bP1x, y: bP1y, type: 'end' },
                    endNode: { x: bP2x, y: bP2y, type: 'end' },
                    spanLength: Math.hypot(bP2x - bP1x, bP2y - bP1y),
                    connectedSlabIds: []
                });
            }
            beam.spans = spans;
        } else {
            const nodes = [];
            const beamP1x = Number(beam.p1.x), beamP1y = Number(beam.p1.y);
            const beamP2x = Number(beam.p2.x), beamP2y = Number(beam.p2.y);
            
            const isH = Math.abs(beamP1y - beamP2y) < 5;
            const isV = Math.abs(beamP1x - beamP2x) < 5;
            
            // 1. 端点を初期ノードとして追加
            nodes.push({ x: beamP1x, y: beamP1y, type: 'end' });
            nodes.push({ x: beamP2x, y: beamP2y, type: 'end' });

            // 2. この梁の上にある柱を検出
            pillars.forEach(p => {
                if (p.isDeleted) return;
                const px = Number(p.x), py = Number(p.y);
                let onBeam = false;
                if (isH && Math.abs(py - beamP1y) < 10 && px >= Math.min(beamP1x, beamP2x) - 10 && px <= Math.max(beamP1x, beamP2x) + 10) {
                    onBeam = true;
                } else if (isV && Math.abs(px - beamP1x) < 10 && py >= Math.min(beamP1y, beamP2y) - 10 && py <= Math.max(beamP1y, beamP2y) + 10) {
                    onBeam = true;
                }
                if (onBeam) {
                    nodes.push({ x: px, y: py, type: 'pillar', pillarId: p.id });
                }
            });

            // 重複座標のノードを整理
            const uniqueNodes = [];
            nodes.forEach(n => {
                let existing = uniqueNodes.find(un => Math.abs(un.x - n.x) < 20 && Math.abs(un.y - n.y) < 20);
                if (!existing) {
                    uniqueNodes.push(n);
                } else {
                    // 柱情報がある場合は優先的に保持
                    if (n.type === 'pillar') {
                        existing.type = 'pillar';
                        existing.pillarId = n.pillarId;
                    }
                }
            });

            // 梁の方向に沿ってソート
            uniqueNodes.sort((a, b) => isH ? a.x - b.x : a.y - b.y);

            // ノード間をスパンとして分割
            const spans = [];
            for (let i = 0; i < uniqueNodes.length - 1; i++) {
                const n1 = uniqueNodes[i];
                const n2 = uniqueNodes[i + 1];
                const spanLen = Math.hypot(n2.x - n1.x, n2.y - n1.y);
                
                if (spanLen > 50) { // 極小スパンは除外
                    spans.push({
                        startNode: n1,
                        endNode: n2,
                        spanLength: spanLen,
                        connectedSlabIds: [] 
                    });
                }
            }

            // [バグ修正 基礎梁・スパンの座標欠損修復] 支点がなくても最低限1スパン生成
            if (spans.length === 0) {
                spans.push({
                    startNode: { x: beamP1x, y: beamP1y, type: 'end' },
                    endNode: { x: beamP2x, y: beamP2y, type: 'end' },
                    spanLength: Math.hypot(beamP2x - beamP1x, beamP2y - beamP1y),
                    connectedSlabIds: []
                });
            }
            
            beam.spans = spans;
        }
    });
};

// [機能追加 山場Step2: 連続梁図表の完全実装] 連続梁構造計算書HTML生成
function generateContinuousBeamReportHtml(beam) {
    if (window.FoundationRenderer && typeof window.FoundationRenderer.generateBeamReportHtml === 'function') {
        return window.FoundationRenderer.generateBeamReportHtml(beam);
    }
    return '<p>レンダラーが初期化されていません。</p>';
}

window.generateBeamNMQSvg = generateBeamNMQSvg;
if (typeof generateContinuousBeamReportHtml === 'function') window.generateContinuousBeamReportHtml = generateContinuousBeamReportHtml;
if (typeof getFoundationBeamReportHtml === 'function') window.getFoundationBeamReportHtml = getFoundationBeamReportHtml;
if (typeof getFoundationSlabReportHtml === 'function') window.getFoundationSlabReportHtml = getFoundationSlabReportHtml;
