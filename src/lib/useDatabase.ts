import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import {
  state,
  t,
  desktop,
  invoke,
  notify,
  exportText,
  used,
  copy,
} from "./store";
import { buildSql } from "./sql";
import { askConfirm } from "./confirm";
import { quoteDatabaseIdentifier } from "./database";
import {
  exportResult,
  resultClipboard,
  type DataFormat,
} from "./database-transfer";
import type { DatabaseProfile, QueryResult } from "./types";
export function useDatabase() {
  const resultPage = ref(1),
    structurePage = ref(1),
    pageSize = ref(50),
    catalogPage = ref(1),
    catalogSize = ref(50);
  let resultOffsets = [0],
    structureOffsets = [0],
    catalogOffsets = [0];
  const selected = ref(""),
    connected = ref(false),
    busy = ref(false),
    error = ref(""),
    password = ref("");
  const search = ref(""),
    sql = ref("SELECT 1 AS connection_check;"),
    demo = ref(false);
  const result = ref<QueryResult | null>(null),
    structure = ref<QueryResult | null>(null);
  const catalog = ref<{ schema: string; name: string; type: string }[]>([]),
    catalogTruncated = ref(false),
    table = ref("");
  const view = ref<"result" | "structure">("result"),
    editing = ref(false),
    dialogEl = ref<HTMLDialogElement>();
  const testMessage = ref("");
  const rememberPassword = ref(false),
    secretSaved = ref(false);
  const exportFormat = ref<DataFormat>("csv");
  const targetSchema = ref(""),
    targetTable = ref("");
  const initialQuery = (type?: string) =>
    type === "mongodb"
      ? '{"action":"find","collection":"orders","filter":{},"sort":{"_id":1}}'
      : type === "redis"
        ? '["SCAN","0"]'
        : type === "oracle"
          ? "SELECT 1 AS connection_check FROM DUAL"
          : "SELECT 1 AS connection_check;";
  async function secretStatus() {
    secretSaved.value = false;
    if (desktop && profile.value)
      try {
        secretSaved.value = await invoke("db:secret-status", {
          profile: { ...profile.value },
        });
      } catch (e) {
        error.value = String(e);
      }
  }
  async function forgetPassword() {
    if (!desktop || !profile.value) return;
    try {
      await invoke("db:secret-forget", { profile: { ...profile.value } });
      secretSaved.value = false;
    } catch (e) {
      error.value = String(e);
    }
  }
  let disposed = false;
  const blank = (): DatabaseProfile => ({
    id: crypto.randomUUID(),
    name: "",
    type: "mysql",
    host: "127.0.0.1",
    port: 3306,
    username: "",
    database: "",
    path: "",
    tls: true,
  });
  const form = ref(blank()),
    formPassword = ref("");
  const profile = computed(() =>
    state.databases.find((p) => p.id === selected.value),
  );
  const profiles = computed(() =>
    state.databases.filter((p) =>
      (p.name + " " + p.host + " " + p.database)
        .toLowerCase()
        .includes(search.value.toLowerCase()),
    ),
  );
  const schemas = computed(() => [
    ...new Set(catalog.value.map((x) => x.schema)),
  ]);
  const displayed = computed(() =>
    view.value === "result" ? result.value : structure.value,
  );
  const displayPage = computed(() =>
    view.value === "result" ? resultPage.value : structurePage.value,
  );
  const off = window.litebox?.on("db:closed", (e) => {
    if (e.id === selected.value) {
      connected.value = false;
      busy.value = false;
      catalog.value = [];
      error.value = e.reason;
    }
  });
  watch(sql, () => {
    resultPage.value = 1;
    resultOffsets = [0];
    result.value = null;
    error.value = "";
  });
  watch(
    form,
    () => {
      testMessage.value = "";
    },
    { deep: true },
  );
  function resetResults() {
    resultPage.value = structurePage.value = catalogPage.value = 1;
    resultOffsets = [0];
    structureOffsets = [0];
    catalogOffsets = [0];
    result.value = null;
    structure.value = null;
    catalog.value = [];
    catalogTruncated.value = false;
    table.value = "";
    targetSchema.value = "";
    targetTable.value = "";
    error.value = "";
  }
  async function disconnect() {
    if (selected.value && desktop)
      await invoke("db:disconnect", { id: selected.value });
    connected.value = false;
    password.value = "";
    resetResults();
  }
  async function select(id: string) {
    if (busy.value) return;
    if (id === selected.value && !demo.value) return;
    if (
      connected.value &&
      !(await askConfirm(
        t(
          "切换配置会断开当前数据库连接，继续？",
          "Switch profile and disconnect the current database?",
        ),
        { confirmLabel: t("切换连接", "Switch connection") },
      ))
    )
      return;
    try {
      await disconnect();
      selected.value = id;
      demo.value = false;
      sql.value = initialQuery(profile.value?.type);
      await secretStatus();
    } catch (e) {
      error.value = String(e);
    }
  }
  function add() {
    rememberPassword.value = false;
    form.value = blank();
    formPassword.value = "";
    testMessage.value = "";
    editing.value = true;
    nextTick(() => dialogEl.value?.showModal());
  }
  function edit() {
    if (!profile.value || connected.value || busy.value) return;
    rememberPassword.value = secretSaved.value;
    form.value = { ...profile.value };
    formPassword.value = "";
    testMessage.value = "";
    editing.value = true;
    nextTick(() => dialogEl.value?.showModal());
  }
  function closeDialog() {
    if (busy.value) return;
    dialogEl.value?.close();
    editing.value = false;
    formPassword.value = "";
  }
  function changeType() {
    form.value.port = {
      mysql: 3306,
      postgres: 5432,
      sqlite: 0,
      oracle: 1521,
      mongodb: 27017,
      redis: 6379,
    }[form.value.type];
    rememberPassword.value = false;
    formPassword.value = "";
    form.value.path = "";
    form.value.database = "";
  }
  async function pickFile(target: "form" | "profile") {
    try {
      const file = await invoke("db:pick-file");
      if (!file) return;
      if (target === "form") form.value.path = file;
      else if (profile.value) {
        profile.value.path = file;
      }
    } catch (e) {
      notify(String(e), true);
    }
  }
  function valid(p: DatabaseProfile) {
    return (
      !!p.name.trim() &&
      (p.type === "sqlite"
        ? !!p.path
        : !!p.host.trim() &&
          (["redis", "mongodb"].includes(p.type) || !!p.username.trim()) &&
          Number.isInteger(p.port) &&
          p.port > 0 &&
          p.port < 65536)
    );
  }
  async function save() {
    if (busy.value) return;
    if (!valid(form.value)) {
      testMessage.value = t(
        "请填写有效的连接名称、主机、端口及用户名。",
        "Enter a valid name, host, port and username.",
      );
      return;
    }
    if (connected.value) await disconnect();
    const p = { ...form.value };
    if (p.type === "sqlite") {
      p.host = "";
      p.port = 0;
      p.username = "";
      p.database = "";
      p.tls = false;
    }
    try {
      if (desktop && p.type !== "sqlite") {
        if (rememberPassword.value && formPassword.value)
          await invoke("db:secret-save", {
            profile: p,
            password: formPassword.value,
          });
        else if (!rememberPassword.value)
          await invoke("db:secret-forget", { profile: p });
      }
    } catch (e) {
      testMessage.value = String(e);
      return;
    }
    const i = state.databases.findIndex((x) => x.id === p.id);
    if (i < 0) state.databases.push(p);
    else state.databases[i] = p;
    selected.value = p.id;
    demo.value = false;
    resetResults();
    sql.value = initialQuery(p.type);
    password.value = formPassword.value;
    await secretStatus();
    closeDialog();
  }
  async function test() {
    if (!valid(form.value) || busy.value || !desktop) return;
    busy.value = true;
    testMessage.value = "";
    try {
      await invoke("db:test", {
        profile: { ...form.value },
        password: formPassword.value,
      });
      testMessage.value = t(
        "连接测试成功（测试会话已关闭）",
        "Connection successful (test session closed)",
      );
    } catch (e) {
      testMessage.value = String(e);
    } finally {
      busy.value = false;
    }
  }
  async function refresh(page = 1) {
    if (typeof page !== "number") page = 1;
    if (page === 1) catalogOffsets = [0];
    if (!connected.value || busy.value) return;
    busy.value = true;
    error.value = "";
    try {
      const r: QueryResult = await invoke("db:catalog", {
        id: selected.value,
        paging: {
          offset: catalogOffsets[page - 1] || 0,
          limit: catalogSize.value,
        },
      });
      catalog.value = r.rows.map((row) => ({
        schema: row[0] || "",
        name: row[1] || "",
        type: row[2] || "",
      }));
      catalogTruncated.value = !!r.hasMore;
      catalogPage.value = page;
      catalogOffsets[page] = r.nextOffset || 0;
    } catch (e) {
      error.value = String(e);
    } finally {
      busy.value = false;
    }
  }
  async function connect() {
    if (!profile.value || busy.value || connected.value || !desktop) return;
    const p = { ...profile.value };
    busy.value = true;
    error.value = "";
    demo.value = false;
    resetResults();
    try {
      await invoke("db:connect", { profile: p, password: password.value });
      if (disposed) {
        await invoke("db:disconnect", { id: p.id });
        return;
      }
      connected.value = true;
      password.value = "";
      busy.value = false;
      await refresh();
      used("database");
    } catch (e) {
      error.value = String(e);
    } finally {
      busy.value = false;
    }
  }
  async function openTable(schema: string, name: string) {
    if (busy.value) return;
    structurePage.value = 1;
    structureOffsets = [0];
    targetSchema.value = schema;
    targetTable.value = name;
    table.value = schema + "." + name;
    sql.value =
      "SELECT *\nFROM " +
      quoteDatabaseIdentifier(schema, profile.value?.type || "sqlite") +
      "." +
      quoteDatabaseIdentifier(name, profile.value?.type || "sqlite") +
      ";";
    if (profile.value?.type === "mongodb")
      sql.value = JSON.stringify(
        { action: "find", collection: name, filter: {} },
        null,
        2,
      );
    if (profile.value?.type === "redis")
      sql.value = JSON.stringify(["GET", name]);
    view.value = "structure";
    structure.value = null;
    if (demo.value) {
      structure.value = {
        columns: ["column_name", "data_type", "is_nullable"],
        rows: [
          ["order_no", "varchar(32)", "NO"],
          ["customer", "varchar(100)", "YES"],
          ["amount", "decimal(12,2)", "YES"],
        ],
        elapsedMs: 0,
        truncated: false,
      };
      return;
    }
    busy.value = true;
    error.value = "";
    try {
      structure.value = await invoke("db:columns", {
        id: selected.value,
        schema,
        table: name,
        paging: { offset: 0, limit: pageSize.value },
      });
    } catch (e) {
      error.value = String(e);
    } finally {
      busy.value = false;
    }
  }
  async function run(page = 1) {
    if (typeof page !== "number") page = 1;
    if (page === 1) resultOffsets = [0];
    const queryText = sql.value;
    if (!connected.value || busy.value || demo.value || !sql.value.trim())
      return;
    busy.value = true;
    error.value = "";
    result.value = null;
    view.value = "result";
    try {
      const response: QueryResult = await invoke("db:query", {
        id: selected.value,
        sql: queryText,
        paging: { offset: resultOffsets[page - 1] || 0, limit: pageSize.value },
      });
      if (sql.value === queryText) {
        result.value = response;
        resultPage.value = page;
        resultOffsets[page] = response.nextOffset ?? 0;
      }
      used("database");
    } catch (e) {
      error.value = String(e);
    } finally {
      busy.value = false;
    }
  }
  async function changePage(page: number) {
    if (busy.value || demo.value) return;
    if (view.value === "result") return run(page);
    if (!connected.value || !targetTable.value) return;
    busy.value = true;
    error.value = "";
    try {
      if (page === 1) structureOffsets = [0];
      if (page === structurePage.value + 1)
        structureOffsets[page - 1] = structure.value?.nextOffset || 0;
      const r: QueryResult = await invoke("db:columns", {
        id: selected.value,
        schema: targetSchema.value,
        table: targetTable.value,
        paging: {
          offset: structureOffsets[page - 1] || 0,
          limit: pageSize.value,
        },
      });
      structure.value = r;
      structurePage.value = page;
      structureOffsets[page] = r.nextOffset || 0;
    } catch (e) {
      error.value = String(e);
    } finally {
      busy.value = false;
    }
  }
  async function resizePage(size: number) {
    pageSize.value = size;
    await changePage(1);
  }
  async function resizeCatalog(size: number) {
    catalogSize.value = size;
    await refresh(1);
  }
  async function cancel() {
    try {
      await invoke("db:cancel", { id: selected.value });
      connected.value = false;
      busy.value = false;
    } catch (e) {
      error.value = String(e);
    }
  }
  async function remove() {
    if (!profile.value || busy.value || connected.value) return;
    if (
      !(await askConfirm(
        t(
          "删除数据库连接配置？不会删除数据库。",
          "Delete this profile? The database is not deleted.",
        ),
        { danger: true, confirmLabel: t("删除配置", "Delete profile") },
      ))
    )
      return;
    if (desktop) {
      try {
        await invoke("db:secret-forget", { profile: { ...profile.value } });
      } catch (e) {
        error.value = String(e);
        return;
      }
    }
    state.databases = state.databases.filter((p) => p.id !== selected.value);
    selected.value = "";
    resetResults();
  }
  function fromBuilder() {
    try {
      sql.value = buildSql(state.sql).sql;
      view.value = "result";
    } catch (e) {
      notify(
        t(
          "请先在 SQL 处理中准备有效草稿。",
          "Prepare a valid draft in SQL builder first.",
        ),
        true,
      );
    }
  }
  async function download() {
    if (!displayed.value) return;
    try {
      await exportText(
        exportResult(
          displayed.value,
          exportFormat.value,
          profile.value?.type,
          targetSchema.value,
          targetTable.value,
        ),
        (view.value === "structure" ? "table-structure." : "query-results.") +
          exportFormat.value,
      );
    } catch (e) {
      notify(String(e), true);
    }
  }
  async function afterWrite() {
    result.value = null;
    structure.value = null;
    await refresh();
  }
  async function copyResults(headers: boolean) {
    if (displayed.value) await copy(resultClipboard(displayed.value, headers));
  }
  async function showDemo() {
    if (connected.value || busy.value) return;
    demo.value = true;
    selected.value = "";
    resetResults();
    catalog.value = [{ schema: "demo", name: "orders", type: "TABLE" }];
    sql.value =
      "SELECT order_no, customer, amount\nFROM demo.orders\nLIMIT 200;";
    await nextTick();
    result.value = {
      columns: ["order_no", "customer", "amount"],
      rows: [
        ["DEMO-001", t("示例客户 A", "Sample customer A"), "1280.00"],
        ["DEMO-002", t("示例客户 B", "Sample customer B"), "360.50"],
        ["DEMO-003", null, "99.00"],
      ],
      elapsedMs: 0,
      truncated: false,
    };
    view.value = "result";
  }
  onUnmounted(() => {
    disposed = true;
    off?.();
    password.value = "";
    formPassword.value = "";
    if (selected.value && desktop)
      invoke("db:disconnect", { id: selected.value }).catch(() => {});
  });
  return {
    displayPage,
    pageSize,
    catalogPage,
    catalogSize,
    changePage,
    resizePage,
    resizeCatalog,
    afterWrite,
    rememberPassword,
    secretSaved,
    forgetPassword,
    exportFormat,
    copyResults,
    targetSchema,
    targetTable,
    selected,
    connected,
    busy,
    error,
    password,
    search,
    sql,
    demo,
    result,
    structure,
    catalog,
    catalogTruncated,
    table,
    view,
    editing,
    dialogEl,
    testMessage,
    form,
    formPassword,
    profile,
    profiles,
    schemas,
    displayed,
    select,
    add,
    edit,
    closeDialog,
    changeType,
    pickFile,
    save,
    test,
    refresh,
    connect,
    disconnect,
    openTable,
    run,
    cancel,
    remove,
    fromBuilder,
    download,
    showDemo,
  };
}
