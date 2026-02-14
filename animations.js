// 24 animation effects for Quick Emoji
// Each effect: (ctx, t, renderFn) => void
//   ctx: CanvasRenderingContext2D (128x128)
//   t: normalized time 0~1 (one loop cycle)
//   renderFn: () => void — draws the text content

const SIZE = 128;
const HALF = SIZE / 2;

const animations = {
  // ── Movement ──
  shake: (ctx, t, renderFn) => {
    ctx.save();
    ctx.translate(Math.sin(t * Math.PI * 4) * 8, 0);
    renderFn();
    ctx.restore();
  },

  bounce: (ctx, t, renderFn) => {
    ctx.save();
    const y = -Math.abs(Math.sin(t * Math.PI * 2)) * 20;
    ctx.translate(0, y);
    renderFn();
    ctx.restore();
  },

  slide: (ctx, t, renderFn) => {
    ctx.save();
    const x = (t < 0.5)
      ? -SIZE + t * 2 * SIZE
      : SIZE - (t - 0.5) * 2 * SIZE;
    ctx.translate(x, 0);
    renderFn();
    ctx.restore();
  },

  float: (ctx, t, renderFn) => {
    ctx.save();
    ctx.translate(0, Math.sin(t * Math.PI * 2) * 6);
    renderFn();
    ctx.restore();
  },

  swing: (ctx, t, renderFn) => {
    ctx.save();
    const angle = Math.sin(t * Math.PI * 2) * 0.25;
    ctx.translate(HALF, 0);
    ctx.rotate(angle);
    ctx.translate(-HALF, 0);
    renderFn();
    ctx.restore();
  },

  jump: (ctx, t, renderFn) => {
    ctx.save();
    let y = 0;
    if (t < 0.4) {
      const p = t / 0.4;
      y = -Math.sin(p * Math.PI) * 30;
    }
    const scaleX = 1 + (t > 0.4 && t < 0.55 ? (1 - Math.abs((t - 0.475) / 0.075)) * 0.1 : 0);
    const scaleY = 1 - (t > 0.4 && t < 0.55 ? (1 - Math.abs((t - 0.475) / 0.075)) * 0.05 : 0);
    ctx.translate(HALF, HALF);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-HALF, -HALF);
    ctx.translate(0, y);
    renderFn();
    ctx.restore();
  },

  // ── Rotation ──
  spin: (ctx, t, renderFn) => {
    ctx.save();
    ctx.translate(HALF, HALF);
    ctx.rotate(t * Math.PI * 2);
    ctx.translate(-HALF, -HALF);
    renderFn();
    ctx.restore();
  },

  flipH: (ctx, t, renderFn) => {
    ctx.save();
    const scaleX = Math.cos(t * Math.PI * 2);
    ctx.translate(HALF, 0);
    ctx.scale(scaleX, 1);
    ctx.translate(-HALF, 0);
    renderFn();
    ctx.restore();
  },

  flipV: (ctx, t, renderFn) => {
    ctx.save();
    const scaleY = Math.cos(t * Math.PI * 2);
    ctx.translate(0, HALF);
    ctx.scale(1, scaleY);
    ctx.translate(0, -HALF);
    renderFn();
    ctx.restore();
  },

  wobble: (ctx, t, renderFn) => {
    ctx.save();
    const angle = Math.sin(t * Math.PI * 2) * 0.15;
    const moveX = Math.sin(t * Math.PI * 2) * 10;
    ctx.translate(HALF, HALF);
    ctx.rotate(angle);
    ctx.translate(-HALF + moveX, -HALF);
    renderFn();
    ctx.restore();
  },

  roll: (ctx, t, renderFn) => {
    ctx.save();
    const x = -SIZE + t * SIZE * 2;
    ctx.translate(HALF + x, HALF);
    ctx.rotate(t * Math.PI * 4);
    ctx.translate(-HALF, -HALF);
    renderFn();
    ctx.restore();
  },

  // ── Size ──
  pulse: (ctx, t, renderFn) => {
    ctx.save();
    const scale = 1 + Math.sin(t * Math.PI * 2) * 0.15;
    ctx.translate(HALF, HALF);
    ctx.scale(scale, scale);
    ctx.translate(-HALF, -HALF);
    renderFn();
    ctx.restore();
  },

  zoomIn: (ctx, t, renderFn) => {
    ctx.save();
    const scale = 0.3 + t * 0.7;
    ctx.globalAlpha = Math.min(1, t * 2);
    ctx.translate(HALF, HALF);
    ctx.scale(scale, scale);
    ctx.translate(-HALF, -HALF);
    renderFn();
    ctx.restore();
  },

  zoomOut: (ctx, t, renderFn) => {
    ctx.save();
    const scale = 1 - t * 0.7;
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.translate(HALF, HALF);
    ctx.scale(scale, scale);
    ctx.translate(-HALF, -HALF);
    renderFn();
    ctx.restore();
  },

  heartbeat: (ctx, t, renderFn) => {
    ctx.save();
    let scale;
    if (t < 0.15) scale = 1 + (t / 0.15) * 0.2;
    else if (t < 0.3) scale = 1.2 - ((t - 0.15) / 0.15) * 0.2;
    else if (t < 0.45) scale = 1 + ((t - 0.3) / 0.15) * 0.15;
    else if (t < 0.6) scale = 1.15 - ((t - 0.45) / 0.15) * 0.15;
    else scale = 1;
    ctx.translate(HALF, HALF);
    ctx.scale(scale, scale);
    ctx.translate(-HALF, -HALF);
    renderFn();
    ctx.restore();
  },

  pop: (ctx, t, renderFn) => {
    ctx.save();
    let scale;
    if (t < 0.2) scale = t / 0.2 * 1.3;
    else if (t < 0.35) scale = 1.3 - ((t - 0.2) / 0.15) * 0.3;
    else scale = 1;
    ctx.globalAlpha = Math.min(1, t * 5);
    ctx.translate(HALF, HALF);
    ctx.scale(scale, scale);
    ctx.translate(-HALF, -HALF);
    renderFn();
    ctx.restore();
  },

  // ── Color ──
  party: (ctx, t, renderFn, state) => {
    const origColor = state.fontColor;
    const hue = Math.floor(t * 360);
    state._partyColor = `hsl(${hue}, 100%, 50%)`;
    renderFn();
    state._partyColor = null;
  },

  flash: (ctx, t, renderFn) => {
    ctx.save();
    ctx.globalAlpha = t < 0.5 ? 1 : (Math.sin((t - 0.5) * Math.PI * 4) + 1) / 2;
    renderFn();
    ctx.restore();
  },

  glow: (ctx, t, renderFn) => {
    ctx.save();
    const blur = Math.sin(t * Math.PI * 2) * 8 + 8;
    ctx.shadowColor = 'rgba(255, 200, 0, 0.8)';
    ctx.shadowBlur = blur;
    renderFn();
    ctx.restore();
  },

  fade: (ctx, t, renderFn) => {
    ctx.save();
    ctx.globalAlpha = (Math.sin(t * Math.PI * 2) + 1) / 2;
    renderFn();
    ctx.restore();
  },

  // ── Special ──
  jello: (ctx, t, renderFn) => {
    ctx.save();
    const skewX = Math.sin(t * Math.PI * 4) * 0.15 * (1 - t);
    ctx.translate(HALF, HALF);
    ctx.transform(1, 0, skewX, 1, 0, 0);
    ctx.translate(-HALF, -HALF);
    renderFn();
    ctx.restore();
  },

  rubberBand: (ctx, t, renderFn) => {
    ctx.save();
    let sx, sy;
    if (t < 0.3) {
      const p = t / 0.3;
      sx = 1 + p * 0.25;
      sy = 1 - p * 0.1;
    } else if (t < 0.5) {
      const p = (t - 0.3) / 0.2;
      sx = 1.25 - p * 0.35;
      sy = 0.9 + p * 0.15;
    } else if (t < 0.7) {
      const p = (t - 0.5) / 0.2;
      sx = 0.9 + p * 0.15;
      sy = 1.05 - p * 0.05;
    } else {
      sx = 1.05 - ((t - 0.7) / 0.3) * 0.05;
      sy = 1;
    }
    ctx.translate(HALF, HALF);
    ctx.scale(sx, sy);
    ctx.translate(-HALF, -HALF);
    renderFn();
    ctx.restore();
  },

  tada: (ctx, t, renderFn) => {
    ctx.save();
    let scale, angle;
    if (t < 0.2) {
      scale = 1 - (t / 0.2) * 0.1;
      angle = 0;
    } else if (t < 0.8) {
      const p = (t - 0.2) / 0.6;
      scale = 0.9 + p * 0.2;
      angle = Math.sin(p * Math.PI * 6) * 0.05;
    } else {
      scale = 1.1 - ((t - 0.8) / 0.2) * 0.1;
      angle = 0;
    }
    ctx.translate(HALF, HALF);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.translate(-HALF, -HALF);
    renderFn();
    ctx.restore();
  },

  wave: (ctx, t, renderFn, state) => {
    state._waveT = t;
    renderFn();
    state._waveT = null;
  },
};

