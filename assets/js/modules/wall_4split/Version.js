// v3.13.39: Integration of Foundation Beam Cross Section Detail CAD Viewer & Symbol Inconsistency Validation
window.APP_VERSION = "v3.13.39";

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
