const GIF = require('gif.js/dist/gif.js');
const path = require('path');

const workerPath = path.join(__dirname, '..', '..', 'node_modules', 'gif.js', 'dist', 'gif.worker.js');
const WORKER_SCRIPT = `file://${workerPath}`;
const MAX_SIZE = 128 * 1024; // 128KB Slack limit
// Chroma key color for GIF transparency. GIF has no alpha channel, so we fill
// "transparent" areas with this color and tell the encoder to treat it as transparent.
// Using bright green (classic green-screen) to avoid colliding with typical text colors.
const TRANSPARENT_KEY = 0x00FF00;

const CONFIGS = [
  { frames: 15, quality: 10, delay: 66 },
  { frames: 10, quality: 20, delay: 100 },
  { frames: 8,  quality: 30, delay: 125 },
];

function createGifOptions(quality, state) {
  const options = {
    workers: 2,
    quality,
    width: 128,
    height: 128,
    workerScript: WORKER_SCRIPT,
    repeat: 0,
  };
  if (state.bgTransparent) {
    options.transparent = TRANSPARENT_KEY;
  }
  return options;
}

function addFrames(gif, canvas, animationFunction, renderFunction, state, frameCount, delay) {
  const context = canvas.getContext('2d');
  Array.from({ length: frameCount }, (_, index) => index / frameCount).forEach((normalizedTime) => {
    context.clearRect(0, 0, 128, 128);
    animationFunction(context, normalizedTime, renderFunction, state);
    gif.addFrame(context, { copy: true, delay });
  });
}

function encodeGIF(canvas, animationFunction, renderFunction, state, config) {
  return new Promise((resolve, reject) => {
    const { frames, quality, delay } = config;
    const gif = new GIF(createGifOptions(quality, state));
    addFrames(gif, canvas, animationFunction, renderFunction, state, frames, delay);
    gif.on('finished', resolve);
    gif.on('error', reject);
    gif.render();
  });
}

async function encodeWithSizeLimit(canvas, animationFunction, renderFunction, state) {
  for (const config of CONFIGS) {
    const blob = await encodeGIF(canvas, animationFunction, renderFunction, state, config);
    if (blob.size <= MAX_SIZE) return blob;
  }
  // Final fallback: use smallest config even if over limit
  return encodeGIF(canvas, animationFunction, renderFunction, state, CONFIGS[CONFIGS.length - 1]);
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

module.exports = { encodeWithSizeLimit, blobToDataURL, MAX_SIZE, TRANSPARENT_KEY };
