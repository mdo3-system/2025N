<?php
// ==========================================
// api_calc.php - 構造計算バックエンドAPI
// N値計算等の重いロジックをサーバーサイドで実行
// ==========================================

// CORSヘッダー設定 (Xserverとローカル環境両対応)
header("Access-Control-Allow-Origin: *"); // 本番では特定のドメインに絞ることを推奨
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// OPTIONSメソッド（プリフライトリクエスト）の場合はすぐに200を返す
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ==========================================
// セッション認証・セキュリティ
// ==========================================
// 実際の利用時にはコメントアウトを外して bootstrap.php を読み込む
// $bootstrapFilePath = __DIR__ . '/bootstrap.php';
// if (file_exists($bootstrapFilePath)) {
//     require_once $bootstrapFilePath;
//     if (function_exists('has_active_subscription') && !has_active_subscription()) {
//         http_response_code(403);
//         echo json_encode(['error' => 'Active subscription is required to perform calculations.']);
//         exit;
//     }
// }

// POSTデータ(JSON)をパース
$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload.']);
    exit;
}

// データの受け取り
$pillars = isset($data['pillars']) ? $data['pillars'] : [];
$walls = isset($data['walls']) ? $data['walls'] : [];
$vals = isset($data['vals']) ? $data['vals'] : [];
$hwList = isset($data['hwList']) ? $data['hwList'] : [];

$gridXCoords = isset($data['gridXCoords']) ? $data['gridXCoords'] : [];
$gridYCoords = isset($data['gridYCoords']) ? $data['gridYCoords'] : [];
$gridXNames = isset($data['gridXNames']) ? $data['gridXNames'] : [];
$gridYNames = isset($data['gridYNames']) ? $data['gridYNames'] : [];

function getGridName($val, $coords, $names, $fallback) {
    if (empty($coords) || empty($names)) return $fallback;
    foreach ($coords as $i => $c) {
        if (abs($val - $c) < 50 && isset($names[$i])) {
            return $names[$i];
        }
    }
    return $fallback;
}

// ユーティリティ値の取得
$h1 = isset($vals['n-h1']) ? (float)$vals['n-h1'] : 2.7;
$h2 = isset($vals['n-h2']) ? (float)$vals['n-h2'] : 2.7;
$wRoof = isset($vals['w-roof']) ? (float)$vals['w-roof'] : 0.60;
$wFloor = isset($vals['w-floor']) ? (float)$vals['w-floor'] : 0.60;
$p_d1 = isset($vals['p-d1']) ? (float)$vals['p-d1'] : 105;
$p_d2 = isset($vals['p-d2']) ? (float)$vals['p-d2'] : 105;

// ==========================================
// N値計算ロジック移植
// ==========================================
// 2階柱の抽出とインデックス化
$pillars2F = [];
$map2FByName = [];
$xs2F = [];
$ys2F = [];

foreach ($pillars as $p) {
    if (empty($p['isDeleted']) && empty($p['isInvalidPos']) && isset($p['floor']) && $p['floor'] === '2F') {
        $pillars2F[] = $p;
        $gName = isset($p['gName']) ? $p['gName'] : null;
        if ($gName && $gName !== '位置不明') {
            $map2FByName[$gName] = $p;
        }
        $xs2F[] = $p['x'];
        $ys2F[] = $p['y'];
    }
}

$bb2F = null;
if (count($xs2F) > 0) {
    $bb2F = [
        'minX' => min($xs2F),
        'maxX' => max($xs2F),
        'minY' => min($ys2F),
        'maxY' => max($ys2F)
    ];
}

$has2FAbove = function($p) /*use ($map2FByName, $bb2F)*/ {
    global $map2FByName, $bb2F;
    $gName = isset($p['gName']) ? $p['gName'] : null;
    if ($gName && isset($map2FByName[$gName])) return true;
    if ($bb2F && $p['x'] >= $bb2F['minX'] && $p['x'] <= $bb2F['maxX'] && $p['y'] >= $bb2F['minY'] && $p['y'] <= $bb2F['maxY']) return true;
    return false;
};

