// Read-only download stats from the DOWNLOADS KV namespace.
// GET /api/downloads            -> all files
// GET /api/downloads?project=x  -> only files under assets/downloads/x/

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

export async function onRequestGet({ request, env }) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  if (!env.DOWNLOADS) {
    return new Response(JSON.stringify({ error: 'DOWNLOADS KV namespace is not bound.' }), { status: 503, headers });
  }

  const project = new URL(request.url).searchParams.get('project') || '';
  const fileFilter = project ? `${project.replace(/\/+$/, '')}/` : '';

  const totalKeys = await listAll(env.DOWNLOADS, `total:${fileFilter}`);
  const files = {};
  await Promise.all(totalKeys.map(async (key) => {
    files[key.slice('total:'.length)] = Number(await env.DOWNLOADS.get(key)) || 0;
  }));

  const dayKeys = await listAll(env.DOWNLOADS, 'day:');
  const daily = {};
  await Promise.all(dayKeys.map(async (key) => {
    const [, day, ...rest] = key.split(':');
    if (fileFilter && !rest.join(':').startsWith(fileFilter)) return;
    const count = Number(await env.DOWNLOADS.get(key)) || 0;
    daily[day] = (daily[day] || 0) + count;
  }));

  const total = Object.values(files).reduce((sum, count) => sum + count, 0);
  return new Response(JSON.stringify({ total, files, daily }, null, 2), { headers });
}
