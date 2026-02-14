const { app, ipcMain, nativeImage } = require('electron');
const { menubar } = require('menubar');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const iconPath = path.join(__dirname, 'assets', 'iconTemplate.png');

const mb = menubar({
  index: `file://${path.join(__dirname, 'index.html')}`,
  icon: iconPath,
  showDockIcon: false,
  preloadWindow: true,
  browserWindow: {
    width: 320,
    height: 380,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  },
});

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createFallbackIcon() {
  const w = 22;
  const h = 22;
  const pixels = Buffer.alloc(w * h * 4, 0);

  // Draw a simple "E" letter shape in black on transparent background
  const set = (x, y) => {
    if (x >= 0 && x < w && y >= 0 && y < h) {
      const idx = (y * w + x) * 4;
      pixels[idx] = 0;       // R
      pixels[idx + 1] = 0;   // G
      pixels[idx + 2] = 0;   // B
      pixels[idx + 3] = 255; // A
    }
  };

  // E shape: top bar, middle bar, bottom bar, left vertical
  for (let x = 5; x <= 16; x++) {
    for (let t = 0; t < 2; t++) {
      set(x, 4 + t);   // top bar
      set(x, 10 + t);  // middle bar
      set(x, 16 + t);  // bottom bar
    }
  }
  for (let y = 4; y <= 17; y++) {
    set(5, y);
    set(6, y);
  }

  // Build raw scanlines with filter byte 0 (None) per row
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter: None
    pixels.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }

  const compressed = zlib.deflateSync(raw);

  // Build PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = buildChunk('IHDR', ihdrData);

  // IDAT chunk
  const idat = buildChunk('IDAT', compressed);

  // IEND chunk
  const iend = buildChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function buildChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBytes, data, crc]);
}

mb.on('ready', () => {
  if (!fs.existsSync(iconPath)) {
    const pngBuffer = createFallbackIcon();
    const img = nativeImage.createFromBuffer(pngBuffer, { scaleFactor: 1.0 });
    mb.tray.setImage(img);
  }
});

ipcMain.handle('save-image', async (_event, { dataURL, fileName }) => {
  try {
    const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const desktopPath = app.getPath('desktop');
    const filePath = path.join(desktopPath, fileName);
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
