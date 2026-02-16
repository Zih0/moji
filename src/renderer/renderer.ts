import { animations, animationList, AnimationFunction, AppState } from "./animations";
import { encodeWithSizeLimit, blobToDataURL, MAX_SIZE, TRANSPARENT_KEY } from "./gif-encoder";
import { splitText, measureLinesFit } from "./text-utils";

// ── Constants ──

const CANVAS_SIZE = 128;
const CANVAS_CENTER = CANVAS_SIZE / 2;
const CANVAS_PADDING = 8;
const LINE_HEIGHT_RATIO = 1.15;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 64;
const ANIMATION_CYCLE_MS = 1000;

// ── DOM References ──

interface DOMReferences {
  textInput: HTMLTextAreaElement;
  backgroundColorInput: HTMLInputElement;
  backgroundTransparentInput: HTMLInputElement;
  fontColorInput: HTMLInputElement;
  fontSelect: HTMLSelectElement;
  canvas: HTMLCanvasElement;
  downloadButton: HTMLButtonElement;
  statusElement: HTMLElement;
  animationGrid: HTMLElement;
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
  backgroundColorInput: getElement<HTMLInputElement>("bg-color"),
  backgroundTransparentInput: getElement<HTMLInputElement>("bg-transparent"),
  fontColorInput: getElement<HTMLInputElement>("font-color"),
  fontSelect: getElement<HTMLSelectElement>("font-select"),
  canvas: getElement<HTMLCanvasElement>("preview-canvas"),
  downloadButton: getElement<HTMLButtonElement>("download-btn"),
  statusElement: getElement<HTMLElement>("status"),
  animationGrid: getElement<HTMLElement>("anim-grid"),
};

dom.canvas.width = CANVAS_SIZE;
dom.canvas.height = CANVAS_SIZE;

// ── Application State ──

interface ApplicationState extends AppState {
  text: string;
  backgroundColor: string;
  fontColor: string;
  fontFamily: string;
  selectedAnimation: string | null;
  _targetCanvas: HTMLCanvasElement | null;
  _useChromaKey: boolean;
}

const state: ApplicationState = {
  text: "",
  backgroundColor: "#ffffff",
  backgroundTransparent: false,
  fontColor: "#000000",
  fontFamily: "-apple-system, sans-serif",
  selectedAnimation: null,
  _partyColor: null,
  _waveTime: null,
  _targetCanvas: null,
  _useChromaKey: false,
};

let animationFrameId: number | null = null;
let isEncoding = false;

// ── Animation Grid UI ──

const createAnimationButton = (
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

const buildAnimationGrid = (): void => {
  dom.animationGrid.appendChild(createNoneButton(selectAnimation));
  animationList.forEach((animation) =>
    dom.animationGrid.appendChild(createAnimationButton(animation, selectAnimation))
  );
};

const selectAnimation = (animationId: string | null, buttonElement: HTMLButtonElement): void => {
  state.selectedAnimation = animationId;
  dom.animationGrid
    .querySelectorAll(".anim-btn")
    .forEach((button) => button.classList.remove("selected"));
  buttonElement.classList.add("selected");
  dom.downloadButton.textContent = animationId ? "Download GIF" : "Download PNG";
  updatePreview();
};

// ── Text Utilities ──

const calculateFontSize = (context: CanvasRenderingContext2D, lines: string[]): number => {
  const maxWidth = CANVAS_SIZE - CANVAS_PADDING * 2;
  const maxHeight = CANVAS_SIZE - CANVAS_PADDING * 2;
  for (let fontSize = MAX_FONT_SIZE; fontSize > MIN_FONT_SIZE; fontSize--) {
    if (measureLinesFit(context, lines, maxWidth, maxHeight, fontSize, state.fontFamily)) {
      return fontSize;
    }
  }
  return MIN_FONT_SIZE;
};

// ── Background Rendering ──

const getChromaKeyColor = (): string => "#" + TRANSPARENT_KEY.toString(16).padStart(6, "0");

const renderBackground = (context: CanvasRenderingContext2D): void => {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);

  if (!state.backgroundTransparent) {
    context.fillStyle = state.backgroundColor;
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  } else if (state._useChromaKey) {
    context.fillStyle = getChromaKeyColor();
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  } else {
    context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
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
  const waveOffset = Math.sin((state._waveTime ?? 0) * Math.PI * 2 + charIndex * 0.5) * 6;
  context.fillText(char, positionX + charWidth / 2, positionY + waveOffset);
  return charWidth;
};

const renderWaveLine = (
  context: CanvasRenderingContext2D,
  line: string,
  positionY: number
): void => {
  const totalWidth = context.measureText(line).width;
  let currentX = CANVAS_CENTER - totalWidth / 2;
  for (let charIndex = 0; charIndex < line.length; charIndex++) {
    currentX += renderWaveChar(context, line[charIndex], currentX, positionY, charIndex);
  }
};

const renderStaticLine = (
  context: CanvasRenderingContext2D,
  line: string,
  positionY: number
): void => {
  context.fillText(line, CANVAS_CENTER, positionY);
};

const renderLines = (
  context: CanvasRenderingContext2D,
  lines: string[],
  startY: number,
  fontSize: number
): void => {
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  const renderLine = state._waveTime !== null ? renderWaveLine : renderStaticLine;
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
  const fontSize = calculateFontSize(context, lines);
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  const startY = CANVAS_CENTER - ((lines.length - 1) * lineHeight) / 2;
  setupTextStyle(context, fontSize);
  renderLines(context, lines, startY, fontSize);
};

// ── Preview Logic ──

const syncStateFromInputs = (): void => {
  state.text = dom.textInput.value.trim();
  state.backgroundColor = dom.backgroundColorInput.value;
  state.backgroundTransparent = dom.backgroundTransparentInput.checked;
  state.fontColor = dom.fontColorInput.value;
  state.fontFamily = dom.fontSelect.value;
};

const updateUIState = (): void => {
  dom.backgroundColorInput.disabled = state.backgroundTransparent;
  dom.canvas.classList.toggle("transparent-bg", state.backgroundTransparent);
};

const stopAnimation = (): void => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

const showPreviewUI = (): void => {
  dom.canvas.classList.add("visible");
  dom.downloadButton.classList.add("visible");
  dom.statusElement.textContent = "";
  dom.statusElement.className = "";
};

const hidePreviewUI = (): void => {
  dom.canvas.classList.remove("visible");
  dom.downloadButton.classList.remove("visible");
};

const renderStaticPreview = (): void => {
  state._targetCanvas = null;
  const context = dom.canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not get 2d context");
  }
  context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
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

  if (state.selectedAnimation && animations[state.selectedAnimation]) {
    startAnimationLoop();
  } else {
    renderStaticPreview();
  }
};

