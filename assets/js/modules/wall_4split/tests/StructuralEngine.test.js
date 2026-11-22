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

        it("should deduplicate snapped pillars at identical floor/coordinates keeping manual/explicit attributes (v3.15.3)", () => {
            const state = {
                pillars: [
                    { id: 'p1', floor: '1F', x: 0, y: 0, isDeleted: false, isInvalidPos: false },
                    { id: 'p2', floor: '1F', x: 0, y: 0, isManual: true, d: 120, isDeleted: false, isInvalidPos: false },
                    { id: 'p3', floor: '2F', x: 0, y: 0, isDeleted: false, isInvalidPos: false },
                    { id: 'p4', floor: '2F', x: 0, y: 0, isTooshi: true, isDeleted: false, isInvalidPos: false }
                ]
            };
            window.GridEngine.deduplicateSnappedPillars(state);
            expect(state.pillars.length).toBe(2);
            const p1F = state.pillars.find(p => p.floor === '1F');
            const p2F = state.pillars.find(p => p.floor === '2F');
            expect(p1F.id).toBe('p2');
            expect(p1F.d).toBe(120);
            expect(p2F.id).toBe('p4');
            expect(p2F.isTooshi).toBe(true);
        });

        it("should deduplicate grid axis labels when multiple grid lines resolve to the same name (v3.15.5)", () => {
            const state = {
                isGridFixed: true,
                gridXCoords: [0, 910, 1820],
                gridYCoords: [0, 1820],
                gridXNames: ['X1', 'X1', 'X2'],
                gridYNames: ['Y1', 'Y1'],
                userEditedGridX: { '0': 'X1', '910': 'X1', '1820': 'X2' },
                userEditedGridY: { '0': 'Y1', '1820': 'Y1' },
                pillars: [
                    { id: 'p1', floor: '1F', x: 0, y: 0, isDeleted: false },
                    { id: 'p2', floor: '1F', x: 910, y: 0, isDeleted: false }
                ],
                walls: []
            };
            window.GridEngine.analyzeGrids(state);
            expect(state.gridXNames.join(',')).toBe('X1,X1(2),X2');
            expect(state.gridYNames.join(',')).toBe('Y1,Y1(2)');
            expect(state.pillars[0].gx).toBe('X1');
            expect(state.pillars[1].gx).toBe('X1(2)');
        });

        it("should calculate correct diagonal wall effective lengths using cos^2 / sin^2 (v3.15.11)", () => {
            const diagWall = {
                p1: { x: 0, y: 0 },
                p2: { x: 1444, y: 1820 },
                floor: '1F',
                totalVal: 2.5
            };
            const res = window.WallEngine.calcWallEffectiveLengths(diagWall);
            expect(Math.abs(res.len - 2.324) < 0.01).toBe(true);
            expect(Math.abs(res.kx - 2.24) < 0.02).toBe(true);
            expect(Math.abs(res.ky - 3.56) < 0.02).toBe(true);
        });

        it("should accurately distribute diagonal wall to 4-division boundary zones by overlap ratio (v3.15.11)", () => {
            const bounds = {
                yLineT: 6000,
                yLineB: 2000,
                xLineL: 2000,
                xLineR: 6000
            };
            // Diagonal wall from (1000, 1000) to (2444, 2820)
            // dx = 1444, dy = 1820.
            // X spans [1000, 2444]. Left boundary xLineL = 2000 -> overlap [1000, 2000] = 1000 -> rLeft = 1000/1444 ≈ 0.6925
            // Y spans [1000, 2820]. Bottom boundary yLineB = 2000 -> overlap [1000, 2000] = 1000 -> rBot = 1000/1820 ≈ 0.5494
            const diagWall = {
                p1: { x: 1000, y: 1000 },
                p2: { x: 2444, y: 2820 },
                floor: '1F',
                totalVal: 2.5
            };
            const ratios = window.WallEngine.getWall4DivisionRatios(diagWall, bounds);
            expect(Math.abs(ratios.rLeft - (1000 / 1444)) < 0.01).toBe(true);
            expect(Math.abs(ratios.rBot - (1000 / 1820)) < 0.01).toBe(true);
            expect(ratios.rTop).toBe(0);
            expect(ratios.rRight).toBe(0);
        });

        it("should populate p.nCalcX and p.nCalcY in NValueEngine (v3.15.11)", () => {
            const state = {
                config: {
                    weights: { roof: 500, solar: 0, ceilingIns: 100 },
                    floorHeight1F: 2.7,
                    floorHeight2F: 2.7,
                    nValueMode: 'standard'
                },
                pillars: [
                    { id: 'p1', x: 0, y: 0, floor: '2F', isCornerAuto: true, isC: true },
                    { id: 'p2', x: 1820, y: 0, floor: '2F' },
                    { id: 'p3', x: 0, y: 1820, floor: '2F' }
                ],
                walls: [
                    { p1: { id: 'p1', x: 0, y: 0 }, p2: { id: 'p2', x: 1820, y: 0 }, floor: '2F', totalVal: 2.5 },
                    { p1: { id: 'p1', x: 0, y: 0 }, p2: { id: 'p3', x: 0, y: 1820 }, floor: '2F', totalVal: 1.5 }
                ],
                gridXCoords: [0, 1820],
                gridYCoords: [0, 1820],
                gridXNames: ['X1', 'X2'],
                gridYNames: ['Y1', 'Y2']
            };
            window.NValueEngine.calculateNValues(state);
            const p = state.pillars[0];
            expect(Math.abs(p.nCalcX - 1.60) < 0.01).toBe(true);
            expect(Math.abs(p.nCalcY - 0.80) < 0.01).toBe(true);
            expect(Math.abs(p.nValue - 1.60) < 0.01).toBe(true);
            expect(Math.abs(p.nCalcY - 0.80) < 0.01).toBe(true);
            expect(Math.abs(p.nValue - 1.60) < 0.01).toBe(true);
        });

    });
})();
