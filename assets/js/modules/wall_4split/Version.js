// v3.13.37: Mitsuke area manual/DXF input mode, roof tabs disabling, and wizard integration
window.APP_VERSION = "v3.13.37";

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
