import type { AnimationFunction, AppState, RenderFunction } from "./animations";
import { createGifOptions, CONFIGS, MAX_SIZE } from "./gif-constants";
export type { EncoderConfig } from "./gif-constants";
export { MAX_SIZE, TRANSPARENT_KEY, CONFIGS, createGifOptions } from "./gif-constants";

import GIF from "gif.js";

const baseUrl = new URL(".", window.location.href).href;
const WORKER_SCRIPT = `${baseUrl}node_modules/gif.js/dist/gif.worker.js`;

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
  config: { frames: number; quality: number; delay: number }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const { frames, quality, delay } = config;
    const gif = new GIF(createGifOptions(quality, state, WORKER_SCRIPT));
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
