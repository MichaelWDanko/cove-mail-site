const ENVIRONMENTS = Object.freeze({
  sandbox: Object.freeze({
    paddleEnvironment: "sandbox",
    catalogEnvironment: "sandbox",
    catalogURL: "https://api.staging.covemail.ai/v1/commerce/catalog",
    recoveryURL: "https://api.staging.covemail.ai/v1/recovery-requests",
    customerPortalURL: "https://sandbox-customer-portal.paddle.com/",
    tokenPrefix: "test_",
  }),
  production: Object.freeze({
    paddleEnvironment: "production",
    catalogEnvironment: "production",
    catalogURL: "https://api.covemail.ai/v1/commerce/catalog",
    recoveryURL: "https://api.covemail.ai/v1/recovery-requests",
    customerPortalURL: "https://customer-portal.paddle.com/",
    tokenPrefix: "live_",
  }),
});

const PUBLIC_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Type": "application/javascript; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
});

const CATALOG_HEADERS = Object.freeze({
  "Cache-Control": "public, max-age=300",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
});

const RECOVERY_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
});

const EMAIL = /^[^@\s]+@[^@\s]+$/;
const RECOVERY_ACCEPTED = Object.freeze({ accepted: true });

export function resolveRuntimeConfig(env) {
  const siteEnvironment = env.COVE_SITE_ENV;
  const configuration = ENVIRONMENTS[siteEnvironment];
  if (!configuration) {
    throw new Error("COVE_SITE_ENV must be sandbox or production.");
  }

  const clientToken = String(env.COVE_PADDLE_CLIENT_TOKEN ?? "").trim();
  if (!clientToken.startsWith(configuration.tokenPrefix)) {
    throw new Error(
      `COVE_PADDLE_CLIENT_TOKEN must start with ${configuration.tokenPrefix} for ${siteEnvironment}.`,
    );
  }

  return Object.freeze({
    environment: siteEnvironment,
    paddleEnvironment: configuration.paddleEnvironment,
    clientToken,
    catalogPath: "/api/catalog",
    catalogEnvironment: configuration.catalogEnvironment,
    catalogURL: configuration.catalogURL,
    recoveryPath: "/api/license-recovery",
    recoveryURL: configuration.recoveryURL,
    customerPortalURL: configuration.customerPortalURL,
  });
}

export function validateCatalog(catalog, expectedEnvironment) {
  if (!catalog || catalog.environment !== expectedEnvironment || !Array.isArray(catalog.offers)) {
    throw new Error("The pricing catalog does not match this site environment.");
  }

  const offers = catalog.offers.map((offer) => {
    const billingInterval = offer?.billingInterval;
    if (
      (billingInterval !== "month" && billingInterval !== "year") ||
      typeof offer?.priceId !== "string" ||
      offer.priceId.length === 0
    ) {
      throw new Error("The pricing catalog contains an invalid offer.");
    }

    return {
      billingInterval,
      priceId: offer.priceId,
      productId: typeof offer.productId === "string" ? offer.productId : "",
    };
  });

  if (
    offers.length !== 2 ||
    !offers.some((offer) => offer.billingInterval === "month") ||
    !offers.some((offer) => offer.billingInterval === "year")
  ) {
    throw new Error("The pricing catalog must contain one monthly and one annual offer.");
  }

  return { environment: expectedEnvironment, offers };
}

function configurationScript(config) {
  const publicConfig = {
    environment: config.environment,
    paddleEnvironment: config.paddleEnvironment,
    clientToken: config.clientToken,
    catalogPath: config.catalogPath,
    catalogEnvironment: config.catalogEnvironment,
    recoveryPath: config.recoveryPath,
    customerPortalURL: config.customerPortalURL,
  };

  return `window.__COVE_SITE_CONFIG__ = Object.freeze(${JSON.stringify(publicConfig)});\n`;
}

export function validateRecoveryRequest(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !Object.hasOwn(value, "licensingEmail") ||
    typeof value.licensingEmail !== "string" ||
    !EMAIL.test(value.licensingEmail) ||
    value.licensingEmail.length > 320
  ) {
    throw new Error("Invalid recovery request.");
  }

  return {
    licensingEmail: value.licensingEmail.toLowerCase(),
    idempotencyKey: crypto.randomUUID(),
  };
}

export async function forwardRecovery(config, recoveryRequest, fetcher = fetch) {
  try {
    await fetcher(config.recoveryURL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(recoveryRequest),
    });
  } catch {
    // The public response stays generic so delivery state cannot reveal an account.
  }
}

export async function acceptRecovery(config, request, context, fetcher = fetch) {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return Response.json(
      { accepted: false },
      { status: 415, headers: RECOVERY_HEADERS },
    );
  }

  const rawBody = await request.text();
  if (rawBody.length > 2048) {
    return Response.json(
      { accepted: false },
      { status: 400, headers: RECOVERY_HEADERS },
    );
  }

  let recoveryRequest;
  try {
    recoveryRequest = validateRecoveryRequest(JSON.parse(rawBody));
  } catch {
    return Response.json(
      { accepted: false },
      { status: 400, headers: RECOVERY_HEADERS },
    );
  }

  const forwarding = forwardRecovery(config, recoveryRequest, fetcher);
  if (typeof context?.waitUntil === "function") context.waitUntil(forwarding);
  else await forwarding;

  return Response.json(RECOVERY_ACCEPTED, { status: 202, headers: RECOVERY_HEADERS });
}

async function proxyCatalog(config) {
  const response = await fetch(config.catalogURL, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return Response.json(
      { error: "Pricing is temporarily unavailable." },
      { status: 502, headers: CATALOG_HEADERS },
    );
  }

  try {
    const catalog = validateCatalog(await response.json(), config.catalogEnvironment);
    return Response.json(catalog, { headers: CATALOG_HEADERS });
  } catch {
    return Response.json(
      { error: "Pricing is temporarily unavailable." },
      { status: 502, headers: CATALOG_HEADERS },
    );
  }
}

const worker = {
  async fetch(request, env, context) {
    const url = new URL(request.url);

    try {
      const config = resolveRuntimeConfig(env);
      if (url.pathname === "/site-config.js") {
        return new Response(configurationScript(config), { headers: PUBLIC_HEADERS });
      }
      if (url.pathname === "/api/catalog") {
        if (request.method !== "GET" && request.method !== "HEAD") {
          return new Response("Method not allowed.", { status: 405, headers: { Allow: "GET, HEAD" } });
        }
        return proxyCatalog(config);
      }
      if (url.pathname === "/api/license-recovery") {
        if (request.method !== "POST") {
          return new Response("Method not allowed.", { status: 405, headers: { Allow: "POST" } });
        }
        return acceptRecovery(config, request, context);
      }
    } catch {
      if (url.pathname === "/site-config.js") {
        return new Response(
          "window.__COVE_SITE_CONFIG_ERROR__ = true;\n",
          { status: 503, headers: PUBLIC_HEADERS },
        );
      }
      if (url.pathname === "/api/catalog") {
        return Response.json(
          { error: "Pricing is not configured." },
          { status: 503, headers: CATALOG_HEADERS },
        );
      }
      if (url.pathname === "/api/license-recovery") {
        return Response.json(
          RECOVERY_ACCEPTED,
          { status: 202, headers: RECOVERY_HEADERS },
        );
      }
    }

    return env.ASSETS.fetch(request);
  },
};

export default worker;
