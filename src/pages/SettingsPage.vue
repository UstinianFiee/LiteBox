<script setup lang="ts">
import AppSelect from "../components/AppSelect.vue";
import { ref } from "vue";
import {
  Save,
  KeyRound,
  FolderOpen,
  Download,
  Upload,
  ShieldCheck,
  Trash2,
  Languages,
  Sun,
  Moon,
} from "lucide-vue-next";
import { state, ui, t, invoke, desktop, notify } from "../lib/store";
import { askConfirm } from "../lib/confirm";
const key = ref("");
const busy = ref(false);
const info = ref("");
async function saveAI() {
  busy.value = true;
  try {
    await invoke("ai:configure", { ...state.ai, key: key.value });
    key.value = "";
    const app = await invoke("app:info");
    ui.secretSaved = app.secretSaved;
    notify(t("AI 配置已保存", "AI configuration saved"));
  } catch (e) {
    notify(String(e), true);
  } finally {
    busy.value = false;
  }
}
async function backup() {
  try {
    await invoke("backup:export", JSON.parse(JSON.stringify(state)));
  } catch (e) {
    notify(String(e), true);
  }
}
async function restore() {
  if (
    !(await askConfirm(
      t(
        "恢复备份会替换当前设置、文档草稿、会话和片段。是否继续？",
        "Restoring replaces your settings, draft, chats and snippets. Continue?",
      ),
      { confirmLabel: t("恢复备份", "Restore backup") },
    ))
  )
    return;
  try {
    const result = await invoke("backup:import");
    if (result) {
      Object.assign(state, result);
      state.markdown.path = "";
      notify(
        t(
          "已恢复配置；密码、密钥和附件原文件需另行保留",
          "Configuration restored. Preserve credentials and attachment files separately.",
        ),
      );
    }
  } catch (e) {
    notify(String(e), true);
  }
}
async function clearKey() {
  if (
    !(await askConfirm(t("删除保存的 API Key？", "Remove the saved API key?"), {
      danger: true,
      confirmLabel: t("删除 Key", "Remove key"),
    }))
  )
    return;
  try {
    await invoke("ai:clear-key");
    ui.secretSaved = false;
    notify(t("API Key 已删除", "API key removed"));
  } catch (e) {
    notify(String(e), true);
  }
}
</script>
<template>
  <div class="page settings-page">
    <div class="page-heading">
      <div>
        <div class="eyebrow">PREFERENCES</div>
        <h1>{{ t("设置", "Settings") }}</h1>
        <p>
          {{
            t(
              "顺手的工具，也应该顺你的习惯。",
              "A useful toolbox should feel like your own.",
            )
          }}
        </p>
      </div>
      <span class="tag">LiteBox {{ ui.version }}</span>
    </div>
    <div class="settings-grid">
      <section class="panel settings-section">
        <div class="section-heading">
          <h2>{{ t("外观与语言", "Appearance & language") }}</h2>
          <Languages :size="19" />
        </div>
        <div class="setting-row">
          <div>
            <strong>{{ t("界面语言", "Interface language") }}</strong>
            <p>
              {{
                t("立即切换，无需重启", "Switch instantly, no restart needed")
              }}
            </p>
          </div>
          <AppSelect
            v-model="state.locale"
            :options="[
              { value: 'zh', label: '简体中文' },
              { value: 'en', label: 'English' },
            ]"
            :aria-label="t('界面语言', 'Interface language')"
          />
        </div>
        <div class="setting-row">
          <div>
            <strong>{{ t("主题", "Theme") }}</strong>
            <p>
              {{ t("选择适合你的工作氛围", "Choose your working atmosphere") }}
            </p>
          </div>
          <div class="segmented">
            <button
              :class="{ active: state.theme === 'light' }"
              @click="state.theme = 'light'"
            >
              <Sun :size="15" />{{ t("浅色", "Light") }}</button
            ><button
              :class="{ active: state.theme === 'dark' }"
              @click="state.theme = 'dark'"
            >
              <Moon :size="15" />{{ t("深色", "Dark") }}
            </button>
          </div>
        </div>
      </section>
      <section class="panel settings-section">
        <div class="section-heading">
          <h2>{{ t("数据与备份", "Data & backups") }}</h2>
          <ShieldCheck :size="19" />
        </div>
        <p class="muted">
          {{
            t(
              "便携版将数据存放在程序旁的 litebox-data 文件夹。系统加密的密钥只适用于当前 Windows 用户。",
              "Portable data lives in litebox-data beside the app. Encrypted keys are tied to the current Windows user.",
            )
          }}
        </p>
        <div class="data-path">
          {{
            ui.dataDir ||
            t(
              "浏览器预览：数据存储在当前浏览器",
              "Browser preview: data is stored in this browser",
            )
          }}
        </div>
        <div class="toolbar">
          <button
            class="button"
            :disabled="!desktop"
            @click="
              invoke('app:open-data').catch((e) => notify(String(e), true))
            "
          >
            <FolderOpen :size="15" />{{ t("打开目录", "Open folder") }}</button
          ><button class="button" :disabled="!desktop" @click="backup">
            <Download :size="15" />{{ t("备份", "Backup") }}</button
          ><button class="button" :disabled="!desktop" @click="restore">
            <Upload :size="15" />{{ t("恢复", "Restore") }}
          </button>
        </div>
        <p class="hint">
          {{
            t(
              "配置备份包含草稿、对话和附件引用，不含附件原文件、密码或私钥。完整迁移请退出应用后备份整个 litebox-data（含 ai-attachments）。",
              "Configuration backups include drafts, chats and attachment references, not attachment files or credentials. For full migration, close the app and copy the entire litebox-data folder, including ai-attachments.",
            )
          }}
        </p>
      </section>
      <section class="panel settings-section ai-settings">
        <div class="section-heading">
          <h2>{{ t("AI 模型服务", "AI provider") }}</h2>
          <KeyRound :size="19" />
        </div>
        <p class="muted">
          {{
            t(
              "支持 Chat Completions 兼容接口。请求从桌面主进程发出，不经过轻匣服务器。",
              "Supports Chat Completions-compatible APIs. Requests go directly from the desktop app to your provider.",
            )
          }}
        </p>
        <div class="form-grid two-columns">
          <label
            >{{ t("接口基础地址", "API base URL")
            }}<input
              v-model="state.ai.endpoint"
              placeholder="https://api.example.com/v1"
              spellcheck="false"
            /><small>{{
              t(
                "仅允许 HTTPS，或本机 localhost HTTP",
                "HTTPS only; localhost HTTP is allowed",
              )
            }}</small></label
          ><label
            >{{ t("模型名称", "Model name")
            }}<input
              v-model="state.ai.model"
              :placeholder="
                t(
                  '填写服务商提供的模型 ID',
                  'Enter the model ID from your provider',
                )
              "
              spellcheck="false" /></label
          ><label class="span-two"
            >API Key
            <span v-if="ui.secretSaved" class="saved-indicator">{{
              t("已加密保存", "Encrypted key saved")
            }}</span
            ><input
              v-model="key"
              type="password"
              autocomplete="new-password"
              :placeholder="
                ui.secretSaved
                  ? t(
                      '留空则保留现有密钥',
                      'Leave blank to keep the existing key',
                    )
                  : t(
                      '输入密钥；本机免密服务可留空',
                      'Enter a key; optional for a local unauthenticated server',
                    )
              " /></label
          ><label class="span-two"
            >{{ t("补充偏好（可选）", "Additional preferences (optional)")
            }}<textarea
              v-model="state.ai.system"
              rows="3"
              :placeholder="
                t(
                  '例如：回答尽量简洁，给出可以核对的步骤。',
                  'For example: be concise and include verifiable steps.',
                )
              "
            />
          </label>
        </div>
        <div class="toolbar mt-16">
          <span class="hint">{{
            t(
              "不自动发送测试请求。保存后在 AI 助手中提问即可。",
              "No automatic test request. Save, then ask in AI assistant.",
            )
          }}</span
          ><button
            class="button"
            :disabled="!ui.secretSaved || busy"
            @click="clearKey"
          >
            <Trash2 :size="15" />{{ t("删除密钥", "Remove key") }}</button
          ><button
            class="button primary"
            :disabled="busy || !desktop"
            @click="saveAI"
          >
            <Save :size="15" />{{
              busy
                ? t("保存中…", "Saving…")
                : t("保存 AI 配置", "Save AI settings")
            }}
          </button>
        </div>
      </section>
      <section class="panel settings-section about-section">
        <img src="/logo.svg" alt="" width="44" height="44" />
        <div>
          <h2>LiteBox <span class="muted">轻匣</span></h2>
          <p>
            {{
              t(
                "小工具，大顺手。为一个人的日常而造。",
                "Small tools. Smoother days. Built for your personal workflow.",
              )
            }}
          </p>
          <p class="hint">
            Vue · Electron · xterm.js · ssh2 · ECharts · marked · DOMPurify
          </p>
        </div>
        <button
          class="button"
          :disabled="!desktop"
          @click="
            invoke('app:licenses')
              .then((r) => (info = r))
              .catch((e) => notify(String(e), true))
          "
        >
          {{ t("开源许可", "Open-source licenses") }}
        </button>
      </section>
    </div>
    <details v-if="info" class="panel license-panel" open>
      <summary>{{ t("第三方许可", "Third-party notices") }}</summary>
      <pre>{{ info }}</pre>
    </details>
  </div>
</template>
