// WebAssembly Core Calculation Module for Wall Quantity, N-Value, Foundation & Domain Security
// 公益財団法人 日本住宅・木材技術センター配布 表計算ツール ver1.2.1 完全準拠
// 告示1460号 表3・表14 N値計算法 & 建築基準法施行令第43条6項細長比
// 日本建築学会・木造ベタ基礎設計指針準拠 基礎梁・基礎スラブ構造計算

// 認可済みドメインのDJB2ハッシュ定数
const VALID_HASH_PROD: i32 = 732150967;   // 2025.eie.jp
const VALID_HASH_LOCAL1: i32 = 906931598;  // localhost
const VALID_HASH_LOCAL2: i32 = 1532542490; // 127.0.0.1

// -----------------------------------------------------------------------------
// 1. 共通セキュリティ: 実行ドメインの真正性をバイナリ内部で検証する
// -----------------------------------------------------------------------------
export function verifyDomain(domainHash: i32): bool {
  return (domainHash == VALID_HASH_PROD || domainHash == VALID_HASH_LOCAL1 || domainHash == VALID_HASH_LOCAL2);
}

// -----------------------------------------------------------------------------
// 2. 必要壁量算定 (Wall Quantity Core)
// -----------------------------------------------------------------------------
let last_q1_cm: f64 = 0.0;
let last_q2_cm: f64 = 0.0;
let last_cq1: f64 = 0.0;
let last_cq2: f64 = 0.0;

export function getCalculatedQ1(): f64 { return last_q1_cm; }
export function getCalculatedQ2(): f64 { return last_q2_cm; }
export function getCalculatedCQ1(): f64 { return last_cq1; }
export function getCalculatedCQ2(): f64 { return last_cq2; }

