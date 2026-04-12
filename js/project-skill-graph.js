import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const PROJECTS_URL = 'data/projects.json';

const TYPE_META = {
    project: { color: 0x2563eb, size: 1.9, labelColor: '#1d4ed8' },
    topic: { color: 0x0ea5a8, size: 2.2, labelColor: '#0f766e' },
    skill: { color: 0xffb703, size: 2.6, labelColor: '#a16207' }
};

const LINK_COLORS = {
    'project-topic': 0x2dd4bf,
    'project-skill': 0xf59e0b,
    'topic-skill': 0x94a3b8,
    'project-project': 0x93c5fd
};

const SKILL_RULES = [
    { skill: 'Mechanical Design', terms: ['mechanical engineering', 'mechanical', 'assembly', 'component'] },
    { skill: 'CAD and 3D Modeling', terms: ['cad', '3d modeling', '3d printing', 'modeling'] },
    { skill: 'Rapid Prototyping', terms: ['prototyping', 'rapid prototyping', 'iteration', 'jig'] },
    { skill: 'Metal Fabrication', terms: ['welding', 'brazing', 'blacksmithing', 'sheet metal', 'aluminum', 'brass'] },
    { skill: 'Woodworking and Joinery', terms: ['woodworking', 'joinery', 'walnut', 'furniture'] },
    { skill: 'Design for Manufacturing', terms: ['manufacturing', 'process engineering', 'lean'] },
    { skill: 'Robotics and Autonomy', terms: ['robotics', 'autonomy', 'autonomous', 'sensor fusion', 'computer vision'] },
    { skill: 'Mechatronics Integration', terms: ['mechatronics', 'iot', 'electronics', 'sensor'] },
    { skill: 'Simulation and Analysis', terms: ['simulation', 'fea', 'analysis'] },
    { skill: 'Consumer Product Strategy', terms: ['consumer product', 'product design', 'home goods'] },
    { skill: 'Spatial Computing and AR', terms: ['ar', 'spatial', 'usdz', 'glb'] },
    { skill: 'Brand and Visual Storytelling', terms: ['brand direction', 'content creation', 'packaging design', 'shopify theme'] },
    { skill: 'Entrepreneurial Execution', terms: ['e-commerce', 'shopify', 'ongoing', 'patent pending'] },
    { skill: 'Cross-Disciplinary Build Systems', terms: ['fabrication', 'prototype', 'build', 'concept design'] }
];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const host = window.location.hostname || '';
const isLocalPreview = LOCAL_HOSTS.has(host) || host.endsWith('.local');
const constellationSection = document.querySelector('.skill-constellation');
const mount = document.getElementById('skillGraphCanvas');

if (!isLocalPreview) {
    if (constellationSection) {
        constellationSection.remove();
    }
} else if (mount) {
    initSkillGraph();
}

async function initSkillGraph() {
    const panelRoot = document.getElementById('skillGraphPanel');
    const panelTitle = panelRoot ? panelRoot.querySelector('.skill-panel__title') : null;
    const panelMeta = panelRoot ? panelRoot.querySelector('.skill-panel__meta') : null;
    const panelList = document.getElementById('skillGraphConnections');
    const activeFilterEl = document.getElementById('skillGraphActiveFilter');
    const controlButtons = document.querySelectorAll('.skill-graph-btn');

    const state = {
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        raycaster: new THREE.Raycaster(),
        pointer: new THREE.Vector2(2, 2),
        nodes: [],
        links: [],
        nodeMeshes: [],
        hoveredNode: null,
        selectedNode: null,
        simulationOn: true,
        activeCategory: 'all',
        activeProjectIds: null,
        categoryProjects: new Map(),
        visualDirty: true,
        animationId: 0,
        stats: { project: 0, topic: 0, skill: 0 }
    };

    let graph;
    try {
        graph = await loadGraphData();
    } catch (err) {
        mount.innerHTML = '<p style="padding:1.5rem;color:#555;text-align:center;">Could not load constellation data.</p>';
        return;
    }

    state.nodes = graph.nodes;
    state.links = graph.links;
    state.categoryProjects = graph.categoryProjects;
    state.stats = graph.stats;

    try {
        setupScene(state);
    } catch (err) {
        mount.innerHTML = '<p style="padding:1.5rem;color:#555;text-align:center;">WebGL is unavailable in this browser.</p>';
        return;
    }

    buildGraphMeshes(state);
    bindGraphInteractions(state, {
        panelTitle: panelTitle,
        panelMeta: panelMeta,
        panelList: panelList,
        activeFilterEl: activeFilterEl,
        controlButtons: controlButtons
    });

    renderDefaultPanel(state, panelTitle, panelMeta, panelList);
    bindFilterButtons(state, activeFilterEl, panelTitle, panelMeta, panelList);
    animate(state);
}

