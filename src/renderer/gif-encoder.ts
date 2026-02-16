import type { AnimationFunction, AppState, RenderFunction } from "./animations";

import GIF from "gif.js";

interface EncoderConfig {
  frames: number;
  quality: number;
  delay: number;
}

const baseUrl = new URL(".", window.location.href).href;
const WORKER_SCRIPT = `${baseUrl}node_modules/gif.js/dist/gif.worker.js`;
export const MAX_SIZE = 128 * 1024; // 128KB Slack limit
// Chroma key color for GIF transparency. GIF has no alpha channel, so we fill
// "transparent" areas with this color and tell the encoder to treat it as transparent.
// Using bright green (classic green-screen) to avoid colliding with typical text colors.
export const TRANSPARENT_KEY = 0x00ff00;

const CONFIGS: EncoderConfig[] = [
  { frames: 15, quality: 10, delay: 66 },
  { frames: 10, quality: 20, delay: 100 },
  { frames: 8, quality: 30, delay: 125 },
];

function createGifOptions(quality: number, state: AppState) {
  return {
    workers: 2,
    quality,
    width: 128,
    height: 128,
    workerScript: WORKER_SCRIPT,
    repeat: 0,
    // @types/gif.js types `transparent` as string, but gif.js actually accepts a numeric color value
    ...(state.bgTransparent && { transparent: TRANSPARENT_KEY as never }),
  };
}

function addFrames(
  gif: GIF,
  canvas: HTMLCanvasElement,
  animationFunction: AnimationFunction,
  renderFunction: RenderFunction,
  state: AppState,
  frameCount: number,
  delay: number
): void {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not get 2d context from canvas");
  }
  Array.from({ length: frameCount }, (_, index) => index / frameCount).forEach((normalizedTime) => {
    context.clearRect(0, 0, 128, 128);
    animationFunction(context, normalizedTime, renderFunction, state);
    gif.addFrame(context, { copy: true, delay });
  });
}

function encodeGIF(
  canvas: HTMLCanvasElement,
  animationFunction: AnimationFunction,
  renderFunction: RenderFunction,
  state: AppState,
  config: EncoderConfig
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const { frames, quality, delay } = config;
    const gif = new GIF(createGifOptions(quality, state));
    addFrames(gif, canvas, animationFunction, renderFunction, state, frames, delay);
    gif.on("finished", (blob) => resolve(blob));
    gif.on("abort", () => reject(new Error("GIF encoding aborted")));
    gif.render();
  });
}

export async function encodeWithSizeLimit(
  canvas: HTMLCanvasElement,
  animationFunction: AnimationFunction,
  renderFunction: RenderFunction,
  state: AppState
): Promise<Blob> {
  for (const config of CONFIGS) {
    const blob = await encodeGIF(canvas, animationFunction, renderFunction, state, config);
    if (blob.size <= MAX_SIZE) {
      return blob;
    }
  }
  // Final fallback: use smallest config even if over limit
  return encodeGIF(canvas, animationFunction, renderFunction, state, CONFIGS[CONFIGS.length - 1]);
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("FileReader result is not a string"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
