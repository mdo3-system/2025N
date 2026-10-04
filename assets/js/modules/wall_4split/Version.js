// v3.15.0: Column diameter calculation check tables (2-1, 2-2, 2-3) under tributary area tables
window.APP_VERSION = "v3.15.0";

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
