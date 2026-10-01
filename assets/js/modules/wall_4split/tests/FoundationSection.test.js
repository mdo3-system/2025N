/**
 * tests/FoundationSection.test.js - Unit tests for FoundationSectionEngine, Validator, and DxfExporter
 */

(function() {
    const { describe, it, expect } = window.TestRunner;

    describe("FoundationSectionEngine (v3.13.39)", () => {
        it("should calculate correct geometry and levels for standard FG1 beam", () => {
            const beam = {
                title: 'FG1',
                baseSpec: 'FG1',
                baseToeWidthType: 'matchStem',
                stemW: 150,
                slabT: 180,
                aboveGl: 400,
                embedH: 500,
                glToSlab: 50,
                levelerT: 10,
                topSpec: '1-D13',
                botSpec: '1-D13',
                stirrupBar: 'D10@200'
            };
            const avgGlConfig = { show: true, diff: -180 };

            const geo = window.FoundationSectionEngine.calculateGeometry(beam, avgGlConfig);
            expect(geo.totalH).toBe(900);
            expect(geo.concD).toBe(890);
            expect(geo.isSlabFlush).toBe(false);
            expect(geo.dtTopInfo.dt > 40).toBe(true);
            expect(geo.dtBotInfo.dt > 60).toBe(true);
        });

        it("should detect slab flush condition when aboveGl <= glToSlab (FG5天端同寸)", () => {
            const beamFlush = {
                aboveGl: 50,
                embedH: 1070,
                glToSlab: 50,
                levelerT: 10
            };
            const geoFlush = window.FoundationSectionEngine.calculateGeometry(beamFlush);
            expect(geoFlush.isSlabFlush).toBe(true);
        });
    });

    describe("FoundationSymbolValidator (v3.13.39)", () => {
        it("should detect rebar and dimension discrepancies for identical symbols", () => {
            const mockState = {
                foundationBeams: [
                    {
                        id: 1,
                        p1: { x: 0, y: 0 }, p2: { x: 3640, y: 0 },
                        props: { symbol: 'FG1', width: 150, height: 640, topRebar: '1-D13', bottomRebar: '1-D13', stirrup: '1-D10@200' },
                        spans: [
                            { startNode: { name: 'X1-Y1' }, endNode: { name: 'X2-Y1' }, props: { symbol: 'FG1', width: 150, height: 640, topRebar: '1-D13', bottomRebar: '1-D13', stirrup: '1-D10@200' } }
                        ]
                    },
                    {
                        id: 2,
                        p1: { x: 0, y: 1820 }, p2: { x: 3640, y: 1820 },
                        props: { symbol: 'FG1', width: 150, height: 890, topRebar: '2-D16', bottomRebar: '2-D16', stirrup: '1-D10@200' },
                        spans: [
                            { startNode: { name: 'X1-Y2' }, endNode: { name: 'X2-Y2' }, props: { symbol: 'FG1', width: 150, height: 890, topRebar: '2-D16', bottomRebar: '2-D16', stirrup: '1-D10@200' } }
                        ]
                    }
                ]
            };

            const warnings = window.FoundationSymbolValidator.validateSymbolsConsistency(mockState);
            expect(warnings.length).toBe(1);
            expect(warnings[0].symbol).toBe('FG1');
            expect(warnings[0].conflicts.length > 0).toBe(true);
        });

        it("should return empty array when all identical symbols have consistent specifications", () => {
            const mockStateConsistent = {
                foundationBeams: [
                    {
                        id: 1,
                        spans: [
                            { startNode: { name: 'X1' }, endNode: { name: 'X2' }, props: { symbol: 'FG1', width: 150, height: 640, topRebar: '1-D13', bottomRebar: '1-D13', stirrup: '1-D10@200' } }
                        ]
                    },
                    {
                        id: 2,
                        spans: [
                            { startNode: { name: 'X3' }, endNode: { name: 'X4' }, props: { symbol: 'FG1', width: 150, height: 640, topRebar: '1-D13', bottomRebar: '1-D13', stirrup: '1-D10@200' } }
                        ]
                    }
                ]
            };

            const warnings = window.FoundationSymbolValidator.validateSymbolsConsistency(mockStateConsistent);
            expect(warnings.length).toBe(0);
        });
    });

    describe("FoundationSectionDxfExporter (v3.13.39)", () => {
        it("should generate valid DXF output with layers and entities", () => {
            const beamList = [
                {
                    title: 'FG1',
                    baseSpec: 'FG1',
                    aboveGl: 400,
                    embedH: 500,
                    stemW: 150,
                    topSpec: '1-D13',
                    botSpec: '1-D13'
                }
            ];
            const dxf = window.FoundationSectionDxfExporter.generateDXF(beamList, { show: false }, { shortBar: 'D13@150', longBar: 'D10@300' });
            expect(dxf.includes('SECTION')).toBe(true);
            expect(dxf.includes('CONCRETE')).toBe(true);
            expect(dxf.includes('FG1')).toBe(true);
        });
    });
})();
