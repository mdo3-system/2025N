/**
 * logic/RoofEngine.js - Roof Geometry and Projected Area Calculation Engine
 * v2.7.0 New Implementation
 */

window.RoofEngine = {
    /**
     * Update the projected areas in AppState.config.projectedAreas based on roofFaces
     */
    updateProjectedAreas: function(state) {
        const s = state || window.AppState;
        const c = s.config;

        // 1. Initialize projected areas to wall-only projected areas
        const areas = {
            '1F': { x: 0, y: 0 },
            '2F': { x: 0, y: 0 }
        };

        // Get floor heights in meters
        const h1 = c.floorHeight1F || 2.7;
        const h2 = c.floorHeight2F || 2.7;

        // Bounding boxes in mm
        const bbox1F = this.getFloorBoundingBox('1F', s);
        const bbox2F = this.getFloorBoundingBox('2F', s);

        // Height ranges in meters for walls
        const wallH1 = Math.max(0, h1 - 1.35); // 1F wall height above 1.35m
        const wallH2 = h2;                     // 2F wall height

        // Wall projected areas (in m2)
        const wall_ax1 = ((bbox1F.maxY - bbox1F.minY) / 1000) * wallH1;
        const wall_ay1 = ((bbox1F.maxX - bbox1F.minX) / 1000) * wallH1;
        const wall_ax2 = ((bbox2F.maxY - bbox2F.minY) / 1000) * wallH2;
        const wall_ay2 = ((bbox2F.maxX - bbox2F.minX) / 1000) * wallH2;

        areas['1F'].x = wall_ax1;
        areas['1F'].y = wall_ay1;
        areas['2F'].x = wall_ax2;
        areas['2F'].y = wall_ay2;

        // 2. Add roof projected areas
        const roofFaces = s.roofFaces || [];
        roofFaces.forEach(face => {
            if (!face.vertices || face.vertices.length < 3) return;

            const floor = face.floor || '2F';
            const slope = face.slope || 0; // 寸
            const thickness = (face.roofThickness || 150) / 1000; // m
            const baseDelta = (face.baseHeightDelta || 0) / 1000; // m

            // Ceiling baseline height (桁高) in meters
            let zBase = h1;
            if (floor === '2F') {
                zBase = h1 + h2;
            }
            zBase += baseDelta;

            // Slope math
            const p1 = face.slopeLine ? face.slopeLine[0] : { x: 0, y: 0 };
            const p2 = face.slopeLine ? face.slopeLine[1] : { x: 0, y: 1000 };
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy);
            const ux = len > 0 ? dx / len : 0;
            const uy = len > 0 ? dy / len : 1;

            const slopeVal = slope / 10;
            const cosTheta = 1 / Math.sqrt(1 + slopeVal * slopeVal);
            const verticalThickness = thickness / cosTheta;

            // Calculate 3D vertices
            const pts3D = face.vertices.map(v => {
                const dist = (v.x - p1.x) * ux + (v.y - p1.y) * uy;
                const z = zBase + (dist / 1000) * slopeVal;
                return { x: v.x / 1000, y: v.y / 1000, z: z }; // in meters
            });

            // Projection YZ (X direction force receiving area)
            const ptsYZ = pts3D.map(p => ({ u: p.y, v: p.z }));
            let roof_ax = this.calculatePolygonArea2D(ptsYZ);
            
            // Add thickness projection
            const ys = pts3D.map(p => p.y);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            roof_ax += (maxY - minY) * verticalThickness;

            // Projection XZ (Y direction force receiving area)
            const ptsXZ = pts3D.map(p => ({ u: p.x, v: p.z }));
            let roof_ay = this.calculatePolygonArea2D(ptsXZ);

            // Add thickness projection
            const xs = pts3D.map(p => p.x);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            roof_ay += (maxX - minX) * verticalThickness;

            // Assign to corresponding floor
            areas[floor].x += roof_ax;
            areas[floor].y += roof_ay;
        });

        // 3. Write back to state and sync with DOM inputs (hidden or otherwise)
        c.projectedAreas['1F'].x = areas['1F'].x;
        c.projectedAreas['1F'].y = areas['1F'].y;
        c.projectedAreas['2F'].x = areas['2F'].x;
        c.projectedAreas['2F'].y = areas['2F'].y;

        this.syncToDOM(areas);
    },

    /**
     * Get floor bounding box in mm
     */
    getFloorBoundingBox: function(floor, state) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        const areas = (state.areaLines || []).filter(a => a.floor === floor);
        areas.forEach(a => {
            if (a.vertices) {
                a.vertices.forEach(v => {
                    if (v.x < minX) minX = v.x;
                    if (v.x > maxX) maxX = v.x;
                    if (v.y < minY) minY = v.y;
                    if (v.y > maxY) maxY = v.y;
                });
            }
        });

        if (minX === Infinity) {
            const coordsX = state.gridXCoords || [];
            const coordsY = state.gridYCoords || [];
            if (coordsX.length > 0) {
                minX = Math.min(...coordsX);
                maxX = Math.max(...coordsX);
            }
            if (coordsY.length > 0) {
                minY = Math.min(...coordsY);
                maxY = Math.max(...coordsY);
            }
        }

        if (minX === Infinity) {
            return { minX: 0, maxX: 10000, minY: 0, maxY: 10000 };
        }
        return { minX, maxX, minY, maxY };
    },

    /**
     * Calculate 3D height at coordinates in mm
     */
    calculate3DHeightAtCoordinate: function(v, face) {
        const floor = face.floor || '2F';
        const slope = face.slope || 0; // 寸
        const baseDelta = face.baseHeightDelta || 0; // mm

        // Ceiling baseline height (桁高) in mm
        let zBase = 3000;
        if (floor === '2F') {
            zBase = 6000;
        }
        zBase += baseDelta;

        const p1 = face.slopeLine ? face.slopeLine[0] : { x: 0, y: 0 };
        const p2 = face.slopeLine ? face.slopeLine[1] : { x: 0, y: 1000 };
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        const ux = len > 0 ? dx / len : 0;
        const uy = len > 0 ? dy / len : 1;

        const slopeVal = slope / 10;
        const dist = (v.x - p1.x) * ux + (v.y - p1.y) * uy;
        return zBase + dist * slopeVal;
    },

    /**
     * Calculate 2D polygon area using Shoelace formula
     */
    calculatePolygonArea2D: function(vertices) {
        let area = 0;
        const n = vertices.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += vertices[i].u * vertices[j].v;
            area -= vertices[j].u * vertices[i].v;
        }
        return Math.abs(area / 2);
    },

    /**
     * Synchronize calculated values with DOM input fields (a-wx1, a-wy1, a-wx2, a-wy2)
     */
    syncToDOM: function(areas) {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = val.toFixed(2);
            }
        };
        setVal('a-wx1', areas['1F'].x);
        setVal('a-wy1', areas['1F'].y);
        setVal('a-wx2', areas['2F'].x);
        setVal('a-wy2', areas['2F'].y);
    }
};
