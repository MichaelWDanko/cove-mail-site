export const ACTIVATION_ACCEPTED_MESSAGE =
  "If we find an email associated with the one provided, we will send an activation email back to them.";

const EMAIL = /^[^@\s]+@[^@\s]+$/;
const TRUSTED_PORTAL_HOSTS = new Set([
  "customer-portal.paddle.com",
  "sandbox-customer-portal.paddle.com",
]);

const TRUSTED_RECOVERY_ENDPOINTS = Object.freeze({
  sandbox: Object.freeze({
    hostname: "api.staging.covemail.ai",
    pathname: "/v1/recovery-requests",
  }),
  production: Object.freeze({
    hostname: "api.covemail.ai",
    pathname: "/v1/recovery-requests",
  }),
});

function isValidRecoveryPath(value, environment) {
  if (typeof value !== "string" || value.length === 0) return false;

  let recoveryURL;
  try {
    recoveryURL = new URL(value, "https://covemail.ai");
  } catch {
    return false;
  }

  if (value.startsWith("/")) {
    return (
      recoveryURL.origin === "https://covemail.ai" &&
      recoveryURL.pathname === "/api/license-recovery" &&
      !recoveryURL.search &&
      !recoveryURL.hash
    );
  }

  const expectedEndpoint = TRUSTED_RECOVERY_ENDPOINTS[environment];
  return (
    recoveryURL.protocol === "https:" &&
    recoveryURL.hostname === expectedEndpoint.hostname &&
    recoveryURL.port === "" &&
    recoveryURL.username === "" &&
    recoveryURL.password === "" &&
    recoveryURL.pathname === expectedEndpoint.pathname &&
    !recoveryURL.search &&
    !recoveryURL.hash
  );
}

export function validateLicenseConfig(config) {
  if (!config || (config.environment !== "sandbox" && config.environment !== "production")) {
    throw new Error("License self-service is not configured.");
  }

  const portalURL = new URL(config.customerPortalURL);
  const expectedPortalHost = config.environment === "sandbox"
    ? "sandbox-customer-portal.paddle.com"
    : "customer-portal.paddle.com";
  if (
    !isValidRecoveryPath(config.recoveryPath, config.environment) ||
    portalURL.protocol !== "https:" ||
    portalURL.hostname !== expectedPortalHost ||
    !TRUSTED_PORTAL_HOSTS.has(portalURL.hostname) ||
    portalURL.port ||
    portalURL.username ||
    portalURL.password ||
    portalURL.pathname !== "/" ||
    portalURL.search ||
    portalURL.hash
  ) {
    throw new Error("License self-service is not configured.");
  }

  return Object.freeze({
    recoveryPath: config.recoveryPath,
    customerPortalURL: portalURL.href,
  });
}

export function normalizeLicensingEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 320) {
    throw new Error("Enter a valid email address.");
  }
  return email;
}

export function recoveryRequest(email) {
  return Object.freeze({
    licensingEmail: normalizeLicensingEmail(email),
  });
}

function renderRecoveryStatus(node, message, tone = "quiet") {
  node.textContent = message;
  node.dataset.tone = tone;
}

function startLicenseSelfService() {
  const portalLink = document.querySelector("[data-customer-portal]");
  const form = document.querySelector("[data-activation-form]");
  const status = document.querySelector("[data-activation-status]");
  const submitButton = form?.querySelector("button[type=submit]");
  if (!portalLink || !form || !status || !submitButton) return;

  let config;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!config) return;
    const formData = new FormData(form);
    let request;
    try {
      request = recoveryRequest(formData.get("licensingEmail"));
    } catch (error) {
      renderRecoveryStatus(status, error.message, "error");
      return;
    }

    submitButton.disabled = true;
    renderRecoveryStatus(status, "Sending request…");
    try {
      const response = await fetch(config.recoveryPath, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });
      if (response.status !== 202) throw new Error("Recovery request failed.");
      form.reset();
      renderRecoveryStatus(status, ACTIVATION_ACCEPTED_MESSAGE, "success");
    } catch {
      renderRecoveryStatus(
        status,
        "We could not submit this request. Check your connection and try again.",
        "error",
      );
    } finally {
      submitButton.disabled = false;
    }
  });

  config = validateLicenseConfig(window.__COVE_SITE_CONFIG__);
  portalLink.href = config.customerPortalURL;
  portalLink.removeAttribute("aria-disabled");
  submitButton.disabled = false;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  try {
    startLicenseSelfService();
  } catch (error) {
    console.error(error);
    const status = document.querySelector("[data-activation-status]");
    if (status) {
      renderRecoveryStatus(status, "License self-service is temporarily unavailable.", "error");
    }
  }
}
