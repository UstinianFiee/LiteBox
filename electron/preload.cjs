"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const channels = new Set([
  "confirmation:respond",
  "activity:list",
  "activity:add",
  "activity:clear",
  "remote:secret-save",
  "remote:secret-status",
  "remote:secret-forget",
  "state:load",
  "state:save",
  "app:info",
  "app:open-data",
  "app:licenses",
  "window:action",
  "clipboard:write",
  "clipboard:read",
  "file:open",
  "file:save",
  "file:export",
  "backup:export",
  "backup:import",
  "ai:configure",
  "ai:clear-key",
  "ai:chat",
  "ai:attachment-save",
  "ai:attachment-preview",
  "ai:cancel",
  "ssh:pick-key",
  "ssh:connect",
  "ssh:write",
  "ssh:resize",
  "ssh:disconnect",
  "sftp:list",
  "sftp:read",
  "sftp:save",
  "sftp:download",
  "sftp:upload",
  "rdp:connect",
  "db:pick-file",
  "db:connect",
  "db:test",
  "db:disconnect",
  "db:cancel",
  "db:catalog",
  "db:columns",
  "db:query",
  "db:mutate",
  "db:secret-save",
  "db:secret-status",
  "db:secret-forget",
]);
const events = new Set([
  "confirmation:request",
  "confirmation:dismiss",
  "ai:chunk",
  "ssh:data",
  "ssh:closed",
  "db:closed",
  "activity:changed",
]);
contextBridge.exposeInMainWorld("litebox", {
  invoke: (channel, payload) => {
    if (!channels.has(channel))
      return Promise.reject(new Error("Unsupported action"));
    return ipcRenderer.invoke(channel, payload);
  },
  on: (channel, listener) => {
    if (!events.has(channel)) throw new Error("Unsupported event");
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  },
  flush: (state) => ipcRenderer.sendSync("state:flush", state),
});
