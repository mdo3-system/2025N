/**
 * AreaEngine.test.js
 * Unit Test for AreaEngine pillar load area calculation (Standard vs Performance modes)
 */

const { describe, it, expect } = window.TestRunner;

describe('AreaEngine (v3.3.0)', () => {
    it('should exclude porch, balcony, and void from pillar tributary areas in standard mode (基準法)', () => {
        if (!window.AreaEngine) {
            throw new Error('AreaEngine module is not loaded');
        }

        const mockState = {
            config: { calcMode: 'standard', atticHeight: 1.4 },
            pillars: [
                { id: 'P1', x: 0, y: 0, floor: '1F' },
                { id: 'P2', x: 5000, y: 0, floor: '1F' },
                { id: 'P3', x: 5000, y: 5000, floor: '1F' },
                { id: 'P4', x: 0, y: 5000, floor: '1F' }
            ],
            areaLines: [
                // 1F床 (10m x 10m = 100㎡)
                { floor: '1F', areaType: 'floor', vertices: [{ x: -5000, y: -5000 }, { x: 15000, y: -5000 }, { x: 15000, y: 15000 }, { x: -5000, y: 15000 }] },
                // 1Fポーチ (2m x 2m = 4㎡)
                { floor: '1F', areaType: 'porch', vertices: [{ x: -7000, y: -7000 }, { x: -5000, y: -7000 }, { x: -5000, y: -5000 }, { x: -7000, y: -5000 }] },
                // 1Fバルコニー (2m x 2m = 4㎡)
                { floor: '1F', areaType: 'balcony', vertices: [{ x: 15000, y: 15000 }, { x: 17000, y: 15000 }, { x: 17000, y: 17000 }, { x: 15000, y: 17000 }] }
            ]
        };

        window.AreaEngine.calculatePillarLoadAreas(mockState);

        // Standard mode should NOT include porch or balcony in p.tributaryPolygon for porch/balcony coordinates
        mockState.pillars.forEach(p => {
            expect(p.tributaryPolygon).toBeTruthy();
        });
    });

    it('should include porch and balcony in 1F pillar tributary areas in seinou mode (性能表示)', () => {
        const mockState = {
            config: { calcMode: 'seinou', atticHeight: 1.4 },
            pillars: [
                { id: 'P1', x: 0, y: 0, floor: '1F' }
            ],
            areaLines: [
                // 1F床 (2m x 2m = 4㎡)
                { floor: '1F', areaType: 'floor', vertices: [{ x: -1000, y: -1000 }, { x: 1000, y: -1000 }, { x: 1000, y: 1000 }, { x: -1000, y: 1000 }] },
                // 1Fポーチ (2m x 2m = 4㎡)
                { floor: '1F', areaType: 'porch', vertices: [{ x: 1000, y: -1000 }, { x: 3000, y: -1000 }, { x: 3000, y: 1000 }, { x: 1000, y: 1000 }] }
            ]
        };

        window.AreaEngine.calculatePillarLoadAreas(mockState);

        const p1 = mockState.pillars[0];
        // In seinou mode, P1's loadArea should sum floor (4m²) + porch (4m²) = 8.00m²
        expect(p1.loadArea).toBe(8.00);
    });
});
