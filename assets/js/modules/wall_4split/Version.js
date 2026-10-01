// v3.14.1: Fix Foundation Plan SVG bounding box coordinate extraction and scale NaN guard
window.APP_VERSION = "v3.14.1";

(function() {
    function applyAppVersion() {
        if (typeof document === 'undefined') return;
        const el = document.getElementById('app-version-title');
        if (el && window.APP_VERSION) {
            el.innerText = window.APP_VERSION;
        }
    }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyAppVersion);
        } else {
            applyAppVersion();
        }
    }
})();
