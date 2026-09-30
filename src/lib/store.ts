import { reactive, watch } from "vue";
import { writeClipboard } from "./clipboard";
import {
  initializeActivity,
  logActivity,
  moduleNames,
  type ActivityModule,
} from "./activity";
import { SQL_TEMPLATE } from "./sql";
import type { AppState, PageId } from "./types";
export const desktop = !!window.litebox;
export const state = reactive<AppState>({
  version: 1,
  locale: "zh",
  theme: "light",
  favorites: ["orders", "markdown", "remote"],
  recent: [],
  usage: {},
  order: {
    input: "",
    size: 50,
    delimiter: "|",
    dedupe: false,
    quote: "",
    split: "auto",
    mode: "size",
  },
  sql: { template: SQL_TEMPLATE, input: "", dedupe: false, separator: "lines" },
  markdown: { text: "", name: "Untitled.md", path: "" },
  servers: [],
  databases: [],
  chats: [],
  snippets: [],
  ai: {
    endpoint: "https://api.openai.com/v1",
    model: "",
    mode: "general",
    system: "",
  },
  dashboard: { csv: "", name: "", x: "", y: "", type: "bar" },
});
export const ui = reactive({
  page: "home" as PageId,
  toast: "",
  toastError: false,
  ready: false,
  dataDir: "",
  secretSaved: false,
  version: "1.0.0",
  search: "",
  chatDraft: "",
});
let toastTimer: ReturnType<typeof setTimeout>;
export function notify(message: string, error = false) {
  ui.toast = message;
  ui.toastError = error;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (ui.toast = ""), 4500);
}
export const t = (zh: string, en: string) => (state.locale === "zh" ? zh : en);
export function navigate(page: PageId) {
  if (ui.page !== page) void logActivity(page, "visit");
  ui.page = page;
  ui.search = "";
  state.recent = [
    { page, at: Date.now() },
    ...state.recent.filter((r) => r.page !== page),
  ].slice(0, 6);
}
export function used(tool: string) {
  if (
    Object.hasOwn(moduleNames, tool) &&
    !(desktop && ["remote", "database", "chat"].includes(tool))
  )
    void logActivity(tool as ActivityModule, "run");
  state.usage[tool] = (state.usage[tool] || 0) + 1;
}
export async function invoke(channel: string, payload?: unknown) {
  if (!window.litebox)
    throw new Error(
      t("此功能需要在桌面版中使用", "This feature requires the desktop app"),
    );
  return window.litebox.invoke(channel, payload);
}
export async function copy(text: string) {
  try {
    await writeClipboard(text);
    if (!desktop) void logActivity(ui.page, "copy");
    notify(t("已复制到剪贴板", "Copied to clipboard"));
  } catch {
    notify(
      t(
        "复制被阻止，请保持窗口在前台后重试，或选中文本按 Ctrl+C",
        "Copy was blocked. Keep this window focused and retry, or select the text and press Ctrl+C.",
      ),
      true,
    );
  }
}
export async function exportText(text: string, filename: string) {
  if (desktop) return invoke("file:export", { text, filename });
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  void logActivity(ui.page, "export");
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { saved: true };
}
export async function openText(extensions = ["txt", "md", "csv", "json"]) {
  if (desktop) return invoke("file:open", { extensions });
  return new Promise<{ text: string; name: string; path: string } | null>(
    (resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = extensions.map((e) => "." + e).join(",");
      input.oncancel = () => resolve(null);
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        if (file.size > 5 * 1024 * 1024) {
          notify(t("文件不能超过 5 MB", "Files must be under 5 MB"), true);
          return resolve(null);
        }
        resolve({ text: await file.text(), name: file.name, path: "" });
      };
      input.click();
    },
  );
}
export function favorite(page: PageId) {
  state.favorites = state.favorites.includes(page)
    ? state.favorites.filter((p) => p !== page)
    : [...state.favorites, page];
}
export async function initialize() {
  try {
    const saved = desktop
      ? await invoke("state:load")
      : JSON.parse(localStorage.getItem("litebox-preview") || "null");
    if (saved?.version === 1) {
      for (const key of Object.keys(state) as (keyof AppState)[])
        if (key in saved) (state as any)[key] = saved[key];
    }
    if (desktop) {
      const info = await invoke("app:info");
      Object.assign(ui, {
        dataDir: info.dataDir,
        secretSaved: info.secretSaved,
        version: info.version,
      });
    }
  } catch (e) {
    notify(String(e), true);
  }
  await initializeActivity();
  ui.ready = true;
  let timer: ReturnType<typeof setTimeout>;
  watch(
    state,
    () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const data = JSON.parse(JSON.stringify(state));
          if (desktop) await invoke("state:save", data);
          else localStorage.setItem("litebox-preview", JSON.stringify(data));
        } catch (e) {
          notify(t("保存失败：", "Save failed: ") + String(e), true);
        }
      }, 400);
    },
    { deep: true },
  );
}

window.addEventListener("beforeunload", () => {
  if (ui.ready && desktop)
    window.litebox?.flush(JSON.parse(JSON.stringify(state)));
});
