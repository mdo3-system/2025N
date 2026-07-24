/**
 * view/PdfReportView.js - 帳票ダイアログ・印刷範囲制御モジュール
 * v3.1.0 Refactoring (Layered Architecture & Single Responsibility)
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

        const allSections = Array.from(dc.querySelectorAll('.doc-section, #sec-summary'));
        
        allSections.forEach(sec => {
            const isFd = sec.id === 'sec-fd-slab' || sec.id === 'sec-fd-beam';
            if (mode === 'wall_only') {
                if (isFd) {
                    sec.style.setProperty('display', 'none', 'important');
                } else {
                    sec.style.removeProperty('display');
                }
            } else if (mode === 'fd_only') {
                if (isFd) {
                    sec.style.removeProperty('display');
                } else {
                    sec.style.setProperty('display', 'none', 'important');
                }
            } else {
                sec.style.removeProperty('display');
            }
        });

        setTimeout(() => {
            window.print();
            setTimeout(() => {
                document.body.classList.remove('print-mode-wall-only', 'print-mode-fd-only');
                allSections.forEach(sec => sec.style.removeProperty('display'));
            }, 800);
        }, 150);
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('PdfReportView', window.PdfReportView);
}
