// ============================================
// PROJECT MODEL VIEWER - Three.js GLB viewer
// with orbit controls and cross-section clipping
// ============================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Shared loader instances
var dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/libs/draco/gltf/');
dracoLoader.setDecoderConfig({ type: 'wasm' });

var gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

var viewerStates = new WeakMap();
var activeContainers = new Set();

function renderFallback(container, message) {
    container.textContent = '';
    var fallback = document.createElement('p');
    fallback.style.padding = '2rem';
    fallback.style.textAlign = 'center';
    fallback.style.color = '#666';
    fallback.textContent = message;
    container.appendChild(fallback);
}

function disposeViewer(container) {
    var state = viewerStates.get(container);
    if (!state) return;

    state.disposed = true;
    activeContainers.delete(container);
    viewerStates.delete(container);

    if (state.frameId) {
        cancelAnimationFrame(state.frameId);
    }

    if (state.resizeObserver) {
        state.resizeObserver.disconnect();
    }

    if (state.controls) {
        state.controls.dispose();
    }

    if (state.renderer) {
        state.renderer.dispose();
    }

    container.textContent = '';
}

function initModelViewer(container) {
    if (viewerStates.has(container)) return true;

    var src = container.getAttribute('data-src');
    if (!src) return false;

    container.innerHTML = '';

    var width = container.clientWidth;
    var height = container.clientHeight;
    if (width === 0 || height === 0) {
        return false;
    }

    var canvas = document.createElement('canvas');
    container.appendChild(canvas);

    var renderer;
    try {
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
    } catch (err) {
        console.warn('WebGL renderer failed to initialize:', err && err.message ? err.message : err);
        container.textContent = '';
        return false;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8eaec);

    var camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
    var controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;

    // Sky/ground hemisphere for even base lighting
    var hemiLight = new THREE.HemisphereLight(0xffffff, 0xb0b8c4, 0.9);
    scene.add(hemiLight);

    // Key light — upper front-right
    var keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(8, 12, 8);
    keyLight.castShadow = true;
    scene.add(keyLight);

    // Fill light — upper back-left
    var fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-8, 6, -4);
    scene.add(fillLight);

    // Rim light — low back for edge separation
    var rimLight = new THREE.DirectionalLight(0xffffff, 0.35);
    rimLight.position.set(0, -4, -10);
    scene.add(rimLight);

    var clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    var modelBounds = { min: 0, max: 1 };
    var planeHelper = null;
    var contextLost = false;

    var controlsDiv = document.createElement('div');
    controlsDiv.className = 'model-controls';

    var crossSectionBtn = document.createElement('button');
    crossSectionBtn.className = 'model-btn model-btn--cross-section';
    crossSectionBtn.textContent = 'Cross Section';
    crossSectionBtn.setAttribute('aria-pressed', 'false');

    var sliderWrap = document.createElement('div');
    sliderWrap.className = 'model-slider-wrap';
    sliderWrap.hidden = true;

    var slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'model-slider';
    slider.min = '0';
    slider.max = '100';
    slider.value = '100';
    slider.setAttribute('aria-label', 'Cross section position');

    sliderWrap.appendChild(slider);
    controlsDiv.appendChild(crossSectionBtn);
    controlsDiv.appendChild(sliderWrap);

    // Multiple models dropdown
    var modelsData = container.getAttribute('data-models');
    var models = modelsData ? JSON.parse(modelsData) : null;

    var topControlsDiv = document.createElement('div');
    topControlsDiv.className = 'model-top-controls';
    if (models) {
        var modelSelect = document.createElement('select');
        modelSelect.className = 'model-select';
        modelSelect.setAttribute('aria-label', 'Select model version');
        models.forEach(function (m) {
            var opt = document.createElement('option');
            opt.value = m.src;
            opt.textContent = m.name;
            modelSelect.appendChild(opt);
        });
        modelSelect.addEventListener('change', function () {
            loadModel(this.value);
        });
        topControlsDiv.appendChild(modelSelect);
    }

    // Axis dropdown
    var axisSelect = document.createElement('select');
    axisSelect.className = 'model-select model-axis-select';
    axisSelect.setAttribute('aria-label', 'Select clipping axis');
    axisSelect.innerHTML = '<option value="y">Y Axis</option><option value="x">X Axis</option><option value="z">Z Axis</option>';
    axisSelect.hidden = true;

    axisSelect.addEventListener('change', function () {
        updateClippingForAxis();
    });
    topControlsDiv.appendChild(axisSelect);
    container.appendChild(topControlsDiv);
    container.appendChild(controlsDiv);

    var currentAxis = 'y';
    var currentModelNode = null;
    var currentBox = null;
    var ground = null;

    function updateClippingForAxis() {
        if (!currentBox) return;

        var axisVec = new THREE.Vector3(0, 0, 0);
        var planeRot = new THREE.Euler();

        switch (currentAxis) {
            case 'x':
                modelBounds.min = currentBox.min.x;
                modelBounds.max = currentBox.max.x;
                axisVec.set(-1, 0, 0);
                planeRot.set(0, Math.PI / 2, 0);
                break;
            case 'y':
                modelBounds.min = currentBox.min.y;
                modelBounds.max = currentBox.max.y;
                axisVec.set(0, -1, 0);
                planeRot.set(Math.PI / 2, 0, 0);
                break;
            case 'z':
                modelBounds.min = currentBox.min.z;
                modelBounds.max = currentBox.max.z;
                axisVec.set(0, 0, -1);
                planeRot.set(0, 0, 0);
                break;
        }
        clippingPlane.normal.copy(axisVec);

        if (planeHelper) {
            planeHelper.rotation.copy(planeRot);
        }

        var t = parseInt(slider.value, 10) / 100;
        var range = modelBounds.max - modelBounds.min;
        clippingPlane.constant = modelBounds.min + t * range;

        if (planeHelper) {
            var offset = clippingPlane.constant;
            planeHelper.position.set(0, 0, 0);
            if (currentAxis === 'x') planeHelper.position.x = offset;
            if (currentAxis === 'y') planeHelper.position.y = offset;
            if (currentAxis === 'z') planeHelper.position.z = offset;
        }
    }

    crossSectionBtn.addEventListener('click', function () {
        var enabled = crossSectionBtn.getAttribute('aria-pressed') !== 'true';
        crossSectionBtn.setAttribute('aria-pressed', String(enabled));
        sliderWrap.hidden = !enabled;
        axisSelect.hidden = !enabled;

        if (planeHelper) {
            planeHelper.visible = enabled;
        }

        if (!enabled) {
            slider.value = '100';
            if (currentBox) clippingPlane.constant = Math.max(currentBox.max.x, currentBox.max.y, currentBox.max.z) + 0.01;
        } else {
            updateClippingForAxis();
        }
    });

    slider.addEventListener('input', function () {
        var t = parseInt(slider.value, 10) / 100;
        var range = modelBounds.max - modelBounds.min;
        clippingPlane.constant = modelBounds.min + t * range;

        if (planeHelper) {
            var offset = clippingPlane.constant;
            if (currentAxis === 'x') planeHelper.position.x = offset;
            if (currentAxis === 'y') planeHelper.position.y = offset;
            if (currentAxis === 'z') planeHelper.position.z = offset;
        }
    });

    canvas.addEventListener('pointerdown', function () {
        controls.autoRotate = false;
    });

    canvas.addEventListener('webglcontextlost', function (event) {
        event.preventDefault();
        contextLost = true;
    });

    canvas.addEventListener('webglcontextrestored', function () {
        contextLost = false;
    });

    function loadModel(modelUrl) {
        var prevNode = currentModelNode;
        gltfLoader.load(modelUrl, function (gltf) {
            var state = viewerStates.get(container);
            if (!state || state.disposed) return;

            if (prevNode) {
                scene.remove(prevNode);
                prevNode.traverse(function (child) {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(m => m.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    }
                });
            }

            var model = gltf.scene;
            var box = new THREE.Box3().setFromObject(model);
            var center = box.getCenter(new THREE.Vector3());
            var size = box.getSize(new THREE.Vector3());

            model.position.sub(center);
            box.setFromObject(model);
            currentBox = box;

            updateClippingForAxis();

            var maxDim = Math.max(size.x, size.y, size.z);
            var fov = camera.fov * (Math.PI / 180);
            var fitDistance = maxDim / (2 * Math.tan(fov / 2));
            camera.position.set(fitDistance * 0.8, fitDistance * 0.5, fitDistance * 0.8);
            camera.lookAt(0, 0, 0);
            controls.target.set(0, 0, 0);
            controls.update();

            model.traverse(function (child) {
                if (child.isMesh && child.material) {
                    child.material = child.material.clone();
                    child.material.clippingPlanes = [clippingPlane];
                    child.material.clipShadows = true;
                    child.material.side = THREE.DoubleSide;
                }
            });

            if (!planeHelper) {
                var helperSize = maxDim * 1.5;
                var planeGeom = new THREE.PlaneGeometry(helperSize, helperSize);
                var planeMat = new THREE.MeshBasicMaterial({
                    color: 0x2563EB,
                    transparent: true,
                    opacity: 0.15,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });
                planeHelper = new THREE.Mesh(planeGeom, planeMat);
                planeHelper.visible = crossSectionBtn.getAttribute('aria-pressed') === 'true';
                scene.add(planeHelper);
            }
            updateClippingForAxis();

            if (!ground) {
                var groundGeom = new THREE.PlaneGeometry(maxDim * 3, maxDim * 3);
                var groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
                ground = new THREE.Mesh(groundGeom, groundMat);
                ground.rotation.x = -Math.PI / 2;
                ground.receiveShadow = true;
                scene.add(ground);
            }
            ground.position.y = box.min.y;

            scene.add(model);
            currentModelNode = model;
            state.model = model;

            if (crossSectionBtn.getAttribute('aria-pressed') === 'false') {
                clippingPlane.constant = maxDim + 0.01;
            }
        }, undefined, function (err) {
            console.error('Failed to load model:', err);
            if (!currentModelNode) {
                disposeViewer(container);
                renderFallback(container, 'Failed to load 3D model.');
            }
        });
    }

    loadModel(src);

    var resizeObserver = new ResizeObserver(function () {
        var current = viewerStates.get(container);
        if (!current || current.disposed) return;

        var rw = container.clientWidth;
        var rh = container.clientHeight;
        if (rw === 0 || rh === 0) return;

        camera.aspect = rw / rh;
        camera.updateProjectionMatrix();
        renderer.setSize(rw, rh);
    });
    resizeObserver.observe(container);

    var state = {
        renderer: renderer,
        controls: controls,
        resizeObserver: resizeObserver,
        frameId: 0,
        model: null,
        disposed: false
    };

    viewerStates.set(container, state);
    activeContainers.add(container);

    function animate() {
        var current = viewerStates.get(container);
        if (!current || current.disposed) return;

        current.frameId = requestAnimationFrame(animate);

        // Skip render if card/log is not visible.
        if (container.offsetParent === null || contextLost) return;

        controls.update();
        renderer.render(scene, camera);
    }

    animate();
    return true;
}

