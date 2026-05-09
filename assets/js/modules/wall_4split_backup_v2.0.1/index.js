/**
 * index.js
 * wall_4split アプリケーションのメインエントリポイント (ES6 Module)
 */

import { AppState, setupStateBridge } from './state/AppState.js';
import * as MathUtils from './logic/MathUtils.js';
import * as Parsers from './logic/Parsers.js';
import * as FoundationStruct from './logic/FoundationStruct.js';
import * as EngineFoundation from './logic/EngineFoundation.js';
import * as FoundationView from './view/FoundationView.js';
import * as UIFoundationPopup from './view/UIFoundationPopup.js';
import * as FoundationController from './controllers/FoundationController.js';
import * as MainController from './controllers/MainController.js';
import { UIController } from './controllers/UIController.js';
import * as EngineWallAmount from './logic/EngineWallAmount.js';
import * as EngineCenterOfGravity from './logic/EngineCenterOfGravity.js';
import * as EngineNValue from './logic/EngineNValue.js';

// --- Global Bridge (レガシーコードとの互換性維持) ---
window.AppState = AppState;
window.MathUtils = MathUtils;
window.Parsers = Parsers;
window.EngineWallAmount = EngineWallAmount;
window.EngineCenterOfGravity = EngineCenterOfGravity;
window.EngineNValue = EngineNValue;

// 基礎計算エンジンのグローバル展開
window.calculateFoundationSlab = EngineFoundation.calculateFoundationSlab;
window.calculateContinuousBeamStress = EngineFoundation.calculateContinuousBeamStress;
window.reconstructContinuousBeams = FoundationStruct.reconstructContinuousBeams;
window.calculateSlabTributary = FoundationStruct.calculateSlabTributary;

// View関数のグローバル展開
window.getFoundationSlabReportHtml = FoundationView.getFoundationSlabReportHtml;
window.generateContinuousBeamReportHtml = FoundationView.generateContinuousBeamReportHtml;
window.showFdPropertyPopup = UIFoundationPopup.showFdPropertyPopup;
window.hideFdPropertyPopup = UIFoundationPopup.hideFdPropertyPopup;

// コントローラー関数のグローバル展開
window.switchAppMode = MainController.switchAppMode;
window.setFloor = MainController.setFloor;
window.updateFdSubMode = MainController.updateFdSubMode;
window.loadProjectData = MainController.loadProjectData;
window.handleFoundationMouseDown = FoundationController.handleFoundationMouseDown;
window.getFdSnapPoint = FoundationController.getFdSnapPoint;
window.trySelectFoundationElement = FoundationController.trySelectFoundationElement;
window.updateFdItemProp = FoundationController.updateFdItemProp;

/**
 * アプリケーションの初期化シーケンス
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Wall 4Split Modular System Initializing...");
    
    // キャンバスとコンテキストの取得
    AppState.canvas = document.getElementById('cad-canvas');
    if (AppState.canvas) {
        AppState.ctx = AppState.canvas.getContext('2d');
    }

    // 状態の同期ブリッジ開始
    setupStateBridge();

    // モード切替ラジオボタンのイベント
    document.querySelectorAll('input[name="mode"]').forEach(el => {
        el.addEventListener('change', (e) => {
            if (typeof window.handleModeChange === 'function') window.handleModeChange();
        });
    });

    // 基礎サブモードのイベント
    document.querySelectorAll('input[name="fd-mode"]').forEach(el => {
        el.addEventListener('change', (e) => {
            MainController.updateFdSubMode(e.target.value);
        });
    });

    // JSON復元（プロジェクト読込）のイベント
    const jsonUpload = document.getElementById('json-upload');
    if (jsonUpload) {
        jsonUpload.addEventListener('change', (e) => {
            MainController.loadProjectData(e);
        });
    }

    console.log("✅ Initialization Complete.");
});

export {
    AppState,
    MainController,
    FoundationController,
    EngineFoundation,
    FoundationView
};