async function loadGraphData() {
    const response = await fetch(PROJECTS_URL + '?v=' + Date.now());
    if (!response.ok) {
        throw new Error('Failed to load projects JSON');
    }

    const data = await response.json();
    return buildGraphData(data);
}

function buildGraphData(data) {
    const categories = Array.isArray(data.categories) ? data.categories : [];
    const projects = Array.isArray(data.projects) ? data.projects : [];
    const categoryLabelById = new Map();
    const categoryProjects = new Map();

    categories.forEach(function (category) {
        categoryLabelById.set(category.id, category.label);
        categoryProjects.set(category.id, new Set());
    });

    const nodesById = new Map();
    const linksByKey = new Map();
    const topicSkillPairs = new Map();
    const projectConcepts = new Map();

    function ensureNode(id, label, type, meta) {
        if (nodesById.has(id)) return nodesById.get(id);

        const node = {
            id: id,
            label: label,
            type: type,
            meta: meta || {},
            projectIds: new Set(),
            connections: new Map(),
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2
            ),
            force: new THREE.Vector3(),
            baseSize: TYPE_META[type].size,
            mesh: null,
            labelSprite: null
        };

        nodesById.set(id, node);
        return node;
    }

    function addConnection(source, target, weight, relationType) {
        let record = source.connections.get(target.id);
        if (!record) {
            record = {
                node: target,
                weight: 0,
                relationTypes: new Set()
            };
            source.connections.set(target.id, record);
        }

        record.weight += weight;
        record.relationTypes.add(relationType);
    }

    function addLink(source, target, weight, relationType, projectIds) {
        if (!source || !target || source.id === target.id) return;
        const key = makePairKey(source.id, target.id);
        let link = linksByKey.get(key);

        if (!link) {
            link = {
                key: key,
                source: source,
                target: target,
                weight: 0,
                relationTypes: new Set(),
                projectIds: new Set(),
                line: null,
                material: null,
                baseColor: LINK_COLORS[relationType] || 0x94a3b8
            };
            linksByKey.set(key, link);
        }

        link.weight += weight;
        link.relationTypes.add(relationType);
        link.baseColor = getLinkColor(link.relationTypes);

        if (projectIds) {
            projectIds.forEach(function (projectId) {
                link.projectIds.add(projectId);
            });
        }

        addConnection(source, target, weight, relationType);
        addConnection(target, source, weight, relationType);
    }

    projects.forEach(function (project) {
        const projectId = project.id;
        const projectNode = ensureNode(
            'project:' + projectId,
            project.title,
            'project',
            {
                category: project.category || '',
                date: project.date || ''
            }
        );

        projectNode.projectIds.add(projectId);
        if (categoryProjects.has(project.category)) {
            categoryProjects.get(project.category).add(projectId);
        }

        const conceptIds = new Set();
        const projectIdSet = new Set([projectId]);

        if (project.category) {
            const categoryLabel = categoryLabelById.get(project.category) || project.category;
            const categoryNode = ensureNode(
                'topic:category:' + project.category,
                categoryLabel,
                'topic',
                { topicKind: 'category', sourceId: project.category }
            );
            categoryNode.projectIds.add(projectId);
            conceptIds.add(categoryNode.id);
            addLink(projectNode, categoryNode, 1.2, 'project-topic', projectIdSet);
        }

        const tags = Array.isArray(project.tags) ? project.tags : [];
        tags.forEach(function (tag) {
            const tagNode = ensureNode(
                'topic:tag:' + slugify(tag),
                tag,
                'topic',
                { topicKind: 'tag' }
            );
            tagNode.projectIds.add(projectId);
            conceptIds.add(tagNode.id);
            addLink(projectNode, tagNode, 1.35, 'project-topic', projectIdSet);
        });

        const inferredSkills = inferSkills(project);
        inferredSkills.forEach(function (skill) {
            const skillNode = ensureNode(
                'skill:' + slugify(skill),
                skill,
                'skill',
                { inferred: true }
            );
            skillNode.projectIds.add(projectId);
            conceptIds.add(skillNode.id);
            addLink(projectNode, skillNode, 1.65, 'project-skill', projectIdSet);
        });

        projectConcepts.set(project.id, conceptIds);

        const topicNodeIds = Array.from(conceptIds).filter(function (id) {
            return id.indexOf('topic:') === 0;
        });

        const skillNodeIds = Array.from(conceptIds).filter(function (id) {
            return id.indexOf('skill:') === 0;
        });

        topicNodeIds.forEach(function (topicId) {
            skillNodeIds.forEach(function (skillId) {
                const pairKey = makePairKey(topicId, skillId);
                let pairRecord = topicSkillPairs.get(pairKey);
                if (!pairRecord) {
                    pairRecord = {
                        topicId: topicId,
                        skillId: skillId,
                        count: 0,
                        projectIds: new Set()
                    };
                    topicSkillPairs.set(pairKey, pairRecord);
                }
                pairRecord.count += 1;
                pairRecord.projectIds.add(projectId);
            });
        });
    });

    topicSkillPairs.forEach(function (pairRecord) {
        if (pairRecord.count < 2) return;
        const topicNode = nodesById.get(pairRecord.topicId);
        const skillNode = nodesById.get(pairRecord.skillId);
        if (!topicNode || !skillNode) return;
        addLink(
            topicNode,
            skillNode,
            0.35 + pairRecord.count * 0.25,
            'topic-skill',
            pairRecord.projectIds
        );
    });

    for (let i = 0; i < projects.length; i += 1) {
        for (let j = i + 1; j < projects.length; j += 1) {
            const a = projects[i];
            const b = projects[j];
            const conceptsA = projectConcepts.get(a.id) || new Set();
            const conceptsB = projectConcepts.get(b.id) || new Set();

            let overlap = 0;
            conceptsA.forEach(function (conceptId) {
                if (conceptsB.has(conceptId)) {
                    overlap += 1;
                }
            });

            if (overlap < 3) continue;

            const nodeA = nodesById.get('project:' + a.id);
            const nodeB = nodesById.get('project:' + b.id);
            addLink(
                nodeA,
                nodeB,
                0.2 + overlap * 0.18,
                'project-project',
                new Set([a.id, b.id])
            );
        }
    }

    const nodes = Array.from(nodesById.values());
    const links = Array.from(linksByKey.values());
    seedInitialPositions(nodes);

    const stats = {
        project: nodes.filter(function (node) { return node.type === 'project'; }).length,
        topic: nodes.filter(function (node) { return node.type === 'topic'; }).length,
        skill: nodes.filter(function (node) { return node.type === 'skill'; }).length
    };

    return {
        nodes: nodes,
        links: links,
        categoryProjects: categoryProjects,
        stats: stats
    };
}

