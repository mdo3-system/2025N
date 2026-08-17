/**
 * controllers/FoundationPropertyHandler.js - Foundation Property Modal & Input Handler
 * v3.2.0 Refactoring: Single Responsibility Principle
 */

window.FoundationPropertyHandler = {
    /**
     * 基礎プロパティの更新
     */
    updateFdProp: function(type, id, key, val, spanIdx = null) {
        const s = window.AppState;
        if (!s) return;

        if (type === 'slab') {
            const slab = (s.foundationSlabs || []).find(x => x.id === id);
            if (slab) {
                if (!slab.props) slab.props = {};
                if (key === 'slabThickness' || key === 'thickness') {
                    const numT = parseFloat(val) || 150;
                    slab.props.slabThickness = numT;
                    slab.props.thickness = numT;
                } else if (key === 'slabTopHeight') {
                    slab.props.slabTopHeight = parseFloat(val) || 0;
                } else if (key === 'coverDepth') {
                    slab.props.coverDepth = parseFloat(val) || 70;
                } else if (key === 'support') {
                    slab.props.support = val;
                } else if (key === 'cantileverLength') {
                    slab.props.cantileverLength = parseFloat(val) || 0.9;
                } else if (key.startsWith('rebarShort.')) {
                    if (!slab.props.rebarShort) slab.props.rebarShort = { type: 'D13', pitch: 150 };
                    const subK = key.split('.')[1];
                    slab.props.rebarShort[subK] = subK === 'pitch' ? (parseFloat(val) || 150) : val;
                } else if (key.startsWith('rebarLong.')) {
                    if (!slab.props.rebarLong) slab.props.rebarLong = { type: 'D13', pitch: 300 };
                    const subK = key.split('.')[1];
                    slab.props.rebarLong[subK] = subK === 'pitch' ? (parseFloat(val) || 300) : val;
                } else {
                    slab.props[key] = val;
                }

                // スラブ解析および基礎全体の再計算
                if (window.FoundationEngine && typeof window.FoundationEngine.runAnalysis === 'function') {
                    window.FoundationEngine.runAnalysis(s);
                }
                if (window.AppController && typeof window.AppController.refreshAll === 'function') {
                    window.AppController.refreshAll();
                }
            }
        } else if (type === 'beam' || type === 'beam_span') {
            const beam = (s.foundationBeams || []).find(x => x.id === id);
            if (beam) {
                if (!beam.props) beam.props = {};

                if (spanIdx !== null && spanIdx !== undefined && beam.spans && beam.spans[spanIdx]) {
                    const span = beam.spans[spanIdx];
                    if (!span.props) span.props = {};
                    let numVal = parseFloat(val);

                    if (key === 'topRebar') span.props.topRebar = val;
                    else if (key === 'bottomRebar') span.props.bottomRebar = val;
                    else if (key === 'stirrup') span.props.stirrup = val;
                    else if (key === 'height') {
                        span.props.height = isNaN(numVal) ? 640 : numVal;
                    } else if (key === 'embedDepth') {
                        span.props.embedDepth = isNaN(numVal) ? 250 : numVal;
                    } else if (key === 'width') {
                        span.props.width = isNaN(numVal) ? 150 : numVal;
                    } else span.props[key] = val;
                } else {
                    let numVal = parseFloat(val);
                    if (key === 'width') beam.props.width = isNaN(numVal) ? 150 : numVal;
                    else if (key === 'height') beam.props.height = isNaN(numVal) ? 640 : numVal;
                    else if (key === 'embedDepth') beam.props.embedDepth = isNaN(numVal) ? 250 : numVal;
                    else if (key === 'modelType') beam.props.modelType = val;
                    else if (key === 'B_val') beam.props.B_val = parseFloat(val) || 0.5;
                    else if (key === 'topRebar') beam.props.topRebar = val;
                    else if (key === 'bottomRebar') beam.props.bottomRebar = val;
                    else if (key === 'stirrup') beam.props.stirrup = val;
                    else beam.props[key] = val;
                }

                if (window.FoundationEngine && typeof window.FoundationEngine.runAnalysis === 'function') {
                    window.FoundationEngine.runAnalysis(s);
                }
                if (window.AppController && typeof window.AppController.refreshAll === 'function') {
                    window.AppController.refreshAll();
                }
            }
        }

        if (window.PropertyController && typeof window.PropertyController.showFdPopup === 'function') {
            window.PropertyController.showFdPopup(type, (type === 'slab' ? s.foundationSlabs : s.foundationBeams).find(x => x.id === id));
        }
    },

    /**
     * 基礎梁モーダルの一括保存・再計算
     */
    saveBeamModalProps: function(beamId) {
        const s = window.AppState;
        if (!s) return;
        const beam = (s.foundationBeams || []).find(x => x.id === beamId);
        if (!beam || !beam.spans) return;

        // 各スパンの入力値を一括取得
        beam.spans.forEach((span, sIdx) => {
            if (!span.props) span.props = {};

            const hEl = document.getElementById(`span-height-${beamId}-${sIdx}`);
            const embEl = document.getElementById(`span-embed-${beamId}-${sIdx}`);
            const wEl = document.getElementById(`span-width-${beamId}-${sIdx}`);

            const topCountEl = document.getElementById(`top-count-${beamId}-${sIdx}`);
            const topTypeEl = document.getElementById(`top-type-${beamId}-${sIdx}`);
            const botCountEl = document.getElementById(`bot-count-${beamId}-${sIdx}`);
            const botTypeEl = document.getElementById(`bot-type-${beamId}-${sIdx}`);

            const stCountEl = document.getElementById(`st-count-${beamId}-${sIdx}`);
            const stTypeEl = document.getElementById(`st-type-${beamId}-${sIdx}`);
            const stPitchEl = document.getElementById(`st-pitch-${beamId}-${sIdx}`);

            if (hEl) span.props.height = parseFloat(hEl.value) || 640;
            if (embEl) span.props.embedDepth = parseFloat(embEl.value) || 250;
            if (wEl) span.props.width = parseFloat(wEl.value) || 150;

            if (topCountEl && topTypeEl) {
                span.props.topRebar = `${topCountEl.value}-${topTypeEl.value}`;
            }
            if (botCountEl && botTypeEl) {
                span.props.bottomRebar = `${botCountEl.value}-${botTypeEl.value}`;
            }
            if (stCountEl && stTypeEl && stPitchEl) {
                span.props.stirrup = `${stCountEl.value}-${stTypeEl.value}@${stPitchEl.value}`;
            }
        });

        if (window.FoundationEngine && typeof window.FoundationEngine.runAnalysis === 'function') {
            window.FoundationEngine.runAnalysis(s);
        }
        if (window.AppController && typeof window.AppController.refreshAll === 'function') {
            window.AppController.refreshAll();
        }

        // ポップアップを最新状態で再描画
        if (window.PropertyController && typeof window.PropertyController.showFdPopup === 'function') {
            window.PropertyController.showFdPopup('beam', beam);
        }
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('FoundationPropertyHandler', window.FoundationPropertyHandler);
}
