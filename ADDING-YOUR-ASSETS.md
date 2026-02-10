# Adding Your Assets - Complete Guide

Where to put your images, 3D files, and how to use them in your portfolio.

## 📁 Directory Structure

```
portfolio-site/
├── assets/
│   ├── images/
│   │   ├── profile/              ← Your headshots/portraits
│   │   │   └── zach-mohr.jpg
│   │   └── projects/             ← Project photos
│   │       ├── toilet-holder/
│   │       │   ├── hero.jpg
│   │       │   ├── prototype-1.jpg
│   │       │   ├── assembly.jpg
│   │       │   └── final-product.jpg
│   │       ├── electric-seat/
│   │       │   ├── hero.jpg
│   │       │   ├── cad-render.jpg
│   │       │   └── comparison.jpg
│   │       └── furniture/
│   │           ├── piece-1.jpg
│   │           └── piece-2.jpg
│   │
│   ├── models/                   ← Your 3D CAD files
│   │   ├── toilet-holder.glb
│   │   ├── electric-seat.glb
│   │   └── furniture-piece.glb
│   │
│   ├── fonts/                    ← Custom fonts (optional)
│   └── icons/                    ← Custom icons (optional)
```

---

## 1️⃣ Adding Your Profile Photo

### Where to Put It:
```
assets/images/profile/zach-mohr.jpg
```

### How to Add:
1. **Export/Save your photo** as JPG or PNG
2. **Name it clearly**: `zach-mohr.jpg` or `headshot.jpg`
3. **Drag into folder**: `portfolio-site/assets/images/profile/`

### Update HTML (index.html):

Find this (around line 77):
```html
<div class="about-image-placeholder dither-effect">
    <!-- Your photo will go here -->
    <span class="placeholder-text">Your Photo</span>
</div>
```

Replace with:
```html
<div class="about-image">
    <img src="assets/images/profile/zach-mohr.jpg"
         alt="Zach Mohr - Mechanical Engineer"
         class="dither-effect">
</div>
```

---

## 2️⃣ Adding Project Images

### Where to Put Them:

Create a folder for each project:
```
assets/images/projects/toilet-holder/
├── hero.jpg           ← Main showcase image
├── prototype-1.jpg    ← Early iterations
├── prototype-2.jpg
├── assembly.jpg       ← Assembly process
├── components.jpg     ← Individual parts
└── final.jpg          ← Finished product
```

### Image Types to Include:

**For Toilet Paper Holder:**
- ✅ Hero shot (installed or beauty shot)
- ✅ 3D printed prototypes
- ✅ Component parts (aluminum tube, springs, etc.)
- ✅ Assembly/disassembly shots
- ✅ Iterations side-by-side
- ✅ CAD screenshots (if you have them)

**For Electric Seat:**
- ✅ CAD renderings
- ✅ Prototype photos
- ✅ Before/after comparison
- ✅ Component details
- ✅ Testing setup

**For Furniture:**
- ✅ Finished pieces
- ✅ Joinery details
- ✅ Work in progress
- ✅ Material details

### Update HTML (projects.html):

Find the project cards (around line 70):
```html
<div class="project-image dither-hover">
    <div class="project-image-placeholder">
        <span class="placeholder-text">Toilet Paper Holder</span>
    </div>
</div>
```

Replace with:
```html
<div class="project-image dither-hover">
    <img src="assets/images/projects/toilet-holder/hero.jpg"
         alt="Patent-pending toilet paper holder">
</div>
```

---

## 3️⃣ Adding 3D Model Files

### Where to Put Them:
```
assets/models/toilet-holder.glb
assets/models/electric-seat.glb
```

### Supported Formats:
- ✅ **.glb** (BEST - recommended)
- ✅ **.gltf** (good - multiple files)
- ⚠️ **.stl** (works but basic)
- ⚠️ **.obj** (works but older)

### How to Export from CAD:

**From SolidWorks:**
1. File → Save As
2. Save as type: **GLB Binary (*.glb)**
3. Save to: `portfolio-site/assets/models/your-file.glb`

