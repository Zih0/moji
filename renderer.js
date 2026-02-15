const { ipcRenderer } = require('electron');
const { animations, animationList } = require('./animations');
const { encodeWithSizeLimit, blobToDataURL, MAX_SIZE, TRANSPARENT_KEY } = require('./gif-encoder');

const textInput = document.getElementById('emoji-text');
const bgColorInput = document.getElementById('bg-color');
const bgTransparentInput = document.getElementById('bg-transparent');
const fontColorInput = document.getElementById('font-color');
const fontSelect = document.getElementById('font-select');
const canvas = document.getElementById('preview-canvas');
const downloadBtn = document.getElementById('download-btn');
const statusEl = document.getElementById('status');
const animGrid = document.getElementById('anim-grid');

canvas.width = 128;
canvas.height = 128;

const state = {
  text: '',
  bgColor: '#ffffff',
  bgTransparent: false,
  fontColor: '#000000',
  fontFamily: '-apple-system, sans-serif',
  selectedAnim: null,
  _partyColor: null,
  _waveT: null,
  _targetCanvas: null, // allows renderTextOn to target any canvas
  _useChromaKey: false, // when true, fill transparent bg with chroma key color for GIF encoding
};

let animFrameId = null;
let isEncoding = false;

// ── Animation grid UI ──

function buildAnimGrid() {
  const noneBtn = document.createElement('button');
  noneBtn.className = 'anim-btn selected';
  noneBtn.textContent = 'None';
  noneBtn.dataset.animId = '';
  noneBtn.addEventListener('click', () => selectAnimation(null, noneBtn));
  animGrid.appendChild(noneBtn);

  for (const anim of animationList) {
    const btn = document.createElement('button');
    btn.className = 'anim-btn';
    btn.textContent = anim.name;
    btn.dataset.animId = anim.id;
    btn.addEventListener('click', () => selectAnimation(anim.id, btn));
    animGrid.appendChild(btn);
  }
}

function selectAnimation(animId, btnEl) {
  state.selectedAnim = animId;
  animGrid.querySelectorAll('.anim-btn').forEach(b => b.classList.remove('selected'));
  btnEl.classList.add('selected');
  downloadBtn.textContent = animId ? 'Download GIF' : 'Download PNG';
  updatePreview();
}

// ── Text rendering ──

function splitText(text) {
  return text.split('\n').filter(line => line.length > 0);
}

function calcFontSize(ctx, lines) {
  const pad = 8;
  const maxW = 128 - pad * 2;
  const maxH = 128 - pad * 2;
  let fontSize = 64;

  while (fontSize > 8) {
    ctx.font = `bold ${fontSize}px ${state.fontFamily}`;
    const lineHeight = fontSize * 1.15;
    if (lines.length * lineHeight > maxH) { fontSize--; continue; }

    let fits = true;
    for (const line of lines) {
      if (ctx.measureText(line).width > maxW) { fits = false; break; }
    }
    if (fits) break;
    fontSize--;
  }
  return fontSize;
}

// Renders text content onto whichever canvas is set as target (or preview canvas)
function renderTextContent() {
  const targetCanvas = state._targetCanvas || canvas;
  const ctx = targetCanvas.getContext('2d');
  const lines = splitText(state.text);
  if (!lines.length) return;

  // Draw background with identity transform so it always covers the full canvas.
  // Animation transforms (translate/rotate/scale) must not shift the background.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (state.bgTransparent) {
    if (state._useChromaKey) {
      // GIF has no alpha channel. Fill with a chroma key color that the GIF
      // encoder will treat as transparent. Using clearRect would produce
      // rgba(0,0,0,0) which maps to black in GIF — colliding with dark text.
      const hex = '#' + TRANSPARENT_KEY.toString(16).padStart(6, '0');
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, 128, 128);
    } else {
      ctx.clearRect(0, 0, 128, 128);
    }
  } else {
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, 128, 128);
  }
  ctx.restore();

  const fontSize = calcFontSize(ctx, lines);
  const lineHeight = fontSize * 1.15;
  const startY = 64 - (lines.length - 1) * lineHeight / 2;

  ctx.font = `bold ${fontSize}px ${state.fontFamily}`;
  ctx.fillStyle = state._partyColor || state.fontColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (state._waveT !== null) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const y = startY + i * lineHeight;
      const totalWidth = ctx.measureText(line).width;
      let x = 64 - totalWidth / 2;
      for (let c = 0; c < line.length; c++) {
        const charW = ctx.measureText(line[c]).width;
        const waveOffset = Math.sin((state._waveT * Math.PI * 2) + c * 0.5) * 6;
        ctx.fillText(line[c], x + charW / 2, y + waveOffset);
        x += charW;
      }
    }
  } else {
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 64, startY + i * lineHeight);
    }
  }
}

