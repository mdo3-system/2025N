/**
 * tests/MathUtils.test.js
 */

(function() {
    const { describe, it, expect } = window.TestRunner;

    describe("MathUtils.Geometry", () => {
        
        it("should calculate correct area for a 100x100 square", () => {
            const poly = [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 }
            ];
            const area = window.MathUtils.Geometry.polygonArea(poly);
            expect(area).toBe(10000);
        });

        it("should calculate correct area for a triangle", () => {
            const poly = [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 0, y: 100 }
            ];
            const area = window.MathUtils.Geometry.polygonArea(poly);
            expect(area).toBe(5000);
        });
        
    });
})();
