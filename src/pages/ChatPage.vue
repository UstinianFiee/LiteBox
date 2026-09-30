<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import type { ComponentPublicInstance } from "vue";
import {
  Sparkles,
  Paperclip,
  BookOpen,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUp,
  Send,
  Square,
  Plus,
  Trash2,
  Download,
  Settings2,
  ShieldCheck,
  MessageSquare,
  Bug,
  Code2,
  FileText,
  Copy,
  Pencil,
  Check,
  X,
} from "lucide-vue-next";
import { retrieveKnowledge } from "../lib/knowledge";
import { askConfirm } from "../lib/confirm";
import {
  state,
  t,
  ui,
  navigate,
  invoke,
  desktop,
  notify,
  exportText,
  copy,
  used,
} from "../lib/store";
import { renderMarkdown } from "../lib/markdown";
import type { ChatSession } from "../lib/types";
const historySearch = ref("");
const historyOpen = ref(true);
const historyManage = ref(false);
const renamingId = ref("");
const renameDraft = ref("");
const renameInput = ref<HTMLInputElement>();
function setRenameInput(
  element: Element | ComponentPublicInstance | null,
  _refs?: Record<string, unknown>,
) {
  renameInput.value = element instanceof HTMLInputElement ? element : undefined;
}
const groups = computed(() => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const today = now.getTime();
  const buckets = [
    { label: t("今天", "Today"), min: today, items: [] as ChatSession[] },
    {
      label: t("7 天内", "Last 7 days"),
      min: today - 6 * 86400000,
      items: [] as ChatSession[],
    },
    {
      label: t("30 天内", "Last 30 days"),
      min: today - 29 * 86400000,
      items: [] as ChatSession[],
    },
    { label: t("更早", "Earlier"), min: 0, items: [] as ChatSession[] },
  ];
  for (const chat of [...state.chats].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  )) {
    const needle = historySearch.value.trim().toLowerCase();
    const searchable = [
      chat.title,
      ...chat.messages.map((message) => message.content),
    ]
      .join("\n")
      .toLowerCase();
    if (needle && !searchable.includes(needle)) continue;
    (buckets.find((b) => chat.updatedAt >= b.min) || buckets[3]!).items.push(
      chat,
    );
  }
  return buckets.filter((b) => b.items.length);
});
function selectChat(id: string) {
  if (busy.value) return;
  active.value = id;
  error.value = "";
}
function composeKey(event: KeyboardEvent) {
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.isComposing &&
    event.keyCode !== 229
  ) {
    event.preventDefault();
    void send();
  }
}
const attachments = ref<
  (import("../lib/types").ChatAttachment & {
    preview?: string;
    data?: string;
  })[]
