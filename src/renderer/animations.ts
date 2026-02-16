import { gsap } from "gsap";

const CANVAS_SIZE = 128;
const CANVAS_CENTER = CANVAS_SIZE / 2;

export interface AnimationState {
  offsetX: number;
  offsetY: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
  skewX: number;
  shadowBlur: number;
  hue: number;
  _partyColor: string | null;
  _waveTime: number | null;
}

export interface AppState {
  _partyColor: string | null;
  _waveTime: number | null;
  backgroundTransparent: boolean;
}

export interface AnimationMetadata {
  id: string;
  name: string;
  category: string;
}

export type RenderFunction = () => void;

export type AnimationFunction = (
  context: CanvasRenderingContext2D,
  normalizedTime: number,
  renderFunction: RenderFunction,
  appState: AppState
) => void;

type TimelineCreator = (state: AnimationState) => gsap.core.Timeline;

export const createAnimationState = (): AnimationState => ({
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
  _waveTime: null,
});

const applyEffects = (
  context: CanvasRenderingContext2D,
  animationState: AnimationState,
  appState: AppState
): void => {
  if (animationState.alpha !== 1) {
    context.globalAlpha = animationState.alpha;
  }
  if (animationState.shadowBlur > 0) {
    context.shadowColor = "rgba(255, 200, 0, 0.8)";
    context.shadowBlur = animationState.shadowBlur;
  }
  if (animationState.hue > 0) {
    appState._partyColor = `hsl(${Math.floor(animationState.hue)}, 100%, 50%)`;
  }
  if (animationState._waveTime !== null) {
    appState._waveTime = animationState._waveTime;
  }
};

const applyTransforms = (
  context: CanvasRenderingContext2D,
  animationState: AnimationState
): void => {
  context.translate(CANVAS_CENTER + animationState.offsetX, CANVAS_CENTER + animationState.offsetY);
  context.rotate(animationState.rotation);
  context.scale(
    animationState.scaleX * animationState.scale,
    animationState.scaleY * animationState.scale
  );
  if (animationState.skewX !== 0) {
    context.transform(1, 0, animationState.skewX, 1, 0, 0);
  }
  context.translate(-CANVAS_CENTER, -CANVAS_CENTER);
};

const renderWithState = (
  context: CanvasRenderingContext2D,
  animationState: AnimationState,
  renderFunction: RenderFunction,
  appState: AppState
): void => {
  context.save();
  applyEffects(context, animationState, appState);
  applyTransforms(context, animationState);
  renderFunction();
  appState._partyColor = null;
  appState._waveTime = null;
  context.restore();
};

