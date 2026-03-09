#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROJECTS_JSON_PATH = path.join(ROOT, 'data', 'projects.json');
const PROJECTS_DIR = path.join(ROOT, 'projects');
const PROJECTS_PAGE_PATH = path.join(ROOT, 'projects.html');
const PROJECTS_INDEX_PATH = path.join(PROJECTS_DIR, 'index.html');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');

const SITE_ORIGIN = 'https://zachmohr.work';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/\n/g, ' ');
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeUniqueSlug(baseSlug, used) {
  let slug = baseSlug || 'project';
  let suffix = 2;

  while (used.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  used.add(slug);
  return slug;
}

function assignSlugs(projects) {
  const used = new Set();
  return projects.map((project) => {
    const base = slugify(project.slug || project.id || project.title || 'project');
    return {
      ...project,
      _routeSlug: makeUniqueSlug(base, used),
    };
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1] || 1);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return escapeHtml(String(dateStr));
  }
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function assetUrl(url) {
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url)) return url;
  return encodeURI(url);
}

function absoluteUrl(url) {
  if (!url) return `${SITE_ORIGIN}/`;
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_ORIGIN}/${assetUrl(url).replace(/^\/+/, '')}`;
}

function renderTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return '';
  return `\n<div class="project-tags">\n${tags
    .map((tag) => `  <span class="tag">${escapeHtml(tag)}</span>`)
    .join('\n')}\n</div>`;
}

function renderLinksBlock(className, itemClass, icon, items) {
  if (!Array.isArray(items) || items.length === 0) return '';

  return `\n<div class="${className}">\n${items
    .map((item) => {
      const href = assetUrl(item.url || '');
      const isExternal = /^https?:\/\//i.test(href);
      const extra = isExternal ? ' target="_blank" rel="noopener"' : '';
      return `  <a class="${itemClass}" href="${escapeAttr(href)}"${extra}>${icon} ${escapeHtml(item.label || href)}</a>`;
    })
    .join('\n')}\n</div>`;
}

function renderVideoSources(entry) {
  let sources = [];
  if (Array.isArray(entry.sources) && entry.sources.length > 0) {
    sources = entry.sources;
  } else if (entry.src) {
    sources = [{ src: entry.src, mimeType: entry.mimeType }];
  }

  return sources
    .filter((source) => source && source.src)
    .map((source) => {
      const src = assetUrl(source.src);
      const mimeType = source.mimeType || source.type || '';
      return `      <source src="${escapeAttr(src)}"${mimeType ? ` type="${escapeAttr(mimeType)}"` : ''}>`;
    })
    .join('\n');
}

function renderImageEntry(entry) {
  return `
<div class="log-entry">
  <img src="${escapeAttr(assetUrl(entry.src || ''))}" alt="${escapeAttr(entry.alt || '')}" loading="lazy" decoding="async">
  ${entry.caption ? `<p class="log-caption">${escapeHtml(entry.caption)}</p>` : ''}
</div>`;
}

function renderVideoEntry(entry) {
  const src = entry.src || '';
  const isEmbed = /youtube|vimeo|embed/i.test(src);
  const caption = entry.caption ? `<p class="log-caption">${escapeHtml(entry.caption)}</p>` : '';

  if (isEmbed) {
    return `
<div class="log-entry log-entry--video">
  <div class="video-wrapper">
    <iframe src="${escapeAttr(assetUrl(src))}" title="Project video" loading="lazy" allowfullscreen></iframe>
  </div>
  ${caption}
</div>`;
  }

  const sources = renderVideoSources(entry);
  return `
<div class="log-entry log-entry--video">
  <div class="video-wrapper video-wrapper--self-hosted"${entry.aspectRatio ? ` style="aspect-ratio:${escapeAttr(entry.aspectRatio)};"` : ''}>
    <video controls preload="metadata" playsinline webkit-playsinline${entry.poster ? ` poster="${escapeAttr(assetUrl(entry.poster))}"` : ''}${entry.alt ? ` aria-label="${escapeAttr(entry.alt)}"` : ''}>
${sources}
      Your browser does not support the video tag.
    </video>
  </div>
  ${caption}
</div>`;
}

function renderModelEntry(entry) {
  const modelsAttr = entry.models ? escapeAttr(JSON.stringify(entry.models)) : '';
  const modelSrc = entry.models && entry.models.length ? entry.models[0].src : (entry.glb || entry.src || '');
  let modelArSrc = entry.iosSrc || entry.usdz || '';
  let modelArTitle = entry.arTitle || '';

  if (!modelArSrc && entry.models && entry.models.length > 0) {
    modelArSrc = entry.models[0].iosSrc || entry.models[0].usdz || '';
  }

  if (!modelArTitle && entry.models && entry.models.length > 0) {
    modelArTitle = entry.models[0].arTitle || entry.models[0].name || '';
  }

  const arEnabled = Boolean(modelArSrc);

  return `
