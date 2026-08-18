/**
 * view/PreviewModalView.js - Area & Mitsuke Preview Modal UI Renderer
 * v3.12.106 Refactoring: Isolated Modal UI Presentation from PDF Generation
 */

window.PreviewModalView = {
    /**
     * 求積図・見附面積・4分割法・柱負担面積プレビューモーダルの表示とタブ制御
     */
    showAreaPreview: function() {
        const pc = document.getElementById('area-preview-container');
        if (!pc) return;
        pc.innerHTML = '';

        // 見附面積データ・投影ポリゴンを自動再計算
        if (window.MitsukeEngine && typeof window.MitsukeEngine.updateProjectedAreas === 'function') {
            window.MitsukeEngine.updateProjectedAreas(window.AppState);
        }

        const iF1 = window.createLayerFilteredImage ? window.createLayerFilteredImage('floor', ['AREA_D_1F', 'AREA_1F'], ['BG_1F'], '1F', true, 1.0, true) : null;
        const iF2 = window.createLayerFilteredImage ? window.createLayerFilteredImage('floor', ['AREA_D_2F', 'AREA_2F'], ['BG_2F'], '2F', true, 1.0, true) : null;
        const iFR = window.createLayerFilteredImage ? window.createLayerFilteredImage('floor', ['AREA_D_RF', 'AREA_RF'], ['BG_RF'], 'RF', true, 1.0, true) : null;
        
        // 4分割図: 常に作図データ(壁・柱)から自動生成する
        const iD1X = window.createNativeCanvasImage ? window.createNativeCanvasImage('1F', 'wall', 'X', true, 1.0, true) : null;
        const iD1Y = window.createNativeCanvasImage ? window.createNativeCanvasImage('1F', 'wall', 'Y', true, 1.0, true) : null;
        const iD2X = window.createNativeCanvasImage ? window.createNativeCanvasImage('2F', 'wall', 'X', true, 1.0, true) : null;
        const iD2Y = window.createNativeCanvasImage ? window.createNativeCanvasImage('2F', 'wall', 'Y', true, 1.0, true) : null;
        
        let div4ImgHtml = `
            ${iD1X ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">1F X方向 4分割図 (自動計算モデル) <span style="font-size:10px;color:#888;">※クリックで拡大</span></div><img src="${iD1X.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:zoom-in;" onclick="window._zoomMitsukeImg && window._zoomMitsukeImg(this.src, '1F X方向 4分割図')"></div>` : ''}
            ${iD1Y ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">1F Y方向 4分割図 (自動計算モデル) <span style="font-size:10px;color:#888;">※クリックで拡大</span></div><img src="${iD1Y.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:zoom-in;" onclick="window._zoomMitsukeImg && window._zoomMitsukeImg(this.src, '1F Y方向 4分割図')"></div>` : ''}
            ${iD2X ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">2F X方向 4分割図 (自動計算モデル) <span style="font-size:10px;color:#888;">※クリックで拡大</span></div><img src="${iD2X.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:zoom-in;" onclick="window._zoomMitsukeImg && window._zoomMitsukeImg(this.src, '2F X方向 4分割図')"></div>` : ''}
            ${iD2Y ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">2F Y方向 4分割図 (自動計算モデル) <span style="font-size:10px;color:#888;">※クリックで拡大</span></div><img src="${iD2Y.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:zoom-in;" onclick="window._zoomMitsukeImg && window._zoomMitsukeImg(this.src, '2F Y方向 4分割図')"></div>` : ''}
        `;

        const iPA1 = window.createHighResPlanImage ? window.createHighResPlanImage('1F', 'area', null, true, 1.0, true) : null;
        const iPA2 = window.createHighResPlanImage ? window.createHighResPlanImage('2F', 'area', null, true, 1.0, true) : null;

        // Generate high-fidelity analytical silhouette elevation plans
        let commonScale = null;
        if (window.MitsukeEngine && window.MitsukeEngine.generateElevationAreas) {
            const projX = window.MitsukeEngine.generateElevationAreas('X', window.AppState);
            const projY = window.MitsukeEngine.generateElevationAreas('Y', window.AppState);
            if (projX && projY) {
                const getBounds = (proj) => {
                    let uMin = Infinity, uMax = -Infinity, zMax = -Infinity;
                    proj.primitives.forEach(prim => {
                        prim.vertices.forEach(v => {
                            if (v.u < uMin) uMin = v.u;
                            if (v.u > uMax) uMax = v.u;
                            if (v.z > zMax) zMax = v.z;
                        });
                    });
                    return { W: uMax > uMin ? uMax - uMin : 10000, maxZ: zMax };
                };
                
                const boundsX = getBounds(projX);
                const boundsY = getBounds(projY);

                const totalH_X = Math.max(boundsX.maxZ, projX.eavesZ2F + 1000);
                const totalH_Y = Math.max(boundsY.maxZ, projY.eavesZ2F + 1000);

                const W_max = Math.max(boundsX.W, boundsY.W);
                const totalH_max = Math.max(totalH_X, totalH_Y);

                const padL = 90, padR = 400, padT = 70, padB = 60;
                const drawW = 900 - padL - padR; // 410
                const drawH = 600 - padT - padB; // 470

                const scaleU = drawW / W_max;
                const scaleZ = drawH / totalH_max;
                commonScale = Math.min(scaleU, scaleZ) * 0.90;
            }
        }

        const iAutoEX = window.generateAutoMitsukeCanvas ? window.generateAutoMitsukeCanvas('X', commonScale) : null;
        const iAutoEY = window.generateAutoMitsukeCanvas ? window.generateAutoMitsukeCanvas('Y', commonScale) : null;

        // タブUI全体のHTML構築
        let tabHtml = `
            <div class="preview-tabs" style="display:flex; gap:8px; border-bottom:2px solid #ddd; padding-bottom:10px; margin-bottom:15px; width:100%;">
                <button class="preview-tab-btn active" data-target="tab-floor" style="padding:8px 16px; border:none; background:#f1f2f6; border-radius:4px; font-weight:bold; cursor:pointer; transition:all 0.3s;">🏢 床面積</button>
                <button class="preview-tab-btn" data-target="tab-mitsuke" style="padding:8px 16px; border:none; background:#f1f2f6; border-radius:4px; font-weight:bold; cursor:pointer; transition:all 0.3s;">📐 見附面積</button>
                <button class="preview-tab-btn" data-target="tab-div4" style="padding:8px 16px; border:none; background:#f1f2f6; border-radius:4px; font-weight:bold; cursor:pointer; transition:all 0.3s;">📊 4分割法</button>
                <button class="preview-tab-btn" data-target="tab-pillar" style="padding:8px 16px; border:none; background:#f1f2f6; border-radius:4px; font-weight:bold; cursor:pointer; transition:all 0.3s;">🎯 柱負担面積</button>
            </div>
            
            <div id="tab-floor" class="preview-tab-content active" style="width:100%;">
                <div class="tab-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:20px; margin-bottom:20px;">
                    ${iF1 ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">1F 床面積図</div><img src="${iF1.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08);"></div>` : ''}
                    ${iF2 ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">2F 床面積図</div><img src="${iF2.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08);"></div>` : ''}
                    ${iFR ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">R階 床面積図</div><img src="${iFR.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08);"></div>` : ''}
                </div>
                <div id="floor-table-container"></div>
            </div>
            
            <div id="tab-mitsuke" class="preview-tab-content" style="width:100%; display:none;">
                <div class="tab-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:20px; margin-bottom:20px;">
                    ${iAutoEX ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">X方向 見附面積図 <span style="font-size:10px;color:#888;">※クリックで拡大</span></div><img src="${iAutoEX.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:zoom-in;" onclick="window._zoomMitsukeImg && window._zoomMitsukeImg(this.src, 'X方向 見附面積図')"></div>` : ''}
                    ${iAutoEY ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">Y方向 見附面積図 <span style="font-size:10px;color:#888;">※クリックで拡大</span></div><img src="${iAutoEY.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08); cursor:zoom-in;" onclick="window._zoomMitsukeImg && window._zoomMitsukeImg(this.src, 'Y方向 見附面積図')"></div>` : ''}
                </div>
                <div id="mitsuke-table-container"></div>
            </div>
            
            <div id="tab-div4" class="preview-tab-content" style="width:100%; display:none;">
                <div class="tab-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:20px; margin-bottom:20px;">
                    ${div4ImgHtml}
                </div>
                <div id="div4-table-container" style="margin-top:20px;"></div>
            </div>
            
            <div id="tab-pillar" class="preview-tab-content" style="width:100%; display:none;">
                <div class="tab-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:20px; margin-bottom:20px;">
                    ${iPA1 ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">1F 柱負担面積図</div><img src="${iPA1.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08);"></div>` : ''}
                    ${iPA2 ? `<div class="img-preview-box"><div style="font-weight:bold;color:#0056b3;margin-bottom:5px;">2F 柱負担面積図</div><img src="${iPA2.img}" style="width:100%; border:1px solid #ddd; padding:5px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.08);"></div>` : ''}
                </div>
            </div>
        `;

        let tabStyle = `
            <style>
                .preview-tab-btn {
                    background: #f1f2f6;
                    color: #2c3e50;
                    border: 1px solid #dcdde1;
                    outline: none;
                }
                .preview-tab-btn:hover {
                    background: #e1e2e6;
                }
                .preview-tab-btn.active {
                    background: #8e44ad !important;
                    color: #ffffff !important;
                    border-color: #8e44ad !important;
                }
                .img-preview-box img {
                    max-height: 70vh !important;
                    object-fit: contain;
                }
            </style>
        `;

        pc.innerHTML = tabStyle + tabHtml;

        // テーブルの挿入
        const floorTableContainer = document.getElementById('floor-table-container');
        if (floorTableContainer && window.generateFloorAreaTableHtml) {
            floorTableContainer.innerHTML = window.generateFloorAreaTableHtml(window.AppState);
        }

        const mitsukeTableContainer = document.getElementById('mitsuke-table-container');
        if (mitsukeTableContainer && window.ElevationRenderer && window.ElevationRenderer.generateElevationAreaTableHtml) {
            if (window.MitsukeEngine && typeof window.MitsukeEngine.updateProjectedAreas === 'function') {
                window.MitsukeEngine.updateProjectedAreas(window.AppState);
            }
            mitsukeTableContainer.innerHTML = window.ElevationRenderer.generateElevationAreaTableHtml(window.AppState);
        }

        const div4TableContainer = document.getElementById('div4-table-container');
        if (div4TableContainer && window.ReportEngine && window.ReportEngine.generateDiv4TableHtml) {
            div4TableContainer.innerHTML = window.ReportEngine.generateDiv4TableHtml(window.AppState);
        }

        // イベントバインディング
        const tabBtns = pc.querySelectorAll('.preview-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                tabBtns.forEach(b => b.classList.remove('active'));
                pc.querySelectorAll('.preview-tab-content').forEach(c => c.style.display = 'none');
                
                this.classList.add('active');
                const targetId = this.getAttribute('data-target');
                const targetContent = document.getElementById(targetId);
                if (targetContent) {
                    targetContent.style.display = 'block';
                }
            });
        });

        const modal = document.getElementById('modal-area');
        if (modal) { modal.style.display = 'flex'; }
    },

    /**
     * 見附面積図拡大表示
     */
    zoomMitsukeImg: function(src, title) {
        let zoomModal = document.getElementById('mitsuke-zoom-modal');
        if (!zoomModal) {
            zoomModal = document.createElement('div');
            zoomModal.id = 'mitsuke-zoom-modal';
            zoomModal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:zoom-out;';
            zoomModal.innerHTML = `
                <div style="position:absolute; top:15px; right:25px; color:#fff; font-size:24px; font-weight:bold; cursor:pointer;" onclick="document.getElementById('mitsuke-zoom-modal').style.display='none'">✕</div>
                <div id="mitsuke-zoom-title" style="color:#fff; font-size:16px; font-weight:bold; margin-bottom:10px;"></div>
                <img id="mitsuke-zoom-img" style="max-width:92vw; max-height:88vh; border:2px solid #fff; border-radius:4px; box-shadow:0 4px 20px rgba(0,0,0,0.5); object-fit:contain;">
            `;
            zoomModal.onclick = function(e) {
                if (e.target.tagName !== 'IMG') {
                    zoomModal.style.display = 'none';
                }
            };
            document.body.appendChild(zoomModal);
        }
        document.getElementById('mitsuke-zoom-title').innerText = title || '拡大プレビュー';
        document.getElementById('mitsuke-zoom-img').src = src;
        zoomModal.style.display = 'flex';
    }
};

// 全域上位互換プロキシラッパー
window.showAreaPreview = function() {
    return window.PreviewModalView.showAreaPreview();
};

window._zoomMitsukeImg = function(src, title) {
    return window.PreviewModalView.zoomMitsukeImg(src, title);
};

if (window.ServiceContainer) {
    window.ServiceContainer.register('PreviewModalView', window.PreviewModalView);
}