function setupScene(state) {
    const width = mount.clientWidth;
    const height = mount.clientHeight || 620;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 600);
    camera.position.set(0, 22, 112);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.minDistance = 26;
    controls.maxDistance = 230;
    controls.target.set(0, 0, 0);
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.95));

    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(35, 28, 22);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xffffff, 0.45);
    rim.position.set(-24, -18, -22);
    scene.add(rim);

    const fill = new THREE.PointLight(0x93c5fd, 0.65, 260);
    fill.position.set(0, 20, 10);
    scene.add(fill);

    state.renderer = renderer;
    state.scene = scene;
    state.camera = camera;
    state.controls = controls;

    const resizeObserver = new ResizeObserver(function () {
        const nextWidth = mount.clientWidth;
        const nextHeight = mount.clientHeight || 620;
        state.camera.aspect = nextWidth / nextHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(nextWidth, nextHeight);
    });
    resizeObserver.observe(mount);
}

function buildGraphMeshes(state) {
    const geometryByType = {
        project: new THREE.IcosahedronGeometry(1, 1),
        topic: new THREE.SphereGeometry(1, 12, 12),
        skill: new THREE.OctahedronGeometry(1, 0)
    };

    state.nodes.forEach(function (node) {
        const material = new THREE.MeshStandardMaterial({
            color: TYPE_META[node.type].color,
            metalness: 0.18,
            roughness: 0.34,
            transparent: true,
            opacity: 1
        });

        const mesh = new THREE.Mesh(geometryByType[node.type], material);
        mesh.position.copy(node.position);
        mesh.scale.setScalar(node.baseSize);
        mesh.userData.nodeId = node.id;
        state.scene.add(mesh);
        state.nodeMeshes.push(mesh);

        const labelSprite = createLabelSprite(node.label, TYPE_META[node.type].labelColor);
        labelSprite.position.set(0, node.baseSize + 2.1, 0);
        labelSprite.visible = node.type !== 'project';
        mesh.add(labelSprite);

        node.mesh = mesh;
        node.labelSprite = labelSprite;
    });

    state.links.forEach(function (link) {
        const positions = new Float32Array(6);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color: link.baseColor,
            transparent: true,
            opacity: 0.34
        });

        const line = new THREE.Line(geometry, material);
        line.frustumCulled = false;
        state.scene.add(line);

        link.line = line;
        link.material = material;
        updateLinkPositions(link);
    });
}

