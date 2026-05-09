/**
 * state/Specs.js - 構造仕様マスタデータ (Single Source of Truth)
 * v2.3.22 Refactoring
 */
window.Specs = {
    // 1. 耐力面材マスタ (IDは固定、履歴互換性のために一部旧IDを許容するか検討)
    getMasterWallList: function() {
        return [
            { id: "opt0", val: 0, text: "なし" },
            { id: "opt1", val: 2.5, text: "① 構造用合板 (大壁) N50@150 2.5倍" },
            { id: "opt2", val: 3.7, text: "② 構造用合板 (大壁) CN50@75 3.7倍" },
            { id: "opt3", val: 2.5, text: "③ 構造用合板 (真壁) N50@150 2.5倍" },
            { id: "opt4", val: 3.3, text: "④ 構造用合板 (真壁) CN50@75 3.3倍" },
            { id: "opt5", val: 3.7, text: "⑤ OSB (大壁) N50@75 3.7倍" },
            { id: "opt6", val: 3.3, text: "⑥ OSB (真壁) N50@75 3.3倍" },
            { id: "opt7", val: 4.3, text: "⑦ MDF/パーティクルボード (大壁) N50@75 4.3倍" },
            { id: "opt8", val: 4.0, text: "⑧ MDF/パーティクルボード (真壁) N50@75 4.0倍" },
            { id: "opn1", val: 0, text: "開口部 (W=910/1365/1820)", type: "opening" }
        ];
    },

    // 2. 筋交いマスタ
    getMasterBraceList: function() {
        return [
            { id: "b0", val: 0, text: "なし" },
            { id: "b1", val: 1.5, text: "筋交い 15x90 片掛け(／) 1.5倍" },
            { id: "b2", val: 1.5, text: "筋交い 15x90 片掛け(＼) 1.5倍" },
            { id: "b3", val: 2.0, text: "筋交い 45x90 片掛け(／) 2.0倍" },
            { id: "b4", val: 2.0, text: "筋交い 45x90 片掛け(＼) 2.0倍" },
            { id: "b5", val: 3.0, text: "筋交い 90x90 片掛け(／) 3.0倍" },
            { id: "b6", val: 3.0, text: "筋交い 90x90 片掛け(＼) 3.0倍" },
            { id: "b7", val: 4.0, text: "筋交い 45x90 たすき(Ｘ) 4.0倍" },
            { id: "b8", val: 5.0, text: "筋交い 90x90 たすき(Ｘ) 5.0倍" }
        ];
    },

    // 3. 柱金物マスタ
    getHardwareList: function() {
        return [
            { name: "L", n: 0.65 }, { name: "V", n: 1.0 }, { name: "Is", n: 1.4 }, { name: "Ps", n: 1.6 },
            { name: "2", n: 1.8 }, { name: "3", n: 2.8 }, { name: "4", n: 3.7 }, { name: "5", n: 4.7 }, { name: "32", n: 5.6 }
        ];
    },

    // 4. レガシーデータ移行用マッピング (名称からIDを特定)
    findWallIdByName: function(name, masterList = null) {
        if (!name || name.includes("なし")) return "opt0";
        const list = masterList || this.getMasterWallList();
        
        // 1. ①などの接頭辞で検索
        const prefixMatch = name.match(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])/);
        if (prefixMatch) {
            const mark = prefixMatch[1];
            const found = list.find(l => l.text.startsWith(mark));
            if (found) return found.id;
        }

        // 2. 完全一致または包含を優先
        let found = list.find(l => name.includes(l.text) || l.text.includes(name));
        if (found) return found.id;

        // 3. 倍率で推測
        const match = name.match(/(\d+\.\d+)/);
        if (match) {
            const val = parseFloat(match[1]);
            found = list.find(l => l.val === val);
            if (found) return found.id;
        }
        return "opt0";
    },

    findBraceIdByName: function(name, masterList = null) {
        if (!name || name.includes("なし")) return "b0";
        const list = masterList || this.getMasterBraceList();
        
        // 1. 完全一致または包含を優先
        let found = list.find(l => name.includes(l.text) || l.text.includes(name));
        if (found) return found.id;

        // 2. 倍率で推測
        const match = name.match(/(\d+\.\d+)/);
        if (match) {
            const val = parseFloat(match[1]);
            found = list.find(l => l.val === val);
            if (found) return found.id;
        }
        return "b0";
    }
};
