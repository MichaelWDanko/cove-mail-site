import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const policyPages = Object.freeze([
  "privacy-policy.html",
  "terms-of-service.html",
  "refund-policy.html",
]);
const effectiveDates = Object.freeze({
  "privacy-policy.html": "September 3, 2026",
  "terms-of-service.html": "September 3, 2026",
  "refund-policy.html": "September 2, 2026",
});
const allPages = Object.freeze([
  "index.html",
  "pricing.html",
  "subscription.html",
  ...policyPages,
]);

const headerLinks = Object.freeze([
  ["Bring Your Own AI", "./index.html#connect"],
  ["Compass", "./index.html#compass"],
  ["Compatibility", "./index.html#compatibility"],
  ["Get Cove Mail", "./pricing.html"],
]);

const footerLinks = Object.freeze([
  ["Bring Your Own AI", "./index.html#connect"],
  ["Compass", "./index.html#compass"],
  ["Compatibility", "./index.html#compatibility"],
  ["Download", "./pricing.html#download"],
  ["Pricing", "./pricing.html#pricing"],
  ["Manage your subscription", "./subscription.html"],
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
    assert.match(html, new RegExp(`Effective date: ${effectiveDates[path]}`));
    assert.match(html, /Michael Danko/);
    assert.match(html, /mailto:covemailapp@gmail.com/);
  }
});

test("links every policy from the public home page", async () => {
  const html = await readPage("index.html");
  for (const path of policyPages) assert.match(html, new RegExp(path.replace(".", "\\.")));
});

