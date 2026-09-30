<script setup lang="ts">
import { computed, ref } from "vue";
import { Plus, Copy, Trash2, Bookmark, Search, Save } from "lucide-vue-next";
import { state, t, copy, notify } from "../lib/store";
import { askConfirm } from "../lib/confirm";
const search = ref("");
const active = ref("");
const title = ref("");
const content = ref("");
const list = computed(() =>
  state.snippets.filter((s) =>
    (s.title + s.content).toLowerCase().includes(search.value.toLowerCase()),
  ),
);
function select(id: string) {
  active.value = id;
  const s = state.snippets.find((s) => s.id === id);
  title.value = s?.title || "";
  content.value = s?.content || "";
}
function save() {
  if (!title.value.trim() || !content.value.trim()) return;
  const entry = {
    id: active.value || crypto.randomUUID(),
    title: title.value.trim(),
    content: content.value,
  };
  const index = state.snippets.findIndex((s) => s.id === entry.id);
  if (index < 0) state.snippets.unshift(entry);
  else state.snippets[index] = entry;
  active.value = entry.id;
  notify(t("片段已保存", "Snippet saved"));
}
async function remove() {
  if (await askConfirm(t("删除这个片段？", "Delete this snippet?"), {
    danger: true,
    confirmLabel: t("删除片段", "Delete snippet"),
  })) {
    state.snippets = state.snippets.filter((s) => s.id !== active.value);
    select("");
  }
}
</script>
<template>
  <div class="page">
    <div class="page-heading">
      <div>
        <div class="eyebrow">KEEP / REUSE</div>
        <h1>{{ t("常用片段", "Snippet library") }}</h1>
        <p>
          {{
            t(
              "把重复输入留给工具，把时间留给自己。",
              "Keep the useful bits. Skip the repeated typing.",
            )
          }}
        </p>
      </div>
      <button class="button primary" @click="select('')">
        <Plus :size="16" />{{ t("新建片段", "New snippet") }}
      </button>
    </div>
    <div class="library-layout">
      <aside class="panel snippet-sidebar">
        <label class="inline-search"
          ><Search :size="16" /><input
            v-model="search"
            :placeholder="t('搜索片段', 'Search snippets')"
            :aria-label="t('搜索片段', 'Search snippets')"
        /></label>
        <div v-if="!list.length" class="empty-state">
          <Bookmark :size="28" />
          <p>
            {{ t("还没有片段，保存第一条吧。", "Save your first snippet.") }}
          </p>
        </div>
        <button
          v-for="item in list"
          :key="item.id"
          class="snippet-item"
          :class="{ active: item.id === active }"
          @click="select(item.id)"
        >
          <Bookmark :size="16" />
          <div>
            <strong>{{ item.title }}</strong
            ><small>{{ item.content.slice(0, 60) }}</small>
          </div>
        </button>
      </aside>
      <section class="panel snippet-editor">
        <div class="panel-heading">
          <input
            v-model="title"
            :aria-label="t('片段标题', 'Snippet title')"
            :placeholder="t('给片段起个名字', 'Give your snippet a name')"
          /><button
            class="icon-button"
            :disabled="!active"
            :aria-label="t('删除片段', 'Delete snippet')"
            @click="remove"
          >
            <Trash2 :size="16" />
          </button>
        </div>
        <textarea
          v-model="content"
          class="code-input tall-text"
          :aria-label="t('片段内容', 'Snippet content')"
          :placeholder="
            t(
              '保存命令、SQL、配置或常用回复…\n\n片段仅保存为文本，不会自动执行。',
              'Save commands, SQL, configuration or a useful reply…\n\nSnippets are text only. Nothing executes automatically.',
            )
          "
        />
        <div class="panel-heading">
          <span class="hint">{{
            t("仅本地保存，不自动执行", "Stored locally. Never auto-executed.")
          }}</span>
          <div class="toolbar">
            <button class="button" :disabled="!content" @click="copy(content)">
              <Copy :size="15" />{{ t("复制", "Copy") }}</button
            ><button
              class="button primary"
              :disabled="!content.trim() || !title.trim()"
              @click="save"
            >
              <Save :size="15" />{{ t("保存", "Save") }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
