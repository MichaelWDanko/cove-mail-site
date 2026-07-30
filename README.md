# Cove Mail Site

Landing page, privacy policy, and Paddle overlay checkout for Cove Mail.

The site is intended to be hosted with GitHub Pages at:

```text
covemail.ai
```

## Purchase boundary

The browser reads monthly and annual offers from the licensing service safe
catalog and asks Paddle `PricePreview` for localized prices. A plan button opens
Paddle overlay checkout with one matching price.

Browser events never grant a license. Paid access starts only after the
licensing backend verifies and processes a signed Paddle webhook.

## Environment configuration

Set these runtime values:

- `COVE_SITE_ENV=sandbox` with a `test_` Paddle client-side token for staging.
- `COVE_SITE_ENV=production` with a `live_` Paddle client-side token for release.

The worker selects the corresponding fixed catalog URL. It rejects a token from
the other environment. Paddle client-side tokens are browser-safe. Do not use a
Paddle API key or webhook secret here.

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
committed. Production deployment is a separate release action.
