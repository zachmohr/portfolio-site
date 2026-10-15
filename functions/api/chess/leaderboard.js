// Chess leaderboard for the hidden play mode on the SCS Chess Set project.
// GET  /api/chess/leaderboard  -> top players
// POST /api/chess/leaderboard  {name, moves: [san...]}
//   The server replays the moves to confirm a finished game against the
//   computer (player is red/white), then records a win, draw or loss.
// Stored in the LEADERBOARD KV namespace, falling back to DOWNLOADS, under "chess:".
// Records never expire: every player who saves a game stays on the board for good.

import { Chess } from 'chess.js';

const PLAYER_PREFIX = 'chess:player:';
const GAME_PREFIX = 'chess:game:';
const NAME_PATTERN = /^[\p{L}\p{N} _.'-]{1,20}$/u;
const POINTS = { win: 3, draw: 1, loss: 0 };
const MAX_MOVES = 600;
const MAX_LISTED = 1000;

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

function summarize({ name, wins, draws, losses, points, since }) {
  return { name, wins, draws, losses, points, since: since || null };
}

function rank(players) {
  return players.sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function store(env) {
  return env.LEADERBOARD || env.DOWNLOADS || null;
}

export function cleanName(raw) {
  const name = String(raw || '').replace(/\s+/g, ' ').trim();
  return NAME_PATTERN.test(name) ? name : null;
}

export function gameResult(moves) {
  if (!Array.isArray(moves) || moves.length === 0 || moves.length > MAX_MOVES) return null;
  const game = new Chess();
  for (const san of moves) {
    if (typeof san !== 'string' || san.length > 10) return null;
    try {
      game.move(san);
    } catch {
      return null;
    }
  }
  if (game.isCheckmate()) return game.turn() === 'b' ? 'win' : 'loss';
  if (game.isDraw() || game.isStalemate()) return 'draw';
  return null;
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function listPlayers(kv) {
  const names = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: PLAYER_PREFIX, cursor });
    names.push(...page.keys.map((key) => key.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const players = (await Promise.all(names.map((key) => kv.get(key, 'json')))).filter(Boolean);
  return rank(players.map(summarize));
}

export async function onRequestGet({ env }) {
  const kv = store(env);
  if (!kv) return json({ error: 'Leaderboard storage is not configured.' }, 503);
  const players = await listPlayers(kv);
  return json({ total: players.length, players: players.slice(0, MAX_LISTED) });
}

export async function onRequestPost({ request, env }) {
  const kv = store(env);
  if (!kv) return json({ error: 'Leaderboard storage is not configured.' }, 503);

  const text = await request.text();
  if (text.length > 20000) return json({ error: 'Request too large.' }, 413);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }

  const name = cleanName(body.name);
  if (!name) return json({ error: 'Use 1-20 letters, numbers, spaces, or . _ \' -' }, 400);

  const result = gameResult(body.moves);
  if (!result) return json({ error: 'That game is not finished or is not valid.' }, 400);

  const nameKey = name.toLowerCase();
  const gameKey = GAME_PREFIX + (await sha256(`${nameKey}|${body.moves.join(' ')}`));
  if (await kv.get(gameKey)) return json({ error: 'This game is already on the leaderboard.' }, 409);

  const playerKey = PLAYER_PREFIX + nameKey;
  const now = new Date().toISOString();
  const player = (await kv.get(playerKey, 'json')) || { name, wins: 0, draws: 0, losses: 0, points: 0, since: now };
  player.name = name;
  player[result === 'win' ? 'wins' : result === 'draw' ? 'draws' : 'losses'] += 1;
  player.points += POINTS[result];
  player.since = player.since || now;
  player.updated = now;

  await Promise.all([
    kv.put(playerKey, JSON.stringify(player)),
    kv.put(gameKey, '1'),
  ]);

  // KV listings can lag a fresh write, so merge this player in before ranking.
  const summary = summarize(player);
  const players = (await listPlayers(kv)).filter((p) => p.name.toLowerCase() !== nameKey);
  players.push(summary);
  rank(players);

  return json({ result, player: summary, total: players.length, players: players.slice(0, MAX_LISTED) });
}
