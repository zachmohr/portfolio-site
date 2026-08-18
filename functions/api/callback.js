function renderResult(origin, status, payload) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>GitHub authorization</title></head><body><p>Finishing authorization…</p><script>if(window.opener){const receiveMessage=(event)=>{if(event.origin!==${JSON.stringify(origin)}||event.data!=="authorizing:github")return;window.removeEventListener("message",receiveMessage);window.opener.postMessage(${JSON.stringify(message)},event.origin);};window.addEventListener("message",receiveMessage);window.opener.postMessage("authorizing:github","*");}</script></body></html>`;
}

function readCookies(header) {
  const cookies = {};

  for (const part of (header || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (!name) continue;
    cookies[name] = part.slice(separator + 1).trim();
  }

  return cookies;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const cookies = readCookies(request.headers.get('Cookie'));
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const clearCookie = '__Host-decap_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
  const headers = { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store', 'Set-Cookie': clearCookie };

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return new Response(renderResult(url.origin, 'error', { message: 'GitHub OAuth is not configured.' }), { status: 503, headers });
  }

  if (!code || !state || state !== cookies['__Host-decap_oauth_state']) {
    return new Response(renderResult(url.origin, 'error', { message: 'Invalid or expired OAuth state.' }), { status: 400, headers });
  }

  try {
    const body = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/callback`,
    });
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const responseText = await response.text();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      result = {};
    }

    if (!response.ok || result.error || !result.access_token) {
      return new Response(renderResult(url.origin, 'error', { message: result.error_description || 'GitHub authorization failed.' }), { status: 401, headers });
    }

    return new Response(renderResult(url.origin, 'success', { token: result.access_token, provider: 'github' }), { headers });
  } catch {
    return new Response(renderResult(url.origin, 'error', { message: 'GitHub authorization is temporarily unavailable.' }), { status: 502, headers });
  }
}
