const fs = require('fs');
const path = require('path');
const dir = 'assets/js/modules/wall_4split';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let text = fs.readFileSync(filePath, 'utf8');
    let originalText = text;

    // Fix common corruption patterns
    text = text.replace(/alert\("チE.*?、E\);/g, 'alert("データを復元しました。\\n計算書用の挿絵は背景図形から再構築されました。");');
    text = text.replace(/innerText = "📂 チE.*?、E;/g, 'innerText = "📂 データを復元しました。";');
    text = text.replace(/alert\("JSON復允Eラー.*?err\.message\);/g, 'alert("JSON復元エラー \\n" + err.message);');
    text = text.replace(/alert\("セチE.*?、E\);/g, 'alert("セッションが切れました。再度ログインしてください。");');
    text = text.replace(/alert\('シスチE.*?、E\);/g, 'alert("システムエラーが発生しました。時間をおいて再度お試しください。");');
    text = text.replace(/throw new Error\("API通信エラー.*?、E\);/g, 'throw new Error("API通信エラーが発生しました。");');
    
    text = text.replace(/☁E/g, '☁️ ');
    text = text.replace(/ロジチE/g, 'ロジック');
    text = text.replace(/チEEタ/g, 'データ');
    text = text.replace(/復允E/g, '復元');
    text = text.replace(/シスチE/g, 'システム');
    text = text.replace(/セチE/g, 'セッション');
    text = text.replace(/忁E/g, '必要');
    text = text.replace(/、E\);/g, '");');
    text = text.replace(/、E;/g, '";');

    if (text !== originalText) {
        fs.writeFileSync(filePath, text, 'utf8');
        console.log(`Applied fixes to ${file}`);
    }
});






