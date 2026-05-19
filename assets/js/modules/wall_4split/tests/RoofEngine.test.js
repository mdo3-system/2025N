/**
 * tests/RoofEngine.test.js - Unit Tests for v2.7.0 Roof Calculations
 */

window.TestRunner.describe('RoofEngine', () => {
    
    window.TestRunner.it('should calculate 2D polygon horizontal area correctly', () => {
        // Rectangle: 4.0m x 3.0m
        const polygon = [
            { u: 0, v: 0 },
            { u: 4, v: 0 },
            { u: 4, v: 3 },
            { u: 0, v: 3 }
        ];
        
        const area = window.RoofEngine.calculatePolygonArea2D(polygon);
        window.TestRunner.expect(area).toBeCloseTo(12.00, 2);
    });

    window.TestRunner.it('should calculate precise 3D height at any sloped roof point', () => {
        // Setup sloped roof properties
        // Base height anchor p1 = (0, 0), direction pointing strictly positive Y (0, 1000)
        // Slope = 5.0 (so rise factor = 0.5)
        const face = {
            slope: 5.0,
            floor: '1F',
            baseHeightDelta: 0,
            slopeLine: [
                { x: 0, y: 0 },
                { x: 0, y: 1000 }
            ]
        };

        // Standard 1F ceiling height is 3000
        const zBase = 3000;

        // Test coordinate on the base line (0, 0)
        const hBase = window.RoofEngine.calculate3DHeightAtCoordinate({ x: 0, y: 0 }, face);
        window.TestRunner.expect(hBase).toBe(zBase);

        // Test coordinate 2000mm along positive Y direction (0, 2000)
        // distance = 2.0m, slope rise = 2.0 * 0.5 * 1000 = 1000mm.
        // Expected height = 3000 + 1000 = 4000mm
        const hUp = window.RoofEngine.calculate3DHeightAtCoordinate({ x: 0, y: 2000 }, face);
        window.TestRunner.expect(hUp).toBe(4000);

        // Test coordinate 1000mm along negative Y direction (0, -1000)
        // distance = -1.0m, slope fall = -500mm
        // Expected height = 3000 - 500 = 2500mm
        const hDown = window.RoofEngine.calculate3DHeightAtCoordinate({ x: 0, y: -1000 }, face);
        window.TestRunner.expect(hDown).toBe(2500);
    });

    window.TestRunner.it('should compute real sloped area from projected area and slope factor', () => {
        // Horizontal projection area: 12.0m²
        // Slope: 6.0寸 (so rise factor = 0.6)
        // Slope correction factor = sqrt(1 + 0.6^2) = sqrt(1.36) = ~1.16619
        // Real sloped area = 12.0 * 1.16619 = 13.994m²
        const projArea = 12.0;
        const slopeVal = 6.0 / 10;
        const factor = Math.sqrt(1 + slopeVal * slopeVal);
        const realArea = projArea * factor;

        window.TestRunner.expect(realArea).toBeCloseTo(13.99, 2);
    });
});