function bindGraphInteractions(state, ui) {
    const dom = state.renderer.domElement;

    function updatePointer(event) {
        const rect = dom.getBoundingClientRect();
        state.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        state.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickNode() {
        state.raycaster.setFromCamera(state.pointer, state.camera);
        const intersects = state.raycaster.intersectObjects(state.nodeMeshes, false);
        if (!intersects.length) return null;
        const match = intersects[0].object;
        const nodeId = match.userData.nodeId;
        return state.nodes.find(function (node) { return node.id === nodeId; }) || null;
    }

    dom.addEventListener('mousemove', function (event) {
        updatePointer(event);
        if (state.selectedNode) return;
        const nextHovered = pickNode();
        if (state.hoveredNode === nextHovered) return;
        state.hoveredNode = nextHovered;
        state.visualDirty = true;
        if (!state.selectedNode) {
            if (nextHovered) {
                renderNodePanel(state, nextHovered, ui.panelTitle, ui.panelMeta, ui.panelList);
            } else {
                renderDefaultPanel(state, ui.panelTitle, ui.panelMeta, ui.panelList);
            }
        }
    });

    dom.addEventListener('mouseleave', function () {
        if (state.selectedNode) return;
        state.hoveredNode = null;
        state.visualDirty = true;
        renderDefaultPanel(state, ui.panelTitle, ui.panelMeta, ui.panelList);
    });

    dom.addEventListener('click', function (event) {
        updatePointer(event);
        const clicked = pickNode();
        if (!clicked) {
            state.selectedNode = null;
            state.visualDirty = true;
            if (state.hoveredNode) {
                renderNodePanel(state, state.hoveredNode, ui.panelTitle, ui.panelMeta, ui.panelList);
            } else {
                renderDefaultPanel(state, ui.panelTitle, ui.panelMeta, ui.panelList);
            }
            return;
        }

        state.selectedNode = state.selectedNode && state.selectedNode.id === clicked.id ? null : clicked;
        state.visualDirty = true;
        if (state.selectedNode) {
            renderNodePanel(state, state.selectedNode, ui.panelTitle, ui.panelMeta, ui.panelList);
        } else if (state.hoveredNode) {
            renderNodePanel(state, state.hoveredNode, ui.panelTitle, ui.panelMeta, ui.panelList);
        } else {
            renderDefaultPanel(state, ui.panelTitle, ui.panelMeta, ui.panelList);
        }
    });

    dom.addEventListener('dblclick', function () {
        state.selectedNode = null;
        state.visualDirty = true;
        if (state.hoveredNode) {
            renderNodePanel(state, state.hoveredNode, ui.panelTitle, ui.panelMeta, ui.panelList);
        } else {
            renderDefaultPanel(state, ui.panelTitle, ui.panelMeta, ui.panelList);
        }
    });

    ui.controlButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            const action = button.getAttribute('data-action');
            if (action === 'toggle-sim') {
                state.simulationOn = !state.simulationOn;
                button.textContent = state.simulationOn ? 'Pause Motion' : 'Resume Motion';
                button.classList.toggle('is-active', !state.simulationOn);
            } else if (action === 'reset-view') {
                state.camera.position.set(0, 22, 112);
                state.controls.target.set(0, 0, 0);
                state.controls.update();
            } else if (action === 'clear-selection') {
                state.selectedNode = null;
                state.hoveredNode = null;
                state.visualDirty = true;
                renderDefaultPanel(state, ui.panelTitle, ui.panelMeta, ui.panelList);
            }
        });
    });
}

