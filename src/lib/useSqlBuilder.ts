import { computed, ref, watch } from "vue";
import {
  buildSql,
  parseSqlValues,
  SqlInputError,
  SQL_TEMPLATE,
  SQL_EXAMPLE_IDS,
  type SqlErrorCode,
} from "./sql";
import { state, t, used, exportText, notify } from "./store";
import { askConfirm } from "./confirm";

export function useSqlBuilder() {
  const result = ref<ReturnType<typeof buildSql> | null>(null);
  const errorCode = ref<SqlErrorCode | "">("");
  const errors = computed<Record<SqlErrorCode, string>>(() => ({
    emptyValues: t(
      "请先粘贴单号，每行一个；空行会自动忽略。",
      "Paste your IDs first, one per line. Blank lines are ignored.",
    ),
    tooLarge: t(
      "内容过大：单号文本最多约 100 万字符，SQL 模板最多 10 万字符。",
      "Too much text: up to 1M characters for IDs and 100,000 for the template.",
    ),
    tooMany: t(
      "一次最多处理 50,000 个值，请分批生成。",
      "Use at most 50,000 values at a time. Split larger inputs into batches.",
    ),
    unsafeValue: t(
      "单号中包含反斜杠或控制字符。不同数据库的处理不同，请先移除或核对；不会猜测转义规则。",
      "A value contains a backslash or control character. Check it first: escaping depends on the database.",
    ),
    emptyTemplate: t(
      "请填写 SQL 模板，例如 SELECT * FROM orders WHERE id IN ({{values}});",
      "Enter a SQL template, e.g. SELECT * FROM orders WHERE id IN ({{values}});",
    ),
    invalidTemplate: t(
      "模板中存在未闭合的引号或注释，请检查后再生成。",
      "The template has an unclosed quote or comment. Check it before generating.",
    ),
    placeholder: t(
      "请把需要填充的位置写成 IN ({{values}})，且仅保留一个这样的占位符。也支持以 IN、IN '' 或 IN () 结尾的模板；不会覆盖已有条件。",
      "Use exactly one IN ({{values}}) target. Templates ending in IN, IN '' or IN () also work. Existing conditions are never overwritten.",
    ),
  }));
  const error = computed(() =>
    errorCode.value ? errors.value[errorCode.value] : "",
  );
  const stats = computed(() => {
    try {
      const p = parseSqlValues(state.sql.input, state.sql.separator);
      return { total: p.values.length, duplicates: p.duplicates };
    } catch {
      return null;
    }
  });
  function generate() {
    try {
      result.value = buildSql(state.sql);
      errorCode.value = "";
      used("sql");
    } catch (e) {
      result.value = null;
      errorCode.value = e instanceof SqlInputError ? e.code : "invalidTemplate";
    }
  }
  watch(
    () => state.sql,
    () => {
      result.value = null;
      errorCode.value = "";
    },
    { deep: true, flush: "sync" },
  );
  async function example() {
    if (
      (state.sql.input.trim() || state.sql.template !== SQL_TEMPLATE) &&
      !(await askConfirm(
        t(
          "用示例替换当前 SQL 草稿和单号？",
          "Replace the current SQL draft and IDs with the example?",
        ),
        { confirmLabel: t("使用示例", "Use example") },
      ))
    )
      return;
    state.sql = {
      template: SQL_TEMPLATE,
      input: SQL_EXAMPLE_IDS,
      dedupe: false,
      separator: "lines",
    };
    generate();
  }
  async function download() {
    if (!result.value) return;
    try {
      await exportText(result.value.sql, "query.sql");
    } catch (e) {
      notify(String(e), true);
    }
  }
  if (state.sql.input.trim()) {
    try {
      result.value = buildSql(state.sql);
    } catch {
      /* Keep an unfinished draft editable. */
    }
  }
  return { result, error, stats, generate, example, download };
}
