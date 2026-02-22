# Portfolio Site Roadmap
Last updated: 2026-02-22

## How to continue work
- Preview server: `cd /Users/zachmohr/Documents/portfolio-site && python3 -m http.server 8080`
- Image editor: `cd /Users/zachmohr/Documents/portfolio-site/tools && node editor.js` → http://localhost:3001
- After adding projects to data/projects.json, regenerate llms: `node tools/generate-llms.js`
- Deploy: `git add ... && git commit && git push origin main` → Cloudflare auto-deploys to zachmohr.work

---

## 1. PROJECTS — In progress

### Remaining projects to add
These are known pending items. User uploads assets to `assets/images/projects/[folder]/` then we process and add JSON.

- [ ] **Arachno Side Table (mini)** — already added, but confirm photos look correct in the log
- [ ] **Home Goods Brand / Company** — user runs a home goods company; has product packaging design,
      box design, internal instructions, coupon cards, website layout, photography direction.
      Needs a new category (suggest: `design` or `brand-design`). Assets TBD — user to upload.
- [ ] **Graphic Design work** — logos, brand identity graphics. May fold into home goods entry or separate.
- [ ] **Travel-adjacent engineering projects** — any projects from trips or outdoor experiences TBD
- [ ] **Any remaining shop/fabrication projects** user remembers from camera roll

### Known future projects user mentioned
- Arachno side table mini (physical) — done ✓
- Birds-eye maple side table (arachno miniaturization) — done ✓
- Home goods brand work — pending upload

---

## 2. TRAVEL PAGE — Done ✓

### Concept
- Separate `travel.html` page
- Data-driven: `data/travels.json` (same pattern as projects.json)
- Each entry: location, date, hero image, optional photo log entries
- Audience signal: outdoor employers, aviation, general personal character
- Layout: trip cards grid → click to expand log (same UX pattern as projects)

### Implementation plan
1. ~~Create `data/travels.json` schema (location, date, country, region, tags, hero, entries)~~ ✓
2. ~~Create `js/travel-renderer.js` mirroring project-renderer.js~~ ✓
3. ~~Create `travel.html` page~~ ✓
4. ~~Add nav link to travel page from main nav~~ ✓
5. Process travel photos via same sips pipeline (resize to max 1200px wide for web — travel galleries
   will have many more images than project logs, so keep file sizes down)
6. ~~Add travel entries to llms.txt and regenerate llms-full.txt~~ ✓

### Image sizing note
Travel photos should be resized to 1200px wide max at quality 85 (vs project photos at full res).
Use: `sips -Z 1200 -s format jpeg -s formatOptions 85 input.HEIC --out output.jpg`

### To add a trip
Add an entry to `data/travels.json`:
```json
{
  "location": "Grand Teton National Park",
  "date": "2024-08",
  "country": "United States",
  "region": "Wyoming",
  "tags": ["Backpacking", "Mountains", "Wyoming"],
  "description": "Optional short description.",
  "hero": {
    "src": "assets/images/travel/grand-teton/hero.jpg",
    "alt": "Grand Teton summit ridge at sunrise"
  },
  "entries": [
    {
      "src": "assets/images/travel/grand-teton/01-approach.jpg",
      "alt": "Approach trail through the meadow",
      "caption": "Optional caption."
    }
  ]
}
```
Place images in `assets/images/travel/[trip-slug]/`.

---

## 3. EXPLORE / "WEB OF ME" PAGE — Not started

### Concept
Nokia Design Archives-style force-directed graph. Nodes = projects (+ eventually travels),
sized by some weight metric, connected by shared tags/category/technique/material.
Clicking a node opens the project log.

### Tech approach
- D3.js force simulation (vanilla JS, no framework — fits existing stack)
- Node size = number of shared connections (more connected = bigger)
- Edge types: shared tag (thin), shared category (medium), same material/technique (thick)
- Color by category
- Mobile: fallback to static list or simplified layout

### Implementation plan
1. Finish all projects first — more nodes = more interesting graph
2. Add `travels.json` entries — travel destinations become nodes too, linked to projects by location/theme
3. Build `explore.html` with D3 force graph
4. Load data from existing projects.json (+ travels.json when ready)
5. Add nav link
6. Tune physics (repulsion, link distance, charge) for good layout
7. Mobile fallback

### Reference
- Nokia Design Archives: https://www.nokia.com/networks/insights/design-archive/
- D3 force simulation docs: https://d3js.org/d3-force

---

## 4. LLMS / AGENT DISCOVERABILITY — Done ✓

- [x] `/llms.txt` — summary for agents, hand-authored
- [x] `/llms-full.txt` — full project detail, auto-generated from projects.json
- [x] `tools/generate-llms.js` — regeneration script
- [x] `zach@zachmohr.work` — custom email via Cloudflare Email Routing → forwards to Gmail
- [ ] Update llms.txt if/when explore page goes live
- [ ] Re-run `node tools/generate-llms.js` after every batch of new projects

---

## 5. FUTURE / NICE TO HAVE

- [ ] **Dark mode** — user hasn't asked but worth noting
- [ ] **Contact form** — simple form posting to a Cloudflare Worker or Formspree
- [ ] **Resume PDF** — link from nav or about section
- [ ] **About page** — short bio, photo, currently just implied by the work
- [ ] **Blog / notes** — user mentioned MS in Innovation Design; could document thesis work
- [ ] **Sitemap.xml + robots.txt** — basic SEO hygiene, also helps agent crawlers

---

## Stack reference
- Vanilla HTML/CSS/JS — no framework
- `data/projects.json` → `js/project-renderer.js` → `projects.html`
- Images: `assets/images/projects/[project-id]/hero.jpg` + `01-name.jpg`, `02-name.jpg` etc.
- HEIC conversion: `sips -s format jpeg -s formatOptions 88 input.HEIC --out output.jpg`
- Image editor: `tools/editor.js` (Express + Sharp) at localhost:3001
- Deploy: GitHub (`zachmohr/portfolio-site`) → Cloudflare Pages (auto on push to main)
- Domain: `zachmohr.work` (registered through Cloudflare)
- Email: `zach@zachmohr.work` → Cloudflare Email Routing → `zmohr026@gmail.com`