function bindFilterButtons(state, activeFilterEl, panelTitle, panelMeta, panelList) {
    function applyFilter(filterId, label) {
        const nextFilter = filterId || 'all';
        state.activeCategory = nextFilter;
        state.activeProjectIds = nextFilter === 'all'
            ? null
            : (state.categoryProjects.get(nextFilter) || new Set());

        if (activeFilterEl) {
            activeFilterEl.textContent = label || (nextFilter === 'all' ? 'All' : nextFilter);
        }

        if (state.selectedNode && !nodePassesActiveFilter(state, state.selectedNode)) {
            state.selectedNode = null;
        }

        state.visualDirty = true;
        if (state.selectedNode) {
            renderNodePanel(state, state.selectedNode, panelTitle, panelMeta, panelList);
        } else if (state.hoveredNode && nodePassesActiveFilter(state, state.hoveredNode)) {
            renderNodePanel(state, state.hoveredNode, panelTitle, panelMeta, panelList);
        } else {
            renderDefaultPanel(state, panelTitle, panelMeta, panelList);
        }
    }

    function attachFilterHandlers() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(function (button) {
            if (button.dataset.graphBound === 'true') return;
            button.dataset.graphBound = 'true';
            button.addEventListener('click', function () {
                const filterId = button.getAttribute('data-filter') || 'all';
                const label = button.textContent ? button.textContent.trim() : 'All';
                applyFilter(filterId, label);
            });
        });

        const activeButton = document.querySelector('.filter-btn.active');
        if (activeButton) {
            applyFilter(
                activeButton.getAttribute('data-filter') || 'all',
                activeButton.textContent ? activeButton.textContent.trim() : 'All'
            );
        }
    }

    document.addEventListener('projectsRendered', attachFilterHandlers);
    attachFilterHandlers();
}

function animate(state) {
    function frame() {
        state.animationId = requestAnimationFrame(frame);

        if (state.simulationOn) {
            tickSimulation(state.nodes, state.links);
            state.nodes.forEach(function (node) {
                node.mesh.position.copy(node.position);
            });
            state.links.forEach(updateLinkPositions);
        }

        if (state.visualDirty) {
            applyVisualState(state);
            state.visualDirty = false;
        }

        state.controls.update();
        state.renderer.render(state.scene, state.camera);
    }

    frame();
}

