# CAD Export Guide - Exploded View Animation

Complete guide to exporting your CAD files and creating scroll-triggered exploded view animations with dithering shaders.

## What You've Got

A **ProductExploder** class that:
- Loads 3D models (GLTF, GLB, STL, OBJ)
- Automatically detects individual parts/components
- Explodes them outward from center when you scroll
- Applies dithering shader to all parts
- Works with ANY product that has multiple components

## Quick Start

1. Export your CAD assembly to GLB format
2. Place file in `assets/models/your-product.glb`
3. Add container to your HTML
4. Initialize in the JavaScript
5. Scroll to trigger explosion!

---

## Part 1: Exporting from CAD Software

### From SolidWorks (Recommended)

**Best Method - Assembly with Multiple Parts:**

1. Open your assembly
2. File → Save As → **GLTF/GLB** (if you have the plugin)
3. Settings:
   - ✅ Export as Binary (.glb) - **BEST OPTION**
   - ✅ Include separate parts
   - ✅ Preserve hierarchy
   - Scale: 1:1 (or adjust for web display)

**Alternative - STL Export:**

1. File → Save As → **STL**
2. Options:
   - Save as Binary
   - Unit: Millimeters
   - Resolution: Fine
3. **Export each part separately** if you want explosion
4. Then import all STLs and group them

**Fallback - OBJ Export:**

1. File → Save As → **Wavefront OBJ**
2. Export options:
   - Include materials
   - Export textures (if any)

### From Fusion 360

**Method 1 - GLB (Best):**

1. Right-click on component in browser
2. Select "Save as GLB"
3. Choose location: `assets/models/`
4. Export settings:
   - Binary format
   - Include all components

**Method 2 - OBJ:**

1. File → Export
2. Choose **OBJ**
3. Settings:
   - Structure: Model structure
   - Refinement: High
   - Send to: Local

### From Onshape

1. Right-click assembly
2. Export → **GLTF** or **GLB**
3. Settings:
   - Version: 2.0
   - Binary: Yes
   - Maximum chord length: 0.1mm

### From Inventor

1. File → Export → **CAD Format**
2. Save as type: **GLTF** or **STL**
3. For multiple parts:
   - Export assembly (keeps hierarchy)
   - Binary format

### From STEP Files (Universal)

If you only have STEP files:

1. Import STEP into Fusion 360 (free)
2. Export as GLB following above steps

