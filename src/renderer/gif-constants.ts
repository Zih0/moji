import type { AppState } from "./animations";

export interface EncoderConfig {
  frames: number;
  quality: number;
  delay: number;
}

export const MAX_SIZE = 128 * 1024; // 128KB Slack limit

// Chroma key color for GIF transparency. GIF has no alpha channel, so we fill
// "transparent" areas with this color and tell the encoder to treat it as transparent.
// Using bright green (classic green-screen) to avoid colliding with typical text colors.
export const TRANSPARENT_KEY = 0x00ff00;

export const CONFIGS: EncoderConfig[] = [
  { frames: 15, quality: 10, delay: 66 },
  { frames: 10, quality: 20, delay: 100 },
  { frames: 8, quality: 30, delay: 125 },
];

export function createGifOptions(quality: number, state: AppState, workerScript: string) {
  return {
    workers: 2,
    quality,
    width: 128,
    height: 128,
    workerScript,
    repeat: 0,
    // @types/gif.js types `transparent` as string, but gif.js actually accepts a numeric color value
    ...(state.bgTransparent && { transparent: TRANSPARENT_KEY as never }),
  };
}
