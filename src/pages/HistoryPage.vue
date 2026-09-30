<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Download, Trash2, Search } from "lucide-vue-next";
import PaginationBar from "../components/PaginationBar.vue";
import AppSelect from "../components/AppSelect.vue";
import {
  activity,
  moduleNames,
  actionNames,
  clearActivity,
} from "../lib/activity";
import { t, state, exportText, notify, desktop } from "../lib/store";
import { askConfirm } from "../lib/confirm";
const moduleFilter = ref("all"),
  status = ref("all"),
  days = ref("all"),
  search = ref(""),
  page = ref(1),
  pageSize = ref(50);
const label = (pair: [string, string]) => pair[state.locale === "zh" ? 0 : 1];
const rows = computed(() =>
  [...activity.records]
    .reverse()
    .filter(
      (r) =>
        (moduleFilter.value === "all" || r.module === moduleFilter.value) &&
        (status.value === "all" || r.status === status.value) &&
        (days.value === "all" ||
          r.at >= Date.now() - Number(days.value) * 86400000) &&
        (label(moduleNames[r.module]) + " " + label(actionNames[r.action]))
          .toLowerCase()
          .includes(search.value.toLowerCase()),
    ),
);
const pageRows = computed(() =>
  rows.value.slice(
    (page.value - 1) * pageSize.value,
    page.value * pageSize.value,
  ),
);
watch([moduleFilter, status, days, search, pageSize], () => {
  page.value = 1;
});
watch(
  () => rows.value.length,
  (n) => {
    page.value = Math.min(
      page.value,
      Math.max(1, Math.ceil(n / pageSize.value)),
    );
  },
);
const statusName = (s: string) =>
  s === "success"
    ? t("成功", "Success")
    : s === "error"
      ? t("失败", "Failed")
      : t("已取消", "Cancelled");
async function download(format: "json" | "csv") {
  try {
    const data = rows.value.map((r) => ({
      time: new Date(r.at).toISOString(),
      module: r.module,
      action: r.action,
      status: r.status,
    }));
    const text =
      format === "json"
        ? JSON.stringify(data, null, 2)
        : "\ufefftime,module,action,status\r\n" +
          data.map((r) => Object.values(r).join(",")).join("\r\n");
    await exportText(
      text,
      `LiteBox-activity-${new Date().toISOString().slice(0, 10)}.${format}`,
    );
  } catch (e) {
    notify(String(e), true);
  }
}
async function clear() {
  if (
    !desktop &&
    !(await askConfirm(
      t(
        "清空全部本机使用日志？不可撤销。",
        "Clear all local history? This cannot be undone.",
      ),
      { danger: true, confirmLabel: t("清空日志", "Clear history") },
    ))
  )
    return;
  try {
    if (await clearActivity()) notify(t("日志已清空", "History cleared"));
  } catch (e) {
    notify(String(e), true);
  }
}
</script>
<template>
  <div class="page activity-page">
    <div class="page-heading">
      <div>
        <div class="eyebrow">ACTIVITY / HISTORY</div>
        <h1>{{ t("历史日志", "Activity history") }}</h1>
        <p>
          {{
            t(
              "查看这个工具箱里发生过的操作，而不是收集你的工作内容。",
              "A record of actions, not a collection of your work content.",
            )
          }}
        </p>
      </div>
      <div class="toolbar">
        <button class="button" @click="download('csv')">
          <Download :size="16" />CSV</button
        ><button class="button" @click="download('json')">JSON</button
        ><button class="button danger" @click="clear">
          <Trash2 :size="16" />{{ t("清空日志", "Clear history") }}
        </button>
      </div>
    </div>
    <p class="notice-banner">
      {{
        t(
          "仅记录时间、模块、动作与结果；不记录密码、私钥、SQL 正文、聊天正文、终端输入或文件内容。保留最近 3000 条，浏览器与桌面日志相互独立。",
          "Only time, module, action and outcome are stored. No credentials, SQL, chat content, terminal input or file content. Keeps the latest 3,000 entries; browser and desktop histories are separate.",
        )
      }}
    </p>
    <div v-if="activity.error" class="error-banner" role="alert">
      {{ activity.error }}
    </div>
    <section class="panel history-panel">
      <div class="history-filters">
        <label
          >{{ t("模块", "Module")
          }}<AppSelect
            v-model="moduleFilter"
            :options="[
              { value: 'all', label: t('全部模块', 'All modules') },
              ...Object.entries(moduleNames).map(([value, name]) => ({
                value,
                label: label(name),
              })),
            ]" /></label
        ><label
          >{{ t("结果", "Outcome")
          }}<AppSelect
            v-model="status"
            :options="[
              { value: 'all', label: t('全部结果', 'All outcomes') },
              ...['success', 'error', 'cancelled'].map((value) => ({
                value,
                label: statusName(value),
              })),
            ]" /></label
        ><label
          >{{ t("时间", "Period")
          }}<AppSelect
            v-model="days"
            :options="[
              { value: 'all', label: t('全部时间', 'All time') },
              { value: '1', label: t('最近 24 小时', 'Last 24 hours') },
              { value: '7', label: t('最近 7 天', 'Last 7 days') },
              { value: '30', label: t('最近 30 天', 'Last 30 days') },
            ]" /></label
        ><label
          >{{ t("搜索动作", "Search actions") }}
          <div class="asset-search">
            <Search :size="16" /><input
              v-model="search"
              :placeholder="t('如：查询、导出', 'e.g. query, export')"
            /></div
        ></label>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{{ t("时间", "Time") }}</th>
              <th>{{ t("模块", "Module") }}</th>
              <th>{{ t("动作", "Action") }}</th>
              <th>{{ t("结果", "Outcome") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pageRows" :key="row.id">
              <td>
                {{
                  new Date(row.at).toLocaleString(
                    state.locale === "zh" ? "zh-CN" : "en-US",
                  )
                }}
              </td>
              <td>{{ label(moduleNames[row.module]) }}</td>
              <td>{{ label(actionNames[row.action]) }}</td>
              <td>
                <span class="activity-status" :class="row.status">{{
                  statusName(row.status)
                }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!rows.length" class="empty-state">
        {{
          t(
            "没有匹配的记录。使用工具后，记录会出现在这里。",
            "No matching records. Activity will appear as you use tools.",
          )
        }}
      </p>
      <PaginationBar
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="rows.length"
      />
    </section>
  </div>
</template>