export function calculateRequiredWallCore(
  h1: f64,
  h2: f64,
  roofHeight: f64,
  overhang: f64,
  roofSlope: f64,
  area1F: f64,
  area2F: f64,
  rawRoofWeight: f64,
  rawExtWallWeight: f64,
  hasSolar: i32,
  solarWeight: f64,
  ceilingIns: f64,
  wallIns: f64,
  buildingUseType: i32, // 0: residential, 1: office/non_residential
  standardType: i32,    // 0: kijun, 1: grade1, 2: grade2, 3: grade3
  isSnowArea: i32,
  snowDepth: f64,
  snowUnitLoad: f64,
  C0: f64,
  Z: f64,
  domainHash: i32
): i32 {
  if (!verifyDomain(domainHash)) {
    last_q1_cm = 0.0;
    last_q2_cm = 0.0;
    last_cq1 = 0.0;
    last_cq2 = 0.0;
    return -1;
  }

  if (h1 < 1.0) h1 = 2.70;
  if (h2 < 1.0) h2 = 2.70;
  if (roofHeight < 0.5) roofHeight = 1.71;
  if (overhang < 0.0) overhang = 0.75;
  if (roofSlope < 0.5) roofSlope = 4.0;

  const is2Story = (area2F > 0.0);

  const k_slope = Math.sqrt(Math.pow(roofSlope, 2.0) + 100.0) / 10.0;
  const Z2 = ((16.5 + overhang * 2.0) * (6.0 + overhang * 2.0) * k_slope) / (16.5 * 6.0);

  const roofWeightPerArea = rawRoofWeight * Z2;
  const solarWeightPerArea = (hasSolar != 0) ? (solarWeight * Z2) : 0.0;

  let snowWeightPerArea = 0.0;
  if (isSnowArea != 0 && snowDepth > 0.0 && snowUnitLoad > 0.0) {
    snowWeightPerArea = (snowDepth * snowUnitLoad * 0.35 * Z2) / k_slope;
  }

  const totalRoofLoadPerArea = roofWeightPerArea + solarWeightPerArea + ceilingIns + snowWeightPerArea;

  const OPENING_RATIO: f64 = 0.09;
  const OPENING_WEIGHT: f64 = 400.0;
  const INTERIOR_WALL_BASE: f64 = 200.0;
  const FLOOR_DEAD_LOAD: f64 = 610.0;
  const WALL_STRENGTH_COEFF: f64 = 0.0196;

  const wallRatio1F = (6.0 * h1 * 2.0 + 16.5 * h1 * 2.0) / (6.0 * 16.5);
  const wallRatio2F = (6.0 * h2 * 2.0 + 16.5 * h2 * 2.0) / (6.0 * 16.5);

  const w_ext1 = Math.ceil((rawExtWallWeight * wallRatio1F * (1.0 - OPENING_RATIO)) / 10.0) * 10.0;
  const w_ext2 = Math.ceil((rawExtWallWeight * wallRatio2F * (1.0 - OPENING_RATIO)) / 10.0) * 10.0;

  const w_open1 = Math.ceil((OPENING_WEIGHT * wallRatio1F * OPENING_RATIO) / 10.0) * 10.0;
  const w_open2 = Math.ceil((OPENING_WEIGHT * wallRatio2F * OPENING_RATIO) / 10.0) * 10.0;

  const w_ins1 = Math.ceil((wallIns * wallRatio1F * (1.0 - OPENING_RATIO)) / 10.0) * 10.0;
  const w_ins2 = Math.ceil((wallIns * wallRatio2F * (1.0 - OPENING_RATIO)) / 10.0) * 10.0;

  const w_int1 = INTERIOR_WALL_BASE * (h1 / 2.8);
  const w_int2 = INTERIOR_WALL_BASE * (h2 / 2.8);

  const wallLoad1F = (w_ext1 + w_int1 + w_ins1 + w_open1) / 1000.0;
  const wallLoad2F = (w_ext2 + w_int2 + w_ins2 + w_open2) / 1000.0;

  const liveLoad: f64 = (buildingUseType == 1) ? 800.0 : 600.0;
  const floorLoadTotal = (FLOOR_DEAD_LOAD + liveLoad) / 1000.0;

  let q1_cm: f64 = 0.0;
  let q2_cm: f64 = 0.0;

  if (is2Story && area1F > 0.0) {
    const R_area = area2F / area1F;

    const W_rf2 = (totalRoofLoadPerArea * R_area) / 1000.0;
    const W_rf1 = (R_area < 1.0) ? ((1.0 - R_area) * totalRoofLoadPerArea) / 1000.0 : 0.0;

    const W_wall2 = wallLoad2F * R_area;
    const W_wall1 = wallLoad1F;
    const W_floor = floorLoadTotal * R_area;

    const Z41 = W_rf2 + 0.5 * W_wall2;
    const Z42 = W_rf2 + W_wall2 + W_floor + 0.5 * W_wall1 + W_rf1;

    const Heff = (roofHeight / 2.0) + h1 + h2 + 0.5;
    const beta = (2.0 * 0.03 * Heff) / (1.0 + 3.0 * 0.03 * Heff);

    const Ai1 = 1.0;
    let alpha2 = Z41 / Z42;
    if (alpha2 < 0.001) alpha2 = 0.001;

    const Ai2 = 1.0 + (1.0 / Math.sqrt(alpha2) - alpha2) * beta;

    const q1_base = Math.ceil(((Ai1 * C0 * Z) / WALL_STRENGTH_COEFF) * Z42);
    const q2_base = Math.ceil((((Ai2 * C0 * Z) / WALL_STRENGTH_COEFF) * Z41) / R_area);

    let gradeMultiplier: f64 = 1.0;
    if (standardType == 2) {
      gradeMultiplier = 1.25;
    } else if (standardType == 3) {
      gradeMultiplier = 1.50;
    }

    q1_cm = Math.ceil(q1_base * gradeMultiplier);
    q2_cm = Math.ceil(q2_base * gradeMultiplier);

  } else if (area1F > 0.0) {
    const W_rf = totalRoofLoadPerArea / 1000.0;
    const W_wall = wallLoad1F;
    const Z37 = W_rf + 0.5 * W_wall;

    const q1_base = Math.ceil(((C0 * Z) / WALL_STRENGTH_COEFF) * Z37);

    let gradeMultiplier: f64 = 1.0;
    if (standardType == 2) {
      gradeMultiplier = 1.25;
    } else if (standardType == 3) {
      gradeMultiplier = 1.50;
    }

    q1_cm = Math.ceil(q1_base * gradeMultiplier);
    q2_cm = 0.0;
  } else {
    q1_cm = 29.0;
    q2_cm = 15.0;
  }

  const cq1 = Math.round((q1_cm / 100.0) * 1000.0) / 1000.0;
  const cq2 = Math.round((q2_cm / 100.0) * 1000.0) / 1000.0;

  last_q1_cm = q1_cm;
  last_q2_cm = q2_cm;
  last_cq1 = cq1;
  last_cq2 = cq2;

  return 1;
}

