import { reactive } from "vue";

export type ConfirmOptions = {
  title?: string;
  detail?: string;
  requestId?: string;
  acknowledgeOnly?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmRequest = ConfirmOptions & {
  message: string;
  resolve: (value: boolean) => void;
  previousFocus: HTMLElement | null;
};

export const confirmState = reactive<{ current: ConfirmRequest | null }>({
  current: null,
});
const queue: ConfirmRequest[] = [];

function showNext() {
  if (!confirmState.current && queue.length) {
    confirmState.current = queue.shift()!;
  }
}

export function askConfirm(message: string, options: ConfirmOptions = {}) {
  return new Promise<boolean>((resolve) => {
    queue.push({
      message,
      ...options,
      previousFocus:
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
      resolve,
    });
    showNext();
  });
}

export function settleConfirm(value: boolean) {
  const request = confirmState.current;
  if (!request) return;
  confirmState.current = null;
  request.resolve(value);
  showNext();
  if (!confirmState.current)
    window.setTimeout(() => request.previousFocus?.focus(), 0);
}

/** Remove expired native prompts, including requests still waiting in the queue. */
export function dismissConfirm(requestId: string) {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].requestId === requestId) queue.splice(i, 1)[0]!.resolve(false);
  }
  if (confirmState.current?.requestId === requestId) settleConfirm(false);
}
