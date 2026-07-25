/**
 * PillarCadRenderer.test.js
 * Unit Test for PillarCadRenderer CAD drawing module
 */

const { describe, it } = window.TestRunner;

describe('PillarCadRenderer (v3.3.0)', () => {
    it('should safely execute drawPillars without errors when ctx is mocked', () => {
        if (!window.PillarCadRenderer) {
            throw new Error('PillarCadRenderer module is not loaded');
        }

        const mockCtx = {
            beginPath: () => {},
            arc: () => {},
            rect: () => {},
            fill: () => {},
            stroke: () => {},
            fillRect: () => {},
            fillText: () => {},
            measureText: () => ({ width: 20 }),
            setLineDash: () => {}
        };

        const mockState = {
            ctx: mockCtx,
            elementVisibility: { pillars: true, pillarNValues: true },
            currentFloor: '1F',
            isPrintMode: false,
            pillars: [
                { id: 'P1', x: 0, y: 0, floor: '1F', isCornerAuto: true, nMark: 'イ', nValue: 1.0 }
            ]
        };

        window.PillarCadRenderer.drawPillars(mockState);
    });
});
