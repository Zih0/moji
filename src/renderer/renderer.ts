import { ipcRenderer } from "electron";
import { animations, animationList, AnimationFunction, AppState } from "./animations";
import { encodeWithSizeLimit, blobToDataURL, MAX_SIZE, TRANSPARENT_KEY } from "./gif-encoder";

// ── DOM References ──

interface DOMReferences {
  textInput: HTMLTextAreaElement;
  bgColorInput: HTMLInputElement;
  bgTransparentInput: HTMLInputElement;
  fontColorInput: HTMLInputElement;
  fontSelect: HTMLSelectElement;
  canvas: HTMLCanvasElement;
  downloadBtn: HTMLButtonElement;
  statusEl: HTMLElement;
  animGrid: HTMLElement;
}

const getElement = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Element not found: ${id}`);
  }
  return element as T;
};

const dom: DOMReferences = {
  textInput: getElement<HTMLTextAreaElement>("emoji-text"),
  bgColorInput: getElement<HTMLInputElement>("bg-color"),
  bgTransparentInput: getElement<HTMLInputElement>("bg-transparent"),
  fontColorInput: getElement<HTMLInputElement>("font-color"),
  fontSelect: getElement<HTMLSelectElement>("font-select"),
  canvas: getElement<HTMLCanvasElement>("preview-canvas"),
  downloadBtn: getElement<HTMLButtonElement>("download-btn"),
  statusEl: getElement<HTMLElement>("status"),
  animGrid: getElement<HTMLElement>("anim-grid"),
};

dom.canvas.width = 128;
dom.canvas.height = 128;

// ── Application State ──

interface ApplicationState extends AppState {
  text: string;
  bgColor: string;
  fontColor: string;
  fontFamily: string;
  selectedAnim: string | null;
  _targetCanvas: HTMLCanvasElement | null;
  _useChromaKey: boolean;
}

const state: ApplicationState = {
  text: "",
  bgColor: "#ffffff",
  bgTransparent: false,
  fontColor: "#000000",
  fontFamily: "-apple-system, sans-serif",
  selectedAnim: null,
  _partyColor: null,
  _waveT: null,
  _targetCanvas: null,
  _useChromaKey: false,
};

let animationFrameId: number | null = null;
let isEncoding = false;

// ── Animation Grid UI ──

const createAnimButton = (
  animation: { id: string; name: string },
  onSelect: (id: string, button: HTMLButtonElement) => void
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "anim-btn";
  button.textContent = animation.name;
  button.dataset.animId = animation.id;
  button.addEventListener("click", () => onSelect(animation.id, button));
  return button;
};

const createNoneButton = (
  onSelect: (id: string | null, button: HTMLButtonElement) => void
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "anim-btn selected";
  button.textContent = "None";
  button.dataset.animId = "";
  button.addEventListener("click", () => onSelect(null, button));
  return button;
};

const buildAnimGrid = (): void => {
  dom.animGrid.appendChild(createNoneButton(selectAnimation));
  animationList.forEach((animation) =>
    dom.animGrid.appendChild(createAnimButton(animation, selectAnimation))
  );
};

const selectAnimation = (animationId: string | null, buttonElement: HTMLButtonElement): void => {
  state.selectedAnim = animationId;
  dom.animGrid
    .querySelectorAll(".anim-btn")
    .forEach((button) => button.classList.remove("selected"));
  buttonElement.classList.add("selected");
  dom.downloadBtn.textContent = animationId ? "Download GIF" : "Download PNG";
  updatePreview();
};

// ── Text Utilities ──

const splitText = (text: string): string[] => text.split("\n").filter((line) => line.length > 0);

const measureLinesFit = (
  context: CanvasRenderingContext2D,
  lines: string[],
  maxWidth: number,
  maxHeight: number,
  fontSize: number
): boolean => {
  context.font = `bold ${fontSize}px ${state.fontFamily}`;
  const lineHeight = fontSize * 1.15;
  if (lines.length * lineHeight > maxHeight) {
    return false;
  }
  return lines.every((line) => context.measureText(line).width <= maxWidth);
};

const calcFontSize = (context: CanvasRenderingContext2D, lines: string[]): number => {
  const padding = 8;
  const maxWidth = 128 - padding * 2;
  const maxHeight = 128 - padding * 2;

  for (let fontSize = 64; fontSize > 8; fontSize--) {
    if (measureLinesFit(context, lines, maxWidth, maxHeight, fontSize)) {
      return fontSize;
    }
  }
  return 8;
};

// ── Background Rendering ──

const getChromaKeyColor = (): string => "#" + TRANSPARENT_KEY.toString(16).padStart(6, "0");

const renderBackground = (context: CanvasRenderingContext2D): void => {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);

  if (state.bgTransparent) {
    const chromaKey = getChromaKeyColor();
    context.fillStyle = state._useChromaKey ? chromaKey : "transparent";
    if (state._useChromaKey) {
      context.fillRect(0, 0, 128, 128);
    } else {
      context.clearRect(0, 0, 128, 128);
    }
  } else {
    context.fillStyle = state.bgColor;
    context.fillRect(0, 0, 128, 128);
  }

  context.restore();
};

// ── Text Rendering ──

const renderWaveChar = (
  context: CanvasRenderingContext2D,
  char: string,
  positionX: number,
  positionY: number,
  charIndex: number
): number => {
  const charWidth = context.measureText(char).width;
  const waveOffset = Math.sin((state._waveT ?? 0) * Math.PI * 2 + charIndex * 0.5) * 6;
  context.fillText(char, positionX + charWidth / 2, positionY + waveOffset);
  return charWidth;
};

const renderWaveLine = (
  context: CanvasRenderingContext2D,
  line: string,
  positionY: number
): void => {
  const totalWidth = context.measureText(line).width;
  let currentX = 64 - totalWidth / 2;
  for (let charIndex = 0; charIndex < line.length; charIndex++) {
    currentX += renderWaveChar(context, line[charIndex], currentX, positionY, charIndex);
  }
};

const renderStaticLine = (
  context: CanvasRenderingContext2D,
  line: string,
  positionY: number
): void => {
  context.fillText(line, 64, positionY);
};

const renderLines = (
  context: CanvasRenderingContext2D,
  lines: string[],
  startY: number,
  fontSize: number
): void => {
  const lineHeight = fontSize * 1.15;
  const renderLine = state._waveT !== null ? renderWaveLine : renderStaticLine;
  lines.forEach((line, index) => renderLine(context, line, startY + index * lineHeight));
};

const setupTextStyle = (context: CanvasRenderingContext2D, fontSize: number): void => {
  context.font = `bold ${fontSize}px ${state.fontFamily}`;
  context.fillStyle = state._partyColor || state.fontColor;
  context.textAlign = "center";
  context.textBaseline = "middle";
};

const renderTextContent = (): void => {
  const targetCanvas = state._targetCanvas || dom.canvas;
  const context = targetCanvas.getContext("2d");
  if (!context) {
    throw new Error("Could not get 2d context");
  }
  const lines = splitText(state.text);
  if (!lines.length) {
    return;
  }

  renderBackground(context);

  const fontSize = calcFontSize(context, lines);
  const lineHeight = fontSize * 1.15;
  const startY = 64 - ((lines.length - 1) * lineHeight) / 2;

  setupTextStyle(context, fontSize);
  renderLines(context, lines, startY, fontSize);
};

// ── Preview Logic ──

const syncStateFromInputs = (): void => {
  state.text = dom.textInput.value.trim();
  state.bgColor = dom.bgColorInput.value;
  state.bgTransparent = dom.bgTransparentInput.checked;
  state.fontColor = dom.fontColorInput.value;
  state.fontFamily = dom.fontSelect.value;
};

const updateUIState = (): void => {
  dom.bgColorInput.disabled = state.bgTransparent;
  dom.canvas.classList.toggle("transparent-bg", state.bgTransparent);
};

const stopAnimation = (): void => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

const showPreviewUI = (): void => {
  dom.canvas.classList.add("visible");
  dom.downloadBtn.classList.add("visible");
  dom.statusEl.textContent = "";
  dom.statusEl.className = "";
};

const hidePreviewUI = (): void => {
  dom.canvas.classList.remove("visible");
  dom.downloadBtn.classList.remove("visible");
};

const renderStaticPreview = (): void => {
  state._targetCanvas = null;
  const context = dom.canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not get 2d context");
  }
  context.clearRect(0, 0, 128, 128);
  renderTextContent();
};

const updatePreview = (): void => {
  syncStateFromInputs();
  updateUIState();
  stopAnimation();

  if (!state.text) {
    hidePreviewUI();
    return;
  }

  showPreviewUI();

  if (state.selectedAnim && animations[state.selectedAnim]) {
    startAnimationLoop();
  } else {
    renderStaticPreview();
  }
};

// ── Animation Loop ──

const createAnimationFrame =
  (animationFunction: AnimationFunction, startTime: number) => (): void => {
    const elapsed = performance.now() - startTime;
    const normalizedTime = (elapsed % 1000) / 1000;

    const context = dom.canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not get 2d context");
    }
    context.clearRect(0, 0, 128, 128);
    animationFunction(context, normalizedTime, renderTextContent, state);

    animationFrameId = requestAnimationFrame(createAnimationFrame(animationFunction, startTime));
  };

const startAnimationLoop = (): void => {
  state._targetCanvas = null;
  if (!state.selectedAnim) {
    return;
  }
  const animationFunction = animations[state.selectedAnim];
  if (!animationFunction) {
    return;
  }
  animationFrameId = requestAnimationFrame(
    createAnimationFrame(animationFunction, performance.now())
  );
};

// ── Download ──

const downloadPNG = async (): Promise<void> => {
  state._targetCanvas = null;
  const dataURL = dom.canvas.toDataURL("image/png");
  const fileName = `emoji_${Date.now()}.png`;
  await saveFile(dataURL, fileName);
};

const createOffscreenCanvas = (): HTMLCanvasElement => {
  const offCanvas = document.createElement("canvas");
  offCanvas.width = 128;
  offCanvas.height = 128;
  return offCanvas;
};

const setEncodingUI = (encoding: boolean): void => {
  isEncoding = encoding;
  dom.downloadBtn.disabled = encoding;
  const downloadText = state.selectedAnim ? "Download GIF" : "Download PNG";
  dom.downloadBtn.textContent = encoding ? "Encoding..." : downloadText;
  if (encoding) {
    dom.statusEl.textContent = "";
    dom.statusEl.className = "";
  }
};

const showSizeWarning = (sizeKB: string): void => {
  dom.statusEl.textContent = `Warning: ${sizeKB}KB (Slack limit: 128KB)`;
  dom.statusEl.className = "error";
};

const clearStatus = (): void => {
  dom.statusEl.textContent = "";
  dom.statusEl.className = "";
};

const showSizeSuccess = (sizeKB: string): void => {
  dom.statusEl.textContent = `Saved! (${sizeKB}KB)`;
  dom.statusEl.className = "success";
  setTimeout(clearStatus, 3000);
};

const handleEncodingResult = (blob: Blob): void => {
  const sizeKB = (blob.size / 1024).toFixed(1);
  if (blob.size > MAX_SIZE) {
    showSizeWarning(sizeKB);
  } else {
    showSizeSuccess(sizeKB);
  }
};

const showEncodingError = (error: unknown): void => {
  dom.statusEl.textContent = error instanceof Error ? error.message : "Encoding failed";
  dom.statusEl.className = "error";
};

const downloadGIF = async (): Promise<void> => {
  if (!state.selectedAnim) {
    return;
  }
  const animationFunction = animations[state.selectedAnim];
  if (!animationFunction) {
    return;
  }
  const offCanvas = createOffscreenCanvas();

  state._targetCanvas = offCanvas;
  state._useChromaKey = true;

  try {
    const blob = await encodeWithSizeLimit(offCanvas, animationFunction, renderTextContent, state);
    const dataURL = await blobToDataURL(blob);
    const fileName = `emoji_${Date.now()}.gif`;

    if (blob.size > MAX_SIZE) {
      handleEncodingResult(blob);
    }

    await saveFile(dataURL, fileName);

    if (blob.size <= MAX_SIZE) {
      handleEncodingResult(blob);
    }
  } catch (error) {
    showEncodingError(error);
  } finally {
    state._targetCanvas = null;
    state._useChromaKey = false;
  }
};

const download = async (): Promise<void> => {
  if (isEncoding) {
    return;
  }

  if (!state.selectedAnim) {
    await downloadPNG();
    return;
  }

  setEncodingUI(true);
  try {
    await downloadGIF();
  } finally {
    setEncodingUI(false);
  }
};

// ── File Saving ──

const showSaveSuccess = (): void => {
  if (!dom.statusEl.textContent) {
    dom.statusEl.textContent = "Saved to Desktop!";
    dom.statusEl.className = "success";
    setTimeout(clearStatus, 2000);
  }
};

const showSaveError = (error: string): void => {
  dom.statusEl.textContent = error;
  dom.statusEl.className = "error";
};

interface SaveResult {
  success: boolean;
  error?: string;
}

const saveFile = async (dataURL: string, fileName: string): Promise<void> => {
  try {
    const result = (await ipcRenderer.invoke("save-image", {
      dataURL,
      fileName,
    })) as SaveResult;
    if (result.success) {
      showSaveSuccess();
    } else {
      showSaveError(result?.error ?? "Save failed");
    }
  } catch (error) {
    showSaveError(error instanceof Error ? error.message : "Save failed");
  }
};

// ── System Fonts ──

const createFontOption = (family: string): HTMLOptionElement => {
  const option = document.createElement("option");
  option.value = `"${family}"`;
  option.textContent = family;
  return option;
};

const loadSystemFonts = async (): Promise<void> => {
  const fonts = (await ipcRenderer.invoke("get-system-fonts")) as string[];
  fonts.forEach((family) => dom.fontSelect.appendChild(createFontOption(family)));
};

// ── Event Handlers ──

const handleMetaEnterDownload = (event: KeyboardEvent): void => {
  if (event.key === "Enter" && event.metaKey && dom.canvas.classList.contains("visible")) {
    download();
  }
};

const attachEventListeners = (): void => {
  dom.textInput.addEventListener("input", updatePreview);
  dom.bgColorInput.addEventListener("input", updatePreview);
  dom.bgTransparentInput.addEventListener("change", updatePreview);
  dom.fontColorInput.addEventListener("input", updatePreview);
  dom.fontSelect.addEventListener("change", updatePreview);
  dom.downloadBtn.addEventListener("click", download);
  dom.textInput.addEventListener("keydown", handleMetaEnterDownload);
};

// ── Initialization ──

buildAnimGrid();
loadSystemFonts();
attachEventListeners();
