import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

const sourceAssetsDir = resolve(projectRoot, "public", "assets");
const outputAssetsDir = resolve(projectRoot, "public", "dist", "assets");

async function copyAssets() {
  await mkdir(outputAssetsDir, { recursive: true });
  await cp(sourceAssetsDir, outputAssetsDir, {
    recursive: true,
    force: true,
  });
  console.log("[build] Copied static assets to public/dist/assets");
}

copyAssets().catch((error) => {
  console.error("[build] Failed to copy static assets:", error);
  process.exitCode = 1;
});