<div class="log-entry log-entry--model">
  <div class="model-wrapper model-viewer-container" data-src="${escapeAttr(assetUrl(modelSrc))}"${modelsAttr ? ` data-models="${modelsAttr}"` : ''}${arEnabled ? ' data-ar-enabled="true"' : ''}${modelArSrc ? ` data-ar-src="${escapeAttr(assetUrl(modelArSrc))}"` : ''}${modelArTitle ? ` data-ar-title="${escapeAttr(modelArTitle)}"` : ''}${entry.allowCrossSection ? ' data-allow-cross-section="true"' : ''}${entry.autoColorize ? ' data-auto-colorize="true"' : ''} role="img" aria-label="${escapeAttr(entry.alt || '')}"></div>
  ${arEnabled ? '<a class="model-ar-link" hidden href="#" aria-label="Open model in augmented reality">Open in AR</a>' : ''}
  ${entry.caption ? `<p class="log-caption">${escapeHtml(entry.caption)}</p>` : ''}
</div>`;
}

function renderSketchesEntry(entry) {
  const pages = Array.isArray(entry.pages) ? entry.pages : [];
  if (pages.length === 0) return '';

  const images = pages
    .map((page) => `  <img src="${escapeAttr(assetUrl(page.src || ''))}" alt="${escapeAttr(page.alt || 'Sketch page')}" loading="lazy" decoding="async">`)
    .join('\n');

  return `
<div class="log-entry log-entry--sketches">
  ${entry.caption ? `<p class="log-caption">${escapeHtml(entry.caption)}</p>` : ''}
${images}
</div>`;
}

function renderStrobeEntry(entry) {
  return `
<div class="log-entry log-entry--strobe">
  <img src="${escapeAttr(assetUrl(entry.base || ''))}" alt="${escapeAttr(entry.alt || 'Strobe base image')}" loading="lazy" decoding="async">
  <img src="${escapeAttr(assetUrl(entry.overlay || ''))}" alt="" aria-hidden="true" loading="lazy" decoding="async">
  ${entry.caption ? `<p class="log-caption">${escapeHtml(entry.caption)}</p>` : ''}
</div>`;
}

function renderEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';

  return entries
    .map((entry) => {
      if (entry.type === 'video') return renderVideoEntry(entry);
      if (entry.type === 'model') return renderModelEntry(entry);
      if (entry.type === 'sketches') return renderSketchesEntry(entry);
      if (entry.type === 'strobe') return renderStrobeEntry(entry);
      return renderImageEntry(entry);
    })
    .join('\n');
}

function renderTopLevelVideo(videoUrl) {
  if (!videoUrl) return '';
  const src = assetUrl(videoUrl);

  return `
<div class="log-entry log-entry--video">
  <div class="video-wrapper">
    <iframe src="${escapeAttr(src)}" title="Project video" loading="lazy" allowfullscreen></iframe>
  </div>
</div>`;
}

function renderProjectBody(project) {
  const isLog = project.type === 'log';
  const press = renderLinksBlock('project-press', 'press-link', '&#x1F4F0;', project.press);
  const patents = renderLinksBlock('project-patents', 'patent-link', '&#x2316;', project.patents);

  const logContent = isLog
    ? renderEntries(project.entries)
    : renderTopLevelVideo(project.video);

  return `
<section class="projects" style="padding-top: var(--space-lg);">
  <div class="container">
    <div class="projects-grid" style="grid-template-columns: minmax(0, 1fr);">
      <article class="project-card project-card--log" data-category="${escapeAttr(project.category || '')}" data-date="${escapeAttr(project.date || '')}" style="grid-column: 1 / -1; cursor: default;">
        <div class="project-image">
          <img src="${escapeAttr(assetUrl(project.hero && project.hero.src ? project.hero.src : ''))}" alt="${escapeAttr(project.hero && project.hero.alt ? project.hero.alt : project.title)}" width="1600" height="1000" fetchpriority="high">
        </div>
        <div class="project-content">
          <span class="project-date">${escapeHtml(formatDate(project.date || ''))}</span>
          <h1 class="project-title">${escapeHtml(project.title || 'Project')}</h1>
          <p class="project-description">${escapeHtml(project.description || '')}</p>
          ${renderTags(project.tags)}
          ${press}
          ${patents}
        </div>
        <div class="project-log">
          ${logContent}
        </div>
      </article>
    </div>
  </div>
