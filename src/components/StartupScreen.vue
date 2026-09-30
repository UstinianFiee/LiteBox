<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import { ArrowRight } from "lucide-vue-next";
import { t } from "../lib/store";
import { createOpeningSequence } from "../lib/opening";
import "./startup.css";

const props = defineProps<{ ready: boolean }>();
const emit = defineEmits<{ finished: [] }>();
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
let sequence: ReturnType<typeof createOpeningSequence> | undefined;
function motionChanged(event: MediaQueryListEvent) {
  sequence?.setReducedMotion(event.matches);
}
function skip(event: KeyboardEvent) {
  if (event.key === "Escape" && props.ready) {
    event.preventDefault();
    event.stopPropagation();
    sequence?.skip();
  }
}
watch(
  () => props.ready,
  (value) => sequence?.setReady(value),
);
onMounted(() => {
  sequence = createOpeningSequence(() => emit("finished"), motion.matches);
  sequence.setReady(props.ready);
  motion.addEventListener("change", motionChanged);
  window.addEventListener("keydown", skip, true);
});
onUnmounted(() => {
  sequence?.dispose();
  motion.removeEventListener("change", motionChanged);
  window.removeEventListener("keydown", skip, true);
});
</script>

<template>
  <div
    class="startup-screen"
    :aria-label="t('轻匣启动画面', 'LiteBox opening')"
  >
    <div class="startup-corner" aria-hidden="true">
      <span class="startup-dot"></span> LITEBOX
      <span class="startup-divider">/</span>
      {{ t("个人工具箱", "PERSONAL TOOLBOX") }}
    </div>
    <div class="startup-center">
      <div class="startup-emblem" aria-hidden="true">
        <span class="startup-outline"></span>
        <img src="/logo.svg" alt="" width="80" height="80" />
      </div>
      <div class="startup-wordmark">
        <strong>LiteBox</strong><span>{{ t("轻匣", "TOOLBOX") }}</span>
      </div>
      <p class="startup-tagline">
        {{
          t(
            "专注眼前，工具交给轻匣",
            "A little less friction in your everyday.",
          )
        }}
      </p>
      <div class="startup-rule" aria-hidden="true"></div>
      <p class="startup-status" role="status" aria-live="polite">
        {{ t("正在打开你的工具箱…", "Opening your toolbox…") }}
      </p>
    </div>
    <div class="startup-footer">
      <span>{{
        t("本地优先 · 简单有序", "LOCAL FIRST · SIMPLY ORGANIZED")
      }}</span>
      <button v-if="ready" class="startup-skip" @click="sequence?.skip()">
        {{ t("进入工具箱", "Open toolbox") }} <ArrowRight :size="16" /><kbd
          >Esc</kbd
        >
      </button>
    </div>
  </div>
</template>
