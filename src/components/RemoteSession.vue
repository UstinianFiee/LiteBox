<script setup lang="ts">
import AppSelect from "../components/AppSelect.vue";
import {
  computed,
  nextTick,
  onActivated,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import {
  TerminalSquare,
  Folder,
  File,
  Upload,
  Download,
  RefreshCw,
  ArrowUp,
  Plug,
  Unplug,
  Trash2,
  KeyRound,
  Save,
  X,
} from "lucide-vue-next";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  state,
  t,
  invoke,
  desktop,
  notify,
  used,
  copy,
  ui,
  navigate,
} from "../lib/store";
import type { ServerProfile, FileEntry } from "../lib/types";
import { askConfirm } from "../lib/confirm";
const contextMenu = ref<{ x: number; y: number; selection: string } | null>(
  null,
);
const menuEl = ref<HTMLElement>();
const hasSelection = ref(false);
function palette() {
  const dark = state.theme === "dark";
  return {
    background: dark ? "#0c0c0d" : "#ffffff",
    foreground: dark ? "#eeeeef" : "#253449",
    cursor: "#2563eb",
    selectionBackground: "#93b4e866",
    black: dark ? "#4b5563" : "#111827",
    red: dark ? "#fb7185" : "#b91c1c",
    green: dark ? "#4ade80" : "#15803d",
    yellow: dark ? "#facc15" : "#854d0e",
    blue: dark ? "#60a5fa" : "#1d4ed8",
    magenta: dark ? "#c084fc" : "#7e22ce",
    cyan: dark ? "#22d3ee" : "#0e7490",
    white: dark ? "#e5e7eb" : "#475569",
    brightBlack: "#64748b",
    brightRed: dark ? "#fda4af" : "#dc2626",
    brightGreen: dark ? "#86efac" : "#166534",
    brightYellow: dark ? "#fde68a" : "#a16207",
    brightBlue: dark ? "#93c5fd" : "#2563eb",
    brightMagenta: dark ? "#d8b4fe" : "#9333ea",
    brightCyan: dark ? "#67e8f9" : "#0891b2",
    brightWhite: dark ? "#ffffff" : "#334155",
  };
}
function closeMenu() {
  contextMenu.value = null;
}
async function openMenu(event: MouseEvent | KeyboardEvent) {
  if (!term || !connected.value) return;
  const rect = terminalEl.value?.getBoundingClientRect();
  contextMenu.value = {
    x: Math.max(
      8,
      Math.min(
        "clientX" in event ? event.clientX : (rect?.left || 0) + 20,
        window.innerWidth - 285,
      ),
    ),
    y: Math.max(
      8,
      Math.min(
        "clientY" in event ? event.clientY : (rect?.top || 0) + 35,
        window.innerHeight - 180,
      ),
    ),
    selection: term.getSelection(),
  };
  await nextTick();
  menuEl.value
    ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
    ?.focus();
}
function menuKey(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeMenu();
    term?.focus();
    return;
  }
  if (event.key === "Tab") {
    closeMenu();
    return;
  }
  if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const buttons = [
    ...(menuEl.value?.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    ) || []),
  ];
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
  buttons[
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? buttons.length - 1
        : (i + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
          buttons.length
  ]?.focus();
}
async function copyTerminal() {
  const text = contextMenu.value?.selection || term?.getSelection();
  closeMenu();
  if (text) await copy(text);
}
async function pasteTerminal(text?: string) {
  closeMenu();
  if (!connected.value || !term) return;
  try {
    const raw = text ?? (await invoke("clipboard:read"));
    if (typeof raw !== "string" || !raw) return;
    if (raw.length > 65536)
      throw Error(
        t("粘贴内容不能超过64K字符", "Paste is limited to 64K characters"),
      );
    const value = raw.replace(/\0/g, "");
    const removedNulls = raw.length - value.length;
    if (!value) {
      notify(
        t(
          "剪贴板只有空字符，没有可粘贴的文本",
          "The clipboard contains only NUL characters, with no text to paste",
        ),
        true,
      );
      return;
    }
    if (
      (removedNulls > 0 || /[\r\n\x00-\x08\x0b-\x1f\x7f]/.test(value)) &&
      !(await askConfirm(
        removedNulls > 0
          ? t(
              `剪贴板含 ${removedNulls} 个隐藏空字符，粘贴前将移除。内容含换行或控制字符时可能执行命令，请核对预览后确认。`,
              `Remove ${removedNulls} hidden NUL characters before pasting? Line breaks or control characters may execute commands. Review the preview before confirming.`,
            )
          : t(
              "粘贴含换行或控制字符，可能立即执行命令，继续？",
              "Pasted text line breaks or control characters may execute commands. Continue?",
            ),
        {
          detail: value.slice(0, 600),
          confirmLabel: t("确认粘贴", "Paste"),
          danger: true,
        },
      ))
    )
      return;
    if (connected.value) {
      term.paste(value);
      term.focus();
    }
  } catch (e) {
    notify(String(e), true);
  }
}
function pasteEvent(event: ClipboardEvent) {
  event.preventDefault();
  event.stopPropagation();
  void pasteTerminal(event.clipboardData?.getData("text/plain") || "");
}
function analyzeSelection() {
  const text = contextMenu.value?.selection || term?.getSelection();
  closeMenu();
  if (!text) return;
  if (text.length > 100000) {
    notify(
      t(
        "选中文本过长，请缩小范围",
        "Selection too long; select a smaller region",
      ),
      true,
    );
    return;
  }
  if (ui.chatDraft) {
    notify(
      t("AI中已有待分析草稿，请先处理", "Handle the existing AI draft first"),
      true,
    );
    navigate("chat");
    return;
  }
  ui.chatDraft =
    t(
      "请分析以下终端报错，说明原因、验证步骤和安全修复建议：\n\n",
      "Analyze this terminal error: causes, verification steps and safe fixes:\n\n",
    ) + text;
  state.ai.mode = "debug";
  navigate("chat");
}
const props = defineProps<{ server: ServerProfile; active: boolean }>();
const emit = defineEmits<{
  status: [connected: boolean];
  edit: [];
  remove: [];
}>();
const server = computed(() => props.server);
const selected = computed(() => props.server.id);
const remoteView = ref<"terminal" | "files" | "split">("split");
const connecting = ref(false);
const connected = ref(false);
const terminalEl = ref<HTMLElement>();
const password = ref("");
const keyPath = ref("");
const passphrase = ref("");
const auth = ref(props.server.auth || "password");
const savedCredential = ref(false);
let credentialVersion = 0;
watch(
  () => props.server.auth,
  (value) => {
    auth.value = value || "password";
  },
);
watch(
  () => [props.server, auth.value],
  async () => {
    const version = ++credentialVersion;
    savedCredential.value = false;
    if (!desktop) return;
    try {
      const result = await invoke("remote:secret-status", {
        ...JSON.parse(JSON.stringify(props.server)),
        auth: auth.value,
      });
      if (version === credentialVersion) savedCredential.value = result;
    } catch {}
  },
  { immediate: true, deep: true },
);
const remotePath = ref(".");
const entries = ref<FileEntry[]>([]);
const fileBusy = ref(false);
const error = ref("");
const editFile = ref("");
const fileText = ref("");
let disposed = false;
let term: Terminal | undefined;
let fit: FitAddon | undefined;
let observer: ResizeObserver | undefined;
let fitFrame = 0;
const offData = window.litebox?.on("ssh:data", (event) => {
  if (event.id === selected.value) term?.write(event.data);
});
const offClose = window.litebox?.on("ssh:closed", (event) => {
  if (event.id === selected.value) {
    connected.value = false;
    term?.writeln("\r\n[Disconnected / 连接已关闭]");
  }
});
function fitTerminal() {
  cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(() => {
    if (
      !disposed &&
      props.active &&
      terminalEl.value?.clientWidth &&
      terminalEl.value?.clientHeight
    )
      fit?.fit();
  });
}
watch([remoteView, () => props.active], async () => {
  await nextTick();
  fitTerminal();
});
watch([connected, connecting], async () => {
  await nextTick();
  fitTerminal();
});
watch([connected, connecting], () =>
  emit("status", connected.value || connecting.value),
);
async function pickKey() {
  try {
    const result = await invoke("ssh:pick-key");
    if (result) keyPath.value = result;
  } catch (e) {
    notify(String(e), true);
  }
}
async function connect() {
  if (!server.value || connecting.value || connected.value || !desktop) return;
  connecting.value = true;
  error.value = "";
  try {
    if (server.value.type === "rdp") {
      await invoke("rdp:connect", JSON.parse(JSON.stringify(server.value)));
      used("remote");
      return;
    }
    remoteView.value = "split";
    await nextTick();
    term?.dispose();
    term = new Terminal({
      cursorBlink: false,
      fontSize: 16,
      lineHeight: 1.35,
      fontFamily: "Cascadia Code, Consolas, monospace",
      theme: palette(),
      scrollback: 3000,
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    term.open(terminalEl.value!);
    fit.fit();
    term.onSelectionChange(() => {
      hasSelection.value = !!term?.hasSelection();
    });
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") return true;
      if (event.ctrlKey && event.shiftKey && event.code === "KeyC") {
        void copyTerminal();
        return false;
      }
      if (event.ctrlKey && event.shiftKey && event.code === "KeyV") {
        void pasteTerminal();
        return false;
      }
      if (
        event.key === "ContextMenu" ||
        (event.shiftKey && event.key === "F10")
      ) {
        void openMenu(event);
        return false;
      }
      return true;
    });
    term.onData((data) =>
      invoke("ssh:write", { id: selected.value, data }).catch((e) => {
        error.value = String(e);
      }),
    );
    term.onResize(({ cols, rows }) =>
      invoke("ssh:resize", { id: selected.value, cols, rows }).catch(() => {}),
    );
    observer?.disconnect();
    observer = new ResizeObserver(fitTerminal);
    observer.observe(terminalEl.value!);
    await invoke("ssh:connect", {
      server: JSON.parse(JSON.stringify(server.value)),
      auth: auth.value,
      password: password.value,
      keyPath: keyPath.value,
      passphrase: passphrase.value,
      cols: term.cols,
      rows: term.rows,
      locale: state.locale,
    });
    if (disposed) {
      await invoke("ssh:disconnect", selected.value);
      return;
    }
    password.value = "";
    passphrase.value = "";
    connected.value = true;
    used("remote");
    await list(".");
    if (!disposed && props.active && terminalEl.value?.isConnected)
      term?.focus();
  } catch (e) {
    error.value = String(e);
    connected.value = false;
  } finally {
    connecting.value = false;
  }
}
async function disconnect() {
  try {
    await invoke("ssh:disconnect", selected.value);
  } catch (e) {
    notify(String(e), true);
  }
  connected.value = false;
  entries.value = [];
}
async function list(path = remotePath.value) {
  fileBusy.value = true;
  try {
    const result = await invoke("sftp:list", { id: selected.value, path });
    remotePath.value = result.path;
    entries.value = result.files;
  } catch (e) {
    notify(String(e), true);
  } finally {
    fileBusy.value = false;
  }
}
function pathOf(name: string) {
  return (remotePath.value === "/" ? "" : remotePath.value) + "/" + name;
}
async function download(entry: FileEntry) {
  fileBusy.value = true;
  try {
    const result = await invoke("sftp:download", {
      id: selected.value,
      path: pathOf(entry.filename),
      name: entry.filename,
    });
    if (result?.saved) notify(t("文件已下载", "File downloaded"));
  } catch (e) {
    notify(String(e), true);
  } finally {
    fileBusy.value = false;
  }
}
async function upload() {
  fileBusy.value = true;
  try {
    await invoke("sftp:upload", {
      id: selected.value,
      path: remotePath.value,
      locale: state.locale,
    });
    await list();
  } catch (e) {
    notify(String(e), true);
  } finally {
    fileBusy.value = false;
  }
}
async function read(entry: FileEntry) {
  if (entry.directory) {
    list(pathOf(entry.filename));
    return;
  }
  fileBusy.value = true;
  try {
    const text = await invoke("sftp:read", {
      id: selected.value,
      path: pathOf(entry.filename),
    });
    editFile.value = pathOf(entry.filename);
    fileText.value = text;
  } catch (e) {
    notify(String(e), true);
  } finally {
    fileBusy.value = false;
  }
}
async function saveRemote() {
  if (fileBusy.value) return;
  fileBusy.value = true;
  try {
    const result = await invoke("sftp:save", {
      id: selected.value,
      path: editFile.value,
      text: fileText.value,
      locale: state.locale,
    });
    if (!result?.saved) return;
    notify(t("远程文件已保存", "Remote file saved"));
    editFile.value = "";
    await list();
  } catch (e) {
    notify(String(e), true);
  } finally {
    fileBusy.value = false;
  }
}
onActivated(() => {
  void nextTick(() => {
    fitTerminal();
    if (props.active && connected.value && terminalEl.value?.isConnected)
      term?.focus();
  });
});
watch(
  () => state.theme,
  () => {
    if (term) term.options.theme = palette();
  },
);
onMounted(() => window.addEventListener("resize", closeMenu));
onUnmounted(() => {
  window.removeEventListener("resize", closeMenu);
  disposed = true;
  cancelAnimationFrame(fitFrame);
  offData?.();
  offClose?.();
  observer?.disconnect();
  term?.dispose();
  if (connected.value || connecting.value)
    invoke("ssh:disconnect", selected.value).catch(() => {});
});
</script>
<template>
  <div class="remote-session">
    <div class="panel connection-panel">
      <div class="panel-heading">
        <div>
          <h2>{{ server.name }}</h2>
          <small class="muted"
            >{{ server.username }}@{{ server.host }}:{{ server.port }}</small
          >
        </div>
        <div class="toolbar">
          <button
            class="text-button"
            :disabled="connected || connecting"
            @click="emit('edit')"
          >
            {{ t("编辑", "Edit") }}</button
          ><button
            class="icon-button"
            :disabled="connected || connecting"
            :aria-label="t('删除连接', 'Delete connection')"
            @click="emit('remove')"
          >
            <Trash2 :size="15" />
          </button>
        </div>
      </div>
      <div v-if="!connected" class="connection-form">
        <template v-if="server.type === 'ssh'"
          ><label
            >{{ t("认证方式", "Authentication")
            }}<AppSelect
              v-model="auth"
              :options="[
                { value: 'password', label: t('密码', 'Password') },
                { value: 'key', label: t('私钥文件', 'Private key') },
              ]"
              :aria-label="t('认证方式', 'Authentication')" /></label
          ><label v-if="auth === 'password'"
            >{{
              savedCredential
                ? t(
                    "密码（已保存，留空自动使用）",
                    "Password (saved; leave blank to use)",
                  )
                : t(
                    "密码（仅用于本次连接）",
                    "Password (this connection only)",
                  )
            }}<input
              v-model="password"
              type="password"
              autocomplete="off"
              @keydown.enter="connect" /></label
          ><template v-else
            ><label
              >{{ t("私钥文件", "Private key file")
              }}<button class="button" @click="pickKey">
                <KeyRound :size="15" />{{
                  keyPath
                    ? keyPath.split(/[\\/]/).at(-1)
                    : savedCredential
                      ? t("使用已存私钥", "Use saved private key")
                      : t("选择文件", "Choose file")
                }}
              </button></label
            ><label
              >{{ t("私钥口令（可选）", "Passphrase (optional)")
              }}<input
                v-model="passphrase"
                type="password"
                autocomplete="off" /></label
          ></template>
        </template>
        <p v-else class="hint">
          {{
            t(
              "在系统远程桌面窗口中登录；已保存的凭据会自动使用，远端策略可能要求重新验证。",
              "Sign in through Windows Remote Desktop. Saved credentials are used automatically; server policy may require verification.",
            )
          }}
        </p>
        <button
          class="button primary"
          :disabled="connecting || !desktop"
          @click="connect"
        >
          <Plug :size="16" />{{
            connecting
              ? t("连接中…", "Connecting…")
              : server.type === "rdp"
                ? t("打开远程桌面", "Open Remote Desktop")
                : t("连接", "Connect")
          }}
        </button>
      </div>
      <div v-else class="connected-toolbar">
        <span
          ><span class="status-dot"></span
          >{{
            t(
              "已连接 · 切换标签保持会话",
              "Connected · tabs keep sessions alive",
            )
          }}</span
        ><button class="button" @click="disconnect">
          <Unplug :size="15" />{{ t("断开", "Disconnect") }}
        </button>
      </div>
    </div>
    <div v-if="error" class="error-banner" role="alert">{{ error }}</div>
    <template v-if="server.type === 'ssh'">
      <div class="remote-workspace-toolbar">
        <div
          class="segmented remote-view-switch"
          role="group"
          :aria-label="t('工作区布局', 'Workspace layout')"
        >
          <button
            :class="{ active: remoteView === 'terminal' }"
            :aria-pressed="remoteView === 'terminal'"
            @click="remoteView = 'terminal'"
          >
            <TerminalSquare :size="18" />{{ t("终端", "Terminal") }}
          </button>
          <button
            :class="{ active: remoteView === 'files' }"
            :aria-pressed="remoteView === 'files'"
            @click="remoteView = 'files'"
          >
            <Folder :size="18" />{{ t("文件管理", "Files") }}
          </button>
          <button
            :class="{ active: remoteView === 'split' }"
            :aria-pressed="remoteView === 'split'"
            @click="remoteView = 'split'"
          >
            {{ t("双面板", "Both panels") }}
          </button>
        </div>
      </div>
      <div class="ssh-workspace" :class="{ split: remoteView === 'split' }">
        <section v-show="remoteView !== 'files'" class="terminal-panel">
          <div class="terminal-title">
            <TerminalSquare :size="15" />{{ t("终端", "Terminal")
            }}<span>{{ connected ? "SSH · ANSI" : "—" }}</span>
            <button
              class="button"
              :disabled="!hasSelection"
              @click="copyTerminal"
            >
              {{ t("复制", "Copy") }}
            </button>
            <button
              class="button"
              :disabled="!connected"
              @click="pasteTerminal()"
            >
              {{ t("粘贴", "Paste") }}
            </button>
            <button
              class="button"
              :disabled="!hasSelection"
              @click="analyzeSelection"
            >
              {{ t("AI分析", "Analyze with AI") }}
            </button>
          </div>
          <div
            ref="terminalEl"
            class="terminal-container"
            @contextmenu.prevent="openMenu"
            @paste.capture="pasteEvent"
          >
            <div v-if="!connected && !connecting" class="terminal-placeholder">
              {{
                t(
                  "建立连接后，即可使用交互式终端。",
                  "Connect to start an interactive terminal.",
                )
              }}
            </div>
          </div>
        </section>
        <section v-show="remoteView !== 'terminal'" class="panel sftp-panel">
          <div class="panel-heading">
            <h2>{{ t("远程文件", "Remote files") }}</h2>
            <div class="toolbar">
              <button
                class="icon-button"
                :disabled="!connected || fileBusy"
                :aria-label="t('上传文件', 'Upload file')"
                @click="upload"
              >
                <Upload :size="15" /></button
              ><button
                class="icon-button"
                :disabled="!connected || fileBusy"
                :aria-label="t('刷新文件', 'Refresh files')"
                @click="list()"
              >
                <RefreshCw :size="15" />
              </button>
            </div>
          </div>
          <form class="path-bar" @submit.prevent="list()">
            <button
              type="button"
              class="icon-button"
              :disabled="!connected || fileBusy"
              :aria-label="t('上级目录', 'Parent folder')"
              @click="list(remotePath + '/..')"
            >
              <ArrowUp :size="15" /></button
            ><input
              v-model="remotePath"
              :disabled="!connected || fileBusy"
              :aria-label="t('远程路径', 'Remote path')"
            />
          </form>
          <div class="file-list-heading">
            <span>{{ t("名称", "Name") }}</span
            ><span>{{ t("大小", "Size") }}</span>
          </div>
          <div class="sftp-files" :aria-busy="fileBusy">
            <p v-if="!entries.length" class="muted small empty-file-hint">
              {{
                fileBusy
                  ? t("正在读取…", "Loading…")
                  : connected
                    ? t("此目录为空", "This folder is empty")
                    : t("连接后查看文件", "Connect to browse files")
              }}
            </p>
            <div
              v-for="entry in entries"
              :key="entry.filename"
              class="file-row"
            >
              <button :disabled="fileBusy" @click="read(entry)">
                <Folder
                  v-if="entry.directory"
                  :size="16"
                  class="folder-icon"
                /><File v-else :size="16" /><span>{{
                  entry.filename
                }}</span></button
              ><small class="file-size">{{
                entry.directory
                  ? "—"
                  : entry.size < 1024
                    ? entry.size + " B"
                    : (entry.size / 1024).toFixed(1) + " KB"
              }}</small
              ><button
                v-if="!entry.directory"
                class="icon-button"
                :disabled="fileBusy"
                :aria-label="t('下载', 'Download') + entry.filename"
                @click="download(entry)"
              >
                <Download :size="13" />
              </button>
            </div>
          </div>
          <div class="editor-footer">
            {{
              fileBusy
                ? t(
                    "传输 / 读取中，请稍候…",
                    "Transferring / reading, please wait…",
                  )
                : t(
                    "文本编辑上限 1 MB · 不提供递归删除",
                    "Text editing up to 1 MB · No recursive deletion",
                  )
            }}
          </div>
        </section>
      </div></template
    >
    <div v-if="editFile" class="remote-editor-overlay">
      <section class="panel remote-file-editor">
        <div class="panel-heading">
          <h2>{{ editFile }}</h2>
          <button
            class="icon-button"
            :aria-label="t('关闭编辑器', 'Close editor')"
            @click="editFile = ''"
          >
            <X :size="18" />
          </button>
        </div>
        <textarea
          v-model="fileText"
          class="code-input tall-text"
          :aria-label="t('远程文件内容', 'Remote file content')"
        />
        <div class="modal-footer">
          <span class="hint">{{
            t(
              "保存前会再次确认覆盖，且检查文件是否已被修改。",
              "Saving requires confirmation and checks for remote changes.",
            )
          }}</span
          ><button
            class="button primary"
            :disabled="fileBusy"
            @click="saveRemote"
          >
            <Save :size="15" />{{ t("保存到服务器", "Save to server") }}
          </button>
        </div>
      </section>
    </div>
    <Teleport to="body"
      ><div
        v-if="contextMenu && active && connected"
        class="terminal-menu-shield"
        @pointerdown.self="closeMenu"
        @contextmenu.prevent="closeMenu"
      >
        <div
          ref="menuEl"
          class="terminal-context-menu"
          role="menu"
          :aria-label="t('终端操作', 'Terminal actions')"
          :style="{
            left: contextMenu.x + 'px',
            top: contextMenu.y + 'px',
          }"
          @keydown="menuKey"
        >
          <button
            role="menuitem"
            :disabled="!contextMenu.selection"
            @click="copyTerminal"
          >
            {{ t("复制选中内容", "Copy selection") }} <kbd>Ctrl ⇧ C</kbd>
          </button>
          <button role="menuitem" @click="pasteTerminal()">
            {{ t("粘贴", "Paste") }} <kbd>Ctrl ⇧ V</kbd>
          </button>
          <button
            role="menuitem"
            :disabled="!contextMenu.selection"
            @click="analyzeSelection"
          >
            {{ t("发送到AI分析（草稿）", "Send to AI (draft)") }}
          </button>
        </div>
      </div></Teleport
    >
  </div>
</template>
