const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'templates', 'calcs', 'wall_4split.html');
let content = fs.readFileSync(filePath, 'utf8');

// ?v=2.6.7 を ?v=2.6.8 に置換
content = content.replace(/\?v=2\.6\.7/g, '?v=2.6.8');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Cache busters updated successfully in wall_4split.html');
