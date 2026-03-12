// ============================================
// THREE.JS PORTRAIT SCENE - Dithered 3D Portrait
// Converts the headshot to a depth-displaced mesh
// and renders it with the same Bayer-dithering shader
// used by the hero section in three-scene.js
// ============================================

import * as THREE from 'three';

// Portrait image used both for displacement and as the shader texture
const PORTRAIT_SRC = 'assets/images/profile/headshot.png';

// Approximate one frame at 60 fps (used as time uniform increment)
const TIME_STEP = 1 / 60;

// Maximum init-polling frames before giving up (~5 s at 60 fps)
const MAX_INIT_RETRIES = 300;

document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('portrait-container');
    if (!container) return;

    // Defer init until container has layout dimensions
    let retries = 0;
    requestAnimationFrame(function init() {
        if (container.clientWidth === 0 || container.clientHeight === 0) {
            if (++retries >= MAX_INIT_RETRIES) {
                console.warn('portrait-scene: container never received layout dimensions.');
                return;
            }
            requestAnimationFrame(init);
            return;
        }
        _init();
    });

    function _init() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const canvasAspect = w / h;

        const scene = new THREE.Scene();

        // PerspectiveCamera positioned so the plane fills the vertical FOV exactly
        const fov = 45;
        const fovRad = fov * Math.PI / 180;
        const planeH = 2;
        const planeW = planeH * canvasAspect;
        const camDist = (planeH / 2) / Math.tan(fovRad / 2);

        const camera = new THREE.PerspectiveCamera(fov, canvasAspect, 0.1, 100);
        camera.position.z = camDist;

        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
        } catch (e) {
            console.warn('WebGL not available:', e.message);
            canvas.remove();
            container.classList.add('webgl-fallback');
            return;
        }

        // Use the page's background colour so the canvas blends seamlessly
        const pageBackground = getComputedStyle(document.body).backgroundColor || '#ffffff';
        renderer.setClearColor(pageBackground, 1);
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const gl = renderer.getContext();
        if (!gl || gl.isContextLost()) {
            console.warn('WebGL context not usable.');
            renderer.domElement.remove();
            renderer.dispose();
            container.classList.add('webgl-fallback');
            return;
        }

        let contextLost = false;
        canvas.addEventListener('webglcontextlost', e => {
            e.preventDefault();
            contextLost = true;
            console.warn('WebGL context lost.');
        });
        canvas.addEventListener('webglcontextrestored', () => {
            contextLost = false;
            console.log('WebGL context restored.');
        });

        // ============================================
        // PORTRAIT DITHERING SHADER
        // Identical Bayer-matrix logic to three-scene.js,
        // adapted to sample from a 2-D portrait texture
        // instead of lit geometry normals.
        // ============================================
        const portraitShader = {
            uniforms: {
                time:            { value: 0 },
                portraitTexture: { value: null },
                resolution:      { value: new THREE.Vector2(w, h) },
                color1:          { value: new THREE.Color(0x2563EB) }, // Blue  (accent)
                color2:          { value: new THREE.Color(0xFFFFFF) }, // White (highlights)
                color3:          { value: new THREE.Color(0x0A0A0A) }, // Black (shadows)
                ditherScale:     { value: 4.0 },
                imageAspect:     { value: 1.0 },   // updated after image loads
                canvasAspect:    { value: canvasAspect },
                animationSpeed:  { value: 0.2 }
            },

            vertexShader: `
                uniform float time;
                uniform float animationSpeed;
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vPosition;

                void main() {
                    vUv = uv;
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = position;

                    // Subtle breathing animation matching hero model
                    vec3 pos = position;
                    pos += normal * sin(time * animationSpeed + position.y * 2.0) * 0.015;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,

            fragmentShader: `
                uniform float time;
                uniform sampler2D portraitTexture;
                uniform vec2 resolution;
                uniform vec3 color1;
                uniform vec3 color2;
                uniform vec3 color3;
                uniform float ditherScale;
                uniform float imageAspect;
                uniform float canvasAspect;
                uniform float animationSpeed;

                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vPosition;

                // 2x2 Bayer value: M2 = [[0,2],[3,1]], computed as 3r + 2c - 4rc
                float m2(float r, float c) {
                    return 3.0 * r + 2.0 * c - 4.0 * r * c;
                }

                // 4x4 Bayer matrix via recursive decomposition (mobile GPU compatible)
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
                    // UV correction — "cover" fit identical to CSS object-fit: cover
                    vec2 uv = vUv;
                    if (imageAspect >= canvasAspect) {
                        // Image wider: fit to height, crop sides
                        float scale = canvasAspect / imageAspect;
                        uv.x = (uv.x - 0.5) * scale + 0.5;
                    } else {
                        // Image taller: fit to width, crop top/bottom
                        float scale = imageAspect / canvasAspect;
                        uv.y = (uv.y - 0.5) * scale + 0.5;
                    }
                    uv = clamp(uv, 0.0, 1.0);

                    // Sample portrait texture
                    vec4 texColor = texture2D(portraitTexture, uv);

                    // Luminance from portrait texture
                    float texBrightness = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));

                    // Normal-based diffuse lighting from the depth-displaced geometry
                    vec3 light = normalize(vec3(1.0, 1.0, 1.0));
                    float diffuse = max(dot(vNormal, light), 0.0);

                    // Animated shimmer combining texture and 3-D lighting (matches hero shader)
                    float animated = sin(time * animationSpeed + vPosition.y * 2.0) * 0.5 + 0.5;
                    float brightness = texBrightness * 0.7 + diffuse * 0.2 + animated * 0.1;
                    brightness = clamp(brightness, 0.0, 1.0);

                    // 4x4 Bayer dithering using screen-space coordinates
                    vec2 ditherCoord = gl_FragCoord.xy / ditherScale;
                    float dithered = dither4x4(ditherCoord, brightness);

                    // Three-tone colour mapping: Blue / White / Black portfolio palette
                    vec3 finalColor;
                    if (brightness > 0.66) {
                        finalColor = mix(color1, color2, dithered); // Blue → White (highlights)
                    } else if (brightness > 0.33) {
                        finalColor = mix(color3, color1, dithered); // Black → Blue (midtones)
                    } else {
                        finalColor = color3;                         // Black (deep shadows)
                    }

                    // Edge glow matching three-scene.js hero shader
                    float edge = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
                    finalColor += color1 * edge * 0.3;

                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `
        };

        const material = new THREE.ShaderMaterial({
            uniforms: portraitShader.uniforms,
            vertexShader: portraitShader.vertexShader,
            fragmentShader: portraitShader.fragmentShader
        });

        let plane = null;

        // ============================================
        // LOAD PORTRAIT IMAGE & BUILD DISPLACED GEOMETRY
        // Luminance of each pixel drives the Z offset so
        // bright areas protrude and shadows recede,
        // creating genuine 3-D depth visible on mouse rotation.
        // ============================================
        const img = new Image();
        img.onload = () => {
            const imgAspect = img.width / img.height;
            portraitShader.uniforms.imageAspect.value = imgAspect;

            // Load full-resolution texture for shader rendering
            const textureLoader = new THREE.TextureLoader();
            const portraitTexture = textureLoader.load(PORTRAIT_SRC);
            portraitTexture.minFilter = THREE.LinearFilter;
            portraitTexture.magFilter = THREE.LinearFilter;
            portraitShader.uniforms.portraitTexture.value = portraitTexture;

            // Downsample image to 128×128 for smooth displacement sampling
            const dispW = 128;
            const dispH = 128;
            const offscreen = document.createElement('canvas');
            offscreen.width  = dispW;
            offscreen.height = dispH;
            const ctx = offscreen.getContext('2d');
            ctx.drawImage(img, 0, 0, dispW, dispH);
            const imageData = ctx.getImageData(0, 0, dispW, dispH);

            // 128×128 subdivided plane — enough detail to capture facial contours
            const segments = 128;
            const geometry = new THREE.PlaneGeometry(planeW, planeH, segments, segments);
            const positions = geometry.attributes.position;
            const uvAttr    = geometry.attributes.uv;

            const depthScale = 0.3; // Maximum Z displacement (30% of half-height)

            for (let i = 0; i < positions.count; i++) {
                const u = uvAttr.getX(i);
                const v = uvAttr.getY(i);

                // Apply the same "cover" UV correction used in the fragment shader
                let su = u, sv = v;
                if (imgAspect >= canvasAspect) {
                    const scale = canvasAspect / imgAspect;
                    su = (u - 0.5) * scale + 0.5;
                } else {
                    const scale = imgAspect / canvasAspect;
                    sv = (v - 0.5) * scale + 0.5;
                }
                su = Math.max(0, Math.min(1, su));
                sv = Math.max(0, Math.min(1, sv));

                // Sample displacement map (image pixels are stored top-to-bottom, UV is bottom-to-top)
                const px  = Math.floor(su * (dispW - 1));
                const py  = Math.floor((1 - sv) * (dispH - 1));
                const idx = (py * dispW + px) * 4;
                const r   = imageData.data[idx]     / 255;
                const g   = imageData.data[idx + 1] / 255;
                const b   = imageData.data[idx + 2] / 255;
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;

                // Bright pixels protrude towards the viewer
                positions.setZ(i, lum * depthScale);
            }

            positions.needsUpdate = true;
            geometry.computeVertexNormals(); // Recalculate normals after displacement

            plane = new THREE.Mesh(geometry, material);
            scene.add(plane);
        };
        img.src = PORTRAIT_SRC;

        // ============================================
        // MOUSE INTERACTION — parallax rotation
        // ============================================
        let targetRotX = 0;
        let targetRotY = 0;

        container.addEventListener('mousemove', e => {
            const rect = container.getBoundingClientRect();
            const mx = ((e.clientX - rect.left) / container.clientWidth)  * 2 - 1;
            const my = -((e.clientY - rect.top)  / container.clientHeight) * 2 + 1;
            targetRotY = mx *  0.30;
            targetRotX = my *  0.15;
        });

        container.addEventListener('mouseleave', () => {
            targetRotX = 0;
            targetRotY = 0;
        });

        // ============================================
        // TOUCH INTERACTION — matching three-scene.js
        // ============================================
        let touchStartX = 0;
        let touchStartY = 0;
        let touchBaseRotX = 0;
        let touchBaseRotY = 0;

        container.addEventListener('touchstart', e => {
            if (e.touches.length === 1) {
                touchStartX  = e.touches[0].clientX;
                touchStartY  = e.touches[0].clientY;
                touchBaseRotX = targetRotX;
                touchBaseRotY = targetRotY;
            }
        }, { passive: true });

        container.addEventListener('touchmove', e => {
            e.preventDefault();
            if (e.touches.length === 1) {
                const dx = e.touches[0].clientX - touchStartX;
                const dy = e.touches[0].clientY - touchStartY;
                targetRotY = touchBaseRotY + dx * 0.005;
                targetRotX = touchBaseRotX + dy * 0.005;
            }
        }, { passive: false });

        container.addEventListener('touchend', () => {
            targetRotX = 0;
            targetRotY = 0;
        }, { passive: true });

        // ============================================
        // ANIMATION LOOP
        // ============================================
        function animate() {
            requestAnimationFrame(animate);
            if (contextLost) return;

            portraitShader.uniforms.time.value += TIME_STEP;

            if (plane) {
                plane.rotation.x += (targetRotX - plane.rotation.x) * 0.05;
                plane.rotation.y += (targetRotY - plane.rotation.y) * 0.05;
            }

            renderer.render(scene, camera);
        }

        animate();

        // ============================================
        // RESPONSIVE HANDLING
        // ============================================
        window.addEventListener('resize', () => {
            const nw = container.clientWidth;
            const nh = container.clientHeight;
            camera.aspect = nw / nh;
            camera.updateProjectionMatrix();
            renderer.setSize(nw, nh);
            portraitShader.uniforms.resolution.value.set(nw, nh);
            portraitShader.uniforms.canvasAspect.value = nw / nh;
        });

        // ============================================
        // CLEANUP
        // ============================================
        window.addEventListener('beforeunload', () => {
            material.dispose();
            if (plane) plane.geometry.dispose();
            renderer.dispose();
        });
    }
});