$collectAlpha = function($targetPillarId, $targetFloor, $refP) /*use ($walls)*/ {
    global $walls;
    $aL = 0; $aR = 0; $aB = 0; $aT = 0;
    $parts = ['X' => [], 'Y' => []];

    foreach ($walls as $w) {
        if ($w['floor'] === $targetFloor && ($w['p1']['id'] === $targetPillarId || $w['p2']['id'] === $targetPillarId)) {
            $tv = isset($w['totalVal']) ? (float)$w['totalVal'] : 0;
            if ($tv === 0.0) continue;
            
            $op = ($w['p1']['id'] === $targetPillarId) ? $w['p2'] : $w['p1'];
            
            // X, Yの差分
            $dx = abs($op['x'] - $refP['x']);
            $dy = abs($op['y'] - $refP['y']);
            $L_wall = sqrt($dx*$dx + $dy*$dy) / 1000.0;
            if ($L_wall == 0) continue;

            $ratioX = min(1, max(-1, $dx / 1000.0 / $L_wall));
            $ratioY = min(1, max(-1, $dy / 1000.0 / $L_wall));
            $degX = acos($ratioX) * 180.0 / M_PI;
            $degY = acos($ratioY) * 180.0 / M_PI;

            $cos2X = $ratioX * $ratioX;
            $cos2Y = $ratioY * $ratioY;
            
            // 実効倍率（小数点第3位切り捨て = 第2位まで）
            $effMx = floor($tv * $cos2X * 100) / 100;
            $effMy = floor($tv * $cos2Y * 100) / 100;

            // N値計算における負担は実効倍率を使用する -> 【修正】柱の引抜力は元のせん断耐力に依存するため按分前の倍率($tv)を使用する
            $effX = $effMx;
            $effY = $effMy;

            // N値計算用なので、15度未満かつ1.82m未満のカットオフは除外（全て拾う）

            if ($effX > 0) {
                if ($op['x'] >= $refP['x']) { 
                    $aR += $tv; 
                    $parts['X'][] = '右' . number_format($tv, 2, '.', ''); 
                } else { 
                    $aL += $tv; 
                    $parts['X'][] = '左' . number_format($tv, 2, '.', ''); 
                }
            }
            if ($effY > 0) {
                if ($op['y'] >= $refP['y']) { 
                    $aT += $tv; 
                    $parts['Y'][] = '上' . number_format($tv, 2, '.', ''); 
                } else { 
                    $aB += $tv; 
                    $parts['Y'][] = '下' . number_format($tv, 2, '.', ''); 
                }
            }
        }
    }
    return ['aL' => $aL, 'aR' => $aR, 'aB' => $aB, 'aT' => $aT, 'parts' => $parts];
};

// 計算後の柱配列
$processedPillars = [];
$pillarRefMap = [];

// まず2階柱のAlpha収集
foreach ($pillars as &$p) {
    if (empty($p['isDeleted']) && empty($p['isInvalidPos']) && isset($p['floor']) && $p['floor'] === '2F') {
        $isC = isset($p['isManualCorner']) && $p['isManualCorner'] !== null ? $p['isManualCorner'] : (isset($p['isCornerAuto']) ? $p['isCornerAuto'] : false);
        $p['isC'] = $isC;
        
        $res = $collectAlpha($p['id'], '2F', $p);
        $p['Ax'] = abs($res['aR'] - $res['aL']); 
        $p['Ay'] = abs($res['aT'] - $res['aB']); 
        $p['_parts'] = $res['parts'];
        
        // 名前のマップを更新 (上階参照用)
        if (isset($p['gName']) && $p['gName'] !== '位置不明') {
            $map2FByName[$p['gName']] = $p;
        }
    }
}
unset($p);