>([]);
const attachmentInput = ref<HTMLInputElement>();
const attachmentBusy = ref(false);
const previews = ref<Record<string, string>>({});
const useKnowledge = ref(false);
const excludedSources = ref<string[]>([]);
const matches = computed(() => retrieveKnowledge(input.value, state.snippets));
const sources = computed(() =>
  useKnowledge.value
    ? matches.value.filter((s) => !excludedSources.value.includes(s.id))
    : [],
);
async function pickAttachments(event: Event) {
  const field = event.target as HTMLInputElement;
  const files = Array.from(field.files || []);
  field.value = "";
  if (busy.value || attachmentBusy.value) return;
  attachmentBusy.value = true;
  try {
    for (const file of files) {
      if (attachments.value.length >= 5)
        throw Error(
          t("每条消息最多5个附件", "Up to five attachments per message"),
        );
      const image = [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
      ].includes(file.type);
      if (
        !image &&
        !/\.(txt|md|log|json|csv|tsv|sql|ya?ml|xml|ini|conf)$/i.test(file.name)
      )
        throw Error(
          t(
            "支持PNG/JPEG/WebP/GIF和文本附件；PDF/Office请先转文本",
            "Use PNG/JPEG/WebP/GIF or text files; convert PDF/Office to text first",
          ),
        );
      if (!file.size || file.size > (image ? 6 * 1024 * 1024 : 512 * 1024))
        throw Error(
          t(
            "图片上限6MiB，文本上限512KiB，不接受空文件",
            "Images: 6 MiB, text: 512 KiB; empty files are not supported",
          ),
        );
      if (
        attachments.value.reduce((n, a) => n + a.size, 0) + file.size >
        12 * 1024 * 1024
      )
        throw Error(
          t("附件总量不能超过12MiB", "Total attachment limit: 12 MiB"),
        );
      if (!image) {
        const bytes = await file.arrayBuffer();
        try {
          const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          if (text.includes(String.fromCharCode(0))) throw Error();
        } catch {
          throw Error(
            t(
              "文本附件必须是UTF-8编码",
              "Text attachments must use UTF-8 encoding",
            ),
          );
        }
      }
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(Error("Read failed"));
        reader.readAsDataURL(file);
      });
      const meta = desktop
        ? await invoke("ai:attachment-save", {
            name: file.name,
            data: data.split(",")[1],
          })
        : {
            id: crypto.randomUUID(),
            name: file.name,
            kind: image ? "image" : "text",
            mime: file.type || "text/plain",
            size: file.size,
          };
      attachments.value.push({ ...meta, preview: image ? data : undefined });
    }
  } catch (e) {
    notify(String(e), true);
  } finally {
    attachmentBusy.value = false;
  }
}
const active = ref(state.chats[0]?.id || "");
const input = ref("");
const busy = ref(false);
const error = ref("");
const scroll = ref<HTMLElement>();
const requestId = ref("");
const session = computed(() => state.chats.find((s) => s.id === active.value));
watch(
  () =>
    session.value?.messages
      .flatMap((m) => m.attachments || [])
      .map((a) => a.id)
      .join(","),
  async () => {
    if (!desktop) return;
    for (const a of session.value?.messages.flatMap(
      (m) => m.attachments || [],
    ) || []) {
      if (a.kind === "image" && !previews.value[a.id])
        try {
          const data = await invoke("ai:attachment-preview", a.id);
          if (data) previews.value[a.id] = data;
        } catch {
          /* Missing imported file is shown by name and reported on send. */
        }
    }
  },
  { immediate: true },
);

const modes = computed(() => [
  {
    id: "general",
    icon: MessageSquare,
    title: t("日常问答", "Everyday questions"),
  },
  { id: "debug", icon: Bug, title: t("报错分析", "Error analysis") },
  { id: "code", icon: Code2, title: t("代码解释", "Explain code") },
  { id: "writing", icon: FileText, title: t("文档整理", "Writing help") },
]);
const off = window.litebox?.on("ai:chunk", async (event) => {
  if (event.id !== requestId.value) return;
  const last = session.value?.messages.at(-1);
  if (last?.role === "assistant") last.content += event.text;
  await nextTick();
  scroll.value?.scrollTo({
    top: scroll.value.scrollHeight,
    behavior: "smooth",
  });
});
function fresh() {
  if (busy.value) return;
  active.value = "";
  input.value = "";
  attachments.value = [];
  excludedSources.value = [];
  error.value = "";
}
watch(
  () => ui.chatDraft,
  (draft) => {
    if (!draft) return;
    if (!busy.value) {
      fresh();
      input.value = draft;
      ui.chatDraft = "";
    }
  },
  { immediate: true },
);
async function send() {
  if (
    busy.value ||
    attachmentBusy.value ||
    (!input.value.trim() && !attachments.value.length)
  )
    return;
  if (!desktop) {
    notify(
      t(
        "请在桌面版设置模型后使用 AI",
        "Configure your model in the desktop app to use AI",
      ),
      true,
    );
    return;
  }
  if (!state.ai.model.trim()) {
    navigate("settings");
    notify(
      t("请先配置模型名称和 API Key", "Configure a model and API key first"),
    );
    return;
  }
  if (
    attachments.value.length &&
    !(await askConfirm(
      t(
        "将这些附件发送至你配置的AI服务？请确认已移除密码和敏感信息。",
        "Send these attachments to your configured AI provider? Remove secrets and sensitive data first.",
      ),
      {
        detail: attachments.value.map((a) => a.name).join(" · "),
        confirmLabel: t("发送附件", "Send attachments"),
      },
    ))
  )
    return;
  if (busy.value) return;
  let current = session.value;
  if (!current) {
    current = {
      id: crypto.randomUUID(),
      title: (
        input.value ||
        attachments.value[0]?.name ||
        t("新对话", "New chat")
      ).slice(0, 32),
      messages: [],
      updatedAt: Date.now(),
    };
    state.chats.unshift(current);
    active.value = current.id;
    current = session.value!;
  }
  for (const a of attachments.value)
    if (a.preview) previews.value[a.id] = a.preview;
  current.messages.push({
    role: "user",
    content:
      input.value || t("请分析附件内容", "Please analyze these attachments"),
    attachments: attachments.value.map(({ preview, data, ...a }) => a),
    knowledge: sources.value.map((s) => ({ ...s })),
  });
  attachments.value = [];
  excludedSources.value = [];
  input.value = "";
  // Nested attachment/knowledge arrays are Vue proxies; IPC requires plain data.
  const messages = JSON.parse(JSON.stringify(current.messages));
  current.messages.push({ role: "assistant", content: "" });
  busy.value = true;
  error.value = "";
  requestId.value = crypto.randomUUID();
  try {
    const response = await invoke("ai:chat", {
      id: requestId.value,
      config: {
        endpoint: state.ai.endpoint,
        model: state.ai.model,
        system: state.ai.system,
      },
      messages,
      mode: state.ai.mode,
      locale: state.locale,
    });
    // The invoke reply can arrive before the last chunk event. Final text is authoritative.
    const answer = current.messages.at(-1);
    if (answer?.role === "assistant" && typeof response?.text === "string")
      answer.content = response.text;
    used("chat");
  } catch (e) {
    error.value = String(e);
    if (!current.messages.at(-1)?.content) current.messages.pop();
  } finally {
    requestId.value = "";
    if (
      current.messages.at(-1)?.role === "assistant" &&
      !current.messages.at(-1)?.content
    )
      current.messages.pop();
    busy.value = false;
    current.updatedAt = Date.now();
  }
}
function toggleHistoryManage() {
  historyManage.value = !historyManage.value;
  if (!historyManage.value) cancelRename();
}
function startRename(chat: ChatSession) {
  if (busy.value) return;
  renamingId.value = chat.id;
  renameDraft.value = chat.title;
  void nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}
