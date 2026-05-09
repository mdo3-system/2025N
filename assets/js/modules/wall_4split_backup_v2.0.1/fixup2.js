const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'wall_4split_main.js');
let content = fs.readFileSync(targetPath, 'utf8');

const regex = /Object\.defineProperties\(window,\s*\{[\s\S]*?\}\);/;
const replacement = `window.AppState = window.AppState || {};

const _propKeys = [
    'currentFloor', 'isPrintMode', 'reqWall', 'currentTotalVal', 'bgLinesOriginal', 'bgTextsOriginal',
    'gridBubbles', 'pillars', 'walls', 'windowsArr', 'historyStack', 'redoStack', 'areaLines',
    'gridXNames', 'gridYNames', 'gridXCoords', 'gridYCoords', 'userEditedGridX', 'userEditedGridY',
    'manualGridX', 'manualGridY', 'areaDrawPoints', 'deletedGridX', 'deletedGridY', 'scale', 'offsetX',
    'offsetY', 'isDragging', 'lastMouseX', 'lastMouseY', 'mouseX', 'mouseY', 'hoveredPillar',
    'selectedPillar', 'snapPoint', 'currentG', 'currentC', 'exteriorWallWeight', 'roofWeight',
    'solarWeight', 'ceilingInsWeight', 'wallInsWeight', 'elementVisibility', 'pIdCounter',
    'window_currentDxfRaw', 'docDrawings', 'canvas', 'ctx', 'currentAppMode', 'exteriorWalls',
    'foundationBeams', 'foundationSlabs', 'manholes', 'foundationMode', 'fdDrawPoints',
    'fdSelectedPillarLike', 'selectedFoundationBeam'
];

_propKeys.forEach(key => {
    Object.defineProperty(window, key, {
        get: () => window.AppState ? window.AppState[key] : undefined,
        set: (v) => { if (window.AppState) window.AppState[key] = v; },
        enumerable: true,
        configurable: true
    });
});`;

content = content.replace(regex, replacement);
fs.writeFileSync(targetPath, content, 'utf8');
console.log("Successfully replaced defineProperties block.");
