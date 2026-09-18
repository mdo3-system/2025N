/**
 * scripts/build_bundle.js
 * アプリケーションのJavaScriptモジュール群（68ファイル）を依存関係順にバンドルし、
 * Terserによる不可逆難読化・空白圧縮・コメント消去を行って単一ファイルへ出力する。
 */

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const ROOT_DIR = path.resolve(__dirname, '..');

const SCRIPT_FILES = [
    'assets/js/modules/wall_4split/Version.js',
    'assets/js/modules/wall_4split/state/Specs.js',
    'assets/js/modules/wall_4split/state/AppState.js',
    'assets/js/modules/wall_4split/wall_4split_bridge.js',
    'assets/js/modules/wall_4split/logic/ServiceContainer.js',
    'assets/js/modules/wall_4split/logic/MathUtils.js',
    'assets/js/modules/wall_4split/logic/Parsers.js',
    'assets/js/modules/wall_4split/logic/WallEngine.js',
    'assets/js/modules/wall_4split/logic/CadEngine.js',
    'assets/js/modules/wall_4split/logic/GridEngine.js',
    'assets/js/modules/wall_4split/logic/StructuralEngine.js',
    'assets/js/modules/wall_4split/logic/DocumentEngine.js',
    'assets/js/modules/wall_4split/logic/NValueEngine.js',
    'assets/js/modules/wall_4split/logic/AreaEngine.js',
    'assets/js/modules/wall_4split/logic/AxialEngine.js',
    'assets/js/modules/wall_4split/logic/SlabBeamSynchronizer.js',
    'assets/js/modules/wall_4split/logic/FoundationSlabAnalysisEngine.js',
    'assets/js/modules/wall_4split/logic/FoundationBeamEngine.js',
    'assets/js/modules/wall_4split/logic/FoundationEngine.js',
    'assets/js/modules/wall_4split/logic/ReportEngine.js',
    'assets/js/modules/wall_4split/logic/RoofEngine.js',
    'assets/js/modules/wall_4split/logic/MitsukeEngine.js',
    'assets/js/modules/wall_4split/logic/WasmBridge.js',
    'assets/js/modules/wall_4split/logic/AuthLicenseManager.js',
    'assets/js/modules/wall_4split/logic/RequiredWallCalculator.js',
    'assets/js/modules/wall_4split/controllers/PropertyController.js',
    'assets/js/modules/wall_4split/controllers/PillarPropertyController.js',
    'assets/js/modules/wall_4split/controllers/WallPropertyController.js',
    'assets/js/modules/wall_4split/controllers/FoundationPropertyController.js',
    'assets/js/modules/wall_4split/controllers/RoofPropertyController.js',
    'assets/js/modules/wall_4split/controllers/FoundationPropertyHandler.js',
    'assets/js/modules/wall_4split/controllers/PillarPropertyHandler.js',
    'assets/js/modules/wall_4split/controllers/WallPropertyHandler.js',
    'assets/js/modules/wall_4split/controllers/InputController.js',
    'assets/js/modules/wall_4split/controllers/ModalController.js',
    'assets/js/modules/wall_4split/controllers/DxfLayerMapperController.js',
    'assets/js/modules/wall_4split/controllers/AppController.js',
    'assets/js/modules/wall_4split/controllers/FoundationInputController.js',
    'assets/js/modules/wall_4split/controllers/RoofInputController.js',
    'assets/js/modules/wall_4split/view/UIView.js',
    'assets/js/modules/wall_4split/view/GridRenderer.js',
    'assets/js/modules/wall_4split/view/WallCadRenderer.js',
    'assets/js/modules/wall_4split/view/PillarCadRenderer.js',
    'assets/js/modules/wall_4split/view/MainRenderer.js',
    'assets/js/modules/wall_4split/view/FoundationSvgGenerator.js',
    'assets/js/modules/wall_4split/view/FoundationRenderer.js',
    'assets/js/modules/wall_4split/view/DocumentRenderer.js',
    'assets/js/modules/wall_4split/view/ElevationRenderer.js',
    'assets/js/modules/wall_4split/view/RoofRenderer.js',
    'assets/js/modules/wall_4split/view/ReportHeaderView.js',
    'assets/js/modules/wall_4split/view/ReportAreaView.js',
    'assets/js/modules/wall_4split/view/ReportWallTableView.js',
    'assets/js/modules/wall_4split/view/ReportWallView.js',
    'assets/js/modules/wall_4split/view/ReportNValueView.js',
    'assets/js/modules/wall_4split/view/ReportMitsukeView.js',
    'assets/js/modules/wall_4split/view/FoundationBeamReportView.js',
    'assets/js/modules/wall_4split/view/PreviewModalView.js',
    'assets/js/modules/wall_4split/view/PropertyModalView.js',
    'assets/js/modules/wall_4split/view/ThreeDPreviewController.js',
    'assets/js/modules/wall_4split/wall_4split_export.js',
    'assets/js/modules/wall_4split/wall_4split_cad.js',
    'assets/js/modules/wall_4split/wall_4split_render.js',
    'assets/js/modules/wall_4split/view/PdfReportView.js',
    'assets/js/modules/wall_4split/wall_4split_pdf.js',
    'assets/js/modules/wall_4split/wall_4split_calc.js',
    'assets/js/modules/wall_4split/wall_4split_foundation_engine.js',
    'assets/js/modules/wall_4split/wall_4split_report.js',
    'assets/js/modules/wall_4split/wall_4split_input.js',
    'assets/js/modules/wall_4split/wall_4split_main.js'
];

