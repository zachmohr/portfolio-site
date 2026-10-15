import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet as download } from '../functions/api/download/[[path]].js';
import { onRequestGet as stats } from '../functions/api/downloads.js';

function memoryKv() {
  const store = new Map();
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
    async list({ prefix }) {
      return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
    },
  };
}

function assets(files) {
  return {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (files[path]) return new Response(files[path], { headers: { 'Content-Type': 'application/octet-stream' } });
      return new Response('<html>index</html>', { headers: { 'Content-Type': 'text/html' } });
    },
  };
}

const ASSETS = assets({ '/assets/downloads/scs-chess-set/KingBody.step': 'ISO-10303-21;' });

function get(path, userAgent = 'Mozilla/5.0') {
  return new Request(`https://zachmohr.work${path}`, { headers: { 'User-Agent': userAgent } });
}

test('download serves the file as an attachment and counts it', async () => {
  const DOWNLOADS = memoryKv();
  const response = await download({ request: get('/api/download/scs-chess-set/KingBody.step'), env: { ASSETS, DOWNLOADS }, params: { path: ['scs-chess-set', 'KingBody.step'] } });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'ISO-10303-21;');
  assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename="KingBody.step"');
  assert.equal(DOWNLOADS.store.get('total:scs-chess-set/KingBody.step'), '1');
  assert.equal([...DOWNLOADS.store.keys()].filter((k) => k.startsWith('day:')).length, 1);
});

test('missing files 404 without counting, even when Pages falls back to HTML', async () => {
  const DOWNLOADS = memoryKv();
  const response = await download({ request: get('/api/download/scs-chess-set/Nope.step'), env: { ASSETS, DOWNLOADS }, params: { path: ['scs-chess-set', 'Nope.step'] } });
  assert.equal(response.status, 404);
  assert.equal(DOWNLOADS.store.size, 0);
});

test('path traversal is rejected', async () => {
  const response = await download({ request: get('/api/download/x'), env: { ASSETS, DOWNLOADS: memoryKv() }, params: { path: ['..', 'index.html'] } });
  assert.equal(response.status, 404);
});

test('crawlers get the file but are not counted', async () => {
  const DOWNLOADS = memoryKv();
  const response = await download({ request: get('/api/download/scs-chess-set/KingBody.step', 'Googlebot/2.1'), env: { ASSETS, DOWNLOADS }, params: { path: ['scs-chess-set', 'KingBody.step'] } });
  assert.equal(response.status, 200);
  assert.equal(DOWNLOADS.store.size, 0);
});

test('download still works when the KV namespace is not bound', async () => {
  const response = await download({ request: get('/api/download/scs-chess-set/KingBody.step'), env: { ASSETS }, params: { path: ['scs-chess-set', 'KingBody.step'] } });
  assert.equal(response.status, 200);
});

test('stats totals files and filters by project', async () => {
  const DOWNLOADS = memoryKv();
  DOWNLOADS.store.set('total:scs-chess-set/KingBody.step', '3');
  DOWNLOADS.store.set('total:scs-chess-set/PawnBody.step', '2');
  DOWNLOADS.store.set('total:other/thing.step', '5');
  DOWNLOADS.store.set('day:2026-10-14:scs-chess-set/KingBody.step', '3');
  DOWNLOADS.store.set('day:2026-10-14:scs-chess-set/PawnBody.step', '2');
  DOWNLOADS.store.set('day:2026-10-14:other/thing.step', '5');

  const all = await (await stats({ request: get('/api/downloads'), env: { DOWNLOADS } })).json();
  assert.equal(all.total, 10);

  const chess = await (await stats({ request: get('/api/downloads?project=scs-chess-set'), env: { DOWNLOADS } })).json();
  assert.equal(chess.total, 5);
  assert.deepEqual(chess.daily, { '2026-10-14': 5 });
});

test('repo notes and tooling are blocked, site files are not', async () => {
  const { isBlocked, onRequest } = await import('../functions/_middleware.js');
  for (const path of ['/ROADMAP.md', '/README.md', '/package.json', '/package-lock.json', '/.gitignore', '/scripts/usdz-to-glb.py', '/tests/downloads.test.mjs', '/tools/editor.js', '/content/writing/x.md', '/functions/api/downloads.js']) {
    assert.equal(isBlocked(path), true, path);
  }
  for (const path of ['/', '/index.html', '/projects/scs-chess-set', '/data/projects.json', '/llms.txt', '/Zach_Mohr_Portfolio.pdf', '/assets/downloads/scs-chess-set/README.txt', '/api/chess/leaderboard']) {
    assert.equal(isBlocked(path), false, path);
  }
  const blocked = await onRequest({ request: new Request('https://zachmohr.work/ROADMAP.md'), env: {}, next: () => new Response('leak') });
  assert.equal(blocked.status, 404);
  const allowed = await onRequest({ request: new Request('https://zachmohr.work/api/chess/leaderboard'), env: {}, next: () => new Response('ok') });
  assert.equal(await allowed.text(), 'ok');
});

test('admin and download stats are private', async () => {
  const { onRequest } = await import('../functions/_middleware.js');
  const next = () => new Response('secret');
  const basic = (pw) => ({ Authorization: 'Basic ' + btoa('zach:' + pw) });

  for (const path of ['/admin', '/admin/', '/admin/index.html', '/admin/config.yml', '/admin/downloads.html', '/api/downloads', '/api/chess/stats']) {
    // No password configured: hidden entirely.
    const hidden = await onRequest({ request: new Request('https://zachmohr.work' + path), env: {}, next });
    assert.equal(hidden.status, 404, path);
    // Password configured: challenge without credentials, reject wrong ones, allow the right one.
    const env = { ADMIN_PASSWORD: 'correct horse' };
    assert.equal((await onRequest({ request: new Request('https://zachmohr.work' + path), env, next })).status, 401, path);
    assert.equal((await onRequest({ request: new Request('https://zachmohr.work' + path, { headers: basic('wrong') }), env, next })).status, 401, path);
    const ok = await onRequest({ request: new Request('https://zachmohr.work' + path, { headers: basic('correct horse') }), env, next });
    assert.equal(await ok.text(), 'secret', path);
  }

  // The CMS's GitHub sign-in endpoints stay reachable.
  const auth = await onRequest({ request: new Request('https://zachmohr.work/api/auth'), env: {}, next: () => new Response('oauth') });
  assert.equal(await auth.text(), 'oauth');
});