function tickSimulation(nodes, links) {
    const repulsion = 220;
    const centerPull = 0.0018;
    const damping = 0.88;

    nodes.forEach(function (node) {
        node.force.set(0, 0, 0);
    });

    for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
            const a = nodes[i];
            const b = nodes[j];
            const dx = b.position.x - a.position.x;
            const dy = b.position.y - a.position.y;
            const dz = b.position.z - a.position.z;
            const distSq = Math.max(dx * dx + dy * dy + dz * dz, 4);
            const invDist = 1 / Math.sqrt(distSq);
            const magnitude = repulsion / distSq;

            const fx = dx * invDist * magnitude;
            const fy = dy * invDist * magnitude;
            const fz = dz * invDist * magnitude;

            a.force.x -= fx;
            a.force.y -= fy;
            a.force.z -= fz;
            b.force.x += fx;
            b.force.y += fy;
            b.force.z += fz;
        }
    }

    links.forEach(function (link) {
        const source = link.source;
        const target = link.target;
        const dx = target.position.x - source.position.x;
        const dy = target.position.y - source.position.y;
        const dz = target.position.z - source.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
        const desired = getDesiredLinkLength(link);
        const stretch = dist - desired;
        const spring = 0.006 + Math.min(link.weight * 0.0015, 0.012);
        const force = stretch * spring;
        const invDist = 1 / dist;

        const fx = dx * invDist * force;
        const fy = dy * invDist * force;
        const fz = dz * invDist * force;

        source.force.x += fx;
        source.force.y += fy;
        source.force.z += fz;
        target.force.x -= fx;
        target.force.y -= fy;
        target.force.z -= fz;
    });

    nodes.forEach(function (node) {
        const typeMass = node.type === 'skill' ? 1.25 : (node.type === 'project' ? 0.92 : 1.05);
        node.force.x += -node.position.x * centerPull;
        node.force.y += -node.position.y * centerPull;
        node.force.z += -node.position.z * centerPull;

        node.velocity.x = (node.velocity.x + node.force.x / typeMass) * damping;
        node.velocity.y = (node.velocity.y + node.force.y / typeMass) * damping;
        node.velocity.z = (node.velocity.z + node.force.z / typeMass) * damping;

        const speedSq =
            node.velocity.x * node.velocity.x +
            node.velocity.y * node.velocity.y +
            node.velocity.z * node.velocity.z;
        if (speedSq > 5.76) {
            const ratio = 2.4 / Math.sqrt(speedSq);
            node.velocity.x *= ratio;
            node.velocity.y *= ratio;
            node.velocity.z *= ratio;
        }

        node.position.x += node.velocity.x;
        node.position.y += node.velocity.y;
        node.position.z += node.velocity.z;
    });
}

function applyVisualState(state) {
    const focusNode = state.selectedNode || state.hoveredNode;
    const focusSet = new Set();

    if (focusNode) {
        focusSet.add(focusNode.id);
        focusNode.connections.forEach(function (record) {
            focusSet.add(record.node.id);
        });
    }

    state.nodes.forEach(function (node) {
        const inFilter = nodePassesActiveFilter(state, node);
        const isFocus = focusNode && node.id === focusNode.id;
        const isNeighbor = focusNode && focusSet.has(node.id);

        let opacity = inFilter ? 0.96 : 0.08;
        let scaleBoost = 1;

        if (focusNode) {
            if (isFocus) {
                opacity = inFilter ? 1 : 0.2;
                scaleBoost = 1.65;
            } else if (isNeighbor && inFilter) {
                opacity = 0.98;
                scaleBoost = 1.24;
            } else {
                opacity = inFilter ? 0.15 : 0.05;
            }
        }

        node.mesh.material.opacity = opacity;
        node.mesh.material.transparent = opacity < 0.98;
        node.mesh.material.emissive.setHex(isFocus ? 0x1e293b : 0x000000);
        node.mesh.scale.setScalar(node.baseSize * scaleBoost);

        if (node.labelSprite) {
            const showLabel = node.type !== 'project' || isFocus || isNeighbor;
            node.labelSprite.visible = showLabel;
            node.labelSprite.material.opacity = Math.max(opacity - 0.08, 0.04);
        }
    });

    state.links.forEach(function (link) {
        const sourceInFocusSet = focusSet.has(link.source.id);
        const targetInFocusSet = focusSet.has(link.target.id);
        const touchesFocus = focusNode && (link.source.id === focusNode.id || link.target.id === focusNode.id);
        const bothInFocusSet = sourceInFocusSet && targetInFocusSet;
        const inFilter = linkPassesActiveFilter(state, link);

        let opacity = inFilter ? 0.34 : 0.04;
        let color = link.baseColor;

        if (focusNode) {
            if (touchesFocus && inFilter) {
                opacity = 0.9;
                color = 0xffffff;
            } else if (bothInFocusSet && inFilter) {
                opacity = 0.42;
            } else {
                opacity = inFilter ? 0.08 : 0.03;
            }
        }

        link.material.opacity = opacity;
        link.material.color.setHex(color);
    });
}

