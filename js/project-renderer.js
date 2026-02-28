// ============================================
// PROJECT RENDERER - Dynamic Card Generation
// ============================================

(function () {
    'use strict';

    var PROJECTS_URL = 'data/projects.json';
    var gridContainer = document.querySelector('.projects-grid');
    var filterContainer = document.querySelector('.filter-buttons');

    if (!gridContainer) return;

    fetch(PROJECTS_URL)
        .then(function (response) {
            if (!response.ok) throw new Error('Failed to load projects');
            return response.json();
        })
        .then(function (data) {
            renderFilterButtons(data.categories, filterContainer);
            renderProjects(data.projects, gridContainer);
            initToggleHandlers(gridContainer);
            initDescriptionToggleHandlers(gridContainer);
            initVideoHandlers(gridContainer);
            initSketchStackHandlers(gridContainer);
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
        return (
            '<article class="project-card" data-category="' + project.category + '" data-date="' + project.date + '">' +
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
        return (
            '<article class="project-card project-card--log" data-category="' + project.category + '" data-date="' + project.date + '">' +
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

    // ============================================
    // LOG ENTRIES
    // ============================================
    function renderLogEntries(entries) {
        if (!entries || entries.length === 0) return '';

        var html = '';
        entries.forEach(function (entry) {
            if (entry.type === 'video') {
                html += renderVideoEntry(entry);
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
        var isEmbed = entry.src.indexOf('youtube') !== -1 ||
                      entry.src.indexOf('vimeo') !== -1 ||
                      entry.src.indexOf('embed') !== -1;

        var mediaHtml;

        if (isEmbed) {
            // Click-to-load iframe embed
            var posterHtml = entry.poster
                ? '<img src="' + entry.poster + '" alt="' + escapeAttr(entry.alt) + '" loading="lazy">'
                : '<div style="width:100%;height:100%;background:var(--color-gray-200);"></div>';

            mediaHtml =
                '<div class="video-wrapper">' +
                    '<div class="video-placeholder" data-src="' + escapeAttr(entry.src) + '">' +
                        posterHtml +
                        '<button class="video-play-btn" aria-label="Play video">&#9654;</button>' +
                    '</div>' +
                '</div>';
        } else {
            // Self-hosted video
            mediaHtml =
                '<div class="video-wrapper">' +
                    '<video controls preload="none"' +
                        (entry.poster ? ' poster="' + entry.poster + '"' : '') +
                        ' width="1200" height="675">' +
                        '<source src="' + entry.src + '" type="video/mp4">' +
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

    function renderModelEntry(entry) {
        var modelSrc = entry.glb || entry.src;

        return (
            '<div class="log-entry log-entry--model">' +
                '<div class="model-wrapper model-viewer-container" data-src="' + escapeAttr(modelSrc) + '"' +
                    ' role="img" aria-label="' + escapeAttr(entry.alt) + '">' +
                '</div>' +
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
        html += '<div class="sketch-stack" data-count="' + pages.length + '">';

        pages.forEach(function (page, i) {
            // Deterministic pseudo-random rotation from -4 to 4 degrees
            var seed = hashString(page.src);
            var rotation = ((seed % 900) - 450) / 100; // range roughly -4.5 to 4.5
            var offsetX = ((seed >> 4) % 600 - 300) / 100; // range roughly -3 to 3 px
            var offsetY = ((seed >> 8) % 400 - 200) / 100; // range roughly -2 to 2 px
            var isActive = (i === 0) ? ' sketch-page--active' : '';
            var zIndex = pages.length - i;

            html +=
                '<div class="sketch-page' + isActive + '" data-index="' + i + '"' +
                    ' style="z-index:' + zIndex + ';' +
                    'transform:rotate(' + rotation.toFixed(2) + 'deg) translate(' + offsetX.toFixed(1) + 'px,' + offsetY.toFixed(1) + 'px);">' +
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
            // Skip if clicking interactive elements inside the card
            if (e.target.closest('a, button, .description-toggle, .project-log, video, .sketch-nav, .model-controls')) return;

            // Allow clicks anywhere on a log card to toggle the build log
            var card = e.target.closest('.project-card--log');
            if (!card) return;

            var toggle = card.querySelector('.project-log-toggle');
            var log = card.querySelector('.project-log');
            if (!toggle || !log) return;

            var isExpanded = toggle.getAttribute('aria-expanded') === 'true';

            toggle.setAttribute('aria-expanded', String(!isExpanded));
            log.hidden = isExpanded;
            toggle.querySelector('.toggle-indicator').textContent = isExpanded ? '[+]' : '[-]';

            if (!isExpanded) {
                card.style.gridColumn = '1 / -1';
                // Scroll card into view after expanding
                setTimeout(function () {
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
            } else {
                card.style.gridColumn = '';
            }
        });
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

            var direction = btn.classList.contains('.sketch-next') ? 1 :
                            btn.classList.contains('sketch-next') ? 1 : -1;
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
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
})();
