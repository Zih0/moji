const path = require("path");
const { ipcRenderer } = require("electron");
const { animations, animationList } = require(
  path.join(__dirname, "src", "renderer", "animations")
);
const { encodeWithSizeLimit, blobToDataURL, MAX_SIZE, TRANSPARENT_KEY } = require(
  path.join(__dirname, "src", "renderer", "gif-encoder")
);

// ── DOM References ──

const dom = {
  textInput: document.getElementById("emoji-text"),
  bgColorInput: document.getElementById("bg-color"),
  bgTransparentInput: document.getElementById("bg-transparent"),
  fontColorInput: document.getElementById("font-color"),
  fontSelect: document.getElementById("font-select"),
  canvas: document.getElementById("preview-canvas"),
  downloadBtn: document.getElementById("download-btn"),
  statusEl: document.getElementById("status"),
  animGrid: document.getElementById("anim-grid"),
};

dom.canvas.width = 128;
dom.canvas.height = 128;

// ── Application State ──

const state = {
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

let animationFrameId = null;
let isEncoding = false;

// ── Animation Grid UI ──

const createAnimButton = (animation, onSelect) => {
  const button = document.createElement("button");
  button.className = "anim-btn";
  button.textContent = animation.name;
  button.dataset.animId = animation.id;
  button.addEventListener("click", () => onSelect(animation.id, button));
  return button;
};

const createNoneButton = (onSelect) => {
  const button = document.createElement("button");
  button.className = "anim-btn selected";
  button.textContent = "None";
  button.dataset.animId = "";
  button.addEventListener("click", () => onSelect(null, button));
  return button;
};

const buildAnimGrid = () => {
  dom.animGrid.appendChild(createNoneButton(selectAnimation));
  animationList.forEach((animation) =>
    dom.animGrid.appendChild(createAnimButton(animation, selectAnimation))
  );
};

const selectAnimation = (animationId, buttonElement) => {
  state.selectedAnim = animationId;
  dom.animGrid
    .querySelectorAll(".anim-btn")
    .forEach((button) => button.classList.remove("selected"));
  buttonElement.classList.add("selected");
  dom.downloadBtn.textContent = animationId ? "Download GIF" : "Download PNG";
  updatePreview();
};

// ── Text Utilities ──

const splitText = (text) => text.split("\n").filter((line) => line.length > 0);

const measureLinesFit = (context, lines, maxWidth, maxHeight, fontSize) => {
  context.font = `bold ${fontSize}px ${state.fontFamily}`;
  const lineHeight = fontSize * 1.15;
  if (lines.length * lineHeight > maxHeight) {
    return false;
  }
  return lines.every((line) => context.measureText(line).width <= maxWidth);
};

const calcFontSize = (context, lines) => {
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

const getChromaKeyColor = () => "#" + TRANSPARENT_KEY.toString(16).padStart(6, "0");

const renderBackground = (context) => {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);

  if (state.bgTransparent) {
    const chromaKey = getChromaKeyColor();
    context.fillStyle = state._useChromaKey ? chromaKey : "transparent";
    state._useChromaKey ? context.fillRect(0, 0, 128, 128) : context.clearRect(0, 0, 128, 128);
  } else {
    context.fillStyle = state.bgColor;
    context.fillRect(0, 0, 128, 128);
  }

  context.restore();
};

// ── Text Rendering ──

const renderWaveChar = (context, char, positionX, positionY, charIndex) => {
  const charWidth = context.measureText(char).width;
  const waveOffset = Math.sin(state._waveT * Math.PI * 2 + charIndex * 0.5) * 6;
  context.fillText(char, positionX + charWidth / 2, positionY + waveOffset);
  return charWidth;
};

const renderWaveLine = (context, line, positionY) => {
  const totalWidth = context.measureText(line).width;
  let currentX = 64 - totalWidth / 2;
  for (let charIndex = 0; charIndex < line.length; charIndex++) {
    currentX += renderWaveChar(context, line[charIndex], currentX, positionY, charIndex);
  }
};

const renderStaticLine = (context, line, positionY) => context.fillText(line, 64, positionY);

const renderLines = (context, lines, startY, fontSize) => {
  const lineHeight = fontSize * 1.15;
  const renderLine = state._waveT !== null ? renderWaveLine : renderStaticLine;
  lines.forEach((line, index) => renderLine(context, line, startY + index * lineHeight));
};

const setupTextStyle = (context, fontSize) => {
  context.font = `bold ${fontSize}px ${state.fontFamily}`;
  context.fillStyle = state._partyColor || state.fontColor;
  context.textAlign = "center";
  context.textBaseline = "middle";
};

const renderTextContent = () => {
  const targetCanvas = state._targetCanvas || dom.canvas;
  const context = targetCanvas.getContext("2d");
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

const syncStateFromInputs = () => {
  state.text = dom.textInput.value.trim();
  state.bgColor = dom.bgColorInput.value;
  state.bgTransparent = dom.bgTransparentInput.checked;
  state.fontColor = dom.fontColorInput.value;
  state.fontFamily = dom.fontSelect.value;
};

const updateUIState = () => {
  dom.bgColorInput.disabled = state.bgTransparent;
  dom.canvas.classList.toggle("transparent-bg", state.bgTransparent);
};

const stopAnimation = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

const showPreviewUI = () => {
  dom.canvas.classList.add("visible");
  dom.downloadBtn.classList.add("visible");
  dom.statusEl.textContent = "";
  dom.statusEl.className = "";
};

const hidePreviewUI = () => {
  dom.canvas.classList.remove("visible");
  dom.downloadBtn.classList.remove("visible");
};

const renderStaticPreview = () => {
  state._targetCanvas = null;
  const context = dom.canvas.getContext("2d");
  context.clearRect(0, 0, 128, 128);
  renderTextContent();
};

const updatePreview = () => {
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

const createAnimationFrame = (animationFunction, startTime) => () => {
  const elapsed = performance.now() - startTime;
  const normalizedTime = (elapsed % 1000) / 1000;

  const context = dom.canvas.getContext("2d");
  context.clearRect(0, 0, 128, 128);
  animationFunction(context, normalizedTime, renderTextContent, state);

  animationFrameId = requestAnimationFrame(createAnimationFrame(animationFunction, startTime));
};

const startAnimationLoop = () => {
  state._targetCanvas = null;
  const animationFunction = animations[state.selectedAnim];
  animationFrameId = requestAnimationFrame(
    createAnimationFrame(animationFunction, performance.now())
  );
};

// ── Download ──

const downloadPNG = async () => {
  state._targetCanvas = null;
  const dataURL = dom.canvas.toDataURL("image/png");
  const fileName = `emoji_${Date.now()}.png`;
  await saveFile(dataURL, fileName);
};

const createOffscreenCanvas = () => {
  const offCanvas = document.createElement("canvas");
  offCanvas.width = 128;
  offCanvas.height = 128;
  return offCanvas;
};

const setEncodingUI = (encoding) => {
  isEncoding = encoding;
  dom.downloadBtn.disabled = encoding;
  const downloadText = state.selectedAnim ? "Download GIF" : "Download PNG";
  dom.downloadBtn.textContent = encoding ? "Encoding..." : downloadText;
  if (encoding) {
    dom.statusEl.textContent = "";
    dom.statusEl.className = "";
  }
};

const showSizeWarning = (sizeKB) => {
  dom.statusEl.textContent = `Warning: ${sizeKB}KB (Slack limit: 128KB)`;
  dom.statusEl.className = "error";
};

const clearStatus = () => {
  dom.statusEl.textContent = "";
  dom.statusEl.className = "";
};

const showSizeSuccess = (sizeKB) => {
  dom.statusEl.textContent = `Saved! (${sizeKB}KB)`;
  dom.statusEl.className = "success";
  setTimeout(clearStatus, 3000);
};

const handleEncodingResult = (blob) => {
  const sizeKB = (blob.size / 1024).toFixed(1);
  blob.size > MAX_SIZE ? showSizeWarning(sizeKB) : showSizeSuccess(sizeKB);
};

const showEncodingError = (error) => {
  dom.statusEl.textContent = error?.message || "Encoding failed";
  dom.statusEl.className = "error";
};

const downloadGIF = async () => {
  const animationFunction = animations[state.selectedAnim];
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

const download = async () => {
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

const showSaveSuccess = () => {
  if (!dom.statusEl.textContent) {
    dom.statusEl.textContent = "Saved to Desktop!";
    dom.statusEl.className = "success";
    setTimeout(clearStatus, 2000);
  }
};

const showSaveError = (error) => {
  dom.statusEl.textContent = error;
  dom.statusEl.className = "error";
};

const saveFile = async (dataURL, fileName) => {
  try {
    const result = await ipcRenderer.invoke("save-image", {
      dataURL,
      fileName,
    });
    result.success ? showSaveSuccess() : showSaveError(result?.error ?? "Save failed");
  } catch (error) {
    showSaveError(error?.message);
  }
};

// ── System Fonts ──

const createFontOption = (family) => {
  const option = document.createElement("option");
  option.value = `"${family}"`;
  option.textContent = family;
  return option;
};

const loadSystemFonts = async () => {
  const fonts = await ipcRenderer.invoke("get-system-fonts");
  fonts.forEach((family) => dom.fontSelect.appendChild(createFontOption(family)));
};

// ── Event Handlers ──

const handleMetaEnterDownload = (event) => {
  if (event.key === "Enter" && event.metaKey && dom.canvas.classList.contains("visible")) {
    download();
  }
};

const attachEventListeners = () => {
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
