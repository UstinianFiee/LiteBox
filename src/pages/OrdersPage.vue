<script setup lang="ts">
import AppSelect from "../components/AppSelect.vue";
import { computed, ref } from "vue";
import {
  Copy,
  Download,
  Trash2,
  ArrowRight,
  Upload,
  ListFilter,
  Check,
  GitCompareArrows,
} from "lucide-vue-next";
import {
  state,
  t,
  copy,
  exportText,
  openText,
  notify,
  used,
} from "../lib/store";
import { groupOrders, compareSets } from "../lib/tools";
const mode = ref("format");
const other = ref("");
const compareMode = ref("difference");
const result = computed(() => groupOrders(state.order.input, state.order));
const comparison = computed(() =>
  compareSets(state.order.input, other.value, compareMode.value),
);
const visibleCount = ref(50);
async function importFile() {
  try {
    const file = await openText(["txt", "csv"]);
    if (file) state.order.input = file.text;
  } catch (e) {
    notify(String(e), true);
  }
}
function copyAll() {
  copy(
    mode.value === "format"
      ? result.value.groups.map((g) => g.text).join("\n")
      : comparison.value,
  );
  used("orders");
}
</script>
<template>
  <div class="page">
    <div class="page-heading">
      <div>
        <div class="eyebrow">TEXT / BATCH</div>
        <h1>{{ t("文本整理", "Text tidy") }}</h1>
        <p>
          {{
            t(
              "保留前导零与长编号。按你的规则，整理每一批数据。",
              "Keep leading zeros and long IDs intact. Format every batch your way.",
            )
          }}
        </p>
      </div>
      <button class="button" @click="importFile">
        <Upload :size="16" />{{ t("导入文本", "Import text") }}
      </button>
    </div>
    <div class="segmented mb-24">
      <button :class="{ active: mode === 'format' }" @click="mode = 'format'">
        <ListFilter :size="15" />{{
          t("分组与格式化", "Group & format")
        }}</button
      ><button
        :class="{ active: mode === 'compare' }"
        @click="mode = 'compare'"
      >
        <GitCompareArrows :size="15" />{{ t("集合对比", "Compare sets") }}
      </button>
    </div>
    <div class="workspace-grid">
      <section class="panel editor-panel">
        <div class="panel-heading">
          <h2>{{ t("原始数据", "Source data") }}</h2>
          <button
            class="icon-button"
            :aria-label="t('清空输入', 'Clear input')"
            @click="state.order.input = ''"
          >
            <Trash2 :size="16" />
          </button>
        </div>
        <textarea
          class="code-input source-text"
          v-model="state.order.input"
          :aria-label="t('文本输入', 'Source text')"
          :placeholder="
            t(
              '在这里粘贴编号、名单或其他文本…\n\n支持从 Excel 复制一列，或粘贴以换行、逗号、空格分隔的文本。\n\n001234567890\n001234567891\n001234567892',
              'Paste IDs, names or other text here…\n\nCopy a column from Excel, or paste IDs separated by lines, commas or spaces.\n\n001234567890\n001234567891\n001234567892',
            )
          "
          spellcheck="false"
        />
        <div class="editor-footer">
          <span>{{ result.rawCount }} {{ t("条记录", "records") }}</span
          ><span>{{ result.duplicates }} {{ t("条重复", "duplicates") }}</span>
        </div>
      </section>
      <section class="panel output-panel">
        <div class="panel-heading">
          <h2>
            {{
              mode === "format"
                ? t("处理结果", "Output")
                : t("对比结果", "Comparison")
            }}
          </h2>
          <button
            class="button small-button"
            :disabled="!state.order.input"
            @click="copyAll"
          >
            <Copy :size="14" />{{ t("复制全部", "Copy all") }}
          </button>
        </div>
        <template v-if="mode === 'format'"
          ><div v-if="!result.groups.length" class="empty-state">
            <ListFilter :size="36" :stroke-width="1.2" />
            <h3>
              {{
                t("下一批数据，整整齐齐", "Your next batch, neatly arranged")
              }}
            </h3>
            <p>
              {{
                t(
                  "粘贴文本，分组结果会实时出现在这里。",
                  "Paste text to see your grouped output here.",
                )
              }}
            </p>
          </div>
          <div v-else class="group-list">
            <div
              v-for="(group, index) in result.groups.slice(0, visibleCount)"
              :key="index"
              class="result-group"
            >
              <div>
                <span
                  >{{ t("第", "Group ") }}{{ index + 1 }}{{ t(" 组", "") }}
                  <small>{{ group.count }} {{ t("条", "items") }}</small></span
                ><button
                  class="icon-button"
                  :aria-label="t('复制本组', 'Copy group') + (index + 1)"
                  @click="
                    copy(group.text);
                    used('orders');
                  "
                >
                  <Copy :size="14" />
                </button>
              </div>
              <pre>{{ group.text }}</pre>
            </div>
            <button
              v-if="result.groups.length > visibleCount"
              class="button"
              @click="visibleCount += 50"
            >
              {{ t("显示更多分组", "Show more groups") }}
            </button>
          </div></template
        ><textarea
          v-else
          class="code-input source-text"
          readonly
          :value="comparison"
          :aria-label="t('对比结果', 'Comparison result')"
        />
        <div class="editor-footer">
          <span>{{
            mode === "format"
              ? result.groups.length + " " + t("个分组", "groups")
              : t("保持原始顺序", "Original order preserved")
          }}</span
          ><button
            class="text-button"
            :disabled="!state.order.input"
            @click="
              exportText(
                mode === 'format'
                  ? result.groups.map((g) => g.text).join('\n')
                  : comparison,
                'text-tidy.txt',
              ).catch((e) => notify(String(e), true))
            "
          >
            <Download :size="14" />{{ t("导出 TXT", "Export TXT") }}
          </button>
        </div>
      </section>
    </div>
    <section v-if="mode === 'format'" class="panel options-panel">
      <h2>{{ t("处理规则", "Formatting rules") }}</h2>
      <div class="form-grid">
        <label
          >{{ t("输入分隔方式", "Input separator")
          }}<AppSelect
            v-model="state.order.split"
            :options="[
              { value: 'auto', label: t('自动识别', 'Auto detect') },
              { value: 'lines', label: t('按换行', 'Line breaks') },
              { value: 'comma', label: t('逗号与换行', 'Commas & lines') },
              { value: 'pipe', label: t('竖线与换行', 'Pipes & lines') },
            ]"
            :aria-label="t('识别分隔符', 'Input separator')" /></label
        ><label
          >{{ t("分组方式", "Grouping")
          }}<AppSelect
            v-model="state.order.mode"
            :options="[
              { value: 'size', label: t('每组固定数量', 'IDs per group') },
              { value: 'groups', label: t('平均分成几组', 'Number of groups') },
            ]"
            :aria-label="t('分组方式', 'Grouping mode')" /></label
        ><label
          >{{
            state.order.mode === "size"
              ? t("每组条数", "Group size")
              : t("分组数量", "Group count")
          }}<input
            v-model.number="state.order.size"
            type="number"
            min="1"
            max="100000" /></label
        ><label
          >{{ t("输出分隔符", "Output separator")
          }}<input
            v-model="state.order.delimiter"
            maxlength="20"
            placeholder="|" /></label
        ><label
          >{{ t("文本包裹", "Wrap items")
          }}<AppSelect
            v-model="state.order.quote"
            :options="[
              { value: '', label: t('不添加', 'None') },
              {
                value: String.fromCharCode(39),
                label: t('单引号', 'Single quotes'),
              },
              { value: '&quot;', label: t('双引号', 'Double quotes') },
            ]"
            :aria-label="t('添加引号', 'Quote style')" /></label
        ><label class="checkbox-label"
          ><input type="checkbox" v-model="state.order.dedupe" />{{
            t("去除重复项", "Remove duplicates")
          }}</label
        >
      </div>
      <div class="hint">
        <Check :size="14" />{{
          t(
            "仅在本地处理 · 自动去除空行和首尾空白 · 默认保留顺序与重复项",
            "Local only · Trims whitespace and empty lines · Preserves order and duplicates by default",
          )
        }}
      </div>
    </section>
    <section v-else class="panel options-panel">
      <div class="panel-heading">
        <h2>{{ t("另一份数据 B", "Second set B") }}</h2>
        <AppSelect
          v-model="compareMode"
          :options="[
            {
              value: 'difference',
              label: t('A 中有，B 中没有', 'In A, not in B'),
            },
            {
              value: 'intersection',
              label: t('A 与 B 的交集', 'Intersection of A and B'),
            },
          ]"
          :aria-label="t('对比方式', 'Comparison mode')"
        />
      </div>
      <textarea
        v-model="other"
        class="code-input"
        rows="6"
        :aria-label="t('数据 B', 'Set B')"
        :placeholder="t('粘贴另一批文本', 'Paste the second batch of text')"
      />
    </section>
  </div>
</template>
