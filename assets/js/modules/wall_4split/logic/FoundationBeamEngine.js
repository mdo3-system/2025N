/**
 * logic/FoundationBeamEngine.js - Foundation Beam Structural Calculation Engine
 * v3.5.0 Refactoring: Single Responsibility Principle (SRP)
 */

window.FoundationBeamEngine = {
    /**
     * 基礎梁の有効荷重伝達、曲げモーメント算定、せん断力および配筋判定
     * @param {Object} beam - 基礎梁オブジェクト
     * @param {Object} state - AppStateへの参照
     * @returns {Object} 応力解析結果
     */
    calculateBeamStress: function(beam, state) {
        const s = state || window.AppState || {};
        if (!beam) return null;

        const L = beam.length || 1.82; // 梁スパン(m)
        const loadPerM = beam.tributaryLoad || 12.5; // 従属単位荷重(kN/m)
        
        // 1. 曲げモーメント (M = w * L^2 / 8)
        const M_max = (loadPerM * L * L) / 8.0;

        // 2. せん断力 (Q = w * L / 2)
        const Q_max = (loadPerM * L) / 2.0;

        // 3. 梁せい・梁幅
        const b = beam.width || 150;
        const D = beam.height || 450;
        const d = D - 70; // 有効せい(mm)

        // 4. 許容曲げモーメント Ma (鉄筋 SD295)
        const ft = 195; // N/mm2
        const rebarArea = beam.rebarArea || 253.4; // D13 2本 (126.7 * 2)
        const Ma = (rebarArea * ft * j_ratio(d)) / 1000000; // kN·m

        function j_ratio(effD) { return 0.875 * effD; }

        const isOkM = M_max <= Ma;
        const ratioM = Ma > 0 ? (M_max / Ma) : 1.0;

        return {
            beamId: beam.id || 'FB-1',
            spanLength: L,
            unitLoad: loadPerM,
            maxMoment: M_max,
            maxShear: Q_max,
            allowableMoment: Ma,
            isOkMoment: isOkM,
            utilizationRatioM: ratioM,
            recommendedRebar: ratioM > 1.0 ? 'D16 2本' : 'D13 2本'
        };
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('FoundationBeamEngine', window.FoundationBeamEngine);
}
