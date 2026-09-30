import { reactive } from "vue";
export type ActivityModule =
  | "app"
  | "home"
  | "orders"
  | "sql"
  | "images"
  | "convert"
  | "markdown"
  | "remote"
  | "database"
  | "chat"
  | "dashboard"
  | "history"
  | "snippets"
  | "settings";
export type ActivityAction =
  | "start"
  | "visit"
  | "run"
  | "copy"
  | "export"
  | "import"
  | "open"
  | "save"
  | "connect"
  | "disconnect"
  | "query"
  | "write"
  | "delete"
  | "credentials"
  | "cancel"
  | "clear";
export interface ActivityRecord {
  id: string;
  at: number;
  module: ActivityModule;
  action: ActivityAction;
  status: "success" | "error" | "cancelled";
}
export const activity = reactive({
  records: [] as ActivityRecord[],
  error: "",
});
export const moduleNames: Record<ActivityModule, [string, string]> = {
  app: ["应用", "Application"],
  home: ["工作台", "Overview"],
  orders: ["文本整理", "Text tidy"],
  sql: ["SQL 处理", "SQL builder"],
  images: ["图片工坊", "Image studio"],
  convert: ["格式转换", "Converters"],
  markdown: ["文档", "Documents"],
  remote: ["远程连接", "Remote"],
  database: ["数据库", "Databases"],
  chat: ["AI 助手", "AI assistant"],
  dashboard: ["数据看板", "Dashboard"],
  history: ["历史日志", "History"],
  snippets: ["常用片段", "Snippets"],
  settings: ["设置", "Settings"],
};
export const actionNames: Record<ActivityAction, [string, string]> = {
  start: ["启动应用", "App started"],
  visit: ["访问页面", "Page opened"],
  run: ["工具操作完成", "Tool completed"],
  copy: ["复制内容", "Copied content"],
  export: ["导出 / 下载", "Export / download"],
  import: ["导入 / 上传", "Import / upload"],
  open: ["打开文件", "Opened file"],
  save: ["保存文件", "Saved file"],
  connect: ["连接 / 测试", "Connect / test"],
  disconnect: ["断开连接", "Disconnected"],
  query: ["执行查询", "Query executed"],
  write: ["修改数据", "Data changed"],
  delete: ["删除配置 / 凭据", "Deleted profile / credentials"],
  credentials: ["保存凭据", "Credentials saved"],
  cancel: ["取消操作", "Cancelled"],
  clear: ["清空日志", "History cleared"],
};
const key = "litebox-preview-activity";
export async function refreshActivity() {
  try {
    if (window.litebox) {
      const r = await window.litebox.invoke("activity:list");
      activity.records = r.records;
      activity.error = r.error || "";
    }
  } catch {
    activity.error = "日志读取失败 / Could not load history";
  }
}
export async function logActivity(
  module: ActivityModule,
  action: ActivityAction,
  status: ActivityRecord["status"] = "success",
) {
  try {
    if (window.litebox) {
      await window.litebox.invoke("activity:add", { module, action, status });
      return;
    }
    if (activity.error) return;
    activity.records.push({
      id: crypto.randomUUID(),
      at: Date.now(),
      module,
      action,
      status,
    });
    activity.records = activity.records.slice(-3000);
    localStorage.setItem(key, JSON.stringify(activity.records));
  } catch {
    activity.error = "日志保存失败 / Could not save history";
  }
}
export async function initializeActivity() {
  if (window.litebox) {
    window.litebox.on("activity:changed", refreshActivity);
    await refreshActivity();
  } else {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(raw)) throw Error();
      activity.records = raw
        .slice(-3000)
        .filter(
          (r) =>
            r &&
            Object.hasOwn(moduleNames, r.module) &&
            Object.hasOwn(actionNames, r.action) &&
            ["success", "error", "cancelled"].includes(r.status) &&
            Number.isFinite(r.at),
        );
      await logActivity("app", "start");
    } catch {
      activity.error =
        "日志文件损坏，原数据已保留 / Invalid history; original preserved";
    }
  }
}
export async function clearActivity() {
  if (window.litebox) {
    const ok = await window.litebox.invoke("activity:clear");
    if (ok) await refreshActivity();
    return ok;
  }
  if (activity.error) throw Error(activity.error);
  localStorage.setItem(key, "[]");
  activity.records = [];
  return true;
}
export function activityStats(records: ActivityRecord[], now = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const operations = records.filter(
    (r) => !["visit", "start"].includes(r.action),
  );
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() - 6 + i);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    return {
      at: date.getTime(),
      count: operations.filter(
        (r) => r.at >= date.getTime() && r.at < end.getTime(),
      ).length,
    };
  });
  return {
    operations,
    today: operations.filter((r) => r.at >= start.getTime() && r.at <= now)
      .length,
    errors: operations.filter((r) => r.status === "error").length,
    days,
    modules: Object.entries(moduleNames)
      .map(([id, name]) => ({
        id,
        name,
        count: operations.filter((r) => r.module === id).length,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count),
  };
}
