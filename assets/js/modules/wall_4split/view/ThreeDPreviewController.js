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
                this.initScene();
                this.showModal();
                this.updateScene();
            });
        } else {
            this.showModal();
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
        const animate = () => {
            this.animationFrameId = requestAnimationFrame(animate);
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        };
        animate();

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
            if (!face.vertices || face.vertices.length < 3) return;

            // Define base height z_base
            const zBase = (face.floor === '2F' ? 6000 : 3000) + (face.baseHeightDelta || 0);

            // Get slope reference line points
            const refP1 = face.slopeLine ? face.slopeLine[0] : face.vertices[0];
            const refP2 = face.slopeLine ? face.slopeLine[1] : { x: refP1.x, y: refP1.y + 1000 };

            const rdx = refP2.x - refP1.x;
            const rdy = refP2.y - refP1.y;
            const rlen = Math.hypot(rdx, rdy);
            const ux = rlen > 0 ? rdx / rlen : 0;
            const uy = rlen > 0 ? rdy / rlen : 1;

            const slopeVal = face.slope / 10;
            const tVertical = (face.roofThickness || 150) * Math.sqrt(1 + slopeVal * slopeVal);

            // We construct solid 3D sloped slab geometry using custom buffer vertices
            const topVertices = [];
            const bottomVertices = [];

            face.vertices.forEach(v => {
                const dist = (v.x - refP1.x) * ux + (v.y - refP1.y) * uy;
                const z = zBase + dist * slopeVal;
                
                topVertices.push(new THREE.Vector3(v.x, z, -v.y));
                bottomVertices.push(new THREE.Vector3(v.x, z - tVertical, -v.y));
            });

            // Create geometry
            const geom = new THREE.BufferGeometry();
            const positions = [];
            const indices = [];

            // We triangulate the top polygon and bottom polygon.
            // For simple convex shape drawing:
            const n = face.vertices.length;

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

        // Autofit camera lookAt to centroid of building
        if (pillars.length > 0) {
            let sumX = 0, sumY = 0;
            pillars.forEach(p => { sumX += p.x; sumY += p.y; });
            const avgX = sumX / pillars.length;
            const avgY = sumY / pillars.length;
            this.controls.target.set(avgX, 3000, -avgY);
        }
    }
};
