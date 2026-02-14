const GIF = require('gif.js');
const path = require('path');

const workerPath = path.join(__dirname, 'node_modules', 'gif.js', 'dist', 'gif.worker.js');
const WORKER_SCRIPT = `file://${workerPath}`;
const MAX_SIZE = 128 * 1024; // 128KB Slack limit

const CONFIGS = [
  { frames: 15, quality: 10, delay: 66 },
  { frames: 10, quality: 20, delay: 100 },
  { frames: 8,  quality: 30, delay: 125 },
];

function encodeGIF(canvas, animationFn, renderFn, state, config) {
  return new Promise((resolve, reject) => {
    const { frames, quality, delay } = config;
    const gif = new GIF({
      workers: 2,
      quality,
      width: 128,
      height: 128,
      workerScript: WORKER_SCRIPT,
      repeat: 0,
    });

    const ctx = canvas.getContext('2d');

    for (let i = 0; i < frames; i++) {
      const t = i / frames;
      // Clear canvas
      ctx.clearRect(0, 0, 128, 128);
      // Apply animation and render
      animationFn(ctx, t, renderFn, state);
      gif.addFrame(ctx, { copy: true, delay });
    }

    gif.on('finished', (blob) => resolve(blob));
    gif.on('error', (err) => reject(err));
    gif.render();
  });
}

async function encodeWithSizeLimit(canvas, animationFn, renderFn, state) {
  for (const config of CONFIGS) {
    try {
      const blob = await encodeGIF(canvas, animationFn, renderFn, state, config);
      if (blob.size <= MAX_SIZE) return blob;
    } catch (err) {
      throw err;
    }
  }

  // Final fallback: use smallest config even if over limit
  const blob = await encodeGIF(canvas, animationFn, renderFn, state, CONFIGS[CONFIGS.length - 1]);
  return blob;
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

module.exports = { encodeWithSizeLimit, blobToDataURL, MAX_SIZE };
