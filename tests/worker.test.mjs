import assert from "node:assert/strict";
import test from "node:test";

import worker, {
  acceptRecovery,
  resolveRuntimeConfig,
  validateCatalog,
  validateRecoveryRequest,
} from "../worker/index.js";

const sandboxEnvironment = {
  COVE_SITE_ENV: "sandbox",
  COVE_PADDLE_CLIENT_TOKEN: "test_client_token",
};

test("selects only the staging catalog for sandbox", () => {
  const config = resolveRuntimeConfig(sandboxEnvironment);
  assert.equal(config.paddleEnvironment, "sandbox");
  assert.equal(config.catalogURL, "https://api.staging.covemail.ai/v1/commerce/catalog");
  assert.equal(config.recoveryURL, "https://api.staging.covemail.ai/v1/recovery-requests");
  assert.equal(config.customerPortalURL, "https://sandbox-customer-portal.paddle.com/");
});

test("selects only the production catalog for a live token", () => {
  const config = resolveRuntimeConfig({
    COVE_SITE_ENV: "production",
    COVE_PADDLE_CLIENT_TOKEN: "live_client_token",
  });
  assert.equal(config.paddleEnvironment, "production");
  assert.equal(config.catalogURL, "https://api.covemail.ai/v1/commerce/catalog");
  assert.equal(config.recoveryURL, "https://api.covemail.ai/v1/recovery-requests");
  assert.equal(config.customerPortalURL, "https://customer-portal.paddle.com/");
});

test("rejects mixed environment credentials", () => {
  assert.throws(
    () => resolveRuntimeConfig({
      COVE_SITE_ENV: "production",
      COVE_PADDLE_CLIENT_TOKEN: "test_wrong_environment",
    }),
    /must start with live_/,
  );
});

test("serves public browser config without a backend credential", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/site-config.js"),
    { ...sandboxEnvironment, ASSETS: { fetch() { throw new Error("not used"); } } },
  );
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /test_client_token/);
  assert.match(body, /\/api\/license-recovery/);
  assert.match(body, /sandbox-customer-portal\.paddle\.com/);
  assert.doesNotMatch(body, /api\.staging\.covemail\.ai/);
  assert.doesNotMatch(body, /apiKey|secret|credential/i);
});

test("accepts exactly one monthly and one annual catalog offer", () => {
  const result = validateCatalog({
    environment: "sandbox",
    offers: [
      { billingInterval: "month", priceId: "pri_month", productId: "pro_product" },
      { billingInterval: "year", priceId: "pri_year", productId: "pro_product" },
    ],
  }, "sandbox");
  assert.equal(result.offers.length, 2);
});

test("normalizes a bounded activation email request", () => {
  const request = validateRecoveryRequest({
    licensingEmail: "Person@Example.invalid",
  });
  assert.equal(request.licensingEmail, "person@example.invalid");
  assert.match(request.idempotencyKey, /^[0-9a-f-]{36}$/);
  assert.deepEqual(Object.keys(request).sort(), ["idempotencyKey", "licensingEmail"]);
  assert.throws(
    () => validateRecoveryRequest({
      licensingEmail: "not-an-email",
    }),
    /Invalid recovery request/,
  );
  assert.throws(
    () => validateRecoveryRequest({
      licensingEmail: "person@example.invalid",
      idempotencyKey: "browser-controlled-key",
    }),
    /Invalid recovery request/,
  );
});

test("recovery proxy keeps known and unknown upstream results indistinguishable", async () => {
  const config = resolveRuntimeConfig(sandboxEnvironment);
  const request = () => new Request("https://example.test/api/license-recovery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      licensingEmail: "person@example.invalid",
    }),
  });
  const forwarded = [];
  const context = {
    waitUntil(promise) {
      forwarded.push(promise);
    },
  };

  const known = await acceptRecovery(config, request(), context, async () => (
    Response.json({ accepted: true }, { status: 202 })
  ));
  const unknown = await acceptRecovery(config, request(), context, async () => (
    Response.json({ code: "not_found" }, { status: 404 })
  ));
  await Promise.all(forwarded);

  assert.equal(known.status, 202);
  assert.equal(unknown.status, 202);
  assert.equal(await known.text(), await unknown.text());
  assert.equal(known.headers.get("Cache-Control"), "no-store");
});

test("recovery proxy rejects cross-origin form content before forwarding", async () => {
  let forwarded = false;
  const response = await acceptRecovery(
    resolveRuntimeConfig(sandboxEnvironment),
    new Request("https://example.test/api/license-recovery", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "licensingEmail=person%40example.invalid",
    }),
    null,
    async () => { forwarded = true; },
  );

  assert.equal(response.status, 415);
  assert.equal(forwarded, false);
});
