// ============================================
// PRODUCT EXPLODED VIEW - On Scroll Animation
// ============================================

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/OBJLoader.js';

class ProductExploder {
    constructor(containerId, modelPath, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.modelPath = modelPath;
        this.options = {
            explodeDistance: options.explodeDistance || 2.0,
            animationDuration: options.animationDuration || 2000,
            autoRotate: options.autoRotate !== false,
            dithering: options.dithering !== false,
            backgroundColor: options.backgroundColor || 0x0A0A0A,
            ...options
        };

        this.parts = [];
        this.originalPositions = [];
        this.isExploded = false;
        this.animationProgress = 0;

        this.init();
    }

    init() {
        this.setupScene();
        this.setupLights();
        this.loadModel();
        this.setupScrollTrigger();
        this.animate();
    }

    setupScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.options.backgroundColor);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            45,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(5, 5, 5);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Handle resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // Directional lights for better definition
        const light1 = new THREE.DirectionalLight(0xffffff, 0.8);
        light1.position.set(5, 5, 5);
        this.scene.add(light1);

        const light2 = new THREE.DirectionalLight(0xE63946, 0.3);
        light2.position.set(-5, 3, -5);
        this.scene.add(light2);
    }

    createDitheringMaterial(color = 0xE63946) {
        return new THREE.ShaderMaterial({
            uniforms: {
                color1: { value: new THREE.Color(color) },
                color2: { value: new THREE.Color(0x0A0A0A) },
                color3: { value: new THREE.Color(0xF5F5F0) },
                ditherScale: { value: 8.0 },
                lightDirection: { value: new THREE.Vector3(1, 1, 1).normalize() }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;

                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color1;
                uniform vec3 color2;
                uniform vec3 color3;
                uniform float ditherScale;
                uniform vec3 lightDirection;

                varying vec3 vNormal;
                varying vec3 vPosition;

                float dither4x4(vec2 position, float brightness) {
                    int x = int(mod(position.x, 4.0));
                    int y = int(mod(position.y, 4.0));

                    float bayerMatrix[16];
                    bayerMatrix[0] = 0.0; bayerMatrix[1] = 8.0; bayerMatrix[2] = 2.0; bayerMatrix[3] = 10.0;
                    bayerMatrix[4] = 12.0; bayerMatrix[5] = 4.0; bayerMatrix[6] = 14.0; bayerMatrix[7] = 6.0;
                    bayerMatrix[8] = 3.0; bayerMatrix[9] = 11.0; bayerMatrix[10] = 1.0; bayerMatrix[11] = 9.0;
                    bayerMatrix[12] = 15.0; bayerMatrix[13] = 7.0; bayerMatrix[14] = 13.0; bayerMatrix[15] = 5.0;

                    float threshold = bayerMatrix[x + y * 4] / 16.0;
                    return brightness < threshold ? 0.0 : 1.0;
                }

                void main() {
                    float diffuse = max(dot(vNormal, lightDirection), 0.0);
                    float brightness = diffuse * 0.8 + 0.2;

                    vec2 ditherCoord = gl_FragCoord.xy / ditherScale;
                    float dithered = dither4x4(ditherCoord, brightness);

                    vec3 finalColor;
                    if (brightness > 0.66) {
                        finalColor = mix(color1, color3, dithered);
                    } else if (brightness > 0.33) {
                        finalColor = mix(color2, color1, dithered);
                    } else {
                        finalColor = color2;
                    }

                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `
        });
    }

    loadModel() {
        const extension = this.modelPath.split('.').pop().toLowerCase();

        if (extension === 'gltf' || extension === 'glb') {
            this.loadGLTF();
        } else if (extension === 'stl') {
            this.loadSTL();
        } else if (extension === 'obj') {
            this.loadOBJ();
        } else {
            console.error('Unsupported file format. Use .gltf, .glb, .stl, or .obj');
        }
    }

    loadGLTF() {
        const loader = new GLTFLoader();
        loader.load(
            this.modelPath,
            (gltf) => this.onModelLoaded(gltf.scene),
            (progress) => console.log('Loading:', (progress.loaded / progress.total * 100) + '%'),
            (error) => console.error('Error loading model:', error)
        );
    }

    loadSTL() {
        const loader = new STLLoader();
        loader.load(
            this.modelPath,
            (geometry) => {
                const material = this.options.dithering
                    ? this.createDitheringMaterial()
                    : new THREE.MeshPhongMaterial({ color: 0xE63946 });

                const mesh = new THREE.Mesh(geometry, material);

                // Center the geometry
                geometry.computeBoundingBox();
                const center = new THREE.Vector3();
                geometry.boundingBox.getCenter(center);
                geometry.translate(-center.x, -center.y, -center.z);

                this.onModelLoaded(mesh);
            },
            undefined,
            (error) => console.error('Error loading STL:', error)
        );
    }

    loadOBJ() {
        const loader = new OBJLoader();
        loader.load(
            this.modelPath,
            (object) => this.onModelLoaded(object),
            (progress) => console.log('Loading:', (progress.loaded / progress.total * 100) + '%'),
            (error) => console.error('Error loading OBJ:', error)
        );
    }

    onModelLoaded(model) {
        // Apply dithering material to all meshes if enabled
        if (this.options.dithering) {
            model.traverse((child) => {
                if (child.isMesh) {
                    child.material = this.createDitheringMaterial();
                }
            });
        }

        // Store parts for explosion
        model.traverse((child) => {
            if (child.isMesh) {
                this.parts.push(child);
                this.originalPositions.push(child.position.clone());
            }
        });

        // Add to scene
        this.model = model;
        this.scene.add(model);

        // Center model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        // Adjust camera to fit model
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        this.camera.position.set(maxDim * 1.5, maxDim * 1.5, maxDim * 1.5);
        this.camera.lookAt(0, 0, 0);

        console.log(`Model loaded: ${this.parts.length} parts found`);
    }

    calculateExplodeDirection(part, index) {
        // Calculate direction from center for each part
        const center = new THREE.Vector3();

        // If model has bounding box, use its center
        if (this.model) {
            const box = new THREE.Box3().setFromObject(this.model);
            box.getCenter(center);
        }

        // Get part's world position
        const partPosition = new THREE.Vector3();
        part.getWorldPosition(partPosition);

        // Direction from center to part
        const direction = partPosition.clone().sub(center).normalize();

        // If direction is zero (part at center), use a default direction
        if (direction.length() === 0) {
            const angle = (index / this.parts.length) * Math.PI * 2;
            direction.set(Math.cos(angle), Math.sin(angle), 0);
        }

        return direction;
    }

    explode(progress) {
        // Progress from 0 to 1
        const easeProgress = this.easeInOutCubic(progress);

        this.parts.forEach((part, index) => {
            const direction = this.calculateExplodeDirection(part, index);
            const offset = direction.multiplyScalar(this.options.explodeDistance * easeProgress);

            part.position.copy(this.originalPositions[index]).add(offset);
        });
    }

    implode(progress) {
        // Progress from 1 to 0
        this.explode(1 - progress);
    }

    easeInOutCubic(t) {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    setupScrollTrigger() {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.triggerExplode();
                    } else {
                        this.triggerImplode();
                    }
                });
            },
            { threshold: 0.3 }
        );

        observer.observe(this.container);
    }

    triggerExplode() {
        if (this.isExploded) return;
        this.isExploded = true;

        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / this.options.animationDuration, 1);

            this.explode(progress);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    triggerImplode() {
        if (!this.isExploded) return;
        this.isExploded = false;

        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / this.options.animationDuration, 1);

            this.implode(progress);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Auto-rotate if enabled
        if (this.options.autoRotate && this.model) {
            this.model.rotation.y += 0.005;
        }

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
}

// ============================================
// INITIALIZE PRODUCT EXPLODED VIEWS
// ============================================

document.addEventListener('DOMContentLoaded', function() {

    // Example: Toilet Paper Holder
    const toiletHolderContainer = document.getElementById('product-explode-1');
    if (toiletHolderContainer) {
        new ProductExploder('product-explode-1', 'assets/models/toilet-holder.glb', {
            explodeDistance: 3.0,
            animationDuration: 2000,
            autoRotate: true,
            dithering: true
        });
    }

    // Example: Electric Seat Component
    const seatContainer = document.getElementById('product-explode-2');
    if (seatContainer) {
        new ProductExploder('product-explode-2', 'assets/models/electric-seat.glb', {
            explodeDistance: 2.5,
            animationDuration: 2500,
            autoRotate: true,
            dithering: true
        });
    }

    // Add more product containers as needed...
});

// Export for manual initialization
export { ProductExploder };
