// The Pages build publishes the repo root, so repo notes and tooling would otherwise be
// downloadable. _routes.json sends only these paths (plus /api/*) through Functions;
// everything else is served straight from static assets without invoking this.

const BLOCKED = [
  /^\/[^/]+\.md$/i,
  /^\/package(-lock)?\.json$/i,
  /^\/\.gitignore$/i,
  /^\/(scripts|tests|tools|content|functions|node_modules)(\/|$)/i,
];

export function isBlocked(pathname) {
  return BLOCKED.some((pattern) => pattern.test(pathname));
}

export async function onRequest({ request, next }) {
  if (isBlocked(new URL(request.url).pathname)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  }
  return next();
}
