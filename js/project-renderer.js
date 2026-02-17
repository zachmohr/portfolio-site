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
            initVideoHandlers(gridContainer);
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
                    '<p class="project-description">' + escapeHtml(project.description) + '</p>' +
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
                    '<p class="project-description">' + escapeHtml(project.description) + '</p>' +
                    renderTags(project.tags) +
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
                    ' loading="lazy" width="1200" height="750">' +
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
    // TOGGLE HANDLERS (log expand/collapse)
    // ============================================
    function initToggleHandlers(container) {
        container.addEventListener('click', function (e) {
            var toggle = e.target.closest('.project-log-toggle');
            if (!toggle) return;

            var card = toggle.closest('.project-card--log');
            var log = card.querySelector('.project-log');
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
