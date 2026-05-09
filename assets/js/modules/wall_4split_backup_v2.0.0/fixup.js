const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'wall_4split_main.js');
let content = fs.readFileSync(targetPath, 'utf8');
const lines = content.split('\n');

// 1. レガシーブロック（86行目〜588行目）の削除
// 0-indexed で 85 〜 587 を削除する
// ただし元のファイルの安全性を期すため、マーカー等があればベターですが、行数で切ります。
// 事前に確認した情報:
// line 85 (idx 84): function handleModeChange() { ... } \n
// line 86 (idx 85): // [基礎計算追加 Phase1] アプリモードの切替関数
// line 589 (idx 588): // --- 基礎モード関連の操作ハンドラは...
const newLines = [...lines.slice(0, 85), ...lines.slice(588)];
content = newLines.join('\n');

// 2. 文字列の置換
content = content.replace(/getAppMode\(\)/g, "(window.AppState ? window.AppState.currentAppMode : 'wall')");
content = content.replace(/getFdMode\(\)/g, "(window.AppState ? window.AppState.foundationMode : 'f_beam')");
content = content.replace(/'tab-foundation'/g, "'tab-fd'");

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Successfully cleaned and updated wall_4split_main.js via Node.js");
