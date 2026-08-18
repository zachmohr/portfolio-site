#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'writing');
const OUTPUT_DIR = path.join(ROOT, 'writing');
const SITE_ORIGIN = 'https://zachmohr.work';

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const escapeXml = escapeHtml;
const slugify = (value = '') => String(value).toLowerCase().trim()
  .replace(/&/g, '-and-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function normalizeDate(value, fallback) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? fallback : date.toISOString();
}

function plainText(markdown = '') {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readEntries(contentDir = CONTENT_DIR) {
  if (!fs.existsSync(contentDir)) return [];
  return fs.readdirSync(contentDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const filePath = path.join(contentDir, name);
      const source = fs.readFileSync(filePath, 'utf8');
      const parsed = matter(source);
      const stats = fs.statSync(filePath);
      const fileSlug = slugify(path.basename(name, '.md'));
      const slug = slugify(parsed.data.slug || fileSlug);
      const date = normalizeDate(parsed.data.date, stats.birthtime.toISOString());
      const updated = normalizeDate(parsed.data.updated, stats.mtime.toISOString());
      const description = String(parsed.data.description || plainText(parsed.content).slice(0, 180)).trim();
      return {
        ...parsed.data,
        title: String(parsed.data.title || 'Untitled thought'),
        type: parsed.data.type === 'essay' ? 'essay' : 'note',
        tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
        featured: parsed.data.featured === true,
        published: parsed.data.published === true,
        slug,
        date,
        updated,
        description,
        body: parsed.content,
      };
    })
    .filter((entry) => entry.published && entry.slug)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(value));
}

function pageShell({ title, description, canonical, body, type = 'website', extraHead = '', scripts = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="author" content="Zach Mohr">
  <meta property="og:type" content="${type}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta name="twitter:card" content="summary">
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" type="application/rss+xml" title="Zach Mohr — Writing" href="${SITE_ORIGIN}/writing/rss.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&family=IBM+Plex+Mono:wght@400;500&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/main.css?v=6">
  <link rel="stylesheet" href="/css/typography.css?v=6">
  <link rel="stylesheet" href="/css/writing.css?v=1">
${extraHead ? `  ${extraHead}\n` : ''}
  <title>${escapeHtml(title)}</title>
</head>
<body>
  <nav class="nav" aria-label="Primary navigation">
    <div class="nav-container">
      <a href="/" class="nav-logo" aria-label="Zach Mohr home">ZM</a>
      <ul class="nav-menu">
        <li><a href="/projects" class="nav-link">Projects</a></li>
        <li><a href="/writing" class="nav-link active">Writing</a></li>
        <li><a href="/contact.html" class="nav-link">Contact</a></li>
      </ul>
    </div>
  </nav>
  ${body}
  <footer class="footer">
    <div class="container footer-content">
      <p class="footer-text">&copy; ${new Date().getUTCFullYear()} Zach Mohr. A public archive of work and thinking.</p>
      <div class="footer-links"><a href="mailto:zmohr026@gmail.com" class="footer-link">Email</a></div>
    </div>
  </footer>
  ${scripts}
</body>
</html>`;
}

function renderArchive(entries) {
  const cards = entries.map((entry) => `
    <article class="writing-entry" data-writing-entry data-type="${entry.type}" data-tags="${escapeHtml(entry.tags.join(' ').toLowerCase())}" data-search="${escapeHtml(`${entry.title} ${entry.description} ${entry.tags.join(' ')}`.toLowerCase())}">
      <a class="writing-entry__link" href="/writing/${entry.slug}/">
        <div class="writing-entry__meta"><span>${entry.type}</span><time datetime="${entry.date}">${formatDate(entry.date)}</time></div>
        <h2>${escapeHtml(entry.title)}</h2>
        ${entry.description ? `<p>${escapeHtml(entry.description)}</p>` : ''}
        ${entry.tags.length ? `<ul class="writing-tags" aria-label="Tags">${entry.tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join('')}</ul>` : ''}
      </a>
    </article>`).join('');

  const body = `<main class="writing-archive">
    <header class="writing-archive__header container">
      <p class="writing-kicker">Notes &amp; essays</p>
      <h1>Writing</h1>
      <p>A public archive of ideas in progress—on design, engineering, products, culture, and whatever else seems worth preserving.</p>
    </header>
    <section class="writing-controls container" aria-label="Filter writing">
      <div class="writing-filter" role="group" aria-label="Type">
        <button class="is-active" type="button" data-filter="all">Everything</button>
        <button type="button" data-filter="essay">Essays</button>
        <button type="button" data-filter="note">Notes</button>
      </div>
      <label class="writing-search"><span class="visually-hidden">Search writing</span><input type="search" placeholder="Search the archive" data-writing-search></label>
    </section>
    <section class="writing-list container" aria-live="polite">
      ${cards || '<p class="writing-empty">The archive is ready. The first thought is still being written.</p>'}
      <p class="writing-empty" data-no-results hidden>No writing matches that search.</p>
    </section>
  </main>`;
  return pageShell({
    title: 'Writing — Zach Mohr',
    description: 'Notes and essays by Zach Mohr on design, engineering, products, culture, and technology.',
    canonical: `${SITE_ORIGIN}/writing/`, body,
    scripts: '<script src="/js/writing.js" defer></script>',
  });
}

function renderArticle(entry) {
  const canonical = `${SITE_ORIGIN}/writing/${entry.slug}/`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': entry.type === 'essay' ? 'Article' : 'BlogPosting',
    headline: entry.title, description: entry.description, datePublished: entry.date,
    dateModified: entry.updated, author: { '@type': 'Person', name: 'Zach Mohr', url: SITE_ORIGIN },
    mainEntityOfPage: canonical, url: canonical, keywords: entry.tags.join(', '),
  };
  if (entry.cover_image) jsonLd.image = new URL(entry.cover_image, SITE_ORIGIN).href;
  const body = `<main class="writing-page container">
    <article>
      <header class="writing-page__header">
        <a class="writing-back" href="/writing/">&larr; All writing</a>
        <p class="writing-kicker">${entry.type}</p>
        <h1>${escapeHtml(entry.title)}</h1>
        ${entry.description ? `<p class="writing-deck">${escapeHtml(entry.description)}</p>` : ''}
        <div class="writing-byline"><span>By Zach Mohr</span><time datetime="${entry.date}">${formatDate(entry.date)}</time>${entry.updated !== entry.date ? `<span>Updated ${formatDate(entry.updated)}</span>` : ''}</div>
        ${entry.tags.length ? `<ul class="writing-tags" aria-label="Tags">${entry.tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join('')}</ul>` : ''}
      </header>
      ${entry.cover_image ? `<figure class="writing-cover"><img src="${escapeHtml(entry.cover_image)}" alt="" fetchpriority="high"></figure>` : ''}
      <div class="prose">${marked.parse(entry.body)}</div>
    </article>
  </main>`;
  return pageShell({
    title: `${entry.title} — Zach Mohr`, description: entry.description, canonical, body, type: 'article',
    extraHead: `<meta property="article:published_time" content="${entry.date}">
  <meta property="article:modified_time" content="${entry.updated}">
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  });
}