export const timelineCreators: Record<string, TimelineCreator> = {
  shake: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { offsetX: 8, duration: 0.125, ease: "sine.inOut" })
      .to(state, { offsetX: -8, duration: 0.25, ease: "sine.inOut" })
      .to(state, { offsetX: 8, duration: 0.25, ease: "sine.inOut" })
      .to(state, { offsetX: -8, duration: 0.25, ease: "sine.inOut" })
      .to(state, { offsetX: 0, duration: 0.125, ease: "sine.inOut" }),

  bounce: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { offsetY: -20, duration: 0.25, ease: "sine.out" })
      .to(state, { offsetY: 0, duration: 0.25, ease: "sine.in" })
      .to(state, { offsetY: -20, duration: 0.25, ease: "sine.out" })
      .to(state, { offsetY: 0, duration: 0.25, ease: "sine.in" }),

  slide: (state) =>
    gsap
      .timeline({ paused: true })
      .fromTo(state, { offsetX: -CANVAS_SIZE }, { offsetX: 0, duration: 0.5, ease: "power2.out" })
      .to(state, { offsetX: CANVAS_SIZE, duration: 0.5, ease: "power2.in" }),

  float: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { offsetY: -6, duration: 0.25, ease: "sine.inOut" })
      .to(state, { offsetY: 6, duration: 0.5, ease: "sine.inOut" })
      .to(state, { offsetY: 0, duration: 0.25, ease: "sine.inOut" }),

  swing: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { rotation: 0.25, duration: 0.25, ease: "sine.inOut" })
      .to(state, { rotation: -0.25, duration: 0.5, ease: "sine.inOut" })
      .to(state, { rotation: 0, duration: 0.25, ease: "sine.inOut" }),

  jump: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { offsetY: -30, duration: 0.2, ease: "sine.out" })
      .to(state, { offsetY: 0, duration: 0.2, ease: "sine.in" })
      .to(state, { scaleX: 1.1, scaleY: 0.95, duration: 0.075, ease: "power2.out" })
      .to(state, { scaleX: 1, scaleY: 1, duration: 0.075, ease: "power2.in" })
      .to(state, { duration: 0.45 }),

  spin: (state) =>
    gsap.timeline({ paused: true }).to(state, { rotation: Math.PI * 2, duration: 1, ease: "none" }),

  flipH: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { scaleX: -1, duration: 0.25, ease: "sine.inOut" })
      .to(state, { scaleX: 1, duration: 0.25, ease: "sine.inOut" })
      .to(state, { scaleX: -1, duration: 0.25, ease: "sine.inOut" })
      .to(state, { scaleX: 1, duration: 0.25, ease: "sine.inOut" }),

  flipV: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { scaleY: -1, duration: 0.25, ease: "sine.inOut" })
      .to(state, { scaleY: 1, duration: 0.25, ease: "sine.inOut" })
      .to(state, { scaleY: -1, duration: 0.25, ease: "sine.inOut" })
      .to(state, { scaleY: 1, duration: 0.25, ease: "sine.inOut" }),

  wobble: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { rotation: 0.15, offsetX: 10, duration: 0.25, ease: "sine.inOut" })
      .to(state, { rotation: -0.15, offsetX: -10, duration: 0.5, ease: "sine.inOut" })
      .to(state, { rotation: 0, offsetX: 0, duration: 0.25, ease: "sine.inOut" }),

  roll: (state) =>
    gsap
      .timeline({ paused: true })
      .fromTo(
        state,
        { offsetX: -CANVAS_SIZE, rotation: 0 },
        { offsetX: CANVAS_SIZE, rotation: Math.PI * 4, duration: 1, ease: "none" }
      ),

  pulse: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { scale: 1.15, duration: 0.25, ease: "sine.inOut" })
      .to(state, { scale: 0.85, duration: 0.5, ease: "sine.inOut" })
      .to(state, { scale: 1, duration: 0.25, ease: "sine.inOut" }),

  zoomIn: (state) =>
    gsap
      .timeline({ paused: true })
      .fromTo(
        state,
        { scale: 0.3, alpha: 0 },
        { scale: 1, alpha: 1, duration: 1, ease: "power2.out" }
      ),

  zoomOut: (state) =>
    gsap
      .timeline({ paused: true })
      .fromTo(
        state,
        { scale: 1, alpha: 1 },
        { scale: 0.3, alpha: 0, duration: 1, ease: "power2.in" }
      ),

  heartbeat: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { scale: 1.2, duration: 0.15, ease: "power2.out" })
      .to(state, { scale: 1, duration: 0.15, ease: "power2.in" })
      .to(state, { scale: 1.15, duration: 0.15, ease: "power2.out" })
      .to(state, { scale: 1, duration: 0.15, ease: "power2.in" })
      .to(state, { duration: 0.4 }),

  pop: (state) =>
    gsap
      .timeline({ paused: true })
      .fromTo(
        state,
        { scale: 0, alpha: 0 },
        { scale: 1.3, alpha: 1, duration: 0.2, ease: "back.out(1.7)" }
      )
      .to(state, { scale: 1, duration: 0.15, ease: "power2.out" })
      .to(state, { duration: 0.65 }),

  party: (state) =>
    gsap.timeline({ paused: true }).to(state, { hue: 360, duration: 1, ease: "none" }),

  flash: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { alpha: 1, duration: 0.5, ease: "none" })
      .to(state, { alpha: 0.3, duration: 0.125, ease: "sine.inOut" })
      .to(state, { alpha: 1, duration: 0.125, ease: "sine.inOut" })
      .to(state, { alpha: 0.3, duration: 0.125, ease: "sine.inOut" })
      .to(state, { alpha: 1, duration: 0.125, ease: "sine.inOut" }),

  glow: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { shadowBlur: 16, duration: 0.25, ease: "sine.inOut" })
      .to(state, { shadowBlur: 0, duration: 0.5, ease: "sine.inOut" })
      .to(state, { shadowBlur: 8, duration: 0.25, ease: "sine.inOut" }),

  fade: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { alpha: 0, duration: 0.25, ease: "sine.inOut" })
      .to(state, { alpha: 1, duration: 0.5, ease: "sine.inOut" })
      .to(state, { alpha: 0.5, duration: 0.25, ease: "sine.inOut" }),

  jello: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { skewX: 0.15, duration: 0.125, ease: "sine.out" })
      .to(state, { skewX: -0.12, duration: 0.125, ease: "sine.inOut" })
      .to(state, { skewX: 0.08, duration: 0.125, ease: "sine.inOut" })
      .to(state, { skewX: -0.05, duration: 0.125, ease: "sine.inOut" })
      .to(state, { skewX: 0.02, duration: 0.125, ease: "sine.inOut" })
      .to(state, { skewX: 0, duration: 0.375, ease: "sine.out" }),

  rubberBand: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { scaleX: 1.25, scaleY: 0.9, duration: 0.3, ease: "power2.out" })
      .to(state, { scaleX: 0.9, scaleY: 1.05, duration: 0.2, ease: "power2.inOut" })
      .to(state, { scaleX: 1.05, scaleY: 1, duration: 0.2, ease: "power2.inOut" })
      .to(state, { scaleX: 1, scaleY: 1, duration: 0.3, ease: "elastic.out(1, 0.5)" }),

  tada: (state) =>
    gsap
      .timeline({ paused: true })
      .to(state, { scale: 0.9, duration: 0.2, ease: "power2.in" })
      .to(state, { scale: 1.1, rotation: -0.05, duration: 0.1, ease: "power2.out" })
      .to(state, { rotation: 0.05, duration: 0.1, ease: "sine.inOut" })
      .to(state, { rotation: -0.05, duration: 0.1, ease: "sine.inOut" })
      .to(state, { rotation: 0.05, duration: 0.1, ease: "sine.inOut" })
      .to(state, { rotation: -0.05, duration: 0.1, ease: "sine.inOut" })
      .to(state, { rotation: 0.05, duration: 0.1, ease: "sine.inOut" })
      .to(state, { scale: 1, rotation: 0, duration: 0.2, ease: "power2.out" }),

  wave: (state) =>
    gsap.timeline({ paused: true }).to(state, { _waveTime: 1, duration: 1, ease: "none" }),
};

const createAnimation = (animationId: string): AnimationFunction | null => {
  const createTimeline = timelineCreators[animationId];
  if (!createTimeline) {
    return null;
  }
  return (context, normalizedTime, renderFunction, appState) => {
    const animationState = createAnimationState();
    if (animationId === "wave") {
      animationState._waveTime = normalizedTime;
    }
    const timeline = createTimeline(animationState);
    timeline.progress(normalizedTime);
    renderWithState(context, animationState, renderFunction, appState);
    timeline.kill();
  };
};

export const animations: Record<string, AnimationFunction> = Object.fromEntries(
  Object.keys(timelineCreators)
    .map((animationId) => [animationId, createAnimation(animationId)])
    .filter((entry): entry is [string, AnimationFunction] => entry[1] !== null)
);

export const animationList: AnimationMetadata[] = [
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
