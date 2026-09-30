<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import {
  Maximize2,
  Minimize2,
  History,
  Activity,
  ArrowUpRight,
  FileSpreadsheet,
} from "lucide-vue-next";
import CsvDashboard from "../components/CsvDashboard.vue";
import {
  activity,
  activityStats,
  moduleNames,
  actionNames,
} from "../lib/activity";
import { t, state, navigate } from "../lib/store";
const csv = ref(false),
  immersive = ref(false),
  now = ref(Date.now());
const timer = setInterval(() => (now.value = Date.now()), 30000);
onUnmounted(() => clearInterval(timer));
const stats = computed(() => activityStats(activity.records, now.value));
const latest = computed(() => [...activity.records].reverse().slice(0, 8));
const maxDay = computed(() =>
  Math.max(1, ...stats.value.days.map((d) => d.count)),
);
const label = (pair: [string, string]) => pair[state.locale === "zh" ? 0 : 1];
function closeScreen(e: KeyboardEvent) {
  if (e.key === "Escape") immersive.value = false;
}
window.addEventListener("keydown", closeScreen);
onUnmounted(() => window.removeEventListener("keydown", closeScreen));
</script>
<template>
  <div class="activity-dashboard" :class="{ 'dashboard-immersive': immersive }">
    <div class="dashboard-modebar">
      <div class="segmented">
        <button :class="{ active: !csv }" @click="csv = false">
          <Activity :size="16" />{{
            t("操作概览", "Activity overview")
          }}</button
        ><button :class="{ active: csv }" @click="csv = true">
          <FileSpreadsheet :size="16" />{{ t("CSV 数据分析", "CSV analysis") }}
        </button>
      </div>
      <button
        class="button"
        :aria-pressed="immersive"
        @click="immersive = !immersive"
      >
        <Minimize2 v-if="immersive" :size="16" /><Maximize2
          v-else
          :size="16"
        />{{
          immersive
            ? t("退出大屏", "Exit big screen")
            : t("大屏模式", "Big screen")
        }}
      </button>
    </div>
    <CsvDashboard v-if="csv" />
    <div v-else class="page operations-overview">
      <div class="page-heading">
        <div>
          <div class="eyebrow">LITEBOX / ACTIVITY MONITOR</div>
          <h1>
            {{
              t(
                "数据看板 · 每一次操作，都有迹可循。",
                "Activity dashboard · Your everyday, in view.",
              )
            }}
          </h1>
          <p>
            {{
              t(
                "源于本机真实使用日志，不生成虚构业务数据。",
                "Based on real local activity, never fabricated business data.",
              )
            }}
          </p>
        </div>
        <span class="live-label"
          ><span class="status-dot" />{{
            new Date(now).toLocaleTimeString(
              state.locale === "zh" ? "zh-CN" : "en-US",
              { hour: "2-digit", minute: "2-digit" },
            )
          }}</span
        >
      </div>
      <div v-if="activity.error" class="error-banner">{{ activity.error }}</div>
      <div class="activity-kpis">
        <article class="panel">
          <span>{{ t("今日操作", "Actions today") }}</span
          ><strong>{{ stats.today }}</strong
          ><small>{{
            t("不含启动与页面访问", "Excludes launches and page visits")
          }}</small>
        </article>
        <article class="panel">
          <span>{{ t("保留的操作记录", "Retained actions") }}</span
          ><strong>{{ stats.operations.length }}</strong
          ><small>{{
            t("基于最近 3000 条日志", "From the latest 3,000 log entries")
          }}</small>
        </article>
        <article class="panel">
          <span>{{ t("使用的功能模块", "Active modules") }}</span
          ><strong>{{ stats.modules.length }}</strong
          ><small>{{
            t("有实际操作的模块", "Modules with recorded actions")
          }}</small>
        </article>
        <article class="panel">
          <span>{{ t("失败操作", "Failed actions") }}</span
          ><strong :class="{ 'error-text': stats.errors }">{{
            stats.errors
          }}</strong
          ><small>{{
            t(
              "查看历史日志了解时间与模块",
              "Find the time and module in history",
            )
          }}</small>
        </article>
      </div>
      <div class="activity-charts">
        <section class="panel">
          <div class="panel-heading">
            <h2>{{ t("最近 7 天", "Last 7 days") }}</h2>
            <span class="muted small">{{ t("操作次数", "Action count") }}</span>
          </div>
          <div
            class="activity-bars"
            role="img"
            :aria-label="
              stats.days
                .map(
                  (d) => new Date(d.at).toLocaleDateString() + ': ' + d.count,
                )
                .join('; ')
            "
          >
            <div
              v-for="day in stats.days"
              :key="day.at"
              class="activity-bar-column"
            >
              <strong>{{ day.count }}</strong>
              <div class="activity-bar-track">
                <div :style="{ height: (day.count / maxDay) * 100 + '%' }" />
              </div>
              <span>{{
                new Date(day.at).toLocaleDateString(
                  state.locale === "zh" ? "zh-CN" : "en-US",
                  { month: "numeric", day: "numeric" },
                )
              }}</span>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-heading">
            <h2>{{ t("模块使用分布", "Activity by module") }}</h2>
            <span class="muted small">TOP 6</span>
          </div>
          <div class="module-ranking">
            <div v-for="item in stats.modules.slice(0, 6)" :key="item.id">
              <div>
                <span>{{ label(item.name) }}</span
                ><strong>{{ item.count }}</strong>
              </div>
              <div class="ranking-track">
                <span
                  :style="{
                    width:
                      (item.count / (stats.modules[0]?.count || 1)) * 100 + '%',
                  }"
                />
              </div>
            </div>
            <p v-if="!stats.modules.length" class="empty-state">
              {{
                t(
                  "开始使用工具，统计将在这里生长。",
                  "Use a tool to see your activity here.",
                )
              }}
            </p>
          </div>
        </section>
      </div>
      <section class="panel">
        <div class="panel-heading">
          <h2><History :size="18" />{{ t("最近操作", "Recent activity") }}</h2>
          <button class="text-button" @click="navigate('history')">
            {{ t("查看全部", "View all") }}<ArrowUpRight :size="16" />
          </button>
        </div>
        <div class="activity-feed">
          <div v-for="row in latest" :key="row.id">
            <span class="activity-status" :class="row.status">{{
              row.status === "error"
                ? t("失败", "Failed")
                : row.status === "cancelled"
                  ? t("取消", "Cancelled")
                  : t("成功", "Success")
            }}</span
            ><strong>{{ label(moduleNames[row.module]) }}</strong
            ><span>{{ label(actionNames[row.action]) }}</span
            ><time>{{
              new Date(row.at).toLocaleString(
                state.locale === "zh" ? "zh-CN" : "en-US",
              )
            }}</time>
          </div>
          <p v-if="!latest.length" class="empty-state">
            {{ t("暂无记录", "No activity yet") }}
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
