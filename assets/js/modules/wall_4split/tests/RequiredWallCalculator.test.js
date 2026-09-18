/**
 * tests/RequiredWallCalculator.test.js - Unit Tests for Required Wall Calculations (Excel ver1.2.1)
 */

window.TestRunner.describe('RequiredWallCalculator (表計算ツール ver1.2.1 整合性テスト)', () => {
    
    window.TestRunner.it('Excel入力例 (瓦屋根・サイディング・2階建て・住宅・基準法) で q1=40, q2=28 を正確に算出すること', () => {
        const result = window.RequiredWallCalculator.calculate({
            floorHeight1F: 2.964,
            floorHeight2F: 2.85,
            roofHeight: 1.71,
            overhang: 0.75,
            roofSlope: 4.0,
            floorArea1F: 69.22,
            floorArea2F: 52.99,
            roofType: 'tile', // 瓦屋根 990
            extWallType: 'siding', // サイディング 600
            hasSolar: false,
            ceilingIns: 100,
            wallIns: 70,
            buildingUse: 'residential',
            standard: 'kijun'
        });

        window.TestRunner.expect(result.q1_cm).toBe(40);
        window.TestRunner.expect(result.q2_cm).toBe(28);
        window.TestRunner.expect(result.cq1).toBe(0.40);
        window.TestRunner.expect(result.cq2).toBe(0.28);
    });

    window.TestRunner.it('性能表示 等級2 (1.25倍) で q1=50, q2=35 を正確に算出すること', () => {
        const result = window.RequiredWallCalculator.calculate({
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
            standard: 'grade2'
        });

        window.TestRunner.expect(result.q1_cm).toBe(50);
        window.TestRunner.expect(result.q2_cm).toBe(35);
        window.TestRunner.expect(result.cq1).toBe(0.50);
        window.TestRunner.expect(result.cq2).toBe(0.35);
    });

    window.TestRunner.it('性能表示 等級3 (1.50倍) で q1=60, q2=42 を正確に算出すること', () => {
        const result = window.RequiredWallCalculator.calculate({
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
            standard: 'grade3'
        });

        window.TestRunner.expect(result.q1_cm).toBe(60);
        window.TestRunner.expect(result.q2_cm).toBe(42);
        window.TestRunner.expect(result.cq1).toBe(0.60);
        window.TestRunner.expect(result.cq2).toBe(0.42);
    });

    window.TestRunner.it('平屋建て (2階床面積=0) でも正確に算定できること', () => {
        const result = window.RequiredWallCalculator.calculate({
            floorHeight1F: 2.7,
            floorArea1F: 80,
            floorArea2F: 0,
            roofType: 'metal',
            extWallType: 'siding',
            standard: 'kijun'
        });

        window.TestRunner.expect(result.q1_cm > 0).toBe(true);
        window.TestRunner.expect(result.q2_cm).toBe(0);
    });
});
