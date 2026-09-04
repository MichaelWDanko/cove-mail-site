import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pricingHtml = readFileSync(new URL("../pricing.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("pricing page uses a plan-neutral continuation cue", () => {
  assert.doesNotMatch(pricingHtml, /See monthly and annual pricing/);
  assert.match(pricingHtml, /class="section-continuation" href="#pricing"/);
  assert.match(pricingHtml, />Plans and pricing</);
  assert.match(styles, /\.section-continuation\s*\{/);
  assert.match(styles, /\.section-continuation::before, \.section-continuation::after/);
});
