// ============================================
// PROJECT RENDERER - Dynamic Card Generation
// ============================================

(function () {
    'use strict';

    var PROJECTS_URL = 'data/projects.json';
    var PROJECTS_ROUTE_BASE = '/projects';
    var gridContainer = document.querySelector('.projects-grid');
    var filterContainer = document.querySelector('.filter-buttons');

    if (!gridContainer) return;

    // Cache-bust the JSON fetch
    var timestamp = new Date().getTime();
    var fetchUrl = PROJECTS_URL + '?v=' + timestamp;

    fetch(fetchUrl)
        .then(function (response) {
            if (!response.ok) throw new Error('Failed to load projects');
            return response.json();
        })
        .then(function (data) {
            assignProjectSlugs(data.projects);
            renderFilterButtons(data.categories, filterContainer);
            renderProjects(data.projects, gridContainer);
            initToggleHandlers(gridContainer);
            initDescriptionToggleHandlers(gridContainer);
            initVideoHandlers(gridContainer);
            initStrobeHandlers(gridContainer);
            initSketchStackHandlers(gridContainer);
            initProjectRouting(gridContainer);
            document.dispatchEvent(new CustomEvent('projectsRendered'));
        })
        .catch(function (err) {
            console.error('Failed to load projects:', err);
            gridContainer.innerHTML =
                '<p style="color: var(--color-gray-700); text-align: center; padding: var(--space-lg);">Unable to load projects.</p>';
        });

    // ============================================
    // FILTER BUTTONS
    // ============================================
    function renderFilterButtons(categories, container) {
        if (!container) return;

        var html = '<button class="filter-btn active" data-filter="all">All</button>';

        categories.forEach(function (cat) {
            html +=
                '<button class="filter-btn" data-filter="' +
                cat.id +
                '">' +
                cat.label +
                '</button>';
        });

        container.innerHTML = html;
    }

    // ============================================
    // PROJECT CARDS
    // ============================================
    function renderProjects(projects, container) {
        // Sort newest first
        projects.sort(function (a, b) {
            return b.date.localeCompare(a.date);
        });

        var html = '';
        projects.forEach(function (project, index) {
            var lazy = index < 3 ? '' : ' loading="lazy"';
            if (project.type === 'log') {
                html += renderLogCard(project, lazy);
            } else {
                html += renderSingleCard(project, lazy);
            }
        });

        container.innerHTML = html;
    }

    function renderSingleCard(project, lazy) {
        var projectSlug = project._routeSlug || '';
        var projectAliases = (project._routeAliases || []).join(',');

        return (
            '<article class="project-card" data-category="' + project.category + '" data-date="' + project.date + '"' +
            ' data-project-slug="' + escapeAttr(projectSlug) + '"' +
            (projectAliases ? ' data-project-aliases="' + escapeAttr(projectAliases) + '"' : '') +
            '>' +
            '<div class="project-image">' +
            '<img src="' + project.hero.src + '" alt="' + escapeAttr(project.hero.alt) + '"' +
            lazy + ' width="1600" height="1000">' +
            '</div>' +
            '<div class="project-content">' +
            '<span class="project-date">' + formatDate(project.date) + '</span>' +
            '<h3 class="project-title">' + escapeHtml(project.title) + '</h3>' +
            renderDescription(project.description) +
            renderTags(project.tags) +
            renderTopLevelVideo(project.video) +
            '</div>' +
            '</article>'
        );
    }

    function renderLogCard(project, lazy) {
        var projectSlug = project._routeSlug || '';
        var projectAliases = (project._routeAliases || []).join(',');

        return (
            '<article class="project-card project-card--log" data-category="' + project.category + '" data-date="' + project.date + '"' +
            ' data-project-slug="' + escapeAttr(projectSlug) + '"' +
            (projectAliases ? ' data-project-aliases="' + escapeAttr(projectAliases) + '"' : '') +
            '>' +
            '<div class="project-image">' +
            '<img src="' + project.hero.src + '" alt="' + escapeAttr(project.hero.alt) + '"' +
            lazy + ' width="1600" height="1000">' +
            '</div>' +
            '<div class="project-content">' +
            '<span class="project-date">' + formatDate(project.date) + '</span>' +
            '<h3 class="project-title">' + escapeHtml(project.title) + '</h3>' +
            renderDescription(project.description) +
            renderTags(project.tags) +
            renderPress(project.press) +
            renderPatents(project.patents) +
            '<button class="project-log-toggle" aria-expanded="false">' +
            'View Build Log <span class="toggle-indicator">[+]</span>' +
            '</button>' +
            '</div>' +
            '<div class="project-log" hidden>' +
            renderLogEntries(project.entries) +
            '</div>' +
            '</article>'
        );
    }

    function assignProjectSlugs(projects) {
        var used = {};

        projects.forEach(function (project) {
            var baseSlug = slugify(project.slug || project.id || project.title || 'project');
            var routeSlug = makeUniqueSlug(baseSlug, used);
            var aliases = [];
            var aliasMap = {};

            project._routeSlug = routeSlug;
            used[routeSlug] = true;

            addAlias(aliases, aliasMap, slugify(project.id || ''), routeSlug);
            addAlias(aliases, aliasMap, slugify(project.title || ''), routeSlug);

            if (Array.isArray(project.slugAliases)) {
                project.slugAliases.forEach(function (alias) {
                    addAlias(aliases, aliasMap, slugify(alias), routeSlug);
                });
            }

            project._routeAliases = aliases;
        });
    }

    function makeUniqueSlug(baseSlug, used) {
        var slug = baseSlug || 'project';
        var suffix = 2;

        while (used[slug]) {
            slug = baseSlug + '-' + suffix;
            suffix++;
        }

        return slug;
    }

    function addAlias(aliases, aliasMap, candidate, canonicalSlug) {
        if (!candidate || candidate === canonicalSlug || aliasMap[candidate]) return;
        aliases.push(candidate);
        aliasMap[candidate] = true;
    }

    function slugify(value) {
        return String(value || '')
            .toLowerCase()
            .trim()
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    // ============================================
    // LOG ENTRIES
    // ============================================
    function renderLogEntries(entries) {
        if (!entries || entries.length === 0) return '';

        var html = '';
        entries.forEach(function (entry) {
            if (entry.type === 'video') {
                html += renderVideoEntry(entry);
            } else if (entry.type === 'strobe') {
                html += renderStrobeEntry(entry);
            } else if (entry.type === 'model') {
                html += renderModelEntry(entry);
            } else if (entry.type === 'sketches') {
                html += renderSketchesEntry(entry);
            } else {
                html += renderImageEntry(entry);
            }
        });
        return html;
    }

    function renderImageEntry(entry) {
        return (
            '<div class="log-entry">' +
            '<img src="' + entry.src + '" alt="' + escapeAttr(entry.alt) + '"' +
            ' loading="lazy" style="width:100%;height:auto;">' +
            (entry.caption
                ? '<p class="log-caption">' + escapeHtml(entry.caption) + '</p>'
                : '') +
            '</div>'
        );
    }

    function renderVideoEntry(entry) {
        var primarySrc = entry.src || '';
        var isEmbed = primarySrc.indexOf('youtube') !== -1 ||
            primarySrc.indexOf('vimeo') !== -1 ||
            primarySrc.indexOf('embed') !== -1;
        var wrapperStyle = getVideoAspectStyle(entry.aspectRatio);

        var mediaHtml;

        if (isEmbed) {
            // Click-to-load iframe embed
            var posterHtml = entry.poster
                ? '<img src="' + entry.poster + '" alt="' + escapeAttr(entry.alt) + '" loading="lazy">'
                : '<div style="width:100%;height:100%;background:var(--color-gray-200);"></div>';

            mediaHtml =
                '<div class="video-wrapper"' + wrapperStyle + '>' +
                '<div class="video-placeholder" data-src="' + escapeAttr(primarySrc) + '">' +
                posterHtml +
                '<button class="video-play-btn" aria-label="Play video">&#9654;</button>' +
                '</div>' +
                '</div>';
        } else {
            // Self-hosted video
            var sourcesHtml = renderVideoSources(entry);
            mediaHtml =
                '<div class="video-wrapper video-wrapper--self-hosted"' + wrapperStyle + '>' +
                '<video controls preload="metadata" playsinline webkit-playsinline' +
                (entry.poster ? ' poster="' + escapeAttr(entry.poster) + '"' : '') +
                (entry.alt ? ' aria-label="' + escapeAttr(entry.alt) + '"' : '') + '>' +
                sourcesHtml +
                'Your browser does not support the video tag.' +
                '</video>' +
                '</div>';
        }

        return (
            '<div class="log-entry log-entry--video">' +
            mediaHtml +
            (entry.caption
                ? '<p class="log-caption">' + escapeHtml(entry.caption) + '</p>'
                : '') +
            '</div>'
        );
    }

    function renderStrobeEntry(entry) {
        if (!entry.base || !entry.overlay) return '';

        var ratio = normalizeAspectRatio(entry.aspectRatio);
        var shiftPx = parseFloat(entry.shiftPx);
        if (!isFinite(shiftPx) || shiftPx <= 0) shiftPx = 10;
        shiftPx = Math.round(shiftPx);

        var durationMs = parseInt(entry.durationMs, 10);
        if (!isFinite(durationMs) || durationMs <= 0) durationMs = 120;
        durationMs = Math.round(durationMs);

        var amplitudeMin = parseInt(entry.amplitudeMin, 10);
        if (!isFinite(amplitudeMin)) amplitudeMin = 4;
        var amplitudeMax = parseInt(entry.amplitudeMax, 10);
        if (!isFinite(amplitudeMax)) amplitudeMax = 40;
        if (amplitudeMax <= amplitudeMin) amplitudeMax = amplitudeMin + 1;
        shiftPx = Math.max(amplitudeMin, Math.min(amplitudeMax, shiftPx));

        var frequencyMin = parseFloat(entry.frequencyMin);
        if (!isFinite(frequencyMin) || frequencyMin <= 0) frequencyMin = 0.4;
        var frequencyMax = parseFloat(entry.frequencyMax);
        if (!isFinite(frequencyMax) || frequencyMax <= frequencyMin) frequencyMax = 3.0;
        var frequencyHz = parseFloat(entry.frequencyDefault);
        if (!isFinite(frequencyHz) || frequencyHz <= 0) {
            frequencyHz = durationToFrequency(durationMs);
        }
        frequencyHz = Math.max(frequencyMin, Math.min(frequencyMax, frequencyHz));

        var frequencyCenter = parseFloat(entry.frequencyCenter);
        if (!isFinite(frequencyCenter) || frequencyCenter <= frequencyMin || frequencyCenter >= frequencyMax) {
            frequencyCenter = frequencyHz;
        }
        durationMs = frequencyToDuration(frequencyHz);
        var frequencySliderPos = frequencyToSliderPosition(frequencyHz, frequencyMin, frequencyCenter, frequencyMax);

        var style = '--strobe-shift:' + shiftPx + 'px;--strobe-duration:' + durationMs + 'ms;';
        if (ratio) style += 'aspect-ratio:' + ratio + ';';

        return (
            '<div class="log-entry log-entry--strobe">' +
            '<div class="strobe-wrapper" style="' + escapeAttr(style) + '"' +
            (entry.alt ? ' role="img" aria-label="' + escapeAttr(entry.alt) + '"' : '') +
            '>' +
            '<img class="strobe-base" src="' + escapeAttr(entry.base) + '" alt="" aria-hidden="true" loading="lazy">' +
            '<img class="strobe-overlay" src="' + escapeAttr(entry.overlay) + '" alt="" aria-hidden="true" loading="lazy">' +
            '</div>' +
            '<div class="strobe-controls" aria-label="Strobe animation controls">' +
            '<label class="strobe-control">' +
            '<span>Amplitude</span>' +
            '<input class="strobe-amplitude" type="range" min="' + amplitudeMin + '" max="' + amplitudeMax + '" step="1" value="' + shiftPx + '">' +
            '<span class="strobe-value strobe-amplitude-value">' + shiftPx + 'px</span>' +
            '</label>' +
            '<label class="strobe-control">' +
            '<span>Frequency</span>' +
            '<input class="strobe-frequency" type="range" min="0" max="100" step="1" value="' + Math.round(frequencySliderPos) + '"' +
            ' data-frequency-min="' + escapeAttr(frequencyMin.toFixed(2)) + '"' +
            ' data-frequency-max="' + escapeAttr(frequencyMax.toFixed(2)) + '"' +
            ' data-frequency-center="' + escapeAttr(frequencyCenter.toFixed(2)) + '">' +
            '<span class="strobe-value strobe-frequency-value">' + formatFrequency(frequencyHz) + '</span>' +
            '</label>' +
            '</div>' +
            (entry.caption
                ? '<p class="log-caption">' + escapeHtml(entry.caption) + '</p>'
                : '') +
            '</div>'
        );
    }

    function renderModelEntry(entry) {
        var modelsAttr = entry.models ? escapeAttr(JSON.stringify(entry.models)) : '';
        var modelSrc = entry.models ? entry.models[0].src : (entry.glb || entry.src);
        var modelArSrc = entry.iosSrc || entry.usdz || '';
        var modelArTitle = entry.arTitle || '';
        var arEnabled = !!modelArSrc;

        if (!modelArSrc && entry.models && entry.models.length > 0) {
            modelArSrc = entry.models[0].iosSrc || entry.models[0].usdz || '';
        }
        if (modelArSrc) arEnabled = true;

        if (!modelArTitle && entry.models && entry.models.length > 0) {
            modelArTitle = entry.models[0].arTitle || entry.models[0].name || '';
        }

        return (
            '<div class="log-entry log-entry--model">' +
            '<div class="model-wrapper model-viewer-container" data-src="' + escapeAttr(modelSrc) + '"' +
            (modelsAttr ? ' data-models="' + modelsAttr + '"' : '') +
            (arEnabled ? ' data-ar-enabled="true"' : '') +
            (modelArSrc ? ' data-ar-src="' + escapeAttr(modelArSrc) + '"' : '') +
            (modelArTitle ? ' data-ar-title="' + escapeAttr(modelArTitle) + '"' : '') +
            (entry.allowCrossSection ? ' data-allow-cross-section="true"' : '') +
            (entry.autoColorize ? ' data-auto-colorize="true"' : '') +
            ' role="img" aria-label="' + escapeAttr(entry.alt) + '">' +
            '</div>' +
            (arEnabled
                ? '<a class="model-ar-link" hidden href="#" aria-label="Open model in augmented reality">Open in AR</a>'
                : '') +
            (entry.caption
                ? '<p class="log-caption">' + escapeHtml(entry.caption) + '</p>'
                : '') +
            '</div>'
        );
    }

    function renderSketchesEntry(entry) {
        var pages = entry.pages;
        if (!pages || pages.length === 0) return '';

        // Seed a simple deterministic random per stack so rotations are stable
        var html = '<div class="log-entry log-entry--sketches">';
        if (entry.caption) {
            html += '<p class="log-caption">' + escapeHtml(entry.caption) + '</p>';
        }
        html += '<div class="sketch-stack' + (entry.layout === 'straight' ? ' sketch-stack--straight' : '') + '" data-count="' + pages.length + '">';

        pages.forEach(function (page, i) {
            var rotation = 0;
            var offsetX = 0;
            var offsetY = 0;

            if (entry.layout !== 'straight') {
                // Deterministic pseudo-random rotation from -4 to 4 degrees
                var seed = hashString(page.src);
                rotation = ((seed % 900) - 450) / 100; // range roughly -4.5 to 4.5
                offsetX = ((seed >> 4) % 600 - 300) / 100; // range roughly -3 to 3 px
                offsetY = ((seed >> 8) % 400 - 200) / 100; // range roughly -2 to 2 px
            }

            var isActive = (i === 0) ? ' sketch-page--active' : '';
            var zIndex = pages.length - i;
            var transformStyle = entry.layout !== 'straight'
                ? 'transform:rotate(' + rotation.toFixed(2) + 'deg) translate(' + offsetX.toFixed(1) + 'px,' + offsetY.toFixed(1) + 'px);'
                : '';

            html +=
                '<div class="sketch-page' + isActive + '" data-index="' + i + '"' +
                ' style="z-index:' + zIndex + ';' + transformStyle + '">' +
                '<img src="' + page.src + '" alt="' + escapeAttr(page.alt) + '" loading="lazy">' +
                '</div>';
        });

        html += '<div class="sketch-nav">' +
            '<button class="sketch-prev" aria-label="Previous sketch">&#8592;</button>' +
            '<span class="sketch-counter">1 / ' + pages.length + '</span>' +
            '<button class="sketch-next" aria-label="Next sketch">&#8594;</button>' +
            '</div>';
        html += '</div></div>';
        return html;
    }

    function hashString(str) {
        var hash = 5381;
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash = hash & 0x7FFFFFFF; // keep positive
        }
        return hash;
    }

    // ============================================
    // TOP-LEVEL VIDEO (single-type projects)
    // ============================================
    function renderTopLevelVideo(videoUrl) {
        if (!videoUrl) return '';

        return (
            '<div class="video-wrapper" style="margin-top: var(--space-sm);">' +
            '<div class="video-placeholder" data-src="' + escapeAttr(videoUrl) + '">' +
            '<div style="width:100%;height:100%;background:var(--color-gray-200);display:flex;align-items:center;justify-content:center;">' +
            '<button class="video-play-btn" aria-label="Play video">&#9654;</button>' +
            '</div>' +
            '</div>' +
            '</div>'
        );
    }

    // ============================================
    // PRESS LINKS
    // ============================================
    function renderPress(press) {
        if (!press || press.length === 0) return '';

        var html = '<div class="project-press">';
        press.forEach(function (item) {
            html += '<a class="press-link" href="' + escapeAttr(item.url) + '" target="_blank" rel="noopener">' +
                '&#x1F4F0; ' + escapeHtml(item.label) +
                '</a>';
        });
        html += '</div>';
        return html;
    }

    // ============================================
    // PATENTS
    // ============================================
    function renderPatents(patents) {
        if (!patents || patents.length === 0) return '';

        var html = '<div class="project-patents">';
        patents.forEach(function (item) {
            html += '<a class="patent-link" href="' + escapeAttr(item.url) + '" target="_blank" rel="noopener">' +
                '&#x2316; ' + escapeHtml(item.label) +
                '</a>';
        });
        html += '</div>';
        return html;
    }

    // ============================================
    // TAGS
    // ============================================
    function renderTags(tags) {
        if (!tags || tags.length === 0) return '';

        var html = '<div class="project-tags">';
        tags.forEach(function (tag) {
            html += '<span class="tag">' + escapeHtml(tag) + '</span>';
        });
        html += '</div>';
        return html;
    }

    // ============================================
    // DESCRIPTION EXPAND/COLLAPSE
    // ============================================
    function splitDescription(text) {
        var maxSentences = 3;
        var re = /[.!?][\"'\)]?(?:[ \n]|$)/g;
        var count = 0;
        var cutoff = -1;
        var match;

        while ((match = re.exec(text)) !== null) {
            count++;
            if (count === maxSentences) {
                cutoff = match.index + match[0].length;
                break;
            }
        }

        var overflow = cutoff === -1 ? '' : text.slice(cutoff).trim();

        if (!overflow) {
            return { preview: text, overflow: '' };
        }

        return {
            preview: text.slice(0, cutoff).trim(),
            overflow: overflow
        };
    }

    function renderDescription(text) {
        var split = splitDescription(text);

        if (!split.overflow) {
            return '<p class="project-description">' + escapeHtml(text) + '</p>';
        }

        return (
            '<p class="project-description">' +
            escapeHtml(split.preview) +
            '<span class="description-extra" hidden> ' + escapeHtml(split.overflow) + '</span>' +
            '</p>' +
            '<button class="description-toggle" aria-expanded="false">' +
            'Read More <span class="toggle-indicator">[+]</span>' +
            '</button>'
        );
    }

    function initDescriptionToggleHandlers(container) {
        container.addEventListener('click', function (e) {
            var toggle = e.target.closest('.description-toggle');
            if (!toggle) return;

            var content = toggle.closest('.project-content');
            var extra = content.querySelector('.description-extra');
            var isExpanded = toggle.getAttribute('aria-expanded') === 'true';

            toggle.setAttribute('aria-expanded', String(!isExpanded));
            extra.hidden = isExpanded;
            toggle.childNodes[0].nodeValue = isExpanded ? 'Read More ' : 'Read Less ';
            toggle.querySelector('.toggle-indicator').textContent = isExpanded ? '[+]' : '[-]';
        });
    }

    // ============================================
    // TOGGLE HANDLERS (log expand/collapse)
    // ============================================
    function initToggleHandlers(container) {
        container.addEventListener('click', function (e) {
            // Skip if clicking interactive elements inside the card (except the log toggle itself)
            if (e.target.closest('a, button:not(.project-log-toggle), input, .description-toggle, .project-log, video, .sketch-nav, .model-controls, .strobe-controls')) return;

            // Allow clicks anywhere on a log card to toggle the build log
            var card = e.target.closest('.project-card--log');
            if (!card) return;

            var toggle = card.querySelector('.project-log-toggle');
            var log = card.querySelector('.project-log');
            if (!toggle || !log) return;

            var isExpanded = toggle.getAttribute('aria-expanded') === 'true';
            var willExpand = !isExpanded;
            setLogCardExpanded(card, willExpand);
            setProjectPath(card.getAttribute('data-project-slug'), false);

            if (willExpand) {
                // Scroll card into view after expanding
                setTimeout(function () {
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
            }
        });
    }

    function setLogCardExpanded(card, shouldExpand) {
        var toggle = card.querySelector('.project-log-toggle');
        var log = card.querySelector('.project-log');
        if (!toggle || !log) return;

        toggle.setAttribute('aria-expanded', String(shouldExpand));
        log.hidden = !shouldExpand;

        var indicator = toggle.querySelector('.toggle-indicator');
        if (indicator) {
            indicator.textContent = shouldExpand ? '[-]' : '[+]';
        }

        if (shouldExpand) {
            card.style.gridColumn = '1 / -1';
        } else {
            card.style.gridColumn = '';
        }
    }

    // ============================================
    // URL ROUTING (deep-linking to projects)
    // ============================================
    function initProjectRouting(container) {
        container.addEventListener('click', function (e) {
            if (e.target.closest('a, button, input, .description-toggle, .project-log, video, .sketch-nav, .model-controls, .strobe-controls')) return;

            var card = e.target.closest('.project-card');
            if (!card || card.classList.contains('project-card--log')) return;

            setProjectPath(card.getAttribute('data-project-slug'), false);
        });

        var initialSlug = getProjectSlugFromLocation();
        if (initialSlug) {
            var card = focusProjectBySlug(container, initialSlug);
            if (card) {
                setProjectPath(card.getAttribute('data-project-slug'), true);
            }
        }

        window.addEventListener('popstate', function () {
            var slug = getProjectSlugFromLocation();
            if (!slug) {
                collapseAllLogCards(container);
                return;
            }
            focusProjectBySlug(container, slug);
        });
    }

    function getProjectSlugFromLocation() {
        var path = normalizePath(window.location.pathname);
        var match = path.match(/^\/projects\/([^\/]+)$/);
        if (match && match[1]) {
            return slugify(decodeURIComponent(match[1]));
        }

        var querySlug = new URLSearchParams(window.location.search).get('project');
        return querySlug ? slugify(querySlug) : '';
    }

    function focusProjectBySlug(container, slug) {
        var card = findProjectCardBySlug(container, slug);
        if (!card) return null;

        if (card.classList.contains('project-card--log')) {
            setLogCardExpanded(card, true);
        }

        // Ensure card is visible if filtering changed it.
        card.style.display = 'block';
        card.style.opacity = '1';
        card.style.transform = 'scale(1)';

        setTimeout(function () {
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);

        return card;
    }

    function findProjectCardBySlug(container, slug) {
        var cards = container.querySelectorAll('.project-card');
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var canonical = card.getAttribute('data-project-slug');
            if (canonical === slug) return card;

            var aliases = card.getAttribute('data-project-aliases');
            if (!aliases) continue;

            var aliasList = aliases.split(',');
            for (var j = 0; j < aliasList.length; j++) {
                if (aliasList[j] === slug) return card;
            }
        }
        return null;
    }

    function collapseAllLogCards(container) {
        var logCards = container.querySelectorAll('.project-card--log');
        for (var i = 0; i < logCards.length; i++) {
            setLogCardExpanded(logCards[i], false);
        }
    }

    function setProjectPath(slug, replace) {
        if (!slug || !window.history || !window.history.pushState) return;

        var targetPath = PROJECTS_ROUTE_BASE + '/' + encodeURIComponent(slug);
        if (normalizePath(window.location.pathname) === normalizePath(targetPath)) {
            return;
        }

        var method = replace ? 'replaceState' : 'pushState';
        window.history[method]({ projectSlug: slug }, '', targetPath);
    }

    function normalizePath(path) {
        return (path || '').replace(/\/+$/, '') || '/';
    }

    // ============================================
    // VIDEO CLICK-TO-LOAD
    // ============================================
    function initVideoHandlers(container) {
        container.addEventListener('click', function (e) {
            var playBtn = e.target.closest('.video-play-btn');
            if (!playBtn) return;

            var placeholder = playBtn.closest('.video-placeholder');
            if (!placeholder) return;

            var wrapper = placeholder.parentElement;
            var videoSrc = placeholder.getAttribute('data-src');

            var iframe = document.createElement('iframe');
            iframe.src = videoSrc + (videoSrc.indexOf('?') !== -1 ? '&' : '?') + 'autoplay=1';
            iframe.setAttribute('allow', 'autoplay; encrypted-media');
            iframe.setAttribute('allowfullscreen', '');
            iframe.setAttribute('title', 'Project video');

            wrapper.replaceChild(iframe, placeholder);
        });

        var videos = container.querySelectorAll('.video-wrapper--self-hosted video');
        for (var i = 0; i < videos.length; i++) {
            bindVideoAspectRatio(videos[i]);
        }
    }

    function initStrobeHandlers(container) {
        container.addEventListener('input', function (e) {
            var amplitudeInput = e.target.closest('.strobe-amplitude');
            if (amplitudeInput) {
                var ampControl = amplitudeInput.closest('.strobe-control');
                var ampWrapper = amplitudeInput.closest('.log-entry--strobe');
                if (!ampControl || !ampWrapper) return;

                var amp = parseInt(amplitudeInput.value, 10);
                if (!isFinite(amp)) return;

                var strobeBox = ampWrapper.querySelector('.strobe-wrapper');
                if (strobeBox) {
                    strobeBox.style.setProperty('--strobe-shift', amp + 'px');
                }

                var ampValue = ampControl.querySelector('.strobe-amplitude-value');
                if (ampValue) ampValue.textContent = amp + 'px';
                return;
            }

            var frequencyInput = e.target.closest('.strobe-frequency');
            if (frequencyInput) {
                var freqControl = frequencyInput.closest('.strobe-control');
                var freqWrapper = frequencyInput.closest('.log-entry--strobe');
                if (!freqControl || !freqWrapper) return;

                var sliderPos = parseFloat(frequencyInput.value);
                if (!isFinite(sliderPos)) return;

                var freqMin = parseFloat(frequencyInput.getAttribute('data-frequency-min'));
                var freqMax = parseFloat(frequencyInput.getAttribute('data-frequency-max'));
                var freqCenter = parseFloat(frequencyInput.getAttribute('data-frequency-center'));
                if (!isFinite(freqMin) || freqMin <= 0) freqMin = 0.25;
                if (!isFinite(freqMax) || freqMax <= freqMin) freqMax = freqMin + 1;
                if (!isFinite(freqCenter) || freqCenter <= freqMin || freqCenter >= freqMax) {
                    freqCenter = (freqMin + freqMax) / 2;
                }

                var freq = sliderPositionToFrequency(sliderPos, freqMin, freqCenter, freqMax);

                var duration = frequencyToDuration(freq);
                var strobeTarget = freqWrapper.querySelector('.strobe-wrapper');
                if (strobeTarget) {
                    strobeTarget.style.setProperty('--strobe-duration', duration + 'ms');
                }

                var freqValue = freqControl.querySelector('.strobe-frequency-value');
                if (freqValue) freqValue.textContent = formatFrequency(freq);
            }
        });
    }

    function bindVideoAspectRatio(video) {
        if (!video) return;

        var applyAspect = function () {
            var wrapper = video.parentElement;
            if (!wrapper) return;
            if (!video.videoWidth || !video.videoHeight) return;
            wrapper.style.aspectRatio = video.videoWidth + ' / ' + video.videoHeight;
        };

        if (video.readyState >= 1) {
            applyAspect();
        } else {
            video.addEventListener('loadedmetadata', applyAspect, { once: true });
        }
    }

    function renderVideoSources(entry) {
        var sources = [];
        if (Array.isArray(entry.sources) && entry.sources.length > 0) {
            sources = entry.sources;
        } else if (entry.src) {
            sources = [{ src: entry.src, mimeType: entry.mimeType }];
        }

        var html = '';
        for (var i = 0; i < sources.length; i++) {
            var source = sources[i];
            if (!source || !source.src) continue;
            var mimeType = source.mimeType || source.type || getVideoMimeType(source.src);
            html += '<source src="' + escapeAttr(source.src) + '"' +
                (mimeType ? ' type="' + escapeAttr(mimeType) + '"' : '') +
                '>';
        }
        return html;
    }

    function getVideoMimeType(src) {
        var cleanSrc = String(src).split('?')[0].toLowerCase();
        if (cleanSrc.endsWith('.mov')) return 'video/quicktime';
        if (cleanSrc.endsWith('.webm')) return 'video/webm';
        if (cleanSrc.endsWith('.ogv') || cleanSrc.endsWith('.ogg')) return 'video/ogg';
        return 'video/mp4';
    }

    function getVideoAspectStyle(aspectRatio) {
        var normalized = normalizeAspectRatio(aspectRatio);
        return normalized ? ' style="aspect-ratio:' + normalized + ';"' : '';
    }

    function normalizeAspectRatio(value) {
        if (typeof value === 'number' && isFinite(value) && value > 0) {
            return String(value);
        }

        if (typeof value !== 'string') return '';

        var trimmed = value.trim();
        if (/^\d+(\.\d+)?$/.test(trimmed)) {
            return trimmed;
        }

        var parts = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
        if (!parts) return '';

        if (parseFloat(parts[1]) <= 0 || parseFloat(parts[2]) <= 0) return '';
        return parts[1] + ' / ' + parts[2];
    }

    function durationToFrequency(durationMs) {
        if (!isFinite(durationMs) || durationMs <= 0) return 1;
        return 500 / durationMs;
    }

    function frequencyToDuration(frequencyHz) {
        if (!isFinite(frequencyHz) || frequencyHz <= 0) return 120;
        return Math.round(500 / frequencyHz);
    }

    function formatFrequency(freq) {
        return freq.toFixed(2) + ' Hz';
    }

    function frequencyToSliderPosition(freq, minFreq, centerFreq, maxFreq) {
        var clampedFreq = Math.max(minFreq, Math.min(maxFreq, freq));
        if (clampedFreq <= centerFreq) {
            if (centerFreq === minFreq) return 50;
            return ((clampedFreq - minFreq) / (centerFreq - minFreq)) * 50;
        }
        if (maxFreq === centerFreq) return 50;
        return 50 + ((clampedFreq - centerFreq) / (maxFreq - centerFreq)) * 50;
    }

    function sliderPositionToFrequency(sliderPos, minFreq, centerFreq, maxFreq) {
        var clampedPos = Math.max(0, Math.min(100, sliderPos));
        if (clampedPos <= 50) {
            return minFreq + (centerFreq - minFreq) * (clampedPos / 50);
        }
        return centerFreq + (maxFreq - centerFreq) * ((clampedPos - 50) / 50);
    }

    // ============================================
    // SKETCH STACK NAVIGATION
    // ============================================
    function initSketchStackHandlers(container) {
        container.addEventListener('click', function (e) {
            var btn = e.target.closest('.sketch-prev, .sketch-next');
            if (!btn) return;

            var stack = btn.closest('.sketch-stack');
            var pages = stack.querySelectorAll('.sketch-page');
            var counter = stack.querySelector('.sketch-counter');
            var total = pages.length;

            // Find current active index
            var currentIndex = 0;
            pages.forEach(function (page, i) {
                if (page.classList.contains('sketch-page--active')) {
                    currentIndex = i;
                }
            });

            var direction = btn.classList.contains('sketch-next') ? 1 : -1;
            var nextIndex = (currentIndex + direction + total) % total;

            // Update active states and z-indexes
            pages.forEach(function (page, i) {
                page.classList.remove('sketch-page--active');
                if (i === nextIndex) {
                    page.classList.add('sketch-page--active');
                    page.style.zIndex = total + 1;
                } else {
                    // Stack order: closer to nextIndex gets higher z
                    var dist = Math.abs(i - nextIndex);
                    if (dist > total / 2) dist = total - dist;
                    page.style.zIndex = total - dist;
                }
            });

            counter.textContent = (nextIndex + 1) + ' / ' + total;
        });

        // Swipe support for touch devices
        var touchStartX = 0;
        container.addEventListener('touchstart', function (e) {
            if (!e.target.closest('.sketch-stack')) return;
            touchStartX = e.touches[0].clientX;
        }, { passive: true });

        container.addEventListener('touchend', function (e) {
            var stack = e.target.closest('.sketch-stack');
            if (!stack) return;

            var touchEndX = e.changedTouches[0].clientX;
            var diff = touchStartX - touchEndX;

            if (Math.abs(diff) < 50) return; // minimum swipe distance

            var btn = diff > 0
                ? stack.querySelector('.sketch-next')
                : stack.querySelector('.sketch-prev');
            if (btn) btn.click();
        }, { passive: true });
    }

    // ============================================
    // UTILITIES
    // ============================================
    function formatDate(dateStr) {
        var parts = dateStr.split('-');
        var months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        var monthIndex = parseInt(parts[1], 10) - 1;
        return months[monthIndex] + ' ' + parts[0];
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function escapeAttr(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
})();