// ── Animation Loop ──

const createAnimationFrame =
  (animationFunction: AnimationFunction, startTime: number) => (): void => {
    const elapsed = performance.now() - startTime;
    const normalizedTime = (elapsed % ANIMATION_CYCLE_MS) / ANIMATION_CYCLE_MS;
    const context = dom.canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not get 2d context");
    }
    context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    animationFunction(context, normalizedTime, renderTextContent, state);
    animationFrameId = requestAnimationFrame(createAnimationFrame(animationFunction, startTime));
  };

const startAnimationLoop = (): void => {
  state._targetCanvas = null;
  if (!state.selectedAnimation) {
    return;
  }
  const animationFunction = animations[state.selectedAnimation];
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
  await saveFile(dataURL, `emoji_${Date.now()}.png`);
};

const createOffscreenCanvas = (): HTMLCanvasElement => {
  const offCanvas = document.createElement("canvas");
  offCanvas.width = CANVAS_SIZE;
  offCanvas.height = CANVAS_SIZE;
  return offCanvas;
};

const formatFileSizeKB = (blob: Blob): string => (blob.size / 1024).toFixed(1);

const setEncodingUI = (encoding: boolean): void => {
  isEncoding = encoding;
  dom.downloadButton.disabled = encoding;
  const downloadText = state.selectedAnimation ? "Download GIF" : "Download PNG";
  dom.downloadButton.textContent = encoding ? "Encoding..." : downloadText;
  if (encoding) {
    dom.statusElement.textContent = "";
    dom.statusElement.className = "";
  }
};

const showSizeWarning = (sizeKB: string): void => {
  dom.statusElement.textContent = `Warning: ${sizeKB}KB (Slack limit: 128KB)`;
  dom.statusElement.className = "error";
};

const clearStatus = (): void => {
  dom.statusElement.textContent = "";
  dom.statusElement.className = "";
};

const showSizeSuccess = (sizeKB: string): void => {
  dom.statusElement.textContent = `Saved! (${sizeKB}KB)`;
  dom.statusElement.className = "success";
  setTimeout(clearStatus, 3000);
};

const showEncodingError = (error: unknown): void => {
  dom.statusElement.textContent = error instanceof Error ? error.message : "Encoding failed";
  dom.statusElement.className = "error";
};

const encodeAndSaveGIF = async (
  offCanvas: HTMLCanvasElement,
  animationFunction: AnimationFunction
): Promise<void> => {
  const blob = await encodeWithSizeLimit(offCanvas, animationFunction, renderTextContent, state);
  const sizeKB = formatFileSizeKB(blob);
  if (blob.size > MAX_SIZE) {
    showSizeWarning(sizeKB);
  }
  const dataURL = await blobToDataURL(blob);
  await saveFile(dataURL, `emoji_${Date.now()}.gif`);
  if (blob.size <= MAX_SIZE) {
    showSizeSuccess(sizeKB);
  }
};

const downloadGIF = async (): Promise<void> => {
  if (!state.selectedAnimation) {
    return;
  }
  const animationFunction = animations[state.selectedAnimation];
  if (!animationFunction) {
    return;
  }

  const offCanvas = createOffscreenCanvas();
  state._targetCanvas = offCanvas;
  state._useChromaKey = true;

  try {
    await encodeAndSaveGIF(offCanvas, animationFunction);
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

  if (!state.selectedAnimation) {
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
  if (dom.statusElement.textContent) {
    return;
  }
  dom.statusElement.textContent = "Saved to Desktop!";
  dom.statusElement.className = "success";
  setTimeout(clearStatus, 2000);
};

const showSaveError = (error: string): void => {
  dom.statusElement.textContent = error;
  dom.statusElement.className = "error";
};

interface SaveResult {
  success: boolean;
  error?: string;
}

const saveFile = async (dataURL: string, fileName: string): Promise<void> => {
  try {
    const result = (await window.electronAPI.invoke("save-image", {
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
  const fonts = (await window.electronAPI.invoke("get-system-fonts")) as string[];
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
  dom.backgroundColorInput.addEventListener("input", updatePreview);
  dom.backgroundTransparentInput.addEventListener("change", updatePreview);
  dom.fontColorInput.addEventListener("input", updatePreview);
  dom.fontSelect.addEventListener("change", updatePreview);
  dom.downloadButton.addEventListener("click", download);
  dom.textInput.addEventListener("keydown", handleMetaEnterDownload);
};

// ── Initialization ──

buildAnimationGrid();
loadSystemFonts();
attachEventListeners();
