<script setup lang="ts">
import { ArrowRight, Copy, Download, FileCode2, Info } from "lucide-vue-next";
import AppSelect from "../components/AppSelect.vue";
import { state, t, copy } from "../lib/store";
import { useSqlBuilder } from "../lib/useSqlBuilder";
import "../sql.css";
const { result, error, stats, generate, example, download } = useSqlBuilder();
const placeholderHint = "IN ({{values}})";
</script>

<template>
  <div
    class="page sql-page"
    @keydown.ctrl.enter.prevent="generate"
    @keydown.meta.enter.prevent="generate"
  >
    <div class="page-heading">
      <div>
        <div class="eyebrow">SQL / IN BUILDER</div>
        <h1>{{ t("SQL 处理", "SQL builder") }}</h1>
        <p>
          {{
            t(
              "粘贴 SQL 和单号，把逐行数据变成可复制的 IN 条件。",
              "Paste a SQL template and your IDs. Get a ready-to-copy IN clause.",
            )
          }}
        </p>
      </div>
      <div class="sql-actions">
        <button class="button" @click="example">
          <FileCode2 :size="18" />{{ t("载入订单示例", "Load order example") }}
        </button>
        <button
          class="button primary"
          @click="generate"
          aria-keyshortcuts="Control+Enter Meta+Enter"
        >
          <ArrowRight :size="18" />{{ t("生成 SQL", "Generate SQL") }}
        </button>
      </div>
    </div>
    <div v-if="error" class="error-banner" role="alert">
      <Info :size="18" /><span>{{ error }}</span>
    </div>
    <div class="sql-workspace">
      <div class="sql-inputs">
        <section class="panel editor-panel">
          <div class="panel-heading">
            <h2>
              <label for="sql-template">{{
                t("1. SQL 模板", "1. SQL template")
              }}</label>
            </h2>
          </div>
          <textarea
            id="sql-template"
            v-model="state.sql.template"
            class="code-input sql-template"
            spellcheck="false"
            :aria-label="t('SQL 模板', 'SQL template')"
            aria-describedby="sql-template-help"
            placeholder="SELECT * FROM orders WHERE id IN ({{values}});"
          />
          <p id="sql-template-help" class="sql-hint">
            {{ t("把填充值的位置写成", "Mark the insertion point with") }}
            <code v-text="placeholderHint"></code
            >{{
              t(
                "；也支持以 IN、IN ''、IN () 结尾。",
                "; a template ending in IN, IN '' or IN () works too.",
              )
            }}
          </p>
        </section>
        <section class="panel editor-panel">
          <div class="panel-heading">
            <h2>
              <label for="sql-values">{{
                t("2. 单号 / 值列表", "2. IDs / values")
              }}</label>
            </h2>
            <span class="hint"
              >{{ stats?.total ?? "—" }} {{ t("个值", "values") }}</span
            >
          </div>
          <textarea
            id="sql-values"
            v-model="state.sql.input"
            class="code-input sql-values"
            spellcheck="false"
            :aria-label="t('单号列表', 'ID list')"
            aria-describedby="sql-values-help"
            :placeholder="
              t(
                '每行一个单号，不需要加引号或逗号。\n\nT2214-260921004\nT2235-260920001\n00001234',
                'One ID per line; no quotes or commas needed.\n\nT2214-260921004\nT2235-260920001\n00001234',
              )
            "
          />
          <div class="sql-options">
            <div class="sql-separator">
              <span class="hint">{{
                t("输入分隔方式", "Input separator")
              }}</span>
              <AppSelect
                v-model="state.sql.separator"
                :aria-label="t('单号分隔方式', 'ID separator')"
                :options="[
                  {
                    value: 'lines',
                    label: t('每行一个（推荐）', 'One per line (recommended)'),
                  },
                  {
                    value: 'auto',
                    label: t('换行 / 逗号 / Tab / |', 'Line / comma / tab / |'),
                  },
                ]"
              />
            </div>
            <label class="sql-dedupe"
              ><input type="checkbox" v-model="state.sql.dedupe" />{{
                t("去除重复项", "Remove duplicates")
              }}<span v-if="stats?.duplicates"
                >({{ stats.duplicates }})</span
              ></label
            >
          </div>
          <p id="sql-values-help" class="sql-hint">
            {{
              t(
                "忽略空行及首尾空白，保留顺序、前导零和长编号；单引号自动转换为 SQL 双单引号。",
                "Blank lines and outer whitespace are ignored. Order, leading zeros and long IDs are preserved; single quotes are doubled for SQL.",
              )
            }}
          </p>
        </section>
      </div>
      <section class="panel editor-panel sql-result">
        <div class="panel-heading">
          <h2>
            <label for="sql-output">{{
              t("3. 生成结果", "3. Generated SQL")
            }}</label>
          </h2>
          <div class="sql-actions">
            <button class="button" :disabled="!result" @click="download">
              <Download :size="17" />{{ t("导出 .sql", "Export .sql") }}
            </button>
            <button
              class="button primary"
              :disabled="!result"
              @click="copy(result!.sql)"
            >
              <Copy :size="17" />{{ t("复制 SQL", "Copy SQL") }}
            </button>
          </div>
        </div>
        <textarea
          id="sql-output"
          :value="result?.sql ?? ''"
          readonly
          class="code-input sql-output"
          spellcheck="false"
          :aria-label="t('生成的 SQL', 'Generated SQL')"
          :placeholder="
            t(
              '生成结果会显示在这里。\n\n1. 检查左侧 SQL 模板\n2. 粘贴单号列表\n3. 点击「生成 SQL」\n\n修改输入后会清空旧结果，避免复制过期 SQL。',
              'Your SQL will appear here.\n\n1. Check the SQL template\n2. Paste your list of IDs\n3. Select Generate SQL\n\nEditing an input clears the old output to prevent copying stale SQL.',
            )
          "
        />
        <div class="editor-footer" role="status">
          <span v-if="result"
            >{{ t("已生成", "Generated") }} {{ result.count }}
            {{ t("个值", "values")
            }}<template v-if="state.sql.dedupe && result.duplicates">
              · {{ t("已去重", "Removed duplicates:") }}
              {{ result.duplicates }}</template
            ></span
          >
          <span v-else>{{
            t(
              "等待生成 · Ctrl+Enter 快捷生成 · 草稿自动保存",
              "Ctrl+Enter to generate · Draft saved locally",
            )
          }}</span>
        </div>
      </section>
    </div>
    <p v-if="result?.normalizedIdentifier" class="sql-notice" role="status">
      {{
        t(
          "已将表名等 SQL 标识符中的 下划线前的 Markdown 转义反斜杠去掉；单号原文不会这样替换。",
          "Removed Markdown underscore escapes from unquoted SQL identifiers; ID values are not rewritten this way.",
        )
      }}
    </p>
    <p class="sql-safety">
      <Info :size="17" /><span>{{
        t(
          "仅在本地生成文本，不连接或执行数据库。请核对表名、字段和结果；大量值请按数据库限制自行分批，执行前仍需检查 SQL。",
          "Local text generation only: no database connection or execution. Review names and output; split large lists according to your database limits before running SQL.",
        )
      }}</span>
    </p>
  </div>
</template>
