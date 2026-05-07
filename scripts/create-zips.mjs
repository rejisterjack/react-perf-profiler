import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function zip(cwd, outName) {
  const absCwd = resolve(root, cwd);
  if (!existsSync(absCwd)) {
    console.error(`Missing ${cwd} — run "pnpm build" first`);
    process.exit(1);
  }
  const outPath = resolve(root, outName);
  execFileSync("zip", ["-r", outPath, "."], { cwd: absCwd, stdio: "inherit" });
  console.log(`Created ${outPath}`);
}

zip("dist/dist-chrome", "dist/dist-chrome.zip");
zip("dist/dist-firefox", "dist/dist-firefox.zip");
