<script setup lang="ts">
import AppSelect from "../components/AppSelect.vue";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import Papa from "papaparse";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  Upload,
  Download,
  FileSpreadsheet,
  ChartNoAxesCombined,
  Maximize,
  Database,
  Hash,
  TrendingUp,
  Trash2,
} from "lucide-vue-next";
import { state, t, openText, exportText, notify, used } from "../lib/store";
echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  CanvasRenderer,
]);
const chartEl = ref<HTMLElement>();
const pageEl = ref<HTMLElement>();
let chart: echarts.ECharts | undefined;
let observer: ResizeObserver | undefined;
const error = ref("");
const savingTemplate = ref(false);
const templateHeaders = computed(() => [
  t("日期", "date"),
  t("订单数", "orders"),
]);
const templateRows = [
  ["2026-09-01", "120"],
  ["2026-09-02", "156"],
  ["2026-09-03", "98"],
];
async function downloadTemplate() {
  savingTemplate.value = true;
  try {
    const csv =
      "\uFEFF" +
      Papa.unparse([templateHeaders.value, ...templateRows], {
        newline: "\r\n",
      });
    const result = await exportText(
      csv,
      t("轻匣-数据看板模板.csv", "LiteBox-dashboard-template.csv"),
    );
    if (result?.saved)
      notify(
        t(
          "模板已保存，请替换示例数据后导入",
          "Template saved. Replace the example rows before importing.",
        ),
      );
  } catch (e) {
    error.value = String(e);
  } finally {
    savingTemplate.value = false;
  }
}
const parsed = computed(() =>
  Papa.parse<Record<string, string>>(state.dashboard.csv, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  }),
);
const fields = computed(() => parsed.value.meta.fields || []);
const rows = computed(() => parsed.value.data);
const points = computed(() => {
  const map = new Map<string, number>();
  for (const row of rows.value) {
    const raw = row[state.dashboard.y]?.trim();
    if (!raw) continue;
    const number = Number(raw);
    if (!Number.isFinite(number)) continue;
    const key = row[state.dashboard.x] || t("未命名", "Untitled");
    map.set(key, (map.get(key) || 0) + number);
  }
  return [...map].slice(0, 500);
});
const validCount = computed(
  () =>
    rows.value.filter(
      (r) =>
        r[state.dashboard.y]?.trim() &&
        Number.isFinite(Number(r[state.dashboard.y])),
    ).length,
);
const total = computed(() =>
  rows.value.reduce(
    (sum, r) =>
      sum +
      (r[state.dashboard.y]?.trim() &&
      Number.isFinite(Number(r[state.dashboard.y]))
        ? Number(r[state.dashboard.y])
        : 0),
    0,
  ),
);
const numericFields = computed(() =>
  fields.value.filter((f) =>
    rows.value.some((r) => r[f]?.trim() && Number.isFinite(Number(r[f]))),
  ),
);
async function load() {
  try {
    const file = await openText(["csv"]);
    if (!file) return;
    const result = Papa.parse(file.text, {
      header: true,
      skipEmptyLines: "greedy",
    });
    if (result.errors.length) throw new Error(result.errors[0]?.message);
    if ((result.meta.fields?.length || 0) < 2)
      throw new Error(
        t(
          "至少需要两列数据：分类和数值。",
          "At least two columns are required: category and value.",
        ),
      );
    state.dashboard.csv = file.text;
    state.dashboard.name = file.name;
    state.dashboard.x = fields.value[0] || "";
    state.dashboard.y =
      numericFields.value.find((f) => f !== state.dashboard.x) ||
      numericFields.value[0] ||
      "";
    error.value = "";
    used("dashboard");
  } catch (e) {
    error.value = String(e);
  }
}
async function render() {
  await nextTick();
  if (!chartEl.value || !rows.value.length) return;
  if (!chart) chart = echarts.init(chartEl.value);
  const dark = state.theme === "dark";
  chart.setOption(
    {
      backgroundColor: "transparent",
      animationDuration: 250,
      tooltip: {
        trigger: "axis",
        renderMode: "richText",
        backgroundColor: dark ? "#19191b" : "#ffffff",
        borderColor: dark ? "#515159" : "#b7c3d5",
        textStyle: { color: dark ? "#f1f1f3" : "#172133", fontSize: 15 },
      },
      grid: { left: 65, right: 25, top: 25, bottom: 65 },
      xAxis: {
        type: "category",
        data: points.value.map((p) => p[0]),
        axisLine: { lineStyle: { color: dark ? "#38383d" : "#d8e0ec" } },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 14,
          color: dark ? "#c4c4ce" : "#536176",
          rotate: points.value.length > 12 ? 30 : 0,
        },
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 14, color: dark ? "#c4c4ce" : "#536176" },
        splitLine: {
          lineStyle: { color: dark ? "#303034" : "#e9edf4", type: "dashed" },
        },
      },
      series: [
        {
          type: state.dashboard.type === "line" ? "line" : "bar",
          data: points.value.map((p) => p[1]),
          barMaxWidth: 46,
          smooth: false,
          itemStyle: {
            color: dark ? "#79adff" : "#165dce",
            borderRadius: state.dashboard.type === "line" ? 0 : [4, 4, 0, 0],
          },
          areaStyle:
            state.dashboard.type === "line"
              ? { color: "rgba(57,119,92,.08)" }
              : undefined,
        },
      ],
    },
    true,
  );
  chart.resize();
}
function resize() {
  chart?.resize();
}
onMounted(() => {
  render();
  observer = new ResizeObserver(resize);
  if (chartEl.value) observer.observe(chartEl.value);
  window.addEventListener("resize", resize);
});
watch(
  () => [
    state.dashboard.csv,
    state.dashboard.x,
    state.dashboard.y,
    state.dashboard.type,
    state.theme,
    state.locale,
  ],
  () => render(),
);
onUnmounted(() => {
  observer?.disconnect();
  chart?.dispose();
  window.removeEventListener("resize", resize);
});
function full() {
  if (document.fullscreenElement) document.exitFullscreen();
  else pageEl.value?.requestFullscreen().catch((e) => notify(String(e), true));
}
</script>
<template>
  <div ref="pageEl" class="page dashboard-page">
    <div class="page-heading">
      <div>
        <div class="eyebrow">DATA / VISUALIZE</div>
        <h1>{{ t("数据看板", "Data dashboard") }}</h1>
        <p>
          {{
            t(
              "导入自己的 CSV，选择字段，让数据清楚地说话。",
              "Import your CSV, choose fields, and let your data tell the story.",
            )
          }}
        </p>
      </div>
      <div class="toolbar">
        <button
          v-if="state.dashboard.csv"
          class="button"
          :disabled="savingTemplate"
          @click="downloadTemplate"
        >
          <Download :size="20" />{{
            t("下载 CSV 模板", "Download CSV template")
          }}
        </button>
        <button class="button" @click="full">
          <Maximize :size="16" />{{ t("全屏大屏", "Full screen") }}</button
        ><button class="button primary" @click="load">
          <Upload :size="20" :stroke-width="2" />{{
            t("导入 CSV", "Import CSV")
          }}
        </button>
      </div>
    </div>
    <div v-if="error" class="error-banner" role="alert">{{ error }}</div>
    <div v-if="!state.dashboard.csv" class="panel dashboard-empty">
      <div class="empty-state">
        <div class="empty-symbol large">
          <ChartNoAxesCombined :size="39" :stroke-width="1.4" />
        </div>
        <h2>
          {{
            t(
              "好看的图表，从真实数据开始。",
              "Good charts start with real data.",
            )
          }}
        </h2>
        <p>
          {{
            t(
              "上传一份包含表头的 CSV，选择分类列与数值列。",
              "Import a CSV with headers, then choose a category and numeric column.",
            )
          }}<br />{{
            t(
              "同一分类自动求和。不连接外部服务，不展示虚构指标。",
              "Values are summed by category. No external service. No invented metrics.",
            )
          }}
        </p>
        <div class="csv-actions">
          <button class="button primary" @click="load">
            <Upload :size="20" :stroke-width="2" />{{
              t("选择 CSV 文件", "Choose a CSV file")
            }}
          </button>
          <button
            class="button"
            :disabled="savingTemplate"
            @click="downloadTemplate"
          >
            <Download :size="20" />{{
              t("下载 CSV 模板", "Download CSV template")
            }}
          </button>
        </div>
        <p class="csv-local-note">
          {{
            t(
              "文件只在本机读取，不会上传到服务器。",
              "Files are read locally, never uploaded to a server.",
            )
          }}
        </p>
      </div>
    </div>
    <details class="panel csv-guide" :open="!state.dashboard.csv">
      <summary>
        <FileSpreadsheet :size="20" />{{
          t("模板与填写说明", "Template & file requirements")
        }}
      </summary>
      <div class="csv-guide-body">
        <div>
          <h2>
            {{ t("照着这 3 步就能导入", "Import in three simple steps") }}
          </h2>
          <ol>
            <li>
              {{
                t(
                  "下载模板，用 Excel、WPS 或文本编辑器打开。",
                  "Download the template and open it in Excel, WPS or a text editor.",
                )
              }}
            </li>
            <li>
              {{
                t(
                  "保留第一行表头，用自己的数据替换下面的示例行，每行一条记录。",
                  "Keep the header row and replace the examples with your own data, one record per row.",
                )
              }}
            </li>
            <li>
              {{
                t(
                  "另存为 CSV UTF-8（逗号分隔），再点击「选择 CSV 文件」。文件不超过 5 MB。",
                  "Save as CSV UTF-8 (comma delimited), then choose the file. Maximum size: 5 MB.",
                )
              }}
            </li>
          </ol>
          <p>
            {{
              t(
                "至少两列：分类列（日期、店铺、产品等）＋数值列（订单数、金额等）。列名可修改；导入后可自行选择字段。",
                "Use at least two columns: a category (date, store, product) and a numeric value (orders, amount). Headers can be renamed; choose the columns after importing.",
              )
            }}
          </p>
          <p>
            {{
              t(
                "数值请填纯数字，例如 120 或 99.5，不要带「元」「单」或千位逗号；空值和非数字会跳过，同一分类会求和。",
                "Use plain numbers such as 120 or 99.5, without units or thousands separators. Blank/non-numeric values are skipped; matching categories are summed.",
              )
            }}
          </p>
        </div>
        <div class="csv-example">
          <table>
            <caption>
              {{
                t("模板内容预览 · 示例数据", "Template preview · example data")
              }}
            </caption>
            <thead>
              <tr>
                <th v-for="header in templateHeaders" :key="header" scope="col">
                  {{ header }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in templateRows" :key="row[0]">
                <td v-for="(cell, index) in row" :key="index">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
          <p>
            {{
              t(
                "模板中的日期和数量仅作演示，请全部替换为你的实际数据。",
                "Dates and quantities are examples only. Replace all of them with your actual data.",
              )
            }}
          </p>
          <p>
            {{
              t(
                "按此模板导入：分类字段选「日期」，数值字段选「订单数」。",
                'For this template, select "date" as the category and "orders" as the value.',
              )
            }}
          </p>
        </div>
      </div>
    </details>
    <template v-if="state.dashboard.csv"
      ><div class="panel dashboard-controls">
        <label
          >{{ t("分类字段", "Category")
          }}<AppSelect
            v-model="state.dashboard.x"
            :options="fields.map((field) => ({ value: field, label: field }))"
            :aria-label="t('分类维度', 'Category column')" /></label
        ><label
          >{{ t("数值字段（求和）", "Value (sum)")
          }}<AppSelect
            v-model="state.dashboard.y"
            :options="[
              {
                value: '',
                label: t('选择数值列', 'Select a numeric column'),
                disabled: true,
              },
              ...numericFields.map((field) => ({ value: field, label: field })),
            ]"
            :aria-label="t('数值指标', 'Numeric column')" /></label
        ><label
          >{{ t("图表类型", "Chart type")
          }}<AppSelect
            v-model="state.dashboard.type"
            :options="[
              { value: 'bar', label: t('柱状图', 'Bar chart') },
              { value: 'line', label: t('折线图', 'Line chart') },
            ]"
            :aria-label="t('图表类型', 'Chart type')"
        /></label>
        <div class="dataset-label">
          <Database :size="17" /><span>{{ state.dashboard.name }}</span
          ><button
            class="icon-button"
            :aria-label="t('清除数据', 'Clear dataset')"
            @click="state.dashboard.csv = ''"
          >
            <Trash2 :size="15" />
          </button>
        </div>
      </div>
      <div class="metric-grid">
        <div class="panel metric-card">
          <span>{{ t("数据行数", "Total rows") }}<Database :size="18" /></span
          ><strong>{{ rows.length.toLocaleString() }}</strong
          ><small>{{ t("来自导入文件", "From your imported file") }}</small>
        </div>
        <div class="panel metric-card">
          <span>{{ t("数值合计", "Value total") }}<Hash :size="18" /></span
          ><strong>{{
            total.toLocaleString(undefined, { maximumFractionDigits: 2 })
          }}</strong
          ><small>{{ state.dashboard.y || "—" }}</small>
        </div>
        <div class="panel metric-card">
          <span
            >{{ t("有效数值 / 跳过", "Valid / skipped values")
            }}<TrendingUp :size="18" /></span
          ><strong
            >{{ validCount }}
            <small>/ {{ rows.length - validCount }}</small></strong
          ><small>{{
            t(
              "空值及非数字不会计入",
              "Blank and non-numeric values are excluded",
            )
          }}</small>
        </div>
      </div></template
    >
    <section v-show="state.dashboard.csv" class="panel chart-panel">
      <div class="panel-heading">
        <h2>
          {{ state.dashboard.y }}
          <span class="muted">/ {{ state.dashboard.x }}</span>
        </h2>
        <span class="tag">{{
          t(
            "同类求和 · 最多显示 500 类",
            "Sum by category · first 500 categories",
          )
        }}</span>
      </div>
      <div ref="chartEl" class="chart-canvas"></div>
    </section>
    <section v-if="state.dashboard.csv" class="panel data-table-panel">
      <div class="panel-heading">
        <h2>{{ t("原始数据预览", "Source preview") }}</h2>
        <span class="muted small">{{ t("前 20 行", "First 20 rows") }}</span>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th v-for="field in fields" :key="field">{{ field }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in rows.slice(0, 20)" :key="index">
              <td v-for="field in fields" :key="field">{{ row[field] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
