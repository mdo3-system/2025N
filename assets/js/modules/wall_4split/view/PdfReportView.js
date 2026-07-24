/**
 * view/PdfReportView.js - 帳票ダイアログ・印刷範囲制御モジュール
 * v3.1.1 Refactoring & Fix Blank Page on Foundation Only Print Mode
 */

window.PdfReportView = {
    appState: null,

    inject: function(dependencies) {
        this.appState = dependencies.appState;
    },

    /**
     * 印刷ナビゲーションバーHTMLの構築
     */
    buildNavigationHtml: function(isTotalOk) {
        return `<div style="display:flex; align-items:center; gap:6px; width:100%; flex-wrap:wrap; font-size:11px;">
            <span style="color:#ecf0f1; font-weight:bold; font-size:13px; margin-right:4px;">📄 目次:</span>
            <button class="jump-btn" onclick="document.getElementById('sec-area')?.scrollIntoView({behavior:'smooth'})" style="padding:4px 8px; background:#34495e; color:#fff; border:1px solid #5d6d7e; border-radius:4px; cursor:pointer;">1.面積・壁量</button>
            <button class="jump-btn" onclick="document.getElementById('sec-wall')?.scrollIntoView({behavior:'smooth'})" style="padding:4px 8px; background:#34495e; color:#fff; border:1px solid #5d6d7e; border-radius:4px; cursor:pointer;">2.壁量検定</button>
            <button class="jump-btn" onclick="document.getElementById('sec-div4')?.scrollIntoView({behavior:'smooth'})" style="padding:4px 8px; background:#34495e; color:#fff; border:1px solid #5d6d7e; border-radius:4px; cursor:pointer;">3.4分割</button>
            <button class="jump-btn" onclick="document.getElementById('sec-nval')?.scrollIntoView({behavior:'smooth'})" style="padding:4px 8px; background:#34495e; color:#fff; border:1px solid #5d6d7e; border-radius:4px; cursor:pointer;">4.N値</button>
            <button class="jump-btn" onclick="document.getElementById('sec-pillar')?.scrollIntoView({behavior:'smooth'})" style="padding:4px 8px; background:#34495e; color:#fff; border:1px solid #5d6d7e; border-radius:4px; cursor:pointer;">5.柱負担</button>
            <button class="jump-btn" onclick="document.getElementById('sec-fd-slab')?.scrollIntoView({behavior:'smooth'})" style="padding:4px 8px; background:#8e44ad; color:#fff; border:1px solid #a569bd; border-radius:4px; cursor:pointer;">6.基礎スラブ</button>
            <button class="jump-btn" onclick="document.getElementById('sec-fd-beam')?.scrollIntoView({behavior:'smooth'})" style="padding:4px 8px; background:#8e44ad; color:#fff; border:1px solid #a569bd; border-radius:4px; cursor:pointer;">7.基礎梁</button>
            
            <div style="flex-grow:1;"></div>
            
            <span style="color:#d5f5e3; font-weight:bold; font-size:11px;">🖨️ 印刷範囲:</span>
            <select id="doc-print-range-select" style="padding:4px 8px; font-size:11px; font-weight:bold; background:#fff; color:#2c3e50; border:none; border-radius:4px; cursor:pointer;">
                <option value="all">📑 全計算書を一括出力 (1〜7全項目)</option>
                <option value="wall_only">📄 壁量計算書を出力 (1〜5項目)</option>
                <option value="fd_only">🏗️ 基礎計算書を出力 (6〜7項目)</option>
            </select>
            <button class="print-btn" onclick="window.PdfReportView.printDocSection()" style="padding:5px 12px; background:#27ae60; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:12px;">🖨️ 印刷/PDF</button>
            <button class="btn-close-modal" onclick="document.getElementById('modal-doc').style.display='none'" style="padding:5px 12px; background:#e74c3c; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:12px;">✖ 閉じる</button>
        </div>`;
    },

    /**
     * 選択された印刷範囲（全計算書 / 壁量のみ / 基礎のみ）に応じた印刷フィルタリング制御
     */
    printDocSection: function() {
        const sel = document.getElementById('doc-print-range-select');
        const mode = sel ? sel.value : 'all';
        
        const dc = document.getElementById('doc-container');
        if (!dc) { window.print(); return; }

        document.body.classList.remove('print-mode-wall-only', 'print-mode-fd-only');
        if (mode === 'wall_only') document.body.classList.add('print-mode-wall-only');
        if (mode === 'fd_only') document.body.classList.add('print-mode-fd-only');

        // doc-container 直下の全子要素（page-breakや各doc-section）を取得
        const allChildren = Array.from(dc.children);
        
        allChildren.forEach(el => {
            const isFdSlab = el.id === 'sec-fd-slab' || Boolean(el.querySelector && el.querySelector('#sec-fd-slab'));
            const isFdBeam = el.id === 'sec-fd-beam' || Boolean(el.querySelector && el.querySelector('#sec-fd-beam'));
            // 基礎セクション間の page-break (pb-before-fd, pb-between-fd) も基礎セクション扱い
            const isFdPageBreak = el.id === 'pb-before-fd' || el.id === 'pb-between-fd';
            const isFd = isFdSlab || isFdBeam || isFdPageBreak;

            if (mode === 'wall_only') {
                if (isFd) {
                    el.style.setProperty('display', 'none', 'important');
                } else {
                    el.style.removeProperty('display');
                }
            } else if (mode === 'fd_only') {
                if (isFd) {
                    // fd_only の場合、pb-before-fd（基礎セクション手前の page-break）は非表示にして空白ページを防ぐ
                    if (el.id === 'pb-before-fd') {
                        el.style.setProperty('display', 'none', 'important');
                    } else {
                        el.style.removeProperty('display');
                    }
                } else {
                    el.style.setProperty('display', 'none', 'important');
                }
            } else {
                // 全表示（all）
                el.style.removeProperty('display');
                el.style.removeProperty('page-break-before');
                el.style.removeProperty('break-before');
            }
        });

        setTimeout(() => {
            window.print();
            setTimeout(() => {
                document.body.classList.remove('print-mode-wall-only', 'print-mode-fd-only');
                allChildren.forEach(el => {
                    el.style.removeProperty('display');
                    el.style.removeProperty('page-break-before');
                    el.style.removeProperty('break-before');
                });
            }, 800);
        }, 150);
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('PdfReportView', window.PdfReportView);
}