// -----------------------------------------------------------------------------
// 3. 柱N値計算 (N-Value Calculation Core)
// -----------------------------------------------------------------------------

/**
 * 告示1460号 表14 筋交い配置補正係数の算定
 * @param hasB1 筋交い1の有無 (1 or 0)
 * @param b1_m 筋交い1の倍率
 * @param b1_isP1 筋交い1がP1(上り)なら1、P2(下り)なら0
 * @param hasB2 筋交い2の有無 (1 or 0)
 * @param b2_m 筋交い2の倍率
 * @param b2_isP1 筋交い2がP1(上り)なら1、P2(下り)なら0
 */
export function calcTable314CorrectionCore(
  hasB1: i32,
  b1_m: f64,
  b1_isP1: i32,
  hasB2: i32,
  b2_m: f64,
  b2_isP1: i32
): f64 {
  if (hasB1 == 0 && hasB2 == 0) return 0.0;
  if ((hasB1 != 0 && b1_m == 4.0) || (hasB2 != 0 && b2_m == 4.0)) return 0.5;

  if (hasB1 == 0 || hasB2 == 0) {
    const m = (hasB1 != 0) ? b1_m : b2_m;
    const isP1 = (hasB1 != 0) ? b1_isP1 : b2_isP1;
    if (m == 1.5 || m == 2.0) return (isP1 != 0) ? -0.5 : 0.5;
    if (m == 3.0) return (isP1 != 0) ? -2.0 : 2.0;
    return 0.0;
  }

  const maxM = Math.max(b1_m, b2_m);
  const p1Count = (b1_isP1 != 0 ? 1 : 0) + (b2_isP1 != 0 ? 1 : 0);

  if (maxM == 1.5 || maxM == 2.0) {
    if (p1Count == 2) return 0.0; // P1P1
    if (p1Count == 0) return 1.0; // P2P2
    return 1.5;                  // P1P2
  }
  if (maxM == 3.0) {
    if (p1Count == 2) return 0.0; // P1P1
    if (p1Count == 0) return 2.0; // P2P2
    return 2.0;                  // P1P2
  }
  return 0.0;
}

/**
 * 建築基準法施行令第43条6項 細長比算定 (λ <= 150)
 * @param l_0 柱の座屈長さ (m)
 * @param d 柱の小径 (mm)
 */
export function calcSlendernessRatioCore(l_0: f64, d: f64): f64 {
  if (d <= 0.0) return 999.0;
  const SQRT_12: f64 = 3.4641016151377544;
  const lambda = (l_0 * 1000.0 * SQRT_12) / d;
  return Math.round(lambda * 10.0) / 10.0;
}

/**
 * 柱N値コア算定式
 * N = max(0, aX*B*K + upper_x - L, aY*B*K + upper_y - L)
 */
export function calculatePillarNValCore(
  aX: f64,
  aY: f64,
  b: f64,
  k: f64,
  L: f64,
  upperAx: f64,
  upperAy: f64,
  upperB: f64,
  upperK: f64,
  hasUpper: i32,
  domainHash: i32
): f64 {
  if (!verifyDomain(domainHash)) return -1.0;

  let effUpperX: f64 = 0.0;
  let effUpperY: f64 = 0.0;
  if (hasUpper != 0) {
    effUpperX = upperAx * upperB * upperK;
    effUpperY = upperAy * upperB * upperK;
  }

  const nValX = (aX * b * k) + effUpperX - L;
  const nValY = (aY * b * k) + effUpperY - L;
  const nFinal = Math.max(0.0, Math.max(nValX, nValY));

  return Math.round(nFinal * 100.0) / 100.0;
}