</section>`;
}

function renderStructuredData(project, projectUrl) {
  const image = project.hero && project.hero.src ? absoluteUrl(project.hero.src) : `${SITE_ORIGIN}/assets/images/og-image.jpg`;
  const datePublished = project.date && /^\d{4}-\d{2}$/.test(project.date)
    ? `${project.date}-01`
    : null;

  const payload = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.title || 'Project',
    description: project.description || '',
    url: projectUrl,
    image,
    author: {
      '@type': 'Person',
      name: 'Zach Mohr',
      url: SITE_ORIGIN,
    },
  };

  if (datePublished) payload.datePublished = datePublished;

  return JSON.stringify(payload, null, 2);
}

function renderProjectPage(project) {
  const slug = project._routeSlug;
  const pageUrl = `${SITE_ORIGIN}/projects/${encodeURIComponent(slug)}`;
  const title = `${project.title} | Zach Mohr`;
  const description = (project.description || '').slice(0, 280);
  const ogImage = project.hero && project.hero.src
    ? absoluteUrl(project.hero.src)
    : `${SITE_ORIGIN}/assets/images/og-image.jpg`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <base href="/">
  <meta name="description" content="${escapeAttr(description)}">
  <meta name="robots" content="index,follow">
  <title>${escapeHtml(title)}</title>

  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeAttr(pageUrl)}">
  <meta property="og:title" content="${escapeAttr(project.title || 'Project')}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:image" content="${escapeAttr(ogImage)}">

  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${escapeAttr(pageUrl)}">
  <meta property="twitter:title" content="${escapeAttr(project.title || 'Project')}">
  <meta property="twitter:description" content="${escapeAttr(description)}">
  <meta property="twitter:image" content="${escapeAttr(ogImage)}">

  <link rel="canonical" href="${escapeAttr(pageUrl)}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&family=IBM+Plex+Mono:wght@400;500&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">

  <link rel="stylesheet" href="css/main.css?v=7">
  <link rel="stylesheet" href="css/typography.css?v=5">
  <link rel="stylesheet" href="css/dithering.css?v=5">

  <script type="application/ld+json">
${renderStructuredData(project, pageUrl)}
  </script>
</head>
<body>
  <nav class="nav">
    <div class="nav-container">
      <a href="index.html" class="nav-logo">ZM</a>
      <ul class="nav-menu">
        <li><a href="index.html#about" class="nav-link">About</a></li>
        <li><a href="/projects" class="nav-link active">Projects</a></li>
        <li><a href="contact.html" class="nav-link">Contact</a></li>
      </ul>
    </div>
  </nav>

  <section class="projects-header" style="padding-bottom: var(--space-md);">
    <div class="container">
      <h1 class="page-title">${escapeHtml(project.title || 'Project')}</h1>
      <p class="page-subtitle"><a href="/projects" style="color: var(--color-red);">Back to all projects</a></p>
    </div>
  </section>

  ${renderProjectBody(project)}

  <footer class="footer">
    <div class="container">
      <div class="footer-content">
        <p class="footer-text">&copy; 2026 Zach Mohr. Built with precision and a bit of retro flair.</p>
        <div class="footer-links">
          <a href="mailto:zmohr026@gmail.com" class="footer-link">Email</a>
          <a href="tel:+16059997649" class="footer-link">Phone</a>
        </div>
      </div>
    </div>
  </footer>

  <script async src="https://ga.jspm.io/npm:es-module-shims@1.10.1/dist/es-module-shims.js"></script>
  <script type="importmap">
  {
      "imports": {
          "three": "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js",
          "three/examples/jsm/": "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/"
      }
  }
  </script>

  <script src="js/main.js?v=6"></script>
  <script type="module" src="js/project-model-viewer.js?v=22"></script>
</body>
</html>`;
}

function buildSitemap(paths) {
  const today = new Date().toISOString().slice(0, 10);

  const urlBlocks = paths.map((pathname) => {
    const priority = pathname === '/' ? '1.0' : pathname === '/projects' ? '0.9' : pathname.startsWith('/projects/') ? '0.85' : '0.7';
    const changefreq = pathname.startsWith('/projects/') ? 'monthly' : pathname === '/projects' ? 'weekly' : 'monthly';
    return `  <url>\n    <loc>${SITE_ORIGIN}${pathname}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlBlocks.join('\n')}\n</urlset>\n`;
}

function main() {
  const payload = readJson(PROJECTS_JSON_PATH);
  const projects = assignSlugs(payload.projects || []);

  ensureDir(PROJECTS_DIR);

  // Serve /projects from a real static index file.
  if (fs.existsSync(PROJECTS_PAGE_PATH)) {
    fs.copyFileSync(PROJECTS_PAGE_PATH, PROJECTS_INDEX_PATH);
  }

  const projectPaths = [];

  projects.forEach((project) => {
    const slug = project._routeSlug;
    const dir = path.join(PROJECTS_DIR, slug);
    const file = path.join(dir, 'index.html');
    ensureDir(dir);

    const html = renderProjectPage(project);
    fs.writeFileSync(file, html, 'utf8');

    projectPaths.push(`/projects/${encodeURIComponent(slug)}`);
  });

  const staticPaths = ['/', '/projects', '/product-showcase.html', '/contact.html', '/llms.txt', '/llms-full.txt'];
  const sitemap = buildSitemap([...staticPaths, ...projectPaths]);
  fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf8');

  console.log(`Generated ${projects.length} static project pages.`);
  console.log('Updated /projects/index.html and sitemap.xml.');
}

main();
