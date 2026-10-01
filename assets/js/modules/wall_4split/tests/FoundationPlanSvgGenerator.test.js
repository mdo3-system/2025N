/**
 * tests/FoundationPlanSvgGenerator.test.js - Unit tests for FoundationPlanSvgGenerator
 */

(function() {
    const { describe, it, expect } = window.TestRunner;

    describe("FoundationPlanSvgGenerator (v3.14.0)", () => {
        it("should generate valid foundation plan SVG containing beam symbols, slab symbols, pillars, hardware, and dimensions", () => {
            const mockState = {
                gridXCoords: [0, 1820, 3640],
                gridYCoords: [0, 1820, 3640],
                gridXNames: ['X1', 'X2', 'X3'],
                gridYNames: ['Y1', 'Y2', 'Y3'],
                foundationBeams: [
                    {
                        id: 'B1',
                        p1: { x: 0, y: 0 },
                        p2: { x: 3640, y: 0 },
                        props: { width: 150, height: 640, embedDepth: 250, symbol: 'FG1' }
                    },
                    {
                        id: 'B2',
                        p1: { x: 0, y: 1820 },
                        p2: { x: 3640, y: 1820 },
                        props: { width: 150, height: 640, embedDepth: 250, symbol: 'FG2' }
                    }
                ],
                foundationSlabs: [
                    {
                        id: 'S1',
                        vertices: [{ x: 0, y: 0 }, { x: 1820, y: 0 }, { x: 1820, y: 1820 }, { x: 0, y: 1820 }],
                        props: { name: 'FS1', slabThickness: 150, rebarShort: 'D13@200' }
                    }
                ],
                pillars: [
                    {
                        id: 'P1',
                        floor: 1,
                        x: 0,
                        y: 0,
                        manualMark: '5',
                        hardware: 'HD25',
                        nValue: 2.14
                    },
                    {
                        id: 'P2',
                        floor: 1,
                        x: 1820,
                        y: 0,
                        manualMark: 'V',
                        hardware: 'VP',
                        nValue: 0.65
                    }
                ]
            };

            const svg = window.FoundationPlanSvgGenerator.generateFoundationPlanSvg(mockState);

            expect(typeof svg).toBe('string');
            expect(svg.startsWith('<svg')).toBe(true);
            expect(svg.endsWith('</svg>')).toBe(true);

            // 通り芯 & 寸法線
            expect(svg.includes('X1')).toBe(true);
            expect(svg.includes('Y1')).toBe(true);
            expect(svg.includes('1820')).toBe(true);
            expect(svg.includes('3640')).toBe(true);

            // 基礎梁符号
            expect(svg.includes('FG1')).toBe(true);
            expect(svg.includes('FG2')).toBe(true);

            // スラブ符号
            expect(svg.includes('FS1')).toBe(true);
            expect(svg.includes('t=150')).toBe(true);

            // 柱脚金物
            expect(svg.includes('HD25')).toBe(true);
            expect(svg.includes('N=2.14')).toBe(true);
            expect(svg.includes('VP')).toBe(true);
        });

        it("should handle empty or null state gracefully without throwing errors", () => {
            const svgEmpty = window.FoundationPlanSvgGenerator.generateFoundationPlanSvg({});
            expect(typeof svgEmpty).toBe('string');
            expect(svgEmpty.includes('<svg')).toBe(true);
        });
    });
})();
