# Cove Mail Site

Bring Your Own AI landing page, Get Cove Mail download and pricing, subscription
self-service, Privacy Policy, Terms of Service, and Refund Policy for Cove Mail.

The site is intended to be hosted with GitHub Pages at:

```text
covemail.ai
```

## Download boundary

The Get Cove Mail page links directly to the stable latest-release asset:

```text
https://github.com/MichaelWDanko/cove-mail-releases/releases/latest/download/Cove-Mail.dmg
```

Every production release must upload a byte-identical asset with the exact name
`Cove-Mail.dmg`. The versioned DMG remains the source for the Sparkle appcast and
release verification. The website does not use browser-side GitHub API lookup.

## Purchase boundary

The browser reads monthly and annual offers from the licensing service safe
catalog and asks Paddle `PricePreview` for localized prices. A plan button opens
Paddle overlay checkout with one matching price.

Browser events never grant a license. Paid access starts only after the
licensing backend verifies and processes a signed Paddle webhook.

## Subscription self-service boundary

The subscription page sends customers to the environment-matched Paddle customer
portal. Paddle authenticates customers by email and provides billing,
payment-method, renewal, and cancellation controls.

Activation email requests ask only for the licensing email. The browser posts
to the same-origin `/api/license-recovery` worker route. The worker forwards the
request to the environment-matched licensing service and always returns the same
accepted response for a syntactically valid request. The browser never receives
license lookup or delivery details.

The same-origin worker route avoids adding cross-origin browser access to the
licensing API. GitHub Pages can serve the static files, but it cannot run the
worker routes needed for checkout configuration, pricing, or license recovery.

## Deployment model

The repository uses two deployment paths:

- `main` deploys to the private ChatGPT Sites staging project. It uses the
  worker runtime and sandbox Paddle configuration.
- `release` deploys the static production site to GitHub Pages at
  `https://covemail.ai` through `.github/workflows/pages.yml`.

GitHub Pages receives `dist-pages/`, which contains only static files. Its
configuration and catalog are generated during the release build. The Paddle
client-side token and price IDs are public browser configuration, but API keys,
webhook secrets, and database credentials must never be placed in this
repository or the Pages artifact.

## Static Pages configuration

The GitHub Pages workflow requires these repository or environment variables:

- `COVE_PADDLE_CLIENT_TOKEN`, using the production `live_` client-side token.
- `COVE_MONTHLY_PRICE_ID`, using the production monthly Paddle price ID.
- `COVE_ANNUAL_PRICE_ID`, using the production annual Paddle price ID.
- `COVE_PADDLE_PRODUCT_ID`, when a product ID is available for the catalog.

The static production build uses `/catalog.json` for the two price IDs, calls
Paddle's browser SDK for localized price preview, and sends recovery requests
to `https://api.covemail.ai/v1/recovery-requests`. That API must allow CORS
from `https://covemail.ai` before the activation form can work from GitHub
Pages. The subscription portal link is environment-specific static
configuration.

Run the static build locally with:

```sh
COVE_SITE_ENV=production \
COVE_PADDLE_CLIENT_TOKEN=live_replace_with_client_token \
COVE_MONTHLY_PRICE_ID=pri_replace_with_monthly_price_id \
COVE_ANNUAL_PRICE_ID=pri_replace_with_annual_price_id \
npm run build:pages
```

Configure GitHub Pages to use the GitHub Actions publishing source. Keep
`CNAME` set to `covemail.ai` and configure that custom domain in the repository
Pages settings. The production licensing API, Paddle webhooks, entitlement
creation, and recovery email service remain external dynamic services. GitHub
Pages hosts only the public site.

## Local validation

From the repository root, run:

```sh
npm test
npm run build
npm run dev
```

Then open `http://127.0.0.1:4173/` in a browser.

The local preview uses an inert sandbox-shaped token unless
`COVE_PADDLE_CLIENT_TOKEN` is set. A real sandbox client-side token is required
to preview prices or open checkout.

## Sites staging

The build produces a Cloudflare Workers-compatible `dist/` directory for
private ChatGPT Sites staging. Runtime values are managed by Sites and are not
committed. Production deployment uses the separate static Pages workflow from
`release`.
