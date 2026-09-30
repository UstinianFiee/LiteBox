<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
  watchEffect,
} from "vue";
import {
  Search,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Languages,
  Minus,
  Square,
  X,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Command,
} from "lucide-vue-next";
import {
  state,
  ui,
  initialize,
  navigate,
  t,
  desktop,
  invoke,
} from "./lib/store";
import { pages } from "./lib/catalog";
import type { PageId } from "./lib/types";
import HomePage from "./pages/HomePage.vue";
import { askConfirm, dismissConfirm } from "./lib/confirm";
import ConfirmDialog from "./components/ConfirmDialog.vue";
import StartupScreen from "./components/StartupScreen.vue";
const opening = ref(true);
const views: Record<PageId, any> = {
  home: HomePage,
  orders: defineAsyncComponent(() => import("./pages/OrdersPage.vue")),
  sql: defineAsyncComponent(() => import("./pages/SqlPage.vue")),
  convert: defineAsyncComponent(() => import("./pages/ConvertPage.vue")),
  images: defineAsyncComponent(() => import("./pages/ImagesPage.vue")),
  markdown: defineAsyncComponent(() => import("./pages/MarkdownPage.vue")),
  database: defineAsyncComponent(() => import("./pages/DatabasePage.vue")),
  remote: defineAsyncComponent(() => import("./pages/RemotePage.vue")),
  chat: defineAsyncComponent(() => import("./pages/ChatPage.vue")),
  dashboard: defineAsyncComponent(() => import("./pages/DashboardPage.vue")),
  snippets: defineAsyncComponent(() => import("./pages/SnippetsPage.vue")),
  history: defineAsyncComponent(() => import("./pages/HistoryPage.vue")),
  settings: defineAsyncComponent(() => import("./pages/SettingsPage.vue")),
};
const collapsed = ref(true);
function toggleSidebar() {
  collapsed.value = !collapsed.value;
}
const searchInput = ref<HTMLInputElement>();
const active = computed(() => pages.value.find((p) => p.id === ui.page)!);
const matches = computed(() =>
  pages.value.filter((p) =>
    (p.title + p.description + p.id)
      .toLowerCase()
      .includes(ui.search.toLowerCase()),
  ),
);
watchEffect(() => {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.lang = state.locale === "zh" ? "zh-CN" : "en";
  document.title = `${active.value.title} · LiteBox`;
});
function keydown(event: KeyboardEvent) {
  if (opening.value) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.value?.focus();
  }
  if (event.key === "Escape") ui.search = "";
}
const offConfirmation = window.litebox?.on(
  "confirmation:request",
  async (request) => {
    const accepted = await askConfirm(request.message, {
      ...request,
      requestId: request.id,
    });
    try {
      await invoke("confirmation:respond", { id: request.id, accepted });
    } catch {
      /* Closing window. */
    }
  },
);
const offDismissConfirmation = window.litebox?.on(
  "confirmation:dismiss",
  ({ id }) => dismissConfirm(id),
);
onUnmounted(() => {
  offConfirmation?.();
  offDismissConfirmation?.();
});
onMounted(() => {
  initialize();
  window.addEventListener("keydown", keydown);
});
onUnmounted(() => window.removeEventListener("keydown", keydown));
</script>

