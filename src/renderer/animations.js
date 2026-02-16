// GSAP-based animation effects for Quick Emoji
// Uses GSAP timelines for precise control and GIF frame extraction

const { gsap } = require("gsap");

const SIZE = 128;
const HALF = SIZE / 2;

// Animation state factory
const createAnimationState = () => ({
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  alpha: 1,
  skewX: 0,
  shadowBlur: 0,
  hue: 0,
  _partyColor: null,
  _waveT: null,
});

// Canvas rendering based on animation state
const renderWithState = (context, animationState, renderFunction, appState) => {
  context.save();

  // Apply alpha
  if (animationState.alpha !== 1) {
    context.globalAlpha = animationState.alpha;
  }

  // Apply shadow for glow effect
  if (animationState.shadowBlur > 0) {
    context.shadowColor = "rgba(255, 200, 0, 0.8)";
    context.shadowBlur = animationState.shadowBlur;
  }

  // Apply party color
  if (animationState.hue > 0) {
    appState._partyColor = `hsl(${Math.floor(animationState.hue)}, 100%, 50%)`;
  }

  // Apply wave effect
  if (animationState._waveT !== null) {
    appState._waveT = animationState._waveT;
  }

  // Apply transforms
  context.translate(HALF + animationState.offsetX, HALF + animationState.offsetY);
  context.rotate(animationState.rotation);
  context.scale(
    animationState.scaleX * animationState.scale,
    animationState.scaleY * animationState.scale
  );

  if (animationState.skewX !== 0) {
    context.transform(1, 0, animationState.skewX, 1, 0, 0);
  }

  context.translate(-HALF, -HALF);

  renderFunction();

  // Cleanup
  appState._partyColor = null;
  appState._waveT = null;

  context.restore();
};

