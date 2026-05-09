/**
 * tests/SlabBeamSynchronizer.test.js - Unit Test Suite for Slab-Beam Synchronization
 */

window.TestRunner.describe("SlabBeamSynchronizer (v3.0.1)", () => {
    window.TestRunner.it("should calculate exact proportional overlap loads for horizontal spans", () => {
        // Setup mock inputs representing a span and adjacent slab tributary polygons
        const mockSlabs = [
            {
                fdStress: { qTotal: 20.0 }, // Ground pressure 20 kN/m2
                tributaryPolygons: [
                    {
                        beamId: "FG1",
                        width: 1.5, // 1.5m tributary width
                        mx: 2000,
                        my: 50,
                        polygon: [
                            { x: 0, y: 0 },
                            { x: 2000, y: 0 },
                            { x: 2000, y: 100 },
                            { x: 0, y: 100 }
                        ]
                    }
                ]
            }
        ];

        const mockBeam = { id: "FG1" };
        const mockSpan = {
            p1: { globalX: 0, globalY: 0 },
            p2: { globalX: 4000, globalY: 0 } // 4m span
        };

        const state = { averageGroundPressure: 12.0 };

        // Execute the synchronizer
        const result = window.SlabBeamSynchronizer.calculateSpanSlabLoad(mockSlabs, mockBeam, mockSpan, state);

        // Assertions
        // The polygon covers from 0 to 2000 on X-axis (half of the 4m span).
        // Proportional overlap ratio should be 2000 / 4000 = 0.5
        // Expected tributary width B = 1.5 * 0.5 = 0.75m
        // Expected Ground pressure sigma = 20.0 kN/m2
        window.TestRunner.expect(result.B).toBeCloseTo(0.75, 2);
        window.TestRunner.expect(result.sigma).toBeCloseTo(20.0, 2);
    });

    window.TestRunner.it("should return default fallback ground pressure when B is 0", () => {
        const mockSlabs = [];
        const mockBeam = { id: "FG2" };
        const mockSpan = {
            p1: { globalX: 0, globalY: 0 },
            p2: { globalX: 4000, globalY: 0 }
        };
        const state = { averageGroundPressure: 15.0 };

        const result = window.SlabBeamSynchronizer.calculateSpanSlabLoad(mockSlabs, mockBeam, mockSpan, state);

        window.TestRunner.expect(result.B).toBe(0);
        window.TestRunner.expect(result.sigma).toBe(15.0);
    });
});
