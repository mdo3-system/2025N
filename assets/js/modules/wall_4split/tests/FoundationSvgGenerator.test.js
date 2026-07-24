/**
 * FoundationSvgGenerator.test.js - Unit tests for FoundationSvgGenerator
 * v3.2.0 Refactoring & TDD
 */

window.TestRunner.describe('FoundationSvgGenerator (v3.2.0)', function() {
    window.TestRunner.it('should generate valid SVG chart markup for beam stress & tributary area', function() {
        const mockBeam = {
            id: 'FG1',
            fdStress: {
                pillars: [
                    { x: 0, globalX: 0, globalY: 0, name: 'P1' },
                    { x: 3.64, globalX: 3640, globalY: 0, name: 'P2' }
                ],
                spans: [
                    { M_mid: 5.2, M_end: 7.8, Q_L: 12.4, leftward: { Q: 15.1 }, rightward: { Q: 14.8 } }
                ],
                seismic: {
                    leftward: { Td: [0, 5.0], Mf: [0, 8.0] },
                    rightward: { Td: [2.0, 0], Mf: [3.0, 0] }
                }
            }
        };

        const mockState = {
            foundationSlabs: [
                {
                    vertices: [{ x: 0, y: 0 }, { x: 3640, y: 0 }, { x: 3640, y: 3640 }, { x: 0, y: 3640 }],
                    tributaryPolygons: [
                        { beamId: 'FG1', polygon: [{ x: 0, y: 0 }, { x: 3640, y: 0 }, { x: 1820, y: 1820 }], area: 3312400, width: 1.82 }
                    ]
                }
            ],
            foundationBeams: [mockBeam]
        };

        const nmqSvg = window.FoundationSvgGenerator.generateBeamNMQSvg(mockBeam);
        const tribSvg = window.FoundationSvgGenerator.generateFoundationTributarySvg(mockBeam, mockState);

        window.TestRunner.expect(nmqSvg.includes('<svg') && nmqSvg.includes('曲げモーメント図')).toBeTruthy();
        window.TestRunner.expect(tribSvg.includes('<svg') && tribSvg.includes('A=3.31㎡')).toBeTruthy();
    });
});
