/**
 * CadEngine.test.js - Unit tests for DXF block transformation and entity mapping
 */

window.TestRunner.describe('CadEngine (v3.9.2)', function() {
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
});
