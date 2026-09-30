import fs from "node:fs";
import path from "node:path";
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
let text =
  "# LiteBox third-party notices\n\nGenerated from the locked dependency tree (runtime, bundled UI libraries, and build/test tools). Original licenses follow. Electron distributions additionally include LICENSE.electron.txt and LICENSES.chromium.html.\n";
for (const [location, meta] of Object.entries(lock.packages).sort()) {
  if (!location) continue;
  const folder = path.resolve(location);
  if (!fs.existsSync(path.join(folder, "package.json"))) continue;
  const pkg = JSON.parse(
    fs.readFileSync(path.join(folder, "package.json"), "utf8"),
  );
  text += `\n---\n\n## ${pkg.name} ${pkg.version}\n\nLicense: ${JSON.stringify(pkg.license || meta.license || "See package license")}\n\n`;
  const names = fs
    .readdirSync(folder)
    .filter(
      (n) =>
        /^(licen[cs]e|copying|notice)(\.|$)/i.test(n) &&
        fs.statSync(path.join(folder, n)).isFile(),
    );
  for (const name of names)
    text += `### ${name}\n\n${fs.readFileSync(path.join(folder, name), "utf8")}\n`;
}
fs.writeFileSync("THIRD_PARTY_NOTICES.md", text);
console.log("Generated notices:", text.length, "characters");
