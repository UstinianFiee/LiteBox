<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  FolderOpen,
  Save,
  Download,
  Columns2,
  Eye,
  Pencil,
  FilePlus2,
  FileText,
} from "lucide-vue-next";
import {
  state,
  t,
  openText,
  exportText,
  invoke,
  desktop,
  notify,
  used,
} from "../lib/store";
import { renderMarkdown } from "../lib/markdown";
import { askConfirm } from "../lib/confirm";
const view = ref("split");
const html = computed(() => renderMarkdown(state.markdown.text));
const headings = computed(() =>
  [...state.markdown.text.matchAll(/^(#{1,3})\s+(.+)$/gm)].map((m) => ({
    level: m[1]!.length,
    text: m[2]!,
  })),
);
async function open() {
  if (
    state.markdown.text &&
    !(await askConfirm(
      t(
        "打开文件会替换当前草稿，请先保存要保留的内容。继续？",
        "Opening a file replaces the current draft. Save your changes first. Continue?",
      ),
      { confirmLabel: t("打开文件", "Open file") },
    ))
  )
    return;
  try {
    const file = await openText(["md", "markdown", "txt"]);
    if (file) {
      Object.assign(state.markdown, file);
      used("markdown");
    }
  } catch (e) {
    notify(String(e), true);
  }
}
async function save(asNew = false) {
  try {
    const result = desktop
      ? await invoke("file:save", {
          path: asNew ? "" : state.markdown.path,
          text: state.markdown.text,
          name: state.markdown.name,
        })
      : await exportText(state.markdown.text, state.markdown.name);
    if (result?.saved) {
      if (result.path) state.markdown.path = result.path;
      if (result.name) state.markdown.name = result.name;
      notify(t("文档已保存", "Document saved"));
      used("markdown");
    }
  } catch (e) {
    notify(String(e), true);
  }
}
async function fresh() {
  if (
    state.markdown.text &&
    !(await askConfirm(
      t(
        "新建将替换当前草稿。是否继续？请先保存需要保留的内容。",
        "A new note replaces the current draft. Save anything you want to keep first. Continue?",
      ),
      { confirmLabel: t("新建文档", "New document") },
    ))
  )
    return;
  Object.assign(state.markdown, { text: "", name: "Untitled.md", path: "" });
}
function exportHtml() {
  exportText(
    '<!doctype html><meta charset="utf-8"><title>LiteBox export</title><main>' +
      html.value +
      "</main>",
    state.markdown.name.replace(/\.md$/i, "") + ".html",
  ).catch((e) => notify(String(e), true));
}
function key(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    save();
  }
}
onMounted(() => window.addEventListener("keydown", key));
onUnmounted(() => window.removeEventListener("keydown", key));
</script>
<template>
  <div class="page markdown-page">
    <div class="page-heading">
      <div>
        <div class="eyebrow">WRITE / PREVIEW</div>
        <h1>{{ t("Markdown 文档", "Markdown studio") }}</h1>
        <p>
          {{
            t(
              "一边书写，一边预览。草稿自动保留，文件由你掌控。",
              "Write and preview side by side. Drafts stay here. Files stay yours.",
            )
          }}
        </p>
      </div>
      <div class="toolbar">
        <button class="button" @click="fresh">
          <FilePlus2 :size="16" />{{ t("新建", "New") }}</button
        ><button class="button" @click="open">
          <FolderOpen :size="16" />{{ t("打开", "Open") }}</button
        ><button class="button primary" @click="save()">
          <Save :size="16" />{{ t("保存文件", "Save file") }}
        </button>
      </div>
    </div>
    <div class="panel markdown-workspace">
      <div class="panel-heading">
        <label class="filename-input"
          ><FileText :size="17" /><input
            v-model="state.markdown.name"
            :aria-label="t('文件名', 'Filename')"
        /></label>
        <div class="segmented compact">
          <button
            :class="{ active: view === 'edit' }"
            @click="view = 'edit'"
            :aria-label="t('编辑', 'Edit')"
          >
            <Pencil :size="16" /></button
          ><button
            :class="{ active: view === 'split' }"
            @click="view = 'split'"
            :aria-label="t('分屏', 'Split view')"
          >
            <Columns2 :size="16" /></button
          ><button
            :class="{ active: view === 'preview' }"
            @click="view = 'preview'"
            :aria-label="t('预览', 'Preview')"
          >
            <Eye :size="16" />
          </button>
        </div>
      </div>
      <div class="markdown-panes" :class="view">
        <textarea
          v-if="view !== 'preview'"
          v-model="state.markdown.text"
          class="code-input markdown-input"
          :aria-label="t('Markdown 编辑器', 'Markdown editor')"
          :placeholder="
            t(
              '# 从一个想法开始\n\n写下笔记、操作步骤，或今天的灵感。\n\n## 待办事项\n\n- 整理项目笔记\n- 记录常用命令\n\n```bash\necho hello, LiteBox\n```',
              '# Start with an idea\n\nWrite a note, a how-to, or something worth keeping.\n\n## To do\n\n- Organize project notes\n- Save useful commands\n\n```bash\necho hello, LiteBox\n```',
            )
          "
          spellcheck="false"
        />
        <div
          v-if="view !== 'edit'"
          class="markdown-preview prose"
          @click="
            ($event.target as HTMLElement).closest('a') &&
            $event.preventDefault()
          "
        >
          <div v-if="!state.markdown.text" class="empty-state">
            <FileText :size="34" :stroke-width="1.2" />
            <h3>{{ t("给想法留一点空间", "A little room for your ideas") }}</h3>
            <p>
              {{
                t(
                  "你的文档预览会显示在这里。",
                  "Your document preview will appear here.",
                )
              }}
            </p>
          </div>
          <div v-else v-html="html"></div>
        </div>
      </div>
      <div class="editor-footer">
        <span
          >{{ state.markdown.text.length }} {{ t("字符", "characters") }} ·
          {{ state.markdown.text.split("\n").length }}
          {{ t("行", "lines") }}</span
        ><span>{{
          t(
            "草稿自动保留 · Ctrl S 保存文件",
            "Draft saved locally · Ctrl S saves the file",
          )
        }}</span>
      </div>
    </div>
    <div class="toolbar mt-16">
      <span class="hint">{{
        t(
          "安全预览：禁用 HTML 脚本、外部图片和链接跳转。",
          "Safe preview: scripts, external images and link navigation are disabled.",
        )
      }}</span
      ><button class="button" @click="save(true)">
        {{ t("另存为", "Save as") }}</button
      ><button
        class="button"
        :disabled="!state.markdown.text"
        @click="exportHtml"
      >
        <Download :size="15" />{{ t("导出 HTML", "Export HTML") }}
      </button>
    </div>
  </div>
</template>
