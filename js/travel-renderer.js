// ============================================
// TRAVEL RENDERER - Dynamic Card Generation
// ============================================

(function () {
    'use strict';

    var TRAVELS_URL = 'data/travels.json';
    var gridContainer = document.querySelector('.travels-grid');

    if (!gridContainer) return;

    fetch(TRAVELS_URL)
        .then(function (response) {
            if (!response.ok) throw new Error('Failed to load travels');
            return response.json();
        })
        .then(function (data) {
            if (!data.travels || data.travels.length === 0) {
                renderEmpty(gridContainer);
                return;
            }
            renderTravels(data.travels, gridContainer);
            initToggleHandlers(gridContainer);
        })
        .catch(function (err) {
            console.error('Failed to load travels:', err);
            gridContainer.innerHTML =
                '<p style="color: var(--color-gray-700); text-align: center; padding: var(--space-lg);">Unable to load travel log.</p>';
        });

    // ============================================
    // EMPTY STATE
    // ============================================
    function renderEmpty(container) {
        container.innerHTML =
            '<p class="travels-empty">No travels logged yet — check back soon.</p>';
    }

    // ============================================
    // TRAVEL CARDS
    // ============================================
    function renderTravels(travels, container) {
        // Sort newest first
        travels.sort(function (a, b) {
            return b.date.localeCompare(a.date);
        });

        var html = '';
        travels.forEach(function (trip, index) {
            var lazy = index < 3 ? '' : ' loading="lazy"';
            html += renderTravelCard(trip, lazy);
        });

        container.innerHTML = html;
    }

    function renderTravelCard(trip, lazy) {
        var hasLog = trip.entries && trip.entries.length > 0;

        var cardClass = 'travel-card' + (hasLog ? ' travel-card--log' : '');
        var locationLine = trip.region
            ? escapeHtml(trip.location) + ' &mdash; ' + escapeHtml(trip.region)
            : escapeHtml(trip.location);

        var heroHtml = trip.hero
            ? '<img src="' + trip.hero.src + '" alt="' + escapeAttr(trip.hero.alt) + '"' +
              lazy + ' width="1600" height="1000">'
            : '';

        var logHtml = hasLog
            ? '<button class="travel-log-toggle" aria-expanded="false">' +
                  'View Photo Log <span class="toggle-indicator">[+]</span>' +
              '</button>' +
              '<div class="travel-log" hidden>' +
                  renderLogEntries(trip.entries) +
              '</div>'
            : '';

        return (
            '<article class="' + cardClass + '">' +
                '<div class="travel-image">' + heroHtml + '</div>' +
                '<div class="travel-content">' +
                    '<span class="travel-date">' + formatDate(trip.date) + '</span>' +
                    '<h3 class="travel-title">' + locationLine + '</h3>' +
                    (trip.country
                        ? '<span class="travel-country">' + escapeHtml(trip.country) + '</span>'
                        : '') +
                    (trip.description
                        ? '<p class="travel-description">' + escapeHtml(trip.description) + '</p>'
                        : '') +
                    renderTags(trip.tags) +
                    logHtml +
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
            html +=
                '<div class="log-entry">' +
                    '<img src="' + entry.src + '" alt="' + escapeAttr(entry.alt) + '"' +
                        ' loading="lazy" style="width:100%;height:auto;">' +
                    (entry.caption
                        ? '<p class="log-caption">' + escapeHtml(entry.caption) + '</p>'
                        : '') +
                '</div>';
        });
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
    // TOGGLE HANDLERS (log expand/collapse)
    // ============================================
    function initToggleHandlers(container) {
        container.addEventListener('click', function (e) {
            var toggle = e.target.closest('.travel-log-toggle');
            if (!toggle) return;

            var card = toggle.closest('.travel-card--log');
            var log = card.querySelector('.travel-log');
            var isExpanded = toggle.getAttribute('aria-expanded') === 'true';

            toggle.setAttribute('aria-expanded', String(!isExpanded));
            log.hidden = isExpanded;
            toggle.querySelector('.toggle-indicator').textContent = isExpanded ? '[+]' : '[-]';

            if (!isExpanded) {
                card.style.gridColumn = '1 / -1';
                setTimeout(function () {
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
            } else {
                card.style.gridColumn = '';
            }
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