// ── Preview logic ──

function updatePreview() {
  state.text = textInput.value.trim();
  state.bgColor = bgColorInput.value;
  state.bgTransparent = bgTransparentInput.checked;
  state.fontColor = fontColorInput.value;
  state.fontFamily = fontSelect.value;

  bgColorInput.disabled = state.bgTransparent;
  canvas.classList.toggle('transparent-bg', state.bgTransparent);

  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  if (!state.text) {
    canvas.classList.remove('visible');
    downloadBtn.classList.remove('visible');
    return;
  }

  canvas.classList.add('visible');
  downloadBtn.classList.add('visible');
  statusEl.textContent = '';
  statusEl.className = '';

  if (state.selectedAnim && animations[state.selectedAnim]) {
    startAnimationLoop();
  } else {
    state._targetCanvas = null;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    renderTextContent();
  }
}

function startAnimationLoop() {
  const loopDuration = 1000;
  const startTime = performance.now();
  const animFn = animations[state.selectedAnim];

  state._targetCanvas = null; // preview uses main canvas

  function frame() {
    const elapsed = performance.now() - startTime;
    const t = (elapsed % loopDuration) / loopDuration;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    animFn(ctx, t, renderTextContent, state);

    animFrameId = requestAnimationFrame(frame);
  }

  animFrameId = requestAnimationFrame(frame);
}

// ── Download ──

async function download() {
  if (isEncoding) return;

  if (!state.selectedAnim) {
    state._targetCanvas = null;
    const dataURL = canvas.toDataURL('image/png');
    const fileName = `emoji_${Date.now()}.png`;
    await saveFile(dataURL, fileName);
    return;
  }

  isEncoding = true;
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Encoding...';
  statusEl.textContent = '';
  statusEl.className = '';

  try {
    const animFn = animations[state.selectedAnim];
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 128;
    offCanvas.height = 128;

    // Point renderTextContent at the offscreen canvas during encoding
    state._targetCanvas = offCanvas;
    state._useChromaKey = true;

    const blob = await encodeWithSizeLimit(offCanvas, animFn, renderTextContent, state);
    const dataURL = await blobToDataURL(blob);
    const fileName = `emoji_${Date.now()}.gif`;

    const sizeKB = (blob.size / 1024).toFixed(1);
    if (blob.size > MAX_SIZE) {
      statusEl.textContent = `Warning: ${sizeKB}KB (Slack limit: 128KB)`;
      statusEl.className = 'error';
    }

    await saveFile(dataURL, fileName);

    if (blob.size <= MAX_SIZE) {
      statusEl.textContent = `Saved! (${sizeKB}KB)`;
      statusEl.className = 'success';
      setTimeout(() => { statusEl.textContent = ''; statusEl.className = ''; }, 3000);
    }
  } catch (err) {
    statusEl.textContent = err.message || 'Encoding failed';
    statusEl.className = 'error';
  } finally {
    state._targetCanvas = null;
    state._useChromaKey = false;
    isEncoding = false;
    downloadBtn.disabled = false;
    downloadBtn.textContent = state.selectedAnim ? 'Download GIF' : 'Download PNG';
  }
}

async function saveFile(dataURL, fileName) {
  try {
    const result = await ipcRenderer.invoke('save-image', { dataURL, fileName });
    if (result.success) {
      if (!statusEl.textContent) {
        statusEl.textContent = 'Saved to Desktop!';
        statusEl.className = 'success';
        setTimeout(() => { statusEl.textContent = ''; statusEl.className = ''; }, 2000);
      }
    } else {
      statusEl.textContent = result.error || 'Save failed';
      statusEl.className = 'error';
    }
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = 'error';
  }
}

// ── System fonts ──

async function loadSystemFonts() {
  const fonts = await ipcRenderer.invoke('get-system-fonts');
  for (const family of fonts) {
    const option = document.createElement('option');
    option.value = `"${family}"`;
    option.textContent = family;
    fontSelect.appendChild(option);
  }
}

// ── Init ──

buildAnimGrid();
loadSystemFonts();

textInput.addEventListener('input', updatePreview);
bgColorInput.addEventListener('input', updatePreview);
bgTransparentInput.addEventListener('change', updatePreview);
fontColorInput.addEventListener('input', updatePreview);
fontSelect.addEventListener('change', updatePreview);
downloadBtn.addEventListener('click', download);

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.metaKey && canvas.classList.contains('visible')) download();
});
