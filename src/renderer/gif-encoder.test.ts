import { describe, expect, it } from "vitest";
import type { AppState } from "./animations";
import { CONFIGS, createGifOptions, MAX_SIZE, TRANSPARENT_KEY } from "./gif-constants";

describe("MAX_SIZE", () => {
  it("equals 128KB (Slack emoji upload limit)", () => {
    expect(MAX_SIZE).toBe(128 * 1024);
  });

  it("equals 131072 bytes", () => {
    expect(MAX_SIZE).toBe(131072);
  });
});

describe("TRANSPARENT_KEY", () => {
  it("equals bright green (0x00FF00) for chroma keying", () => {
    expect(TRANSPARENT_KEY).toBe(0x00ff00);
  });

  it("is a positive integer", () => {
    expect(Number.isInteger(TRANSPARENT_KEY)).toBe(true);
    expect(TRANSPARENT_KEY).toBeGreaterThan(0);
  });
});

describe("CONFIGS", () => {
  it("contains exactly 3 fallback configurations", () => {
    expect(CONFIGS).toHaveLength(3);
  });

  it("each config has positive frames, quality, and delay", () => {
    const allPositive = CONFIGS.every(
      (config) => config.frames > 0 && config.quality > 0 && config.delay > 0
    );
    expect(allPositive).toBe(true);
  });

  it("configs are ordered from highest to lowest frame count", () => {
    const frameCounts = CONFIGS.map((config) => config.frames);
    const isSorted = frameCounts.every(
      (count, index) => index === 0 || frameCounts[index - 1] >= count
    );
    expect(isSorted).toBe(true);
  });

  it("configs are ordered from lowest to highest quality value (lower = better)", () => {
    const qualities = CONFIGS.map((config) => config.quality);
    const isSorted = qualities.every(
      (quality, index) => index === 0 || qualities[index - 1] <= quality
    );
    expect(isSorted).toBe(true);
  });

  it("first config has the best quality settings", () => {
    expect(CONFIGS[0]).toEqual({ frames: 15, quality: 10, delay: 66 });
  });

  it("last config has the smallest/fastest settings", () => {
    expect(CONFIGS[2]).toEqual({ frames: 8, quality: 30, delay: 125 });
  });

  it("frame count times delay approximates ~1000ms for each config", () => {
    const allApproximateOneSecond = CONFIGS.every((config) => {
      const totalDuration = config.frames * config.delay;
      return totalDuration >= 900 && totalDuration <= 1100;
    });
    expect(allApproximateOneSecond).toBe(true);
  });
});

describe("createGifOptions", () => {
  it("returns base options without transparent key when bgTransparent is false", () => {
    const state: AppState = { _partyColor: null, _waveT: null, bgTransparent: false };
    const options = createGifOptions(10, state, "/fake/worker.js");
    expect(options.quality).toBe(10);
    expect(options.width).toBe(128);
    expect(options.height).toBe(128);
    expect(options.workers).toBe(2);
    expect(options.repeat).toBe(0);
    expect("transparent" in options).toBe(false);
  });

  it("includes transparent key when bgTransparent is true", () => {
    const state: AppState = { _partyColor: null, _waveT: null, bgTransparent: true };
    const options = createGifOptions(10, state, "/fake/worker.js");
    expect((options as Record<string, unknown>).transparent).toBe(TRANSPARENT_KEY);
  });

  it("uses the provided quality value", () => {
    const state: AppState = { _partyColor: null, _waveT: null, bgTransparent: false };
    expect(createGifOptions(20, state, "/fake/worker.js").quality).toBe(20);
  });

  it("always sets repeat to 0 (infinite loop)", () => {
    const state: AppState = { _partyColor: null, _waveT: null, bgTransparent: false };
    expect(createGifOptions(10, state, "/fake/worker.js").repeat).toBe(0);
  });

  it("always sets dimensions to 128x128", () => {
    const state: AppState = { _partyColor: null, _waveT: null, bgTransparent: false };
    const options = createGifOptions(10, state, "/fake/worker.js");
    expect(options.width).toBe(128);
    expect(options.height).toBe(128);
  });

  it("passes workerScript through to options", () => {
    const state: AppState = { _partyColor: null, _waveT: null, bgTransparent: false };
    const options = createGifOptions(10, state, "/my/worker.js");
    expect(options.workerScript).toBe("/my/worker.js");
  });
});
