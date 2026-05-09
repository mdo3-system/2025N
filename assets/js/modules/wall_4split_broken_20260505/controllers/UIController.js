/**
 * UIController.js
 * UI要素からの入力取得とAppStateへの同期、およびUI関連イベントを管理する
 */

import { AppState } from '../state/AppState.js';

export const UIController = {
    // UI入力値をまとめて取得し、AppState.uiParams に格納する
    syncDOMToState: function() {
        const p = AppState.uiParams;

        // 計算モード
        const modeEl = document.getElementById('calc-mode-select');
        p.calcMode = modeEl ? modeEl.value : 'kijun';

        const atticHEl = document.getElementById('attic-height');
        p.atticHeight = atticHEl ? parseFloat(atticHEl.value) || 1.4 : 1.4;

        // 床面積・その他全般
        ['1', '2', 'RF'].forEach(f => {
            p[`a-f${f}`] = this.getVal(`a-f${f}`);
            p[`c-q${f}`] = this.getVal(`c-q${f}`);
            p[`c-w${f}`] = this.getVal(`c-w${f}`);
            p[`a-wx${f}`] = this.getVal(`a-wx${f}`);
            p[`a-wy${f}`] = this.getVal(`a-wy${f}`);

            // 4分割 見付長さ
            p[`e-x-t${f}`] = this.getVal(`e-x-t${f}`);
            p[`e-x-b${f}`] = this.getVal(`e-x-b${f}`);
            p[`e-y-l${f}`] = this.getVal(`e-y-l${f}`);
            p[`e-y-r${f}`] = this.getVal(`e-y-r${f}`);

            // 剛心 床面長さ
            p[`z-x-t${f}`] = this.getVal(`z-x-t${f}`);
            p[`z-x-b${f}`] = this.getVal(`z-x-b${f}`);
            p[`z-y-l${f}`] = this.getVal(`z-y-l${f}`);
            p[`z-y-r${f}`] = this.getVal(`z-y-r${f}`);

            // N値計算用・階高・柱小径
            p[`n-h${f}`] = this.getVal(`n-h${f}`);
            p[`p-d${f}`] = this.getVal(`p-d${f}`);
        });
    },

    // ユーティリティ: 要素から数値を取得
    getVal: function(id) {
        let el = document.getElementById(id);
        return el ? parseFloat(el.value) || 0 : 0;
    },

    // ユーティリティ: 要素から文字列を取得
    getStr: function(id) {
        let el = document.getElementById(id);
        return el ? el.value : '';
    },

    // ユーティリティ: 要素に値をセットする (計算結果のUI反映用)
    setVal: function(id, val, bgColor = null) {
        let el = document.getElementById(id);
        if (el) {
            el.value = val;
            if (bgColor) el.style.backgroundColor = bgColor;
            else el.style.backgroundColor = '';
        }
    },

    // ユーティリティ: モードラジオボタンの値を取得
    getMode: function() {
        let el = document.querySelector('input[name="mode"]:checked');
        return el ? el.value : 'wall';
    }
};

// レガシー互換用
window.UIController = UIController;
