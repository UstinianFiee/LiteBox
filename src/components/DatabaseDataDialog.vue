<script setup lang="ts">
import { ref, nextTick } from "vue";
import { Upload, X, Download, AlertTriangle } from "lucide-vue-next";
import AppSelect from "./AppSelect.vue";
import { t, desktop, invoke, openText, exportText } from "../lib/store";
import { parseImport, parseDataJson } from "../lib/database-transfer";
import type { DatabaseProfile } from "../lib/types";
const props = defineProps<{
  profile?: DatabaseProfile;
  schema: string;
  table: string;
  connected: boolean;
}>();
const emit = defineEmits<{ applied: [] }>();
const dialog = ref<HTMLDialogElement>();
const action = ref("insert");
const schema = ref("");
const target = ref("");
const values = ref('[\n  {"name": "example"}\n]');
const filter = ref('{"id": "1"}');
const error = ref("");
const status = ref("");
const busy = ref(false);
const checked = ref(false);
const preview = ref<Record<string, unknown>[]>([]);
const filename = ref("");
async function open(mode = "insert") {
  action.value = mode;
  schema.value =
    props.schema ||
    (props.profile?.type === "postgres"
      ? "public"
      : props.profile?.type === "sqlite"
        ? "main"
        : props.profile?.type === "oracle"
          ? props.profile.username.toUpperCase()
          : props.profile?.type === "redis"
            ? props.profile.database || "0"
            : props.profile?.database || "test");
  target.value = props.table;
  values.value =
    props.profile?.type === "redis"
      ? '[{"value":"text"}]'
      : '[{"name":"example"}]';
  filter.value =
    props.profile?.type === "redis"
      ? JSON.stringify({ key: target.value }, null, 2)
      : '{"id":"1"}';
  error.value = "";
  status.value = "";
  preview.value = [];
  filename.value = "";
  checked.value = false;
  await nextTick();
  dialog.value?.showModal();
}
function close() {
  if (!busy.value) dialog.value?.close();
}
async function importFile() {
  try {
    const file = await openText(["csv", "tsv", "json"]);
    if (!file) return;
    const records = parseImport(file.text, file.name);
    preview.value = records;
    values.value = JSON.stringify(records, null, 2);
    filename.value = file.name;
    action.value = "insert";
    error.value = "";
  } catch (e) {
    error.value = String(e);
  }
}
async function template() {
  await exportText(
    JSON.stringify([{ id: "example-001", name: "example" }], null, 2),
    "database-import-template.json",
  );
}
function changeAction() {
  values.value =
    props.profile?.type === "redis"
      ? action.value === "insert"
        ? '[{"value":"text"}]'
        : '{"value":"updated"}'
      : action.value === "insert"
        ? '[{"name":"example"}]'
        : '{"name":"updated"}';
  preview.value = [];
}
async function submit() {
  if (
    !desktop ||
    !props.connected ||
    !props.profile ||
    busy.value ||
    !checked.value
  )
    return;
  error.value = "";
  status.value = "";
  try {
    const data = {
      action: action.value,
      schema: schema.value,
      table: target.value,
      records:
        action.value === "insert" ? parseDataJson(values.value) : undefined,
      values:
        action.value === "update" ? parseDataJson(values.value) : undefined,
      where:
        action.value !== "insert" ? parseDataJson(filter.value) : undefined,
    };
    busy.value = true;
    const result = await invoke("db:mutate", { id: props.profile.id, data });
    if (result.cancelled) {
      status.value = t(
        "已取消，未提交写入。",
        "Canceled; no write was submitted.",
      );
      return;
    }
    status.value =
      t("写入已提交，影响行数：", "Write committed. Affected rows: ") +
      result.rows[0][0];
    checked.value = false;
    emit("applied");
  } catch (e) {
    error.value = String(e);
  } finally {
    busy.value = false;
  }
}
defineExpose({ open });
</script>
<template>
  <dialog
    ref="dialog"
    class="modal db-modal db-data-modal"
    aria-labelledby="db-data-title"
    @cancel.prevent="close"
  >
    <form @submit.prevent="submit">
      <div class="panel-heading">
        <div>
          <span class="db-dialog-eyebrow">DATA WORKSPACE</span>
          <h2 id="db-data-title">
            {{ t("数据编辑与导入", "Edit & import data") }}
          </h2>
        </div>
        <button
          type="button"
          class="icon-button"
          :disabled="busy"
          :aria-label="t('关闭', 'Close')"
          @click="close"
        >
          <X :size="20" />
        </button>
      </div>
      <div class="modal-body form-grid two-columns">
        <p class="hint span-two">
          {{
            t(
              "关系型数据库使用参数化写入，一批最多 500 行。MongoDB / Redis 每次一条；MongoDB 支持 Extended JSON，Redis 仅写入字符串键。",
              "SQL writes use bound parameters, up to 500 rows. MongoDB / Redis: one record per write. MongoDB accepts Extended JSON; Redis writes string keys only.",
            )
          }}
        </p>
        <label
          >{{ t("操作", "Action")
          }}<AppSelect
            v-model="action"
            :disabled="busy"
            :options="[
              { value: 'insert', label: t('新增 / 导入', 'Insert / import') },
              { value: 'update', label: t('修改', 'Update') },
              { value: 'delete', label: t('删除', 'Delete') },
            ]"
            @change="changeAction"
        /></label>
        <label
          >{{ t("Schema / 数据库", "Schema / database")
          }}<input v-model="schema" required :disabled="busy"
        /></label>
        <label class="span-two"
          >{{ t("目标表 / 集合 / 键", "Target table / collection / key")
          }}<input v-model="target" autofocus required :disabled="busy"
        /></label>
        <div v-if="action === 'insert'" class="toolbar span-two">
          <button
            class="button"
            type="button"
            :disabled="busy"
            @click="importFile"
          >
            <Upload :size="17" />{{
              t("导入 CSV / TSV / JSON", "Import CSV / TSV / JSON")
            }}</button
          ><button
            class="button"
            type="button"
            :disabled="busy"
            @click="template"
          >
            <Download :size="17" />{{ t("下载示例模板", "Example template") }}
          </button>
        </div>
        <p v-if="action === 'insert'" class="hint span-two">
          {{
            t(
              "模板仅供参考，请将字段名改为目标表真实字段。CSV / TSV 首行为列名，空白保留为空字符串；JSON 可表达 null。导入只做预览，点击提交并再次确认后才写入。",
              "Adapt template fields to your target. CSV / TSV requires headers; blanks stay empty strings. JSON supports null. Import only previews; writing requires submit and confirmation.",
            )
          }}
        </p>
        <div v-if="preview.length" class="db-import-preview span-two">
          <strong
            >{{ filename }} · {{ preview.length }}
            {{ t("条待导入", "records to import") }}</strong
          >
          <pre>{{ JSON.stringify(preview.slice(0, 3), null, 2) }}</pre>
          <span class="hint">{{
            t(
              "预览前 3 条；下方 JSON 可继续编辑。",
              "First 3 records; edit the JSON below.",
            )
          }}</span>
        </div>
        <label v-if="action !== 'delete'" class="span-two"
          >{{
            action === "insert"
              ? t("记录数组（JSON）", "Records (JSON array)")
              : t("新字段值（JSON 对象）", "New values (JSON object)")
          }}<textarea
            v-model="values"
            class="code-input db-mutation-input"
            spellcheck="false"
            required
            :disabled="busy"
          />
        </label>
        <label v-if="action !== 'insert'" class="span-two"
          >{{
            t(
              "精确匹配条件（非空 JSON 对象）",
              "Exact-match filter (nonempty JSON object)",
            )
          }}<textarea
            v-model="filter"
            class="code-input"
            rows="3"
            spellcheck="false"
            required
            :disabled="busy"
          />
        </label>
        <div class="notice-banner span-two">
          <AlertTriangle :size="18" />{{
            t(
              "写入直接修改真实数据。请先备份并用只读查询核对条件；超时或取消后先核对数据库，不要直接重复提交。",
              "Writes change real data. Back up and verify the filter first. After timeout or cancellation, check the database before retrying.",
            )
          }}
        </div>
        <label class="db-checkbox span-two"
          ><input
            v-model="checked"
            type="checkbox"
            :disabled="!desktop || !connected || busy"
          />{{
            t(
              "我已核对目标及数据，允许本次写入",
              "I verified the target and data; allow this write",
            )
          }}</label
        >
        <p v-if="!desktop || !connected" class="hint span-two">
          {{
            t(
              "当前只能编辑和预览；在桌面端连接数据库后才能提交。",
              "Preview only. Connect in desktop mode to submit.",
            )
          }}
        </p>
        <p v-if="error" class="error-banner span-two" role="alert">
          {{ error }}
        </p>
        <p v-if="status" class="notice-banner span-two" role="status">
          {{ status }}
        </p>
      </div>
      <div class="modal-footer">
        <button class="button" type="button" :disabled="busy" @click="close">
          {{ t("关闭", "Close") }}</button
        ><button
          class="button primary"
          :disabled="!checked || busy || !desktop || !connected"
        >
          {{
            busy ? t("处理中…", "Working…") : t("审核并提交", "Review & submit")
          }}
        </button>
      </div>
    </form>
  </dialog>
</template>
