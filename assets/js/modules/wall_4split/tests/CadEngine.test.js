/**
 * CadEngine.test.js - Unit tests for DXF block transformation and entity mapping
 */

window.TestRunner.describe('CadEngine (v3.9.3)', function() {
    window.TestRunner.it('should correctly apply matrix transformations to INSERT block entities', function() {
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
        // (100, 0) rotated +90 deg -> (0, 100), shifted by (1000, 2000) -> (1000, 2100)
        window.TestRunner.expect(pillar.x).toBeCloseTo(1000, 1);
        window.TestRunner.expect(pillar.y).toBeCloseTo(2100, 1);
    });

    window.TestRunner.it('should detect grid origin and align 2F DXF to 1F base grid origin', function() {
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

        // Process 2F with baseOrigin set to 1F origin
        const result2F = window.CadEngine.mapEntitiesToBackground(dxf2F, {}, {}, {
            targetFloor: '2F',
            baseOrigin: origin1F
        });

        // 2F pillar originally at (600, 700) shifted by dx=(100-500)=-400, dy=(200-600)=-400 -> (200, 300)
        window.TestRunner.expect(result2F.pillars.length).toBe(1);
        const p2 = result2F.pillars[0];
        window.TestRunner.expect(p2.floor).toBe('2F');
        window.TestRunner.expect(p2.x).toBeCloseTo(200, 1);
        window.TestRunner.expect(p2.y).toBeCloseTo(300, 1);
    });
});