<template>
  <Transition name="startup">
    <StartupScreen
      v-if="opening"
      :ready="ui.ready"
      @finished="opening = false"
    />
  </Transition>
  <a class="skip-link" :inert="opening" href="#main">{{
    t("跳转到内容", "Skip to content")
  }}</a>
  <div
    class="app-shell"
    :class="{ collapsed, 'app-opening': opening, 'app-opened': !opening }"
    :inert="opening"
  >
    <aside class="sidebar">
      <div class="brand">
        <img src="/logo.svg" alt="" width="36" height="36" />
        <div class="brand-copy">
          <strong>LiteBox <span>轻匣</span></strong
          ><small>LESS FRICTION. MORE FLOW.</small>
        </div>
      </div>
      <nav :aria-label="t('主导航', 'Main navigation')">
        <button
          class="nav-link"
          :class="{ active: ui.page === 'home' }"
          data-page="home"
          @click="navigate('home')"
          :title="pages[0]?.title"
          :aria-label="pages[0]?.title"
        >
          <component :is="pages[0]?.icon" :size="19" /><span>{{
            pages[0]?.title
          }}</span>
        </button>
        <template
          v-for="group in [
            { id: 'tools', title: t('日常工具', 'EVERYDAY TOOLS') },
            { id: 'workspace', title: t('工作空间', 'WORKSPACE') },
          ]"
          :key="group.id"
        >
          <div class="nav-heading">{{ group.title }}</div>
          <button
            v-for="page in pages.filter((p) => p.category === group.id)"
            :key="page.id"
            :data-page="page.id"
            class="nav-link"
            :class="{ active: ui.page === page.id }"
            @click="navigate(page.id as PageId)"
            :title="page.title"
            :aria-label="page.title"
            :aria-current="ui.page === page.id ? 'page' : undefined"
          >
            <component :is="page.icon" :size="19" /><span>{{ page.title }}</span
            ><span v-if="page.id === 'chat'" class="nav-badge">AI</span>
          </button>
        </template>
      </nav>
      <div class="sidebar-bottom">
        <div class="local-note">
          <span class="status-dot"></span>
          <div>
            <strong>{{
              t("本地优先，安心使用", "Local first. Yours always.")
            }}</strong
            ><small>{{
              t("常用工具无需联网", "Everyday tools work offline")
            }}</small>
          </div>
        </div>
        <button
          class="nav-link"
          :class="{ active: ui.page === 'settings' }"
          data-page="settings"
          @click="navigate('settings')"
          :title="t('设置', 'Settings')"
        >
          <component
            :is="pages.find((page) => page.id === 'settings')?.icon"
            :size="19"
          /><span>{{ t("设置", "Settings") }}</span
          ><small>v{{ ui.version }}</small>
        </button>
      </div>
    </aside>
    <div class="app-content">
      <header class="topbar">
        <button
          class="icon-button sidebar-toggle"
          :aria-label="
            collapsed
              ? t('展开菜单', 'Expand menu')
              : t('收起菜单', 'Collapse menu')
          "
          :aria-expanded="!collapsed"
          @click="toggleSidebar"
        >
          <PanelLeftOpen v-if="collapsed" :size="18" /><PanelLeftClose
            v-else
            :size="18"
          />
        </button>
        <div class="breadcrumb">
          {{ t("我的工具箱", "My toolbox") }}<span>/</span
          ><strong>{{ active.title }}</strong>
        </div>
        <div class="search-wrap">
          <Search :size="16" /><input
            ref="searchInput"
            v-model="ui.search"
            :placeholder="t('搜索工具…', 'Search tools…')"
            :aria-label="t('搜索工具', 'Search tools')"
            @keydown.enter="matches[0] && navigate(matches[0].id as PageId)"
          /><kbd>Ctrl K</kbd>
          <div v-if="ui.search" class="search-results">
            <button
              v-for="page in matches"
              :key="page.id"
              :data-page="page.id"
              @click="navigate(page.id as PageId)"
            >
              <component :is="page.icon" :size="17" /><span>{{
                page.title
              }}</span
              ><ArrowUpRight :size="14" />
            </button>
            <p v-if="!matches.length">
              {{ t("没有找到工具", "No tools found") }}
            </p>
          </div>
        </div>
        <button
          class="icon-button"
          :aria-label="t('切换到英文', 'Switch to Chinese')"
          @click="state.locale = state.locale === 'zh' ? 'en' : 'zh'"
        >
          <Languages :size="19" />
        </button>
        <button
          class="icon-button"
          :aria-label="t('切换明暗主题', 'Toggle theme')"
          @click="state.theme = state.theme === 'light' ? 'dark' : 'light'"
        >
          <Sun v-if="state.theme === 'dark'" :size="18" /><Moon
            v-else
            :size="18"
          />
        </button>
        <div v-if="desktop" class="window-actions">
          <button
            :aria-label="t('最小化', 'Minimize')"
            @click="invoke('window:action', 'minimize')"
          >
            <Minus :size="15" /></button
          ><button
            :aria-label="t('最大化或还原', 'Maximize or restore')"
            @click="invoke('window:action', 'maximize')"
          >
            <Square :size="12" /></button
          ><button
            class="close-window"
            :aria-label="t('关闭', 'Close')"
            @click="invoke('window:action', 'close')"
          >
            <X :size="17" />
          </button>
        </div>
      </header>
      <main
        id="main"
        tabindex="-1"
        :class="{ 'remote-viewport': ui.page === 'remote' }"
      >
        <template v-if="ui.ready">
          <KeepAlive :include="['DatabasePage', 'RemotePage', 'ImagesPage']">
            <component :is="views[ui.page]" />
          </KeepAlive>
        </template>
        <div v-else class="empty-state">
          <Command :size="32" />
          <p>{{ t("正在打开你的工具箱…", "Opening your toolbox…") }}</p>
        </div>
      </main>
      <footer class="statusbar">
        <span
          ><span class="status-dot"></span
          >{{
            desktop
              ? t("桌面便携版", "Portable desktop")
              : t(
                  "浏览器预览 · 远程功能请使用桌面版",
                  "Browser preview · remote features require desktop",
                )
          }}</span
        ><span
          >{{
            t(
              "专注眼前，工具交给轻匣",
              "A little less friction in your everyday.",
            )
          }}<span class="status-divider">/</span>LiteBox {{ ui.version }}</span
        >
      </footer>
    </div>
  </div>
  <ConfirmDialog />
  <Transition name="toast"
    ><div
      v-if="ui.toast"
      class="toast"
      :class="{ error: ui.toastError }"
      role="status"
      aria-live="polite"
    >
      <AlertCircle v-if="ui.toastError" :size="18" /><CheckCircle2
        v-else
        :size="18"
      />{{ ui.toast }}
    </div></Transition
  >
</template>

<style src="./experience.css"></style>
