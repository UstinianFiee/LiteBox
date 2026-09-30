<script setup lang="ts">
import {
  ref,
  onMounted,
  onUnmounted,
  onActivated,
  onDeactivated,
  computed,
} from "vue";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-vue-next";
import { t, navigate } from "../lib/store";
const quotes = [
  {
    zh: "千里之行，始于足下。",
    en: "A journey of a thousand miles begins with a single step.",
    by: ["老子 ·《道德经》", "Laozi · Tao Te Ching"],
  },
  {
    zh: "学而时习之，不亦说乎？",
    en: "Is it not a joy to learn and regularly put it into practice?",
    by: ["孔子 ·《论语》", "Confucius · Analects"],
  },
  {
    zh: "不积跬步，无以至千里。",
    en: "Without small steps, no journey of a thousand miles can be completed.",
    by: ["荀子 ·《劝学》", "Xunzi · Encouraging Learning"],
  },
  {
    zh: "知之为知之，不知为不知，是知也。",
    en: "To know what you know, and admit what you do not: that is wisdom.",
    by: ["孔子 ·《论语》", "Confucius · Analects"],
  },
];
const index = ref(0),
  paused = ref(false),
  focused = ref(false),
  reduced = ref(false);
const quote = computed(() => quotes[index.value]!);
let timer: ReturnType<typeof setInterval> | undefined;
let media: MediaQueryList;
const active = ref(true);
function resume() {
  active.value = !document.hidden;
  focused.value = false;
}
onActivated(resume);
onDeactivated(() => {
  active.value = false;
  focused.value = false;
});
function preference() {
  reduced.value = media.matches;
}
function togglePause() {
  paused.value = !paused.value;
  // An explicit Resume overrides the pause caused by focusing this button.
  if (!paused.value) focused.value = false;
}
function next(delta = 1) {
  index.value = (index.value + delta + quotes.length) % quotes.length;
}
onMounted(() => {
  media = matchMedia("(prefers-reduced-motion: reduce)");
  preference();
  media.addEventListener("change", preference);
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("pageshow", resume);
  timer = setInterval(() => {
    if (
      active.value &&
      !paused.value &&
      !focused.value &&
      !reduced.value &&
      !document.hidden
    )
      next();
  }, 8000);
});
onUnmounted(() => {
  clearInterval(timer);
  document.removeEventListener("visibilitychange", resume);
  window.removeEventListener("pageshow", resume);
  media?.removeEventListener("change", preference);
});
</script>
<template>
  <section
    class="home-motion-banner"
    :class="{ 'motion-paused': paused || reduced || !active }"
    :aria-label="t('工作台欢迎横幅', 'Workspace welcome banner')"
  >
    <div class="banner-copy">
      <div class="eyebrow">LESS FRICTION. MORE FOCUS.</div>
      <h2>
        {{
          t("让工具就位，\n让灵感发生。", "Tools in place.\nRoom for ideas.")
        }}
      </h2>
      <p>
        {{
          t(
            "从一个想法，到一次完成。轻匣与你一起。",
            "From the first idea to the final detail. A little help, every day.",
          )
        }}
      </p>
      <button class="button primary" @click="navigate('orders')">
        {{ t("开始今天的工作", "Start your day") }}<ArrowRight :size="17" />
      </button>
    </div>
    <svg
      class="banner-illustration"
      viewBox="0 0 430 240"
      fill="none"
      aria-hidden="true"
    >
      <path class="banner-path" d="M20 164H90V70H180V178H260V110H410" />
      <g class="banner-float">
        <rect
          x="105"
          y="40"
          width="226"
          height="151"
          rx="13"
          fill="var(--surface)"
          stroke="var(--border-strong)"
        />
        <path d="M105 72H331" stroke="var(--border)" />
        <circle cx="123" cy="56" r="3" fill="#2563eb" />
        <circle cx="135" cy="56" r="3" fill="#93b4e8" />
        <circle cx="147" cy="56" r="3" fill="#ceddf5" />
        <rect
          x="121"
          y="88"
          width="63"
          height="85"
          rx="5"
          fill="var(--accent-soft)"
        />
        <path
          d="M133 104H169M133 119H164M133 134H158"
          stroke="var(--accent)"
          stroke-width="3"
          stroke-linecap="round"
        />
        <rect
          x="200"
          y="90"
          width="108"
          height="9"
          rx="4"
          fill="var(--accent-soft)"
        />
        <path
          d="M201 123L219 136L201 149M239 150H264"
          stroke="var(--accent)"
          stroke-width="4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
      <g class="banner-satellite">
        <rect
          x="300"
          y="155"
          width="67"
          height="55"
          rx="12"
          fill="var(--accent)"
        />
        <path
          d="M320 181L330 190L348 171"
          stroke="white"
          stroke-width="4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
      <circle cx="75" cy="85" r="8" fill="var(--accent-soft)" />
      <circle cx="371" cy="53" r="5" fill="var(--accent)" opacity=".45" />
    </svg>
    <div
      class="banner-quote"
      @focusin="focused = true"
      @focusout="focused = false"
    >
      <div class="quote-body">
        <span class="quote-label"
          >{{ t("每日箴言", "DAILY WISDOM") }} · {{ index + 1 }} /
          {{ quotes.length }}</span
        ><Transition name="quote-fade" mode="out-in"
          ><div :key="index">
            <p class="quote-zh">{{ quote.zh }}</p>
            <p class="quote-en">{{ quote.en }}</p>
            <small>— {{ t(quote.by[0]!, quote.by[1]!) }}</small>
          </div></Transition
        >
      </div>
      <div class="quote-controls">
        <button
          class="icon-button"
          :aria-label="t('上一句', 'Previous quote')"
          @click="next(-1)"
        >
          <ChevronLeft :size="17" /></button
        ><button
          class="icon-button"
          :aria-label="
            paused
              ? t('继续轮播', 'Resume rotation')
              : t('暂停轮播', 'Pause rotation')
          "
          :aria-pressed="paused"
          @click="togglePause"
        >
          <Play v-if="paused" :size="15" /><Pause v-else :size="15" /></button
        ><button
          class="icon-button"
          :aria-label="t('下一句', 'Next quote')"
          @click="next()"
        >
          <ChevronRight :size="17" />
        </button>
      </div>
    </div>
  </section>
</template>
