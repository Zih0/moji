const { ipcRenderer } = require('electron');

const textInput = document.getElementById('emoji-text');
const generateBtn = document.getElementById('generate-btn');
const canvas = document.getElementById('preview-canvas');
const downloadBtn = document.getElementById('download-btn');
const status = document.getElementById('status');

canvas.width = 128;
canvas.height = 128;

function generate() {
  const text = textInput.value.trim();
  if (!text) return;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);

  let fontSize = 64;
  while (fontSize > 10) {
    ctx.font = `bold ${fontSize}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    if (ctx.measureText(text).width <= 110) break;
    fontSize--;
  }

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 64);

  canvas.classList.add('visible');
  downloadBtn.classList.add('visible');
  status.textContent = '';
}

async function download() {
  const dataURL = canvas.toDataURL('image/png');
  let sanitized = textInput.value.trim()
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!sanitized) sanitized = 'emoji';
  const fileName = `emoji_${sanitized}.png`;

  try {
    const result = await ipcRenderer.invoke('save-image', { dataURL, fileName });
    if (result.success) {
      status.textContent = 'Saved to Desktop!';
      status.className = 'success';
      setTimeout(() => { status.textContent = ''; status.className = ''; }, 2000);
    } else {
      status.textContent = result.error || 'Save failed';
      status.className = 'error';
    }
  } catch (err) {
    status.textContent = err.message;
    status.className = 'error';
  }
}

generateBtn.addEventListener('click', generate);
downloadBtn.addEventListener('click', download);
textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') generate();
});
