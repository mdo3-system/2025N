// v3.15.0: Column diameter calculation check tables (2-1, 2-2, 2-3) under tributary area tables
window.APP_VERSION = "v3.15.0";

(function() {
    function applyAppVersion() {
        if (typeof document === 'undefined') return;
        const ver = window.APP_VERSION || "v3.15.0";
        const isLocal = typeof location !== 'undefined' && (
            location.hostname === 'localhost' ||
            location.hostname === '127.0.0.1' ||
            location.protocol === 'file:' ||
            location.hostname.startsWith('192.168.') ||
            location.hostname.startsWith('10.')
        );

        document.title = (isLocal ? '【LOCAL】' : '') + '上善如水 - 壁量計算WEB (' + ver + ')';
        const el = document.getElementById('app-version-title');
        if (el) {
            el.innerText = ver;
            el.style.fontWeight = 'bold';
            el.style.color = '#0056b3';
            el.style.backgroundColor = isLocal ? '#e3f2fd' : '#f0f0f0';
            el.style.padding = '2px 8px';
            el.style.borderRadius = '4px';
            el.style.border = isLocal ? '1px solid #90caf9' : '1px solid #ccc';
            el.style.display = 'inline-block';
            el.style.marginLeft = '4px';
            if (isLocal) {
                let badge = document.getElementById('app-env-badge');
                if (!badge && el.parentNode) {
                    badge = document.createElement('span');
                    badge.id = 'app-env-badge';
                    badge.style.fontSize = '11px';
                    badge.style.fontWeight = 'bold';
                    badge.style.backgroundColor = '#e67e22';
                    badge.style.color = '#fff';
                    badge.style.padding = '2px 6px';
                    badge.style.borderRadius = '4px';
                    badge.style.marginLeft = '5px';
                    badge.innerText = 'ローカル検証環境';
                    el.parentNode.appendChild(badge);
                }
            }
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