function syncCardViewers(card) {
    var log = card.querySelector('.project-log');
    if (!log) return;

    var containers = card.querySelectorAll('.model-viewer-container');
    if (!containers.length) return;

    if (log.hidden) {
        containers.forEach(function (container) {
            disposeViewer(container);
        });
        return;
    }

    containers.forEach(function (container) {
        if (viewerStates.has(container)) return;

        if (initModelViewer(container)) {
            container.removeAttribute('data-viewer-failures');
            return;
        }

        var failures = parseInt(container.getAttribute('data-viewer-failures') || '0', 10) + 1;
        container.setAttribute('data-viewer-failures', String(failures));

        if (failures >= 3) {
            renderFallback(container, '3D viewer is unavailable on this browser/device.');
            return;
        }

        setTimeout(function () {
            if (!log.hidden && !viewerStates.has(container)) {
                syncCardViewers(card);
            }
        }, 250);
    });
}

// Handle expand/collapse clicks from project cards
document.addEventListener('click', function (event) {
    var card = event.target.closest('.project-card--log');
    if (!card) return;

    setTimeout(function () {
        syncCardViewers(card);
    }, 320);
});

// Dispose viewer if its card is removed from DOM
var cleanupObserver = new MutationObserver(function () {
    activeContainers.forEach(function (container) {
        if (!document.contains(container)) {
            disposeViewer(container);
        }
    });
});
cleanupObserver.observe(document.body, { childList: true, subtree: true });
