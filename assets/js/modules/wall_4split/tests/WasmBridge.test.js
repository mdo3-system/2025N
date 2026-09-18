/**
 * tests/WasmBridge.test.js - Unit Tests for WebAssembly Bridge, IP Protection & Domain Lock
 */

window.TestRunner.describe('WasmBridge (WebAssembly IP保護 & ドメインロック検証)', () => {

    window.TestRunner.it('WasmBridge モジュールが存在し、初期化できること', async () => {
        window.TestRunner.expect(typeof window.WasmBridge).toBe('object');
        
        // Node.js またはブラウザ環境での初期化
        const ready = await window.WasmBridge.init();
        window.TestRunner.expect(typeof ready).toBe('boolean');
    });

    window.TestRunner.it('認可ドメイン環境で Wasm コアにより q1=40, q2=28 が正しく算出されること', async () => {
        await window.WasmBridge.init();
        
        const params = {
            floorHeight1F: 2.964,
            floorHeight2F: 2.85,
            roofHeight: 1.71,
            overhang: 0.75,
            roofSlope: 4.0,
            floorArea1F: 69.22,
            floorArea2F: 52.99,
            roofType: 'tile', // 990
            extWallType: 'siding', // 600
            hasSolar: false,
            ceilingIns: 100,
            wallIns: 70,
            buildingUse: 'residential',
            standard: 'kijun'
        };

        const result = window.WasmBridge.calculateRequiredWall(params);

        window.TestRunner.expect(result.q1_cm).toBe(40);
        window.TestRunner.expect(result.q2_cm).toBe(28);
        window.TestRunner.expect(result.cq1).toBe(0.40);
        window.TestRunner.expect(result.cq2).toBe(0.28);
    });

    window.TestRunner.it('ドメインロック: 不正ドメインハッシュの場合に計算を遮断すること', async () => {
        await window.WasmBridge.init();
        
        // 不正ドメインハッシュを注入
        const originalHash = window.WasmBridge.domainHash;
        window.WasmBridge.domainHash = 999999999; // 未認可ドメイン

        const params = {
            floorHeight1F: 2.964,
            floorHeight2F: 2.85,
            roofHeight: 1.71,
            overhang: 0.75,
            roofSlope: 4.0,
            floorArea1F: 69.22,
            floorArea2F: 52.99,
            roofType: 'tile',
            extWallType: 'siding',
            standard: 'kijun'
        };

        const result = window.WasmBridge.calculateRequiredWall(params);

        // ロックにより 0 が返る
        window.TestRunner.expect(result.q1_cm).toBe(0);
        window.TestRunner.expect(result.q2_cm).toBe(0);
        window.TestRunner.expect(result.engine).toBe('wasm_locked');

        // ハッシュを復元
        window.WasmBridge.domainHash = originalHash;
    });

    window.TestRunner.it('透過的フォールバック: Wasm未ロード時でも既存JSロジックで正常に計算されること', () => {
        // Wasmインスタンスを一時的に無効化してフォールバック動作を検証
        const origLoaded = window.WasmBridge.isLoaded;
        const origInst = window.WasmBridge.wasmInstance;

        window.WasmBridge.isLoaded = false;
        window.WasmBridge.wasmInstance = null;

        const params = {
            floorHeight1F: 2.964,
            floorHeight2F: 2.85,
            roofHeight: 1.71,
            overhang: 0.75,
            roofSlope: 4.0,
            floorArea1F: 69.22,
            floorArea2F: 52.99,
            roofType: 'tile',
            extWallType: 'siding',
            hasSolar: false,
            ceilingIns: 100,
            wallIns: 70,
            buildingUse: 'residential',
            standard: 'kijun'
        };

        const result = window.WasmBridge.calculateRequiredWall(params);

        window.TestRunner.expect(result.q1_cm).toBe(40);
        window.TestRunner.expect(result.q2_cm).toBe(28);
        window.TestRunner.expect(result.engine).toBe('js_fallback');

        // 復元
        window.WasmBridge.isLoaded = origLoaded;
        window.WasmBridge.wasmInstance = origInst;
    });
});
