import { describe, it, expect } from "vitest";
import { splitText } from "./text-utils";

describe("splitText", () => {
  it("splits multi-line text into an array of non-empty lines", () => {
    expect(splitText("hello\nworld")).toEqual(["hello", "world"]);
  });

  it("returns an empty array for an empty string", () => {
    expect(splitText("")).toEqual([]);
  });

  it("filters out empty lines from consecutive newlines", () => {
    expect(splitText("a\n\n\nb")).toEqual(["a", "b"]);
  });

  it("returns a single-element array for text without newlines", () => {
    expect(splitText("single line")).toEqual(["single line"]);
  });

  it("filters out empty lines when text starts with a newline", () => {
    expect(splitText("\nfirst")).toEqual(["first"]);
  });

  it("filters out empty lines when text ends with a newline", () => {
    expect(splitText("last\n")).toEqual(["last"]);
  });

  it("handles text with only newlines", () => {
    expect(splitText("\n\n\n")).toEqual([]);
  });

  it("preserves spaces within lines", () => {
    expect(splitText("hello world\nfoo bar")).toEqual(["hello world", "foo bar"]);
  });

  it("preserves special characters within lines", () => {
    expect(splitText("🎉\n✨")).toEqual(["🎉", "✨"]);
  });

  it("handles a large number of lines", () => {
    const input = Array.from({ length: 100 }, (_, index) => `line${index}`).join("\n");
    const result = splitText(input);
    expect(result).toHaveLength(100);
    expect(result[0]).toBe("line0");
    expect(result[99]).toBe("line99");
  });
});
