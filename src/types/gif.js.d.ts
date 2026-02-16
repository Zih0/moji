declare module "gif.js" {
  interface GIFOptions {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    workerScript?: string;
    transparent?: number;
  }

  interface GIF {
    on(event: "finished", callback: (blob: Blob) => void): void;
    on(event: "progress", callback: (progress: number) => void): void;
    addFrame(
      imageElement: HTMLCanvasElement | CanvasRenderingContext2D,
      options?: { delay?: number; copy?: boolean }
    ): void;
    render(): void;
    abort(): void;
  }

  interface GIFConstructor {
    new (options?: GIFOptions): GIF;
  }

  const GIF: GIFConstructor;
  export default GIF;
}
