const { ipcRenderer } = require('electron');

const textInput = document.getElementById('emoji-text');
const bgColorInput = document.getElementById('bg-color');
const fontColorInput = document.getElementById('font-color');
const fontSelect = document.getElementById('font-select');
const canvas = document.getElementById('preview-canvas');
const downloadBtn = document.getElementById('download-btn');
const statusEl = document.getElementById('status');

canvas.width = 128;
canvas.height = 128;

const state = {
  text: '',
  bgColor: '#ffffff',
  fontColor: '#000000',
  fontFamily: '-apple-system, sans-serif',
};

// 3글자 단위 자동 줄바꿈
function splitText(text) {
  const chars = [...text]; // multi-byte safe (한글, 이모지 등)
  if (chars.length <= 3) return [text];
  const lines = [];
  for (let i = 0; i < chars.length; i += 3) {
    lines.push(chars.slice(i, i + 3).join(''));
  }
  return lines;
}

// 캔버스에 맞는 최대 폰트 크기 계산
function calcFontSize(ctx, lines) {
  const pad = 8;
  const maxW = 128 - pad * 2;
  const maxH = 128 - pad * 2;
  let fontSize = 64;

  while (fontSize > 8) {
    ctx.font = `bold ${fontSize}px ${state.fontFamily}`;
    const lineHeight = fontSize * 1.15;
    const totalH = lines.length * lineHeight;

    if (totalH > maxH) { fontSize--; continue; }

    let fits = true;
    for (const line of lines) {
      if (ctx.measureText(line).width > maxW) { fits = false; break; }
    }
    if (fits) break;
    fontSize--;
  }

  return fontSize;
}

function updateCanvas() {
  state.text = textInput.value.trim();
  state.bgColor = bgColorInput.value;
  state.fontColor = fontColorInput.value;
  state.fontFamily = fontSelect.value;

  if (!state.text) {
    canvas.classList.remove('visible');
    downloadBtn.classList.remove('visible');
    return;
  }

  const ctx = canvas.getContext('2d');
  const lines = splitText(state.text);

  // 배경 채우기
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, 128, 128);

  // 폰트 크기 자동 조절
  const fontSize = calcFontSize(ctx, lines);
  const lineHeight = fontSize * 1.15;

  // 세로 중앙 정렬
  const startY = 64 - (lines.length - 1) * lineHeight / 2;

  ctx.font = `bold ${fontSize}px ${state.fontFamily}`;
  ctx.fillStyle = state.fontColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 64, startY + i * lineHeight);
  }

  canvas.classList.add('visible');
  downloadBtn.classList.add('visible');
  statusEl.textContent = '';
  statusEl.className = '';
}

async function download() {
  const dataURL = canvas.toDataURL('image/png');
  const fileName = `emoji_${Date.now()}.png`;

  try {
    const result = await ipcRenderer.invoke('save-image', { dataURL, fileName });
    if (result.success) {
      statusEl.textContent = 'Saved to Desktop!';
      statusEl.className = 'success';
      setTimeout(() => { statusEl.textContent = ''; statusEl.className = ''; }, 2000);
    } else {
      statusEl.textContent = result.error || 'Save failed';
      statusEl.className = 'error';
    }
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = 'error';
  }
}

// 실시간 반응형 이벤트 바인딩
textInput.addEventListener('input', updateCanvas);
bgColorInput.addEventListener('input', updateCanvas);
fontColorInput.addEventListener('input', updateCanvas);
fontSelect.addEventListener('change', updateCanvas);
downloadBtn.addEventListener('click', download);

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && canvas.classList.contains('visible')) download();
});
