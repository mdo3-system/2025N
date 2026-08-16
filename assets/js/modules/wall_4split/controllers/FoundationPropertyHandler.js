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
                        beam.props.height = span.props.height;
                    } else if (key === 'embedDepth') {
                        span.props.embedDepth = isNaN(numVal) ? 250 : numVal;
                        beam.props.embedDepth = span.props.embedDepth;
                    } else span.props[key] = val;
                } else {
                    let numVal = parseFloat(val);
                    if (key === 'width') beam.props.width = isNaN(numVal) ? 150 : numVal;
                    else if (key === 'height') beam.props.height = isNaN(numVal) ? 640 : numVal;
                    else if (key === 'embedDepth') beam.props.embedDepth = isNaN(numVal) ? 250 : numVal;
                    else if (key === 'modelType') beam.props.modelType = val;
                    else if (key === 'topRebar') beam.props.topRebar = val;
                    else if (key === 'bottomRebar') beam.props.bottomRebar = val;
                    else if (key === 'stirrup') beam.props.stirrup = val;
                    else beam.props[key] = val;
                }

                if (window.FoundationEngine && typeof window.FoundationEngine.runAnalysis === 'function') {
                    window.FoundationEngine.runAnalysis(s);
                }
            }
        }

        if (window.PropertyController && typeof window.PropertyController.showFdPopup === 'function') {
            window.PropertyController.showFdPopup(type, (type === 'slab' ? s.foundationSlabs : s.foundationBeams).find(x => x.id === id));
        }
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('FoundationPropertyHandler', window.FoundationPropertyHandler);
}
