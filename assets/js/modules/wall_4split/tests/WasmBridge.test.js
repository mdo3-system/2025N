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

    window.TestRunner.it('告示1460号 表14補正および細長比が Wasm コアにより正確に算出されること', async () => {
        await window.WasmBridge.init();

        // 筋交い補正 (2.0倍のP1 / P2)
        const corr1 = window.WasmBridge.calculateTable314Correction(
            { m: 2.0, type: 'P1' },
            { m: 2.0, type: 'P2' }
        );
        window.TestRunner.expect(corr1).toBe(1.5);

        // 片側のみ (3.0倍 P1) -> -2.0
        const corr2 = window.WasmBridge.calculateTable314Correction(
            { m: 3.0, type: 'P1' },
            null
        );
        window.TestRunner.expect(corr2).toBe(-2.0);

        // 細長比 (令43条6項: h=2.7m, d=105mm -> λ ≈ 89.1)
        const lambda = window.WasmBridge.calculateSlendernessRatio(2.7, 105);
        window.TestRunner.expect(lambda).toBe(89.1);
    });

    window.TestRunner.it('柱N値計算が Wasm コアにより正確に算出されること', async () => {
        await window.WasmBridge.init();

        // aX=5.0, aY=3.0, b=0.8, k=1.0, L=1.0, 2Fなし
        // Nx = 5.0 * 0.8 * 1.0 - 1.0 = 3.0
        // Ny = 3.0 * 0.8 * 1.0 - 1.0 = 1.4
        // N = max(0, 3.0, 1.4) = 3.0
        const nRes = window.WasmBridge.calculatePillarN({
            aX: 5.0, aY: 3.0, b: 0.8, k: 1.0, L: 1.0,
            hasUpper: false
        });
        window.TestRunner.expect(nRes.nValue).toBe(3.0);
        window.TestRunner.expect(nRes.engine).toBe('wasm');
    });

    window.TestRunner.it('基礎梁応力算定が Wasm コアにより正確に算出されること', async () => {
        await window.WasmBridge.init();

        // L=2.0m, w=10kN/m, b=150mm, D=450mm, rebarArea=253.4, ft=195
        // M = 10 * 2^2 / 8 = 5.0 kN·m
        // Q = 10 * 2 / 2 = 10.0 kN
        // d = 450 - 70 = 380mm, j = 0.875 * 380 = 332.5mm
        // Ma = 253.4 * 195 * 332.5 / 1e6 = 16.430 kN·m
        // ratioM = 5.0 / 16.430 ≈ 0.304
        const beamRes = window.WasmBridge.calculateBeamStress({
            beamId: 'FB-TEST',
            length: 2.0,
            tributaryLoad: 10.0,
            width: 150,
            height: 450,
            rebarArea: 253.4,
            ft: 195
        });

        window.TestRunner.expect(beamRes.maxMoment).toBe(5.0);
        window.TestRunner.expect(beamRes.maxShear).toBe(10.0);
        window.TestRunner.expect(beamRes.isOkMoment).toBe(true);
        window.TestRunner.expect(beamRes.engine).toBe('wasm');
    });

    window.TestRunner.it('基礎スラブ断面検定が Wasm コアにより正確に算出されること', async () => {
        await window.WasmBridge.init();

        // 4辺固定, lx=2.0m, ly=2.0m, qTotal=15.0kN/m2, D=150, coverDepth=70, at_short=844.7, at_long=422.3
        const slabRes = window.WasmBridge.calculateSlabStress({
            qTotal: 15.0,
            lx: 2.0,
            ly: 2.0,
            support: '4辺固定',
            thickness: 150,
            coverDepth: 70,
            at_short: 844.7,
            at_long: 422.3
        });

        window.TestRunner.expect(slabRes.engine).toBe('wasm');
        window.TestRunner.expect(typeof slabRes.Mx_center).toBe('number');
        window.TestRunner.expect(slabRes.Mx_center > 0).toBe(true);
        window.TestRunner.expect(typeof slabRes.ratioShort).toBe('number');
        window.TestRunner.expect(slabRes.ratioShort < 1.0).toBe(true);
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

        // 柱N値もブロックされること
        const nRes = window.WasmBridge.calculatePillarN({ aX: 5.0, aY: 3.0, b: 0.8, k: 1.0, L: 1.0 });
        window.TestRunner.expect(nRes.engine).toBe('wasm_locked');

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

        // 柱N値のフォールバック動作検証
        const nRes = window.WasmBridge.calculatePillarN({
            aX: 5.0, aY: 3.0, b: 0.8, k: 1.0, L: 1.0,
            hasUpper: false
        });
        window.TestRunner.expect(nRes.nValue).toBe(3.0);
        window.TestRunner.expect(nRes.engine).toBe('js_fallback');

        // 復元
        window.WasmBridge.isLoaded = origLoaded;
        window.WasmBridge.wasmInstance = origInst;
    });
});
