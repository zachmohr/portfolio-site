// Private chess stats for the admin page (protected by ADMIN_PASSWORD in _middleware.js).
// GET /api/chess/stats -> { totals: {start, finish, ...}, daily: {YYYY-MM-DD: {start, ...}}, players }

function store(env) {
  return env.LEADERBOARD || env.DOWNLOADS || null;
}

async function listAll(kv, prefix) {
  const keys = [];
  let cursor;
  do {
    const page = await kv.list({ prefix, cursor });
    keys.push(...page.keys.map((key) => key.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

export async function onRequestGet({ env }) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  const kv = store(env);
  if (!kv) return new Response(JSON.stringify({ error: 'Storage is not configured.' }), { status: 503, headers });

  const totals = {};
  const daily = {};
  const keys = await listAll(kv, 'chess:stat:');
  await Promise.all(keys.map(async (key) => {
    const value = Number(await kv.get(key)) || 0;
    const parts = key.split(':');
    if (parts[2] === 'day') {
      const [, , , day, metric] = parts;
      daily[day] = daily[day] || {};
      daily[day][metric] = value;
    } else {
      totals[parts[2]] = value;
    }
  }));

  const players = (await listAll(kv, 'chess:player:')).length;
  return new Response(JSON.stringify({ totals, daily, players }, null, 2), { headers });
}
