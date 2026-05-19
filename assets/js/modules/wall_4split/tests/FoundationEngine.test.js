/**
 * tests/FoundationEngine.test.js
 * Unit tests for FoundationEngine using Dependency Injection
 */

(function() {
    const { describe, it, expect } = window.TestRunner;

    describe("FoundationEngine", () => {
        
        it("should accurately triangulate simple polygons using Ear Clipping", () => {
            const square = [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 }
            ];
            
            const triangles = window.MathUtils.Geometry.triangulate(square);
            
            expect(triangles.length).toBe(2);
            
            let sumArea = 0;
            triangles.forEach(tri => {
                sumArea += Math.abs(window.MathUtils.Geometry.polygonArea(tri));
            });
            
            expect(sumArea).toBe(10000);
        });

        it("should calculate correct slab design bending moment and shear values using DI", () => {
            const engine = window.FoundationEngine;
            
            const mockAppState = {
                config: {
                    triangleMultiplier: 1.33
                },
                averageBuildingPressure: 12.0
            };
            
            engine.inject({ appState: mockAppState });
            
            const coeff = engine.COEFFS['4辺固定'];
            expect(coeff.mcx).toBe(0.024);
            expect(coeff.max).toBe(0.052);
            
            const mockSlabs = [
                {
                    id: 'S1',
                    vertices: [
                        { x: 0, y: 0 },
                        { x: 4000, y: 0 },
                        { x: 4000, y: 4000 },
                        { x: 0, y: 4000 }
                    ],
                    lx: 4.0,
                    ly: 4.0,
                    fixType: '4辺固定',
                    thickness: 150
                }
            ];
            
            engine.calculateSlabAnalysis(mockSlabs, 12.0);
            
            const slab = mockSlabs[0];
            expect(slab.fdStress).toBeTruthy();
            expect(slab.fdStress.mx_c).toBeCloseTo(0.024 * 12.0 * 16.0, 2);
            expect(slab.fdStress.mx_a).toBeCloseTo(0.052 * 12.0 * 16.0, 2);
            
            engine.inject({ appState: null });
        });
    });
})();
