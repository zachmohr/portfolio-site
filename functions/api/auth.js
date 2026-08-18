export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID) return new Response('GitHub OAuth is not configured.', { status: 503 });
  const requestUrl = new URL(request.url);
  const state = crypto.randomUUID();
  const redirect = new URL('https://github.com/login/oauth/authorize');
  redirect.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  redirect.searchParams.set('redirect_uri', `${requestUrl.origin}/api/callback`);
  redirect.searchParams.set('scope', 'public_repo,user:email');
  redirect.searchParams.set('state', state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: redirect.toString(),
      'Set-Cookie': `__Host-decap_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      'Cache-Control': 'no-store',
    },
  });
}
