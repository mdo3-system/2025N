/**
 * tests/FoundationBeamEngine.test.js - Unit tests for FoundationBeamEngine
 */

(function() {
    const { describe, it, expect } = window.TestRunner;

    describe("FoundationBeamEngine (v3.5.0)", () => {
        it("should calculate correct max moment and shear for a standard 2.0m beam span", () => {
            const mockBeam = {
                id: 'FB-1',
                length: 2.0,
                tributaryLoad: 10.0,
                width: 150,
                height: 450,
                rebarArea: 253.4
            };

            const result = window.FoundationBeamEngine.calculateBeamStress(mockBeam);
            expect(result.beamId).toBe('FB-1');
            expect(result.maxMoment).toBe(5.0); // 10 * 2^2 / 8 = 5.0 kN·m
            expect(result.maxShear).toBe(10.0);  // 10 * 2 / 2 = 10 kN
            expect(result.isOkMoment).toBe(true);
        });

        it("should return null if beam object is invalid or missing", () => {
            const result = window.FoundationBeamEngine.calculateBeamStress(null);
            expect(result).toBe(null);
        });
    });
})();