// -----------------------------------------------------------------------------
// 4. 基礎梁応力算定 (Foundation Beam Stress Core)
// -----------------------------------------------------------------------------
let last_beam_M: f64 = 0.0;
let last_beam_Q: f64 = 0.0;
let last_beam_Ma: f64 = 0.0;
let last_beam_ratioM: f64 = 0.0;

export function getBeamMaxMoment(): f64 { return last_beam_M; }
export function getBeamMaxShear(): f64 { return last_beam_Q; }
export function getBeamAllowableMoment(): f64 { return last_beam_Ma; }
export function getBeamRatioM(): f64 { return last_beam_ratioM; }

export function calculateBeamStressCore(
  L: f64,
  loadPerM: f64,
  b: f64,
  D: f64,
  rebarArea: f64,
  ft: f64,
  domainHash: i32
): i32 {
  if (!verifyDomain(domainHash)) {
    last_beam_M = 0.0;
    last_beam_Q = 0.0;
    last_beam_Ma = 0.0;
    last_beam_ratioM = 0.0;
    return -1;
  }

  // 1. 曲げモーメント (M = w * L^2 / 8)
  const M_max = (loadPerM * L * L) / 8.0;

  // 2. せん断力 (Q = w * L / 2)
  const Q_max = (loadPerM * L) / 2.0;

  // 3. 有効せい d (mm) および 応力中心間距離 j (mm)
  const d = Math.max(10.0, D - 70.0);
  const j = 0.875 * d;

  // 4. 許容曲げモーメント Ma (kN·m)
  const Ma = (rebarArea * ft * j) / 1000000.0;
  const ratioM = Ma > 0.0 ? (M_max / Ma) : 1.0;

  last_beam_M = M_max;
  last_beam_Q = Q_max;
  last_beam_Ma = Ma;
  last_beam_ratioM = ratioM;

  return 1;
}

// -----------------------------------------------------------------------------
// 5. 基礎スラブ応力算定 (Foundation Slab Analysis Core)
// -----------------------------------------------------------------------------
let last_slab_Mx_center: f64 = 0.0;
let last_slab_Mx_end: f64 = 0.0;
let last_slab_My_center: f64 = 0.0;
let last_slab_My_end: f64 = 0.0;
let last_slab_Ma_short: f64 = 0.0;
let last_slab_Ma_long: f64 = 0.0;
let last_slab_ratioShort: f64 = 0.0;
let last_slab_ratioLong: f64 = 0.0;

export function getSlabMxCenter(): f64 { return last_slab_Mx_center; }
export function getSlabMxEnd(): f64 { return last_slab_Mx_end; }
export function getSlabMyCenter(): f64 { return last_slab_My_center; }
export function getSlabMyEnd(): f64 { return last_slab_My_end; }
export function getSlabMaShort(): f64 { return last_slab_Ma_short; }
export function getSlabMaLong(): f64 { return last_slab_Ma_long; }
export function getSlabRatioShort(): f64 { return last_slab_ratioShort; }
export function getSlabRatioLong(): f64 { return last_slab_ratioLong; }

/**
 * 基礎スラブ応力・断面検定コア
 * @param qTotal 総接地圧 (kN/m2)
 * @param lx 短辺スパン (m)
 * @param ly 長辺スパン (m)
 * @param supportType 境界条件インデックス (0:4辺固定, 1:4辺ピン, 2:片持ち, ...)
 * @param D スラブ厚 (mm)
 * @param dt かぶり厚 (mm)
 * @param at_short 短辺鉄筋断面積 (mm2/m)
 * @param at_long 長辺鉄筋断面積 (mm2/m)
 * @param cantileverLength 片持ち出幅 (m)
 * @param domainHash ドメインハッシュ
 */
