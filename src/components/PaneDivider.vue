<script setup lang="ts">
import { ref } from "vue";
const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    axis?: "x" | "y";
    label: string;
  }>(),
  { min: 100, max: 500, axis: "y" },
);
const emit = defineEmits<{ "update:modelValue": [number] }>();
const dragging = ref(false);
let initial = 0,
  start = 0;
const clamp = (value: number) =>
  Math.max(props.min, Math.min(props.max, value));
function down(event: PointerEvent) {
  if (event.button !== 0) return;
  initial = props.modelValue;
  start = props.axis === "x" ? event.clientX : event.clientY;
  dragging.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function move(event: PointerEvent) {
  if (dragging.value)
    emit(
      "update:modelValue",
      clamp(
        initial + (props.axis === "x" ? event.clientX : event.clientY) - start,
      ),
    );
}
function key(event: KeyboardEvent) {
  const negative = props.axis === "x" ? "ArrowLeft" : "ArrowUp",
    positive = props.axis === "x" ? "ArrowRight" : "ArrowDown";
  if (![negative, positive, "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  emit(
    "update:modelValue",
    event.key === "Home"
      ? props.min
      : event.key === "End"
        ? props.max
        : clamp(props.modelValue + (event.key === negative ? -16 : 16)),
  );
}
</script>
<template>
  <div
    class="pane-divider"
    :class="['axis-' + axis, { dragging }]"
    role="separator"
    tabindex="0"
    :aria-label="label"
    :aria-orientation="axis === 'x' ? 'vertical' : 'horizontal'"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="modelValue"
    @pointerdown.prevent="down"
    @pointermove="move"
    @pointerup="dragging = false"
    @pointercancel="dragging = false"
    @lostpointercapture="dragging = false"
    @keydown="key"
  >
    <span />
  </div>
</template>
