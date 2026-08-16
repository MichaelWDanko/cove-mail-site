import assert from "node:assert/strict";
import test from "node:test";

import {
  createStaticSiteConfig,
  renderStaticCatalog,
  renderStaticSiteConfig,
} from "../scripts/pages-config.mjs";

const productionEnvironment = {
  COVE_SITE_ENV: "production",
  COVE_PADDLE_CLIENT_TOKEN: "live_browser_token",
  COVE_MONTHLY_PRICE_ID: "pri_month",
  COVE_ANNUAL_PRICE_ID: "pri_year",
  COVE_PADDLE_PRODUCT_ID: "pro_cove_mail",
};

test("static production configuration selects live Paddle and API destinations", () => {
  const config = createStaticSiteConfig(productionEnvironment);
  assert.deepEqual(config, {
    environment: "production",
    paddleEnvironment: "production",
    clientToken: "live_browser_token",
    catalogPath: "./catalog.json",
    catalogEnvironment: "production",
    recoveryPath: "https://api.covemail.ai/v1/recovery-requests",
    customerPortalURL: "https://customer-portal.paddle.com/",
    offers: [
      { billingInterval: "month", priceId: "pri_month", productId: "pro_cove_mail" },
      { billingInterval: "year", priceId: "pri_year", productId: "pro_cove_mail" },
    ],
  });
});

test("static configuration rejects missing or mixed-environment values", () => {
  assert.throws(
    () => createStaticSiteConfig({
      ...productionEnvironment,
      COVE_PADDLE_CLIENT_TOKEN: "test_wrong_environment",
    }),
    /must start with live_/,
  );
  assert.throws(
    () => createStaticSiteConfig({
      ...productionEnvironment,
      COVE_ANNUAL_PRICE_ID: "",
    }),
    /COVE_ANNUAL_PRICE_ID is required/,
  );
});

test("static browser files contain only public configuration and offers", () => {
  const config = createStaticSiteConfig(productionEnvironment);
  const browserConfig = renderStaticSiteConfig(config);
  const catalog = renderStaticCatalog(config);

  assert.match(browserConfig, /catalog\.json/);
  assert.match(browserConfig, /api\.covemail\.ai\/v1\/recovery-requests/);
  assert.doesNotMatch(browserConfig, /apiKey|webhook|secret|password/i);
  assert.match(catalog, /pri_month/);
  assert.match(catalog, /pri_year/);
});
