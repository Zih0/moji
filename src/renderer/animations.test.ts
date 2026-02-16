import { describe, expect, it } from "vitest";
import { animationList, animations, createAnimationState, timelineCreators } from "./animations";

describe("createAnimationState", () => {
  it("returns an object with all transform values at identity defaults", () => {
    const state = createAnimationState();
    expect(state).toEqual({
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
  });

  it("returns a new object on each call (no shared reference)", () => {
    const stateA = createAnimationState();
    const stateB = createAnimationState();
    expect(stateA).not.toBe(stateB);
  });

  it("allows mutation without affecting other instances", () => {
    const stateA = createAnimationState();
    const stateB = createAnimationState();
    stateA.offsetX = 999;
    expect(stateB.offsetX).toBe(0);
  });
});

describe("animationList", () => {
  it("contains 24 animation entries", () => {
    expect(animationList).toHaveLength(24);
  });

  it("has unique IDs across all entries", () => {
    const ids = animationList.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has non-empty name and category for every entry", () => {
    const allValid = animationList.every(
      (entry) => entry.name.length > 0 && entry.category.length > 0
    );
    expect(allValid).toBe(true);
  });

  it("uses only known categories", () => {
    const knownCategories = new Set(["move", "rotate", "size", "color", "special"]);
    const allKnown = animationList.every((entry) => knownCategories.has(entry.category));
    expect(allKnown).toBe(true);
  });

  it("has a corresponding timelineCreator for every animation ID", () => {
    const missingCreators = animationList.filter((entry) => !(entry.id in timelineCreators));
    expect(missingCreators).toEqual([]);
  });

  it("has a corresponding animations entry for every animation ID", () => {
    const missingAnimations = animationList.filter((entry) => !(entry.id in animations));
    expect(missingAnimations).toEqual([]);
  });

  it("starts with 'shake' as the first move animation", () => {
    expect(animationList[0]).toEqual({ id: "shake", name: "Shake", category: "move" });
  });

  it("ends with 'wave' as the last special animation", () => {
    expect(animationList[animationList.length - 1]).toEqual({
      id: "wave",
      name: "Wave",
      category: "special",
    });
  });
});

describe("timelineCreators", () => {
  it("has exactly the same keys as animationList IDs", () => {
    const listIds = new Set(animationList.map((entry) => entry.id));
    const creatorIds = new Set(Object.keys(timelineCreators));
    expect(creatorIds).toEqual(listIds);
  });

  it("each creator is a function", () => {
    const allFunctions = Object.values(timelineCreators).every(
      (creator) => typeof creator === "function"
    );
    expect(allFunctions).toBe(true);
  });

  it("each creator returns a timeline with a progress method", () => {
    const state = createAnimationState();
    const allHaveProgress = Object.values(timelineCreators).every((creator) => {
      const timeline = creator(state);
      const hasProgress = typeof timeline.progress === "function";
      timeline.kill();
      return hasProgress;
    });
    expect(allHaveProgress).toBe(true);
  });

  it("shake timeline modifies offsetX when progressed to midpoint", () => {
    const state = createAnimationState();
    const timeline = timelineCreators.shake(state);
    timeline.progress(0.3);
    expect(state.offsetX).not.toBe(0);
    timeline.kill();
  });

  it("bounce timeline modifies offsetY when progressed to midpoint", () => {
    const state = createAnimationState();
    const timeline = timelineCreators.bounce(state);
    timeline.progress(0.25);
    expect(state.offsetY).not.toBe(0);
    timeline.kill();
  });

  it("spin timeline sets rotation to full turn at progress 1", () => {
    const state = createAnimationState();
    const timeline = timelineCreators.spin(state);
    timeline.progress(1);
    expect(state.rotation).toBeCloseTo(Math.PI * 2, 5);
    timeline.kill();
  });

  it("pulse timeline increases scale at progress 0.25", () => {
    const state = createAnimationState();
    const timeline = timelineCreators.pulse(state);
    timeline.progress(0.25);
    expect(state.scale).toBeCloseTo(1.15, 2);
    timeline.kill();
  });

  it("party timeline sets hue to 360 at progress 1", () => {
    const state = createAnimationState();
    const timeline = timelineCreators.party(state);
    timeline.progress(1);
    expect(state.hue).toBeCloseTo(360, 5);
    timeline.kill();
  });

  it("fade timeline modifies alpha when progressed to midpoint", () => {
    const state = createAnimationState();
    const timeline = timelineCreators.fade(state);
    timeline.progress(0.25);
    expect(state.alpha).not.toBe(1);
    timeline.kill();
  });

  it("zoomIn timeline starts from scale 0.3 and alpha 0 at progress 0", () => {
    const state = createAnimationState();
    const timeline = timelineCreators.zoomIn(state);
    timeline.progress(0);
    expect(state.scale).toBeCloseTo(0.3, 5);
    expect(state.alpha).toBeCloseTo(0, 5);
    timeline.kill();
  });

  it("zoomIn timeline reaches scale 1 and alpha 1 at progress 1", () => {
    const state = createAnimationState();
    const timeline = timelineCreators.zoomIn(state);
    timeline.progress(1);
    expect(state.scale).toBeCloseTo(1, 5);
    expect(state.alpha).toBeCloseTo(1, 5);
    timeline.kill();
  });

  it("flipH timeline inverts scaleX at progress 0.25", () => {
    const state = createAnimationState();
    const timeline = timelineCreators.flipH(state);
    timeline.progress(0.25);
    expect(state.scaleX).toBeCloseTo(-1, 5);
    timeline.kill();
  });

  it("jello timeline modifies skewX when progressed", () => {
    const state = createAnimationState();
    const timeline = timelineCreators.jello(state);
    timeline.progress(0.1);
    expect(state.skewX).not.toBe(0);
    timeline.kill();
  });

  it("glow timeline modifies shadowBlur when progressed", () => {
    const state = createAnimationState();
    const timeline = timelineCreators.glow(state);
    timeline.progress(0.25);
    expect(state.shadowBlur).not.toBe(0);
    timeline.kill();
  });

  it("wave timeline sets _waveT to 1 at progress 1", () => {
    const state = createAnimationState();
    const timeline = timelineCreators.wave(state);
    timeline.progress(1);
    expect(state._waveT).toBeCloseTo(1, 5);
    timeline.kill();
  });
});

describe("animations", () => {
  it("has the same keys as timelineCreators", () => {
    const animationKeys = new Set(Object.keys(animations));
    const creatorKeys = new Set(Object.keys(timelineCreators));
    expect(animationKeys).toEqual(creatorKeys);
  });

  it("every value is a callable function", () => {
    const allCallable = Object.values(animations).every(
      (animation) => typeof animation === "function"
    );
    expect(allCallable).toBe(true);
  });
});
