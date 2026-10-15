// Serves files from /assets/downloads/ as attachments and counts each download
// in the DOWNLOADS KV namespace. Counting is skipped (never blocks the file)
// when the binding is missing or the request looks like a crawler.

const DOWNLOAD_PREFIX = '/assets/downloads/';
const BOT_PATTERN = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless/i;

function notFound() {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

export function downloadPath(params) {
  const parts = Array.isArray(params.path) ? params.path : [params.path];
  const relPath = parts.filter(Boolean).join('/');
  if (!relPath || relPath.split('/').some((part) => part === '..' || part === '.')) return null;
  return relPath;
}

async function increment(kv, key) {
  const current = Number(await kv.get(key)) || 0;
  await kv.put(key, String(current + 1));
}

export async function recordDownload(kv, relPath, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  await Promise.all([
    increment(kv, `total:${relPath}`),
    increment(kv, `day:${day}:${relPath}`),
  ]);
}

export async function onRequestGet({ request, env, params, waitUntil }) {
  const relPath = downloadPath(params);
  if (!relPath) return notFound();

  const assetUrl = new URL(DOWNLOAD_PREFIX + relPath, request.url);
  const asset = await env.ASSETS.fetch(new Request(assetUrl.toString()));
  // Pages falls back to index.html for missing paths, so an HTML response means the file does not exist.
  if (!asset.ok || (asset.headers.get('Content-Type') || '').includes('text/html')) return notFound();

  if (env.DOWNLOADS && !BOT_PATTERN.test(request.headers.get('User-Agent') || '')) {
    const pending = recordDownload(env.DOWNLOADS, relPath);
    if (waitUntil) waitUntil(pending);
    else await pending;
  }

  const filename = relPath.split('/').pop();
  const headers = new Headers(asset.headers);
  headers.set('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(asset.body, { status: 200, headers });
}
