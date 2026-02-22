/**
 * Portfolio Image Editor
 * Run: node tools/editor.js
 * Opens at: http://localhost:3001
 */

const express = require('express');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;
const PROJECTS_DIR = path.join(__dirname, '..', 'assets', 'images', 'projects');

app.use(express.json({ limit: '50mb' }));

// Serve project images statically
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// List all project folders and their images
app.get('/api/projects', (req, res) => {
    const projects = fs.readdirSync(PROJECTS_DIR)
        .filter(f => fs.statSync(path.join(PROJECTS_DIR, f)).isDirectory())
        .map(folder => {
            const folderPath = path.join(PROJECTS_DIR, folder);
            const images = fs.readdirSync(folderPath)
                .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
                .map(img => ({
                    name: img,
                    path: `assets/images/projects/${folder}/${img}`,
                    fullPath: path.join(folderPath, img)
                }));
            return { folder, images };
        });
    res.json(projects);
});

// Get image dimensions
app.get('/api/info', async (req, res) => {
    const filePath = path.join(__dirname, '..', req.query.path);
    try {
        const meta = await sharp(filePath).metadata();
        res.json({ width: meta.width, height: meta.height });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Apply rotate + crop and save in place
app.post('/api/save', async (req, res) => {
    const { imagePath, rotation, crop, quality } = req.body;
    // crop: { left, top, width, height } — all in terms of the rotated image
    const filePath = path.join(__dirname, '..', imagePath);

    try {
        // rotate() with no args strips EXIF and bakes in the correct orientation first
        // then we apply the user's additional rotation on top
        let pipeline = sharp(filePath, { failOnError: false }).rotate();

        // Apply user rotation on top of EXIF-corrected image
        if (rotation && rotation !== 0) {
            pipeline = pipeline.rotate(rotation);
        }

        // Apply crop if provided
        if (crop && crop.width > 0 && crop.height > 0) {
            pipeline = pipeline.extract({
                left: Math.round(crop.left),
                top: Math.round(crop.top),
                width: Math.round(crop.width),
                height: Math.round(crop.height)
            });
        }

        // Save as high quality JPEG
        const q = Math.max(75, Math.min(100, quality || 88));
        await pipeline.jpeg({ quality: q, mozjpeg: true }).toFile(filePath + '.tmp');

        // Atomic replace
        fs.renameSync(filePath + '.tmp', filePath);

        const meta = await sharp(filePath).metadata();
        res.json({ success: true, width: meta.width, height: meta.height });
    } catch (e) {
        if (fs.existsSync(filePath + '.tmp')) fs.unlinkSync(filePath + '.tmp');
        res.status(500).json({ error: e.message });
    }
});

// Serve the editor UI
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Image Editor — Portfolio Tools</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #111; color: #f0f0f0; font-family: 'Courier New', monospace; display: flex; height: 100vh; overflow: hidden; }

  /* Sidebar */
  #sidebar { width: 260px; min-width: 260px; background: #1a1a1a; border-right: 1px solid #333; display: flex; flex-direction: column; overflow: hidden; }
  #sidebar h1 { font-size: 12px; letter-spacing: 0.15em; color: #e63946; padding: 16px; border-bottom: 1px solid #333; text-transform: uppercase; }
  #project-list { flex: 1; overflow-y: auto; }
  .project-group { border-bottom: 1px solid #222; }
  .project-header { padding: 10px 16px; font-size: 11px; color: #888; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
  .project-header:hover { color: #ccc; }
  .project-images { display: none; }
  .project-images.open { display: block; }
  .image-item { padding: 8px 16px 8px 24px; font-size: 11px; cursor: pointer; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .image-item:hover { background: #252525; color: #fff; }
  .image-item.active { background: #2a1a1a; color: #e63946; }

  /* Main editor */
  #main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  #toolbar { background: #1a1a1a; border-bottom: 1px solid #333; padding: 10px 16px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  #toolbar .label { font-size: 10px; color: #666; letter-spacing: 0.1em; text-transform: uppercase; margin-right: 4px; }
  button { background: #252525; color: #ccc; border: 1px solid #444; padding: 6px 14px; font-family: 'Courier New', monospace; font-size: 11px; cursor: pointer; letter-spacing: 0.05em; text-transform: uppercase; }
  button:hover { background: #333; color: #fff; border-color: #666; }
  button.primary { background: #e63946; color: #fff; border-color: #e63946; }
  button.primary:hover { background: #c0303a; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  #quality-input { background: #252525; border: 1px solid #444; color: #ccc; padding: 5px 8px; font-family: 'Courier New', monospace; font-size: 11px; width: 50px; }
  #info-bar { font-size: 10px; color: #555; margin-left: auto; }
  #status { font-size: 11px; padding: 4px 10px; }
  #status.ok { color: #4caf50; }
  #status.err { color: #e63946; }

  /* Canvas area */
  #canvas-area { flex: 1; overflow: hidden; position: relative; background: #0d0d0d; cursor: crosshair; }
  #canvas-wrapper { position: absolute; transform-origin: top left; }
  canvas { display: block; }

  /* Crop overlay */
  #crop-overlay { position: absolute; top: 0; left: 0; pointer-events: none; }

  /* Instructions */
  #empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: #333; font-size: 13px; letter-spacing: 0.1em; }
</style>
</head>
<body>

<div id="sidebar">
  <h1>Portfolio Images</h1>
  <div id="project-list">Loading...</div>
</div>

<div id="main">
  <div id="toolbar">
    <span class="label">Rotate</span>
    <button id="btn-ccw" disabled>↺ CCW</button>
    <button id="btn-cw" disabled>↻ CW</button>
    <button id="btn-180" disabled>↕ 180°</button>
    <span style="width:1px;height:24px;background:#333;margin:0 4px;"></span>
    <span class="label">Crop</span>
    <button id="btn-crop-mode" disabled>Draw Crop</button>
    <button id="btn-crop-clear" disabled>Clear Crop</button>
    <span style="width:1px;height:24px;background:#333;margin:0 4px;"></span>
    <span class="label">Quality</span>
    <input id="quality-input" type="number" min="75" max="100" value="88" title="JPEG quality (75-100)">
    <span style="width:1px;height:24px;background:#333;margin:0 4px;"></span>
    <button id="btn-reset" disabled>Reset</button>
    <button id="btn-save" class="primary" disabled>Save in Place</button>
    <span id="info-bar">—</span>
    <span id="status"></span>
  </div>

  <div id="empty-state" id="empty">Select an image from the sidebar</div>
  <div id="canvas-area" style="display:none;">
    <div id="canvas-wrapper">
      <canvas id="canvas"></canvas>
      <canvas id="crop-overlay"></canvas>
    </div>
  </div>
</div>

<script>
let currentImage = null;   // { path, naturalW, naturalH }
let rotation = 0;          // cumulative degrees: 0, 90, 180, 270
let cropRect = null;       // { left, top, width, height } in rotated-image pixels
let cropMode = false;
let cropStart = null;
let scale = 1;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('crop-overlay');
const octx = overlay.getContext('2d');
const canvasArea = document.getElementById('canvas-area');
const wrapper = document.getElementById('canvas-wrapper');
const infoBar = document.getElementById('info-bar');
const status = document.getElementById('status');

// Load project list
fetch('/api/projects').then(r => r.json()).then(projects => {
    const list = document.getElementById('project-list');
    list.innerHTML = '';
    projects.forEach(p => {
        if (!p.images.length) return;
        const group = document.createElement('div');
        group.className = 'project-group';

        const header = document.createElement('div');
        header.className = 'project-header';
        header.innerHTML = p.folder + '<span>▸</span>';
        header.onclick = () => {
            imgs.classList.toggle('open');
            header.querySelector('span').textContent = imgs.classList.contains('open') ? '▾' : '▸';
        };

        const imgs = document.createElement('div');
        imgs.className = 'project-images';

        p.images.forEach(img => {
            const item = document.createElement('div');
            item.className = 'image-item';
            item.textContent = img.name;
            item.onclick = () => loadImage(img.path, item);
            imgs.appendChild(item);
        });

        group.appendChild(header);
        group.appendChild(imgs);
        list.appendChild(group);
    });
});

function loadImage(imgPath, el) {
    // Mark active
    document.querySelectorAll('.image-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');

    rotation = 0;
    cropRect = null;
    cropMode = false;

    const img = new Image();
    img.onload = () => {
        currentImage = { path: imgPath, naturalW: img.naturalWidth, naturalH: img.naturalHeight, el: img };
        document.getElementById('empty-state').style.display = 'none';
        canvasArea.style.display = 'block';
        renderCanvas();
        enableControls(true);
        setStatus('');
    };
    img.onerror = () => setStatus('Failed to load image', true);
    img.src = '/' + imgPath + '?t=' + Date.now();
}

function getRotatedDims() {
    if (!currentImage) return { w: 0, h: 0 };
    const r = ((rotation % 360) + 360) % 360;
    if (r === 90 || r === 270) return { w: currentImage.naturalH, h: currentImage.naturalW };
    return { w: currentImage.naturalW, h: currentImage.naturalH };
}

function renderCanvas() {
    if (!currentImage) return;

    const { w, h } = getRotatedDims();
    const areaW = canvasArea.clientWidth;
    const areaH = canvasArea.clientHeight;
    scale = Math.min(areaW / w, areaH / h, 1);

    const dispW = Math.round(w * scale);
    const dispH = Math.round(h * scale);

    canvas.width = dispW;
    canvas.height = dispH;
    overlay.width = dispW;
    overlay.height = dispH;

    wrapper.style.left = Math.round((areaW - dispW) / 2) + 'px';
    wrapper.style.top = Math.round((areaH - dispH) / 2) + 'px';

    ctx.save();
    ctx.clearRect(0, 0, dispW, dispH);

    const r = ((rotation % 360) + 360) % 360;
    ctx.translate(dispW / 2, dispH / 2);
    ctx.rotate(r * Math.PI / 180);

    const srcW = currentImage.naturalW * scale;
    const srcH = currentImage.naturalH * scale;
    ctx.drawImage(currentImage.el, -srcW / 2, -srcH / 2, srcW, srcH);
    ctx.restore();

    drawCropOverlay();
    infoBar.textContent = w + ' × ' + h + 'px  |  scale ' + (scale * 100).toFixed(0) + '%' + (cropRect ? '  |  crop: ' + Math.round(cropRect.width) + '×' + Math.round(cropRect.height) : '');
}

function drawCropOverlay() {
    octx.clearRect(0, 0, overlay.width, overlay.height);
    if (!cropRect) return;

    const { w, h } = getRotatedDims();
    const x = cropRect.left * scale;
    const y = cropRect.top * scale;
    const cw = cropRect.width * scale;
    const ch = cropRect.height * scale;

    octx.fillStyle = 'rgba(0,0,0,0.55)';
    octx.fillRect(0, 0, overlay.width, overlay.height);
    octx.clearRect(x, y, cw, ch);

    octx.strokeStyle = '#e63946';
    octx.lineWidth = 1.5;
    octx.strokeRect(x, y, cw, ch);

    // Rule of thirds
    octx.strokeStyle = 'rgba(230,57,70,0.3)';
    octx.lineWidth = 0.5;
    for (let i = 1; i < 3; i++) {
        octx.beginPath(); octx.moveTo(x + cw * i / 3, y); octx.lineTo(x + cw * i / 3, y + ch); octx.stroke();
        octx.beginPath(); octx.moveTo(x, y + ch * i / 3); octx.lineTo(x + cw, y + ch * i / 3); octx.stroke();
    }

    infoBar.textContent = getRotatedDims().w + ' × ' + getRotatedDims().h + 'px  |  crop: ' + Math.round(cropRect.width) + '×' + Math.round(cropRect.height);
}

// Crop drag
overlay.addEventListener('mousedown', e => {
    if (!cropMode || !currentImage) return;
    const rect = overlay.getBoundingClientRect();
    cropStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    cropRect = null;
});

overlay.addEventListener('mousemove', e => {
    if (!cropMode || !cropStart) return;
    const rect = overlay.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { w, h } = getRotatedDims();

    const x = Math.max(0, Math.min(cropStart.x, mx));
    const y = Math.max(0, Math.min(cropStart.y, my));
    const cw = Math.abs(mx - cropStart.x);
    const ch = Math.abs(my - cropStart.y);

    cropRect = {
        left: x / scale,
        top: y / scale,
        width: Math.min(cw / scale, w - x / scale),
        height: Math.min(ch / scale, h - y / scale)
    };
    drawCropOverlay();
});

overlay.addEventListener('mouseup', () => { cropStart = null; });

// Rotation buttons
document.getElementById('btn-ccw').onclick = () => { rotation = (rotation - 90 + 360) % 360; renderCanvas(); };
document.getElementById('btn-cw').onclick = () => { rotation = (rotation + 90) % 360; renderCanvas(); };
document.getElementById('btn-180').onclick = () => { rotation = (rotation + 180) % 360; renderCanvas(); };

document.getElementById('btn-crop-mode').onclick = () => {
    cropMode = !cropMode;
    document.getElementById('btn-crop-mode').textContent = cropMode ? 'Cancel Draw' : 'Draw Crop';
    overlay.style.cursor = cropMode ? 'crosshair' : 'default';
    overlay.style.pointerEvents = cropMode ? 'auto' : 'none';
};

document.getElementById('btn-crop-clear').onclick = () => {
    cropRect = null;
    cropMode = false;
    document.getElementById('btn-crop-mode').textContent = 'Draw Crop';
    overlay.style.pointerEvents = 'none';
    drawCropOverlay();
};

document.getElementById('btn-reset').onclick = () => {
    rotation = 0;
    cropRect = null;
    cropMode = false;
    document.getElementById('btn-crop-mode').textContent = 'Draw Crop';
    overlay.style.pointerEvents = 'none';
    renderCanvas();
    setStatus('Reset');
};

document.getElementById('btn-save').onclick = async () => {
    if (!currentImage) return;
    const quality = parseInt(document.getElementById('quality-input').value) || 88;
    setStatus('Saving...');
    document.getElementById('btn-save').disabled = true;

    try {
        const res = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imagePath: currentImage.path,
                rotation: rotation,
                crop: cropRect,
                quality
            })
        });
        const data = await res.json();
        if (data.success) {
            setStatus('Saved — ' + data.width + '×' + data.height + 'px', false);
            // Reload image from disk
            rotation = 0;
            cropRect = null;
            cropMode = false;
            document.getElementById('btn-crop-mode').textContent = 'Draw Crop';
            overlay.style.pointerEvents = 'none';
            loadImage(currentImage.path);
        } else {
            setStatus('Error: ' + data.error, true);
        }
    } catch (e) {
        setStatus('Error: ' + e.message, true);
    }
    document.getElementById('btn-save').disabled = false;
};

function enableControls(on) {
    ['btn-ccw','btn-cw','btn-180','btn-crop-mode','btn-crop-clear','btn-reset','btn-save'].forEach(id => {
        document.getElementById(id).disabled = !on;
    });
}

function setStatus(msg, isErr) {
    status.textContent = msg;
    status.className = isErr ? 'err' : (msg ? 'ok' : '');
}

// Resize handler
window.addEventListener('resize', () => { if (currentImage) renderCanvas(); });
</script>
</body>
</html>`);
});

app.listen(PORT, () => {
    console.log('\n  Portfolio Image Editor');
    console.log('  ─────────────────────');
    console.log('  Open: http://localhost:' + PORT);
    console.log('  Ctrl+C to stop\n');
});
