import { app, ipcMain, nativeImage, Menu, Tray, BrowserWindow, IpcMainInvokeEvent } from "electron";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { createFallbackIcon } from "./png-utils";

interface SaveImageArgs {
  dataURL: string;
  fileName: string;
}

interface SaveImageResult {
  success: boolean;
  path?: string;
  error?: string;
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
