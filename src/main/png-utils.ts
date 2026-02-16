import * as zlib from "zlib";

const ICON_SIZE = 22;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC32_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index++) {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  CRC32_TABLE[index] = crc;
}

export function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index++) {
    crc = CRC32_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildChunk(type: string, data: Buffer): Buffer {
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lengthBuffer, typeBytes, data, crcBuffer]);
}

function setOpaquePixel(pixels: Buffer, x: number, y: number): void {
  if (x < 0 || x >= ICON_SIZE || y < 0 || y >= ICON_SIZE) {
    return;
  }
  const offset = (y * ICON_SIZE + x) * 4;
  pixels[offset + 3] = 255;
}

function createEShapePixels(): Buffer {
  const pixels = Buffer.alloc(ICON_SIZE * ICON_SIZE * 4, 0);
  const horizontalBarRows = [4, 5, 10, 11, 16, 17];
  for (let x = 5; x <= 16; x++) {
    horizontalBarRows.forEach((y) => setOpaquePixel(pixels, x, y));
  }
  for (let y = 4; y <= 17; y++) {
    [5, 6].forEach((x) => setOpaquePixel(pixels, x, y));
  }
  return pixels;
}

function pixelsToScanlines(pixels: Buffer): Buffer {
  const bytesPerRow = 1 + ICON_SIZE * 4;
  const scanlines = Buffer.alloc(ICON_SIZE * bytesPerRow);
  for (let y = 0; y < ICON_SIZE; y++) {
    scanlines[y * bytesPerRow] = 0;
    pixels.copy(scanlines, y * bytesPerRow + 1, y * ICON_SIZE * 4, (y + 1) * ICON_SIZE * 4);
  }
  return scanlines;
}

function createIHDRData(): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(ICON_SIZE, 0);
  data.writeUInt32BE(ICON_SIZE, 4);
  data[8] = 8; // bit depth
  data[9] = 6; // RGBA color type
  return data;
}

export function createFallbackIcon(): Buffer {
  const compressed = zlib.deflateSync(pixelsToScanlines(createEShapePixels()));
  return Buffer.concat([
    PNG_SIGNATURE,
    buildChunk("IHDR", createIHDRData()),
    buildChunk("IDAT", compressed),
    buildChunk("IEND", Buffer.alloc(0)),
  ]);
}
