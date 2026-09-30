<script setup lang="ts" generic="T extends string">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  useId,
  watch,
} from "vue";
import { Check, ChevronDown } from "lucide-vue-next";
const props = defineProps<{
  modelValue: T;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  disabled?: boolean;
  compact?: boolean;
  ariaLabel?: string;
  placeholder?: string;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: T];
  change: [value: T];
}>();
const id = useId();
const root = ref<HTMLElement>();
const trigger = ref<HTMLButtonElement>();
const menu = ref<HTMLElement>();
const opened = ref(false);
const active = ref(-1);
const selected = computed(() =>
  props.options.find((o) => o.value === props.modelValue),
);
let search = "";
let searchAt = 0;
const enabled = () =>
  props.options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
function position() {
  if (!opened.value || !trigger.value || !menu.value) return;
  const r = trigger.value.getBoundingClientRect();
  const below = window.innerHeight - r.bottom - 12;
  const above = r.top - 12;
  const upward = below < 220 && above > below;
  const height = Math.min(320, Math.max(80, upward ? above : below));
  const width = Math.min(
    Math.max(r.width, props.compact ? 124 : 200),
    window.innerWidth - 24,
  );
  Object.assign(menu.value.style, {
    width: `${width}px`,
    maxHeight: `${height}px`,
    left: `${Math.max(12, Math.min(r.left, window.innerWidth - width - 12))}px`,
    top: upward ? "auto" : `${r.bottom + 6}px`,
    bottom: upward ? `${window.innerHeight - r.top + 6}px` : "auto",
  });
}
function revealActive() {
  nextTick(() =>
    menu.value
      ?.querySelector<HTMLElement>(`[data-index="${active.value}"]`)
      ?.scrollIntoView({ block: "nearest" }),
  );
}
async function open() {
  if (props.disabled || opened.value) return;
  active.value = props.options.findIndex(
    (o) => o.value === props.modelValue && !o.disabled,
  );
  if (active.value < 0) active.value = enabled()[0] ?? -1;
  opened.value = true;
  await nextTick();
  menu.value?.showPopover();
  position();
  revealActive();
}
function close() {
  menu.value?.hidePopover();
  opened.value = false;
  search = "";
}
function choose(index: number) {
  const option = props.options[index];
  if (!option || option.disabled) return;
  emit("update:modelValue", option.value);
  emit("change", option.value);
  close();
  trigger.value?.focus();
}
function keydown(e: KeyboardEvent) {
  if (e.key === "Tab") {
    close();
    return;
  }
  if (e.key === "Escape") {
    if (opened.value) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
    return;
  }
  if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(e.key)) {
    e.preventDefault();
    if (!opened.value) {
      void open();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      choose(active.value);
      return;
    }
    const items = enabled();
    const i = items.indexOf(active.value);
    active.value =
      e.key === "Home"
        ? (items[0] ?? -1)
        : e.key === "End"
          ? (items.at(-1) ?? -1)
          : (items[
              (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                items.length
            ] ?? -1);
    revealActive();
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    if (!opened.value) void open();
    search = Date.now() - searchAt > 700 ? e.key : search + e.key;
    searchAt = Date.now();
    const found = props.options.findIndex(
      (o) =>
        !o.disabled &&
        o.label.toLocaleLowerCase().startsWith(search.toLocaleLowerCase()),
    );
    if (found >= 0) {
      active.value = found;
      revealActive();
    }
  }
}
function outside(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) close();
}
function scroll(e: Event) {
  if (!menu.value?.contains(e.target as Node)) position();
}
onMounted(() => {
  document.addEventListener("pointerdown", outside, true);
  window.addEventListener("resize", position);
  document.addEventListener("scroll", scroll, true);
});
onUnmounted(() => {
  document.removeEventListener("pointerdown", outside, true);
  window.removeEventListener("resize", position);
  document.removeEventListener("scroll", scroll, true);
});
watch(
  () => props.disabled,
  (value) => {
    if (value) close();
  },
);
</script>
<template>
  <div
    ref="root"
    class="app-select"
    :class="{ 'is-open': opened, 'is-compact': compact }"
  >
    <button
      ref="trigger"
      type="button"
      class="select-trigger"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="opened"
      :aria-controls="`${id}-list`"
      :aria-activedescendant="
        opened && active >= 0 ? `${id}-option-${active}` : undefined
      "
      :aria-label="ariaLabel"
      :disabled="disabled"
      @click="opened ? close() : open()"
      @keydown="keydown"
      @blur="close"
    >
      <span>{{ selected?.label || placeholder || "—" }}</span
      ><ChevronDown :size="18" />
    </button>
    <div
      ref="menu"
      :id="`${id}-list`"
      class="select-menu"
      popover="manual"
      role="listbox"
      :aria-label="ariaLabel"
      @mousedown.prevent
    >
      <div
        v-for="(option, index) in options"
        :key="option.value"
        :id="`${id}-option-${index}`"
        role="option"
        :aria-selected="option.value === modelValue"
        :aria-disabled="option.disabled || undefined"
        class="select-option"
        :class="{
          highlighted: active === index,
          selected: option.value === modelValue,
          disabled: option.disabled,
        }"
        :data-index="index"
        @pointermove="!option.disabled && (active = index)"
        @click.stop.prevent="choose(index)"
      >
        <span>{{ option.label }}</span
        ><Check v-if="option.value === modelValue" :size="18" />
      </div>
    </div>
  </div>
</template>