export function calculateSlabStressCore(
  qTotal: f64,
  lx: f64,
  ly: f64,
  supportType: i32,
  D: f64,
  dt: f64,
  at_short: f64,
  at_long: f64,
  cantileverLength: f64,
  domainHash: i32
): i32 {
  if (!verifyDomain(domainHash)) {
    last_slab_Mx_center = 0.0;
    last_slab_Mx_end = 0.0;
    last_slab_My_center = 0.0;
    last_slab_My_end = 0.0;
    last_slab_Ma_short = 0.0;
    last_slab_Ma_long = 0.0;
    last_slab_ratioShort = 0.0;
    last_slab_ratioLong = 0.0;
    return -1;
  }

  const d = Math.max(10.0, D - dt);
  const j = d * 0.875;

  // 許容曲げモーメント (長期許容応力度 ft = 195 N/mm2)
  const Ma_short = (195.0 * at_short * j) / 1000000.0;
  const Ma_long = (195.0 * at_long * j) / 1000000.0;

  if (supportType == 2) {
    // 片持ちスラブ
    const cLen = cantileverLength > 0.0 ? cantileverLength : 0.9;
    const Mx = 0.5 * qTotal * (cLen * cLen);

    last_slab_Mx_center = Mx;
    last_slab_Mx_end = 0.0;
    last_slab_My_center = 0.0;
    last_slab_My_end = 0.0;
    last_slab_Ma_short = Ma_short;
    last_slab_Ma_long = Ma_long;
    last_slab_ratioShort = Ma_short > 0.0 ? (Mx / Ma_short) : 1.0;
    last_slab_ratioLong = 0.0;
    return 1;
  }

  // 係数テーブル取得
  let mcx: f64 = 0.024;
  let max_: f64 = 0.052;
  let mcy: f64 = 0.048;
  let may: f64 = 0.082;

  if (supportType == 0) {
    // 4辺固定
    mcx = 0.024; max_ = 0.052; mcy = 0.048; may = 0.082;
  } else if (supportType == 1) {
    // 4辺ピン
    mcx = 0.080; max_ = 0.000; mcy = 0.050; may = 0.000;
  } else if (supportType == 3) {
    // 長辺2辺固定短辺2辺ピン
    mcx = 0.040; max_ = 0.080; mcy = 0.025; may = 0.000;
  } else if (supportType == 4) {
    // 短辺2辺固定長辺2辺ピン
    mcx = 0.030; max_ = 0.000; mcy = 0.060; may = 0.090;
  } else if (supportType == 5) {
    // 1辺固定3辺ピン（長辺固定）
    mcx = 0.065; max_ = 0.100; mcy = 0.040; may = 0.000;
  } else if (supportType == 6) {
    // 1辺固定3辺ピン（短辺固定）
    mcx = 0.050; max_ = 0.000; mcy = 0.075; may = 0.110;
  } else if (supportType == 7) {
    // 2隣辺固定2隣辺ピン
    mcx = 0.045; max_ = 0.085; mcy = 0.035; may = 0.070;
  } else if (supportType == 8) {
    // 3辺固定1辺ピン（長辺ピン）
    mcx = 0.030; max_ = 0.065; mcy = 0.035; may = 0.075;
  } else if (supportType == 9) {
    // 3辺固定1辺ピン（短辺ピン）
    mcx = 0.035; max_ = 0.075; mcy = 0.030; may = 0.065;
  } else if (supportType == 10) {
    // 4辺固定(ピン扱い)
    mcx = 0.080; max_ = 0.000; mcy = 0.050; may = 0.000;
  }

  const lx2 = lx * lx;
  const ratioXY = lx > 0.0 ? (ly / lx) : 1.0;
  const factorY = Math.min(1.0, 1.5 / ratioXY);

  const Mx_center = mcx * qTotal * lx2;
  const Mx_end = max_ * qTotal * lx2;
  const My_center = mcy * qTotal * lx2 * factorY;
  const My_end = may * qTotal * lx2 * factorY;

  const maxMx = Math.max(Mx_center, Mx_end);
  const maxMy = Math.max(My_center, My_end);

  last_slab_Mx_center = Mx_center;
  last_slab_Mx_end = Mx_end;
  last_slab_My_center = My_center;
  last_slab_My_end = My_end;
  last_slab_Ma_short = Ma_short;
  last_slab_Ma_long = Ma_long;
  last_slab_ratioShort = Ma_short > 0.0 ? (maxMx / Ma_short) : 1.0;
  last_slab_ratioLong = Ma_long > 0.0 ? (maxMy / Ma_long) : 1.0;

  return 1;
}
