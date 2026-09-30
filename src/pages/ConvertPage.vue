<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ArrowRight,
  Copy,
  Download,
  ArrowLeftRight,
  Braces,
  AlertCircle,
} from "lucide-vue-next";
import { t, copy, exportText, used, notify } from "../lib/store";
import { convert } from "../lib/tools";
const input = ref("");
const output = ref("");
const error = ref("");
const selected = ref("json-pretty");
const options = computed(() => [
  ["json-pretty", t("JSON 格式化", "JSON prettify")],
  ["json-minify", t("JSON 压缩", "JSON minify")],
  ["json-yaml", "JSON → YAML"],
  ["yaml-json", "YAML → JSON"],
  ["base64-encode", t("Base64 编码", "Base64 encode")],
  ["base64-decode", t("Base64 解码", "Base64 decode")],
  ["url-encode", t("URL 编码", "URL encode")],
  ["url-decode", t("URL 解码", "URL decode")],
  ["timestamp", t("时间戳转换", "Timestamp")],
  ["dedupe", t("文本按行去重", "Deduplicate lines")],
  ["uuid", t("UUID 生成", "Generate UUIDs")],
]);
function run() {
  try {
    output.value = convert(input.value, selected.value);
    error.value = "";
    used("convert");
  } catch (e) {
    error.value = String(e);
    output.value = "";
  }
}
</script>
<template>
  <div class="page">
    <div class="page-heading">
      <div>
        <div class="eyebrow">FORMAT / ENCODE</div>
        <h1>{{ t("格式转换", "Converters") }}</h1>
        <p>
          {{
            t(
              "常用转换，一处搞定。所有处理均在本地完成。",
              "Everyday conversions, in one place. Everything runs locally.",
            )
          }}
        </p>
      </div>
      <span class="tag">11 {{ t("种工具", "utilities") }}</span>
    </div>
    <div class="converter-layout">
      <aside class="panel converter-menu">
        <button
          v-for="item in options"
          :key="item[0]"
          :class="{ active: selected === item[0] }"
          @click="
            selected = item[0]!;
            output = '';
            error = '';
          "
        >
          {{ item[1] }}<ArrowRight :size="14" />
        </button>
      </aside>
      <div class="converter-main">
        <div class="panel-heading converter-title">
          <h2>{{ options.find((o) => o[0] === selected)?.[1] }}</h2>
          <button class="button primary" @click="run">
            <ArrowRight :size="16" />{{ t("转换", "Convert") }}
          </button>
        </div>
        <div class="workspace-grid">
          <section class="panel editor-panel">
            <div class="panel-heading">
              <h2>{{ t("输入", "Input") }}</h2>
              <button class="text-button" @click="input = ''">
                {{ t("清空", "Clear") }}
              </button>
            </div>
            <textarea
              v-model="input"
              class="code-input tall-text"
              :aria-label="t('转换输入', 'Conversion input')"
              :placeholder="
                selected === 'timestamp'
                  ? t(
                      '输入秒 / 毫秒时间戳，或带时区的日期时间',
                      'Enter seconds / milliseconds, or an ISO date with timezone',
                    )
                  : selected === 'uuid'
                    ? t(
                        '输入生成数量，默认为 1（最多 100）',
                        'Enter count, default 1 (maximum 100)',
                      )
                    : t('在这里粘贴待转换内容…', 'Paste content to convert…')
              "
              spellcheck="false"
              @keydown.ctrl.enter="run"
            />
          </section>
          <section class="panel editor-panel">
            <div class="panel-heading">
              <h2>{{ t("输出", "Output") }}</h2>
              <button
                class="icon-button"
                :disabled="!output"
                :aria-label="t('复制结果', 'Copy output')"
                @click="copy(output)"
              >
                <Copy :size="16" />
              </button>
            </div>
            <textarea
              :value="output"
              readonly
              class="code-input tall-text"
              :aria-label="t('转换输出', 'Conversion output')"
              :placeholder="
                t('转换结果显示在这里', 'Your converted output appears here')
              "
            />
          </section>
        </div>
        <div v-if="error" class="error-banner" role="alert">
          <AlertCircle :size="17" />{{ error }}
        </div>
        <div class="toolbar mt-16">
          <span class="hint">{{
            selected === "yaml-json"
              ? t(
                  "为避免精度丢失，超出安全范围的 YAML 整数输出为 JSON 字符串。",
                  "YAML integers beyond the safe numeric range become JSON strings to preserve precision.",
                )
              : t(
                  "Ctrl + Enter 快速转换 · JSON 格式化保留长数字精度",
                  "Ctrl + Enter to convert · JSON formatting preserves large numbers",
                )
          }}</span
          ><button
            class="button"
            :disabled="!output"
            @click="
              input = output;
              output = '';
            "
          >
            <ArrowLeftRight :size="15" />{{
              t("结果作为输入", "Use output as input")
            }}</button
          ><button
            class="button"
            :disabled="!output"
            @click="
              exportText(output, 'converted.txt').catch((e) =>
                notify(String(e), true),
              )
            "
          >
            <Download :size="15" />{{ t("导出", "Export") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