// Timeline creators for each animation
const timelineCreators = {
  shake: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, { offsetX: 8, duration: 0.125, ease: "sine.inOut" })
      .to(state, { offsetX: -8, duration: 0.25, ease: "sine.inOut" })
      .to(state, { offsetX: 8, duration: 0.25, ease: "sine.inOut" })
      .to(state, { offsetX: -8, duration: 0.25, ease: "sine.inOut" })
      .to(state, { offsetX: 0, duration: 0.125, ease: "sine.inOut" });
  },

  bounce: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, { offsetY: -20, duration: 0.25, ease: "sine.out" })
      .to(state, { offsetY: 0, duration: 0.25, ease: "sine.in" })
      .to(state, { offsetY: -20, duration: 0.25, ease: "sine.out" })
      .to(state, { offsetY: 0, duration: 0.25, ease: "sine.in" });
  },

  slide: (state) => {
    return gsap
      .timeline({ paused: true })
      .fromTo(state, { offsetX: -SIZE }, { offsetX: 0, duration: 0.5, ease: "power2.out" })
      .to(state, { offsetX: SIZE, duration: 0.5, ease: "power2.in" });
  },

  float: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, { offsetY: -6, duration: 0.25, ease: "sine.inOut" })
      .to(state, { offsetY: 6, duration: 0.5, ease: "sine.inOut" })
      .to(state, { offsetY: 0, duration: 0.25, ease: "sine.inOut" });
  },

  swing: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, { rotation: 0.25, duration: 0.25, ease: "sine.inOut" })
      .to(state, { rotation: -0.25, duration: 0.5, ease: "sine.inOut" })
      .to(state, { rotation: 0, duration: 0.25, ease: "sine.inOut" });
  },

  jump: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, { offsetY: -30, duration: 0.2, ease: "sine.out" })
      .to(state, { offsetY: 0, duration: 0.2, ease: "sine.in" })
      .to(state, {
        scaleX: 1.1,
        scaleY: 0.95,
        duration: 0.075,
        ease: "power2.out",
      })
      .to(state, { scaleX: 1, scaleY: 1, duration: 0.075, ease: "power2.in" })
      .to(state, { duration: 0.45 }); // Hold
  },

  spin: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, { rotation: Math.PI * 2, duration: 1, ease: "none" });
  },

  flipH: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, { scaleX: -1, duration: 0.25, ease: "sine.inOut" })
      .to(state, { scaleX: 1, duration: 0.25, ease: "sine.inOut" })
      .to(state, { scaleX: -1, duration: 0.25, ease: "sine.inOut" })
      .to(state, { scaleX: 1, duration: 0.25, ease: "sine.inOut" });
  },

  flipV: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, { scaleY: -1, duration: 0.25, ease: "sine.inOut" })
      .to(state, { scaleY: 1, duration: 0.25, ease: "sine.inOut" })
      .to(state, { scaleY: -1, duration: 0.25, ease: "sine.inOut" })
      .to(state, { scaleY: 1, duration: 0.25, ease: "sine.inOut" });
  },

  wobble: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, {
        rotation: 0.15,
        offsetX: 10,
        duration: 0.25,
        ease: "sine.inOut",
      })
      .to(state, {
        rotation: -0.15,
        offsetX: -10,
        duration: 0.5,
        ease: "sine.inOut",
      })
      .to(state, {
        rotation: 0,
        offsetX: 0,
        duration: 0.25,
        ease: "sine.inOut",
      });
  },

  roll: (state) => {
    return gsap
      .timeline({ paused: true })
      .fromTo(
        state,
        { offsetX: -SIZE, rotation: 0 },
        { offsetX: SIZE, rotation: Math.PI * 4, duration: 1, ease: "none" }
      );
  },

  pulse: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, { scale: 1.15, duration: 0.25, ease: "sine.inOut" })
      .to(state, { scale: 0.85, duration: 0.5, ease: "sine.inOut" })
      .to(state, { scale: 1, duration: 0.25, ease: "sine.inOut" });
  },

  zoomIn: (state) => {
    return gsap
      .timeline({ paused: true })
      .fromTo(
        state,
        { scale: 0.3, alpha: 0 },
        { scale: 1, alpha: 1, duration: 1, ease: "power2.out" }
      );
  },

  zoomOut: (state) => {
    return gsap
      .timeline({ paused: true })
      .fromTo(
        state,
        { scale: 1, alpha: 1 },
        { scale: 0.3, alpha: 0, duration: 1, ease: "power2.in" }
      );
  },

  heartbeat: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, { scale: 1.2, duration: 0.15, ease: "power2.out" })
      .to(state, { scale: 1, duration: 0.15, ease: "power2.in" })
      .to(state, { scale: 1.15, duration: 0.15, ease: "power2.out" })
      .to(state, { scale: 1, duration: 0.15, ease: "power2.in" })
      .to(state, { duration: 0.4 }); // Hold
  },

  pop: (state) => {
    return gsap
      .timeline({ paused: true })
      .fromTo(
        state,
        { scale: 0, alpha: 0 },
        { scale: 1.3, alpha: 1, duration: 0.2, ease: "back.out(1.7)" }
      )
      .to(state, { scale: 1, duration: 0.15, ease: "power2.out" })
      .to(state, { duration: 0.65 }); // Hold
  },

  party: (state) => {
    return gsap.timeline({ paused: true }).to(state, { hue: 360, duration: 1, ease: "none" });
  },

  flash: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, { alpha: 1, duration: 0.5, ease: "none" })
      .to(state, { alpha: 0.3, duration: 0.125, ease: "sine.inOut" })
      .to(state, { alpha: 1, duration: 0.125, ease: "sine.inOut" })
      .to(state, { alpha: 0.3, duration: 0.125, ease: "sine.inOut" })
      .to(state, { alpha: 1, duration: 0.125, ease: "sine.inOut" });
  },

  glow: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, { shadowBlur: 16, duration: 0.25, ease: "sine.inOut" })
      .to(state, { shadowBlur: 0, duration: 0.5, ease: "sine.inOut" })
      .to(state, { shadowBlur: 8, duration: 0.25, ease: "sine.inOut" });
  },

  fade: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, { alpha: 0, duration: 0.25, ease: "sine.inOut" })
      .to(state, { alpha: 1, duration: 0.5, ease: "sine.inOut" })
      .to(state, { alpha: 0.5, duration: 0.25, ease: "sine.inOut" });
  },

  jello: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, { skewX: 0.15, duration: 0.125, ease: "sine.out" })
      .to(state, { skewX: -0.12, duration: 0.125, ease: "sine.inOut" })
      .to(state, { skewX: 0.08, duration: 0.125, ease: "sine.inOut" })
      .to(state, { skewX: -0.05, duration: 0.125, ease: "sine.inOut" })
      .to(state, { skewX: 0.02, duration: 0.125, ease: "sine.inOut" })
      .to(state, { skewX: 0, duration: 0.375, ease: "sine.out" });
  },

  rubberBand: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, {
        scaleX: 1.25,
        scaleY: 0.9,
        duration: 0.3,
        ease: "power2.out",
      })
      .to(state, {
        scaleX: 0.9,
        scaleY: 1.05,
        duration: 0.2,
        ease: "power2.inOut",
      })
      .to(state, {
        scaleX: 1.05,
        scaleY: 1,
        duration: 0.2,
        ease: "power2.inOut",
      })
      .to(state, {
        scaleX: 1,
        scaleY: 1,
        duration: 0.3,
        ease: "elastic.out(1, 0.5)",
      });
  },

  tada: (state) => {
    return gsap
      .timeline({ paused: true })
      .to(state, { scale: 0.9, duration: 0.2, ease: "power2.in" })
      .to(state, {
        scale: 1.1,
        rotation: -0.05,
        duration: 0.1,
        ease: "power2.out",
      })
      .to(state, { rotation: 0.05, duration: 0.1, ease: "sine.inOut" })
      .to(state, { rotation: -0.05, duration: 0.1, ease: "sine.inOut" })
      .to(state, { rotation: 0.05, duration: 0.1, ease: "sine.inOut" })
      .to(state, { rotation: -0.05, duration: 0.1, ease: "sine.inOut" })
      .to(state, { rotation: 0.05, duration: 0.1, ease: "sine.inOut" })
      .to(state, { scale: 1, rotation: 0, duration: 0.2, ease: "power2.out" });
  },

  wave: (state) => {
    return gsap.timeline({ paused: true }).to(state, { _waveT: 1, duration: 1, ease: "none" });
  },
};

