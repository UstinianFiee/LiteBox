"use strict";
const { randomUUID } = require("node:crypto");
// Only main-process code creates prompts. Renderer replies cannot choose an action.
function createConfirmationService({ send, timeoutMs = 120000 }) {
  const pending = new Map();
  function finish(id, accepted) {
    const entry = pending.get(id);
    if (!entry) return false;
    pending.delete(id);
    clearTimeout(entry.timer);
    try {
      send("confirmation:dismiss", { id });
    } catch {}
    entry.resolve({
      response: accepted === true && entry.canAccept ? 1 : 0,
      checkboxChecked: false,
    });
    return true;
  }
  return {
    showMessageBox(_owner, options) {
      if (pending.size >= 16) return Promise.resolve({ response: 0 });
      const id = randomUUID();
      const buttons = options.buttons || [];
      return new Promise((resolve) => {
        const timer = setTimeout(() => finish(id, false), timeoutMs);
        timer.unref?.();
        pending.set(id, { resolve, timer, canAccept: buttons.length > 1 });
        try {
          send("confirmation:request", {
            id,
            title: options.title || "",
            message: options.message || "",
            detail: options.detail || "",
            danger: options.type === "error" || options.danger === true,
            confirmLabel: buttons[1] || "",
            cancelLabel: buttons[0] || "",
            acknowledgeOnly: buttons.length < 2,
          });
        } catch {
          finish(id, false);
        }
      });
    },
    respond(payload) {
      if (
        !payload ||
        typeof payload.id !== "string" ||
        typeof payload.accepted !== "boolean"
      )
        throw new Error("Invalid confirmation response");
      return finish(payload.id, payload.accepted);
    },
    cancelAll() {
      for (const id of pending.keys()) finish(id, false);
    },
  };
}
module.exports = { createConfirmationService };
