/**
 * tests/StructuralEngine.test.js
 */

(function() {
    const { describe, it, expect } = window.TestRunner;

    describe("StructuralEngine", () => {
        
        it("should calculate correct N-values with simple loads", async () => {
            const state = {
                config: {
                    weights: { roof: 500, solar: 0, ceilingIns: 100 },
                    floorHeight1F: 2.7,
                    floorHeight2F: 2.7,
                    nValueMode: 'simple'
                },
                pillars: [
                    { id: 'p1', x: 0, y: 0, floor: '1F', isCornerAuto: true, usedArea: 2.0 }
                ],
                walls: [],
                gridXCoords: [0],
                gridYCoords: [0],
                gridXNames: ['X1'],
                gridYNames: ['Y1'],
                areaLines: [],
                reqWall: { '1F': {}, '2F': {} }
            };

            window.NValueEngine.calculateNValues(state);
            
            const p1 = state.pillars[0];
            // For simple mode, corner pillar corner load is 0.4 or 1.0 depending on upper floor
            // Since no 2F, it's 0.4
            expect(p1.L_val).toBe(0.4);
            expect(p1.nValue).toBe(0); // No walls, so no lift
        });

    });
})();
