const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(filePath, 'utf8');

// ?v=... を最新バージョンに更新
content = content.replace(/\?v=v?[0-9\.]+/g, '?v=3.0.0');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Cache busters updated successfully in index.html');
