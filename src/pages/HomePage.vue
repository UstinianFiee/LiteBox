<script setup lang="ts">
import HomeBanner from "../components/HomeBanner.vue";
import { computed } from "vue";
import {
  ArrowUpRight,
  Star,
  ArrowRight,
  Clock3,
  ShieldCheck,
  Plus,
  Laptop,
} from "lucide-vue-next";
import { state, t, navigate, favorite } from "../lib/store";
import { pages } from "../lib/catalog";
import type { PageId } from "../lib/types";
const tools = computed(() =>
  pages.value
    .filter((p) => !["home", "settings", "snippets"].includes(p.id))
    .sort(
      (a, b) =>
        Number(state.favorites.includes(b.id as PageId)) -
        Number(state.favorites.includes(a.id as PageId)),
    ),
);
const count = computed(() =>
  Object.values(state.usage).reduce((a, b) => a + b, 0),
);
const date = computed(() =>
  new Date().toLocaleDateString(state.locale === "zh" ? "zh-CN" : "en-US", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }),
);
const toolTags: Record<string, string> = {
  orders: "TEXT / BATCH",
  sql: "SQL / IN BUILDER",
  convert: "FORMAT / ENCODE",
  images: "IMAGE / OPTIMIZE",
  markdown: "WRITE / PREVIEW",
  remote: "SSH / RDP / SFTP",
  database: "DATABASE / QUERY",
  chat: "ASK / UNDERSTAND",
  dashboard: "DATA / VISUALIZE",
  history: "ACTIVITY / HISTORY",
};
</script>
<template>
  <div class="page home-page">
    <div class="page-heading">
      <div>
        <div class="eyebrow">YOUR EVERYDAY COMPANION</div>
        <h1>
          {{ t("工具就位，开始今天。", "Everything ready. Make it yours.") }}
        </h1>
        <p>
          {{
            t(
              "少一点来回切换，多一点得心应手。",
              "Less switching between apps. More getting things done.",
            )
          }}
        </p>
      </div>
      <div class="date-label"><Clock3 :size="15" />{{ date }}</div>
    </div>
    <HomeBanner />
    <div class="section-heading">
      <h2>
        {{ t("触手可及的工具", "Your everyday essentials")
        }}<span class="count-badge">{{
          String(tools.length).padStart(2, "0")
        }}</span>
      </h2>
      <span class="muted small">{{
        t("点击星标，收藏常用工具", "Star a tool to make it a favorite")
      }}</span>
    </div>
    <div class="tool-grid">
      <article
        v-for="tool in tools"
        :key="tool.id"
        class="tool-card"
        @click="navigate(tool.id as PageId)"
      >
        <div class="tool-card-top">
          <div class="tool-icon" :class="tool.color">
            <component :is="tool.icon" :size="23" :stroke-width="1.7" />
          </div>
          <button
            class="favorite-button"
            :class="{ selected: state.favorites.includes(tool.id as PageId) }"
            :aria-label="t('收藏', 'Favorite') + tool.title"
            :aria-pressed="state.favorites.includes(tool.id as PageId)"
            @click.stop="favorite(tool.id as PageId)"
          >
            <Star :size="16" />
          </button>
        </div>
        <h3>
          <button
            class="card-title-button"
            @click.stop="navigate(tool.id as PageId)"
          >
            {{ tool.title }}
          </button>
        </h3>
        <p>{{ tool.description }}</p>
        <div class="tool-card-bottom">
          <span>{{ toolTags[tool.id] }}</span
          ><ArrowUpRight :size="17" />
        </div>
      </article>
    </div>
    <div class="home-bottom">
      <section class="panel recent-panel">
        <div class="section-heading">
          <h2>{{ t("最近打开", "Pick up where you left off") }}</h2>
          <Clock3 :size="17" class="muted" />
        </div>
        <div v-if="!state.recent.length" class="empty-inline">
          <div class="empty-symbol"><Clock3 :size="22" /></div>
          <div>
            <strong>{{
              t("新的开始，没有历史包袱", "A fresh start, a clean workspace")
            }}</strong>
            <p>
              {{
                t(
                  "打开一个工具，它就会出现在这里。",
                  "Open a tool and find it here next time.",
                )
              }}
            </p>
          </div>
          <button
            class="icon-button"
            :aria-label="t('开始使用', 'Get started')"
            @click="navigate('orders')"
          >
            <ArrowRight :size="18" />
          </button>
        </div>
        <button
          v-for="item in state.recent.slice(0, 3)"
          :key="item.page"
          class="recent-row"
          @click="navigate(item.page)"
        >
          <component
            :is="pages.find((p) => p.id === item.page)?.icon"
            :size="18"
          /><span>{{ pages.find((p) => p.id === item.page)?.title }}</span
          ><small>{{
            new Date(item.at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          }}</small
          ><ArrowUpRight :size="14" />
        </button>
      </section>
      <section class="panel local-panel">
        <div class="local-panel-icon">
          <ShieldCheck :size="25" :stroke-width="1.5" />
        </div>
        <h3>{{ t("你的数据，留在你这里。", "Your data stays yours.") }}</h3>
        <p>
          {{
            t(
              "文本处理与文档编辑在本地完成。只有主动使用 AI 时，所选内容才会发送到你配置的服务。",
              "Text tools and notes stay local. Only content you send to AI leaves for your configured provider.",
            )
          }}
        </p>
        <div>
          <span
            >{{ t("已完成工具操作", "Tool runs")
            }}<strong>{{ count }}</strong></span
          ><span
            >{{ t("已保存连接", "Saved connections")
            }}<strong>{{ state.servers.length }}</strong></span
          >
        </div>
      </section>
    </div>
  </div>
</template>
