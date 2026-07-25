/**
 * FoundationSlabAnalysisEngine.test.js
 * Unit Test for FoundationSlabAnalysisEngine slab stress & bending moment analysis module
 */

const { describe, it, expect } = window.TestRunner;

describe('FoundationSlabAnalysisEngine (v3.4.0)', () => {
    it('should calculate bending moment and shear status for a 4-side fixed slab without errors', () => {
        if (!window.FoundationSlabAnalysisEngine) {
            throw new Error('FoundationSlabAnalysisEngine module is not loaded');
        }

        const mockSlabs = [
            {
                id: 'S1',
                vertices: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 3000 }, { x: 0, y: 3000 }],
                props: {
                    support: '4辺固定',
                    slabThickness: 150,
                    coverDepth: 70,
                    rebarShort: { at: 350 },
                    rebarLong: { at: 350 }
                }
            }
        ];

        window.FoundationSlabAnalysisEngine.calculateSlabAnalysis(mockSlabs, 15.0);

        const slab = mockSlabs[0];
        expect(slab.fdStress).toBeTruthy();
        expect(slab.fdStress.qTotal).toBeTruthy();
        expect(slab.fdStress.Mx_center).toBeTruthy();
    });
});
