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

function trackAnalyticsEvent(eventName, params) {
    if (!eventName || typeof window === 'undefined' || typeof window.gtag !== 'function') return;

    try {
        window.gtag('event', eventName, params || {});
    } catch (err) {
        // Avoid breaking core interactions if analytics fails.
    }
}

function detectArPlatform() {
    var ua = navigator.userAgent || '';
    var isIOS = /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isAndroid = /Android/i.test(ua);

    return {
        isIOS: isIOS,
        isAndroid: isAndroid,
        isMobile: isIOS || isAndroid
    };
}

function toAbsoluteUrl(url) {
    if (!url) return '';
    try {
        return new URL(url, document.baseURI).href;
    } catch (err) {
        return '';
    }
}

function buildSceneViewerIntent(glbUrl, title) {
    var params = 'file=' + encodeURIComponent(glbUrl) + '&mode=ar_preferred';
    if (title) {
        params += '&title=' + encodeURIComponent(title);
    }

    return (
        'intent://arvr.google.com/scene-viewer/1.0?' +
        params +
        '#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;' +
        'S.browser_fallback_url=' + encodeURIComponent(glbUrl) +
        ';end;'
    );
}

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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    // Helps avoid Z-fighting on co-planar CAD parts
    renderer.logarithmicDepthBuffer = true;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2563EB); // Site accent blue for contrast

    // Create a basic environment map for realistic soft reflections without loading an exr/hdr file
    var pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    // Default Three.js RoomEnvironment is too heavy to bundle, so we simulate a basic studio environment
    var envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0xffffff);
    var light1 = new THREE.DirectionalLight(0xffffff, 5);
    light1.position.set(0, 10, 0);
    envScene.add(light1);
    var light2 = new THREE.DirectionalLight(0xffffff, 2);
    light2.position.set(10, 0, 10);
    envScene.add(light2);

    var renderTarget = pmremGenerator.fromScene(envScene);
    scene.environment = renderTarget.texture;

    var camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
    var controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;

    // Sky/ground hemisphere for even base lighting
    var hemiLight = new THREE.HemisphereLight(0xffffff, 0xb0b8c4, 1.2);
    scene.add(hemiLight);

    // Key light — upper front-right
    var keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(8, 12, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
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

    var allowCrossSection = container.getAttribute('data-allow-cross-section') === 'true';
    var autoColorize = container.getAttribute('data-auto-colorize') === 'true';
    var arEnabled = container.getAttribute('data-ar-enabled') === 'true';
    var singleModelArSrc = container.getAttribute('data-ar-src') || '';
    var singleModelArTitle = container.getAttribute('data-ar-title') || '';
    var arPlatform = detectArPlatform();
    var arEntry = container.parentElement;
    var arLink = arEntry ? arEntry.querySelector('.model-ar-link') : null;
    var quickLookProxy = null;

    if (arEntry && arPlatform.isIOS) {
        quickLookProxy = arEntry.querySelector('.model-ar-quicklook-proxy');
        if (!quickLookProxy && arLink) {
            quickLookProxy = document.createElement('a');
            quickLookProxy.className = 'model-ar-quicklook-proxy';
            quickLookProxy.hidden = true;
            quickLookProxy.setAttribute('rel', 'ar');
            quickLookProxy.setAttribute('aria-hidden', 'true');
            quickLookProxy.tabIndex = -1;

            var proxyImg = document.createElement('img');
            proxyImg.alt = '';
            proxyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
            quickLookProxy.appendChild(proxyImg);

            arLink.insertAdjacentElement('afterend', quickLookProxy);
        }

        if (arLink && !arLink.getAttribute('data-quicklook-bound')) {
            arLink.addEventListener('click', function (event) {
                if (!quickLookProxy || !quickLookProxy.getAttribute('href')) return;
                event.preventDefault();
                quickLookProxy.click();
            });
            arLink.setAttribute('data-quicklook-bound', 'true');
        }
    }

    var crossSectionBtn = document.createElement('button');
    var sliderWrap = document.createElement('div');
    var slider = document.createElement('input');
    var axisSelect = null;

    if (allowCrossSection) {
        crossSectionBtn.className = 'model-btn model-btn--cross-section';
        crossSectionBtn.textContent = 'Cross Section';
        crossSectionBtn.setAttribute('aria-pressed', 'false');

        sliderWrap.className = 'model-slider-wrap';
        sliderWrap.hidden = true;

        slider.type = 'range';
        slider.className = 'model-slider';
        slider.min = '0';
        slider.max = '100';
        slider.value = '100';
        slider.setAttribute('aria-label', 'Cross section position');

        sliderWrap.appendChild(slider);
        controlsDiv.appendChild(crossSectionBtn);
        controlsDiv.appendChild(sliderWrap);
    }

    // Multiple models dropdown
    var modelsData = container.getAttribute('data-models');
    var models = null;
    if (modelsData) {
        try {
            models = JSON.parse(modelsData);
        } catch (err) {
            console.warn('Invalid model metadata on container:', err && err.message ? err.message : err);
            models = null;
        }
    }

    var topControlsDiv = document.createElement('div');
    topControlsDiv.className = 'model-top-controls';
    var modelSelect = null;
    if (models) {
        modelSelect = document.createElement('select');
        modelSelect.className = 'model-select';
        modelSelect.setAttribute('aria-label', 'Select model version');
        models.forEach(function (m) {
            var opt = document.createElement('option');
            opt.value = m.src;
            opt.textContent = m.name;
            modelSelect.appendChild(opt);
        });
        modelSelect.addEventListener('change', function () {
            var previousModel = currentModelUrl || src || '';
            loadModel(this.value);
            updateArLink(this.value);
            trackViewerEvent('project_3d_model_switch', {
                previous_model_src: previousModel,
                next_model_src: this.value || '',
                next_model_name: getModelMeta(this.value) ? (getModelMeta(this.value).name || '') : ''
            });
        });
        topControlsDiv.appendChild(modelSelect);
    }

    // Axis dropdown
    if (allowCrossSection) {
        axisSelect = document.createElement('select');
        axisSelect.className = 'model-select model-axis-select';
        axisSelect.setAttribute('aria-label', 'Select clipping axis');
        axisSelect.innerHTML = '<option value="y">Y Axis</option><option value="x">X Axis</option><option value="z">Z Axis</option>';
        axisSelect.hidden = true;

        axisSelect.addEventListener('change', function () {
            currentAxis = axisSelect.value;
            updateClippingForAxis();
            trackViewerEvent('project_3d_cross_section_axis_change', {
                cross_section_axis: currentAxis
            });
        });
        topControlsDiv.appendChild(axisSelect);
    }

    container.appendChild(topControlsDiv);
    container.appendChild(controlsDiv);

    var currentAxis = 'y';
    var currentModelNode = null;
    var currentBox = null;
    var ground = null;
    var currentModelUrl = src;
    var hasTrackedViewerLoad = false;
    var hasTrackedViewerInteract = false;
    var card = container.closest('.project-card');

    function getModelMeta(modelUrl) {
        if (!models || !models.length) return null;

        for (var i = 0; i < models.length; i++) {
            if (models[i].src === modelUrl) return models[i];
        }
        return null;
    }

    function getArPlatformLabel() {
        return arPlatform.isIOS ? 'ios' : (arPlatform.isAndroid ? 'android' : 'other');
    }

    function trackViewerEvent(eventName, extra) {
        var payload = {
            project_id: card ? (card.getAttribute('data-project-id') || '') : '',
            project_title: card ? (card.getAttribute('data-project-title') || '') : '',
            project_slug: card ? (card.getAttribute('data-project-slug') || '') : '',
            project_category: card ? (card.getAttribute('data-category') || '') : '',
            project_type: card ? (card.getAttribute('data-project-type') || '') : '',
            ar_platform: getArPlatformLabel(),
            model_src: currentModelUrl || src || ''
        };

        if (extra) {
            Object.keys(extra).forEach(function (key) {
                payload[key] = extra[key];
            });
        }

        trackAnalyticsEvent(eventName, payload);
    }

    function updateArLink(modelUrl) {
        if (!arLink) return;
        if (!arEnabled || !arPlatform.isMobile) {
            arLink.hidden = true;
            arLink.removeAttribute('href');
            arLink.removeAttribute('target');
            arLink.removeAttribute('rel');
            if (quickLookProxy) quickLookProxy.removeAttribute('href');
            return;
        }

        var meta = getModelMeta(modelUrl);
        var iosSrc = meta ? (meta.iosSrc || meta.usdz || '') : singleModelArSrc;
        var arTitle = meta ? (meta.arTitle || meta.name || '') : singleModelArTitle;

        if (!arTitle) {
            arTitle = container.getAttribute('aria-label') || '3D model';
        }

        var absoluteModelUrl = toAbsoluteUrl(modelUrl);
        var absoluteIosUrl = toAbsoluteUrl(iosSrc);

        if (arPlatform.isIOS && absoluteIosUrl) {
            arLink.href = absoluteIosUrl;
            arLink.setAttribute('rel', 'ar');
            arLink.removeAttribute('target');
            arLink.hidden = false;
            if (quickLookProxy) quickLookProxy.href = absoluteIosUrl;
            return;
        }

        if (arPlatform.isAndroid && absoluteModelUrl) {
            arLink.href = buildSceneViewerIntent(absoluteModelUrl, arTitle);
            arLink.setAttribute('rel', 'noopener');
            arLink.setAttribute('target', '_blank');
            arLink.hidden = false;
            return;
        }

        arLink.hidden = true;
        arLink.removeAttribute('href');
        arLink.removeAttribute('target');
        arLink.removeAttribute('rel');
        if (quickLookProxy) quickLookProxy.removeAttribute('href');
    }

    function bindArAnalytics() {
        if (!arLink || arLink.getAttribute('data-analytics-bound') === 'true') return;

        arLink.addEventListener('click', function () {
            var activeModel = currentModelUrl || src || '';
            var activeMeta = getModelMeta(activeModel);

            trackAnalyticsEvent('project_ar_open', {
                project_id: card ? (card.getAttribute('data-project-id') || '') : '',
                project_title: card ? (card.getAttribute('data-project-title') || '') : '',
                project_slug: card ? (card.getAttribute('data-project-slug') || '') : '',
                project_category: card ? (card.getAttribute('data-category') || '') : '',
                project_type: card ? (card.getAttribute('data-project-type') || '') : '',
                ar_platform: getArPlatformLabel(),
                model_src: activeModel,
                model_name: activeMeta ? (activeMeta.name || '') : '',
                ar_href: arLink.href || ''
            });
        });

        arLink.setAttribute('data-analytics-bound', 'true');
    }

    function updateClippingForAxis() {
        if (!currentBox) return;

        if (!allowCrossSection) {
            clippingPlane.normal.set(0, -1, 0);
            clippingPlane.constant = currentBox.max.y + 0.01;
            return;
        }

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

    if (allowCrossSection) {
        crossSectionBtn.addEventListener('click', function () {
            var enabled = crossSectionBtn.getAttribute('aria-pressed') !== 'true';
            crossSectionBtn.setAttribute('aria-pressed', String(enabled));
            sliderWrap.hidden = !enabled;
            if (axisSelect) axisSelect.hidden = !enabled;
            trackViewerEvent('project_3d_cross_section_toggle', {
                cross_section_enabled: enabled,
                cross_section_axis: currentAxis
            });

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
    }

    canvas.addEventListener('pointerdown', function () {
        if (!hasTrackedViewerInteract) {
            hasTrackedViewerInteract = true;
            trackViewerEvent('project_3d_viewer_interact', {
                interaction_type: 'pointerdown'
            });
        }
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
        currentModelUrl = modelUrl;
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
            camera.far = fitDistance * 10;
            camera.near = fitDistance * 0.001;
            camera.updateProjectionMatrix();
            controls.target.set(0, 0, 0);
            controls.update();

            var colorPalette = [
                0x3B82F6, // Blue
                0xEF4444, // Red
                0x10B981, // Green
                0xF59E0B, // Yellow
                0x8B5CF6, // Purple
                0xEC4899, // Pink
                0x14B8A6, // Teal
                0xF97316  // Orange
            ];
            var meshCount = 0;

            model.traverse(function (child) {
                if (child.isMesh && child.material) {

                    // Force standard material for better lighting reaction
                    if (child.material.isMeshBasicMaterial || child.material.isMeshLambertMaterial || child.material.isMeshPhongMaterial) {
                        var newMat = new THREE.MeshStandardMaterial();
                        newMat.color.copy(child.material.color);
                        if (child.material.map) newMat.map = child.material.map;
                        child.material.dispose();
                        child.material = newMat;
                    } else {
                        child.material = child.material.clone();
                    }

                    // Force matte finish and let environment map handle subtle reflections
                    child.material.roughness = 0.65;
                    child.material.metalness = 0.1;
                    child.material.envMapIntensity = 1.0;

                    if (autoColorize) {
                        child.material.color.setHex(colorPalette[meshCount % colorPalette.length]);
                        meshCount++;
                    } else if (!child.material.map) {
                        // Restore raw uncolored CAD to stark white
                        var hsl = {};
                        child.material.color.getHSL(hsl);
                        if (hsl.l > 0.6 && hsl.s < 0.2) {
                            child.material.color.setHex(0xffffff);
                        }
                    }

                    child.material.clippingPlanes = [clippingPlane];
                    child.material.clipShadows = true;
                    child.material.side = THREE.DoubleSide;

                    // Ensure shadow casting
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // Add visible edges for crisp 3D outline visibility
                    // Skip for large meshes (>200k verts) to avoid hanging the browser
                    if (child.geometry.attributes.position.count < 200000) {
                        var edgeGeom = new THREE.EdgesGeometry(child.geometry, 30);
                        var edgeMat = new THREE.LineBasicMaterial({
                            color: 0x000000,
                            linewidth: 1,
                            clippingPlanes: [clippingPlane]
                        });
                        var edgeMesh = new THREE.LineSegments(edgeGeom, edgeMat);
                        child.add(edgeMesh);
                    }
                }
            });

            if (!planeHelper) {
                var helperSize = maxDim * 1.5;
                var planeGeom = new THREE.PlaneGeometry(helperSize, helperSize);
                var planeMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.25,
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

            if (!hasTrackedViewerLoad) {
                hasTrackedViewerLoad = true;
                trackViewerEvent('project_3d_viewer_load', {
                    model_name: getModelMeta(modelUrl) ? (getModelMeta(modelUrl).name || '') : '',
                    cross_section_available: allowCrossSection
                });
            }

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
    updateArLink(src);
    bindArAnalytics();

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

function initVisibleModelViewers(scope) {
    var root = scope && scope.querySelectorAll ? scope : document;
    var containers = root.querySelectorAll('.model-viewer-container');
    if (!containers.length) return;

    containers.forEach(function (container) {
        if (viewerStates.has(container)) return;

        var card = container.closest('.project-card--log');
        var log = card ? card.querySelector('.project-log') : null;
        if (log && log.hidden) return;

        if (initModelViewer(container)) {
            container.removeAttribute('data-viewer-failures');
            return;
        }

        var failures = parseInt(container.getAttribute('data-viewer-failures') || '0', 10) + 1;
        container.setAttribute('data-viewer-failures', String(failures));

        if (failures >= 3) {
            renderFallback(container, '3D viewer is unavailable on this browser/device.');
        }
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

function scheduleVisibleViewerInit() {
    setTimeout(function () {
        initVisibleModelViewers(document);
    }, 80);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleVisibleViewerInit, { once: true });
} else {
    scheduleVisibleViewerInit();
}

document.addEventListener('projectsRendered', scheduleVisibleViewerInit);

// Dispose viewer if its card is removed from DOM
var cleanupObserver = new MutationObserver(function () {
    activeContainers.forEach(function (container) {
        if (!document.contains(container)) {
            disposeViewer(container);
        }
    });
});
cleanupObserver.observe(document.body, { childList: true, subtree: true });
