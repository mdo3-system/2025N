// v3.15.8: Fix manual grid addition (set isGridFixed on X, normalize IME full-width inputs, preserve existing coordinates in GridEngine without DXF, persist userEditedGrid in history stack)
// v3.15.7: Prefer matching 1F origin intersection in Step 2+ preview to prevent false offset shift on different-footprint floors
// v3.15.6: Fix DXF wizard originPt synchronization on nextStep/finishWizard, sort grid intersections, and auto-fill unvisited step layers on complete
// v3.15.5: Prevent overwriting current step on DXF add when matched to another step, and deduplicate grid axis labels (e.g. X8(2))
// v3.15.4: Split direct ratio warnings (pillar 0 vs wall 0), assign grid text only to closest grid line within 350mm, auto-match added DXF files to unassigned steps
// v3.15.3: Deduplicate snapped pillars at identical coordinates in GridEngine (manual/attribute priority) and fix 1F/2F roof DXF file auto-matching
// v3.15.2: Fix 2F DXF wizard layer/file mapping & column deduplication, show div4 ratio/judgement on all rows, handle 0-denominator direct support ratio as out-of-scope warning
// v3.15.1: Fix report modal close handling, fallback manual floor area for required wall calc, deduplicate DXF imported columns
// v3.15.0: Column diameter calculation check tables (2-1, 2-2, 2-3) under tributary area tables
window.APP_VERSION = "v3.15.8";

(function () {
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

