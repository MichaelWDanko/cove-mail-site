import assert from "node:assert/strict";
import test from "node:test";

import {
  checkoutItems,
  checkoutOptions,
  initializePaddle,
  normalizeCatalog,
  previewPlans,
  validateSiteConfig,
} from "../checkout.js";

const sandboxConfig = Object.freeze({
  environment: "sandbox",
  paddleEnvironment: "sandbox",
  catalogEnvironment: "sandbox",
  clientToken: "test_client_token",
  catalogPath: "/api/catalog",
});

const catalog = {
  environment: "sandbox",
  offers: [
    { billingInterval: "year", priceId: "pri_year" },
    { billingInterval: "month", priceId: "pri_month" },
  ],
};

test("selects monthly and annual prices with quantity one", () => {
  const plans = normalizeCatalog(catalog, "sandbox");
  assert.deepEqual(checkoutItems(plans.get("month")), [{ priceId: "pri_month", quantity: 1 }]);
  assert.deepEqual(checkoutItems(plans.get("year")), [{ priceId: "pri_year", quantity: 1 }]);
});

test("opens the selected price in Paddle overlay checkout", () => {
  const plans = normalizeCatalog(catalog, "sandbox");
  assert.deepEqual(checkoutOptions(plans.get("month")), {
    items: [{ priceId: "pri_month", quantity: 1 }],
    settings: {
      displayMode: "overlay",
      theme: "dark",
    },
  });
});

test("configures Paddle sandbox before initialization", () => {
  const calls = [];
  const Paddle = {
    Environment: { set: (environment) => calls.push(["environment", environment]) },
    Initialize: (options) => calls.push(["initialize", options.token]),
    Checkout: { open() {} },
    PricePreview() {},
  };
  initializePaddle(Paddle, validateSiteConfig(sandboxConfig), () => {});
  assert.deepEqual(calls, [
    ["environment", "sandbox"],
    ["initialize", "test_client_token"],
  ]);
});

test("rejects a production token in sandbox configuration", () => {
  assert.throws(
    () => validateSiteConfig({ ...sandboxConfig, clientToken: "live_wrong_environment" }),
    /mixes Paddle environments/,
  );
});

test("accepts the static catalog path used by GitHub Pages", () => {
  assert.equal(
    validateSiteConfig({ ...sandboxConfig, catalogPath: "./catalog.json" }).catalogPath,
    "./catalog.json",
  );
});

test("uses localized PricePreview values for both plans", async () => {
  const calls = [];
  const Paddle = {
    async PricePreview(options) {
      calls.push(options);
      return {
        data: {
          details: {
            lineItems: [
              { price: { id: "pri_month" }, formattedUnitTotals: { subtotal: "€5.00" } },
              { price: { id: "pri_year" }, formattedUnitTotals: { subtotal: "€50.00" } },
            ],
          },
        },
      };
    },
  };
  const plans = normalizeCatalog(catalog, "sandbox");
  const prices = await previewPlans(Paddle, plans);
  assert.deepEqual(calls, [{
    items: [
      { priceId: "pri_month", quantity: 1 },
      { priceId: "pri_year", quantity: 1 },
    ],
  }]);
  assert.equal(prices.get("pri_month"), "€5.00");
  assert.equal(prices.get("pri_year"), "€50.00");
});

test("rejects a catalog from the other Paddle environment", () => {
  assert.throws(
    () => normalizeCatalog({ ...catalog, environment: "production" }, "sandbox"),
    /does not match/,
  );
});
