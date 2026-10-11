# ScreenBuddy Site

Static landing and support site for ScreenBuddy.

- Home domain: `screenbudy.orbitboyzz.me`
- Support domain: `support.orbitboyzz.me`

The support page reads setup failure data from URL query params:

```text
https://support.orbitboyzz.me/?error=...&platform=win32&version=0.1.0
```

It prefills the support form so the user only enters an email.

## Deploy

Use Cloudflare Pages, Vercel, or Netlify with this repo as a static site.
Attach both custom domains to the same deployment:

- `screenbudy.orbitboyzz.me` -> home page
- `support.orbitboyzz.me` -> support page redirect

The form posts to `https://formsubmit.co/support@orbitboyzz.me`.
That inbox must confirm FormSubmit once before messages are delivered.

## x402 bot paywall

`middleware.js` (Vercel Routing Middleware, Node runtime) charges AI crawlers and scrapers via
[x402](https://github.com/coinbase/x402); humans browse free.

- Normal browsers: untouched (only a User-Agent check).
- AI crawlers / scrapers (`BOT_UA_PATTERNS` in `x402/bot-patterns.js`, e.g. GPTBot, ClaudeBot, CCBot, curl):
  HTTP 402 with x402 v2 payment requirements (`PAYMENT-REQUIRED` header + JSON body). Requests that send a
  valid `PAYMENT-SIGNATURE` are verified and settled through the facilitator, then served with a
  `PAYMENT-RESPONSE` header.
- Search engines, link unfurlers and uptime monitors (Googlebot, Bingbot, Applebot, Slackbot, ...) are always free.
- Always free paths: `/robots.txt`, `/sitemap*.xml`, `/favicon*`, `/llms.txt`, `/.well-known/*`, `/api/*`,
  and static assets (`/assets/*`, css/js/images/fonts).
- Fails open: any error or facilitator outage serves the page normally.

Config (env vars, see `.env.example`): `X402_PAY_TO`, `X402_PRICE` (default `$0.001`), `X402_NETWORK`
(default `eip155:8453`, Base mainnet USDC), `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` (Coinbase CDP facilitator),
`X402_FACILITATOR_URL` (fallback, default `https://x402.org/facilitator`), `X402_ENABLED=false` to disable.

Base mainnet requires the CDP facilitator keys; the public x402.org facilitator is testnet-only, so without
the keys the middleware fails open and bots are served for free.

Quick check after deploy:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -A GPTBot https://screenbudy.orbitboyzz.me/      # 402
curl -s -o /dev/null -w '%{http_code}\n' -A Googlebot https://screenbudy.orbitboyzz.me/   # 200
```
