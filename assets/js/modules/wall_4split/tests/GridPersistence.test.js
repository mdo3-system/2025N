/**
 * tests/GridPersistence.test.js - グリッドスパン・通り芯文字の保存・復元テスト (v3.13.8)
 */
(function() {
    const { describe, it, expect } = window.TestRunner;

    describe("GridEngine (v3.13.8)", () => {
        it("should persist edited grid spans and custom grid names through JSON parse and analyzeGrids", () => {
            const mockState = {
                pillars: [],
                walls: [],
                windowsArr: [],
                areaLines: [],
                bgLinesOriginal: [
                    { type: 'LINE', isGridLine: true, vertices: [{ x: 0, y: 0 }, { x: 0, y: 9100 }] },
                    { type: 'LINE', isGridLine: true, vertices: [{ x: 910, y: 0 }, { x: 910, y: 9100 }] }
                ],
                gridXCoords: [0, 1820, 3640, 5460],
                gridYCoords: [0, 1820, 3640],
                gridXNames: ['通りA', '通りB', '通りC', '通りD'],
                gridYNames: ['通り1', '通り2', '通り3'],
                userEditedGridX: { 0: '通りA', 1820: '通りB', 3640: '通りC', 5460: '通りD' },
                userEditedGridY: { 0: '通り1', 1820: '通り2', 3640: '通り3' },
                isGridFixed: true
            };

            // 擬似JSONデータ生成（exportJsonの再現）
            const exportData = {
                gxc: mockState.gridXCoords,
                gyc: mockState.gridYCoords,
                gx: mockState.gridXNames,
                gy: mockState.gridYNames,
                ueGX: mockState.userEditedGridX,
                ueGY: mockState.userEditedGridY,
                isGridFixed: mockState.isGridFixed,
                bgLinesOriginal: mockState.bgLinesOriginal,
                pillars: [],
                walls: []
            };

            const jsonStr = JSON.stringify(exportData);
            const newState = { pillars: [], walls: [], bgLinesOriginal: [] };

            // Parsers.parseJson による復元
            window.Parsers.parseJson(jsonStr, newState);

            // グリッド解析実行
            window.GridEngine.analyzeGrids(newState);

            // アサート1: グリッドスパンが初期DXFの [0, 910] に戻らず [0, 1820, 3640, 5460] として完全に保持されていること
            expect(newState.gridXCoords.length).toBe(4);
            expect(newState.gridXCoords[1]).toBe(1820);
            expect(newState.gridXCoords[3]).toBe(5460);
            expect(newState.isGridFixed).toBe(true);

            // アサート2: 通り芯文字が X1, X2 に戻らず 「通りA, 通りB, 通りC, 通りD」 として正確に復元されていること
            expect(newState.gridXNames[0]).toBe('通りA');
            expect(newState.gridXNames[1]).toBe('通りB');
            expect(newState.gridXNames[2]).toBe('通りC');
            expect(newState.gridXNames[3]).toBe('通りD');
        });
    });
})();
