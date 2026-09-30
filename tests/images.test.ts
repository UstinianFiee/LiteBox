import { describe, it, expect } from "vitest";
import {
  sniffImage,
  fitDimensions,
  outputMime,
  outputName,
  formatBytes,
  encodeCanvas,
} from "../src/lib/images";
describe("image studio safeguards", () => {
  it("recognizes supported signatures without trusting filenames", () => {
    expect(sniffImage(new Uint8Array([255, 216, 255]))).toBe("image/jpeg");
    expect(sniffImage(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      "image/png",
    );
    expect(sniffImage(new TextEncoder().encode("RIFFxxxxWEBP"))).toBe(
      "image/webp",
    );
    expect(sniffImage(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(sniffImage(new TextEncoder().encode("BMxxxx"))).toBe("image/bmp");
    expect(() => sniffImage(new TextEncoder().encode("<svg/>"))).toThrow(
      "type",
    );
    expect(() => sniffImage(new Uint8Array())).toThrow("type");
  });
  it("keeps resolution by default and never enlarges images", () => {
    expect(fitDimensions(4000, 3000, 0)).toEqual({ width: 4000, height: 3000 });
    expect(fitDimensions(4000, 3000, 1920)).toEqual({
      width: 1920,
      height: 1440,
    });
    expect(fitDimensions(30, 60, 1920)).toEqual({ width: 30, height: 60 });
    expect(fitDimensions(1, 12000, 1)).toEqual({ width: 1, height: 1 });
  });
  it("rejects excessive or invalid dimensions", () => {
    for (const args of [
      [0, 2, 0],
      [NaN, 2, 0],
      [12001, 1, 0],
      [6000, 6000, 0],
      [10, 10, -1],
      [10, 10, NaN],
      [10, 10, 12001],
    ])
      expect(() =>
        fitDimensions(...(args as [number, number, number])),
      ).toThrow();
  });
  it("uses an actual supported output format", () => {
    expect(outputMime("original", "image/bmp")).toBe("image/png");
    expect(outputMime("original", "image/gif")).toBe("image/png");
    expect(outputMime("original", "image/webp")).toBe("image/webp");
    expect(outputMime("image/jpeg", "image/png")).toBe("image/jpeg");
    expect(outputName("透明.图片.png", "image/jpeg")).toBe(
      "透明.图片-litebox.jpg",
    );
    expect(outputName("bad:name.webp", "image/png")).toBe(
      "bad_name-litebox.png",
    );
  });
  it("rejects browser codec fallback instead of giving PNG a wrong extension", async () => {
    const canvas = {
      toBlob: (cb: (blob: Blob | null) => void) =>
        cb(new Blob(["png"], { type: "image/png" })),
    } as HTMLCanvasElement;
    await expect(encodeCanvas(canvas, "image/webp", 0.9)).rejects.toThrow(
      "encode",
    );
    await expect(
      encodeCanvas(canvas, "image/png", 0.9),
    ).resolves.toHaveProperty("type", "image/png");
    const failed = {
      toBlob: (cb: (blob: null) => void) => cb(null),
    } as HTMLCanvasElement;
    await expect(encodeCanvas(failed, "image/png", 0.9)).rejects.toThrow(
      "encode",
    );
  });
  it("formats sizes consistently", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(1024 ** 2)).toBe("1.00 MB");
  });
});
