import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createStaticSiteConfig,
  renderStaticCatalog,
  renderStaticSiteConfig,
} from "./pages-config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist-pages");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of [
  "CNAME",
  "app.js",
  "checkout.js",
  "index.html",
  "license.js",
  "privacy-policy.html",
  "refund-policy.html",
  "styles.css",
  "terms-of-service.html",
]) {
  await cp(resolve(root, file), resolve(output, file));
}
await cp(resolve(root, "assets"), resolve(output, "assets"), { recursive: true });

const config = createStaticSiteConfig();
await writeFile(resolve(output, "site-config.js"), renderStaticSiteConfig(config));
await writeFile(resolve(output, "catalog.json"), renderStaticCatalog(config));
await writeFile(resolve(output, ".nojekyll"), "");

const requiredFiles = [
  "dist-pages/CNAME",
  "dist-pages/index.html",
  "dist-pages/privacy-policy.html",
  "dist-pages/refund-policy.html",
  "dist-pages/site-config.js",
  "dist-pages/catalog.json",
  "dist-pages/terms-of-service.html",
  "dist-pages/.nojekyll",
];
for (const path of requiredFiles) {
  await readFile(resolve(root, path));
}

console.log(`Built static GitHub Pages output in ${output}.`);