foreach (['2F', '1F'] as $f) {
    foreach ($pillars as &$p) {
        if (!empty($p['isDeleted']) || !empty($p['isInvalidPos']) || !isset($p['floor']) || $p['floor'] !== $f) continue;

        $isC = isset($p['isManualCorner']) && $p['isManualCorner'] !== null ? $p['isManualCorner'] : (isset($p['isCornerAuto']) ? $p['isCornerAuto'] : false);
        $p['isC'] = $isC;
        $b = $isC ? 0.8 : 0.5;

        $baseH = ($f === '1F') ? $h1 : $h2;
        $p_h = (isset($p['manualH']) && $p['manualH'] !== null) ? $p['manualH'] : $baseH;
        $p_d = (isset($p['manualD']) && $p['manualD'] !== null) ? $p['manualD'] : ($f === '1F' ? $p_d1 : $p_d2);

        $l_0 = $p_h;
        $lambda = ($l_0 * 1000 * sqrt(12)) / $p_d;

        $p['d'] = $p_d;
        $p['l_0'] = $l_0;
        $p['lambda'] = $lambda;
        $p['lambdaOK'] = $lambda <= 150;

        $k_p = $p_h / 2.7;

        $usedArea = (isset($p['manualArea']) && $p['manualArea'] !== null) ? $p['manualArea'] : (isset($p['autoArea']) ? $p['autoArea'] : 0);
        $p['usedArea'] = $usedArea;
        $isDetail = (isset($p['lCalcMode']) && $p['lCalcMode'] === 'detail');

        if ($f === '1F') {
            $p['h1'] = $p_h;
            $gName = isset($p['gName']) ? $p['gName'] : null;
            $upper = ($gName && isset($map2FByName[$gName])) ? $map2FByName[$gName] : null;
            $p['h2'] = $upper ? ((isset($upper['manualH']) && $upper['manualH'] !== null) ? $upper['manualH'] : $h2) : null;

            $underUpper = $has2FAbove($p);
            $res = $collectAlpha($p['id'], '1F', $p);
            $Ax1 = abs($res['aR'] - $res['aL']);
            $Ay1 = abs($res['aT'] - $res['aB']);
            $p['Ax'] = $Ax1; 
            $p['Ay'] = $Ay1;
            
            $L = 0;
            if ($isDetail) {
                $W_kN = ($underUpper ? ($wRoof + $wFloor) : $wRoof) * $usedArea; 
                $L = $W_kN / 5.3;
            } else {
                $L = $underUpper ? ($isC ? 1.0 : 1.6) : ($isC ? 0.4 : 0.6);
            }
            $p['L_val'] = $L;

            $Nx = 0; $Ny = 0; $cStrX = ''; $cStrY = '';
            $parts = $res['parts'];
            
            if ($underUpper && $upper) {
                $isC2 = isset($upper['isManualCorner']) && $upper['isManualCorner'] !== null ? $upper['isManualCorner'] : (isset($upper['isCornerAuto']) ? $upper['isCornerAuto'] : false);
                $b2 = $isC2 ? 0.8 : 0.5;
                $Ax2 = isset($upper['Ax']) ? $upper['Ax'] : 0;
                $Ay2 = isset($upper['Ay']) ? $upper['Ay'] : 0;
                $p2Parts = isset($upper['_parts']) ? $upper['_parts'] : ['X' => [], 'Y' => []];
                $k_upper = $p['h2'] / 2.7;

                $Nx = ($Ax1 * $b * $k_p) + ($Ax2 * $b2 * $k_upper) - $L;
                $Ny = ($Ay1 * $b * $k_p) + ($Ay2 * $b2 * $k_upper) - $L;
                
                $strXP1 = empty($parts['X']) ? '0' : implode('+', $parts['X']);
                $strXP2 = empty($p2Parts['X']) ? '0' : implode('+', $p2Parts['X']);
                $cStrX = "({$strXP1})|×b{$b}×k" . number_format($k_p, 2) . " + ({$strXP2})|×b{$b2}×k" . number_format($k_upper, 2) . " - L" . number_format($L, 2);
                
                $strYP1 = empty($parts['Y']) ? '0' : implode('+', $parts['Y']);
                $strYP2 = empty($p2Parts['Y']) ? '0' : implode('+', $p2Parts['Y']);
                $cStrY = "({$strYP1})|×b{$b}×k" . number_format($k_p, 2) . " + ({$strYP2})|×b{$b2}×k" . number_format($k_upper, 2) . " - L" . number_format($L, 2);
            } else {
                $Nx = $Ax1 * $b * $k_p - $L; 
                $Ny = $Ay1 * $b * $k_p - $L;
                
                $strXP1 = empty($parts['X']) ? '0' : implode('+', $parts['X']);
                $cStrX = "({$strXP1})|×b{$b}×k" . number_format($k_p, 2) . " - L" . number_format($L, 2);
                
                $strYP1 = empty($parts['Y']) ? '0' : implode('+', $parts['Y']);
                $cStrY = "({$strYP1})|×b{$b}×k" . number_format($k_p, 2) . " - L" . number_format($L, 2);
            }
            $p['nCalcX'] = $Nx; 
            $p['nCalcY'] = $Ny; 
            $p['nValue'] = max($Nx, $Ny, 0); 
            $p['cStrX'] = $cStrX; 
            $p['cStrY'] = $cStrY;
            
        } else {
            // 2F
            $p['h2'] = $p_h;
            $L = 0;
            if ($isDetail) {
                $W_kN = $wRoof * $usedArea;
                $L = $W_kN / 5.3;
            } else {
                $L = $isC ? 0.4 : 0.6;
            }
            $p['L_val'] = $L;

            $Nx = $p['Ax'] * $b * $k_p - $L;
            $Ny = $p['Ay'] * $b * $k_p - $L;
            $p['nCalcX'] = $Nx; 
            $p['nCalcY'] = $Ny; 
            $p['nValue'] = max($Nx, $Ny, 0);
            
            $pts = isset($p['_parts']) ? $p['_parts'] : ['X' => [], 'Y' => []];
            $strXP1 = empty($pts['X']) ? '0' : implode('+', $pts['X']);
            $strYP1 = empty($pts['Y']) ? '0' : implode('+', $pts['Y']);
            $p['cStrX'] = "({$strXP1})|×b{$b}×k" . number_format($k_p, 2) . " - L" . number_format($L, 2);
            $p['cStrY'] = "({$strYP1})|×b{$b}×k" . number_format($k_p, 2) . " - L" . number_format($L, 2);
        }

        // 判定マーク
        if (($p['Ax'] + $p['Ay']) == 0 || $p['nValue'] <= 0) {
            $p['nMark'] = '不要';
        } else {
            $found_hw = null;
            foreach ($hwList as $hw) {
                if ($hw['n'] >= $p['nValue']) {
                    $found_hw = $hw['name'];
                    break;
                }
            }
            $p['nMark'] = $found_hw ? $found_hw : '別途検討';
        }

        if (!empty($p['manualMark'])) {
            $p['nMark'] = $p['manualMark'];
        }
        
    }
}
unset($p);

