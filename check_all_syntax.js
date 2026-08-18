const fs = require('fs');
const path = require('path');

function getAllJsFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (!filePath.includes('node_modules') && !filePath.includes('.git') && !filePath.includes('archive') && !filePath.includes('backups')) {
                getAllJsFiles(filePath, fileList);
            }
        } else if (file.endsWith('.js')) {
            fileList.push(filePath);
        }
    });
    return fileList;
}

const baseDir = path.resolve(__dirname, 'assets/js/modules/wall_4split');
const jsFiles = getAllJsFiles(baseDir);

let errorCount = 0;
console.log(`🔍 Checking syntax of ${jsFiles.length} JavaScript files in ${baseDir}...`);

jsFiles.forEach(file => {
    const code = fs.readFileSync(file, 'utf8');
    try {
        new Function(code);
    } catch (e) {
        console.error(`❌ SYNTAX ERROR in ${path.relative(baseDir, file)}: ${e.message}`);
        errorCount++;
    }
});

if (errorCount === 0) {
    console.log(`✅ All ${jsFiles.length} JS files have PASSED syntax validation with 0 errors!`);
    process.exit(0);
} else {
    console.error(`❌ Total Syntax Errors: ${errorCount}`);
    process.exit(1);
}
