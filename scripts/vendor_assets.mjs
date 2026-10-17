// Copies pinned third-party browser assets from node_modules into public/.
// Run after upgrading animejs or the fontsource packages: npm run vendor
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fonts = "node_modules/@fontsource-variable";

const ASSETS = [
  ["node_modules/animejs/dist/bundles/anime.esm.min.js", "public/js/vendor/anime.esm.min.js"],
  [`${fonts}/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2`, "public/fonts/bricolage-grotesque.woff2"],
  [`${fonts}/inter/files/inter-latin-wght-normal.woff2`, "public/fonts/inter.woff2"],
  [`${fonts}/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2`, "public/fonts/jetbrains-mono.woff2"],
];

async function copyAsset([from, to]) {
  await mkdir(dirname(join(root, to)), { recursive: true });
  await copyFile(join(root, from), join(root, to));
  return to;
}

try {
  const copied = await Promise.all(ASSETS.map(copyAsset));
  console.log(copied.join("\n"));
} catch (error) {
  console.error(`vendor: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
