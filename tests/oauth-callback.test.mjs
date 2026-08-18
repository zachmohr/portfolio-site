import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet } from '../functions/api/callback.js';

const env = { GITHUB_CLIENT_ID: 'client-id', GITHUB_CLIENT_SECRET: 'client-secret' };

function callbackRequest(cookie = '__Host-decap_oauth_state=expected-state') {
  return new Request('https://zachmohr.work/api/callback?code=oauth-code&state=expected-state', {
    headers: { Cookie: cookie },
  });
}

test('callback exchanges the GitHub code and returns the Decap success message', async (t) => {
  let tokenRequest;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    tokenRequest = { url, options };
    return new Response(JSON.stringify({ access_token: 'github-token' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const response = await onRequestGet({ request: callbackRequest('other=value=with=equals; __Host-decap_oauth_state=expected-state'), env });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /window\.opener\.postMessage\("authorizing:github","\*"\)/);
  assert.match(html, /authorization:github:success/);
  assert.match(html, /github-token/);
  assert.equal(tokenRequest.url, 'https://github.com/login/oauth/access_token');
  assert.equal(tokenRequest.options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(tokenRequest.options.body.get('redirect_uri'), 'https://zachmohr.work/api/callback');
});

test('callback turns an unexpected GitHub response into an OAuth error page', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('upstream unavailable', { status: 502 }));

  const response = await onRequestGet({ request: callbackRequest(), env });
  const html = await response.text();

  assert.equal(response.status, 401);
  assert.match(html, /authorization:github:error/);
  assert.match(html, /GitHub authorization failed/);
});

test('callback rejects a mismatched OAuth state without contacting GitHub', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('{}'));

  const response = await onRequestGet({ request: callbackRequest('__Host-decap_oauth_state=wrong-state'), env });

  assert.equal(response.status, 400);
  assert.equal(fetchMock.mock.callCount(), 0);
});
