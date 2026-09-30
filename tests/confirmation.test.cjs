"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createConfirmationService } = require("../electron/confirmation.cjs");
const options = {
  title: "Confirm",
  message: "Proceed?",
  detail: "SHA256:fixture",
  buttons: ["Cancel", "Continue"],
};
function fixture(extra = {}) {
  const sent = [];
  const service = createConfirmationService({
    send: (channel, payload) => sent.push({ channel, ...payload }),
    ...extra,
  });
  return { service, sent };
}
test("confirmation uses main-generated opaque token and accepts only once", async () => {
  const { service, sent } = fixture();
  const p = service.showMessageBox(null, options);
  assert.equal(sent[0].detail, options.detail);
  assert.match(sent[0].id, /^[a-f0-9-]{36}$/);
  assert.equal(service.respond({ id: "unknown", accepted: true }), false);
  assert.equal(service.respond({ id: sent[0].id, accepted: true }), true);
  assert.equal(service.respond({ id: sent[0].id, accepted: true }), false);
  assert.equal((await p).response, 1);
  assert.equal(sent[1].channel, "confirmation:dismiss");
});
test("invalid response payload never approves a pending request", async () => {
  const { service, sent } = fixture();
  const p = service.showMessageBox(null, options);
  for (const payload of [
    null,
    {},
    { id: sent[0].id, accepted: 1 },
    { id: 5, accepted: true },
  ])
    assert.throws(() => service.respond(payload), /Invalid/);
  service.respond({ id: sent[0].id, accepted: false });
  assert.equal((await p).response, 0);
});
test("acknowledge-only security warning cannot be accepted", async () => {
  const { service, sent } = fixture();
  const p = service.showMessageBox(null, {
    ...options,
    buttons: ["OK"],
    type: "error",
  });
  assert.equal(sent[0].acknowledgeOnly, true);
  assert.equal(sent[0].danger, true);
  service.respond({ id: sent[0].id, accepted: true });
  assert.equal((await p).response, 0);
});
test("timeout dismisses and rejects late acceptance", async () => {
  const { service, sent } = fixture({ timeoutMs: 10 });
  const p = service.showMessageBox(null, options);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal((await p).response, 0);
  assert.equal(service.respond({ id: sent[0].id, accepted: true }), false);
});
test("send failure fails closed", async () => {
  const { service } = fixture({
    send() {
      throw Error("Window destroyed");
    },
  });
  assert.equal((await service.showMessageBox(null, options)).response, 0);
});
test("cancelAll closes active and queued prompts", async () => {
  const { service, sent } = fixture();
  const pending = Array.from({ length: 3 }, () =>
    service.showMessageBox(null, options),
  );
  service.cancelAll();
  assert.deepEqual(
    (await Promise.all(pending)).map((r) => r.response),
    [0, 0, 0],
  );
  assert.equal(
    sent.filter((s) => s.channel === "confirmation:dismiss").length,
    3,
  );
});
test("confirmation queue is bounded and overflow cancels", async () => {
  const { service, sent } = fixture();
  const pending = Array.from({ length: 16 }, () =>
    service.showMessageBox(null, options),
  );
  assert.equal((await service.showMessageBox(null, options)).response, 0);
  assert.equal(sent.length, 16);
  service.cancelAll();
  await Promise.all(pending);
});