async function bundleAndMinify() {
    console.log(`📦 [Bundle] Reading ${SCRIPT_FILES.length} JavaScript files...`);

    let combinedCode = '';
    let totalRawSize = 0;

    for (const relPath of SCRIPT_FILES) {
        const absPath = path.resolve(ROOT_DIR, relPath);
        if (!fs.existsSync(absPath)) {
            throw new Error(`File not found: ${absPath}`);
        }
        const content = fs.readFileSync(absPath, 'utf8');
        totalRawSize += Buffer.byteLength(content, 'utf8');
        combinedCode += `\n/* --- ${path.basename(relPath)} --- */\n` + content + '\n;';
    }

    console.log(`📊 [Bundle] Total raw code size: ${(totalRawSize / 1024).toFixed(1)} KB`);
    console.log(`⚙️ [Bundle] Minifying and obfuscating with Terser...`);

    const minifyOptions = {
        compress: {
            dead_code: true,
            drop_console: false, // 運用ログは残す
            drop_debugger: true,
            passes: 2
        },
        mangle: {
            toplevel: false, // グローバル変数・windowプロパティを維持
            keep_fnames: true // 関数名/クラス名の安全保持
        },
        format: {
            comments: false // 全コメント除去
        }
    };

    const result = await minify(combinedCode, minifyOptions);
    if (!result.code) {
        throw new Error('Minification failed: result.code is empty');
    }

    const distDir = path.resolve(ROOT_DIR, 'assets/js/modules/wall_4split/dist');
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    const outPath = path.resolve(distDir, 'wall_4split.bundle.min.js');
    fs.writeFileSync(outPath, result.code, 'utf8');

    const minSize = Buffer.byteLength(result.code, 'utf8');
    const ratio = ((1 - (minSize / totalRawSize)) * 100).toFixed(1);

    console.log(`✅ [Bundle] Successfully generated: ${outPath}`);
    console.log(`🎉 [Bundle] Minified size: ${(minSize / 1024).toFixed(1)} KB (Saved ${ratio}%)`);
}

bundleAndMinify().catch(err => {
    console.error('❌ [Bundle Error]:', err);
    process.exit(1);
});
