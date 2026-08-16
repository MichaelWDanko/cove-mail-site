import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ACTIVATION_ACCEPTED_MESSAGE,
  normalizeLicensingEmail,
  recoveryRequest,
  validateLicenseConfig,
} from "../license.js";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const licenseScript = await readFile(new URL("../license.js", import.meta.url), "utf8");

test("uses only the environment-matched Paddle customer portal", () => {
  assert.equal(
    validateLicenseConfig({
      environment: "sandbox",
      recoveryPath: "/api/license-recovery",
      customerPortalURL: "https://sandbox-customer-portal.paddle.com/",
    }).customerPortalURL,
    "https://sandbox-customer-portal.paddle.com/",
  );
  assert.equal(
    validateLicenseConfig({
      environment: "production",
      recoveryPath: "/api/license-recovery",
      customerPortalURL: "https://customer-portal.paddle.com/",
    }).customerPortalURL,
    "https://customer-portal.paddle.com/",
  );
  assert.equal(
    validateLicenseConfig({
      environment: "production",
      recoveryPath: "https://api.covemail.ai/v1/recovery-requests",
      customerPortalURL: "https://customer-portal.paddle.com/",
    }).recoveryPath,
    "https://api.covemail.ai/v1/recovery-requests",
  );
  assert.throws(
    () => validateLicenseConfig({
      environment: "production",
      recoveryPath: "/api/license-recovery",
      customerPortalURL: "https://example.invalid/portal",
    }),
    /not configured/,
  );
});

test("activation request contains only the normalized email", () => {
  assert.equal(normalizeLicensingEmail(" Person@Example.invalid "), "person@example.invalid");
  assert.deepEqual(
    recoveryRequest(" Person@Example.invalid "),
    {
      licensingEmail: "person@example.invalid",
    },
  );
});

test("activation result uses the required non-enumerating message", () => {
  assert.equal(
    ACTIVATION_ACCEPTED_MESSAGE,
    "If we find an email associated with the one provided, we will send an activation email back to them.",
  );
  assert.doesNotMatch(licenseScript, /apiKey|webhook|secret|credential/i);
});

test("subscription management is discoverable and activation asks for only an email", () => {
  assert.equal(
    html.match(/<a href="#manage-license">Manage your subscription<\/a>/g)?.length,
    2,
  );
  const section = html.slice(
    html.indexOf('<section class="license-management story"'),
    html.indexOf('<section class="story connection-story"'),
  );
  assert.match(section, /data-customer-portal/);
  assert.match(section, /target="_blank"/);
  assert.match(section, /rel="noopener noreferrer"/);
  assert.match(section, /aria-label="Manage your subscription in Paddle \(opens in a new tab\)"/);
  assert.match(section, />\s*Manage your subscription\s*<span/);
  assert.equal(section.match(/<input\b/g)?.length, 1);
  assert.match(section, /name="licensingEmail"[\s\S]*type="email"/);
  assert.match(section, /method="post"[\s\S]*action="\/api\/license-recovery"/);
  assert.match(section, /<button[^>]*type="submit"[^>]*disabled>/);
  assert.doesNotMatch(section, /licenseId|deviceId|password/);
});