// Create animation function that uses GSAP timeline
const createAnimation = (animationId) => {
  const createTimeline = timelineCreators[animationId];
  if (!createTimeline) return null;

  return (context, normalizedTime, renderFunction, appState) => {
    const animationState = createAnimationState();

    // Special case for wave animation
    if (animationId === "wave") {
      animationState._waveT = normalizedTime;
    }

    const timeline = createTimeline(animationState);
    timeline.progress(normalizedTime);

    renderWithState(context, animationState, renderFunction, appState);

    timeline.kill();
  };
};

// Build animations object
const animations = {};
Object.keys(timelineCreators).forEach((animationId) => {
  animations[animationId] = createAnimation(animationId);
});

// Metadata for UI display
const animationList = [
  { id: "shake", name: "Shake", category: "move" },
  { id: "bounce", name: "Bounce", category: "move" },
  { id: "slide", name: "Slide", category: "move" },
  { id: "float", name: "Float", category: "move" },
  { id: "swing", name: "Swing", category: "move" },
  { id: "jump", name: "Jump", category: "move" },
  { id: "spin", name: "Spin", category: "rotate" },
  { id: "flipH", name: "Flip H", category: "rotate" },
  { id: "flipV", name: "Flip V", category: "rotate" },
  { id: "wobble", name: "Wobble", category: "rotate" },
  { id: "roll", name: "Roll", category: "rotate" },
  { id: "pulse", name: "Pulse", category: "size" },
  { id: "zoomIn", name: "Zoom In", category: "size" },
  { id: "zoomOut", name: "Zoom Out", category: "size" },
  { id: "heartbeat", name: "Heartbeat", category: "size" },
  { id: "pop", name: "Pop", category: "size" },
  { id: "party", name: "Party", category: "color" },
  { id: "flash", name: "Flash", category: "color" },
  { id: "glow", name: "Glow", category: "color" },
  { id: "fade", name: "Fade", category: "color" },
  { id: "jello", name: "Jello", category: "special" },
  { id: "rubberBand", name: "Rubber", category: "special" },
  { id: "tada", name: "Tada", category: "special" },
  { id: "wave", name: "Wave", category: "special" },
];

module.exports = {
  animations,
  animationList,
  createAnimationState,
  timelineCreators,
};
