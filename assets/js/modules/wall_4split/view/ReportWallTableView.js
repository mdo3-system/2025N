/**
 * view/ReportWallTableView.js - 床面積・求積・壁量計算テーブルHTML生成モジュール
 * v3.4.0 Refactoring: Single Responsibility Principle (SRP)
 */

window.ReportWallTableView = {
    /**
     * 各階の床面積・求積一覧表HTMLを生成
     * @param {Object} state - AppStateへの参照
     * @returns {string} HTMLマークアップ
     */
    generateFloorAreaTableHtml: function(state) {
        const s = state || window.AppState;
        const areaLines = s.areaLines || [];
        let html = '';
        
        ['1F', '2F', 'RF'].forEach(f => {
            const fAreas = areaLines.filter(a => a.floor === f);
            if (fAreas.length === 0) return;
            
            html += `<div style="margin-top: 15px; margin-bottom: 25px;">
                <div style="background:#27ae60; color:#fff; padding:6px 12px; font-weight:bold; font-size:13px; border-radius:4px 4px 0 0; display:flex; justify-content:space-between; align-items:center;">
                    <span>🏢 ${f} 床面積 求積一覧表</span>
                </div>
                <table class="report-table" style="font-size:11px; width:100%; text-align:center; border: 1px solid #ddd; border-top:none;">
                    <tr style="background:#f8f9fa; font-weight:bold;">
                        <th style="width:8%;">No.</th>
                        <th style="width:15%;">用途・区分</th>
                        <th style="width:12%;">底辺(m)</th>
                        <th style="width:12%;">高さ(m)</th>
                        <th style="border-right:1px solid #ddd; text-align:center;">計算式</th>
                        <th style="width:15%;">面積(㎡)</th>
                    </tr>`;
            
            let totalA = 0;
            fAreas.forEach((area, i) => {
                const cleanVertices = window.MathUtils && window.MathUtils.dedupPolygon ? window.MathUtils.dedupPolygon(area.vertices) : area.vertices;
                const vCount = cleanVertices ? cleanVertices.length : 0;
                if (!cleanVertices || vCount < 3) return;

                const c = Geometry.polygonCentroid(area.vertices);
                if (!c) return;
                const MathAbsArea = Math.abs(c.area / 1000000);
                const sign = (c.area / 1000000) > 0 ? 1 : -1;
                const areaVal = sign * MathAbsArea;
                totalA += areaVal;
                
                const typeName = { attic: '小屋裏', balcony: 'バルコニー', void: '吹き抜け', porch: 'ポーチ・屋根' }[area.areaType] || '床面積';
                
                if (vCount === 3 || vCount === 4) {
                    const minX = Math.min(...cleanVertices.map(v => v.x)), maxX = Math.max(...cleanVertices.map(v => v.x));
                    const minY = Math.min(...cleanVertices.map(v => v.y)), maxY = Math.max(...cleanVertices.map(v => v.y));
                    const w = (maxX - minX) / 1000, h_dim = (maxY - minY) / 1000;
                    
                    const formula = vCount === 3 ? `${sign < 0 ? '-' : ''}底辺 × 高さ / 2` : `${sign < 0 ? '-' : ''}底辺 × 高さ`;
                    html += `<tr>
                        <td>${i + 1}${sign < 0 ? ' (除外)' : ''}</td>
                        <td><b>${typeName}</b></td>
                        <td>${w.toFixed(3)}</td>
                        <td>${h_dim.toFixed(3)}</td>
                        <td style="text-align:left; padding-left:10px;">${formula}</td>
                        <td style="font-weight:bold;">${areaVal.toFixed(2)}</td>
                    </tr>`;
                } else {
                    const triangulate = window.triangulatePolygon || function() { return []; };
                    const triangles = triangulate(cleanVertices);
                    triangles.forEach((tri, subIdx) => {
                        const tc = Geometry.polygonCentroid(tri);
                        if (!tc) return;
                        const subAreaVal = Math.abs(tc.area / 1000000);
                        const minX = Math.min(...tri.map(v => v.x)), maxX = Math.max(...tri.map(v => v.x));
                        const minY = Math.min(...tri.map(v => v.y)), maxY = Math.max(...tri.map(v => v.y));
                        const w = (maxX - minX) / 1000, h_dim = (maxY - minY) / 1000;
                        
                        const formula = `${sign < 0 ? '-' : ''}底辺 × 高さ / 2 (三角形分割)`;
                        const subVal = sign * subAreaVal;
                        
                        html += `<tr>
                            <td>${i + 1}-${subIdx + 1}${sign < 0 ? ' (除外)' : ''}</td>
                            <td><b>${typeName}</b></td>
                            <td>${w.toFixed(3)}</td>
                            <td>${h_dim.toFixed(3)}</td>
                            <td style="text-align:left; padding-left:10px;">${formula}</td>
                            <td>${subVal.toFixed(2)}</td>
                        </tr>`;
                    });
                }
            });
            
            html += `<tr style="font-weight:bold; background:#e8f8f0;">
                <td colspan="5" style="text-align:right; padding-right:15px; font-size:12px;">${f} 合計床面積：</td>
                <td style="color:#d35400; font-size:13px;">${totalA.toFixed(2)} ㎡</td>
            </tr>
            </table>
            </div>`;
        });
        
        return html;
    }
};

// Register with ServiceContainer
if (window.ServiceContainer) {
    window.ServiceContainer.register('ReportWallTableView', window.ReportWallTableView);
}

// Backward compatibility alias
window.generateFloorAreaTableHtml = function(state) {
    return window.ReportWallTableView.generateFloorAreaTableHtml(state);
};