**From Fusion 360:**
1. Right-click component in browser
2. Select "Save as GLB"
3. Save to: `portfolio-site/assets/models/your-file.glb`

**If you can't export GLB:**
- Export as STL (works but less ideal)
- Or use online converter: [gltf.report](https://gltf.report/)

### Update HTML (product-showcase.html):

The JavaScript is already set up (around line 180):
```javascript
new ProductExploder('product-explode-1', 'assets/models/toilet-holder.glb', {
    explodeDistance: 3.0,
    animationDuration: 2000,
    autoRotate: true,
    dithering: true
});
```

**Just make sure your filename matches!**

---

## 4️⃣ Quick Reference: Updating All Assets

### Your Profile Photo
**File:** `index.html` (line ~77)
```html
<!-- FIND: -->
<div class="about-image-placeholder dither-effect">

<!-- REPLACE WITH: -->
<img src="assets/images/profile/your-photo.jpg" alt="Zach Mohr">
```

### Project Card Images
**File:** `projects.html` (lines ~70, 84, 98, etc.)
```html
<!-- FIND: -->
<div class="project-image-placeholder">

<!-- REPLACE WITH: -->
<img src="assets/images/projects/project-name/hero.jpg" alt="Project Name">
```

### 3D Models
**File:** `product-showcase.html` or update `js/product-explode.js`
```javascript
// Just ensure the path matches your filename:
'assets/models/your-file.glb'
```

---

## 5️⃣ Image Optimization Tips

### Before Adding Images:

**Resize:**
- Profile photo: 800x1000px (portrait)
- Project hero images: 1600x1000px (landscape)
- Detail shots: 1200x800px

**Compress:**
- Use [TinyPNG](https://tinypng.com/) or [Squoosh](https://squoosh.app/)
- Target: under 500KB per image
- Quality: 80-85% is usually perfect

**Format:**
- Use JPG for photos
- Use PNG for graphics/screenshots with transparency
- WebP is even better (modern browsers)

### Why Optimize?
- ✅ Faster page load times
- ✅ Better Lighthouse score
- ✅ Saves Cloudflare R2 bandwidth costs
- ✅ Better mobile experience

---

## 6️⃣ Using Cloudflare R2 for Large Assets

If you have **very large files** (high-res images, videos, many 3D models):

### Setup R2:
1. Cloudflare Dashboard → R2 Object Storage
2. Create bucket: `portfolio-assets`
3. Upload your large files there
4. Enable public access with custom domain

### Reference in HTML:
```html
<!-- Instead of: -->
<img src="assets/images/big-file.jpg">

<!-- Use R2 URL: -->
<img src="https://assets.zachmohr.work/images/big-file.jpg">
```

**When to use R2:**
- 10+ high-res images
- 4K photos
- Videos
- Many large 3D models
- Total assets > 50MB

**When to keep local (in repo):**
- Few optimized images
- Small 3D models (< 5MB each)
- Total assets < 20MB

---

## 7️⃣ File Naming Best Practices

### Good Names:
✅ `toilet-holder-hero.jpg`
✅ `electric-seat-prototype-v3.jpg`
✅ `furniture-walnut-table.jpg`
✅ `zach-mohr-headshot.jpg`

### Bad Names:
❌ `IMG_1234.jpg`
❌ `photo.jpg`
❌ `Screen Shot 2025-01-28.png`
❌ `my awesome project final final FINAL.jpg`

### Why?
- Easier to find files later
- Better for SEO
- Clear in code/HTML
- Professional organization

---

## 8️⃣ Complete Example: Adding Toilet Holder Assets

Let's walk through adding all assets for one project:

### Step 1: Gather Your Files
```
From your computer:
- Headshot photo
- 3-5 photos of toilet holder (prototypes, final, components)
- CAD file (GLB export)
```

### Step 2: Organize & Rename
```
Rename to:
- zach-mohr-headshot.jpg
- toilet-holder-hero.jpg
- toilet-holder-prototype-v1.jpg
- toilet-holder-components.jpg
- toilet-holder-assembly.jpg
- toilet-holder.glb
```

### Step 3: Add to Portfolio
```bash
# Copy files (Mac/Linux):
cp ~/Downloads/zach-mohr-headshot.jpg ~/Documents/portfolio-site/assets/images/profile/

cp ~/Downloads/toilet-holder-*.jpg ~/Documents/portfolio-site/assets/images/projects/toilet-holder/

cp ~/Downloads/toilet-holder.glb ~/Documents/portfolio-site/assets/models/
```

Or just **drag and drop** into the folders!

### Step 4: Update HTML

**index.html** - Profile photo:
```html
<img src="assets/images/profile/zach-mohr-headshot.jpg" alt="Zach Mohr">
```

**projects.html** - Project card:
```html
<div class="project-image dither-hover">
    <img src="assets/images/projects/toilet-holder/toilet-holder-hero.jpg"
         alt="Patent-pending toilet paper holder prototype">
</div>
```

**product-showcase.html** - Already configured:
```javascript
// Just make sure filename matches:
'assets/models/toilet-holder.glb' ✅
```

### Step 5: Test Locally
```bash
cd ~/Documents/portfolio-site
python3 -m http.server 8000
# Open: http://localhost:8000
```

Check that all images load!

---

## 9️⃣ Example: Multiple Project Images in Gallery

Want to show multiple images for one project? Create a simple gallery:

```html
<div class="project-gallery">
    <img src="assets/images/projects/toilet-holder/hero.jpg" alt="Final product">
    <img src="assets/images/projects/toilet-holder/prototype-v1.jpg" alt="Prototype version 1">
    <img src="assets/images/projects/toilet-holder/prototype-v2.jpg" alt="Prototype version 2">
    <img src="assets/images/projects/toilet-holder/components.jpg" alt="Component parts">
</div>
```

Add simple CSS:
```css
.project-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
}

.project-gallery img {
    width: 100%;
    height: auto;
    border: 2px solid var(--color-gray-200);
}
```

---

## 🔟 Checklist Before Deploying

Assets ready to go?

- [ ] Profile photo added and showing on homepage
- [ ] At least 1 project has hero image
- [ ] Images are optimized (< 500KB each)
- [ ] 3D model files are in GLB format
- [ ] File names are clear and descriptive
- [ ] All images load in local preview
- [ ] Alt text added to all images
- [ ] Tested on mobile (responsive images)

---

## Quick Commands

### Create all folders at once:
```bash
cd ~/Documents/portfolio-site/assets/images
mkdir -p profile projects/toilet-holder projects/electric-seat projects/furniture projects/bobcat projects/hydroforming
```

### Check what's in your assets:
```bash
cd ~/Documents/portfolio-site/assets
find . -type f
```

### See file sizes:
```bash
cd ~/Documents/portfolio-site/assets
du -sh images/*
du -sh models/*
```

---

## Need Help?

**Common Questions:**

**Q: My images aren't showing**
- Check file path is correct
- Check file extension (jpg vs jpeg)
- View browser console (F12) for errors
- Make sure you're using relative paths: `assets/...` not `/assets/...`

**Q: 3D model won't load**
- Verify file is actually GLB format
- Check file size (< 10MB recommended)
- Test the file at: https://gltf-viewer.donmccurdy.com/
- Check browser console for errors

**Q: Can I use my phone camera photos?**
- Yes! But compress them first
- Phone photos are often 3-5MB → optimize to < 500KB
- Use TinyPNG or Squoosh

**Q: Where do I put CAD screenshots?**
- Same as project images: `assets/images/projects/project-name/cad-view.jpg`
- Export from your CAD software at high quality

---

## Summary

**Profile Photo:**
→ `assets/images/profile/your-name.jpg`
→ Update `index.html` line 77

**Project Images:**
→ `assets/images/projects/project-name/*.jpg`
→ Update `projects.html` in each project card

**3D Models:**
→ `assets/models/your-model.glb`
→ Already configured in `product-showcase.html`

**Once files are in place, just update the HTML paths and you're done!** 🎉
