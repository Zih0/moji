import { describe, it, expect } from "vitest";
import { crc32, buildChunk, createFallbackIcon } from "./png-utils";

describe("crc32", () => {
  it("returns 0 for an empty buffer", () => {
    expect(crc32(Buffer.alloc(0))).toBe(0x00000000);
  });

  it("computes known CRC32 for ASCII 'IEND'", () => {
    // CRC32 of "IEND" is a well-known constant in PNG: 0xAE426082
    expect(crc32(Buffer.from("IEND", "ascii"))).toBe(0xae426082);
  });

  it("computes known CRC32 for ASCII '123456789'", () => {
    // Standard CRC32 check value for "123456789"
    expect(crc32(Buffer.from("123456789", "ascii"))).toBe(0xcbf43926);
  });

  it("produces different values for different inputs", () => {
    const crcHello = crc32(Buffer.from("hello"));
    const crcWorld = crc32(Buffer.from("world"));
    expect(crcHello).not.toBe(crcWorld);
  });

  it("produces consistent output for the same input", () => {
    const firstCall = crc32(Buffer.from("consistency check"));
    const secondCall = crc32(Buffer.from("consistency check"));
    expect(firstCall).toBe(secondCall);
  });

  it("returns a 32-bit unsigned integer", () => {
    const result = crc32(Buffer.from("any data"));
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("buildChunk", () => {
  it("encodes length as big-endian 4 bytes at the start", () => {
    const chunk = buildChunk("TEST", Buffer.from([0xaa, 0xbb]));
    // length = 2 => [0, 0, 0, 2]
    expect(chunk[0]).toBe(0);
    expect(chunk[1]).toBe(0);
    expect(chunk[2]).toBe(0);
    expect(chunk[3]).toBe(2);
  });

  it("places chunk type bytes at offset 4", () => {
    const chunk = buildChunk("IHDR", Buffer.alloc(0));
    const typeString = chunk.subarray(4, 8).toString("ascii");
    expect(typeString).toBe("IHDR");
  });

  it("places data bytes after the type", () => {
    const data = Buffer.from([0x01, 0x02, 0x03]);
    const chunk = buildChunk("TEST", data);
    expect(chunk[8]).toBe(0x01);
    expect(chunk[9]).toBe(0x02);
    expect(chunk[10]).toBe(0x03);
  });

  it("appends a 4-byte CRC at the end", () => {
    const chunk = buildChunk("IEND", Buffer.alloc(0));
    // Total: 4 (length) + 4 (type) + 0 (data) + 4 (crc) = 12
    expect(chunk.length).toBe(12);
  });

  it("has total length of 12 + data.length", () => {
    const data = Buffer.from([0xff, 0xfe, 0xfd, 0xfc, 0xfb]);
    const chunk = buildChunk("TEST", data);
    // 4 (length) + 4 (type) + 5 (data) + 4 (crc) = 17
    expect(chunk.length).toBe(17);
  });

  it("computes CRC over type + data", () => {
    const data = Buffer.from([0x00]);
    const chunk = buildChunk("ABCD", data);
    const expectedCrcInput = Buffer.concat([Buffer.from("ABCD", "ascii"), data]);
    const expectedCrc = crc32(expectedCrcInput);
    const actualCrc = chunk.readUInt32BE(chunk.length - 4);
    expect(actualCrc).toBe(expectedCrc);
  });

  it("encodes empty IEND chunk matching known PNG IEND", () => {
    const chunk = buildChunk("IEND", Buffer.alloc(0));
    // Known PNG IEND chunk: length=0, type=IEND, CRC=0xAE426082
    expect(chunk.readUInt32BE(0)).toBe(0);
    expect(chunk.subarray(4, 8).toString("ascii")).toBe("IEND");
    expect(chunk.readUInt32BE(8)).toBe(0xae426082);
  });
});

describe("createFallbackIcon", () => {
  it("starts with the PNG signature bytes", () => {
    const png = createFallbackIcon();
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    expect([...png.subarray(0, 8)]).toEqual(signature);
  });

  it("contains an IHDR chunk specifying 22x22 RGBA", () => {
    const png = createFallbackIcon();
    // IHDR starts at offset 8 (after signature)
    // 4 bytes length + 4 bytes type
    const ihdrType = png.subarray(12, 16).toString("ascii");
    expect(ihdrType).toBe("IHDR");

    const ihdrData = png.subarray(16, 29);
    const width = ihdrData.readUInt32BE(0);
    const height = ihdrData.readUInt32BE(4);
    const bitDepth = ihdrData[8];
    const colorType = ihdrData[9];
    expect(width).toBe(22);
    expect(height).toBe(22);
    expect(bitDepth).toBe(8);
    expect(colorType).toBe(6); // RGBA
  });

  it("contains IDAT and IEND chunks", () => {
    const png = createFallbackIcon();
    const pngString = png.toString("ascii");
    expect(pngString).toContain("IDAT");
    expect(pngString).toContain("IEND");
  });

  it("ends with the IEND chunk", () => {
    const png = createFallbackIcon();
    // IEND chunk: 4 bytes length (0) + "IEND" + 4 bytes CRC
    const iendType = png.subarray(png.length - 8, png.length - 4).toString("ascii");
    expect(iendType).toBe("IEND");
  });

  it("produces a buffer of reasonable size for a 22x22 icon", () => {
    const png = createFallbackIcon();
    // Minimum PNG = 8 (sig) + 25 (IHDR) + ~20 (IDAT) + 12 (IEND)
    expect(png.length).toBeGreaterThan(60);
    // Should be well under 10KB for a tiny 22x22 icon
    expect(png.length).toBeLessThan(10_000);
  });

  it("produces identical output on repeated calls", () => {
    const firstCall = createFallbackIcon();
    const secondCall = createFallbackIcon();
    expect(firstCall.equals(secondCall)).toBe(true);
  });
});
