/**
 * view/ThreeDPreviewController.js - Real-time 3D Preview Engine (Three.js)
 * v2.7.0 New Implementation
 */

window.ThreeDPreviewController = {
    modalId: 'modal-3d-preview',
    containerId: 'three-3d-container',
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    animationFrameId: null,
    meshes: [],

    /**
     * Lazy-load Three.js and OrbitControls from CDN, then open modal
     */
    open: function() {
        if (typeof THREE === 'undefined') {
            this.loadThreeJS(() => {
                this.showModal();
                this.initScene();
                this.updateScene();
            });
        } else {
            this.showModal();
            if (this.scene) {
                this.startAnimationLoop();
            } else {
                this.initScene();
            }
            this.updateScene();
        }
    },

    loadThreeJS: function(callback) {
        // Create script tag for Three.js
        const s1 = document.createElement('script');
        s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        s1.onload = () => {
            // After Three.js loads, load OrbitControls
            const s2 = document.createElement('script');
            s2.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
            s2.onload = callback;
            document.head.appendChild(s2);
        };
        document.head.appendChild(s1);
    },

    /**
     * Show/create floating window
     */
    showModal: function() {
        let m = document.getElementById(this.modalId);
        if (!m) {
            m = document.createElement('div');
            m.id = this.modalId;
            m.style.position = 'fixed';
            m.style.zIndex = '6000';
            m.style.width = '640px';
            m.style.height = '500px';
            m.style.background = '#1a1a24';
            m.style.border = '2px solid #8e44ad';
            m.style.borderRadius = '10px';
            m.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
            m.style.display = 'flex';
            m.style.flexDirection = 'column';
            m.style.left = '100px';
            m.style.top = '100px';

            m.innerHTML = `
                <div id="three-header" style="background:#8e44ad; color:#fff; padding:10px 15px; display:flex; justify-content:space-between; align-items:center; border-radius:8px 8px 0 0; cursor:move; font-weight:bold; font-size:13px; user-select:none;">
                    <span>🔮 3D リアルタイム構造プレビュー</span>
                    <button id="btn-three-close" style="background:#c0392b; border:none; border-radius:4px; padding:4px 8px; color:#fff; cursor:pointer; font-size:12px; font-weight:bold;">✖ 閉じる</button>
                </div>
                <div id="${this.containerId}" style="flex:1; width:100%; position:relative; overflow:hidden; background:#111;"></div>
                <div style="background:#222; color:#aaa; font-size:10px; padding:6px 12px; border-radius:0 0 8px 8px; display:flex; justify-content:space-between;">
                    <span>🖱️ 左ドラッグ: 回転 | 右ドラッグ: 平行移動 | スクロール: ズーム</span>
                    <span style="color:#8e44ad; font-weight:bold; cursor:pointer;" onclick="window.ThreeDPreviewController.updateScene()">🔄 同期更新</span>
                </div>
            `;
            document.body.appendChild(m);

            // Close button
            document.getElementById('btn-three-close').onclick = () => this.close();

            // Dragging window setup
            this.setupDraggable(m, document.getElementById('three-header'));
        }
        m.style.display = 'flex';
        
        // Trigger resize to align camera
        setTimeout(() => this.onResize(), 100);
    },

    close: function() {
        const m = document.getElementById(this.modalId);
        if (m) m.style.display = 'none';
        this.stopAnimationLoop();
    },

    startAnimationLoop: function() {
        if (this.animationFrameId) return;
        const animate = () => {
            this.animationFrameId = requestAnimationFrame(animate);
            if (this.controls) this.controls.update();
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        };
        animate();
    },

    stopAnimationLoop: function() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    },

    /**
     * Setup drag handle
     */
    setupDraggable: function(el, handle) {
        let isMouseDown = false;
        let startX, startY;
        
        handle.onmousedown = (e) => {
            isMouseDown = true;
            startX = e.clientX - el.offsetLeft;
            startY = e.clientY - el.offsetTop;
            document.onmousemove = (e) => {
                if (!isMouseDown) return;
                el.style.left = (e.clientX - startX) + 'px';
                el.style.top = (e.clientY - startY) + 'px';
            };
            document.onmouseup = () => {
                isMouseDown = false;
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };
    },

    /**
     * Initialize Three.js scene, lights and camera
     */
    initScene: function() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#111116');

        // Camera
        this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 100, 100000);
        this.camera.position.set(12000, 12000, 10000);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // don't go below ground

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
        dirLight1.position.set(20000, 40000, 20000);
        this.scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
        dirLight2.position.set(-20000, 20000, -20000);
        this.scene.add(dirLight2);

        // Grid Helper (represents ground/grids)
        const gridHelper = new THREE.GridHelper(30000, 30, '#444', '#222');
        gridHelper.position.y = -5; // slightly below 0
        this.scene.add(gridHelper);

        // Start render loop
        this.startAnimationLoop();

        window.addEventListener('resize', () => this.onResize());
    },

    onResize: function() {
        const container = document.getElementById(this.containerId);
        if (!container || !this.renderer || !this.camera) return;
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    },

    /**
     * Clear and rebuild 3D meshes based on AppState
     */
    updateScene: function() {
        if (!this.scene) return;
        const state = window.AppState;
        if (!state) return;

        // Clear existing meshes
        this.meshes.forEach(m => this.scene.remove(m));
        this.meshes = [];

        // Build structural components:
        const walls = state.walls || [];
        const pillars = state.pillars || [];
        const roofFaces = state.roofFaces || [];

        // Dynamic Heights & Levels calculation
        const lvl = window.RoofEngine ? window.RoofEngine.getFloorLevels(state) : { fl1: 561, fl2: 3297, cut1: 1911, cut2: 4647 };
        const c = state.config || {};
        const baseH       = parseFloat(c.baseHeight    ?? 400);
        const basePack    = parseFloat(c.basePack       ?? 20);
        const baseSill    = parseFloat(c.baseSill       ?? 105);
        const flTk1       = parseFloat(c.floorThick1F   ?? 36);
        const flTk2       = parseFloat(c.floorThick2F   ?? 36);
        const axH1        = (parseFloat(c.floorHeight1F ?? 2.7)) * 1000; // mm
        const axH2        = (parseFloat(c.floorHeight2F ?? 2.7)) * 1000; // mm
        const maxH        = parseFloat(c.maxHeight      ?? 8000); // mm

        // 1F pillar bottom / top of sill
        const zMin1F = baseH + basePack + baseSill;
        const h1F = axH1;

        // 2F pillar bottom / top of 2F horizontal member
        const zMin2F = zMin1F + axH1;

        // Determine 2F eaves height (eavesZ2F) dynamically so that roof peak reaches maxH
        let relZMax2F = 0;
        let has2FRoof = false;

        roofFaces.forEach(face => {
            if (!face.vertices || face.floor !== '2F') return;
            has2FRoof = true;
            const slope = parseFloat(face.slope ?? 4.5);
            const slopeVal = slope / 10;
            const thickness = parseFloat(face.roofThickness ?? c.roofThickness ?? 150);
            const tVertical = thickness * Math.sqrt(1 + slopeVal * slopeVal);
            const baseDelta = parseFloat(face.baseHeightDelta ?? 0);

            let ux = 0, uy = 1;
            const pA = (face.slopeLine && face.slopeLine.length > 0) ? face.slopeLine[0] : face.vertices[0];
            if (!pA) return;
            if (face.slopeLine && face.slopeLine.length >= 3) {
                const pB = face.slopeLine[1], pC = face.slopeLine[2];
                if (pB && pC) {
                    const dx = pB.x - pA.x, dy = pB.y - pA.y;
                    let nx = -dy, ny = dx;
                    if ((nx*(pC.x-pA.x) + ny*(pC.y-pA.y)) < 0) { nx = -nx; ny = -ny; }
                    const len = Math.hypot(nx, ny);
                    ux = len > 0 ? nx/len : 0; uy = len > 0 ? ny/len : 1;
                }
            } else if (face.slopeLine && face.slopeLine.length === 2) {
                const p2 = face.slopeLine[1];
                if (p2) { const dx=p2.x-pA.x, dy=p2.y-pA.y, len=Math.hypot(dx,dy); ux=len>0?dx/len:0; uy=len>0?dy/len:1; }
            }

            face.vertices.forEach(v => {
                const dist = (v.x - pA.x)*ux + (v.y - pA.y)*uy;
                const z = dist * slopeVal + tVertical + baseDelta;
                if (z > relZMax2F) {
                    relZMax2F = z;
                }
            });
        });

        // [v3.0.10] 3Dプレビューの軒高も 2FL + 2F階高で完全同期固定化
        const eavesZ2F = zMin2F + axH2;
        const h2F = eavesZ2F - zMin2F;
        const eavesZ1F = zMin2F; // 1F roof base is 2FL

        // 1. Draw Pillars
        pillars.forEach(p => {
            if (p.isDeleted || p.isInvalidPos) return;
            const h = p.floor === '2F' ? h2F : h1F;
            const zMin = p.floor === '2F' ? zMin2F : zMin1F;
            
            const geom = new THREE.BoxGeometry(120, h, 120);
            const mat = new THREE.MeshPhongMaterial({ color: '#8e44ad', opacity: 0.8, transparent: true });
            const mesh = new THREE.Mesh(geom, mat);
            
            mesh.position.set(p.x, zMin + h/2, -p.y);
            this.scene.add(mesh);
            this.meshes.push(mesh);
        });

        // 2. Draw Walls
        walls.forEach(w => {
            if (w.isDeleted || w.isInvalidPos) return;
            const p1 = w.p1, p2 = w.p2;
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy);
            if (len < 5) return;

            const h = w.floor === '2F' ? h2F : h1F;
            const zMin = w.floor === '2F' ? zMin2F : zMin1F;
            
            const geom = new THREE.BoxGeometry(100, h, len);
            
            const factor = w.multiplier || 1.0;
            const color = factor >= 2.0 ? '#c0392b' : '#7f8c8d';

            const mat = new THREE.MeshPhongMaterial({ color: color, opacity: 0.5, transparent: true });
            const mesh = new THREE.Mesh(geom, mat);

            const angle = Math.atan2(dx, dy);
            mesh.position.set((p1.x + p2.x)/2, zMin + h/2, -(p1.y + p2.y)/2);
            mesh.rotation.y = angle;

            this.scene.add(mesh);
            this.meshes.push(mesh);
        });

        // 3. Draw 3D Roof faces
        roofFaces.forEach(face => {
            if (!face.vertices) return;
            const validVertices = face.vertices.filter(v => v && typeof v.x === 'number' && !isNaN(v.x) && typeof v.y === 'number' && !isNaN(v.y));
            if (validVertices.length < 3) return;

            const zBase = (face.floor === '2F' ? eavesZ2F : eavesZ1F) + (face.baseHeightDelta || 0);

            let ux = 0, uy = 1;
            const pA = (face.slopeLine && face.slopeLine.length > 0) ? face.slopeLine[0] : validVertices[0];
            if (!pA) return;

            if (face.slopeLine && face.slopeLine.length >= 3) {
                const pB = face.slopeLine[1];
                const pC = face.slopeLine[2];
                if (pB && pC) {
                    const dx = pB.x - pA.x;
                    const dy = pB.y - pA.y;
                    let nx = -dy;
                    let ny = dx;
                    const vx = pC.x - pA.x;
                    const vy = pC.y - pA.y;
                    const dot = nx * vx + ny * vy;
                    if (dot < 0) {
                        nx = -nx;
                        ny = -ny;
                    }
                    const len = Math.hypot(nx, ny);
                    ux = len > 0 ? nx / len : 0;
                    uy = len > 0 ? ny / len : 1;
                }
            } else if (face.slopeLine && face.slopeLine.length === 2) {
                const p2 = face.slopeLine[1];
                if (p2) {
                    const dx = p2.x - pA.x;
                    const dy = p2.y - pA.y;
                    const len = Math.hypot(dx, dy);
                    ux = len > 0 ? dx / len : 0;
                    uy = len > 0 ? dy / len : 1;
                }
            }

            const slope = face.slope !== undefined ? parseFloat(face.slope) : 4.5;
            const slopeVal = isNaN(slope) ? 0.45 : (slope / 10);
            const thickness = face.roofThickness !== undefined ? parseFloat(face.roofThickness) : 150;
            const tVertical = (isNaN(thickness) ? 150 : thickness) * Math.sqrt(1 + slopeVal * slopeVal);

            const topVertices = [];
            const bottomVertices = [];

            validVertices.forEach(v => {
                const dist = (v.x - pA.x) * ux + (v.y - pA.y) * uy;
                const zCore = zBase + dist * slopeVal;
                
                topVertices.push(new THREE.Vector3(v.x, zCore + tVertical, -v.y));
                bottomVertices.push(new THREE.Vector3(v.x, zCore, -v.y));
            });

            if (topVertices.length < 3 || bottomVertices.length < 3) return;

            const geom = new THREE.BufferGeometry();
            const positions = [];
            const indices = [];

            const n = validVertices.length;

            // Top faces (winding order clockwise)
            for (let i = 1; i < n - 1; i++) {
                positions.push(topVertices[0].x, topVertices[0].y, topVertices[0].z);
                positions.push(topVertices[i].x, topVertices[i].y, topVertices[i].z);
                positions.push(topVertices[i+1].x, topVertices[i+1].y, topVertices[i+1].z);
            }

            // Bottom faces (winding order counter-clockwise)
            for (let i = 1; i < n - 1; i++) {
                positions.push(bottomVertices[0].x, bottomVertices[0].y, bottomVertices[0].z);
                positions.push(bottomVertices[i+1].x, bottomVertices[i+1].y, bottomVertices[i+1].z);
                positions.push(bottomVertices[i].x, bottomVertices[i].y, bottomVertices[i].z);
            }

            // Side faces
            for (let i = 0; i < n; i++) {
                const next = (i + 1) % n;
                
                const t1 = topVertices[i];
                const t2 = topVertices[next];
                const b1 = bottomVertices[i];
                const b2 = bottomVertices[next];

                positions.push(t1.x, t1.y, t1.z);
                positions.push(t2.x, t2.y, t2.z);
                positions.push(b2.x, b2.y, b2.z);

                positions.push(t1.x, t1.y, t1.z);
                positions.push(b2.x, b2.y, b2.z);
                positions.push(b1.x, b1.y, b1.z);
            }

            const numVerts = positions.length / 3;
            for (let i = 0; i < numVerts; i++) {
                indices.push(i);
            }

            geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geom.setIndex(indices);
            geom.computeVertexNormals();

            const color = face.floor === '2F' ? '#2980b9' : '#e67e22';
            const mat = new THREE.MeshPhongMaterial({ 
                color: color, 
                side: THREE.DoubleSide,
                opacity: 0.9,
                transparent: true,
                shininess: 40
            });

            const mesh = new THREE.Mesh(geom, mat);
            this.scene.add(mesh);
            this.meshes.push(mesh);
        });

        // Autofit camera lookAt to centroid of building
        let sumX = 0, sumY = 0, count = 0;
        if (pillars && pillars.length > 0) {
            pillars.forEach(p => { sumX += p.x; sumY += p.y; count++; });
        }
        if (walls && walls.length > 0) {
            walls.forEach(w => {
                if (w.p1 && w.p2) {
                    sumX += (w.p1.x + w.p2.x) / 2;
                    sumY += (w.p1.y + w.p2.y) / 2;
                    count++;
                }
            });
        }
        if (roofFaces && roofFaces.length > 0) {
            roofFaces.forEach(face => {
                if (face.vertices) {
                    face.vertices.forEach(v => {
                        if (v && typeof v.x === 'number' && !isNaN(v.x) && typeof v.y === 'number' && !isNaN(v.y)) {
                            sumX += v.x;
                            sumY += v.y;
                            count++;
                        }
                    });
                }
            });
        }

        if (count > 0) {
            const avgX = sumX / count;
            const avgY = sumY / count;
            this.controls.target.set(avgX, 3500, -avgY);
        } else {
            this.controls.target.set(0, 3000, 0);
        }

        // 4. Draw 3D projected Mitsuke Planes
        if (state.config) {
            const config = state.config;
            const wallThick = config.wallThickness !== undefined ? parseFloat(config.wallThickness) : 150;
            const maxH = config.maxHeight !== undefined ? parseFloat(config.maxHeight) : 8000;

            const glTo1FFloor = zMin1F;
            const glTo2FFloor = lvl.fl2;
            const glToRoofEaves = eavesZ2F;

            // Calculate precise 3D boundary coordinates based on actual 3D components rendered
            const bbox1F = window.RoofEngine ? window.RoofEngine.getFloorBoundingBox('1F', state) : { minX: 0, maxX: 10000, minY: 0, maxY: 10000 };
            const bbox2F = window.RoofEngine ? window.RoofEngine.getFloorBoundingBox('2F', state) : { minX: 0, maxX: 10000, minY: 0, maxY: 10000 };
            const bboxAll = {
                minX: Math.min(bbox1F.minX, bbox2F.minX),
                maxX: Math.max(bbox1F.maxX, bbox2F.maxX),
                minY: Math.min(bbox1F.minY, bbox2F.minY),
                maxY: Math.max(bbox1F.maxY, bbox2F.maxY)
            };

            // Wall offset applied directly
            const wallOff = wallThick;
            const silMinX = bboxAll.minX - wallOff;
            const silMaxX = bboxAll.maxX + wallOff;
            const silMinY = bboxAll.minY - wallOff;
            const silMaxY = bboxAll.maxY + wallOff;

            const xProjX = silMinX - 3000;
            const yProjY = silMinY - 3000;

            // ==========================================
            // 4. Draw Projected Wireframes (Parallel Projection onto Mitsuke planes)
            // ==========================================
            const lineMatX = new THREE.LineBasicMaterial({ color: 0xe67e22, linewidth: 2 });
            const lineMatY = new THREE.LineBasicMaterial({ color: 0x2980b9, linewidth: 2 });

            const drawProjectedWireframe = (pts3D, dir, mat, projDepth) => {
                if (pts3D.length < 2) return;
                const projectedPts = [];
                pts3D.forEach(p => {
                    if (dir === 'X') {
                        // Project onto X-plane (Y-load projection)
                        projectedPts.push(new THREE.Vector3(projDepth, p.y, p.z));
                    } else {
                        // Project onto Z-plane (X-load projection)
                        projectedPts.push(new THREE.Vector3(p.x, p.y, projDepth));
                    }
                });
                const geom = new THREE.BufferGeometry().setFromPoints(projectedPts);
                const line = new THREE.Line(geom, mat);
                this.scene.add(line);
                this.meshes.push(line);
            };

            // Project Walls
            walls.forEach(w => {
                if (w.isDeleted || w.isInvalidPos) return;
                const h = w.floor === '2F' ? h2F : h1F;
                const zMin = w.floor === '2F' ? zMin2F : zMin1F;
                
                const pts = [
                    new THREE.Vector3(w.p1.x, zMin, -w.p1.y),
                    new THREE.Vector3(w.p2.x, zMin, -w.p2.y),
                    new THREE.Vector3(w.p2.x, zMin + h, -w.p2.y),
                    new THREE.Vector3(w.p1.x, zMin + h, -w.p1.y),
                    new THREE.Vector3(w.p1.x, zMin, -w.p1.y)
                ];
                drawProjectedWireframe(pts, 'X', lineMatX, xProjX);
                drawProjectedWireframe(pts, 'Y', lineMatY, -yProjY);
            });

            // Project Roofs
            roofFaces.forEach(face => {
                if (!face.vertices || face.vertices.length < 3) return;
                
                const zBase = (face.floor === '2F' ? eavesZ2F : eavesZ1F) + (face.baseHeightDelta || 0);
                const slope = face.slope !== undefined ? parseFloat(face.slope) : 4.5;
                const slopeVal = isNaN(slope) ? 0.45 : (slope / 10);
                const thickness = face.roofThickness !== undefined ? parseFloat(face.roofThickness) : 150;
                const tVertical = (isNaN(thickness) ? 150 : thickness) * Math.sqrt(1 + slopeVal * slopeVal);

                let ux = 0, uy = 1;
                const pA = (face.slopeLine && face.slopeLine.length > 0) ? face.slopeLine[0] : face.vertices[0];
                if (face.slopeLine && face.slopeLine.length >= 3) {
                    const pB = face.slopeLine[1], pC = face.slopeLine[2];
                    const dx = pB.x - pA.x, dy = pB.y - pA.y;
                    let nx = -dy, ny = dx;
                    const vx = pC.x - pA.x, vy = pC.y - pA.y;
                    if ((nx * vx + ny * vy) < 0) { nx = -nx; ny = -ny; }
                    const len = Math.hypot(nx, ny);
                    ux = len > 0 ? nx / len : 0; uy = len > 0 ? ny / len : 1;
                } else if (face.slopeLine && face.slopeLine.length === 2) {
                    const p2 = face.slopeLine[1];
                    const dx = p2.x - pA.x, dy = p2.y - pA.y;
                    const len = Math.hypot(dx, dy);
                    ux = len > 0 ? dx / len : 0; uy = len > 0 ? dy / len : 1;
                }

                const ptsTop = [];
                const ptsBot = [];
                face.vertices.forEach(v => {
                    const dist = (v.x - pA.x) * ux + (v.y - pA.y) * uy;
                    const zCore = zBase + dist * slopeVal;
                    ptsTop.push(new THREE.Vector3(v.x, zCore + tVertical, -v.y));
                    ptsBot.push(new THREE.Vector3(v.x, zCore, -v.y));
                });
                
                // Close loop
                ptsTop.push(ptsTop[0]);
                ptsBot.push(ptsBot[0]);

                drawProjectedWireframe(ptsTop, 'X', lineMatX, xProjX);
                drawProjectedWireframe(ptsTop, 'Y', lineMatY, -yProjY);
                drawProjectedWireframe(ptsBot, 'X', lineMatX, xProjX);
                drawProjectedWireframe(ptsBot, 'Y', lineMatY, -yProjY);
                
                // Draw connecting edges for thickness
                for (let i = 0; i < face.vertices.length; i++) {
                    const edgePts = [ptsTop[i], ptsBot[i]];
                    drawProjectedWireframe(edgePts, 'X', lineMatX, xProjX);
                    drawProjectedWireframe(edgePts, 'Y', lineMatY, -yProjY);
                }
            });

            // Draw maximum height level helper lines (Dashed lines at config.maxHeight)
            const dashedMat = new THREE.LineDashedMaterial({ color: 0xe74c3c, dashSize: 200, gapSize: 100, linewidth: 2 });
            const maxHLines = [
                [new THREE.Vector3(silMinX - 500, maxH, -yProjY), new THREE.Vector3(silMaxX + 500, maxH, -yProjY)],
                [new THREE.Vector3(xProjX, maxH, -silMinY + 500), new THREE.Vector3(xProjX, maxH, -silMaxY - 500)],
            ];
            maxHLines.forEach(pts => {
                const geom = new THREE.BufferGeometry().setFromPoints(pts);
                const line = new THREE.Line(geom, dashedMat);
                line.computeLineDistances();
                this.scene.add(line);
                this.meshes.push(line);
            });
        }
    }
};
