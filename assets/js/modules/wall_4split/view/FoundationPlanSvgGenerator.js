/**
 * view/FoundationPlanSvgGenerator.js - SVG Generator for Foundation Plan (基礎伏図)
 * v3.14.0: Single Responsibility Principle (SRP) - Visual CAD generator for Foundation Plan
 * Displays: Foundation beam symbols, slab symbols, 1F pillars, pillar-base hardware (柱脚金物), dimension lines, and grid axes.
 */

(function(exports) {
    'use strict';

    const FoundationPlanSvgGenerator = {
        /**
         * 基礎伏図のSVGマークアップを生成
         * @param {Object} state - AppState
         * @param {Object} [options] - オプション設定
         * @returns {string} SVGマークアップ文字列
         */
        generateFoundationPlanSvg: function(state, options = {}) {
            const s = state || (typeof window !== 'undefined' ? window.AppState : null);
            if (!s) return '';

            const beams = s.foundationBeams || [];
            const slabs = s.foundationSlabs || [];
            const pillars = (s.pillars || []).filter(p => !p.isDeleted && !p.isInvalidPos && (p.floor === 1 || p.floor === '1F' || p.floor === undefined));
            const gridXC = s.gridXCoords || [];
            const gridYC = s.gridYCoords || [];
            const gridXN = s.gridXNames || [];
            const gridYN = s.gridYNames || [];

            // 1. バウンディングボックスの算出
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            gridXC.forEach(x => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); });
            gridYC.forEach(y => { minY = Math.min(minY, y); maxY = Math.max(maxY, y); });

            beams.forEach(b => {
                [b.p1, b.p2].forEach(p => {
                    if (p) {
                        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
                    }
                });
            });

            slabs.forEach(sl => {
                (sl.vertices || []).forEach(v => {
                    minX = Math.min(minX, v.x); minY = Math.min(minY, v.y);
                    maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y);
                });
            });

            pillars.forEach(p => {
                minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
            });

            if (!isFinite(minX) || !isFinite(maxX)) {
                minX = 0; maxX = 7280; minY = 0; maxY = 5460;
            }

            const modelW = Math.max(maxX - minX, 1820);
            const modelH = Math.max(maxY - minY, 1820);

            // SVGサイズと余白設計（寸法線・通り芯シンボル用に十分なマージンを確保）
            const svgW = options.width || 840;
            const svgH = options.height || 600;
            const padLeft = 85;
            const padRight = 50;
            const padTop = 65;
            const padBottom = 85;

            const availW = svgW - padLeft - padRight;
            const availH = svgH - padTop - padBottom;
            const scale = Math.min(availW / modelW, availH / modelH);

            const offsetX = padLeft + (availW - modelW * scale) / 2;
            const offsetY = padTop + (availH - modelH * scale) / 2;

            // 座標変換関数 (CAD: Y上向き -> SVG: Y下向き)
            const toSx = (x) => offsetX + (x - minX) * scale;
            const toSy = (y) => svgH - (offsetY + (y - minY) * scale);

            let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" height="auto" style="background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; display:block; font-family:'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'BIZ UDPGothic', sans-serif;">\n`;

            // 定義部 (マーカー・スタイル)
            svg += `  <defs>
    <filter id="badge-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.15" />
    </filter>
  </defs>\n`;

            // タイトルバー & 方位記号
            svg += `  <!-- タイトル & 情報 -->
  <text x="${padLeft}" y="28" font-size="14" font-weight="bold" fill="#0f172a">基礎伏図（基礎梁符号・スラブ符号・1F柱・柱脚金物）</text>
  <text x="${svgW - padRight}" y="28" font-size="11" fill="#64748b" text-anchor="end">S = 1 : ${(1 / scale * 10).toFixed(0)} (AUTO)</text>
  
  <!-- 方位記号 (北) -->
  <g transform="translate(${svgW - 40}, 55)">
    <circle cx="0" cy="0" r="14" fill="#f8fafc" stroke="#64748b" stroke-width="1.2" />
    <polygon points="0,-12 4,2 0,0" fill="#2563eb" />
    <polygon points="0,-12 -4,2 0,0" fill="#64748b" />
    <text x="0" y="-14" font-size="9" font-weight="bold" fill="#2563eb" text-anchor="middle">N</text>
  </g>\n`;

            // 2. 通り芯線の描画
            svg += `  <!-- 通り芯線 -->\n  <g id="grid-lines" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="6,3,1.5,3">\n`;
            gridXC.forEach((x, i) => {
                const sx = toSx(x);
                svg += `    <line x1="${sx.toFixed(1)}" y1="${(padTop - 20)}" x2="${sx.toFixed(1)}" y2="${(svgH - padBottom + 20)}" />\n`;
            });
            gridYC.forEach((y, i) => {
                const sy = toSy(y);
                svg += `    <line x1="${(padLeft - 20)}" y1="${sy.toFixed(1)}" x2="${(svgW - padRight + 20)}" y2="${sy.toFixed(1)}" />\n`;
            });
            svg += `  </g>\n`;

            // 3. 通り芯記号（丸囲み）
            svg += `  <!-- 通り芯バルーン -->\n  <g id="grid-bubbles">\n`;
            gridXC.forEach((x, i) => {
                const sx = toSx(x);
                const name = gridXN[i] || `X${i + 1}`;
                // 上側バルーン
                svg += `    <circle cx="${sx.toFixed(1)}" cy="${(padTop - 28)}" r="10" fill="#f8fafc" stroke="#475569" stroke-width="1.2" />\n`;
                svg += `    <text x="${sx.toFixed(1)}" y="${(padTop - 24)}" font-size="9.5" font-weight="bold" fill="#1e293b" text-anchor="middle">${name}</text>\n`;
            });
            gridYC.forEach((y, i) => {
                const sy = toSy(y);
                const name = gridYN[i] || `Y${i + 1}`;
                // 左側バルーン
                svg += `    <circle cx="${(padLeft - 28)}" cy="${sy.toFixed(1)}" r="10" fill="#f8fafc" stroke="#475569" stroke-width="1.2" />\n`;
                svg += `    <text x="${(padLeft - 28)}" y="${(sy + 3.5).toFixed(1)}" font-size="9.5" font-weight="bold" fill="#1e293b" text-anchor="middle">${name}</text>\n`;
            });
            svg += `  </g>\n`;

            // 4. 寸法線 (グリッド間 & 総寸法)
            svg += `  <!-- 寸法線 -->\n  <g id="dimensions" stroke="#64748b" stroke-width="0.9">\n`;
            // X方向グリッド間寸法 (下部)
            const dimY1 = svgH - padBottom + 30;
            const dimY2 = svgH - padBottom + 52;
            for (let i = 0; i < gridXC.length - 1; i++) {
                const x1 = gridXC[i], x2 = gridXC[i + 1];
                const sx1 = toSx(x1), sx2 = toSx(x2);
                const spanMm = Math.round(Math.abs(x2 - x1));
                const midX = (sx1 + sx2) / 2;

                svg += `    <line x1="${sx1.toFixed(1)}" y1="${dimY1}" x2="${sx2.toFixed(1)}" y2="${dimY1}" />\n`;
                svg += `    <line x1="${sx1.toFixed(1)}" y1="${dimY1 - 4}" x2="${sx1.toFixed(1)}" y2="${dimY1 + 4}" />\n`;
                svg += `    <line x1="${sx2.toFixed(1)}" y1="${dimY1 - 4}" x2="${sx2.toFixed(1)}" y2="${dimY1 + 4}" />\n`;
                svg += `    <text x="${midX.toFixed(1)}" y="${dimY1 - 3}" font-size="8.5" fill="#334155" text-anchor="middle">${spanMm}</text>\n`;
            }
            if (gridXC.length >= 2) {
                const sxStart = toSx(gridXC[0]), sxEnd = toSx(gridXC[gridXC.length - 1]);
                const totalX = Math.round(Math.abs(gridXC[gridXC.length - 1] - gridXC[0]));
                svg += `    <line x1="${sxStart.toFixed(1)}" y1="${dimY2}" x2="${sxEnd.toFixed(1)}" y2="${dimY2}" stroke-width="1.2" />\n`;
                svg += `    <line x1="${sxStart.toFixed(1)}" y1="${dimY2 - 5}" x2="${sxStart.toFixed(1)}" y2="${dimY2 + 5}" />\n`;
                svg += `    <line x1="${sxEnd.toFixed(1)}" y1="${dimY2 - 5}" x2="${sxEnd.toFixed(1)}" y2="${dimY2 + 5}" />\n`;
                svg += `    <text x="${((sxStart + sxEnd) / 2).toFixed(1)}" y="${dimY2 - 3}" font-size="9" font-weight="bold" fill="#0f172a" text-anchor="middle">${totalX}</text>\n`;
            }

            // Y方向グリッド間寸法 (右部)
            const dimX1 = svgW - padRight + 22;
            const dimX2 = svgW - padRight + 42;
            for (let i = 0; i < gridYC.length - 1; i++) {
                const y1 = gridYC[i], y2 = gridYC[i + 1];
                const sy1 = toSy(y1), sy2 = toSy(y2);
                const spanMm = Math.round(Math.abs(y2 - y1));
                const midY = (sy1 + sy2) / 2;

                svg += `    <line x1="${dimX1}" y1="${sy1.toFixed(1)}" x2="${dimX1}" y2="${sy2.toFixed(1)}" />\n`;
                svg += `    <line x1="${dimX1 - 4}" y1="${sy1.toFixed(1)}" x2="${dimX1 + 4}" y2="${sy1.toFixed(1)}" />\n`;
                svg += `    <line x1="${dimX1 - 4}" y1="${sy2.toFixed(1)}" x2="${dimX1 + 4}" y2="${sy2.toFixed(1)}" />\n`;
                svg += `    <text x="${dimX1 + 3}" y="${(midY + 3).toFixed(1)}" font-size="8.5" fill="#334155" text-anchor="start">${spanMm}</text>\n`;
            }
            if (gridYC.length >= 2) {
                const syStart = toSy(gridYC[0]), syEnd = toSy(gridYC[gridYC.length - 1]);
                const totalY = Math.round(Math.abs(gridYC[gridYC.length - 1] - gridYC[0]));
                svg += `    <line x1="${dimX2}" y1="${syStart.toFixed(1)}" x2="${dimX2}" y2="${syEnd.toFixed(1)}" stroke-width="1.2" />\n`;
                svg += `    <line x1="${dimX2 - 5}" y1="${syStart.toFixed(1)}" x2="${dimX2 + 5}" y2="${syStart.toFixed(1)}" />\n`;
                svg += `    <line x1="${dimX2 - 5}" y1="${syEnd.toFixed(1)}" x2="${dimX2 + 5}" y2="${syEnd.toFixed(1)}" />\n`;
                svg += `    <text x="${dimX2 + 4}" y="${(((syStart + syEnd) / 2) + 3).toFixed(1)}" font-size="9" font-weight="bold" fill="#0f172a" text-anchor="start">${totalY}</text>\n`;
            }
            svg += `  </g>\n`;

            // 5. スラブ（ポリゴン ＆ スラブ符号）
            svg += `  <!-- スラブポリゴン & スラブ符号 -->\n  <g id="slabs">\n`;
            slabs.forEach((sl, idx) => {
                if (!sl.vertices || sl.vertices.length < 3) return;
                const pts = sl.vertices.map(v => `${toSx(v.x).toFixed(1)},${toSy(v.y).toFixed(1)}`).join(' ');
                svg += `    <polygon points="${pts}" fill="rgba(241,245,249,0.7)" stroke="#64748b" stroke-width="1.2" />\n`;

                // スラブ重心
                const cx = sl.vertices.reduce((sum, v) => sum + v.x, 0) / sl.vertices.length;
                const cy = sl.vertices.reduce((sum, v) => sum + v.y, 0) / sl.vertices.length;
                const scx = toSx(cx);
                const scy = toSy(cy);

                const sp = sl.props || {};
                const slabName = sp.name || `FS${idx + 1}`;
                const slabThick = sp.slabThickness || sp.thickness || 150;
                const rebarShort = typeof sp.rebarShort === 'string' ? sp.rebarShort : (sp.rebarShort ? `${sp.rebarShort.type}@${sp.rebarShort.pitch}` : 'D13@200');

                // スラブ符号バッジ
                svg += `    <g transform="translate(${scx.toFixed(1)}, ${scy.toFixed(1)})" filter="url(#badge-shadow)">
      <rect x="-35" y="-14" width="70" height="28" rx="4" fill="#ffffff" stroke="#0284c7" stroke-width="1.2" />
      <text x="0" y="-2" font-size="9" font-weight="bold" fill="#0369a1" text-anchor="middle">${slabName}</text>
      <text x="0" y="9" font-size="7.5" fill="#64748b" text-anchor="middle">t=${slabThick} (${rebarShort})</text>
    </g>\n`;
            });
            svg += `  </g>\n`;

            // 6. 基礎梁（梁躯体・軸線 ＆ 基礎梁符号）
            svg += `  <!-- 基礎梁躯体 & 符号 -->\n  <g id="beams">\n`;
            beams.forEach((beam, bIdx) => {
                if (!beam.p1 || !beam.p2) return;
                const sx1 = toSx(beam.p1.x), sy1 = toSy(beam.p1.y);
                const sx2 = toSx(beam.p2.x), sy2 = toSy(beam.p2.y);
                const bp = beam.props || {};
                const widthMm = bp.width || 150;
                const strokeW = Math.max(3, Math.min(8, widthMm * scale));

                // 梁コンクリート幅の線
                svg += `    <line x1="${sx1.toFixed(1)}" y1="${sy1.toFixed(1)}" x2="${sx2.toFixed(1)}" y2="${sy2.toFixed(1)}" stroke="#1e293b" stroke-width="${strokeW.toFixed(1)}" stroke-linecap="round" />\n`;
                // 梁芯線
                svg += `    <line x1="${sx1.toFixed(1)}" y1="${sy1.toFixed(1)}" x2="${sx2.toFixed(1)}" y2="${sy2.toFixed(1)}" stroke="#38bdf8" stroke-width="0.8" stroke-dasharray="3,2" />\n`;

                // 梁符号の配置（スパンがある場合はスパンごと、なければ梁中央）
                if (beam.spans && beam.spans.length > 0) {
                    beam.spans.forEach((span, sIdx) => {
                        const sp1 = span.p1 || beam.p1;
                        const sp2 = span.p2 || beam.p2;
                        const mx = (toSx(sp1.x) + toSx(sp2.x)) / 2;
                        const my = (toSy(sp1.y) + toSy(sp2.y)) / 2;
                        const spProps = span.props || {};
                        const sym = (spProps.symbol || span.symbol || bp.symbol || `FG${sIdx + 1}`).trim();

                        svg += `    <g transform="translate(${mx.toFixed(1)}, ${my.toFixed(1)})" filter="url(#badge-shadow)">
      <rect x="-20" y="-9" width="40" height="18" rx="3" fill="#ffffff" stroke="#2563eb" stroke-width="1.2" />
      <text x="0" y="3.5" font-size="9" font-weight="bold" fill="#1e40af" text-anchor="middle">${sym}</text>
    </g>\n`;
                    });
                } else {
                    const mx = (sx1 + sx2) / 2;
                    const my = (sy1 + sy2) / 2;
                    const sym = (bp.symbol || bp.beamName || `FG${bIdx + 1}`).trim();

                    svg += `    <g transform="translate(${mx.toFixed(1)}, ${my.toFixed(1)})" filter="url(#badge-shadow)">
      <rect x="-20" y="-9" width="40" height="18" rx="3" fill="#ffffff" stroke="#2563eb" stroke-width="1.2" />
      <text x="0" y="3.5" font-size="9" font-weight="bold" fill="#1e40af" text-anchor="middle">${sym}</text>
    </g>\n`;
                }
            });
            svg += `  </g>\n`;

            // 7. 1F柱 ＆ 柱脚金物 (Pillars & Hardware)
            svg += `  <!-- 1F柱 & 柱脚金物 -->\n  <g id="pillars-and-hardware">\n`;
            pillars.forEach((p, pIdx) => {
                const sx = toSx(p.x);
                const sy = toSy(p.y);
                const pSize = Math.max(5, Math.min(10, 105 * scale));
                const halfSize = pSize / 2;

                // 柱シンボル（正方形）
                svg += `    <!-- 柱 ${p.id || pIdx} -->\n`;
                svg += `    <rect x="${(sx - halfSize).toFixed(1)}" y="${(sy - halfSize).toFixed(1)}" width="${pSize.toFixed(1)}" height="${pSize.toFixed(1)}" fill="#0f172a" stroke="#ffffff" stroke-width="0.8" />\n`;

                // 柱脚金物（N値または手動設定マーク/金物名）
                const mark = p.manualMark || p.nMark || '';
                const hardware = p.hardware || p.jointMetal || '';
                const nVal = (p.nValue !== undefined && p.nValue !== null) ? Number(p.nValue).toFixed(2) : null;

                const hasHardware = (mark && mark !== '不要' && mark !== '-') || hardware;

                if (hasHardware) {
                    const badgeText = hardware ? `${mark ? `[${mark}] ` : ''}${hardware}` : `[${mark}]`;
                    // 柱の右上にオフセットしてバッジ描画
                    const bx = sx + halfSize + 3;
                    const by = sy - halfSize - 2;

                    // 高耐力金物（HD金物等）は赤色系、通常金物は青緑色系
                    const isHD = mark === '2' || mark === '3' || mark === '4' || mark === '5' || mark === '32' || hardware.includes('HD');
                    const badgeColor = isHD ? '#dc2626' : '#0d9488';
                    const badgeBg = isHD ? '#fef2f2' : '#f0fdfa';

                    svg += `    <g transform="translate(${bx.toFixed(1)}, ${by.toFixed(1)})">
      <rect x="0" y="-10" width="${Math.max(24, badgeText.length * 5.5 + 8)}" height="13" rx="2" fill="${badgeBg}" stroke="${badgeColor}" stroke-width="0.8" />
      <text x="3" y="-1" font-size="7.5" font-weight="bold" fill="${badgeColor}">${badgeText}</text>
      ${nVal ? `<text x="3" y="9" font-size="6.5" fill="#64748b">N=${nVal}</text>` : ''}
    </g>\n`;
                }
            });
            svg += `  </g>\n`;

            // 8. 凡例ボックス (下部または左下)
            svg += `  <!-- 凡例ボックス -->
  <g transform="translate(${padLeft}, ${svgH - padBottom + 65})">
    <rect x="0" y="-10" width="${availW}" height="24" rx="3" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
    <text x="10" y="6" font-size="8" fill="#475569">
      <tspan font-weight="bold" fill="#0f172a">【凡例】</tspan>
      <tspan dx="8" fill="#1e40af">■ 基礎梁符号 [FG*]</tspan>
      <tspan dx="8" fill="#0369a1">■ スラブ符号 [FS*]</tspan>
      <tspan dx="8" fill="#0f172a">■ 1F柱</tspan>
      <tspan dx="8" fill="#dc2626">■ 柱脚金物 (HD/引抜金物)</tspan>
      <tspan dx="8" fill="#0d9488">■ 柱脚金物 (VP/山形・平金物)</tspan>
    </text>
  </g>\n`;

            svg += `</svg>`;
            return svg;
        }
    };

    // グローバルおよびモジュールエクスポート
    if (typeof exports !== 'undefined') {
        exports.FoundationPlanSvgGenerator = FoundationPlanSvgGenerator;
    }
    if (typeof window !== 'undefined') {
        window.FoundationPlanSvgGenerator = FoundationPlanSvgGenerator;
    }

})(typeof module !== 'undefined' && module.exports ? module.exports : this);
