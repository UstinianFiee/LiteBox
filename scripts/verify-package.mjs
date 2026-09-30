import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { extractFile, listPackage } from "@electron/asar";
const currentVersion = JSON.parse(
  fs.readFileSync("package.json", "utf8"),
).version;
const archive = path.resolve(
  process.argv[2] ||
    `release/v${currentVersion}/win-unpacked/resources/app.asar`,
);
const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
};
walk("dist");
walk("electron");
files.push("build/icon.ico", "THIRD_PARTY_NOTICES.md", "LICENSE");
for (const file of files)
  assert(
    fs.readFileSync(file).equals(extractFile(archive, file)),
    `Packaged file differs: ${file}`,
  );
const manifest = JSON.parse(extractFile(archive, "package.json"));
assert.equal(
  manifest.version,
  JSON.parse(fs.readFileSync("package.json", "utf8")).version,
);
const contents = listPackage(archive);
assert(
  !contents.some((p) =>
    /[/\\](litebox-data|\.litebox-data|artifacts|scripts|tests)([/\\]|$)/.test(
      p,
    ),
  ),
);
console.log(
  JSON.stringify(
    {
      passed: true,
      version: manifest.version,
      matchedFiles: files.length,
      archive,
      noUserData: true,
    },
    null,
    2,
  ),
);
