"use strict";
const fs = require("node:fs");
const path = require("node:path");
function atomicWrite(filename, value) {
  const tmp = filename + ".tmp";
  fs.writeFileSync(tmp, value, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, filename);
}
function readJson(filename, fallback = null) {
  if (!fs.existsSync(filename)) return fallback;
  const stat = fs.statSync(filename);
  if (stat.size > 22 * 1024 * 1024) throw new Error("Data file too large");
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}
module.exports = { atomicWrite, readJson };
