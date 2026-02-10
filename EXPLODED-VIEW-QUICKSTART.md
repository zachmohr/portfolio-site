# Exploded View Animation - Quick Start

Your portfolio now has **scroll-triggered exploded view animations** with dithering shaders for your CAD models!

## What This Does

When visitors scroll to your product:
1. The 3D model **explodes** - parts fly outward from center
2. Each part has a **dithering shader** (black, red, white retro effect)
3. Model **rotates slowly** for 360° view
4. Parts **return** when scrolling away
5. **Interactive** - follows mouse movement

## See It Now

1. Open `product-showcase.html` in your browser
2. Scroll down to the product sections
3. Watch the models explode!

**Note:** Currently showing placeholders since you haven't added your CAD files yet.

---

## Adding Your First Product (5 Minutes)

### Step 1: Export Your CAD File

**From SolidWorks:**
- File → Save As → **GLB** (recommended) or **STL**
- Save to: `assets/models/your-product.glb`

**From Fusion 360:**
- Right-click component → Save as GLB
- Save to: `assets/models/your-product.glb`

**Other CAD software?** → See full `CAD-EXPORT-GUIDE.md`

### Step 2: Add HTML Container

In `product-showcase.html` or any page:

```html
<div class="product-3d-container" id="my-product-explode" style="height: 600px;">
    <div class="scroll-hint">Scroll to explode view</div>
</div>
```

### Step 3: Initialize the Exploder

At the bottom of your HTML file:

```html
<script type="module">
    import { ProductExploder } from './js/product-explode.js';

    new ProductExploder('my-product-explode', 'assets/models/your-product.glb', {
        explodeDistance: 3.0,      // How far apart (1-5)
        animationDuration: 2000,   // Speed in milliseconds
        autoRotate: true,          // Keep spinning
        dithering: true           // Apply shader
    });
</script>
```

### Step 4: Test It!

1. Save the file
2. Refresh browser
3. Scroll to trigger explosion

---

## Perfect Products to Showcase

Based on your background, these would be **killer** exploded views:

### 1. Toilet Paper Holder ⭐⭐⭐ (MUST DO)
- **Why:** 6 components, clear assembly, patent-pending
- **Parts:** Base, arm, spring housing, tube, end cap, fasteners
- **Impact:** Shows product development skill
- **Export from:** Your current CAD file
- **Explosion Distance:** 3.0 (moderate spacing)

### 2. Electric Seat Actuator ⭐⭐
- **Why:** Complex assembly, cost reduction story
- **Parts:** Motor, housing, bracket, wiring, mounting
- **Impact:** Shows innovation and engineering
- **Note:** Check if you can share (NDA?)
- **Explosion Distance:** 2.5 (compact view)

### 3. Custom Furniture ⭐
- **Why:** Shows craftsmanship, joinery details
- **Parts:** Wood pieces, metal brackets, fasteners
- **Impact:** Demonstrates versatility
- **Explosion Distance:** 4.0 (show joinery clearly)

---

## Customization Cheat Sheet

### Make Explosion Bigger
```javascript
explodeDistance: 5.0  // Parts fly further
```

### Make Animation Faster
```javascript
animationDuration: 1000  // 1 second (fast)
```

### Make Animation Slower
```javascript
animationDuration: 4000  // 4 seconds (dramatic)
```

### Disable Auto-Rotation
```javascript
autoRotate: false
```

### Change Dithering Intensity

Edit `js/product-explode.js` line 123:
```javascript
ditherScale: { value: 16.0 }  // Higher = chunkier dithering
```

### Change Colors

Edit `js/product-explode.js` lines 119-121:
```javascript
color1: { value: new THREE.Color(0xE63946) }, // Your accent color
color2: { value: new THREE.Color(0x0A0A0A) }, // Dark color
color3: { value: new THREE.Color(0xF5F5F0) }, // Light color
```

---

## File Format Guide

| Format | Recommendation | Ease of Export |
|--------|---------------|----------------|
| **.glb** | ✅ **BEST** - One file, keeps parts separate | Medium |
| **.gltf** | ✅ Good - Multiple files, editable | Medium |
| **.stl** | ⚠️ OK - Universal but loses part info | Easy |
| **.obj** | ⚠️ OK - Older format, larger files | Easy |