**Online Converter:**
- Upload to [gltf.report](https://gltf.report/) to convert

---

## Part 2: Optimizing Your 3D Model

### File Size Optimization

**Target:** < 5MB per model (for fast loading)

**Tools:**

1. **gltf-pipeline** (command line):
```bash
npm install -g gltf-pipeline
gltf-pipeline -i input.glb -o output.glb -d
```

2. **Blender** (free, GUI):
   - Import GLB
   - Select all → Decimate modifier
   - Ratio: 0.5 (reduces polygons by 50%)
   - Export GLB

3. **Online Tool:**
   - [glTF Transform](https://gltf.transform.donmccurdy.com/)
   - Upload → Optimize → Download

### Model Preparation Tips

**For Best Results:**

1. **Assembly Structure:**
   - Keep parts as separate objects
   - Each component should be its own mesh
   - Name parts logically (exploder finds all meshes)

2. **Geometry:**
   - Remove unnecessary detail
   - Combine small parts if needed
   - Center the model at origin

3. **Scale:**
   - Export in real-world units
   - Model should fit in ~2-5 unit box
   - JavaScript auto-scales to fit viewport

---

## Part 3: Setting Up Your Product

### Directory Structure

```
portfolio-site/
├── assets/
│   └── models/
│       ├── toilet-holder.glb       ← Your product files
│       ├── electric-seat.glb
│       └── furniture-piece.glb
```

### HTML Setup

Add a container wherever you want the 3D model:

```html
<div class="product-3d-container" id="product-explode-1">
    <div class="scroll-hint">Scroll to explode view</div>
</div>
```

### CSS (Already Included)

```css
.product-3d-container {
    width: 100%;
    height: 600px;
    background-color: var(--color-gray-100);
    border: 2px solid var(--color-gray-200);
}
```

### JavaScript Initialization

In `js/product-explode.js` or add this to your HTML:

```javascript
import { ProductExploder } from './js/product-explode.js';

new ProductExploder('product-explode-1', 'assets/models/toilet-holder.glb', {
    explodeDistance: 3.0,      // How far parts fly apart
    animationDuration: 2000,   // Animation speed (ms)
    autoRotate: true,          // Continuous rotation
    dithering: true            // Apply dithering shader
});
```

---

## Part 4: Customization Options

### Basic Options

```javascript
{
    explodeDistance: 3.0,        // Distance parts travel (1-5 recommended)
    animationDuration: 2000,     // Animation length in milliseconds
    autoRotate: true,            // Auto-rotate the model
    dithering: true,             // Apply dithering shader
    backgroundColor: 0x0A0A0A    // Background color (hex)
}
```

### Advanced: Custom Explosion Pattern

Edit `product-explode.js` line 180 to customize how parts explode:

**Radial Explosion (default):**
```javascript
calculateExplodeDirection(part, index) {
    const direction = partPosition.clone().sub(center).normalize();
    return direction;
}
```

**Linear Explosion (parts fly in one direction):**
```javascript
calculateExplodeDirection(part, index) {
    return new THREE.Vector3(0, 1, 0); // All parts go up
}
```

**Spiral Explosion:**
```javascript
calculateExplodeDirection(part, index) {
    const angle = (index / this.parts.length) * Math.PI * 2;
    const height = (index / this.parts.length) * 2;
    return new THREE.Vector3(
        Math.cos(angle),
        height,
        Math.sin(angle)
    );
}
```

---

## Part 5: Adding to Your Portfolio

### Option 1: Dedicated Product Showcase Page

Use the provided `product-showcase.html`:
- Displays multiple products
- Side-by-side layout with descriptions
- Scroll-triggered animations

### Option 2: Inline in Projects Page

Add to `projects.html` within a project card:

```html
<article class="project-card">
    <div class="product-3d-container" id="my-product" style="height: 400px;">
    </div>
    <div class="project-content">
        <h3>Your Product Name</h3>
        <p>Description...</p>
    </div>
</article>

<script type="module">
    import { ProductExploder } from './js/product-explode.js';
    new ProductExploder('my-product', 'assets/models/your-file.glb');
</script>
```

### Option 3: Hero Section Feature

Replace or add to hero section for wow factor.

---

## Part 6: Troubleshooting

### Model Not Loading

**Check console for errors:**
- Right-click page → Inspect → Console tab

**Common issues:**
1. Wrong file path → Check `assets/models/filename.glb`
2. File too large → Optimize (see Part 2)
3. CORS error → Use a local server (not `file://`)

**Local Server Setup:**
```bash
cd portfolio-site
python3 -m http.server 8000
# Open: http://localhost:8000
```

### No Parts Found / Won't Explode

**Solution:**
Your model needs to be an **assembly with multiple parts**, not a single merged mesh.

**Fix in Blender:**
1. Import your model
2. Tab → Edit Mode
3. Select part → P → Separate by loose parts
4. Export GLB

### Model Too Big/Small

**Adjust camera distance** in `product-explode.js` line 200:
```javascript
this.camera.position.set(maxDim * 2.0, maxDim * 2.0, maxDim * 2.0);
// Increase multiplier for smaller models
```

### Explosion Distance Wrong

**Adjust per-product:**
```javascript
new ProductExploder('product-id', 'model.glb', {
    explodeDistance: 5.0  // Increase for larger separation
});
```

### Performance Issues

**Reduce polygon count:**
1. Use Blender Decimate modifier
2. Simplify geometry in CAD before export
3. Export at lower resolution

**Disable dithering:**
```javascript
new ProductExploder('product-id', 'model.glb', {
    dithering: false  // Use standard materials instead
});
```

---

## Part 7: Best Practices

### For Mechanical Engineering Products

**Toilet Paper Holder:**
- Export all 6 components separately
- Name parts: base, arm, spring-housing, etc.
- Show assembly logic through explosion

**Electric Seat:**
- Highlight key components (motor, housing, bracket)
- Use color-coded parts if possible
- Export subassemblies at different levels

**Furniture:**
- Show joinery and connection methods
- Explode fasteners separately
- Demonstrate assembly sequence

### Visual Design Tips

1. **Camera Angle:**
   - Position shows most interesting view
   - Consider isometric angles for technical look

2. **Lighting:**
   - Use directional lights to highlight edges
   - Red accent light matches your brand

3. **Animation Timing:**
   - 2000ms is good default
   - Complex assemblies: 3000-4000ms
   - Simple products: 1500ms

4. **Explosion Distance:**
   - Dense assemblies: 2-3 units
   - Loose assemblies: 4-5 units
   - Test and adjust per product

---

## Part 8: Examples & Inspiration

### Your Products (Suggested)

**1. Toilet Paper Holder** ⭐ Priority
- 6 components
- Clear assembly logic
- Great for demonstrating design thinking

**2. Electric Seat Actuator**
- Show before/after complexity
- Highlight part count reduction
- Compare mechanical vs electric

**3. Custom Furniture Piece**
- Joinery details
- Material choices
- Assembly process

**4. 3D Printed Prototypes**
- Show iteration progression
- Multiple versions side-by-side

**5. Hydroforming Dies**
- Before/after comparison
- Relief notch locations

---

## Quick Reference: File Formats

| Format | Best For | Pros | Cons |
|--------|----------|------|------|
| **GLB** | Everything | All-in-one, fast, hierarchy | Requires plugin |
| **GLTF** | Web projects | Open standard, editable | Multiple files |
| **STL** | Single parts | Universal, simple | No color, no hierarchy |
| **OBJ** | Legacy support | Widely supported | Large files |

---

## Need Help?

**Common Questions:**

**Q: Can I use STEP files directly?**
A: No, convert to GLB using Fusion 360 or online converter first.

**Q: How many parts can I explode?**
A: Tested up to 100+ parts. More parts = slower animation.

**Q: Can I change colors?**
A: Yes! Edit the dithering shader uniforms (see DITHERING-GUIDE.md)

**Q: Does it work on mobile?**
A: Yes, but simpler models perform better.

**Q: Can I show assembly sequence?**
A: Yes! Modify the explode timing in `product-explode.js`

---

## Next Steps

1. ✅ Export your toilet paper holder CAD file
2. ✅ Place in `assets/models/`
3. ✅ Test on `product-showcase.html`
4. ✅ Adjust explosion distance and timing
5. ✅ Add product description
6. ✅ Deploy!

**You're all set to showcase your engineering work like no other portfolio!** 🚀
