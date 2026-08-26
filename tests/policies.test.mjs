import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pages = Object.freeze([
  "privacy-policy.html",
  "terms-of-service.html",
  "refund-policy.html",
]);

test("publishes the required customer policy pages with a support contact", async () => {
  for (const path of pages) {
    const html = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(html, /Effective date: August 26, 2026/);
    assert.match(html, /mailto:covemailapp@gmail.com/);
  }
});

test("links every required policy from the public home page", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const path of pages) assert.match(html, new RegExp(path.replace(".", "\\.")));
});

test("refund policy routes payment requests through Paddle", async () => {
  const html = await readFile(new URL("../refund-policy.html", import.meta.url), "utf8");
  assert.match(html, /https:\/\/paddle\.net\//);
  assert.match(html, /https:\/\/www\.paddle\.com\/legal\/refund-policy/);
});
