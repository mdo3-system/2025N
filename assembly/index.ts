// WebAssembly Core Calculation Module for Wall Quantity & Domain Security
// 公益財団法人 日本住宅・木材技術センター配布 表計算ツール ver1.2.1 完全準拠

// 認可済みドメインのDJB2ハッシュ定数
const VALID_HASH_PROD: i32 = 732150967;   // 2025.eie.jp
const VALID_HASH_LOCAL1: i32 = 906931598;  // localhost
const VALID_HASH_LOCAL2: i32 = 1532542490; // 127.0.0.1

// 算定結果バッファ
let last_q1_cm: f64 = 0.0;
let last_q2_cm: f64 = 0.0;
let last_cq1: f64 = 0.0;
let last_cq2: f64 = 0.0;

/**
 * 実行ドメインの真正性をバイナリ内部で検証する
 */
export function verifyDomain(domainHash: i32): bool {
  return (domainHash == VALID_HASH_PROD || domainHash == VALID_HASH_LOCAL1 || domainHash == VALID_HASH_LOCAL2);
}

export function getCalculatedQ1(): f64 {
  return last_q1_cm;
}

export function getCalculatedQ2(): f64 {
  return last_q2_cm;
}

export function getCalculatedCQ1(): f64 {
  return last_cq1;
}

export function getCalculatedCQ2(): f64 {
  return last_cq2;
}

/**
 * 単位必要壁量算定 Wasmコアエンジン
 */
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
  // ドメインロック判定: 不正ドメイン時は計算を遮断
  if (!verifyDomain(domainHash)) {
    last_q1_cm = 0.0;
    last_q2_cm = 0.0;
    last_cq1 = 0.0;
    last_cq2 = 0.0;
    return -1;
  }

  // 1. 階高の安全ガード
  if (h1 < 1.0) h1 = 2.70;
  if (h2 < 1.0) h2 = 2.70;

  // 2. 屋根高さ・軒の出・屋根勾配
  if (roofHeight < 0.5) roofHeight = 1.71;
  if (overhang < 0.0) overhang = 0.75;
  if (roofSlope < 0.5) roofSlope = 4.0;

  const is2Story = (area2F > 0.0);

  // 3. 屋根割増係数 Z2 (勾配・軒出補正)
  const k_slope = Math.sqrt(Math.pow(roofSlope, 2.0) + 100.0) / 10.0;
  const Z2 = ((16.5 + overhang * 2.0) * (6.0 + overhang * 2.0) * k_slope) / (16.5 * 6.0);

  // 4. 屋根材仕様
  const roofWeightPerArea = rawRoofWeight * Z2;

  // 5. 太陽光発電
  const solarWeightPerArea = (hasSolar != 0) ? (solarWeight * Z2) : 0.0;

  // 6. 積雪荷重
  let snowWeightPerArea = 0.0;
  if (isSnowArea != 0 && snowDepth > 0.0 && snowUnitLoad > 0.0) {
    snowWeightPerArea = (snowDepth * snowUnitLoad * 0.35 * Z2) / k_slope;
  }

  const totalRoofLoadPerArea = roofWeightPerArea + solarWeightPerArea + ceilingIns + snowWeightPerArea;

  // 7. 外壁仕様
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

  // 8. 床荷重
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
