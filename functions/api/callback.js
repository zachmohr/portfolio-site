function renderResult(origin, status, payload) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>GitHub authorization</title></head><body><p>Finishing authorization…</p><script>window.opener.postMessage(${JSON.stringify(message)}, ${JSON.stringify(origin)});window.close();</script></body></html>`;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const cookies = Object.fromEntries((request.headers.get('Cookie') || '').split(';').map((part) => part.trim().split('=')));
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const clearCookie = '__Host-decap_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
  const headers = { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store', 'Set-Cookie': clearCookie };

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return new Response(renderResult(url.origin, 'error', { message: 'GitHub OAuth is not configured.' }), { status: 503, headers });
  }

  if (!code || !state || state !== cookies.__Host-decap_oauth_state) {
    return new Response(renderResult(url.origin, 'error', { message: 'Invalid or expired OAuth state.' }), { status: 400, headers });
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'zachmohr-work-decap' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
  });
  const result = await response.json();
  if (!response.ok || result.error || !result.access_token) {
    return new Response(renderResult(url.origin, 'error', { message: result.error_description || 'GitHub authorization failed.' }), { status: 401, headers });
  }

  return new Response(renderResult(url.origin, 'success', { token: result.access_token, provider: 'github' }), { headers });
}