// ==========================================
// 壁の計算根拠 (斜め壁実効倍率の証明テキスト)
// ==========================================
foreach ($walls as &$w) {
    $dx = abs($w['p2']['x'] - $w['p1']['x']);
    $dy = abs($w['p2']['y'] - $w['p1']['y']);
    $L_wall = sqrt($dx*$dx + $dy*$dy) / 1000.0;
    
    if ($L_wall > 0) {
        $ratioX = min(1, max(-1, $dx / 1000.0 / $L_wall));
        $ratioY = min(1, max(-1, $dy / 1000.0 / $L_wall));
        
        $degX = acos($ratioX) * 180.0 / M_PI;
        $degY = acos($ratioY) * 180.0 / M_PI;
        
        $tv = isset($w['totalVal']) ? (float)$w['totalVal'] : 0;
        
        // 斜め壁である場合（完全なX方向=0度, 完全なY方向=90度 以外）
        if ($tv > 0 && $degX > 0.1 && $degX < 89.9) {
            $w['_isDiagonal'] = true;
            $w['_L'] = $L_wall;
            $w['_degX'] = $degX;
            $w['_degY'] = $degY;
            $w['_tv'] = $tv;
            
            $cos2X = $ratioX * $ratioX;
            $cos2Y = $ratioY * $ratioY;
            
            // 実効倍率（小数点第3位切り捨て = 第2位まで）
            $effMx = floor($tv * $cos2X * 100) / 100;
            $effMy = floor($tv * $cos2Y * 100) / 100;
            
            // カットアウト判定 (壁量のみ適用)
            $cutX = ($degX > 75 && $L_wall < 1.82);
            $cutY = ($degY > 75 && $L_wall < 1.82);
            
            $kx = $cutX ? 0 : floor($L_wall * $effMx * 100) / 100;
            $ky = $cutY ? 0 : floor($L_wall * $effMy * 100) / 100;

            // 名前解決（X方向とY方向の通り芯名を取得して繋げる）
            $p1Name = getGridName($w['p1']['x'], $gridXCoords, $gridXNames, isset($w['p1']['gx']) ? $w['p1']['gx'] : '') . 
                      getGridName($w['p1']['y'], $gridYCoords, $gridYNames, isset($w['p1']['gy']) ? $w['p1']['gy'] : '');
            $p2Name = getGridName($w['p2']['x'], $gridXCoords, $gridXNames, isset($w['p2']['gx']) ? $w['p2']['gx'] : '') . 
                      getGridName($w['p2']['y'], $gridYCoords, $gridYNames, isset($w['p2']['gy']) ? $w['p2']['gy'] : '');
            $wNmStr = "[$p1Name-$p2Name]";

            // X方向の根拠式
            if ($cutX) {
                $w['evidenceX'] = "$wNmStr [X方向] L = " . number_format($L_wall, 2) . "m\n※X軸から75度超のため計算対象外\n※長さ1.82m未満のため存在壁量には不算入（N値計算のみ適用）";
            } else {
                // kx = L × (倍率 × cos²θ)
                $w['evidenceX'] = "$wNmStr [X方向] L = " . number_format($L_wall, 2) . "m\n" .
                                  "kx = L × (倍率 × cos²θ) = " . number_format($L_wall, 2) . " × (" . number_format($tv, 1) . " × " . number_format($cos2X, 3) . ") = " . number_format($kx, 2);
            }
            
            // Y方向の根拠式
            if ($cutY) {
                $w['evidenceY'] = "$wNmStr [Y方向] L = " . number_format($L_wall, 2) . "m\n※Y軸から75度超のため計算対象外\n※長さ1.82m未満のため存在壁量には不算入（N値計算のみ適用）";
            } else {
                $w['evidenceY'] = "$wNmStr [Y方向] L = " . number_format($L_wall, 2) . "m\n" .
                                  "ky = L × (倍率 × sin²θ) = " . number_format($L_wall, 2) . " × (" . number_format($tv, 1) . " × " . number_format($cos2Y, 3) . ") = " . number_format($ky, 2);
            }
        }
    }
}
unset($w);

// ------------------------------------------
// レスポンス出力
// ------------------------------------------
echo json_encode(['success' => true, 'pillars' => $pillars, 'walls' => $walls]);
exit;
