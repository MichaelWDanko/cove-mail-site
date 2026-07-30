const PLAN_ORDER = Object.freeze(["month", "year"]);

export function validateSiteConfig(config) {
  if (!config || (config.environment !== "sandbox" && config.environment !== "production")) {
    throw new Error("The purchase environment is not configured.");
  }

  const expectedPaddleEnvironment = config.environment === "sandbox" ? "sandbox" : "production";
  const expectedTokenPrefix = config.environment === "sandbox" ? "test_" : "live_";
  if (
    config.paddleEnvironment !== expectedPaddleEnvironment ||
    config.catalogEnvironment !== config.environment ||
    typeof config.clientToken !== "string" ||
    !config.clientToken.startsWith(expectedTokenPrefix) ||
    config.catalogPath !== "/api/catalog"
  ) {
    throw new Error("The purchase configuration mixes Paddle environments.");
  }
  return config;
}

export function normalizeCatalog(catalog, expectedEnvironment) {
  if (!catalog || catalog.environment !== expectedEnvironment || !Array.isArray(catalog.offers)) {
    throw new Error("Pricing does not match this purchase environment.");
  }

  const plans = new Map();
  for (const offer of catalog.offers) {
    if (
      !PLAN_ORDER.includes(offer?.billingInterval) ||
      typeof offer?.priceId !== "string" ||
      offer.priceId.length === 0 ||
      plans.has(offer.billingInterval)
    ) {
      throw new Error("Pricing contains an invalid plan.");
    }
    plans.set(offer.billingInterval, Object.freeze({
      interval: offer.billingInterval,
      priceId: offer.priceId,
    }));
  }
  if (plans.size !== PLAN_ORDER.length || PLAN_ORDER.some((interval) => !plans.has(interval))) {
    throw new Error("Monthly and annual pricing are required.");
  }
  return plans;
}

export function checkoutItems(plan) {
  if (!plan?.priceId) throw new Error("A valid plan is required.");
  return [{ priceId: plan.priceId, quantity: 1 }];
}

export function checkoutOptions(plan) {
  return {
    items: checkoutItems(plan),
    settings: { displayMode: "overlay" },
  };
}

export function initializePaddle(Paddle, config, eventCallback) {
  if (!Paddle?.Initialize || !Paddle?.Checkout?.open || !Paddle?.PricePreview) {
    throw new Error("Paddle checkout did not load.");
  }

  if (config.paddleEnvironment === "sandbox") Paddle.Environment.set("sandbox");
  Paddle.Initialize({ token: config.clientToken, eventCallback });
  return Paddle;
}

export async function previewPlans(Paddle, plans) {
  const items = PLAN_ORDER.map((interval) => checkoutItems(plans.get(interval))[0]);
  const preview = await Paddle.PricePreview({ items });
  const lineItems = preview?.data?.details?.lineItems;
  if (!Array.isArray(lineItems)) throw new Error("Paddle returned no localized prices.");

  const formattedPrices = new Map();
  for (const item of lineItems) {
    const priceId = item?.price?.id;
    const subtotal = item?.formattedUnitTotals?.subtotal;
    if (typeof priceId === "string" && typeof subtotal === "string") {
      formattedPrices.set(priceId, subtotal);
    }
  }
  if ([...plans.values()].some((plan) => !formattedPrices.has(plan.priceId))) {
    throw new Error("Paddle returned incomplete localized prices.");
  }
  return formattedPrices;
}

function renderStatus(message, tone = "quiet") {
  const node = document.querySelector("[data-checkout-status]");
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone;
}

function setButtonsEnabled(enabled) {
  document.querySelectorAll("[data-plan]").forEach((button) => {
    button.disabled = !enabled;
  });
}

async function startCheckout() {
  const config = validateSiteConfig(window.__COVE_SITE_CONFIG__);
  const catalogResponse = await fetch(config.catalogPath, {
    headers: { Accept: "application/json" },
  });
  if (!catalogResponse.ok) throw new Error("Pricing is temporarily unavailable.");

  const plans = normalizeCatalog(await catalogResponse.json(), config.catalogEnvironment);
  const Paddle = initializePaddle(window.Paddle, config, (event) => {
    if (event?.name === "checkout.completed") {
      renderStatus(
        "Payment received. Cove Mail will email your activation link after the signed Paddle event is verified.",
        "success",
      );
    }
  });
  const prices = await previewPlans(Paddle, plans);

  for (const [interval, plan] of plans) {
    const priceNode = document.querySelector(`[data-price="${interval}"]`);
    if (priceNode) priceNode.textContent = prices.get(plan.priceId);
    const button = document.querySelector(`[data-plan="${interval}"]`);
    button?.addEventListener("click", () => {
      renderStatus("Opening secure Paddle checkout…");
      Paddle.Checkout.open(checkoutOptions(plan));
    });
  }

  setButtonsEnabled(true);
  renderStatus(
    config.environment === "sandbox"
      ? "Sandbox checkout is ready. Test purchases do not charge a real payment method."
      : "Secure checkout is ready.",
  );
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  setButtonsEnabled(false);
  startCheckout().catch((error) => {
    console.error(error);
    renderStatus("Pricing is temporarily unavailable. Try again later.", "error");
  });
}
