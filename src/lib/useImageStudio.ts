import { computed, onUnmounted, ref, shallowReactive, watch } from "vue";
import { desktop, notify, t, used } from "./store";
import { logActivity } from "./activity";
import {
  IMAGE_LIMITS,
  ImageToolError,
  processImage,
  sniffImage,
  type ImageOptions,
  type ImageErrorCode,
} from "./images";
export interface ImageItem {
  id: string;
  file: File;
  sourceUrl: string;
  resultUrl?: string;
  result?: Awaited<ReturnType<typeof processImage>>;
  status: "ready" | "processing" | "done" | "error";
  error?: ImageErrorCode;
}
export function useImageStudio() {
  const items = shallowReactive<ImageItem[]>([]);
  const selected = ref("");
  const busy = ref(false),
    importing = ref(false),
    cancelled = ref(false);
  const acknowledged = ref(false);
  const options = ref<ImageOptions>({
    format: "original",
    quality: 0.9,
    maxEdge: 0,
    background: "#ffffff",
  });
  const current = computed(() => items.find((i) => i.id === selected.value));
  const completed = computed(() => items.filter((i) => i.result));
  const totals = computed(() =>
    completed.value.reduce(
      (s, i) => ({
        before: s.before + i.file.size,
        after: s.after + i.result!.blob.size,
      }),
      { before: 0, after: 0 },
    ),
  );
  let disposed = false;
  const errors: Record<ImageErrorCode, [string, string]> = {
    type: [
      "不支持此格式，请选择 JPG、PNG、WebP、BMP 或 GIF",
      "Choose a JPG, PNG, WebP, BMP or GIF file",
    ],
    size: ["图片为空或超过 20 MB", "Image is empty or exceeds 20 MB"],
    dimensions: [
      "图片超过 2400 万像素或单边 12000 像素",
      "Image exceeds 24 megapixels or a 12000 px edge",
    ],
    decode: [
      "图片无法读取，文件可能已损坏",
      "Cannot decode this image; it may be damaged",
    ],
    encode: [
      "当前环境无法编码所选格式，请尝试 PNG",
      "This encoder is unavailable; try PNG",
    ],
    options: [
      "请检查质量、尺寸或背景色设置",
      "Check quality, size and background settings",
    ],
  };
  const errorText = (code?: ImageErrorCode) => t(...errors[code || "decode"]);
  function discardResult(item: ImageItem) {
    if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    return {
      ...item,
      result: undefined,
      resultUrl: undefined,
      status: "ready" as const,
      error: undefined,
    };
  }
  watch(
    options,
    () => {
      if (!busy.value)
        items.splice(0, items.length, ...items.map(discardResult));
    },
    { deep: true, flush: "sync" },
  );
  async function add(files: File[]) {
    if (busy.value || importing.value || disposed) return;
    importing.value = true;
    let rejected = 0;
    try {
      for (const file of files) {
        if (
          items.length >= IMAGE_LIMITS.files ||
          items.reduce((s, i) => s + i.file.size, 0) + file.size >
            IMAGE_LIMITS.total
        ) {
          rejected++;
          continue;
        }
        if (!file.size || file.size > IMAGE_LIMITS.bytes) {
          rejected++;
          continue;
        }
        try {
          sniffImage(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
        } catch {
          rejected++;
          continue;
        }
        if (disposed) break;
        if (
          items.some(
            (i) =>
              i.file.name === file.name &&
              i.file.size === file.size &&
              i.file.lastModified === file.lastModified,
          )
        )
          continue;
        const id = crypto.randomUUID();
        items.push({
          id,
          file,
          sourceUrl: URL.createObjectURL(file),
          status: "ready",
        });
        selected.value ||= id;
      }
      if (rejected)
        notify(
          t(
            `已跳过 ${rejected} 个文件：仅支持列出的图片格式，每张 ≤20 MB，最多 20 张，总计 ≤100 MB。`,
            `Skipped ${rejected} files: supported images only, 20 MB each, 20 files / 100 MB total.`,
          ),
          true,
        );
    } finally {
      importing.value = false;
    }
  }
  async function run() {
    if (busy.value || importing.value || !acknowledged.value || !items.length)
      return;
    busy.value = true;
    cancelled.value = false;
    const settings = { ...options.value };
    try {
      for (let index = 0; index < items.length; index++) {
        if (cancelled.value || disposed) break;
        const item = discardResult(items[index]!);
        items[index] = { ...item, status: "processing" };
        try {
          const result = await processImage(item.file, settings);
          if (disposed) break;
          items[index] = {
            ...item,
            status: "done",
            result,
            resultUrl: URL.createObjectURL(result.blob),
          };
        } catch (e) {
          if (disposed) break;
          items[index] = {
            ...item,
            status: "error",
            error: e instanceof ImageToolError ? e.code : "decode",
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (!disposed) {
        if (completed.value.length) used("images");
        if (items.some((i) => i.status === "error"))
          void logActivity("images", "run", "error");
        notify(
          cancelled.value
            ? t(
                "已停止，已完成的图片可以下载",
                "Stopped. Completed images are ready to download.",
              )
            : t(
                "处理结束，请预览画质后下载",
                "Processing finished. Review image quality before downloading.",
              ),
        );
      }
    } finally {
      busy.value = false;
    }
  }
  function remove(id: string) {
    if (busy.value || importing.value) return;
    const index = items.findIndex((i) => i.id === id);
    if (index < 0) return;
    const item = items[index]!;
    URL.revokeObjectURL(item.sourceUrl);
    discardResult(item);
    items.splice(index, 1);
    if (selected.value === id) selected.value = items[0]?.id || "";
  }
  function clear() {
    if (!busy.value && !importing.value)
      for (const item of [...items]) remove(item.id);
  }
  function download(item: ImageItem, original = false) {
    if (!original && !item.resultUrl) return;
    const a = document.createElement("a");
    a.href = original ? item.sourceUrl : item.resultUrl!;
    a.download = original ? item.file.name : item.result!.name;
    a.click();
    // Native activity IPC only accepts visit/run; never poison the log state.
    if (!desktop) void logActivity("images", "export");
  }
  onUnmounted(() => {
    disposed = true;
    cancelled.value = true;
    for (const item of items) {
      URL.revokeObjectURL(item.sourceUrl);
      discardResult(item);
    }
  });
  return {
    items,
    selected,
    current,
    busy,
    importing,
    cancelled,
    acknowledged,
    options,
    completed,
    totals,
    add,
    run,
    remove,
    clear,
    download,
    errorText,
  };
}
