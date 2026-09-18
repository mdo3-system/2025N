const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function checkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '.git') {
                checkDir(full);
            }
        } else if (entry.name.endsWith('.js') && !entry.name.includes('.bak')) {
            try {
                execSync(`node -c "${full}"`);
            } catch (err) {
                console.error(`❌ Syntax error in: ${full}`);
                process.exit(1);
            }
        }
    }
}

const target = path.resolve(__dirname, '../assets/js/modules/wall_4split');
checkDir(target);
console.log('✅ All JS files passed syntax check successfully!');
