# Dithering Guide - 3D Model Customization

Your portfolio now features a **3D model with a custom dithering shader** that creates a retro-futuristic effect using ordered dithering (Bayer matrix).

## What is Dithering?

Dithering is a technique that creates the illusion of color depth in images with a limited color palette by using patterns of pixels. Think of old newspaper prints or retro video games.

## Current Implementation

**Location:** Hero section on the homepage

**Model:** Torus Knot (complex knotted shape)

**Colors:** Black, Red, and White (matching your color scheme)

**Features:**
- Interactive: Follows your mouse movement
- Animated: Slow rotation + pulsing effect
- Shader-based: Custom WebGL dithering using Bayer 4x4 matrix
- Responsive: Works on all screen sizes

## Customization Options

### 1. Change the 3D Model

Edit `js/three-scene.js` line 108:

**Current:**
```javascript
const geometry = new THREE.TorusKnotGeometry(1.5, 0.5, 128, 32);
```

**Try these alternatives:**

**Icosahedron (geometric crystal):**
```javascript
const geometry = new THREE.IcosahedronGeometry(2, 1);
```

**Octahedron (diamond shape):**
```javascript
const geometry = new THREE.OctahedronGeometry(2, 2);
```

**Torus (donut):**
```javascript
const geometry = new THREE.TorusGeometry(1.5, 0.6, 32, 64);
```

**Sphere (classic):**
```javascript
const geometry = new THREE.SphereGeometry(2, 32, 32);
```

**Box (cube):**
```javascript
const geometry = new THREE.BoxGeometry(2, 2, 2, 4, 4, 4);
```

### 2. Adjust Dithering Intensity

Edit the shader uniforms around line 40:

```javascript
uniforms: {
    ditherScale: { value: 8.0 },  // Lower = more detailed, Higher = chunkier
    animationSpeed: { value: 0.2 } // Speed of the pulsing animation
}
```

**Recommendations:**
- `ditherScale: 4.0` - Fine dithering (more detail)
- `ditherScale: 8.0` - Medium (current, balanced)
- `ditherScale: 16.0` - Chunky dithering (more retro)

### 3. Change Colors

Edit lines 38-40:

```javascript
color1: { value: new THREE.Color(0xE63946) }, // Red
color2: { value: new THREE.Color(0x0A0A0A) }, // Black
color3: { value: new THREE.Color(0xF5F5F0) }, // White
```

The shader transitions between these three colors based on lighting.

### 4. Rotation Speed

Edit the animation loop (around line 165):

```javascript
// Continuous slow rotation
mesh.rotation.x += 0.002;  // Increase for faster
mesh.rotation.y += 0.003;  // Increase for faster
```

### 5. Mouse Sensitivity

Edit around line 157:

```javascript
targetRotationY = mouseX * 0.5;  // Increase for more movement
targetRotationX = mouseY * 0.5;  // Increase for more movement
```

## Advanced: Custom Dithering Patterns

The shader uses a 4x4 Bayer matrix. You can create different patterns:

**8x8 Bayer Matrix (more subtle):**
Replace the `dither4x4` function with an 8x8 version for smoother gradients.

**Random Dithering:**
Replace ordered dithering with noise-based dithering for a grainier look.

**Halftone Effect:**
Use circular dots instead of squares for a comic book look.

## Testing Changes

1. Edit `js/three-scene.js`
2. Save the file
3. Refresh your browser (Cmd+R or Ctrl+R)
4. Changes appear immediately

## Troubleshooting

**3D model not showing:**
- Check browser console for errors (Right-click → Inspect → Console)
- Make sure Three.js CDN is accessible
- Verify `#three-container` exists in HTML

**Performance issues:**
- Reduce geometry detail (lower the numbers in geometry creation)
- Simplify the shader
- Lower `ditherScale` value

**Dithering too subtle:**
- Increase `ditherScale` to 12 or 16
- Adjust lighting in the shader
- Try a simpler geometry (sphere or box)

## Other Dithering Effects Available

Beyond the 3D model, your site has these dithering CSS effects:

**In `css/dithering.css`:**
- `.dither-effect` - Subtle grid overlay
- `.dither-hover` - Dithering appears on hover
- `.scanlines` - Old monitor scanlines
- `.noise-texture` - Film grain effect
- `.glitch` - Glitch animation on hover
- `.vhs-effect` - VHS distortion lines

**To apply these:**
Add the class to any HTML element:
```html
<div class="your-element dither-effect">...</div>
```

## Recommendations for Your Portfolio

**Current setup is good for:**
- Professional look with unique flair
- Shows technical skill (custom shader)
- Interactive and engaging

**Consider:**
- Keep the torus knot - it's complex and interesting
- Current dithering scale (8.0) is balanced
- Colors match your brand perfectly

**Future enhancements:**
- Add project thumbnails with dithering effects
- Create a dithered image gallery
- Add dithering to hover states on project cards

## Resources

- **Three.js Docs:** https://threejs.org/docs/
- **Shader Tutorial:** https://thebookofshaders.com/
- **Dithering Algorithms:** https://en.wikipedia.org/wiki/Dither

---

**Questions?** The shader code is heavily commented - check `js/three-scene.js` for details on how it works!
