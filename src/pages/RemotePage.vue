<script setup lang="ts">
defineOptions({ name: "RemotePage" });
import { computed, nextTick, ref, watch } from "vue";
import {
  Monitor,
  Plus,
  TerminalSquare,
  Folder,
  Search,
  X,
  Save,
} from "lucide-vue-next";
import AppSelect from "../components/AppSelect.vue";
import RemoteSession from "../components/RemoteSession.vue";
import { state, t, desktop, notify, invoke } from "../lib/store";
import { askConfirm } from "../lib/confirm";
import type { ServerProfile } from "../lib/types";
import "../connections.css";
const selected = ref("");
const tabs = ref<string[]>([]);
const live = ref<Record<string, boolean>>({});
const showServers = ref(true);
const search = ref("");
const editing = ref(false);
const dialogEl = ref<HTMLDialogElement>();
const blank = (): ServerProfile & { auth: "password" | "key" } => ({
  id: crypto.randomUUID(),
  name: "",
  host: "",
  port: 22,
  username: "root",
  type: "ssh",
  group: "",
  auth: "password",
});
const form = ref(blank());
const password = ref("");
const keyPath = ref("");
const passphrase = ref("");
const remember = ref(false);
const savedSecret = ref(false);
const saving = ref(false);
let statusVersion = 0;
watch(
  () => [
    editing.value,
    form.value.id,
    form.value.host,
    form.value.port,
    form.value.username,
    form.value.type,
    form.value.auth,
  ],
  async () => {
    const version = ++statusVersion;
    savedSecret.value = false;
    if (!desktop || !editing.value || !form.value.host) return;
    try {
      const saved = await invoke(
        "remote:secret-status",
        JSON.parse(JSON.stringify(form.value)),
      );
      if (version === statusVersion) {
        savedSecret.value = saved;
        if (saved) remember.value = true;
      }
    } catch {
      /* Incomplete form. */
    }
  },
);
function resetCredentials() {
  password.value = "";
  keyPath.value = "";
  passphrase.value = "";
  remember.value = false;
  savedSecret.value = false;
}
async function pickKey() {
  try {
    const file = await invoke("ssh:pick-key");
    if (file) keyPath.value = file;
  } catch (e) {
    notify(String(e), true);
  }
}
async function forgetSecret() {
  try {
    await invoke(
      "remote:secret-forget",
      JSON.parse(JSON.stringify(form.value)),
    );
    savedSecret.value = false;
    remember.value = false;
    notify(t("已忘记保存的凭据", "Saved credentials forgotten"));
  } catch (e) {
    notify(String(e), true);
  }
}

