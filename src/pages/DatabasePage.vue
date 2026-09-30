<script setup lang="ts">
defineOptions({ name: "DatabasePage" });
import {
  Database,
  Copy,
  Upload,
  Plus,
  Search,
  Table2,
  Play,
  Square,
  RefreshCw,
  Plug,
  Unplug,
  FolderOpen,
  Download,
  FileCode2,
  ShieldCheck,
  X,
  Trash2,
  Pencil,
  FlaskConical,
} from "lucide-vue-next";
import { ref } from "vue";
import DatabaseDataDialog from "../components/DatabaseDataDialog.vue";
import PaginationBar from "../components/PaginationBar.vue";
import PaneDivider from "../components/PaneDivider.vue";
import AppSelect from "../components/AppSelect.vue";
import { desktop, t } from "../lib/store";
import { useDatabase } from "../lib/useDatabase";
import "../connections.css";
import "../database.css";
const editorHeight = ref(160),
  sidebarWidth = ref(270);
const dataDialog = ref<InstanceType<typeof DatabaseDataDialog>>();
const dbNames: Record<string, string> = {
  mysql: "MySQL / MariaDB",
  postgres: "PostgreSQL",
  sqlite: "SQLite",
  oracle: "Oracle",
  mongodb: "MongoDB",
  redis: "Redis",
};
const {
  displayPage,
  pageSize,
  catalogPage,
  catalogSize,
  changePage,
  resizePage,
  resizeCatalog,
  afterWrite,
  rememberPassword,
  secretSaved,
  forgetPassword,
  exportFormat,
  copyResults,
  targetSchema,
  targetTable,
  selected,
  connected,
  busy,
  error,
  password,
  search,
  sql,
  demo,
  catalog,
  catalogTruncated,
  table,
  view,
  editing,
  dialogEl,
  testMessage,
  form,
  formPassword,
  profile,
  profiles,
  schemas,
  displayed,
  select,
  add,
  edit,
  closeDialog,
  changeType,
  pickFile,
  save,
  test,
  refresh,
  connect,
  disconnect,
  openTable,
  run,
  cancel,
  remove,
  fromBuilder,
  download,
  showDemo,
} = useDatabase();
</script>
<template>
  <div class="page connection-workbench database-page">
    <div class="workbench-heading">
      <div>
        <h1>{{ t("数据库连接", "Databases") }}</h1>
        <p>
          {{
            t(
              "连接、对象浏览与 SQL 查询，清晰地放在一起。",
              "Connections, objects and SQL queries in one workspace.",
            )
          }}
        </p>
      </div>
      <div class="toolbar">
        <button class="button" :disabled="connected || busy" @click="showDemo">
          <FlaskConical :size="18" />{{ t("查看示例", "View demo") }}</button
        ><button class="button primary" :disabled="busy" @click="add">
          <Plus :size="18" />{{
            t("新建数据库连接", "New database connection")
          }}
        </button>
      </div>
    </div>
    <div v-if="!desktop" class="notice-banner">
      {{
        t(
          "浏览器预览：可编辑连接配置、SQL 与查看示例；真实数据库连接请用 npm run dev 启动桌面运行模式，无需打包。",
          "Browser preview: edit profiles and SQL or explore the demo. Run npm run dev for real database connections; no packaging required.",
        )
      }}
    </div>
    <div v-if="demo" class="notice-banner db-demo" role="status">
      <FlaskConical :size="18" />{{
        t(
          "示例预览 · 下方是内置虚构数据，没有连接或查询你的数据库。修改 SQL 不会模拟执行。",
          "DEMO · Built-in fictional data, not a database connection or query. Edited SQL is not simulated.",
        )
      }}
    </div>
    <div
      class="database-layout"
      :style="{ '--db-sidebar': sidebarWidth + 'px' }"
    >
      <aside class="panel db-explorer">
        <div class="panel-heading">
          <h2>{{ t("连接与对象", "Connections & objects") }}</h2>
          <Database :size="18" />
        </div>
        <label class="asset-search"
          ><Search :size="17" /><input
            v-model="search"
            :aria-label="t('搜索数据库连接', 'Search database connections')"
            :placeholder="t('搜索连接', 'Search connections')"
        /></label>
        <div class="db-tree">
          <p v-if="!profiles.length" class="empty-file-hint muted">
            {{
              search
                ? t("没有匹配的连接", "No matching connections")
                : t(
                    "新建连接，或先查看示例",
                    "Create a connection or explore the demo",
                  )
            }}
          </p>
          <button
            v-for="p in profiles"
            :key="p.id"
            class="db-profile"
            :class="{ active: selected === p.id }"
            :disabled="busy"
            @click="select(p.id)"
          >
            <Database :size="19" /><span
              ><strong>{{ p.name }}</strong
              ><small
                >{{ dbNames[p.type] }}
                ·
                {{ p.database || p.host || t("本地文件", "Local file") }}</small
              ></span
            ><span v-if="selected === p.id && connected" class="status-dot" />
          </button>
          <div v-if="connected || demo" class="db-objects">
            <div class="db-tree-heading">
              <span>{{
                demo
                  ? "demo"
                  : profile?.database || t("当前数据库", "Current database")
              }}</span
              ><button
                class="icon-button"
                :disabled="busy || demo"
                :aria-label="t('刷新库表', 'Refresh tables')"
                @click="refresh()"
              >
                <RefreshCw :size="16" />
              </button>
            </div>
            <details v-for="schema in schemas" :key="schema" open>
              <summary><FolderOpen :size="17" />{{ schema }}</summary>
              <button
                v-for="entry in catalog.filter((c) => c.schema === schema)"
                :key="entry.name"
                class="db-table"
                :class="{ active: table === schema + '.' + entry.name }"
                :disabled="busy"
                @click="openTable(schema, entry.name)"
              >
                <Table2 :size="16" /><span>{{ entry.name }}</span
                ><small>{{
                  /view/i.test(entry.type) ? t("视图", "View") : ""
                }}</small>
              </button>
            </details>
            <p v-if="!catalog.length" class="empty-file-hint muted">
              {{
                busy
                  ? t("读取对象中…", "Loading objects…")
                  : t(
                      "当前库无可见表。MySQL 请先在配置中填写数据库名。",
                      "No visible tables. For MySQL, specify a database in the profile.",
                    )
              }}
            </p>
          </div>
        </div>
        <PaginationBar
          v-if="connected || demo"
          compact
          :page="catalogPage"
          :page-size="catalogSize"
          :total="demo ? catalog.length : -1"
          :has-next="catalogTruncated"
          :busy="busy"
          @update:page="refresh"
          @update:page-size="resizeCatalog"
        />
        <p class="sidebar-hint">
          <ShieldCheck :size="16" />
          {{
            t(
              "查询默认只读；数据编辑需单独确认。密码可使用系统加密保存，不进入配置备份。切换功能保留连接，手动断开或退出应用后结束。",
              "Queries are read-only; data edits require confirmation. Saved passwords are OS-encrypted and excluded from configuration backups. Switching tools keeps the connection alive until you disconnect or exit the app.",
            )
          }}
        </p>
      </aside>
      <PaneDivider
        v-model="sidebarWidth"
        axis="x"
        :min="210"
        :max="480"
        :label="t('调整对象列表宽度', 'Resize object explorer')"
      />
      <section class="panel db-workspace">
        <div class="db-context">
          <div>
            <Database :size="19" /><strong>{{
              demo
                ? t("示例数据库", "Demo database")
                : profile?.name || t("尚未选择连接", "No connection selected")
            }}</strong
            ><span class="db-state">{{
              demo
                ? t("示例", "Demo")
                : connected
                  ? t("已连接 · 安全查询", "Connected · safe queries")
                  : t("未连接", "Disconnected")
            }}</span>
          </div>
          <div class="toolbar" v-if="profile">
            <button
              class="icon-button"
              :disabled="connected || busy"
              :aria-label="t('编辑数据库连接', 'Edit database connection')"
              @click="edit"
            >
              <Pencil :size="17" /></button
            ><button
              class="icon-button"
              :disabled="connected || busy"
              :aria-label="t('删除数据库连接', 'Delete database connection')"
              @click="remove"
            >
              <Trash2 :size="17" />
            </button>
          </div>
        </div>
        <div v-if="profile && !connected" class="db-auth">
          <template v-if="profile.type !== 'sqlite'"
            ><label
              >{{
                t(
                  "密码（留空使用已存密码）",
                  "Password (blank uses saved password)",
                )
              }}<input
                v-model="password"
                type="password"
                autocomplete="off"
                :disabled="busy || !desktop"
                @keydown.enter="connect" /></label
            ><span class="hint"
              >{{ profile.host }}:{{ profile.port }} ·
              {{
                profile.tls
                  ? t("TLS 证书校验", "TLS verified")
                  : t(
                      "未启用 TLS，仅用于可信网络",
                      "No TLS — trusted networks only",
                    )
              }}</span
            ></template
          ><template v-else
            ><button
              class="button"
              :disabled="busy || !desktop"
              @click="pickFile('profile')"
            >
              <FolderOpen :size="17" />{{
                t("选择 / 授权 SQLite 文件", "Choose / authorize SQLite file")
              }}</button
            ><span class="hint db-file-path">{{ profile.path }}</span></template
          ><button
            class="button primary"
            :disabled="busy || !desktop"
            @click="connect"
          >
            <Plug :size="17" />{{
              busy
                ? t("连接中…", "Connecting…")
                : t("连接数据库", "Connect database")
            }}
          </button>
        </div>
        <div v-if="profile && secretSaved" class="db-secret-status">
          <ShieldCheck :size="16" />{{
            t(
              "已加密保存密码 · 当前系统账户可用",
              "Password encrypted · available to this OS account",
            )
          }}<button class="button" :disabled="busy" @click="forgetPassword">
            {{ t("忘记密码", "Forget password") }}
          </button>
        </div>
        <div v-if="connected" class="db-connected">
          <span class="hint">{{
            profile?.type === "sqlite"
              ? profile.path
              : profile?.host +
                ":" +
                profile?.port +
                " / " +
                (profile?.database || "default")
          }}</span
          ><button class="button" :disabled="busy" @click="disconnect">
            <Unplug :size="17" />{{ t("断开数据库", "Disconnect database") }}
          </button>
        </div>
        <div v-if="error" class="error-banner" role="alert">{{ error }}</div>
        <div class="db-query-heading">
          <h2><FileCode2 :size="18" />{{ t("查询编辑器", "Query editor") }}</h2>
          <span class="hint">Ctrl + Enter</span>
        </div>
        <div class="db-query-toolbar">
          <button
            class="button primary"
            :disabled="!connected || busy || demo || !sql.trim()"
            @click="run()"
          >
            <Play :size="16" />{{ t("运行查询", "Run query") }}</button
          ><button
            class="button"
            :disabled="!busy || editing || !selected || !desktop"
            @click="cancel"
          >
            <Square :size="15" />{{
              t("停止并断开", "Stop & disconnect")
            }}</button
          ><button class="button" :disabled="busy" @click="fromBuilder">
            <FileCode2 :size="16" />{{
              t("导入 SQL 处理草稿", "Use SQL builder draft")
            }}
          </button>
        </div>
        <p
          v-if="profile?.type === 'mongodb' || profile?.type === 'redis'"
          class="hint db-command-hint"
        >
          {{
            profile.type === "mongodb"
              ? t(
                  "MongoDB：JSON find 查询；文档使用 Extended JSON 表示。",
                  "MongoDB: JSON find queries; documents use Extended JSON.",
                )
              : t(
                  "Redis：JSON 命令数组。支持 GET、MGET、TYPE、TTL、EXISTS、HGET、LRANGE、SCAN。SCAN 自动分页扫描。",
                  "Redis: JSON command arrays. GET, MGET, TYPE, TTL, EXISTS, HGET, LRANGE, SCAN. SCAN is paginated automatically.",
                )
          }}
        </p>
        <div class="db-query-toolbar">
          <button
            class="button"
            :disabled="busy"
            @click="dataDialog?.open('insert')"
          >
            <Plus :size="16" />{{ t("新增 / 导入", "Insert / import") }}</button
          ><button
            class="button"
            :disabled="busy || !profile"
            @click="dataDialog?.open('update')"
          >
            <Pencil :size="16" />{{ t("修改数据", "Update data") }}</button
          ><button
            class="button"
            :disabled="busy || !profile"
            @click="dataDialog?.open('delete')"
          >
            <Trash2 :size="16" />{{ t("删除数据", "Delete data") }}
          </button>
        </div>
        <textarea
          v-model="sql"
          class="code-input db-sql"
          :style="{ height: editorHeight + 'px' }"
          spellcheck="false"
          :disabled="busy"
          :aria-label="t('数据库 SQL 编辑器', 'Database SQL editor')"
          @keydown.ctrl.enter.prevent="run()"
          @keydown.meta.enter.prevent="run()"
        />
        <PaneDivider
          v-model="editorHeight"
          :min="80"
          :max="480"
          :label="t('调整编辑器和结果区域高度', 'Resize editor and results')"
        />
        <div class="db-result-toolbar">
          <div
            class="segmented"
            role="group"
            :aria-label="t('数据库结果视图', 'Database result view')"
          >
            <button
              :class="{ active: view === 'result' }"
              :aria-pressed="view === 'result'"
              @click="view = 'result'"
            >
              {{ t("查询结果", "Query results") }}</button
            ><button
              :class="{ active: view === 'structure' }"
              :aria-pressed="view === 'structure'"
              @click="view = 'structure'"
            >
              {{ t("表结构", "Table structure") }}
            </button>
          </div>
          <div class="toolbar db-export-actions">
            <button
              class="button"
              :disabled="!displayed || busy"
              @click="copyResults(true)"
            >
              <Copy :size="16" />{{ t("复制表头+内容", "Copy with headers") }}
            </button>
            <button
              class="button"
              :disabled="!displayed || busy"
              @click="copyResults(false)"
            >
              <Copy :size="16" />{{ t("仅复制内容", "Copy contents") }}
            </button>
            <AppSelect
              v-model="exportFormat"
              :aria-label="t('导出格式', 'Export format')"
              :options="[
                { value: 'csv', label: 'CSV' },
                { value: 'tsv', label: 'TSV' },
                { value: 'json', label: 'JSON' },
                { value: 'sql', label: 'SQL (INSERT)' },
              ]"
            />
            <button
              class="button"
              :disabled="
                !displayed ||
                busy ||
                (exportFormat === 'sql' &&
                  (view !== 'result' ||
                    !targetTable ||
                    profile?.type === 'mongodb' ||
                    profile?.type === 'redis'))
              "
              @click="download"
            >
              <Download :size="16" />{{ t("导出", "Export") }}
            </button>
          </div>
        </div>
        <div
          class="db-grid"
          :aria-busy="busy"
          tabindex="0"
          :aria-label="t('数据库结果表格', 'Database result grid')"
        >
          <table v-if="displayed">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th v-for="(name, i) in displayed.columns" :key="i" scope="col">
                  {{ name }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in displayed.rows" :key="index">
                <th scope="row">{{ (displayed.offset || 0) + index + 1 }}</th>
                <td
                  v-for="(value, i) in row"
                  :key="i"
                  :title="value === null ? 'NULL' : value"
                >
                  <span v-if="value === null" class="db-null">NULL</span
                  ><template v-else>{{ value }}</template>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-state db-grid-empty">
            <Table2 :size="32" :stroke-width="1.3" />
            <h3>
              {{
                busy
                  ? t("正在处理…", "Working…")
                  : view === "structure"
                    ? t(
                        "选择表，查看字段结构",
                        "Select a table to inspect its columns",
                      )
                    : t(
                        "查询结果会显示在这里",
                        "Your query results appear here",
                      )
              }}
            </h3>
            <p>
              {{
                t(
                  "选择左侧的表会生成查询草稿，不会自动执行。",
                  "Selecting a table prepares a query; it does not run automatically.",
                )
              }}
            </p>
          </div>
        </div>
        <div class="db-result-footer">
          <div
            class="db-result-status"
            role="status"
            :title="
              t(
                '逐页读取，不截断内容 · 复制/导出当前页 · 建议 ORDER BY 稳定排序',
                'Paged reads · copy/export current page · use ORDER BY for stable ordering',
              )
            "
          >
            <span
              >{{
                displayed
                  ? displayed.rows.length + " " + t("行", "rows")
                  : t("就绪", "Ready")
              }}<template v-if="displayed && !demo">
                · {{ displayed.elapsedMs }} ms</template
              ><template v-if="demo">
                · {{ t("虚构示例数据", "Fictional demo data") }}</template
              ></span
            ><strong v-if="displayed?.truncated">{{
              t(
                "旧结果未分页，请重新运行查询",
                "Run the query again to enable paging",
              )
            }}</strong>
          </div>
          <PaginationBar
            v-if="displayed"
            :page="displayPage"
            :page-size="pageSize"
            :total="demo ? displayed.rows.length : -1"
            :has-next="!!displayed.hasMore"
            :busy="busy"
            @update:page="changePage"
            @update:page-size="resizePage"
          />
        </div>
      </section>
    </div>
    <DatabaseDataDialog
      ref="dataDialog"
      :profile="profile"
      :schema="targetSchema"
      :table="targetTable"
      :connected="connected"
      @applied="afterWrite"
    />
    <dialog
      v-if="editing"
      ref="dialogEl"
      class="modal db-modal"
      aria-labelledby="db-profile-title"
      @cancel.prevent="closeDialog"
    >
      <form @submit.prevent="save">
        <div class="panel-heading">
          <div>
            <span class="db-dialog-eyebrow">CONNECTION SETTINGS</span>
            <h2 id="db-profile-title">
              {{ t("数据库连接配置", "Database connection profile") }}
            </h2>
          </div>
          <button
            type="button"
            class="icon-button"
            :disabled="busy"
            :aria-label="t('关闭数据库配置', 'Close database profile')"
            @click="closeDialog"
          >
            <X :size="18" />
          </button>
        </div>
        <div class="modal-body form-grid two-columns">
          <label
            >{{ t("连接名称", "Connection name")
            }}<input
              v-model="form.name"
              required
              maxlength="80"
              :disabled="busy"
              autofocus /></label
          ><label
            >{{ t("数据库类型", "Database type")
            }}<AppSelect
              v-model="form.type"
              :disabled="busy"
              :aria-label="t('数据库类型', 'Database type')"
              :options="[
                { value: 'mysql', label: 'MySQL / MariaDB' },
                { value: 'postgres', label: 'PostgreSQL' },
                { value: 'sqlite', label: 'SQLite' },
                { value: 'oracle', label: 'Oracle' },
                { value: 'mongodb', label: 'MongoDB' },
                { value: 'redis', label: 'Redis' },
              ]"
              @change="changeType"
          /></label>
          <template v-if="form.type !== 'sqlite'"
            ><label
              >{{ t("数据库主机", "Database host")
              }}<input
                v-model="form.host"
                required
                :disabled="busy"
                spellcheck="false" /></label
            ><label
              >{{ t("数据库端口", "Database port")
              }}<input
                v-model.number="form.port"
                required
                :disabled="busy"
                type="number"
                min="1"
                max="65535" /></label
            ><label
              >{{ t("数据库用户名", "Database username")
              }}<input
                v-model="form.username"
                :required="!['redis', 'mongodb'].includes(form.type)"
                :disabled="busy"
                autocomplete="off" /></label
            ><label
              >{{
                form.type === "oracle"
                  ? t("服务名（Service Name）", "Service name")
                  : form.type === "redis"
                    ? t("数据库编号（默认 0）", "Database index (default 0)")
                    : t("数据库名", "Database name")
              }}<input
                v-model="form.database"
                :required="form.type === 'oracle'"
                :disabled="busy"
                :placeholder="
                  form.type === 'postgres'
                    ? 'postgres'
                    : form.type === 'oracle'
                      ? 'FREEPDB1'
                      : form.type === 'redis'
                        ? '0'
                        : form.type === 'mongodb'
                          ? 'test'
                          : t('例如：orders', 'e.g. orders')
                " /></label
            ><label class="span-two"
              >{{ t("连接密码", "Connection password")
              }}<input
                v-model="formPassword"
                :disabled="busy || !desktop"
                type="password"
                autocomplete="off" /></label
            ><label v-if="form.type === 'mongodb'" class="span-two"
              >{{ t("认证数据库", "Authentication database")
              }}<input
                v-model="form.authSource"
                placeholder="admin"
                :disabled="busy"
            /></label>
            <label class="db-checkbox span-two"
              ><input
                v-model="rememberPassword"
                type="checkbox"
                :disabled="!desktop || busy"
              />{{
                t(
                  "加密记住密码（仅当前系统账户）",
                  "Remember password securely (this OS account only)",
                )
              }}</label
            >
            <p class="hint span-two">
              {{
                t(
                  "留空保留相同连接的已存密码；更换主机、用户或库后不会复用旧密码。浏览器不保存密码。",
                  "Blank retains an existing password for the same destination. Changed destinations never reuse it. Browser mode does not save passwords.",
                )
              }}
            </p>
            <label class="db-checkbox span-two"
              ><input v-model="form.tls" :disabled="busy" type="checkbox" />{{
                t(
                  "启用 TLS 并校验服务器证书（推荐）",
                  "Enable TLS and verify server certificate (recommended)",
                )
              }}</label
            >
            <p v-if="!form.tls" class="hint span-two">
              {{
                t(
                  "未启用加密，仅在你信任的本机或内网中使用。",
                  "Encryption disabled. Use only on trusted local networks.",
                )
              }}
            </p></template
          >
          <template v-else
            ><label class="span-two"
              >{{ t("SQLite 文件路径", "SQLite file path")
              }}<input
                v-model="form.path"
                :readonly="desktop"
                :disabled="busy"
                required
                :placeholder="
                  t('通过下方按钮选择现有文件', 'Choose an existing file below')
                " /></label
            ><button
              type="button"
              class="button span-two"
              :disabled="!desktop || busy"
              @click="pickFile('form')"
            >
              <FolderOpen :size="17" />{{
                t("选择 SQLite 文件", "Choose SQLite file")
              }}
            </button>
            <p class="hint span-two">
              {{
                t(
                  "打开现有数据库，不创建新文件。查询保持只读；数据编辑单独确认。重启应用后需要重新选择文件授权。",
                  "Opens existing databases without creating files. Queries are read-only; edits require confirmation. Reauthorize after restarting.",
                )
              }}
            </p></template
          >
          <p class="hint span-two">
            {{
              t(
                "支持六种数据库。Oracle 使用 Thin 模式和服务名；MongoDB 为直连配置；暂不含 SSH 隧道、Redis Cluster / Sentinel 或完整数据库管理功能。",
                "Six engines supported. Oracle uses Thin mode and service names; MongoDB uses direct host configuration. No SSH tunnels, Redis Cluster / Sentinel or full database administration.",
              )
            }}
          </p>
          <p v-if="testMessage" class="notice-banner span-two" role="status">
            {{ testMessage }}
          </p>
        </div>
        <div class="modal-footer">
          <button
            class="button"
            type="button"
            :disabled="busy || !desktop"
            @click="test"
          >
            <Plug :size="16" />{{
              busy ? t("测试中…", "Testing…") : t("测试连接", "Test connection")
            }}</button
          ><button
            type="button"
            class="button"
            :disabled="busy"
            @click="closeDialog"
          >
            {{ t("取消", "Cancel") }}</button
          ><button type="submit" class="button primary" :disabled="busy">
            {{ t("保存配置", "Save profile") }}
          </button>
        </div>
      </form>
    </dialog>
  </div>
</template>
