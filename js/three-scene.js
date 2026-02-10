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

    const renderer = new THREE.WebGLRenderer({
        antialias: false, // Turn off for more pixelated/retro look
        alpha: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

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

            // Bayer matrix 4x4 for ordered dithering
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
    loader.load('assets/models/RotoBlackHigh.glb', (gltf) => {
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
        camera.position.z = fitDistance * 1.5;
        camera.updateProjectionMatrix();

        scene.add(model);
    });

    // ============================================
    // MOUSE INTERACTION
    // ============================================
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    container.addEventListener('mousemove', (event) => {
        const rect = container.getBoundingClientRect();
        mouseX = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        mouseY = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

        targetRotationY = mouseX * 0.5;
        targetRotationX = mouseY * 0.5;
    });

    // ============================================
    // ANIMATION LOOP
    // ============================================
    function animate() {
        requestAnimationFrame(animate);

        // Update time uniform
        ditheringShader.uniforms.time.value += 0.01;

        // Smooth rotation with mouse influence
        if (model) {
            model.rotation.x += (targetRotationX - model.rotation.x) * 0.05;
            model.rotation.y += (targetRotationY - model.rotation.y) * 0.05;

            // Continuous slow rotation
            model.rotation.x += 0.002;
            model.rotation.y += 0.003;
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
