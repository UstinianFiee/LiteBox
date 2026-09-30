/** Write only: never request permission to read the user's clipboard. */
export async function writeClipboard(text: string): Promise<void> {
  if (window.litebox) {
    await window.litebox.invoke("clipboard:write", text);
    return;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Permission/secure-context restrictions may still allow a user-initiated copy.
  }
  copyUsingSelection(text);
}

function copyUsingSelection(text: string): void {
  const active = document.activeElement as HTMLElement | null;
  const input =
    active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      ? active
      : null;
  const start = input?.selectionStart;
  const end = input?.selectionEnd;
  const direction = input?.selectionDirection;
  const selection = document.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, i) =>
        selection.getRangeAt(i).cloneRange(),
      )
    : [];
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.tabIndex = -1;
  field.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;font-size:16px";
  // Keep the temporary control inside a modal's focus scope, if present.
  const container =
    active?.closest('dialog[open], [aria-modal="true"]') || document.body;
  container.appendChild(field);
  try {
    field.focus({ preventScroll: true });
    field.select();
    if (!document.execCommand("copy"))
      throw new Error("Clipboard write failed");
  } finally {
    field.remove();
    active?.focus({ preventScroll: true });
    if (input && start != null && end != null)
      input.setSelectionRange(start, end, direction || undefined);
    if (selection) {
      selection.removeAllRanges();
      ranges.forEach((range) => selection.addRange(range));
    }
  }
}