function cancelRename() {
  renamingId.value = "";
  renameDraft.value = "";
}
function saveRename(chat: ChatSession) {
  const title = renameDraft.value.trim();
  if (!title) {
    notify(t("标题不能为空", "A title is required"), true);
    return;
  }
  chat.title = title.slice(0, 80);
  chat.updatedAt = Date.now();
  cancelRename();
}
async function removeChat(id: string) {
  const chat = state.chats.find((item) => item.id === id);
  if (!chat || busy.value) return;
  if (
    !(await askConfirm(t("删除这段对话？", "Delete this conversation?"), {
      danger: true,
      confirmLabel: t("删除对话", "Delete conversation"),
    }))
  )
    return;
  if (busy.value || !state.chats.some((item) => item.id === id)) return;
  state.chats = state.chats.filter((item) => item.id !== id);
  if (active.value === id) fresh();
  if (renamingId.value === id) cancelRename();
}
async function remove() {
  await removeChat(active.value);
}
function exportChat() {
  if (session.value)
    exportText(
      session.value.messages
        .map((m) => `## ${m.role}\n\n${m.content}`)
        .join("\n\n"),
      session.value.title.replace(/[<>:"/\\|?*]/g, "_") + ".md",
    ).catch((e) => notify(String(e), true));
}
function exportHistory() {
  if (!state.chats.length) return;
  const text = [...state.chats]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(
      (chat) =>
        `# ${chat.title}\n\n${new Date(chat.updatedAt).toLocaleString()}\n\n` +
        chat.messages
          .map((message) => `## ${message.role}\n\n${message.content}`)
          .join("\n\n"),
    )
    .join("\n\n---\n\n");
  exportText(
    text,
    `LiteBox-ai-history-${new Date().toISOString().slice(0, 10)}.md`,
  ).catch((e) => notify(String(e), true));
}
async function clearHistory() {
  if (!state.chats.length || busy.value) return;
  if (
    !(await askConfirm(
      t(
        "清空全部 AI 对话历史？此操作不可撤销。",
        "Clear all AI conversation history? This cannot be undone.",
      ),
      { danger: true, confirmLabel: t("清空历史", "Clear history") },
    ))
  )
    return;
  if (busy.value || !state.chats.length) return;
  state.chats = [];
  historySearch.value = "";
  cancelRename();
  fresh();
}
onUnmounted(() => {
  if (input.value && !ui.chatDraft) ui.chatDraft = input.value;
  off?.();
  if (busy.value) invoke("ai:cancel", requestId.value).catch(() => {});
});
</script>
<template>
  <div class="page chat-page chat-redesign">
    <div class="chat-layout" :class="{ 'history-hidden': !historyOpen }">
      <aside v-show="historyOpen" class="chat-sidebar">
        <div class="chat-brand">
          <Sparkles :size="24" /><strong>LiteBox <span>AI</span></strong
          ><button
            class="icon-button"
            :aria-label="t('收起会话列表', 'Hide conversations')"
            @click="historyOpen = false"
          >
            <PanelLeftClose :size="18" />
          </button>
        </div>
        <button class="button new-chat-button" :disabled="busy" @click="fresh">
          <Plus :size="18" />{{ t("开启新对话", "New conversation") }}
        </button>
        <label class="chat-history-search"
          ><Search :size="16" /><input
            v-model="historySearch"
            :aria-label="t('搜索对话', 'Search conversations')"
            :placeholder="t('搜索标题或内容', 'Search titles or messages')"
        /></label>
        <div class="chat-history-toolbar">
          <div>
            <strong>{{ t("历史记录", "History") }}</strong>
            <span>{{ state.chats.length }}</span>
          </div>
          <button
            class="text-button"
            :aria-pressed="historyManage"
            @click="toggleHistoryManage"
          >
            {{ historyManage ? t("完成", "Done") : t("管理", "Manage") }}
          </button>
        </div>
        <div v-if="historyManage" class="chat-history-actions">
          <button
            class="small-button"
            :disabled="!state.chats.length || busy"
            @click="exportHistory"
          >
            <Download :size="14" />{{ t("导出全部", "Export all") }}
          </button>
          <button
            class="small-button history-danger-button"
            :disabled="!state.chats.length || busy"
            @click="clearHistory"
          >
            <Trash2 :size="14" />{{ t("清空全部", "Clear all") }}
          </button>
        </div>
        <div class="chat-session-list">
          <div v-for="group in groups" :key="group.label">
            <div class="nav-heading">{{ group.label }}</div>
            <div
              v-for="chat in group.items"
              :key="chat.id"
              class="chat-session-row"
              :class="{ active: active === chat.id }"
            >
              <form
                v-if="renamingId === chat.id"
                class="chat-rename-form"
                @submit.prevent="saveRename(chat)"
              >
                <input
                  :ref="setRenameInput"
                  v-model="renameDraft"
                  :aria-label="t('对话标题', 'Conversation title')"
                  maxlength="80"
                  :disabled="busy"
                />
                <button
                  class="icon-button"
                  type="submit"
                  :disabled="busy || !renameDraft.trim()"
                  :aria-label="t('保存标题', 'Save title')"
                >
                  <Check :size="15" />
                </button>
                <button
                  class="icon-button"
                  type="button"
                  :disabled="busy"
                  :aria-label="t('取消重命名', 'Cancel rename')"
                  @click="cancelRename"
                >
                  <X :size="15" />
                </button>
              </form>
              <template v-else>
                <button
                  class="chat-session"
                  :class="{ active: active === chat.id }"
                  :disabled="busy"
                  :title="chat.title"
                  @click="selectChat(chat.id)"
                >
                  <span>{{ chat.title }}</span>
                  <small>{{ chat.messages.length }}</small>
                </button>
                <div v-if="historyManage" class="chat-session-actions">
                  <button
                    class="icon-button"
                    :disabled="busy"
                    :aria-label="t('重命名对话', 'Rename conversation')"
                    @click.stop="startRename(chat)"
                  >
                    <Pencil :size="14" />
                  </button>
                  <button
                    class="icon-button"
                    :disabled="busy"
                    :aria-label="t('删除对话', 'Delete conversation')"
                    @click.stop="removeChat(chat.id)"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
              </template>
            </div>
          </div>
          <p v-if="!groups.length" class="muted small">
            {{
              historySearch.trim()
                ? t("没有匹配的对话", "No matching conversations")
                : t(
                    "新的想法，从一句话开始。",
                    "A new idea starts with a conversation.",
                  )
            }}
          </p>
        </div>
        <button class="chat-settings-link" @click="navigate('settings')">
          <Settings2 :size="18" /><span>{{
            t("模型与 API 设置", "Model & API settings")
          }}</span>
        </button>
      </aside>
      <section
        class="chat-main"
        :class="{ 'is-empty': !session?.messages.length }"
      >
        <div class="chat-topline">
          <div class="toolbar">
            <button
              v-if="!historyOpen"
              class="icon-button"
              :aria-label="t('展开会话列表', 'Show conversations')"
              @click="historyOpen = true"
            >
              <PanelLeftOpen :size="19" />
            </button>
            <h1 class="chat-title">{{ t("AI 助手", "AI assistant") }}</h1>
            <span class="chat-model"
              ><span class="status-dot" :class="{ muted: !state.ai.model }" />{{
                state.ai.model || t("尚未配置模型", "No model configured")
              }}</span
            >
          </div>
          <div class="toolbar">
            <button
              class="icon-button"
              :disabled="!session || busy"
              :aria-label="t('导出对话', 'Export conversation')"
              @click="exportChat"
            >
              <Download :size="18" /></button
            ><button
              class="icon-button"
              :disabled="!session || busy"
              :aria-label="t('删除对话', 'Delete conversation')"
              @click="remove"
            >
              <Trash2 :size="18" />
            </button>
          </div>
        </div>
        <div ref="scroll" class="chat-messages" :aria-busy="busy">
          <div v-if="!session?.messages.length" class="chat-empty">
            <div class="chat-welcome-line">
              <Sparkles :size="32" :stroke-width="1.7" />
              <h2>
                {{
                  t(
                    "欢迎回来，随时开始吧",
                    "Welcome back. What’s on your mind?",
                  )
                }}
              </h2>
            </div>
            <p>
              {{
                t(
                  "贴一段报错，整理一个想法，或者直接提问。",
                  "Untangle an error, shape an idea, or simply ask.",
                )
              }}
            </p>
          </div>
          <article
            v-for="(message, index) in session?.messages"
            :key="index"
            class="chat-message"
            :class="message.role"
          >
            <div class="message-role">
              <span>{{
                message.role === "user" ? t("你", "YOU") : "LITEBOX AI"
              }}</span
              ><button
                class="icon-button"
                :aria-label="t('复制消息', 'Copy message')"
                @click="copy(message.content)"
              >
                <Copy :size="15" />
              </button>
            </div>
            <div v-if="message.attachments?.length" class="chat-attachments">
              <div
                v-for="attachment in message.attachments"
                :key="attachment.id"
                class="chat-attachment"
              >
                <img
                  v-if="previews[attachment.id]"
                  :src="previews[attachment.id]"
                  :alt="attachment.name"
                /><FileText v-else :size="20" /><span>{{
                  attachment.name
                }}</span>
              </div>
            </div>
            <details v-if="message.knowledge?.length" class="knowledge-sources">
              <summary>
                {{ t("本轮参考记录", "Reference records") }} ·
                {{ message.knowledge.length }}
              </summary>
              <div v-for="source in message.knowledge" :key="source.id">
                <strong>{{ source.title }}</strong>
                <pre>{{ source.content }}</pre>
              </div>
            </details>
            <div
              class="prose"
              v-html="renderMarkdown(message.content)"
              @click="
                ($event.target as HTMLElement).closest('a') &&
                $event.preventDefault()
              "
            ></div>
            <span
              v-if="busy && index === session!.messages.length - 1"
              class="typing-indicator"
              >•••</span
            >
          </article>
          <div v-if="error" class="error-banner" role="alert">{{ error }}</div>
        </div>
        <div class="chat-input-area">
          <div v-if="attachments.length" class="chat-attachments">
            <div
              v-for="(attachment, i) in attachments"
              :key="attachment.id"
              class="chat-attachment"
            >
              <img
                v-if="attachment.preview"
                :src="attachment.preview"
                :alt="attachment.name"
              /><FileText v-else :size="20" /><span
                >{{ attachment.name }}
                <small
                  >{{ (attachment.size / 1024).toFixed(0) }} KiB</small
                ></span
              ><button
                class="icon-button"
                :disabled="busy"
                :aria-label="
                  t('移除附件', 'Remove attachment') + ' ' + attachment.name
                "
                @click="attachments.splice(i, 1)"
              >
                <X :size="16" />
              </button>
            </div>
          </div>
          <div v-if="useKnowledge" class="knowledge-preview">
            <p class="muted">
              {{
                t(
                  "本地检索，发送时仅附带勾选的相关摘录（最多3条）；内容将发送至配置的AI服务。",
                  "Local retrieval. Only checked excerpts (up to 3) will be sent to your AI provider.",
                )
              }}
            </p>
            <label v-for="source in matches" :key="source.id"
              ><input
                type="checkbox"
                :checked="!excludedSources.includes(source.id)"
                :disabled="busy"
                @change="
                  excludedSources.includes(source.id)
                    ? (excludedSources = excludedSources.filter(
                        (id) => id !== source.id,
                      ))
                    : excludedSources.push(source.id)
                "
              />{{ source.title }}</label
            >
            <span v-if="!matches.length" class="muted">{{
              t(
                "暂未匹配相关记录，可在常用记录中添加内容或补充提问关键词。",
                "No relevant records. Add saved records or more question keywords.",
              )
            }}</span>
          </div>
          <div class="chat-composer">
            <textarea
              v-model="input"
              :aria-label="t('消息内容', 'Message')"
              :placeholder="t('给 LiteBox AI 发送消息…', 'Message LiteBox AI…')"
              rows="3"
              :disabled="busy"
              @keydown="composeKey"
            />
            <div class="composer-actions">
              <div class="composer-toolbox">
                <div class="chat-context-tools">
                  <input
                    ref="attachmentInput"
                    type="file"
                    multiple
                    hidden
                    accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,.log,.json,.csv,.tsv,.sql,.yaml,.yml,.xml,.ini,.conf"
                    @change="pickAttachments"
                  />
                  <button
                    class="composer-tool"
                    :aria-label="t('添加图片 / 附件', 'Add images / files')"
                    :title="
                      t(
                        '添加图片 / 附件 · 图片 ≤6MiB；UTF-8文本 ≤512KiB；最多5个',
                        'Add images / files · Images ≤6 MiB; UTF-8 text ≤512 KiB; up to 5',
                      )
                    "
                    :disabled="busy || attachmentBusy"
                    @click="attachmentInput?.click()"
                  >
                    <Paperclip :size="17" />{{
                      attachmentBusy
                        ? t("读取中…", "Reading…")
                        : t("附件", "Attach")
                    }}
                  </button>
                  <label
                    class="knowledge-toggle"
                    :class="{ active: useKnowledge, disabled: busy }"
                    :title="
                      t(
                        '从常用记录中检索相关内容，由你选择是否发送给AI',
                        'Find relevant saved records; you choose what to send to AI',
                      )
                    "
                    ><input
                      v-model="useKnowledge"
                      :aria-label="t('参考常用记录', 'Use saved records')"
                      type="checkbox"
                      :disabled="busy" /><BookOpen :size="17" />{{
                      t("常用记录", "Knowledge")
                    }}<Check v-if="useKnowledge" :size="13" aria-hidden="true"
                  /></label>
                </div>
                <div class="mode-chips">
                  <button
                    v-for="mode in modes"
                    :key="mode.id"
                    :class="{ active: state.ai.mode === mode.id }"
                    :aria-pressed="state.ai.mode === mode.id"
                    :disabled="busy"
                    @click="state.ai.mode = mode.id"
                  >
                    <component :is="mode.icon" :size="15" />{{ mode.title }}
                  </button>
                </div>
              </div>
              <button
                v-if="busy"
                class="chat-send-button"
                :aria-label="t('停止生成', 'Stop generation')"
                @click="invoke('ai:cancel', requestId)"
              >
                <Square :size="18" /></button
              ><button
                v-else
                class="chat-send-button"
                :aria-label="t('发送', 'Send')"
                :disabled="
                  attachmentBusy || (!input.trim() && !attachments.length)
                "
                @click="send"
              >
                <ArrowUp :size="21" />
              </button>
            </div>
          </div>
          <p class="chat-input-hint">
            Shift + Enter {{ t("换行", "for a new line") }}<span>·</span
            >{{
              t(
                "仅发送主动提交的消息、附件及已选记录",
                "Only messages, attachments and records you choose",
              )
            }}
          </p>
          <p class="chat-disclaimer">
            {{
              !desktop
                ? t(
                    "浏览器为界面预览；请在桌面模式配置模型后使用。",
                    "Browser preview only. Configure a model in desktop mode to chat.",
                  )
                : t(
                    "内容发送至你配置的模型服务。请先脱敏；AI 可能出错。",
                    "Messages go to your configured provider. Remove secrets first; AI can make mistakes.",
                  )
            }}
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
