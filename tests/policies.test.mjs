import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const policyPages = Object.freeze([
  "privacy-policy.html",
  "terms-of-service.html",
  "refund-policy.html",
]);
const allPages = Object.freeze(["index.html", ...policyPages]);

const headerLinks = Object.freeze([
  ["Home", "./index.html"],
  ["Product", "./index.html#native"],
  ["Accounts", "./index.html#accounts"],
  ["Pricing", "./index.html#pricing"],
  ["Manage your subscription", "./index.html#manage-license"],
  ["AI connection", "./index.html#connect"],
]);

const footerLinks = Object.freeze([
  ["Download", "https://github.com/MichaelWDanko/cove-mail-releases/releases/latest"],
  ...headerLinks,
  ["Privacy Policy", "./privacy-policy.html"],
  ["Terms of Service", "./terms-of-service.html"],
  ["Refund Policy", "./refund-policy.html"],
]);

async function readPage(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function textOnly(html) {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function linksIn(html, selectorPattern) {
  const block = html.match(selectorPattern)?.[1];
  assert.ok(block, "expected navigation block");
  return [...block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => ({
    href: match[1].match(/\bhref="([^"]+)"/)?.[1],
    label: textOnly(match[2]),
  }));
}

test("publishes each policy with the current date, operator, and support contact", async () => {
  for (const path of policyPages) {
    const html = await readPage(path);
    assert.match(html, /Effective date: September 2, 2026/);
    assert.match(html, /Michael Danko/);
    assert.match(html, /mailto:covemailapp@gmail.com/);
  }
});

test("links every policy from the public home page", async () => {
  const html = await readPage("index.html");
  for (const path of policyPages) assert.match(html, new RegExp(path.replace(".", "\\.")));
});

test("uses one primary navigation on every page without policy links", async () => {
  const expected = headerLinks.map(([label, href]) => ({ label, href }));

  for (const path of allPages) {
    const html = await readPage(path);
    const links = linksIn(html, /<nav id="site-nav"[^>]*>([\s\S]*?)<\/nav>/);
    assert.deepEqual(links, expected, `${path} primary navigation`);
    assert.doesNotMatch(links.map(({ href }) => href).join(" "), /(?:privacy|terms-of-service|refund-policy)\.html/);
  }
});

test("keeps navigation and the main content reachable on small screens", async () => {
  for (const path of allPages) {
    const html = await readPage(path);
    assert.match(html, /<a class="skip-link" href="#main">Skip to content<\/a>/);
    assert.match(html, /<button class="menu-button"[^>]*aria-controls="site-nav"/);
    assert.match(html, /<nav id="site-nav" class="site-nav" aria-label="Primary navigation">/);
    assert.match(html, /<main id="main"/);
  }
});

test("uses one footer link set with full policy names on every page", async () => {
  const expected = footerLinks.map(([label, href]) => ({ label, href }));

  for (const path of allPages) {
    const html = await readPage(path);
    const links = linksIn(html, /<nav aria-label="Footer navigation">([\s\S]*?)<\/nav>/);
    assert.deepEqual(links, expected, `${path} footer navigation`);
  }
});

test("marks the current policy only in the footer", async () => {
  for (const path of policyPages) {
    const html = await readPage(path);
    const currentLinks = [...html.matchAll(/<a\b([^>]*aria-current="page"[^>]*)>([\s\S]*?)<\/a>/g)];
    assert.equal(currentLinks.length, 1, path);
    assert.equal(currentLinks[0][1].match(/\bhref="([^"]+)"/)?.[1], `./${path}`);
  }
});

test("offers the latest production release from the hero and footer", async () => {
  const html = await readPage("index.html");
  assert.equal(html.match(/data-download-link/g)?.length, 2);
  assert.equal(
    html.match(/https:\/\/github\.com\/MichaelWDanko\/cove-mail-releases\/releases\/latest/g)?.length,
    2,
  );
});

test("states the subscription renewal terms before checkout", async () => {
  const html = await readPage("index.html");
  assert.match(html, /Subscriptions renew automatically until you cancel renewal\./);
  assert.match(html, />Terms of Service<\/a>/);
  assert.match(html, />Refund Policy<\/a>/);
});

test("states the agreed 14-day refund process and later exception route", async () => {
  const html = await readPage("refund-policy.html");
  assert.match(html, /within 14 calendar days after an initial subscription charge\s+or a renewal charge/);
  assert.match(html, /Submitting a request within 14 days does not guarantee approval/);
  assert.match(html, /Requests After 14 Days/);
  assert.match(html, /Cove Mail may approve an exception/);
  assert.match(html, /https:\/\/paddle\.net\//);
  assert.match(html, /https:\/\/www\.paddle\.com\/legal\/refund-policy/);
});

test("states the main privacy and product boundaries", async () => {
  const privacy = await readPage("privacy-policy.html");
  const terms = await readPage("terms-of-service.html");

  assert.match(privacy, /We do not operate\s+a hosted copy of your mailbox/);
  assert.match(privacy, /does not send diagnostic reports automatically/);
  assert.match(privacy, /does not currently use a separate website analytics service/);
  assert.match(terms, /One paid license may be active on up to three Macs/);
  assert.match(terms, /Cove Mail does not include an AI model/);
});

test("removes the slogan-like phrases identified in the copy review", async () => {
  const html = await readPage("index.html");
  for (const phrase of [
    "AI on your terms",
    "Keep your own boundaries",
    "Everything email needs",
    "Provider independent",
    "signed event",
  ]) {
    assert.doesNotMatch(html, new RegExp(phrase, "i"));
  }
});