// Metadata for UI display
const animationList = [
  { id: 'shake',      name: 'Shake',       cat: 'move' },
  { id: 'bounce',     name: 'Bounce',      cat: 'move' },
  { id: 'slide',      name: 'Slide',       cat: 'move' },
  { id: 'float',      name: 'Float',       cat: 'move' },
  { id: 'swing',      name: 'Swing',       cat: 'move' },
  { id: 'jump',       name: 'Jump',        cat: 'move' },
  { id: 'spin',       name: 'Spin',        cat: 'rotate' },
  { id: 'flipH',      name: 'Flip H',      cat: 'rotate' },
  { id: 'flipV',      name: 'Flip V',      cat: 'rotate' },
  { id: 'wobble',     name: 'Wobble',      cat: 'rotate' },
  { id: 'roll',       name: 'Roll',        cat: 'rotate' },
  { id: 'pulse',      name: 'Pulse',       cat: 'size' },
  { id: 'zoomIn',     name: 'Zoom In',     cat: 'size' },
  { id: 'zoomOut',    name: 'Zoom Out',    cat: 'size' },
  { id: 'heartbeat',  name: 'Heartbeat',   cat: 'size' },
  { id: 'pop',        name: 'Pop',         cat: 'size' },
  { id: 'party',      name: 'Party',       cat: 'color' },
  { id: 'flash',      name: 'Flash',       cat: 'color' },
  { id: 'glow',       name: 'Glow',        cat: 'color' },
  { id: 'fade',       name: 'Fade',        cat: 'color' },
  { id: 'jello',      name: 'Jello',       cat: 'special' },
  { id: 'rubberBand', name: 'Rubber',      cat: 'special' },
  { id: 'tada',       name: 'Tada',        cat: 'special' },
  { id: 'wave',       name: 'Wave',        cat: 'special' },
];

module.exports = { animations, animationList };
