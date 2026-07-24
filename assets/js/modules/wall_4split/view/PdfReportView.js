/**
 * view/PdfReportView.js - 帳票ダイアログ・印刷範囲制御モジュール
 * v3.1.4 - fd_only 印刷：CSS/JSフィルタリングを廃止し innerHTML 差し替え方式に変更
 *           これにより HTML 構造の入れ子や CSS セレクタ問題を完全回避
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
     * 選択された印刷範囲（全計算書 / 壁量のみ / 基礎のみ）に応じた印刷処理
     *
     * fd_only の場合：
     *   CSS/JS フィルタリング方式（セレクタ・display 制御）は HTML 構造の入れ子や
     *   @media print の適用タイミングに依存するため不安定。
     *   代わりに doc-container の innerHTML を fd セクションのみに一時差し替えて
     *   window.print() を呼び出し、印刷後に元の内容を復元する確実な方式に変更。
     */
    printDocSection: function() {
        const sel = document.getElementById('doc-print-range-select');
        const mode = sel ? sel.value : 'all';

        const dc = document.getElementById('doc-container');
        if (!dc) {
            window.print();
            return;
        }

        // --- fd_only: innerHTML 差し替え方式（最も確実） ---
        if (mode === 'fd_only') {
            // sec-fd-slab と sec-fd-beam を DOM ツリー全体から探索
            const fdSlab = document.getElementById('sec-fd-slab');
            const fdBeam = document.getElementById('sec-fd-beam');

            if (!fdSlab && !fdBeam) {
                alert('基礎計算書のデータが見つかりません。\n先に「📑 計算書を一括出力 (PDF)」を実行してモーダルを開いてから印刷してください。');
                return;
            }

            const originalInnerHTML = dc.innerHTML;
            let restored = false;

            // 差し替え用 HTML：fd セクションのみ（page-break-before なし）
            let fdHtml = '';
            if (fdSlab) {
                // sec-fd-slab の outerHTML を使用（id をリネームして重複回避）
                fdHtml += fdSlab.outerHTML.replace('id="sec-fd-slab"', 'id="sec-fd-slab-print"');
            }
            if (fdBeam) {
                if (fdSlab) {
                    // slab と beam の間のみ改ページ
                    fdHtml += '<div style="page-break-before:always; break-before:page;"></div>';
                }
                fdHtml += fdBeam.outerHTML.replace('id="sec-fd-beam"', 'id="sec-fd-beam-print"');
            }

            // 復元関数（1回だけ実行）
            const restore = () => {
                if (restored) return;
                restored = true;
                dc.innerHTML = originalInnerHTML;
            };

            // afterprint イベントで復元（印刷完了 or キャンセル時）
            window.addEventListener('afterprint', function onAfterPrint() {
                window.removeEventListener('afterprint', onAfterPrint);
                restore();
            });

            // doc-container を fd 内容のみに差し替え
            dc.innerHTML = fdHtml;

            // body クラスをリセット（余分なフィルタが掛からないよう）
            document.body.classList.remove('print-mode-wall-only', 'print-mode-fd-only');

            // 少し待ってからブラウザの印刷ダイアログを呼び出す
            setTimeout(() => {
                window.print();
                // afterprint が発火しないブラウザ向けのフォールバック復元（5秒後）
                setTimeout(restore, 5000);
            }, 300);

            return;
        }

        // --- wall_only: CSS クラス方式（従来通り・動作確認済み） ---
        document.body.classList.remove('print-mode-wall-only', 'print-mode-fd-only');
        if (mode === 'wall_only') {
            document.body.classList.add('print-mode-wall-only');
        }

        setTimeout(() => {
            window.print();
            setTimeout(() => {
                document.body.classList.remove('print-mode-wall-only', 'print-mode-fd-only');
            }, 800);
        }, 150);
    }
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('PdfReportView', window.PdfReportView);
}
