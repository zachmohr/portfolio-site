/**
 * Hidden playable chess mode for the SCS Chess Set model viewer.
 *
 * Loaded on demand by project-model-viewer.js for containers with
 * data-chess-game="true". Expects a GLB whose pieces are separate nodes named
 * piece_<red|blue>_<type>_<n> with their origin at the bottom center of the base.
 * Red plays white (moves first), blue plays black.
 */

import * as THREE from 'three';

var CHESS_URL = 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
var PIECE_PATTERN = /^piece_(red|blue)_(king|queen|rook|bishop|knight|pawn)_\d+$/;
var TYPE_CODES = { king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p' };
var PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
var FILES = 'abcdefgh';
var MOVE_MS = 420;
var CAPTURE_MS = 520;

function track(eventName, params) {
    if (typeof window.gtag === 'function') window.gtag('event', eventName, params || {});
}

// Anonymous first-party counters for the private stats page (see functions/api/chess/event.js).
function countEvent(body) {
    try {
        var payload = JSON.stringify(body);
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/chess/event', new Blob([payload], { type: 'application/json' }));
        } else {
            fetch('/api/chess/event', { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true });
        }
    } catch (e) { /* counting must never break the game */ }
}

function forEachMaterial(object, fn) {
    object.traverse(function (child) {
        if (!child.isMesh || !child.material) return;
        (Array.isArray(child.material) ? child.material : [child.material]).forEach(fn);
    });
}

function cloneWithMaterials(object) {
    var copy = object.clone(true);
    copy.traverse(function (child) {
        if (!child.isMesh || !child.material) return;
        child.material = Array.isArray(child.material)
            ? child.material.map(function (m) { return m.clone(); })
            : child.material.clone();
    });
    return copy;
}

function mean(values) {
    return values.reduce(function (sum, v) { return sum + v; }, 0) / values.length;
}

/**
 * Works out the 8x8 grid from where the pieces start: which model axis runs along
 * the files, which along the ranks, the square pitch, and where a1 is.
 */
function deriveGrid(pieces) {
    var redPawns = pieces.filter(function (p) { return p.color === 'w' && p.type === 'p'; });
    var xs = redPawns.map(function (p) { return p.home.x; });
    var zs = redPawns.map(function (p) { return p.home.z; });
    var spreadX = Math.max.apply(null, xs) - Math.min.apply(null, xs);
    var spreadZ = Math.max.apply(null, zs) - Math.min.apply(null, zs);
    var fileAxis = spreadX > spreadZ ? 'x' : 'z';
    var rankAxis = fileAxis === 'x' ? 'z' : 'x';

    function find(color, type) {
        return pieces.filter(function (p) { return p.color === color && p.type === type; });
    }

    var redKing = find('w', 'k')[0];
    var redQueen = find('w', 'q')[0];
    var fileDir = Math.sign(redKing.home[fileAxis] - redQueen.home[fileAxis]) || 1;

    var redBack = pieces.filter(function (p) { return p.color === 'w' && p.type !== 'p'; });
    var blueBack = pieces.filter(function (p) { return p.color === 'b' && p.type !== 'p'; });
    var bluePawns = find('b', 'p');
    var rankSpan = mean(blueBack.map(function (p) { return p.home[rankAxis]; })) -
        mean(redBack.map(function (p) { return p.home[rankAxis]; }));
    var rankDir = Math.sign(rankSpan) || 1;
    var pitch = Math.abs(rankSpan) / 7;

    var sortedPawnFiles = redPawns.map(function (p) { return p.home[fileAxis]; })
        .sort(function (a, b) { return (a - b) * fileDir; });
    var fileOrigin = mean(sortedPawnFiles.map(function (v, i) { return v - i * pitch * fileDir; }));

    var rankSamples = [];
    redBack.forEach(function (p) { rankSamples.push(p.home[rankAxis]); });
    redPawns.forEach(function (p) { rankSamples.push(p.home[rankAxis] - pitch * rankDir); });
    bluePawns.forEach(function (p) { rankSamples.push(p.home[rankAxis] - 6 * pitch * rankDir); });
    blueBack.forEach(function (p) { rankSamples.push(p.home[rankAxis] - 7 * pitch * rankDir); });
    var rankOrigin = mean(rankSamples);

    return {
        fileAxis: fileAxis,
        rankAxis: rankAxis,
        fileDir: fileDir,
        rankDir: rankDir,
        pitch: pitch,
        center: function (file, rank, y) {
            var v = new THREE.Vector3(0, y || 0, 0);
            v[fileAxis] = fileOrigin + file * pitch * fileDir;
            v[rankAxis] = rankOrigin + rank * pitch * rankDir;
            return v;
        },
        squareAt: function (point) {
            var file = Math.round((point[fileAxis] - fileOrigin) / (pitch * fileDir));
            var rank = Math.round((point[rankAxis] - rankOrigin) / (pitch * rankDir));
            if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
            return FILES[file] + (rank + 1);
        }
    };
}

