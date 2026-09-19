/**
 * MitsukeMode.test.js
 * Unit Test for Mitsuke Mode (auto_roof vs dxf_manual) & Projected Area Protection
 */

window.TestRunner.describe('MitsukeMode (見附図 作図 vs DXF取込/手入力モード)', () => {
    window.TestRunner.it('手入力モード(dxf_manual)の時、updateProjectedAreasが手入力値を保護し上書きしないこと', () => {
        const mockState = {
            mitsukeMode: 'dxf_manual',
            config: {
                projectedAreas: {
                    '1F': { x: 25.5, y: 30.0 },
                    '2F': { x: 18.0, y: 22.5 }
                }
            },
            roofFaces: []
        };

        window.MitsukeEngine.updateProjectedAreas(mockState);

        // 手入力した 25.5, 30.0, 18.0, 22.5 が維持されていること
        window.TestRunner.expect(mockState.config.projectedAreas['1F'].x).toBe(25.5);
        window.TestRunner.expect(mockState.config.projectedAreas['1F'].y).toBe(30.0);
        window.TestRunner.expect(mockState.config.projectedAreas['2F'].x).toBe(18.0);
        window.TestRunner.expect(mockState.config.projectedAreas['2F'].y).toBe(22.5);
    });

    window.TestRunner.it('JSONパース時に mitsukeMode が正しく復元されること', () => {
        const mockState = {
            mitsukeMode: 'auto_roof',
            config: {},
            pillars: [],
            walls: []
        };

        const jsonStr = JSON.stringify({
            mitsukeMode: 'dxf_manual',
            pillars: [],
            walls: []
        });

        window.Parsers.parseJson(jsonStr, mockState);

        window.TestRunner.expect(mockState.mitsukeMode).toBe('dxf_manual');
    });
});
