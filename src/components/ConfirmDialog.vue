<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { AlertTriangle, X } from "lucide-vue-next";
import { confirmState, settleConfirm } from "../lib/confirm";
import { t } from "../lib/store";

const dialog = ref<HTMLDialogElement>();
function openDialog() {
  nextTick(() => {
    if (!dialog.value) return;
    if (!dialog.value.open) dialog.value.showModal();
    dialog.value
      .querySelector<HTMLButtonElement>("[data-confirm-cancel]")
      ?.focus();
  });
}
function close(value: boolean) {
  if (dialog.value?.open) dialog.value.close();
  settleConfirm(value);
}
function onCancel(event: Event) {
  event.preventDefault();
  close(false);
}
function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) close(false);
}
watch(
  () => confirmState.current,
  (current) => {
    if (current) openDialog();
    else if (dialog.value?.open) dialog.value.close();
  },
);
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && confirmState.current) {
    event.preventDefault();
    close(false);
  }
}
onMounted(() => window.addEventListener("keydown", onKeydown, true));
onUnmounted(() => window.removeEventListener("keydown", onKeydown, true));
</script>

<template>
  <dialog
    ref="dialog"
    class="modal confirm-dialog"
    aria-labelledby="confirm-dialog-title"
    :aria-describedby="
      confirmState.current?.detail
        ? 'confirm-dialog-message confirm-dialog-detail'
        : 'confirm-dialog-message'
    "
    @cancel="onCancel"
    @click="onBackdrop"
  >
    <div v-if="confirmState.current" class="confirm-dialog-inner">
      <div
        class="confirm-dialog-icon"
        :class="{ danger: confirmState.current.danger }"
      >
        <AlertTriangle :size="20" aria-hidden="true" />
      </div>
      <div class="confirm-dialog-copy">
        <div class="panel-heading confirm-dialog-heading">
          <h2 id="confirm-dialog-title">
            {{ confirmState.current.title || t("确认操作", "Confirm action") }}
          </h2>
          <button
            class="icon-button"
            type="button"
            :aria-label="t('取消', 'Cancel')"
            @click="close(false)"
          >
            <X :size="17" />
          </button>
        </div>
        <p id="confirm-dialog-message" class="confirm-dialog-message">
          {{ confirmState.current.message }}
        </p>
        <pre
          v-if="confirmState.current.detail"
          id="confirm-dialog-detail"
          class="confirm-dialog-detail"
          >{{ confirmState.current.detail }}</pre>
        <div class="modal-footer confirm-dialog-footer">
          <button
            class="button"
            type="button"
            data-confirm-cancel
            @click="close(false)"
          >
            {{
              confirmState.current.cancelLabel ||
              (confirmState.current.acknowledgeOnly
                ? t("知道了", "OK")
                : t("取消", "Cancel"))
            }}
          </button>
          <button
            v-if="!confirmState.current.acknowledgeOnly"
            class="button primary"
            :class="{ danger: confirmState.current.danger }"
            type="button"
            data-confirm-submit
            @click="close(true)"
          >
            {{ confirmState.current.confirmLabel || t("继续", "Continue") }}
          </button>
        </div>
      </div>
    </div>
  </dialog>
</template>
