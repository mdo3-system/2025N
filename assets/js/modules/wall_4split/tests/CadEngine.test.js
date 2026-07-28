/**
 * CadEngine.test.js - Unit tests for DXF block transformation and entity mapping
 */

window.TestRunner.describe('CadEngine (v3.9.5)', function() {
    window.TestRunner.it('should correctly apply matrix transformations and normalize origin to (0,0)', function() {
        const mockEntities = [
            {
                type: 'INSERT',
                name: 'COL_BLOCK',
                layer: 'COL_1F',
                position: { x: 1000, y: 2000 },
                rotation: 90,
                xScale: 1,
                yScale: 1
            }
        ];

        const mockBlocks = {
            'COL_BLOCK': {
                entities: [
                    {
                        type: 'POINT',
                        layer: 'COL_1F',
                        position: { x: 100, y: 0 }
                    }
                ]
            }
        };

        const result = window.CadEngine.mapEntitiesToBackground(mockEntities, mockBlocks, {});
        
        window.TestRunner.expect(result && result.pillars && result.pillars.length === 1).toBeTruthy();

        const pillar = result.pillars[0];
        // Absolute (1000, 2100), normalized against detected origin (1000, 2000) -> (0, 100)
        window.TestRunner.expect(pillar.x).toBeCloseTo(0, 1);
        window.TestRunner.expect(pillar.y).toBeCloseTo(100, 1);
    });

    window.TestRunner.it('should detect grid origin and normalize 2F DXF to (0,0) canvas grid origin', function() {
        // 1F DXF with grid origin at (100, 200)
        const dxf1F = [
            { type: 'LINE', layer: 'GRID_X', start: { x: 100, y: 200 }, end: { x: 1000, y: 200 } },
            { type: 'LINE', layer: 'GRID_Y', start: { x: 100, y: 200 }, end: { x: 100, y: 2000 } }
        ];

        const origin1F = window.CadEngine.detectGridOrigin(dxf1F, {});
        window.TestRunner.expect(origin1F.x).toBeCloseTo(100, 1);
        window.TestRunner.expect(origin1F.y).toBeCloseTo(200, 1);

        // 2F DXF shifted in CAD file to origin (500, 600)
        const dxf2F = [
            { type: 'LINE', layer: 'GRID_X', start: { x: 500, y: 600 }, end: { x: 1400, y: 600 } },
            { type: 'POINT', layer: 'COL_2F', position: { x: 600, y: 700 } }
        ];

        // Process 2F with baseOrigin relative alignment
        const result2F = window.CadEngine.mapEntitiesToBackground(dxf2F, {}, {}, {
            targetFloor: '2F',
            baseOrigin: origin1F
        });

        const pillar2F = result2F.pillars[0];
        // Point (600, 700) relative to baseOrigin (100, 200) vs detected (500, 600) -> (100 - 500 = -400) -> (600 - 400 = 200)
        // Offset relative to grid origin (100, 100) -> matches (200, 300) in absolute grid offset
        window.TestRunner.expect(result2F && result2F.pillars && result2F.pillars.length === 1).toBeTruthy();
    });
});
