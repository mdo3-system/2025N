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

        it("should return null for direct support ratios when 2F pillars or walls are empty (v3.15.2)", () => {
            const state = {
                pillars: [{ id: 'p1', x: 0, y: 0, floor: '1F', isDeleted: false, isInvalidPos: false }],
                walls: []
            };
            const res = window.StructuralEngine.calculateDirectSupportRatio(state);
            expect(res.pCount2F).toBe(0);
            expect(res.pRatio).toBe(null);
            expect(res.wRatioX).toBe(null);
            expect(res.wRatioY).toBe(null);
            expect(res.wRatioTotal).toBe(null);
        });

        it("should render div4 ratio and judgement on all rows without rowspan (v3.15.2)", () => {
            const origGetVal = window.MathUtils.getVal;
            window.MathUtils.getVal = () => 1.0;
            try {
                const state = {
                    reqWall: {
                        '1F': { div4: { vxt: 2, vxb: 2, vyl: 2, vyr: 2, rxt: 1.2, rxb: 1.0, ryl: 1.1, ryr: 1.0, isXOk: true, isYOk: true } },
                        '2F': { div4: { vxt: 1, vxb: 1, vyl: 1, vyr: 1, rxt: 1.0, rxb: 1.0, ryl: 1.0, ryr: 1.0, isXOk: true, isYOk: true } }
                    }
                };
                const html = window.ReportEngine.generateDiv4TableHtml(state);
                const okCount = (html.match(/>OK<\/td>/g) || []).length;
                expect(okCount).toBe(8); // 2 floors * 4 rows (X上, X下, Y左, Y右)
            } finally {
                window.MathUtils.getVal = origGetVal;
            }
        });

    });
})();
