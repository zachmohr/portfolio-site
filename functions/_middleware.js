// The Pages build publishes the repo root, so repo notes and tooling would otherwise be
// downloadable, and /admin would be public. _routes.json sends only these paths
// (plus /api/*) through Functions; everything else is served straight from static assets.

const BLOCKED = [
  /^\/[^/]+\.md$/i,
  /^\/package(-lock)?\.json$/i,
  /^\/\.gitignore$/i,
  /^\/(scripts|tests|tools|content|functions|node_modules)(\/|$)/i,
];

// Private area: needs the ADMIN_PASSWORD secret. Without it set, these paths simply 404.
const PRIVATE = [
  /^\/admin(\/|$)/i,
  /^\/api\/downloads\/?$/i,
];

export function isBlocked(pathname) {
  return BLOCKED.some((pattern) => pattern.test(pathname));
}

export function isPrivate(pathname) {
  return PRIVATE.some((pattern) => pattern.test(pathname));
}

function notFound() {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

function timingSafeEqual(a, b) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] || 0) ^ (right[i] || 0);
  }
  return diff === 0;
}

export function hasAdminAccess(request, password) {
  if (!password) return false;
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  let decoded = '';
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const supplied = decoded.slice(decoded.indexOf(':') + 1);
  return timingSafeEqual(supplied, password);
}

export async function onRequest({ request, env, next }) {
  const { pathname } = new URL(request.url);
  if (isBlocked(pathname)) return notFound();

  if (isPrivate(pathname)) {
    if (!env.ADMIN_PASSWORD) return notFound();
    if (!hasAdminAccess(request, env.ADMIN_PASSWORD)) {
      return new Response('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="zachmohr.work admin", charset="UTF-8"',
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex',
        },
      });
    }
    const response = await next();
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Robots-Tag', 'noindex');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  return next();
}
