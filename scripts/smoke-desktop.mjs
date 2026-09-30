import { spawn } from "node:child_process";
import electron from "electron";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import path from "node:path";
const root = process.cwd();
mkdirSync(path.join(root, "artifacts"), { recursive: true });
const data = mkdtempSync(path.join(root, "artifacts", "smoke-"));
const env = { ...process.env, LITEBOX_TEST_DATA: data };
delete env.ELECTRON_RUN_AS_NODE;
delete env.LITEBOX_DEV_URL;
const child = spawn(electron, [".", "--litebox-smoke"], {
  env,
  stdio: "inherit",
  windowsHide: true,
});
const timeout = setTimeout(() => {
  child.kill();
  console.error("Desktop test exceeded 240s");
}, 240000);
child.on("exit", (code) => {
  clearTimeout(timeout);
  try {
    console.log(readFileSync(path.join(data, "result.json"), "utf8"));
  } catch {
    console.error("No smoke report at " + data);
  }
  process.exit(code ?? 1);
});