function squareCoords(square) {
    return { file: FILES.indexOf(square[0]), rank: Number(square[1]) - 1 };
}

// Small alpha-beta search for the computer opponent (plays blue / black).
function evaluate(game) {
    var score = 0;
    var board = game.board();
    for (var r = 0; r < 8; r++) {
        for (var f = 0; f < 8; f++) {
            var sq = board[r][f];
            if (!sq) continue;
            var centerBonus = (3.5 - Math.abs(3.5 - f)) * 4 + (3.5 - Math.abs(3.5 - r)) * 4;
            var value = PIECE_VALUES[sq.type] + (sq.type === 'p' || sq.type === 'n' || sq.type === 'b' ? centerBonus : 0);
            score += sq.color === 'b' ? value : -value;
        }
    }
    return score;
}

function search(game, depth, alpha, beta, maximizing) {
    if (depth === 0 || game.isGameOver()) {
        if (game.isCheckmate()) return maximizing ? -100000 - depth : 100000 + depth;
        if (game.isDraw() || game.isStalemate()) return 0;
        return evaluate(game);
    }
    var moves = game.moves({ verbose: true });
    moves.sort(function (a, b) { return (b.captured ? PIECE_VALUES[b.captured] : 0) - (a.captured ? PIECE_VALUES[a.captured] : 0); });
    var best = maximizing ? -Infinity : Infinity;
    for (var i = 0; i < moves.length; i++) {
        game.move(moves[i]);
        var value = search(game, depth - 1, alpha, beta, !maximizing);
        game.undo();
        if (maximizing) {
            best = Math.max(best, value);
            alpha = Math.max(alpha, value);
        } else {
            best = Math.min(best, value);
            beta = Math.min(beta, value);
        }
        if (beta <= alpha) break;
    }
    return best;
}

function pickComputerMove(game) {
    var moves = game.moves({ verbose: true });
    var bestScore = -Infinity;
    var best = [];
    moves.forEach(function (move) {
        game.move(move);
        var score = search(game, 2, -Infinity, Infinity, false);
        game.undo();
        if (score > bestScore + 5) {
            bestScore = score;
            best = [move];
        } else if (Math.abs(score - bestScore) <= 5) {
            best.push(move);
        }
    });
    return best[Math.floor(Math.random() * best.length)];
}

