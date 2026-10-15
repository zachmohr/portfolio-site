import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet, onRequestPost, cleanName, gameResult } from '../functions/api/chess/leaderboard.js';

function memoryKv() {
  const store = new Map();
  return {
    store,
    async get(key, type) {
      if (!store.has(key)) return null;
      return type === 'json' ? JSON.parse(store.get(key)) : store.get(key);
    },
    async put(key, value) { store.set(key, value); },
    async list({ prefix }) {
      return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
    },
  };
}

// Scholar's mate (red/white wins) and fool's mate (blue/black wins).
const RED_WINS = ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'];
const BLUE_WINS = ['f3', 'e5', 'g4', 'Qh4#'];

function post(body) {
  return new Request('https://zachmohr.work/api/chess/leaderboard', { method: 'POST', body: JSON.stringify(body) });
}

test('gameResult replays moves and scores from red\'s side', () => {
  assert.equal(gameResult(RED_WINS), 'win');
  assert.equal(gameResult(BLUE_WINS), 'loss');
  assert.equal(gameResult(['e4', 'e5']), null);
  assert.equal(gameResult(['e4', 'e4']), null);
  assert.equal(gameResult('e4'), null);
});

test('cleanName trims and rejects bad names', () => {
  assert.equal(cleanName('  Zach   M '), 'Zach M');
  assert.equal(cleanName(''), null);
  assert.equal(cleanName('<script>'), null);
  assert.equal(cleanName('x'.repeat(21)), null);
});

test('a verified win is recorded and ranked', async () => {
  const LEADERBOARD = memoryKv();
  const res = await onRequestPost({ request: post({ name: 'Zach', moves: RED_WINS }), env: { LEADERBOARD } });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.result, 'win');
  assert.equal(data.player.name, 'Zach');
  assert.deepEqual([data.player.wins, data.player.draws, data.player.losses, data.player.points], [1, 0, 0, 3]);
  assert.match(data.player.since, /^\d{4}-\d{2}-\d{2}T/);

  await onRequestPost({ request: post({ name: 'Ana', moves: BLUE_WINS }), env: { LEADERBOARD } });
  const board = await (await onRequestGet({ env: { LEADERBOARD } })).json();
  assert.deepEqual(board.players.map((p) => [p.name, p.points]), [['Zach', 3], ['Ana', 0]]);
  assert.equal(board.total, 2);
});

test('the same game cannot be submitted twice', async () => {
  const LEADERBOARD = memoryKv();
  await onRequestPost({ request: post({ name: 'Zach', moves: RED_WINS }), env: { LEADERBOARD } });
  const again = await onRequestPost({ request: post({ name: 'zach', moves: RED_WINS }), env: { LEADERBOARD } });
  assert.equal(again.status, 409);
});

test('unfinished games and bad names are rejected', async () => {
  const LEADERBOARD = memoryKv();
  assert.equal((await onRequestPost({ request: post({ name: 'Zach', moves: ['e4'] }), env: { LEADERBOARD } })).status, 400);
  assert.equal((await onRequestPost({ request: post({ name: '', moves: RED_WINS }), env: { LEADERBOARD } })).status, 400);
  assert.equal(LEADERBOARD.store.size, 0);
});

test('falls back to the DOWNLOADS namespace when no LEADERBOARD binding exists', async () => {
  const DOWNLOADS = memoryKv();
  const res = await onRequestPost({ request: post({ name: 'Zach', moves: RED_WINS }), env: { DOWNLOADS } });
  assert.equal(res.status, 200);
  assert.ok([...DOWNLOADS.store.keys()].some((k) => k.startsWith('chess:player:')));
});

test('records never expire and keep the first-played date', async () => {
  const LEADERBOARD = memoryKv();
  const puts = [];
  const put = LEADERBOARD.put;
  LEADERBOARD.put = async (key, value, options) => { puts.push(options); return put(key, value); };
  const first = await (await onRequestPost({ request: post({ name: 'Zach', moves: RED_WINS }), env: { LEADERBOARD } })).json();
  const second = await (await onRequestPost({ request: post({ name: 'Zach', moves: BLUE_WINS }), env: { LEADERBOARD } })).json();
  assert.ok(puts.every((options) => !options || !options.expirationTtl));
  assert.equal(second.player.since, first.player.since);
  assert.deepEqual([second.player.wins, second.player.losses, second.player.points], [1, 1, 3]);
});
