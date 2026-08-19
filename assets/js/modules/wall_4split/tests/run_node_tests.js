const fs = require('fs');
const path = require('path');

// 1. グローバル window / document モック環境の構築
global.window = {
    AppConfig: {
        TOLERANCE: {
            GRID_SNAP: 150,
            MANUAL_GRID: 50,
            TEXT_GRID: 1000
        }
    },
    AppState: {
        config: {
            roofThickness: 150
        },
        pillars: [],
        walls: [],
        foundationBeams: [],
        foundationSlabs: [],
        roofFaces: [],
        grids: []
    }
};

// ユーティリティ登録
global.document = {
    getElementById: () => null,
    querySelectorAll: () => []
};

// logic ファイル群の読み込み
const filesToLoad = [
    '../logic/ServiceContainer.js',
    '../logic/GridEngine.js',
    '../logic/Parsers.js',
    '../logic/MathUtils.js',
    '../logic/CadEngine.js',
    '../logic/WallEngine.js',
    '../logic/NValueEngine.js',
    '../logic/StructuralEngine.js',
    '../logic/FoundationEngine.js',
    '../logic/FoundationSlabAnalysisEngine.js',
    '../logic/FoundationBeamEngine.js',
    '../logic/SlabBeamSynchronizer.js',
    '../logic/RoofEngine.js',
    '../logic/ReportEngine.js',
    '../logic/AreaEngine.js',
    '../controllers/PillarPropertyController.js',
    '../controllers/WallPropertyController.js',
    '../view/FoundationSvgGenerator.js',
    '../view/GridRenderer.js',
    '../view/WallCadRenderer.js',
    '../view/PillarCadRenderer.js',
    '../view/ReportAreaView.js',
    '../view/ReportWallView.js',
    '../view/ReportWallTableView.js',
    '../view/ReportNValueView.js',
    '../view/ReportHeaderView.js',
    '../view/ReportMitsukeView.js',
    '../view/FoundationBeamReportView.js',
    'TestRunner.js'
];

filesToLoad.forEach(f => {
    const code = fs.readFileSync(path.resolve(__dirname, f), 'utf8');
    eval(code);
});

// テストケースの読み込み
const testFiles = [
    'MathUtils.test.js',
    'CadEngine.test.js',
    'StructuralEngine.test.js',
    'SlabBeamSynchronizer.test.js',
    'FoundationEngine.test.js',
    'RoofEngine.test.js',
    'ReportEngine.test.js',
    'FoundationSvgGenerator.test.js',
    'FoundationBeamReportView.test.js',
    'ReportMitsukeView.test.js',
    'PillarCadRenderer.test.js',
    'AreaEngine.test.js',
    'FoundationSlabAnalysisEngine.test.js',
    'FoundationBeamEngine.test.js',
    'ReportNValueView.test.js',
    'GridPersistence.test.js'
];

testFiles.forEach(f => {
    const code = fs.readFileSync(path.resolve(__dirname, f), 'utf8');
    eval(code);
});

// テスト実行
async function execute() {
    console.log("=== Node.js ヘッドレス自動テスト開始 ===");
    const results = await window.TestRunner.run();
    let passed = 0;
    let failed = 0;
    results.forEach(res => {
        if (res.status === 'pass') {
            passed++;
        } else {
            failed++;
        }
    });
    console.log(`\n=== テスト結果サマリー ===`);
    console.log(`PASS: ${passed} | FAIL: ${failed}`);
    if (failed > 0) {
        console.error("❌ テストが失敗しました！修正内容を確認してください。");
        process.exit(1);
    } else {
        console.log("✅ すべてのテストが正常に通過しました！");
        process.exit(0);
    }
}

execute().catch(err => {
    console.error(err);
    process.exit(1);
});