function writeRss(entries) {
  const items = entries.map((entry) => {
    const url = `${SITE_ORIGIN}/writing/${entry.slug}/`;
    return `  <item><title>${escapeXml(entry.title)}</title><link>${url}</link><guid>${url}</guid><pubDate>${new Date(entry.date).toUTCString()}</pubDate><description>${escapeXml(entry.description)}</description></item>`;
  }).join('\n');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'rss.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Zach Mohr — Writing</title><link>${SITE_ORIGIN}/writing/</link><description>Notes and essays by Zach Mohr.</description><language>en-us</language>\n${items}\n</channel></rss>\n`);
}

function updateSitemap(entries) {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  let xml = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf8') : '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n';
  xml = xml.replace(/\s*<url>\s*<loc>https:\/\/zachmohr\.work\/writing(?:\/[^<]*)?<\/loc>[\s\S]*?<\/url>/g, '');
  const urls = [{ url: `${SITE_ORIGIN}/writing/`, updated: entries[0]?.updated || new Date().toISOString(), priority: '0.9' },
    ...entries.map((entry) => ({ url: `${SITE_ORIGIN}/writing/${entry.slug}/`, updated: entry.updated, priority: '0.8' }))];
  const blocks = urls.map((item) => `  <url>\n    <loc>${item.url}</loc>\n    <lastmod>${item.updated.slice(0, 10)}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${item.priority}</priority>\n  </url>`).join('\n');
  xml = xml.replace('</urlset>', `${blocks}\n</urlset>`);
  fs.writeFileSync(sitemapPath, xml);
}

function generate() {
  const entries = readEntries();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const item of fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })) {
    if (item.isDirectory()) fs.rmSync(path.join(OUTPUT_DIR, item.name), { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), renderArchive(entries));
  for (const entry of entries) {
    const dir = path.join(OUTPUT_DIR, entry.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderArticle(entry));
  }
  writeRss(entries);
  updateSitemap(entries);
  console.log(`Generated writing archive with ${entries.length} published ${entries.length === 1 ? 'entry' : 'entries'}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) generate();

export { readEntries, renderArchive, renderArticle, slugify };
