import { app, ipcMain, nativeImage, Menu, Tray, BrowserWindow, IpcMainInvokeEvent } from "electron";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as zlib from "zlib";

interface SaveImageArgs {
  dataURL: string;
  fileName: string;
}

interface SaveImageResult {
  success: boolean;
  path?: string;
  error?: string;
}

function crc32(buffer: Buffer): number {
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

function buildChunk(type: string, data: Buffer): Buffer {
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lengthBuffer, typeBytes, data, crcBuffer]);
}

function createFallbackIcon(): Buffer {
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

function registerIpcHandlers(): void {
  ipcMain.handle("get-system-fonts", async (): Promise<string[]> => {
    try {
      const output = execSync(
        `osascript -l JavaScript -e 'ObjC.import("AppKit"); var mgr = $.NSFontManager.sharedFontManager; var families = mgr.availableFontFamilies; var result = []; for (var i = 0; i < families.count; i++) result.push(families.objectAtIndex(i).js); result.sort().join("\\n")'`
      )
        .toString()
        .trim();
      return output.split("\n").filter(Boolean);
    } catch {
      return [];
    }
  });

  ipcMain.handle(
    "save-image",
    async (
      _event: IpcMainInvokeEvent,
      { dataURL, fileName }: SaveImageArgs
    ): Promise<SaveImageResult> => {
      try {
        const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const desktopPath = app.getPath("desktop");
        const filePath = path.join(desktopPath, fileName);
        fs.writeFileSync(filePath, buffer);
        return { success: true, path: filePath };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    }
  );
}

function createTrayIcon(iconPath: string): Tray {
  if (fs.existsSync(iconPath)) {
    return new Tray(iconPath);
  }
  const pngBuffer = createFallbackIcon();
  const image = nativeImage.createFromBuffer(pngBuffer, { scaleFactor: 1.0 });
  return new Tray(image);
}

function createWindow(rootDirectory: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 400,
    height: 520,
    show: false,
    frame: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.loadURL(`file://${path.join(rootDirectory, "index.html")}`);
  window.on("blur", () => window.hide());
  return window;
}

function positionWindowBelowTray(window: BrowserWindow, tray: Tray): void {
  const trayBounds = tray.getBounds();
  const windowBounds = window.getBounds();
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height);
  window.setPosition(x, y);
}

function initializeTray(): void {
  const rootDirectory = path.join(__dirname, "..", "..");
  const iconPath = path.join(rootDirectory, "assets", "iconTemplate.png");

  const tray = createTrayIcon(iconPath);
  const window = createWindow(rootDirectory);

  tray.on("click", () => {
    if (window.isVisible()) {
      window.hide();
    } else {
      positionWindowBelowTray(window, tray);
      window.show();
    }
  });

  const contextMenu = Menu.buildFromTemplate([{ label: "Exit", click: () => app.quit() }]);
  tray.on("right-click", () => tray.popUpContextMenu(contextMenu));

  app.dock?.hide();
}

function initialize(): void {
  registerIpcHandlers();
  initializeTray();
}

app.whenReady().then(initialize);