function nodePassesActiveFilter(state, node) {
    if (!state.activeProjectIds) return true;
    if (!node.projectIds || node.projectIds.size === 0) return false;

    let visible = false;
    node.projectIds.forEach(function (projectId) {
        if (state.activeProjectIds.has(projectId)) {
            visible = true;
        }
    });
    return visible;
}

function linkPassesActiveFilter(state, link) {
    if (!state.activeProjectIds) return true;
    if (!link.projectIds || link.projectIds.size === 0) return false;

    let visible = false;
    link.projectIds.forEach(function (projectId) {
        if (state.activeProjectIds.has(projectId)) {
            visible = true;
        }
    });
    return visible;
}

function renderDefaultPanel(state, titleEl, metaEl, listEl) {
    if (!titleEl || !metaEl || !listEl) return;

    titleEl.textContent = 'Hover a node';
    metaEl.textContent =
        'Showing ' +
        state.stats.project +
        ' projects, ' +
        state.stats.topic +
        ' topics, and ' +
        state.stats.skill +
        ' inferred skills.';

    const topSkills = state.nodes
        .filter(function (node) { return node.type === 'skill'; })
        .sort(function (a, b) { return b.projectIds.size - a.projectIds.size; })
        .slice(0, 8);

    listEl.innerHTML = topSkills
        .map(function (node) {
            return (
                '<li><strong>' +
                escapeHtml(node.label) +
                '</strong><em>' +
                node.projectIds.size +
                ' projects</em></li>'
            );
        })
        .join('');
}

function renderNodePanel(state, node, titleEl, metaEl, listEl) {
    if (!node || !titleEl || !metaEl || !listEl) return;

    titleEl.textContent = node.label;

    const metaParts = [];
    metaParts.push(capitalize(node.type) + ' Node');
    metaParts.push(node.projectIds.size + ' related projects');
    if (state.activeCategory !== 'all') {
        metaParts.push('Filtered by category');
    }
    metaEl.textContent = metaParts.join(' · ');

    const topConnections = Array.from(node.connections.values())
        .filter(function (record) {
            return nodePassesActiveFilter(state, record.node);
        })
        .sort(function (a, b) {
            return b.weight - a.weight;
        })
        .slice(0, 10);

    if (topConnections.length === 0) {
        listEl.innerHTML = '<li><strong>No visible connections</strong><em>Change the topic filter</em></li>';
        return;
    }

    listEl.innerHTML = topConnections
        .map(function (record) {
            return (
                '<li><strong>' +
                escapeHtml(record.node.label) +
                '</strong><em>' +
                capitalize(record.node.type) +
                '</em></li>'
            );
        })
        .join('');
}

function updateLinkPositions(link) {
    if (!link.line) return;
    const positionAttr = link.line.geometry.attributes.position;
    const array = positionAttr.array;
    array[0] = link.source.position.x;
    array[1] = link.source.position.y;
    array[2] = link.source.position.z;
    array[3] = link.target.position.x;
    array[4] = link.target.position.y;
    array[5] = link.target.position.z;
    positionAttr.needsUpdate = true;
}