**Bottom line:** Try to export as **GLB** for best results.

---

## Common Issues & Fixes

### "Model not loading"
- ✅ Check file path: `assets/models/filename.glb`
- ✅ Check browser console for errors (F12)
- ✅ Try opening in local server (not `file://`)

### "No explosion happening"
- ✅ Your CAD file needs **multiple parts** (not merged)
- ✅ Check if model loaded: open console, should say "Model loaded: X parts"
- ✅ Make sure you're scrolling past the container

### "Model is tiny / huge"
- ✅ Auto-scales to fit, but check your CAD units
- ✅ Export in millimeters or inches
- ✅ Manually adjust camera in code if needed

### "Parts explode in weird directions"
- ✅ Check if model is centered at origin in CAD
- ✅ Try different `explodeDistance` values
- ✅ Model might have internal parts - that's OK!

---

## Pro Tips

### For Best Results:

1. **Export assemblies, not single parts**
   - Each component should be separate mesh
   - Sub-assemblies work great

2. **Name your parts logically**
   - base, cover, spring, etc.
   - Makes debugging easier

3. **Optimize file size**
   - Keep under 5MB per product
   - Reduce polygon count if needed
   - See `CAD-EXPORT-GUIDE.md` for compression

4. **Test locally first**
   - Run local server: `python3 -m http.server 8000`
   - Open: `http://localhost:8000`
   - Then deploy to Cloudflare

5. **Mobile performance**
   - Simpler models work better
   - Consider lower poly versions for mobile
   - Animation works on touch devices

---

## Multiple Products?

Add as many as you want! Each needs:

1. Unique container ID
2. Its own initialization

**Example - 3 products:**

```html
<!-- Product 1 -->
<div id="product-1"></div>

<!-- Product 2 -->
<div id="product-2"></div>

<!-- Product 3 -->
<div id="product-3"></div>

<script type="module">
    import { ProductExploder } from './js/product-explode.js';

    new ProductExploder('product-1', 'assets/models/product1.glb');
    new ProductExploder('product-2', 'assets/models/product2.glb');
    new ProductExploder('product-3', 'assets/models/product3.glb');
</script>
```

---

## Where to Use This

### Option 1: Dedicated Page (Recommended)
- Use `product-showcase.html`
- Multiple products with descriptions
- Professional presentation

### Option 2: Projects Page
- Inline with project cards
- Shows products in context
- More integrated feel

### Option 3: Hero Section
- Make it the first thing visitors see
- Immediate wow factor
- Single featured product

---

## Export Checklist for Toilet Holder

- [ ] Open assembly in SolidWorks/Fusion
- [ ] Verify all 6 parts are separate components
- [ ] Center model at origin
- [ ] File → Save As → GLB
- [ ] Save to: `assets/models/toilet-holder.glb`
- [ ] Update `product-showcase.html` path
- [ ] Test in browser
- [ ] Adjust `explodeDistance` if needed
- [ ] Add description and meta data
- [ ] Deploy!

---

## Next Level Ideas

Once you have basic exploded views working:

1. **Assembly Sequence Animation**
   - Parts come together in order
   - Shows manufacturing/assembly logic

2. **Before/After Comparison**
   - Old mechanical seat vs new electric
   - Side-by-side explosions

3. **Interactive Hotspots**
   - Click parts for details
   - Highlight innovations

4. **Material Callouts**
   - Show material choices
   - Color-code by material type

5. **Cost Breakdown**
   - Visualize cost per component
   - Emphasize savings

---

## Resources

- **Full Export Guide:** `CAD-EXPORT-GUIDE.md`
- **Dithering Customization:** `DITHERING-GUIDE.md`
- **Three.js Docs:** https://threejs.org/docs/
- **glTF Viewer (test exports):** https://gltf-viewer.donmccurdy.com/

---

## Ready to Go!

Your portfolio now has a **unique feature** that 99% of engineering portfolios don't have:
- Interactive 3D models ✅
- Custom dithering shaders ✅
- Exploded view animations ✅
- Scroll-triggered interactions ✅

**This will make you stand out to:**
- Product design companies (shows 3D visualization skills)
- Engineering firms (demonstrates technical capability)
- Startups (shows modern web + engineering hybrid)

**Export your toilet paper holder and watch it explode on scroll! 🚀**
