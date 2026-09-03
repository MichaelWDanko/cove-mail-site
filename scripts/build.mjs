import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
const client = resolve(output, "client");

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "server"), { recursive: true });
await mkdir(client, { recursive: true });
await mkdir(resolve(output, ".openai"), { recursive: true });

for (const file of [
  "CNAME",
  "app.js",
  "checkout.js",
  "index.html",
  "license.js",
  "pricing.html",
  "privacy-policy.html",
  "refund-policy.html",
  "styles.css",
  "subscription.html",
  "terms-of-service.html",
]) {
  await cp(resolve(root, file), resolve(client, file));
}
await cp(resolve(root, "assets"), resolve(client, "assets"), { recursive: true });
await cp(resolve(root, "worker/index.js"), resolve(output, "server/index.js"));
await cp(resolve(root, ".openai/hosting.json"), resolve(output, ".openai/hosting.json"));

const requiredFiles = [
  "dist/server/index.js",
  "dist/client/index.html",
  "dist/client/checkout.js",
  "dist/client/license.js",
  "dist/client/pricing.html",
  "dist/client/subscription.html",
  "dist/.openai/hosting.json",
];
for (const path of requiredFiles) {
  await readFile(resolve(root, path));
}

await writeFile(
  resolve(output, "build-manifest.json"),
  `${JSON.stringify({ requiredFiles }, null, 2)}\n`,
);

console.log("Built Cloudflare Workers-compatible output in dist/.");
