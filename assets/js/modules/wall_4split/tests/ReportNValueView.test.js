/**
 * tests/ReportNValueView.test.js - Unit tests for ReportNValueView
 */

(function() {
    const { describe, it, expect } = window.TestRunner;

    describe("ReportNValueView (v3.5.0)", () => {
        it("should generate valid N-Value report table markup with pillar items", () => {
            const mockState = {
                pillars: [
                    { floor: '1F', gx: 'X1', gy: 'Y1', isC: true, nValue: 2.5, Ax: 1.5, Ay: 1.0, cStrX: '1.5-0.5', cStrY: '1.0-0.5', nCalcX: 1.0, nCalcY: 0.5, nMark: 'VP' }
                ]
            };

            const html = window.ReportNValueView.generateNValueTableSectionHtml(mockState);
            expect(html.includes('X1-Y1')).toBe(true);
            expect(html.includes('2.50')).toBe(true);
            expect(html.includes('VP')).toBe(true);
        });
    });
})();
