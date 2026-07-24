/**
 * ReportEngine.test.js - Unit tests for ReportEngine
 * v3.2.0 Refactoring & TDD
 */

window.TestRunner.describe('ReportEngine (v3.2.0)', function() {
    window.TestRunner.it('should accurately collect wall quantity and N-value errors when existence is below required', function() {
        const mockState = {
            reqWall: {
                '1F': { qX: 20.0, qY: 20.0, div4: { isXOk: true, isYOk: true } },
                '2F': { qX: 15.0, qY: 15.0, div4: { isXOk: true, isYOk: true } }
            },
            walls: [
                { floor: '1F', p1: { x: 0, y: 0 }, p2: { x: 2000, y: 0 }, braceVal: 2.0 }
            ],
            pillars: [
                { floor: '1F', gx: 'X1', gy: 'Y1', lambda: 165.0, lambdaOK: false }
            ],
            foundationSlabs: [],
            foundationBeams: []
        };

        const errors = window.ReportEngine.collectAllErrors(mockState);
        window.TestRunner.expect(errors.length >= 2).toBeTruthy();
        
        const hasWallErr = errors.some(e => e.includes('壁量計算') && e.includes('1F X方向'));
        const hasLambdaErr = errors.some(e => e.includes('細長比') && e.includes('165.0'));

        window.TestRunner.expect(hasWallErr).toBeTruthy();
        window.TestRunner.expect(hasLambdaErr).toBeTruthy();
    });
});
