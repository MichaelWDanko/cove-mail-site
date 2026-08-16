const ENVIRONMENTS = Object.freeze({
  sandbox: Object.freeze({
    paddleEnvironment: "sandbox",
    recoveryPath: "https://api.staging.covemail.ai/v1/recovery-requests",
    customerPortalURL: "https://sandbox-customer-portal.paddle.com/",
    tokenPrefix: "test_",
  }),
  production: Object.freeze({
    paddleEnvironment: "production",
    recoveryPath: "https://api.covemail.ai/v1/recovery-requests",
    customerPortalURL: "https://customer-portal.paddle.com/",
    tokenPrefix: "live_",
  }),
});

function requiredValue(environment, name) {
  const value = String(environment[name] ?? "").trim();
  if (!value) throw new Error(`${name} is required for the static Pages build.`);
  return value;
}

export function createStaticSiteConfig(environment = process.env) {
  const siteEnvironment = requiredValue(environment, "COVE_SITE_ENV");
  const configuration = ENVIRONMENTS[siteEnvironment];
  if (!configuration) {
    throw new Error("COVE_SITE_ENV must be sandbox or production.");
  }

  const clientToken = requiredValue(environment, "COVE_PADDLE_CLIENT_TOKEN");
  if (!clientToken.startsWith(configuration.tokenPrefix)) {
    throw new Error(
      `COVE_PADDLE_CLIENT_TOKEN must start with ${configuration.tokenPrefix} for ${siteEnvironment}.`,
    );
  }

  const monthlyPriceID = requiredValue(environment, "COVE_MONTHLY_PRICE_ID");
  const annualPriceID = requiredValue(environment, "COVE_ANNUAL_PRICE_ID");
  const productID = String(environment.COVE_PADDLE_PRODUCT_ID ?? "").trim();

  return Object.freeze({
    environment: siteEnvironment,
    paddleEnvironment: configuration.paddleEnvironment,
    clientToken,
    catalogPath: "./catalog.json",
    catalogEnvironment: siteEnvironment,
    recoveryPath: configuration.recoveryPath,
    customerPortalURL: configuration.customerPortalURL,
    offers: Object.freeze([
      Object.freeze({ billingInterval: "month", priceId: monthlyPriceID, productId: productID }),
      Object.freeze({ billingInterval: "year", priceId: annualPriceID, productId: productID }),
    ]),
  });
}

function safeJSON(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function renderStaticSiteConfig(config) {
  const browserConfig = {
    environment: config.environment,
    paddleEnvironment: config.paddleEnvironment,
    clientToken: config.clientToken,
    catalogPath: config.catalogPath,
    catalogEnvironment: config.catalogEnvironment,
    recoveryPath: config.recoveryPath,
    customerPortalURL: config.customerPortalURL,
  };
  return `window.__COVE_SITE_CONFIG__ = Object.freeze(${safeJSON(browserConfig)});\n`;
}

export function renderStaticCatalog(config) {
  return `${JSON.stringify({ environment: config.environment, offers: config.offers }, null, 2)}\n`;
}
