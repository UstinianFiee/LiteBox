export type ImageFormat =
  "original" | "image/jpeg" | "image/png" | "image/webp";
export interface ImageOptions {
  format: ImageFormat;
  quality: number;
  maxEdge: number;
  background: string;
}
export const IMAGE_LIMITS = {
  files: 20,
  bytes: 20 * 1024 ** 2,
  total: 100 * 1024 ** 2,
  pixels: 24_000_000,
  edge: 12000,
};
export const IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.bmp,.gif,image/jpeg,image/png,image/webp,image/bmp,image/gif";
export type ImageErrorCode =
  "type" | "size" | "dimensions" | "decode" | "encode" | "options";
export class ImageToolError extends Error {
  constructor(public code: ImageErrorCode) {
    super(code);
  }
}
// Inspect signatures rather than trusting extensions or browser-provided MIME.
export function sniffImage(data: Uint8Array): string {
  const text = (a: number, b: number) =>
    String.fromCharCode(...data.subarray(a, b));
  if (data[0] === 255 && data[1] === 216 && data[2] === 255)
    return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => data[i] === v))
    return "image/png";
  if (text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return "image/webp";
  if (text(0, 2) === "BM") return "image/bmp";
  if (["GIF87a", "GIF89a"].includes(text(0, 6))) return "image/gif";
  throw new ImageToolError("type");
}
export function outputMime(format: ImageFormat, source: string) {
  return format === "original"
    ? ["image/jpeg", "image/png", "image/webp"].includes(source)
      ? source
      : "image/png"
    : format;
}
export function fitDimensions(width: number, height: number, maxEdge: number) {
  if (
    ![width, height].every((v) => Number.isInteger(v) && v > 0) ||
    width * height > IMAGE_LIMITS.pixels ||
    Math.max(width, height) > IMAGE_LIMITS.edge
  )
    throw new ImageToolError("dimensions");
  if (!Number.isFinite(maxEdge) || maxEdge < 0 || maxEdge > IMAGE_LIMITS.edge)
    throw new ImageToolError("options");
  const scale =
    maxEdge > 0 ? Math.min(1, maxEdge / Math.max(width, height)) : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
export function outputName(name: string, mime: string) {
  const ext = (
    { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<
      string,
      string
    >
  )[mime];
  if (!ext) throw new ImageToolError("encode");
  return `${
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .slice(0, 140) || "image"
  }-litebox.${ext}`;
}
export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 ** 2).toFixed(2)} MB`;
}
export function encodeCanvas(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // Unsupported encoders silently fall back to PNG; never mislabel the file.
        if (!blob || blob.type !== mime) reject(new ImageToolError("encode"));
        else resolve(blob);
      },
      mime,
      quality,
    );
  });
}
export async function processImage(file: File, options: ImageOptions) {
  if (!file.size || file.size > IMAGE_LIMITS.bytes)
    throw new ImageToolError("size");
  if (
    !Number.isFinite(options.quality) ||
    options.quality < 0.1 ||
    options.quality > 1 ||
    !/^#[0-9a-f]{6}$/i.test(options.background) ||
    !["original", "image/jpeg", "image/png", "image/webp"].includes(
      options.format,
    )
  )
    throw new ImageToolError("options");
  const source = sniffImage(
    new Uint8Array(await file.slice(0, 16).arrayBuffer()),
  );
  const mime = outputMime(options.format, source);
  const url = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement("canvas");
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new ImageToolError("decode"));
      image.src = url;
    });
    const originalWidth = image.naturalWidth,
      originalHeight = image.naturalHeight;
    const { width, height } = fitDimensions(
      originalWidth,
      originalHeight,
      options.maxEdge,
    );
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageToolError("encode");
    if (mime === "image/jpeg") {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);
    const blob = await encodeCanvas(canvas, mime, options.quality);
    return {
      blob,
      mime,
      width,
      height,
      originalWidth,
      originalHeight,
      name: outputName(file.name, mime),
    };
  } finally {
    image.onload = null;
    image.onerror = null;
    image.src = "";
    URL.revokeObjectURL(url);
    canvas.width = canvas.height = 0;
  }
}