const grouped = computed(() => {
  const groups = new Map<string, ServerProfile[]>();
  for (const s of state.servers) {
    if (
      !(s.name + " " + s.host + " " + s.group)
        .toLowerCase()
        .includes(search.value.toLowerCase())
    )
      continue;
    const group = s.group || t("未分组", "Ungrouped");
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(s);
  }
  return [...groups];
});
const opened = computed(() =>
  tabs.value
    .map((id) => state.servers.find((s) => s.id === id))
    .filter((s): s is ServerProfile => !!s),
);
function select(id: string) {
  if (!tabs.value.includes(id)) {
    if (tabs.value.length >= 8) {
      notify(
        t(
          "最多打开 8 个会话，请先关闭一个标签",
          "Close a tab before opening more than 8 sessions",
        ),
        true,
      );
      return;
    }
    tabs.value.push(id);
  }
  selected.value = id;
}
async function closeTab(id: string) {
  if (
    live.value[id] &&
    !(await askConfirm(
      t(
        "关闭标签会断开这个 SSH 会话，继续？",
        "Close this tab and disconnect its SSH session?",
      ),
      { danger: true, confirmLabel: t("断开并关闭", "Disconnect and close") },
    ))
  )
    return;
  tabs.value = tabs.value.filter((x) => x !== id);
  delete live.value[id];
  if (selected.value === id) selected.value = tabs.value.at(-1) || "";
}
function add() {
  resetCredentials();
  form.value = blank();
  editing.value = true;
  nextTick(() => dialogEl.value?.showModal());
}
function edit(id: string) {
  const s = state.servers.find((x) => x.id === id);
  if (!s || live.value[id]) return;
  resetCredentials();
  form.value = { ...s, auth: s.auth || "password" };
  editing.value = true;
  nextTick(() => dialogEl.value?.showModal());
}
function closeDialog() {
  if (saving.value) return;
  resetCredentials();
  dialogEl.value?.close();
  editing.value = false;
}
async function save() {
  if (saving.value) return;
  if (
    !form.value.name.trim() ||
    !form.value.host.trim() ||
    !Number.isInteger(form.value.port) ||
    form.value.port < 1 ||
    form.value.port > 65535
  )
    return;
  saving.value = true;
  try {
    if (desktop) {
      const server = JSON.parse(JSON.stringify(form.value));
      if (remember.value)
        await invoke("remote:secret-save", {
          server,
          password: password.value,
          keyPath: keyPath.value,
          passphrase: passphrase.value,
        });
      else await invoke("remote:secret-forget", server);
    }
    const i = state.servers.findIndex((s) => s.id === form.value.id);
    if (i < 0) state.servers.push({ ...form.value });
    else state.servers[i] = { ...form.value };
    select(form.value.id);
    saving.value = false;
    closeDialog();
  } catch (e) {
    notify(String(e), true);
  } finally {
    saving.value = false;
  }
}
async function remove(id: string) {
  if (live.value[id]) return;
  if (
    !(await askConfirm(
      t(
        "删除这条连接配置？不会删除服务器上的任何内容。",
        "Delete this profile? No server data is affected.",
      ),
      { danger: true, confirmLabel: t("删除配置", "Delete profile") },
    ))
  )
    return;
  try {
    const profile = state.servers.find((s) => s.id === id);
    if (desktop && profile)
      await invoke("remote:secret-forget", JSON.parse(JSON.stringify(profile)));
  } catch (e) {
    notify(String(e), true);
    return;
  }
  await closeTab(id);
  state.servers = state.servers.filter((s) => s.id !== id);
}
</script>
<template>
  <div class="page remote-page connection-workbench">
    <div class="workbench-heading">
      <div>
        <h1>{{ t("远程连接", "Remote connections") }}</h1>
        <p>
          {{
            t(
              "资产、会话与文件，一个工作区。",
              "Assets, sessions and files in one workspace.",
            )
          }}
        </p>
      </div>
      <div class="toolbar">
        <button
          class="button"
          :aria-pressed="showServers"
          @click="showServers = !showServers"
        >
          <Monitor :size="18" />{{
            showServers
              ? t("收起服务器列表", "Hide servers")
              : t("显示服务器列表", "Show servers")
          }}</button
        ><button class="button primary" @click="add">
          <Plus :size="18" />{{ t("新建连接", "New connection") }}
        </button>
      </div>
    </div>
    <div v-if="!desktop" class="notice-banner">
      {{
        t(
          "浏览器可管理配置与预览布局；SSH / SFTP 与系统远程桌面需要桌面运行模式。",
          "Manage profiles in this preview. SSH / SFTP and Remote Desktop require desktop mode.",
        )
      }}
    </div>
    <div class="remote-layout" :class="{ 'profiles-hidden': !showServers }">
      <aside v-show="showServers" class="panel server-sidebar">
        <div class="panel-heading">
          <h2>{{ t("资产列表", "Assets") }}</h2>
          <span class="count-badge">{{ state.servers.length }}</span>
        </div>
        <label class="asset-search"
          ><Search :size="17" /><input
            v-model="search"
            :aria-label="t('搜索服务器', 'Search servers')"
            :placeholder="t('搜索名称、地址、分组', 'Name, host or group')"
        /></label>
        <div class="asset-tree">
          <details v-for="[group, items] in grouped" :key="group" open>
            <summary>
              <Folder :size="17" />{{ group }}<small>{{ items.length }}</small>
            </summary>
            <button
              v-for="item in items"
              :key="item.id"
              class="server-item"
              :class="{ active: selected === item.id }"
              @click="select(item.id)"
            >
              <div class="server-type">
                <TerminalSquare v-if="item.type === 'ssh'" :size="19" /><Monitor
                  v-else
                  :size="19"
                />
              </div>
              <div>
                <strong>{{ item.name }}</strong
                ><small>{{ item.host }}:{{ item.port }}</small>
              </div>
              <span v-if="live[item.id]" class="status-dot" /><span
                v-else
                class="tiny-tag"
                >{{ item.type.toUpperCase() }}</span
              >
            </button>
          </details>
          <p v-if="!grouped.length" class="empty-file-hint muted">
            {{
              search
                ? t("没有匹配的资产", "No matching assets")
                : t(
                    "点击新建连接，添加服务器",
                    "Add a server with New connection",
                  )
            }}
          </p>
        </div>
        <p class="sidebar-hint">
          {{
            t(
              "凭据可选择系统加密保存。切换功能保持会话，关闭标签或主动断开才会释放 SSH。Windows RDP 使用独立系统窗口。",
              "Credentials can be OS-encrypted. Switching features keeps sessions alive; close the tab or disconnect explicitly to release SSH. RDP opens in a separate system window.",
            )
          }}
        </p>
      </aside>
      <section class="remote-main panel">
        <div
          class="session-tabs"
          role="tablist"
          :aria-label="t('远程会话', 'Remote sessions')"
        >
          <span v-if="!opened.length" class="muted">{{
            t("会话工作区", "Session workspace")
          }}</span>
          <div
            v-for="item in opened"
            :key="item.id"
            class="session-tab"
            :class="{ active: selected === item.id }"
          >
            <button
              role="tab"
              :id="'tab-' + item.id"
              :aria-controls="'session-' + item.id"
              :aria-selected="selected === item.id"
              @click="selected = item.id"
            >
              <TerminalSquare :size="17" /><span>{{ item.name }}</span
              ><span v-if="live[item.id]" class="status-dot" />
            </button>
            <button
              class="icon-button"
              :aria-label="t('关闭会话 ', 'Close session ') + item.name"
              @click="closeTab(item.id)"
            >
              <X :size="16" />
            </button>
          </div>
        </div>
        <div v-if="!opened.length" class="remote-empty empty-state">
          <TerminalSquare :size="40" :stroke-width="1.3" />
          <h2>{{ t("选择资产，开始工作", "Select an asset to start") }}</h2>
          <p>
            {{
              t(
                "左侧管理服务器，中间使用终端，右侧浏览和传输文件。",
                "Your assets on the left, a terminal in the center and files on the right.",
              )
            }}
          </p>
          <button class="button" @click="add">
            <Plus :size="17" />{{ t("添加连接", "Add a connection") }}
          </button>
        </div>
        <div
          v-for="item in opened"
          :key="item.id"
          v-show="selected === item.id"
          role="tabpanel"
          :id="'session-' + item.id"
          :aria-labelledby="'tab-' + item.id"
        >
          <RemoteSession
            :server="item"
            :active="selected === item.id"
            @status="live[item.id] = $event"
            @edit="edit(item.id)"
            @remove="remove(item.id)"
          />
        </div>
      </section>
    </div>
    <dialog
      v-if="editing"
      ref="dialogEl"
      class="modal remote-profile-dialog"
      aria-labelledby="remote-profile-title"
      @cancel.prevent="closeDialog"
    >
      <form @submit.prevent="save">
        <div class="panel-heading remote-profile-header">
          <h2 id="remote-profile-title">
            {{ t("连接配置", "Connection profile") }}
          </h2>
          <button
            class="icon-button"
            type="button"
            :aria-label="t('关闭', 'Close')"
            :disabled="saving"
            @click="closeDialog"
          >
            <X :size="18" />
          </button>
        </div>
        <div class="remote-form-scroll">
          <fieldset :disabled="saving" class="remote-form-fields">
            <div class="modal-body form-grid two-columns">
              <label class="span-two"
                >{{ t("名称", "Name")
                }}<input
                  v-model="form.name"
                  required
                  maxlength="80"
                  autofocus
                  :placeholder="
                    t('例如：开发服务器', 'For example: Development server')
                  " /></label
              ><label
                >{{ t("连接类型", "Connection type")
                }}<AppSelect
                  v-model="form.type"
                  :options="[
                    { value: 'ssh', label: 'Linux / SSH' },
                    { value: 'rdp', label: 'Windows / RDP' },
                  ]"
                  @change="
                    form.port = form.type === 'ssh' ? 22 : 3389;
                    form.username =
                      form.type === 'ssh' ? 'root' : 'Administrator';
                  "
                  :aria-label="t('连接类型', 'Connection type')" /></label
              ><label
                >{{ t("端口", "Port")
                }}<input
                  v-model.number="form.port"
                  type="number"
                  min="1"
                  max="65535"
                  required /></label
              ><label class="span-two"
                >{{ t("主机地址", "Hostname or IP")
                }}<input
                  v-model="form.host"
                  required
                  placeholder="192.168.1.10"
                  spellcheck="false" /></label
              ><label
                >{{ t("用户名", "Username")
                }}<input v-model="form.username" required /></label
              ><label
                >{{ t("分组备注", "Group / note") }}<input v-model="form.group"
              /></label>
            </div>
            <div class="credential-section">
              <div class="panel-heading">
                <h3>{{ t("身份验证", "Authentication") }}</h3>
                <span class="tag">{{ t("系统加密", "OS encrypted") }}</span>
              </div>
              <div class="form-grid two-columns">
                <label v-if="form.type === 'ssh'" class="span-two"
                  >{{ t("认证方式", "Authentication method")
                  }}<AppSelect
                    v-model="form.auth"
                    :options="[
                      { value: 'password', label: t('密码', 'Password') },
                      { value: 'key', label: t('私钥', 'Private key') },
                    ]"
                /></label>
                <label
                  v-if="form.type === 'rdp' || form.auth !== 'key'"
                  class="span-two"
                  >{{ t("连接密码", "Connection password")
                  }}<input
                    v-model="password"
                    type="password"
                    autocomplete="new-password"
                    :disabled="!desktop"
                    :placeholder="
                      savedSecret
                        ? t(
                            '已保存，留空保持不变',
                            'Saved; leave blank to keep',
                          )
                        : t('输入连接密码', 'Enter connection password')
                    "
                /></label>
                <template v-else
                  ><label class="span-two"
                    >{{ t("私钥文件", "Private key file")
                    }}<button
                      class="button remote-key-picker"
                      type="button"
                      :title="keyPath || undefined"
                      :disabled="!desktop"
                      @click="pickKey"
                    >
                      {{
                        keyPath
                          ? keyPath.split(/[\\/]/).at(-1)
                          : savedSecret
                            ? t(
                                "已保存私钥，点击更换",
                                "Key saved; choose to replace",
                              )
                            : t("选择私钥文件", "Choose private key file")
                      }}
                    </button></label
                  ><label class="span-two"
                    >{{ t("私钥口令（可选）", "Passphrase (optional)")
                    }}<input
                      v-model="passphrase"
                      type="password"
                      autocomplete="new-password"
                      :disabled="!desktop" /></label
                ></template>
                <label class="credential-check span-two"
                  ><input
                    v-model="remember"
                    type="checkbox"
                    :disabled="!desktop"
                  />{{
                    t(
                      "记住凭据（使用当前系统账户加密）",
                      "Remember credentials (encrypted for this OS account)",
                    )
                  }}</label
                >
              </div>
              <p class="hint">
                {{
                  !desktop
                    ? t(
                        "浏览器不保存密码或私钥，请在桌面模式配置。",
                        "Passwords and keys are not saved in the browser. Use desktop mode.",
                      )
                    : t(
                        "勾选后随配置保存；私钥文件内容及口令一并加密。凭据不包含在配置备份中。未勾选则需连接时输入。",
                        "When checked, credentials are saved with this profile. Key contents and passphrases are encrypted and excluded from backups. Otherwise enter credentials when connecting.",
                      )
                }}
              </p>
              <p v-if="form.type === 'rdp'" class="hint">
                {{
                  t(
                    "RDP 将使用 Windows 加密凭据；远端安全策略仍可能要求再次输入密码。不支持 SSH 私钥。",
                    "RDP uses Windows-protected credentials; server policy may still prompt for a password. SSH keys do not apply.",
                  )
                }}
              </p>
              <button
                v-if="savedSecret"
                class="button"
                type="button"
                @click="forgetSecret"
              >
                {{ t("忘记已存凭据", "Forget saved credentials") }}
              </button>
            </div>
          </fieldset>
        </div>
        <div class="modal-footer">
          <button type="button" class="button" @click="closeDialog">
            {{ t("取消", "Cancel") }}</button
          ><button class="button primary" type="submit" :disabled="saving">
            <Save :size="15" />{{ t("保存连接", "Save connection") }}
          </button>
        </div>
      </form>
    </dialog>
  </div>
</template>
