// ============================================
// THREE.JS SCENE - 3D Model with Dithering Shader
// ============================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('three-container');

    if (!container) return;

    // ============================================
    // SCENE SETUP
    // ============================================
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.z = 7;

    // Create canvas and pass to Three.js to avoid multiple context creation
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: false,
            alpha: true
        });
    } catch (e) {
        console.warn('WebGL not available:', e.message);
        canvas.remove();
        container.classList.add('webgl-fallback');
        return;
    }

    // Verify context is usable
    const gl = renderer.getContext();
    if (!gl || gl.isContextLost()) {
        console.warn('WebGL context not usable.');
        canvas.remove();
        renderer.dispose();
        container.classList.add('webgl-fallback');
        return;
    }

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    let contextLost = false;

    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        contextLost = true;
        console.warn('WebGL context lost. Waiting for restore...');
    });

    canvas.addEventListener('webglcontextrestored', () => {
        contextLost = false;
        console.log('WebGL context restored.');
    });

    // ============================================
    // DITHERING SHADER
    // ============================================
    const ditheringShader = {
        uniforms: {
            time: { value: 0 },
            resolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) },
            color1: { value: new THREE.Color(0xE63946) }, // Red
            color2: { value: new THREE.Color(0x0A0A0A) }, // Black
            color3: { value: new THREE.Color(0xF5F5F0) }, // White
            ditherScale: { value: 8.0 },
            animationSpeed: { value: 0.2 }
        },

        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            varying vec3 vNormal;
            uniform float time;

            void main() {
                vUv = uv;
                vPosition = position;
                vNormal = normalize(normalMatrix * normal);

                // Subtle vertex animation
                vec3 pos = position;
                pos += normal * sin(time * 0.5 + position.y * 2.0) * 0.05;

                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,

        fragmentShader: `
            uniform float time;
            uniform vec2 resolution;
            uniform vec3 color1;
            uniform vec3 color2;
            uniform vec3 color3;
            uniform float ditherScale;
            uniform float animationSpeed;

            varying vec2 vUv;
            varying vec3 vPosition;
            varying vec3 vNormal;

            // 2x2 Bayer value: M2 = [[0,2],[3,1]], computed as 3r + 2c - 4rc
            float m2(float r, float c) {
                return 3.0 * r + 2.0 * c - 4.0 * r * c;
            }

            // 4x4 Bayer matrix via recursive decomposition (no array indexing for mobile GPU compatibility)
            float dither4x4(vec2 position, float brightness) {
                float fx = floor(mod(position.x, 4.0));
                float fy = floor(mod(position.y, 4.0));
                float x0 = mod(fx, 2.0);
                float x1 = mod(floor(fx * 0.5), 2.0);
                float y0 = mod(fy, 2.0);
                float y1 = mod(floor(fy * 0.5), 2.0);
                float threshold = (4.0 * m2(y0, x0) + m2(y1, x1)) / 16.0;
                return brightness < threshold ? 0.0 : 1.0;
            }

            void main() {
                // Calculate lighting
                vec3 light = normalize(vec3(1.0, 1.0, 1.0));
                float diffuse = max(dot(vNormal, light), 0.0);

                // Add time-based animation
                float animated = sin(time * animationSpeed + vPosition.y * 2.0) * 0.5 + 0.5;

                // Combine lighting and animation
                float brightness = (diffuse * 0.7 + animated * 0.3);

                // Apply dithering
                vec2 ditherCoord = gl_FragCoord.xy / ditherScale;
                float dithered = dither4x4(ditherCoord, brightness);

                // Color mixing based on dithering and brightness
                vec3 finalColor;
                if (brightness > 0.66) {
                    finalColor = mix(color1, color3, dithered); // Red to White
                } else if (brightness > 0.33) {
                    finalColor = mix(color2, color1, dithered); // Black to Red
                } else {
                    finalColor = mix(color2, color2, dithered); // Black
                }

                // Add edge glow
                float edge = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
                finalColor += color1 * edge * 0.3;

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `
    };

    const material = new THREE.ShaderMaterial({
        uniforms: ditheringShader.uniforms,
        vertexShader: ditheringShader.vertexShader,
        fragmentShader: ditheringShader.fragmentShader,
        side: THREE.DoubleSide
    });

    // ============================================
    // LOAD GLB MODEL
    // ============================================
    let model = null;

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/libs/draco/gltf/');
    dracoLoader.setDecoderConfig({ type: 'js' });

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loader.load('assets/models/RotoBlackOptimized.glb', (gltf) => {
        model = gltf.scene;

        // Apply dithering shader to all meshes
        model.traverse((child) => {
            if (child.isMesh) {
                child.material = material;
            }
        });

        // Auto-fit: center and scale model to fill the view
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        model.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        const fitDistance = maxDim / (2 * Math.tan(fov / 2));
        camera.position.z = fitDistance * 1.2;
        camera.updateProjectionMatrix();

        scene.add(model);
    });

    // ============================================
    // MOUSE INTERACTION
    // ============================================
    let targetRotationX = 0;
    let targetRotationY = 0;

    container.addEventListener('mousemove', (event) => {
        const rect = container.getBoundingClientRect();
        const mouseX = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        const mouseY = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

        targetRotationY = mouseX * 0.5;
        targetRotationX = mouseY * 0.5;
    });

    // ============================================
    // TOUCH INTERACTION
    // ============================================
    let touchStartX = 0;
    let touchStartY = 0;
    let touchRotationX = 0;
    let touchRotationY = 0;
    let initialPinchDist = 0;
    let initialCameraZ = 0;
    const minZoom = 0.6; // Closest zoom (multiplier of fitDistance)
    const maxZoom = 2.5; // Farthest zoom (multiplier of fitDistance)

    container.addEventListener('touchstart', (event) => {
        if (event.touches.length === 1) {
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
        } else if (event.touches.length === 2) {
            initialPinchDist = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY
            );
            initialCameraZ = camera.position.z;
        }
    }, { passive: true });

    container.addEventListener('touchmove', (event) => {
        event.preventDefault();
        if (event.touches.length === 1) {
            const deltaX = event.touches[0].clientX - touchStartX;
            const deltaY = event.touches[0].clientY - touchStartY;

            touchRotationY += deltaX * 0.005;
            touchRotationX += deltaY * 0.005;

            targetRotationY = touchRotationY;
            targetRotationX = touchRotationX;

            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
        } else if (event.touches.length === 2 && initialPinchDist > 0) {
            const currentDist = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY
            );
            const scale = initialPinchDist / currentDist;
            const fitDistance = initialCameraZ;
            camera.position.z = Math.max(
                fitDistance * minZoom,
                Math.min(fitDistance * maxZoom, initialCameraZ * scale)
            );
        }
    }, { passive: false });

    // ============================================
    // ANIMATION LOOP
    // ============================================
    function animate() {
        requestAnimationFrame(animate);

        if (contextLost) return;

        // Update time uniform
        ditheringShader.uniforms.time.value += 0.01;

        // Smooth rotation with input influence
        if (model) {
            model.rotation.x += (targetRotationX - model.rotation.x) * 0.05;
            model.rotation.y += (targetRotationY - model.rotation.y) * 0.05;

            // Continuous slow rotation (adds to target so touch/mouse can override)
            targetRotationX += 0.002;
            targetRotationY += 0.003;
        }

        renderer.render(scene, camera);
    }

    animate();

    // ============================================
    // RESPONSIVE HANDLING
    // ============================================
    function onWindowResize() {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        ditheringShader.uniforms.resolution.value.set(
            container.clientWidth,
            container.clientHeight
        );
    }

    window.addEventListener('resize', onWindowResize);

    // ============================================
    // CLEANUP
    // ============================================
    window.addEventListener('beforeunload', () => {
        material.dispose();
        renderer.dispose();
    });
});
