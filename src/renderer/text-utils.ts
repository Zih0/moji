export const splitText = (text: string): string[] =>
  text.split("\n").filter((line) => line.length > 0);

export const measureLinesFit = (
  context: CanvasRenderingContext2D,
  lines: string[],
  maxWidth: number,
  maxHeight: number,
  fontSize: number,
  fontFamily: string
): boolean => {
  context.font = `bold ${fontSize}px ${fontFamily}`;
  const lineHeight = fontSize * 1.15;
  if (lines.length * lineHeight > maxHeight) {
    return false;
  }
  return lines.every((line) => context.measureText(line).width <= maxWidth);
};
