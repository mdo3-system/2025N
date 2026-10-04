/**
 * ColumnDiameterEngine.test.js
 * 令和7年法改正 柱の小径算定（表2-1, 2-2, 2-3）単体テスト
 */

(function() {
    const { describe, it, expect } = window.TestRunner;

    describe('ColumnDiameterEngine (v3.15.0)', () => {
        if (!window.ColumnDiameterEngine) {
            throw new Error('ColumnDiameterEngine module is not loaded');
        }

        it('should correctly compute clear span l based on floor and config', () => {
            const mockState = {
                config: { height1F: 2.7, height2F: 2.7, isFlat: false }
            };
            // 1F: 2700 - 120 = 2580
            const l1 = window.ColumnDiameterEngine.getClearSpan('1F', mockState);
            expect(l1).toBe(2580);

            // 2F: 2700 - 105 = 2595
            const l2 = window.ColumnDiameterEngine.getClearSpan('2F', mockState);
            expect(l2).toBe(2595);
        });

        it('should calculate valid allowable area Aa for 105mm column', () => {
            const l = 2580;
            const w0 = 0.0045; // 4.5 kN/m2
            const Fc = 17.7;
            const Aa = window.ColumnDiameterEngine.calcAllowableArea(105, l, w0, Fc);
            expect(Aa > 5.0).toBe(true); // 通常の住宅では5.0m2以上の負担可能面積となる
            expect(Aa < 15.0).toBe(true);
        });

        it('should evaluate 表2-1 as OK when maxArea <= 5.0m2 and D >= de', () => {
            const mockState = {
                config: { height1F: 2.7, height2F: 2.7, pillarDepth1F: 105, pillarDepth2F: 105 },
                pillars: [
                    { id: 'p1', floor: '1F', usedArea: 3.5, isDeleted: false, isInvalidPos: false },
                    { id: 'p2', floor: '1F', usedArea: 4.8, isDeleted: false, isInvalidPos: false }
                ]
            };
            const res = window.ColumnDiameterEngine.evaluateFloor('1F', mockState);
            expect(res.maxArea).toBe(4.8);
            expect(res.table2_1.isOk).toBe(true);
            expect(res.table2_2.isOk).toBe(true);
            expect(res.table2_3.isOk).toBe(true);
            expect(res.adoptedMethod.indexOf('方法2-1') !== -1).toBe(true);
        });

        it('should evaluate 表2-1 and 表2-2 as NG when maxArea > 5.0m2, but 表2-3 as OK when maxArea <= Aa', () => {
            const mockState = {
                config: { height1F: 2.7, height2F: 2.7, pillarDepth1F: 105, pillarDepth2F: 105 },
                pillars: [
                    { id: 'p1', floor: '1F', usedArea: 3.5, isDeleted: false, isInvalidPos: false },
                    { id: 'p2', floor: '1F', usedArea: 6.2, isDeleted: false, isInvalidPos: false }
                ]
            };
            const res = window.ColumnDiameterEngine.evaluateFloor('1F', mockState);
            expect(res.maxArea).toBe(6.2);
            // 5.0㎡を超えるため表2-1, 2-2はNG
            expect(res.table2_1.isOk).toBe(false);
            expect(res.table2_2.isOk).toBe(false);
            // しかしAa（約7㎡）以下なので表2-3はOK！
            expect(res.table2_3.isOk).toBe(true);
            expect(res.adoptedMethod.indexOf('方法2-3') !== -1).toBe(true);
        });

        it('should generate valid HTML summary string', () => {
            const mockState = {
                config: { height1F: 2.7, height2F: 2.7, pillarDepth1F: 105, pillarDepth2F: 105 },
                pillars: [
                    { id: 'p1', floor: '1F', usedArea: 4.2, isDeleted: false, isInvalidPos: false }
                ]
            };
            const html = window.ColumnDiameterEngine.generateHtmlSummary('1F', mockState, false);
            expect(typeof html).toBe('string');
            expect(html.indexOf('表 2-1') !== -1).toBe(true);
            expect(html.indexOf('表 2-2') !== -1).toBe(true);
            expect(html.indexOf('表 2-3') !== -1).toBe(true);
        });
    });
})();
