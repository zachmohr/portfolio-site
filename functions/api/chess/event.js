// Anonymous play counters for the chess game, shown on the private stats page.
// POST /api/chess/event  {type: "start" | "finish" | "saved", result?: "win" | "loss" | "draw"}
// Counts are stored as chess:stat:<metric> and chess:stat:day:<YYYY-MM-DD>:<metric>.

const BOT_PATTERN = /bot|crawl|spider|slurp|preview|headless/i;
const TYPES = new Set(['start', 'finish', 'saved']);
const RESULTS = new Set(['win', 'loss', 'draw']);

function store(env) {
  return env.LEADERBOARD || env.DOWNLOADS || null;
}

async function increment(kv, key) {
  const current = Number(await kv.get(key)) || 0;
  await kv.put(key, String(current + 1));
}

export function metricsFor(body) {
  if (!body || !TYPES.has(body.type)) return [];
  const metrics = [body.type];
  if (body.type === 'finish' && RESULTS.has(body.result)) metrics.push(`finish_${body.result}`);
  return metrics;
}

export async function recordEvent(kv, body, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const metrics = metricsFor(body);
  await Promise.all(metrics.flatMap((metric) => [
    increment(kv, `chess:stat:${metric}`),
    increment(kv, `chess:stat:day:${day}:${metric}`),
  ]));
  return metrics;
}

export async function onRequestPost({ request, env, waitUntil }) {
  const done = new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  const kv = store(env);
  if (!kv || BOT_PATTERN.test(request.headers.get('User-Agent') || '')) return done;

  const text = await request.text();
  if (text.length > 500) return new Response(null, { status: 413 });
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }

  const pending = recordEvent(kv, body);
  if (waitUntil) waitUntil(pending);
  else await pending;
  return done;
}
