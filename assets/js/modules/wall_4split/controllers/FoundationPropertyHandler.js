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
                if (key === 'slabThickness') slab.props.slabThickness = parseFloat(val) || 150;
                else if (key === 'support') slab.props.support = val;
                else if (key === 'rebar') slab.props.rebar = val;
                else slab.props[key] = val;
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
    window.ServiceContainer.register('FoundationPropertyHandler', window.FoundationFoundationPropertyHandler);
}