test("uses one focused primary navigation on every page without policy or subscription links", async () => {
  const expected = headerLinks.map(([label, href]) => ({ label, href }));

  for (const path of allPages) {
    const html = await readPage(path);
    const links = linksIn(html, /<nav id="site-nav"[^>]*>([\s\S]*?)<\/nav>/);
    assert.deepEqual(links, expected, `${path} primary navigation`);
    assert.doesNotMatch(
      links.map(({ href }) => href).join(" "),
      /(?:privacy|terms-of-service|refund-policy|subscription)\.html/,
    );
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
    const links = linksIn(html, /<nav[^>]*aria-label="Footer navigation"[^>]*>([\s\S]*?)<\/nav>/);
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

test("routes acquisition links through one Get Cove Mail page", async () => {
  const home = await readPage("index.html");
  assert.match(home, /href="\.\/pricing\.html#download">Get Cove Mail/);
  assert.match(home, /href="\.\/pricing\.html#pricing">See pricing/);
  assert.doesNotMatch(home, /data-download-link/);

  for (const path of allPages.filter((path) => path !== "pricing.html")) {
    const html = await readPage(path);
    assert.doesNotMatch(html, /https:\/\/github\.com\/MichaelWDanko\/cove-mail-releases\/releases\/latest/);
  }
});

test("combines a direct latest download with trial details and checkout", async () => {
  const html = await readPage("pricing.html");
  const directDownloadURL = "https://github.com/MichaelWDanko/cove-mail-releases/releases/latest/download/Cove-Mail.dmg";

  assert.match(html, /<header id="download"[^>]*>/);
  assert.match(html, /<h1>Download Cove Mail for Mac\.<\/h1>/);
  assert.match(html, /data-download-link/);
  assert.equal(html.match(new RegExp(directDownloadURL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length, 1);
  assert.match(html, /Requires macOS 14 or later\./);
  assert.match(html, /Download for Apple silicon/);
  assert.match(html, /Drag Cove Mail to Applications\./);
  assert.match(html, /<section id="pricing"[^>]*>/);
  assert.match(html, /cdn\.paddle\.com\/paddle\/v2\/paddle\.js/);
});

test("states the subscription renewal terms before checkout", async () => {
  const html = await readPage("pricing.html");
  assert.match(html, /Subscriptions renew automatically until you cancel renewal\./);
  assert.match(html, />Terms of Service<\/a>/);
  assert.match(html, />Refund Policy<\/a>/);
});

test("leads with Bring Your Own AI before Compass and inbox compatibility", async () => {
  const html = await readPage("index.html");
  const connection = html.indexOf('id="connect"');
  const compass = html.indexOf('id="compass"');
  const compatibility = html.indexOf('id="compatibility"');

  assert.match(html, /<p class="eyebrow">Bring Your Own AI<\/p>/);
  assert.ok(connection > 0 && connection < compass && compass < compatibility);
  assert.doesNotMatch(html, /id="(?:pricing|manage-license)"/);
  assert.match(html, /href="\.\/pricing\.html"/);
  assert.match(html, /href="\.\/subscription\.html"/);
});

test("names MCP as the local bridge and keeps Compass shortcut independent", async () => {
  const html = await readPage("index.html");
  const connection = html.slice(html.indexOf('id="connect"'), html.indexOf('id="compass"'));
  const compass = html.slice(html.indexOf('id="compass"'), html.indexOf('id="compatibility"'));

  assert.match(html, /Model Context Protocol \(MCP\) bridge/);
  assert.match(connection, /local MCP server/);
  assert.match(connection, /Any agent that can connect to a local MCP server/);
  assert.match(compass, /<h2>Compass puts mail and settings in one place\.<\/h2>/);
  assert.doesNotMatch(compass, /Command-K|⌘ K|keyboard shortcut|<kbd>/i);
  assert.equal(compass.match(/class="compass-result/g)?.length, 4);
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

  assert.match(privacy, /We do not operate\s+a\s+hosted copy of your mailbox/);
  assert.match(privacy, /does not send diagnostic reports automatically/);
  assert.match(privacy, /does not\s+currently use a separate website analytics service/);
  assert.match(terms, /One paid license may be used on up to three Macs/);
  assert.match(terms, /The people using those Macs\s+do not need to be the purchaser/);
  assert.match(terms, /Cove Mail does not include an AI model/);
});

test("lists the privacy request email in the privacy rights section", async () => {
  const privacy = await readPage("privacy-policy.html");
  const rights = privacy.match(
    /<section class="policy-card" aria-labelledby="rights-heading">([\s\S]*?)<\/section>/,
  )?.[1];

  assert.ok(rights, "privacy rights section");
  assert.match(rights, /href="mailto:covemailapp@gmail\.com">covemailapp@gmail\.com<\/a>/);
});

test("states that the terms apply to app use without imposing an adult-only restriction", async () => {
  const terms = await readPage("terms-of-service.html");

  assert.match(terms, /By downloading, installing, or\s+using Cove Mail, you agree to these Terms\./);
  assert.match(terms, /you are authorized to agree on its behalf/);
  assert.doesNotMatch(terms, /Eligibility and Authority|at least 18 years old/i);
});

test("explains Paddle's role in starting paid access", async () => {
  const terms = await readPage("terms-of-service.html");

  assert.match(terms, /Purchases are processed through Paddle\./);
  assert.match(terms, /Paid access begins after Paddle confirms the\s+purchase\./);
});

test("starts every bullet point with a capital letter", async () => {
  for (const path of allPages) {
    const html = await readPage(path);
    const bullets = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((match) =>
      textOnly(match[1]),
    );

    for (const bullet of bullets) {
      const firstLetter = bullet.match(/[A-Za-z]/)?.[0];
      assert.ok(firstLetter, `${path} bullet has no letter: ${bullet}`);
      assert.equal(firstLetter, firstLetter.toUpperCase(), `${path} bullet: ${bullet}`);
    }
  }
});

test("keeps policy copy focused on customer impact", async () => {
  const privacy = await readPage("privacy-policy.html");
  const terms = await readPage("terms-of-service.html");

  assert.match(privacy, /Payment processing and subscription management are handled by Paddle/);
  assert.doesNotMatch(privacy, /<h2[^>]*>Trial Information<\/h2>|search indexes|random installation identifier|transaction identifiers|device identifiers|home page loads Paddle|cookies or similar technology/i);
  assert.doesNotMatch(privacy, /reinstalling the app does not restart the trial/i);
  assert.doesNotMatch(terms, /purchaser's use|multi-user or team license|Activation and License Checks|Payment alone does not activate the app/i);
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

test("keeps policy sections compact and free of decorative horizontal rules", async () => {
  const html = await readPage("index.html");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.doesNotMatch(html, /<p class="eyebrow[^"]*">\s*<span/);
  assert.doesNotMatch(css, /\.eyebrow span\s*\{/);
  assert.doesNotMatch(css, /\.policy-card\s*\{[^}]*border-bottom/);
  assert.match(css, /\.policy-shell\s*\{[^}]*gap:\s*0/);
  assert.match(css, /\.policy-card\s*\{[^}]*padding:\s*0 32px 24px/);
});
