// Windows DPAPI for the RDP password blob. The password travels only over stdin,
// never in command-line arguments, environment variables, or plaintext files.
const { spawn } = require("node:child_process");
const path = require("node:path");
function protectRdpPassword(password) {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32") return reject(Error("Windows only"));
    const script =
      "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $v=[Console]::In.ReadToEnd().Trim(); $b=[Convert]::FromBase64String($v); $e=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([BitConverter]::ToString($e).Replace('-',''))";
    const child = spawn(
      path.join(
        process.env.SystemRoot || "C:\\Windows",
        "System32",
        "WindowsPowerShell",
        "v1.0",
        "powershell.exe",
      ),
      [
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(script, "utf16le").toString("base64"),
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(Error("RDP encryption timed out"));
    }, 15000);
    child.stdout.on("data", (d) => {
      out += d.toString();
      if (out.length > 65536) child.kill();
    });
    child.stderr.resume();
    child.stdin.on("error", () => {});
    child.once("error", () => {
      clearTimeout(timer);
      reject(Error("RDP encryption failed"));
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      code === 0 && /^[0-9A-F]+$/.test(out)
        ? resolve(out)
        : reject(Error("RDP encryption failed / RDP 密码加密失败"));
    });
    child.stdin.end(Buffer.from(password, "utf16le").toString("base64"));
  });
}
module.exports = { protectRdpPassword };
