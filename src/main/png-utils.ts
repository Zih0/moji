import * as zlib from "zlib";

export function crc32(buffer: Buffer): number {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let crc = index;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[index] = crc;
  }
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index++) {
    crc = table[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
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

export function createFallbackIcon(): Buffer {
  const width = 22;
  const height = 22;
  const pixels = Buffer.alloc(width * height * 4, 0);

  const setPixel = (x: number, y: number): void => {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const index = (y * width + x) * 4;
      pixels[index] = 0;
      pixels[index + 1] = 0;
      pixels[index + 2] = 0;
      pixels[index + 3] = 255;
    }
  };

  // E shape: top bar, middle bar, bottom bar, left vertical
  for (let x = 5; x <= 16; x++) {
    for (let thickness = 0; thickness < 2; thickness++) {
      setPixel(x, 4 + thickness);
      setPixel(x, 10 + thickness);
      setPixel(x, 16 + thickness);
    }
  }
  for (let y = 4; y <= 17; y++) {
    setPixel(5, y);
    setPixel(6, y);
  }

  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    pixels.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdr = buildChunk("IHDR", ihdrData);
  const idat = buildChunk("IDAT", compressed);
  const iend = buildChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}