function seedInitialPositions(nodes) {
    nodes.forEach(function (node) {
        const baseRadius = node.type === 'project'
            ? 60
            : (node.type === 'topic' ? 40 : 28);
        const radius = baseRadius * (0.72 + Math.random() * 0.45);
        const theta = Math.random() * Math.PI * 2;
        const u = Math.random() * 2 - 1;
        const root = Math.sqrt(1 - u * u);

        node.position.set(
            radius * root * Math.cos(theta),
            radius * u,
            radius * root * Math.sin(theta)
        );
    });
}

function inferSkills(project) {
    const tags = Array.isArray(project.tags) ? project.tags : [];
    const sourceText = [
        project.title || '',
        project.description || '',
        project.category || '',
        tags.join(' ')
    ]
        .join(' ')
        .toLowerCase();

    const inferred = new Set();

    SKILL_RULES.forEach(function (rule) {
        if (rule.terms.some(function (term) { return sourceText.indexOf(term) !== -1; })) {
            inferred.add(rule.skill);
        }
    });

    if (tags.length >= 4) {
        inferred.add('Systems Thinking Across Disciplines');
    }

    const hasWood = tags.indexOf('Woodworking') !== -1 || sourceText.indexOf('joinery') !== -1;
    const hasMetal = tags.indexOf('Welding') !== -1 ||
        tags.indexOf('Brazing') !== -1 ||
        tags.indexOf('Blacksmithing') !== -1;
    if (hasWood && hasMetal) {
        inferred.add('Hybrid Material Craft');
    }

    const hasRobotics = sourceText.indexOf('robotics') !== -1 || sourceText.indexOf('autonomy') !== -1;
    const hasSensing = sourceText.indexOf('computer vision') !== -1 ||
        sourceText.indexOf('sensor fusion') !== -1 ||
        sourceText.indexOf('iot') !== -1;
    if (hasRobotics && hasSensing) {
        inferred.add('Autonomous System Architecture');
    }

    return Array.from(inferred);
}

function getDesiredLinkLength(link) {
    if (link.relationTypes.has('project-project')) return 34;
    if (link.relationTypes.has('project-skill')) return 30;
    if (link.relationTypes.has('project-topic')) return 27;
    if (link.relationTypes.has('topic-skill')) return 23;
    return 28;
}

function createLabelSprite(text, textColor) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const fontSize = 34;
    const paddingX = 22;
    const paddingY = 14;

    context.font = '500 ' + fontSize + 'px "IBM Plex Mono", monospace';
    const measured = context.measureText(text);
    const width = Math.max(220, Math.ceil(measured.width + paddingX * 2));
    const height = fontSize + paddingY * 2;

    canvas.width = width;
    canvas.height = height;

    context.font = '500 ' + fontSize + 'px "IBM Plex Mono", monospace';
    context.textBaseline = 'middle';
    context.fillStyle = 'rgba(255,255,255,0.82)';
    drawRoundedRect(context, 0, 0, width, height, 16);
    context.fill();

    context.fillStyle = textColor;
    context.fillText(text, paddingX, height / 2 + 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        opacity: 0.9
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set((width / 30) * 0.36, (height / 30) * 0.36, 1);
    sprite.renderOrder = 5;
    return sprite;
}

function drawRoundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width * 0.5, height * 0.5);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
}

function makePairKey(a, b) {
    return a < b ? (a + '|' + b) : (b + '|' + a);
}

function getLinkColor(typeSet) {
    if (typeSet.has('project-skill')) return LINK_COLORS['project-skill'];
    if (typeSet.has('project-topic')) return LINK_COLORS['project-topic'];
    if (typeSet.has('topic-skill')) return LINK_COLORS['topic-skill'];
    if (typeSet.has('project-project')) return LINK_COLORS['project-project'];
    return 0x94a3b8;
}

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function capitalize(value) {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
