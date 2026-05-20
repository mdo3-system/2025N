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
        // Standard wall heights: 1F is Z = 0..3000, 2F is Z = 3000..6000
        const walls = state.walls || [];
        const pillars = state.pillars || [];
        const roofFaces = state.roofFaces || [];

        // 1. Draw Pillars
        pillars.forEach(p => {
            if (p.isDeleted || p.isInvalidPos) return;
            const h = 3000;
            const zMin = p.floor === '2F' ? 3000 : 0;
            
            const geom = new THREE.BoxGeometry(120, h, 120);
            const mat = new THREE.MeshPhongMaterial({ color: '#8e44ad', opacity: 0.8, transparent: true });
            const mesh = new THREE.Mesh(geom, mat);
            
            // Map 2D (x, y) to 3D (X, Z, -Y) because Y is up in Three.js
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

            const h = 3000;
            const zMin = w.floor === '2F' ? 3000 : 0;
            
            const geom = new THREE.BoxGeometry(100, h, len);
            
            // Slate/Beige color depending on load factor
            const factor = w.multiplier || 1.0;
            const color = factor >= 2.0 ? '#c0392b' : '#7f8c8d'; // strong wall is red, normal grey

            const mat = new THREE.MeshPhongMaterial({ color: color, opacity: 0.5, transparent: true });
            const mesh = new THREE.Mesh(geom, mat);

            // Position and rotate
            const angle = Math.atan2(dx, dy); // rotation around Y axis in Three.js
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

            // Define base height z_base
            const zBase = (face.floor === '2F' ? 6000 : 3000) + (face.baseHeightDelta || 0);

            // Get slope reference line points (3-point definition support: [0]=rafter start, [1]=rafter end, [2]=slope high point)
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

            // We construct solid 3D sloped slab geometry using custom buffer vertices
            const topVertices = [];
            const bottomVertices = [];

            validVertices.forEach(v => {
                const dist = (v.x - pA.x) * ux + (v.y - pA.y) * uy;
                const z = zBase + dist * slopeVal;
                
                topVertices.push(new THREE.Vector3(v.x, z, -v.y));
                bottomVertices.push(new THREE.Vector3(v.x, z - tVertical, -v.y));
            });

            if (topVertices.length < 3 || bottomVertices.length < 3) return;

            // Create geometry
            const geom = new THREE.BufferGeometry();
            const positions = [];
            const indices = [];

            // We triangulate the top polygon and bottom polygon.
            // For simple convex shape drawing:
            const n = validVertices.length;

            // Top faces (winding order clockwise)
            for (let i = 1; i < n - 1; i++) {
                positions.push(topVertices[0].x, topVertices[0].y, topVertices[0].z);
                positions.push(topVertices[i].x, topVertices[i].y, topVertices[i].z);
                positions.push(topVertices[i+1].x, topVertices[i+1].y, topVertices[i+1].z);
            }

            // Bottom faces (winding order counter-clockwise)
            const baseIdx = positions.length / 3;
            for (let i = 1; i < n - 1; i++) {
                positions.push(bottomVertices[0].x, bottomVertices[0].y, bottomVertices[0].z);
                positions.push(bottomVertices[i+1].x, bottomVertices[i+1].y, bottomVertices[i+1].z);
                positions.push(bottomVertices[i].x, bottomVertices[i].y, bottomVertices[i].z);
            }

            // Side faces
            const sideBaseIdx = positions.length / 3;
            for (let i = 0; i < n; i++) {
                const next = (i + 1) % n;
                
                const t1 = topVertices[i];
                const t2 = topVertices[next];
                const b1 = bottomVertices[i];
                const b2 = bottomVertices[next];

                // Side Quad Triangle 1: t1 -> t2 -> b2
                positions.push(t1.x, t1.y, t1.z);
                positions.push(t2.x, t2.y, t2.z);
                positions.push(b2.x, b2.y, b2.z);

                // Side Quad Triangle 2: t1 -> b2 -> b1
                positions.push(t1.x, t1.y, t1.z);
                positions.push(b2.x, b2.y, b2.z);
                positions.push(b1.x, b1.y, b1.z);
            }

            // Map all indices sequentially
            const numVerts = positions.length / 3;
            for (let i = 0; i < numVerts; i++) {
                indices.push(i);
            }

            geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geom.setIndex(indices);
            geom.computeVertexNormals();

            // Slate-blue color for 2F roofs, Tile-red color for 1F roofs
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

        // Autofit camera lookAt to centroid of building (pillars, walls, or roofs)
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

        // 4. Draw 3D projected Mitsuke Planes (Visual wow factor for projection bounds)
        if (state.config) {
            const config = state.config;
            const wallThick = config.wallThickness !== undefined ? parseFloat(config.wallThickness) : 150;
            const maxH = config.maxHeight !== undefined ? parseFloat(config.maxHeight) : 8000;
            const maxEavesH = config.maxEavesHeight !== undefined ? parseFloat(config.maxEavesHeight) : 6000;

            const baseH = config.baseHeight !== undefined ? parseFloat(config.baseHeight) : 400;
            const basePack = config.basePack !== undefined ? parseFloat(config.basePack) : 20;
            const baseSill = config.baseSill !== undefined ? parseFloat(config.baseSill) : 105;
            const floorThick1F = config.floorThick1F !== undefined ? parseFloat(config.floorThick1F) : 36;
            const floorThick2F = config.floorThick2F !== undefined ? parseFloat(config.floorThick2F) : 36;
            const roofThick = config.roofThickness !== undefined ? parseFloat(config.roofThickness) : 150;

            // Strict GL-relative floor levels calculation
            const glTo1FFloor = baseH + basePack + baseSill; // 1F pillar bottom / top of sill
            const glTo2FFloor = glTo1FFloor + (parseFloat(config.floorHeight1F) || 2.7) * 1000; // 2F horizontal member top
            const glToRoofEaves = glTo2FFloor + (parseFloat(config.floorHeight2F) || 2.7) * 1000; // Eaves height

            // Calculate highly precise 3D boundary coordinates based on actual 3D components rendered
            let pts3DForBBox = [];
            
            // Add pillars bounds
            pillars.forEach(p => {
                if (p.isDeleted || p.isInvalidPos) return;
                pts3DForBBox.push({ x: p.x - 60, y: p.y - 60 });
                pts3DForBBox.push({ x: p.x + 60, y: p.y + 60 });
            });
            // Add walls bounds
            walls.forEach(w => {
                if (w.isDeleted || w.isInvalidPos) return;
                pts3DForBBox.push({ x: w.p1.x, y: w.p1.y });
                pts3DForBBox.push({ x: w.p2.x, y: w.p2.y });
            });
            // Add roof vertices bounds (most accurate representation of building overhangs)
            roofFaces.forEach(face => {
                if (!face.vertices) return;
                face.vertices.forEach(v => {
                    if (v && typeof v.x === 'number' && !isNaN(v.x) && typeof v.y === 'number' && !isNaN(v.y)) {
                        pts3DForBBox.push({ x: v.x, y: v.y });
                    }
                });
            });

            // Dynamic boundary fallback logic
            let minX = 0, maxX = 10000, minY = 0, maxY = 10000;
            if (pts3DForBBox.length > 0) {
                const xs = pts3DForBBox.map(p => p.x);
                const ys = pts3DForBBox.map(p => p.y);
                minX = Math.min(...xs);
                maxX = Math.max(...xs);
                minY = Math.min(...ys);
                maxY = Math.max(...ys);
            } else {
                const bbox1F = window.RoofEngine ? window.RoofEngine.getFloorBoundingBox('1F', state) : { minX: 0, maxX: 10000, minY: 0, maxY: 10000 };
                const bbox2F = window.RoofEngine ? window.RoofEngine.getFloorBoundingBox('2F', state) : { minX: 0, maxX: 10000, minY: 0, maxY: 10000 };
                minX = Math.min(bbox1F.minX, bbox2F.minX);
                maxX = Math.max(bbox1F.maxX, bbox2F.maxX);
                minY = Math.min(bbox1F.minY, bbox2F.minY);
                maxY = Math.max(bbox1F.maxY, bbox2F.maxY);
            }

            // Apply wall thickness offsets to silhouette bounds (safety side calculation)
            const wallOff = wallThick / 2;
            const silMinX = minX - wallOff;
            const silMaxX = maxX + wallOff;
            const silMinY = minY - wallOff;
            const silMaxY = maxY + wallOff;

            // Real-time Scanline Elevation Profiler to reconstruct exact projected silhouette
            const getScanlineProfile = (direction, minU, maxU) => {
                const steps = 100; // high fidelity split
                const profile = [];
                const stepSize = (maxU - minU) / steps;

                for (let i = 0; i <= steps; i++) {
                    const u = minU + i * stepSize;
                    let maxZ = 0;

                    // 1. Pillars contribution (relative to GL floor levels)
                    pillars.forEach(p => {
                        if (p.isDeleted || p.isInvalidPos) return;
                        const pU = (direction === 'X') ? p.y : p.x;
                        const pZ = (p.floor === '2F' ? glToRoofEaves : glTo2FFloor);
                        if (Math.abs(pU - u) <= (60 + wallOff)) {
                            if (pZ > maxZ) maxZ = pZ;
                        }
                    });

                    // 2. Walls contribution (relative to GL floor levels)
                    walls.forEach(w => {
                        if (w.isDeleted || w.isInvalidPos) return;
                        const u1 = (direction === 'X') ? w.p1.y : w.p1.x;
                        const u2 = (direction === 'X') ? w.p2.y : w.p2.x;
                        const wZ = (w.floor === '2F' ? glToRoofEaves : glTo2FFloor);
                        const minW = Math.min(u1, u2);
                        const maxW = Math.max(u1, u2);
                        if (u >= minW - wallOff && u <= maxW + wallOff) {
                            if (wZ > maxZ) maxZ = wZ;
                        }
                    });

                    // 3. Sloped Roof faces contribution (exact geometric interpolation + roofThickness)
                    roofFaces.forEach(face => {
                        if (!face.vertices) return;
                        const uCoords = face.vertices.map(v => (direction === 'X') ? v.y : v.x);
                        const minRoofU = Math.min(...uCoords);
                        const maxRoofU = Math.max(...uCoords);

                        if (u >= minRoofU - 10 && u <= maxRoofU + 10) {
                            const zBase = (face.floor === '2F' ? glToRoofEaves : glTo2FFloor) + (face.baseHeightDelta || 0);
                            
                            let ux = 0, uy = 1;
                            const pA = (face.slopeLine && face.slopeLine.length > 0) ? face.slopeLine[0] : face.vertices[0];
                            if (!pA) return;

                            if (face.slopeLine && face.slopeLine.length >= 3) {
                                const pB = face.slopeLine[1];
                                const pC = face.slopeLine[2];
                                if (pB && pC) {
                                    const dx = pB.x - pA.x;
                                    const dy = pB.y - pA.y;
                                    let nx = -dy; let ny = dx;
                                    const vx = pC.x - pA.x; const vy = pC.y - pA.y;
                                    const dot = nx * vx + ny * vy;
                                    if (dot < 0) { nx = -nx; ny = -ny; }
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

                            let roofZCandidates = [];
                            const numV = face.vertices.length;

                            // Calculate intersection with the scanline plane
                            for (let j = 0; j < numV; j++) {
                                const v1 = face.vertices[j];
                                const v2 = face.vertices[(j + 1) % numV];
                                if (!v1 || !v2) continue;
                                const val1 = (direction === 'X') ? v1.y : v1.x;
                                const val2 = (direction === 'X') ? v2.y : v2.x;

                                if ((val1 <= u && val2 >= u) || (val2 <= u && val1 >= u)) {
                                    let t = 0.5;
                                    if (Math.abs(val2 - val1) > 0.01) {
                                        t = (u - val1) / (val2 - val1);
                                    }
                                    const intersectX = v1.x + t * (v2.x - v1.x);
                                    const intersectY = v1.y + t * (v2.y - v1.y);

                                    const dist = (intersectX - pA.x) * ux + (intersectY - pA.y) * uy;
                                    // Add sloped thickness (safety thickness representation)
                                    const z = zBase + dist * slopeVal + roofThick;
                                    roofZCandidates.push(z);
                                }
                            }

                            if (roofZCandidates.length === 0) {
                                face.vertices.forEach(v => {
                                    const val = (direction === 'X') ? v.y : v.x;
                                    if (Math.abs(val - u) <= stepSize) {
                                        const dist = (v.x - pA.x) * ux + (v.y - pA.y) * uy;
                                        const z = zBase + dist * slopeVal + roofThick;
                                        roofZCandidates.push(z);
                                    }
                                });
                            }

                            if (roofZCandidates.length > 0) {
                                const maxRoofZ = Math.max(...roofZCandidates);
                                if (maxRoofZ > maxZ) maxZ = maxRoofZ;
                            }
                        }
                    });

                    profile.push({ u: u, z: maxZ });
                }
                return profile;
            };

            // Generate Scanline Profiles using safety offset bounds
            const profileX = getScanlineProfile('X', silMinY, silMaxY);
            const profileY = getScanlineProfile('Y', silMinX, silMaxX);

            // Exactly locate the real peak ridge (highest sampled roof vertex)
            let peakX = (silMinX + silMaxX) / 2;
            let peakY = (silMinY + silMaxY) / 2;
            let bestZ_X = 0;
            profileY.forEach(p => {
                if (p.z > bestZ_X) {
                    bestZ_X = p.z;
                    peakX = p.u;
                }
            });
            let bestZ_Y = 0;
            profileX.forEach(p => {
                if (p.z > bestZ_Y) {
                    bestZ_Y = p.z;
                    peakY = p.u;
                }
            });

            const actualMaxH = Math.max(bestZ_X, bestZ_Y, glToRoofEaves);

            const xProjX = silMinX - 3000;
            const yProjY = silMinY - 3000;

            const planeMatX = new THREE.MeshBasicMaterial({ color: 0xe67e22, side: THREE.DoubleSide, transparent: true, opacity: 0.2 });
            const planeMatY = new THREE.MeshBasicMaterial({ color: 0x2980b9, side: THREE.DoubleSide, transparent: true, opacity: 0.2 });
            
            const lineMatX = new THREE.LineBasicMaterial({ color: 0xe67e22, linewidth: 2 });
            const lineMatY = new THREE.LineBasicMaterial({ color: 0x2980b9, linewidth: 2 });

            // --- Draw X-direction Mitsuke Silhouette (Y-direction Projection) ---
            const silVertsX = [];
            silVertsX.push(new THREE.Vector3(xProjX, 0, -silMinY)); // GL Start Left
            profileX.forEach(p => {
                silVertsX.push(new THREE.Vector3(xProjX, p.z, -p.u)); // Profile Points
            });
            silVertsX.push(new THREE.Vector3(xProjX, 0, -silMaxY)); // GL End Right

            const geomX = new THREE.BufferGeometry();
            const posX = [];
            silVertsX.forEach(v => posX.push(v.x, v.y, v.z));
            geomX.setAttribute('position', new THREE.Float32BufferAttribute(posX, 3));
            
            // Reconstruct precise triangulation index using Triangle Fan matching the profile
            const idxX = [];
            const numVertsX = silVertsX.length;
            for (let i = 1; i < numVertsX - 1; i++) {
                idxX.push(0, i, i + 1);
            }
            geomX.setIndex(idxX);
            
            const meshX = new THREE.Mesh(geomX, planeMatX);
            this.scene.add(meshX);
            this.meshes.push(meshX);

            const lineGeomX = new THREE.BufferGeometry().setFromPoints(silVertsX);
            const lineX = new THREE.Line(lineGeomX, lineMatX);
            this.scene.add(lineX);
            this.meshes.push(lineX);

            // --- Draw Y-direction Mitsuke Silhouette (X-direction Projection) ---
            const silVertsY = [];
            silVertsY.push(new THREE.Vector3(silMinX, 0, -yProjY)); // GL Start Left
            profileY.forEach(p => {
                silVertsY.push(new THREE.Vector3(p.u, p.z, -yProjY)); // Profile Points
            });
            silVertsY.push(new THREE.Vector3(silMaxX, 0, -yProjY)); // GL End Right

            const geomY = new THREE.BufferGeometry();
            const posY = [];
            silVertsY.forEach(v => posY.push(v.x, v.y, v.z));
            geomY.setAttribute('position', new THREE.Float32BufferAttribute(posY, 3));
            
            const idxY = [];
            const numVertsY = silVertsY.length;
            for (let i = 1; i < numVertsY - 1; i++) {
                idxY.push(0, i, i + 1);
            }
            geomY.setIndex(idxY);
            
            const meshY = new THREE.Mesh(geomY, planeMatY);
            this.scene.add(meshY);
            this.meshes.push(meshY);

            const lineGeomY = new THREE.BufferGeometry().setFromPoints(silVertsY);
            const lineY = new THREE.Line(lineGeomY, lineMatY);
            this.scene.add(lineY);
            this.meshes.push(lineY);

            // Draw Projection Rays (Dashed lines to exact peak ridge and boundaries)
            const rayMat = new THREE.LineDashedMaterial({ color: 0x7f8c8d, dashSize: 200, gapSize: 100 });
            const rayPoints = [
                new THREE.Vector3(peakX, actualMaxH, -peakY), new THREE.Vector3(xProjX, actualMaxH, -peakY),
                new THREE.Vector3(peakX, actualMaxH, -peakY), new THREE.Vector3(peakX, actualMaxH, -yProjY),
                new THREE.Vector3(silMaxX, 0, -silMaxY), new THREE.Vector3(xProjX, 0, -silMaxY),
                new THREE.Vector3(silMaxX, 0, -yProjY), new THREE.Vector3(silMaxX, 0, -silMaxY)
            ];

            for (let i = 0; i < rayPoints.length; i += 2) {
                const rayGeom = new THREE.BufferGeometry().setFromPoints([rayPoints[i], rayPoints[i+1]]);
                const rayLine = new THREE.Line(rayGeom, rayMat);
                rayLine.computeLineDistances();
                this.scene.add(rayLine);
                this.meshes.push(rayLine);
            }
        }
    }
};
