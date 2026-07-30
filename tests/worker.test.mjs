import assert from "node:assert/strict";
import test from "node:test";

import worker, { resolveRuntimeConfig, validateCatalog } from "../worker/index.js";

const sandboxEnvironment = {
  COVE_SITE_ENV: "sandbox",
  COVE_PADDLE_CLIENT_TOKEN: "test_client_token",
};

test("selects only the staging catalog for sandbox", () => {
  const config = resolveRuntimeConfig(sandboxEnvironment);
  assert.equal(config.paddleEnvironment, "sandbox");
  assert.equal(config.catalogURL, "https://api.staging.covemail.ai/v1/commerce/catalog");
});

test("selects only the production catalog for a live token", () => {
  const config = resolveRuntimeConfig({
    COVE_SITE_ENV: "production",
    COVE_PADDLE_CLIENT_TOKEN: "live_client_token",
  });
  assert.equal(config.paddleEnvironment, "production");
  assert.equal(config.catalogURL, "https://api.covemail.ai/v1/commerce/catalog");
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
