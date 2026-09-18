const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.resolve(__dirname, '../index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

const startMarker = '<!-- JavaScript モジュール群 -->';
const endMarker = '<!-- マジックリンク認証制御JS -->';

const startIndex = html.indexOf(startMarker);
const endIndex = html.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error('Markers not found!');
    process.exit(1);
}

const replacement = '<!-- JavaScript モジュール群 (本番バンドル・難読化版: 開発時は index.dev.html を参照) -->\n    <script src="assets/js/modules/wall_4split/dist/wall_4split.bundle.min.js?v=3.13.30"></script>\n\n    ';

html = html.substring(0, startIndex) + replacement + html.substring(endIndex);

// 全体のバージョンを 3.13.30 に更新
html = html.replace(/\?v=v?[0-9\.]+/g, '?v=3.13.30');
html = html.replace(/v3\.13\.29/g, 'v3.13.30');

fs.writeFileSync(indexHtmlPath, html, 'utf8');
console.log('✅ Successfully updated index.html to bundle script with v3.13.30!');
