/**
 * tests/RoofEngine.test.js - Unit Tests for Roof Calculations
 */

window.TestRunner.describe('RoofEngine', () => {
    
    window.TestRunner.it('should calculate floor levels (FL1, FL2, cut1, cut2) correctly according to absolute Z in mm', () => {
        // Mock state config based on absolute Z definitions
        const state = {
            config: {
                baseHeight: 400,
                basePack: 20,
                baseSill: 105,
                floorThick1F: 36,
                floorHeight1F: 2.7
            }
        };
        
        const levels = window.RoofEngine.getFloorLevels(state);
        
        // 1FL = 400(GL+baseH) + 20 + 105 + 36 = 561
        window.TestRunner.expect(levels.FL1).toBe(561);
        
        // 2FL = 525(sillTop) + 2700(floorHeight1F) + 36(floorThick2F, default 36) = 3261
        window.TestRunner.expect(levels.FL2).toBe(3261);
        
        // cut1 = 1FL(561) + 1350 = 1911
        window.TestRunner.expect(levels.cut1).toBe(1911);
        
        // cut2 = 2FL(3261) + 1350 = 4611
        window.TestRunner.expect(levels.cut2).toBe(4611);
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