export function attachChessGame(ctx) {
    var model = ctx.model;
    var container = ctx.container;
    var canvas = ctx.canvas;
    var camera = ctx.camera;
    var controls = ctx.controls;

    var pieceNodes = [];
    model.traverse(function (obj) {
        if (PIECE_PATTERN.test(obj.name) && !(obj.parent && PIECE_PATTERN.test(obj.parent.name))) {
            pieceNodes.push(obj);
        }
    });
    if (pieceNodes.length !== 32) {
        console.warn('Chess game: expected 32 pieces, found ' + pieceNodes.length);
        return null;
    }

    var pieces = pieceNodes.map(function (node) {
        model.attach(node);
        var match = PIECE_PATTERN.exec(node.name);
        return {
            node: node,
            color: match[1] === 'red' ? 'w' : 'b',
            type: TYPE_CODES[match[2]],
            home: node.position.clone(),
            homeQuaternion: node.quaternion.clone()
        };
    });

    // The viewer's matte finish washes the paint out to pastel; restore saturated pieces.
    pieces.forEach(function (p) {
        forEachMaterial(p.node, function (m) {
            m.color.setHex(p.color === 'w' ? 0xD62839 : 0x1E3A8A);
            m.roughness = 0.4;
            m.metalness = 0.05;
        });
    });

    var grid = deriveGrid(pieces);
    var baseY = mean(pieces.map(function (p) { return p.home.y; }));
    var groundY = new THREE.Box3().setFromObject(model).min.y - model.position.y;

    // Map every piece to its starting square and make sure it is a legal opening setup.
    var homeSquares = new Map();
    var setupOk = true;
    var expected = { a: 'r', b: 'n', c: 'b', d: 'q', e: 'k', f: 'b', g: 'n', h: 'r' };
    pieces.forEach(function (p) {
        var square = grid.squareAt(p.home);
        p.homeSquare = square;
        if (!square || homeSquares.has(square)) setupOk = false;
        homeSquares.set(square, p);
        var rank = square ? Number(square[1]) : 0;
        var backRank = p.color === 'w' ? 1 : 8;
        var pawnRank = p.color === 'w' ? 2 : 7;
        if (p.type === 'p' ? rank !== pawnRank : (rank !== backRank || expected[square[0]] !== p.type)) setupOk = false;
    });
    if (!setupOk) {
        console.warn('Chess game: piece layout does not match a starting position');
        return null;
    }

    var Chess = null;
    var game = null;
    var playing = false;
    var vsComputer = true;
    var thinking = false;
    var selected = null;
    var bySquare = new Map();
    var extraNodes = [];
    var captured = { w: 0, b: 0 };
    var tweens = [];
    var markers = new THREE.Group();
    markers.name = 'chess-markers';
    model.add(markers);

    // ---------- UI ----------
    var hint = document.createElement('button');
    hint.type = 'button';
    hint.className = 'chess-hint';
    hint.innerHTML = '&#9823; Play chess';
    hint.setAttribute('aria-label', 'Play chess on this board');
    container.appendChild(hint);
    // At the top of a project card the game is the headline, so the button is always shown.
    if (container.closest('.project-image--model')) container.classList.add('chess-hint-always');

    var panel = document.createElement('div');
    panel.className = 'chess-panel';
    panel.hidden = true;
    panel.innerHTML =
        '<div class="chess-status" aria-live="polite"></div>' +
        '<div class="chess-actions">' +
        '<button type="button" data-chess="mode"></button>' +
        '<button type="button" data-chess="undo">Undo</button>' +
        '<button type="button" data-chess="new">New game</button>' +
        '<button type="button" data-chess="scores">Scores</button>' +
        '<button type="button" data-chess="fullscreen">Full screen</button>' +
        '<button type="button" data-chess="exit">Exit</button>' +
        '</div>';
    container.appendChild(panel);
    var statusEl = panel.querySelector('.chess-status');
    var modeBtn = panel.querySelector('[data-chess="mode"]');
    var fullscreenBtn = panel.querySelector('[data-chess="fullscreen"]');

    // End-of-game card (vs computer) and the leaderboard sheet.
    var resultCard = document.createElement('div');
    resultCard.className = 'chess-card chess-result';
    resultCard.hidden = true;
    resultCard.innerHTML =
        '<h3 class="chess-card-title"></h3>' +
        '<p class="chess-card-text"></p>' +
        '<form class="chess-name-form">' +
        '<label class="chess-name-label" for="chess-name-' + Math.random().toString(36).slice(2, 8) + '">Your name for the leaderboard</label>' +
        '<div class="chess-name-row">' +
        '<input class="chess-name-input" type="text" maxlength="20" autocomplete="nickname" enterkeyhint="done" required>' +
        '<button type="submit">Save score</button>' +
        '</div>' +
        '<p class="chess-form-msg" aria-live="polite"></p>' +
        '</form>' +
        '<div class="chess-card-actions">' +
        '<button type="button" data-chess="new">Play again</button>' +
        '<button type="button" data-chess="scores">Scores</button>' +
        '</div>';
    container.appendChild(resultCard);
    var nameInput = resultCard.querySelector('.chess-name-input');
    nameInput.id = resultCard.querySelector('.chess-name-label').getAttribute('for');
    var nameForm = resultCard.querySelector('.chess-name-form');
    var formMsg = resultCard.querySelector('.chess-form-msg');

    var scoresCard = document.createElement('div');
    scoresCard.className = 'chess-card chess-scores';
    scoresCard.hidden = true;
    scoresCard.innerHTML =
        '<h3 class="chess-card-title">Leaderboard</h3>' +
        '<p class="chess-card-text">Everyone who saves a game stays on the board for good. Win = 3, draw = 1, vs the computer only.</p>' +
        '<p class="chess-scores-count"></p>' +
        '<ol class="chess-scores-list"></ol>' +
        '<div class="chess-card-actions"><button type="button" data-chess="close-scores">Close</button></div>';
    container.appendChild(scoresCard);
    var scoresList = scoresCard.querySelector('.chess-scores-list');
    var scoresCount = scoresCard.querySelector('.chess-scores-count');

    function updateModeLabel() {
        modeBtn.textContent = vsComputer ? 'vs CPU' : '2 Players';
        modeBtn.setAttribute('aria-pressed', vsComputer ? 'true' : 'false');
    }

    function setStatus() {
        if (!game) return;
        var side = game.turn() === 'w' ? 'Red' : 'Blue';
        var other = game.turn() === 'w' ? 'Blue' : 'Red';
        var text;
        if (game.isCheckmate()) text = 'Checkmate. ' + other + ' wins.';
        else if (game.isStalemate()) text = 'Stalemate. Draw.';
        else if (game.isDraw()) text = 'Draw.';
        else if (thinking) text = 'Blue is thinking...';
        else text = side + ' to move' + (game.inCheck() ? '. Check!' : '');
        statusEl.textContent = text;
    }

    // ---------- Visual helpers ----------
    function squareCenter(square, y) {
        var c = squareCoords(square);
        return grid.center(c.file, c.rank, y === undefined ? baseY : y);
    }

    function setHighlight(node, on) {
        forEachMaterial(node, function (m) {
            if (!m.emissive) return;
            m.emissive.setHex(on ? 0x444444 : 0x000000);
        });
    }

    function clearMarkers() {
        while (markers.children.length) {
            var m = markers.children.pop();
            m.geometry.dispose();
            m.material.dispose();
        }
    }

    function showMarkers(moves) {
        clearMarkers();
        moves.forEach(function (move) {
            var isCapture = Boolean(move.captured);
            var geom = isCapture
                ? new THREE.RingGeometry(grid.pitch * 0.36, grid.pitch * 0.46, 40)
                : new THREE.CircleGeometry(grid.pitch * 0.16, 32);
            var mat = new THREE.MeshBasicMaterial({
                color: isCapture ? 0xffd166 : 0xffffff,
                transparent: true,
                opacity: 0.8,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            var marker = new THREE.Mesh(geom, mat);
            marker.rotation.x = -Math.PI / 2;
            marker.position.copy(squareCenter(move.to, baseY + grid.pitch * 0.02));
            marker.renderOrder = 10;
            markers.add(marker);
        });
    }

    function tween(node, to, duration, arcHeight, done) {
        tweens = tweens.filter(function (t) { return t.node !== node; });
        tweens.push({
            node: node,
            from: node.position.clone(),
            to: to.clone(),
            start: performance.now(),
            duration: duration,
            arc: arcHeight || 0,
            done: done
        });
    }

    function stepTweens(now) {
        if (!tweens.length) return;
        tweens = tweens.filter(function (t) {
            var k = Math.min(1, (now - t.start) / t.duration);
            var eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            t.node.position.lerpVectors(t.from, t.to, eased);
            t.node.position.y += Math.sin(Math.PI * k) * t.arc;
            if (k >= 1) {
                if (t.done) t.done();
                return false;
            }
            return true;
        });
    }

    function graveyardSlot(color) {
        // Captured red pieces line up off the a-file side, blue off the h-file side.
        var index = captured[color]++;
        var file = color === 'w' ? -1.4 - Math.floor(index / 8) * 0.8 : 8.4 + Math.floor(index / 8) * 0.8;
        var rank = color === 'w' ? 7 - (index % 8) : index % 8;
        return grid.center(file, rank, groundY);
    }

    function deselect() {
        if (selected) {
            setHighlight(selected.node, false);
            if (!tweens.some(function (t) { return t.node === selected.node; })) {
                selected.node.position.copy(squareCenter(selected.square));
            }
        }
        selected = null;
        clearMarkers();
    }

    // ---------- Applying moves to the 3D pieces ----------
    function placeAll() {
        tweens = [];
        extraNodes.forEach(function (node) { model.remove(node); });
        extraNodes = [];
        captured = { w: 0, b: 0 };
        bySquare = new Map();
        pieces.forEach(function (p) {
            p.node.visible = true;
            p.node.position.copy(p.home);
            p.node.quaternion.copy(p.homeQuaternion);
            setHighlight(p.node, false);
            bySquare.set(p.homeSquare, { node: p.node, color: p.color, type: p.type });
        });
    }

    function promote(entry, color) {
        var queen = pieces.find(function (p) { return p.color === color && p.type === 'q'; });
        var node = cloneWithMaterials(queen.node);
        node.name = 'promoted_' + color + '_q';
        node.position.copy(entry.node.position);
        model.add(node);
        extraNodes.push(node);
        entry.node.visible = false;
        return { node: node, color: color, type: 'q' };
    }

    function applyMove(move, animate) {
        var mover = bySquare.get(move.from);
        bySquare.delete(move.from);

        var capturedSquare = move.flags.indexOf('e') !== -1 ? move.to[0] + move.from[1] : move.to;
        var victim = move.captured ? bySquare.get(capturedSquare) : null;
        if (victim) {
            bySquare.delete(capturedSquare);
            var slot = graveyardSlot(victim.color);
            if (animate) tween(victim.node, slot, CAPTURE_MS, grid.pitch * 0.8);
            else victim.node.position.copy(slot);
        }

        var target = squareCenter(move.to);
        var arc = mover.type === 'n' ? grid.pitch * 0.6 : grid.pitch * 0.15;
        var finish = function () {
            if (move.promotion) {
                var promoted = promote(mover, mover.color);
                bySquare.set(move.to, promoted);
            }
        };
        bySquare.set(move.to, mover);
        if (animate) {
            tween(mover.node, target, MOVE_MS, arc, finish);
        } else {
            mover.node.position.copy(target);
            finish();
        }

        if (move.flags.indexOf('k') !== -1 || move.flags.indexOf('q') !== -1) {
            var rank = move.from[1];
            var rookFrom = (move.flags.indexOf('k') !== -1 ? 'h' : 'a') + rank;
            var rookTo = (move.flags.indexOf('k') !== -1 ? 'f' : 'd') + rank;
            var rook = bySquare.get(rookFrom);
            bySquare.delete(rookFrom);
            bySquare.set(rookTo, rook);
            if (animate) tween(rook.node, squareCenter(rookTo), MOVE_MS, grid.pitch * 0.6);
            else rook.node.position.copy(squareCenter(rookTo));
        }
    }

    function rebuildFromHistory() {
        deselect();
        placeAll();
        var history = game.history({ verbose: true });
        history.forEach(function (move) { applyMove(move, false); });
    }

    function checkGameOver() {
        if (!game.isGameOver()) return false;
        track('chess_game_over', { result: statusEl.textContent, ranked: ranked });
        var outcome = game.isCheckmate() ? (game.turn() === 'b' ? 'win' : 'loss') : 'draw';
        countEvent(ranked ? { type: 'finish', result: outcome } : { type: 'finish' });
        if (ranked) setTimeout(showResult, MOVE_MS + 300);
        return true;
    }

    function afterMove() {
        setStatus();
        if (checkGameOver()) return;
        if (vsComputer && game.turn() === 'b') {
            thinking = true;
            setStatus();
            setTimeout(function () {
                if (!playing || !game || game.turn() !== 'b') { thinking = false; return; }
                var reply = pickComputerMove(game);
                game.move(reply);
                applyMove(reply, true);
                thinking = false;
                setStatus();
                checkGameOver();
            }, MOVE_MS + 120);
        }
    }

    // ---------- Leaderboard ----------
    var LEADERBOARD_URL = '/api/chess/leaderboard';
    var NAME_KEY = 'scs-chess-name';
    var ranked = true;

    function savedName() {
        try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
    }

    function rememberName(name) {
        try { localStorage.setItem(NAME_KEY, name); } catch (e) { /* storage unavailable */ }
    }

    function showResult() {
        if (!playing || !game || !game.isGameOver()) return;
        var title = resultCard.querySelector('.chess-card-title');
        var text = resultCard.querySelector('.chess-card-text');
        if (game.isCheckmate() && game.turn() === 'b') {
            title.textContent = 'You win!';
            text.textContent = 'Checkmate in ' + Math.ceil(game.history().length / 2) + ' moves. Put your name on the board.';
        } else if (game.isCheckmate()) {
            title.textContent = 'Blue wins';
            text.textContent = 'The computer got you this time. Losses count too, so save it if you are keeping score.';
        } else {
            title.textContent = 'Draw';
            text.textContent = 'A draw is worth a point on the leaderboard.';
        }
        nameInput.value = savedName();
        formMsg.textContent = '';
        nameForm.hidden = false;
        nameForm.querySelector('button').disabled = false;
        scoresCard.hidden = true;
        resultCard.hidden = false;
    }

    function sinceLabel(iso) {
        if (!iso) return '';
        var date = new Date(iso);
        if (isNaN(date)) return '';
        return 'since ' + date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    function renderScores(players, highlight, total) {
        scoresList.textContent = '';
        var count = total || players.length;
        scoresCount.textContent = count ? count + (count === 1 ? ' player has' : ' players have') + ' left their mark.' : '';
        var mine = null;
        if (!players.length) {
            var empty = document.createElement('li');
            empty.className = 'chess-scores-empty';
            empty.textContent = 'No scores yet. Beat the computer to be first.';
            scoresList.appendChild(empty);
            return;
        }
        players.forEach(function (p) {
            var li = document.createElement('li');
            if (highlight && p.name.toLowerCase() === highlight.toLowerCase()) li.className = 'is-you';
            var name = document.createElement('span');
            name.className = 'chess-scores-name';
            name.textContent = p.name;
            var since = document.createElement('span');
            since.className = 'chess-scores-since';
            since.textContent = sinceLabel(p.since);
            name.appendChild(since);
            var record = document.createElement('span');
            record.className = 'chess-scores-record';
            record.textContent = p.points + ' pts · ' + p.wins + 'W ' + p.draws + 'D ' + p.losses + 'L';
            li.appendChild(name);
            li.appendChild(record);
            scoresList.appendChild(li);
            if (li.className === 'is-you') mine = li;
        });
        if (mine) mine.scrollIntoView({ block: 'nearest' });
    }

    function showScores(players, highlight, total) {
        resultCard.hidden = true;
        scoresCard.hidden = false;
        if (players) {
            renderScores(players, highlight, total);
            return;
        }
        scoresList.innerHTML = '<li class="chess-scores-empty">Loading...</li>';
        fetch(LEADERBOARD_URL, { cache: 'no-store' })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.error) throw new Error(data.error);
                renderScores(data.players || [], savedName(), data.total);
            })
            .catch(function () {
                scoresList.innerHTML = '<li class="chess-scores-empty">Could not load the leaderboard.</li>';
            });
    }

    nameForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var name = nameInput.value.replace(/\s+/g, ' ').trim();
        if (!name) return;
        var button = nameForm.querySelector('button');
        button.disabled = true;
        formMsg.textContent = 'Saving...';
        fetch(LEADERBOARD_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, moves: game.history() })
        })
            .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
            .then(function (out) {
                if (!out.ok) throw new Error(out.data.error || 'Could not save your score.');
                rememberName(out.data.player.name);
                track('chess_score_saved', { result: out.data.result });
                countEvent({ type: 'saved' });
                showScores(out.data.players, out.data.player.name, out.data.total);
            })
            .catch(function (err) {
                formMsg.textContent = err.message;
                button.disabled = false;
            });
    });

    function tryMove(from, to) {
        var legal = game.moves({ square: from, verbose: true }).filter(function (m) { return m.to === to; });
        if (!legal.length) return false;
        var move = legal.find(function (m) { return !m.promotion || m.promotion === 'q'; }) || legal[0];
        deselect();
        var made = game.move({ from: move.from, to: move.to, promotion: move.promotion ? 'q' : undefined });
        applyMove(made, true);
        afterMove();
        return true;
    }

    // ---------- Input ----------
    var raycaster = new THREE.Raycaster();
    var pointer = new THREE.Vector2();
    var downAt = null;

    function pick(event) {
        var rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        var nodes = [];
        bySquare.forEach(function (entry) { nodes.push(entry.node); });
        var hits = raycaster.intersectObjects(nodes, true).filter(function (h) { return h.object.isMesh; });
        if (hits.length) {
            var obj = hits[0].object;
            while (obj && nodes.indexOf(obj) === -1) obj = obj.parent;
            var found = null;
            bySquare.forEach(function (entry, square) { if (entry.node === obj) found = square; });
            if (found) return found;
        }

        var planeY = baseY + model.position.y;
        var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
        var point = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(plane, point)) return null;
        return grid.squareAt(model.worldToLocal(point));
    }

    function canAct() {
        return playing && game && !game.isGameOver() && !thinking && !tweens.length &&
            !(vsComputer && game.turn() === 'b');
    }

    function onPointerDown(event) {
        downAt = { x: event.clientX, y: event.clientY, t: performance.now() };
    }

    function onPointerUp(event) {
        if (!playing || !downAt) return;
        var moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
        var quick = performance.now() - downAt.t < 600;
        downAt = null;
        if (moved > 6 || !quick || !canAct()) return;

        var square = pick(event);
        if (!square) { deselect(); return; }

        if (selected && selected.square !== square && tryMove(selected.square, square)) return;

        var entry = bySquare.get(square);
        if (entry && entry.color === game.turn()) {
            if (selected && selected.square === square) { deselect(); return; }
            deselect();
            selected = { square: square, node: entry.node };
            setHighlight(entry.node, true);
            entry.node.position.y = baseY + grid.pitch * 0.18;
            showMarkers(game.moves({ square: square, verbose: true }));
        } else {
            deselect();
        }
    }

    function onPointerMove(event) {
        if (!playing || !canAct() || event.buttons) return;
        var square = pick(event);
        var entry = square ? bySquare.get(square) : null;
        canvas.style.cursor = entry && entry.color === game.turn() ? 'pointer' : (selected ? 'crosshair' : '');
    }

    // Touch devices have no hover, so a tap on the model reveals the button instead.
    function onTouchReveal(event) {
        if (event.pointerType !== 'mouse') container.classList.add('chess-hint-visible');
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onTouchReveal);

    // ---------- Camera ----------
    var cameraTween = null;

    function flyToPlayerView() {
        var target = model.localToWorld(grid.center(3.5, 3.5, baseY));
        // Fit the board plus the captured-piece rows on either side to the current viewport,
        // looking steeper on portrait screens so the board fills a phone.
        var vfov = camera.fov * Math.PI / 180;
        var hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
        // On narrow screens frame the board itself (captured pieces may sit just off-screen)
        // so the pieces are big enough to tap.
        var width = grid.pitch * (camera.aspect < 1 ? 10.3 : 11.5);
        // Leave room for the status line on top and the button bar on the bottom.
        var depth = grid.pitch * (isFullscreen() && camera.aspect < 1 ? 11.5 : 9);
        var elevation = (camera.aspect < 1 ? 64 : 52) * Math.PI / 180;
        var dist = Math.max(
            (width / 2) / Math.tan(hfov / 2),
            (depth * Math.sin(elevation) / 2) / Math.tan(vfov / 2)
        ) * 1.08;
        var back = new THREE.Vector3();
        back[grid.rankAxis] = -grid.rankDir;
        var to = target.clone()
            .add(back.multiplyScalar(dist * Math.cos(elevation)))
            .add(new THREE.Vector3(0, dist * Math.sin(elevation), 0));
        cameraTween = {
            fromPos: camera.position.clone(),
            toPos: to,
            fromTarget: controls.target.clone(),
            toTarget: target,
            start: performance.now(),
            duration: 900
        };
    }

    function stepCamera(now) {
        if (!cameraTween) return;
        var k = Math.min(1, (now - cameraTween.start) / cameraTween.duration);
        var eased = 1 - Math.pow(1 - k, 3);
        camera.position.lerpVectors(cameraTween.fromPos, cameraTween.toPos, eased);
        controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, eased);
        if (k >= 1) cameraTween = null;
    }

    ctx.registerFrame(function (now) {
        stepTweens(now);
        stepCamera(now);
    });

    // ---------- Start / stop ----------
    function loadChess() {
        if (Chess) return Promise.resolve(Chess);
        return import(CHESS_URL).then(function (mod) {
            Chess = mod.Chess;
            return Chess;
        });
    }

    // ---------- Full screen ----------
    // Uses the Fullscreen API where it exists; iPhone Safari only allows it for <video>,
    // so the .chess-fullscreen class also pins the viewer over the whole viewport.
    var isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var nativeFullscreen = false;
    // Phones and tablets always play full screen, so there is no toggle to show.
    if (isTouch) {
        fullscreenBtn.hidden = true;
        container.classList.add('chess-touch');
    }

    function isFullscreen() {
        return container.classList.contains('chess-fullscreen');
    }

    function refitSoon() {
        setTimeout(function () { if (playing) flyToPlayerView(); }, 260);
    }

    // Project cards use transforms and scroll fades, which trap position: fixed, so the
    // viewer moves to <body> while full screen and returns to this placeholder after.
    var placeholder = document.createComment('chess viewer');

    function enterFullscreen() {
        if (isFullscreen()) return;
        container.parentNode.insertBefore(placeholder, container);
        document.body.appendChild(container);
        container.classList.add('chess-fullscreen');
        document.documentElement.classList.add('chess-scroll-lock');
        fullscreenBtn.textContent = 'Exit full screen';
        var request = container.requestFullscreen || container.webkitRequestFullscreen;
        if (request) {
            try {
                var result = request.call(container);
                nativeFullscreen = true;
                if (result && result.catch) result.catch(function () { nativeFullscreen = false; });
            } catch (e) {
                nativeFullscreen = false;
            }
        }
        refitSoon();
    }

    function exitFullscreen() {
        if (!isFullscreen()) return;
        container.classList.remove('chess-fullscreen');
        document.documentElement.classList.remove('chess-scroll-lock');
        fullscreenBtn.textContent = 'Full screen';
        var current = document.fullscreenElement || document.webkitFullscreenElement;
        if (current === container) {
            var exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) exit.call(document);
        }
        nativeFullscreen = false;
        if (placeholder.parentNode) {
            placeholder.parentNode.insertBefore(container, placeholder);
            placeholder.remove();
        }
        refitSoon();
    }

    // Leaving native full screen with Esc or the Android back gesture.
    function onFullscreenChange() {
        var current = document.fullscreenElement || document.webkitFullscreenElement;
        if (nativeFullscreen && current !== container) exitFullscreen();
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    // Re-frame the board when the phone rotates or the window resizes mid-game.
    var lastAspect = camera.aspect;
    var resizeWatch = new ResizeObserver(function () {
        if (!playing) return;
        clearTimeout(resizeWatch.timer);
        resizeWatch.timer = setTimeout(function () {
            if (Math.abs(camera.aspect - lastAspect) > 0.05) {
                lastAspect = camera.aspect;
                flyToPlayerView();
            }
        }, 200);
    });
    resizeWatch.observe(container);

    function start() {
        hint.disabled = true;
        // Must run inside the tap's user gesture for the browser to allow full screen.
        if (isTouch) enterFullscreen();
        loadChess().then(function () {
            game = new Chess();
            playing = true;
            thinking = false;
            ranked = vsComputer;
            controls.autoRotate = false;
            placeAll();
            updateModeLabel();
            setStatus();
            panel.hidden = false;
            hint.hidden = true;
            container.classList.add('chess-playing');
            lastAspect = camera.aspect;
            flyToPlayerView();
            track('chess_game_start', { fullscreen: isFullscreen() });
            countEvent({ type: 'start' });
        }).catch(function (err) {
            console.error('Chess game: could not load rules engine', err);
            hint.disabled = false;
            exitFullscreen();
        });
    }

    function stop() {
        playing = false;
        thinking = false;
        deselect();
        placeAll();
        game = null;
        exitFullscreen();
        resultCard.hidden = true;
        scoresCard.hidden = true;
        panel.hidden = true;
        hint.hidden = false;
        hint.disabled = false;
        canvas.style.cursor = '';
        container.classList.remove('chess-playing');
    }

    hint.addEventListener('click', start);
    function onAction(event) {
        var target = event.target.closest('[data-chess]');
        var action = target && target.getAttribute('data-chess');
        if (!action || !game) return;
        if (action === 'exit') { stop(); return; }
        if (action === 'fullscreen') {
            if (isFullscreen()) exitFullscreen(); else enterFullscreen();
            return;
        }
        if (action === 'scores') {
            if (scoresCard.hidden) showScores(); else scoresCard.hidden = true;
            return;
        }
        if (action === 'close-scores') { scoresCard.hidden = true; return; }
        if (action === 'new') {
            game.reset();
            countEvent({ type: 'start' });
            thinking = false;
            ranked = vsComputer;
            resultCard.hidden = true;
            scoresCard.hidden = true;
            rebuildFromHistory();
            setStatus();
            return;
        }
        if (action === 'undo') {
            if (thinking || tweens.length) return;
            resultCard.hidden = true;
            game.undo();
            if (vsComputer && game.turn() === 'b') game.undo();
            rebuildFromHistory();
            setStatus();
            return;
        }
        if (action === 'mode') {
            vsComputer = !vsComputer;
            // A game that was ever two-player can't go on the leaderboard.
            if (!vsComputer) ranked = false;
            updateModeLabel();
            afterMove();
        }
    }
    panel.addEventListener('click', onAction);
    resultCard.addEventListener('click', onAction);
    scoresCard.addEventListener('click', onAction);

    return {
        dispose: function () {
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointerup', onPointerUp);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerdown', onTouchReveal);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
            resizeWatch.disconnect();
            exitFullscreen();
            clearMarkers();
            hint.remove();
            panel.remove();
            resultCard.remove();
            scoresCard.remove();
            container.classList.remove('chess-playing', 'chess-hint-visible');
        }
    };
}
