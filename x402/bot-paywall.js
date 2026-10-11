// x402 bot paywall: AI crawlers/scrapers get HTTP 402 + x402 v2 payment requirements;
// bots that pay (PAYMENT-SIGNATURE / X-PAYMENT header) get verified + settled and served normally.
// Loaded lazily by /middleware.js, only for requests already classified as chargeable bots.
import { x402ResourceServer, x402HTTPResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createFacilitatorConfig } from "@coinbase/x402";

const DEFAULT_PAY_TO = "0x0ba3b8796ce61ef8Cbd11A7F33Be31F1Fd4A03B3";
const DEFAULT_PRICE = "$0.001";
const DEFAULT_NETWORK = "eip155:8453"; // Base mainnet (USDC)
const DEFAULT_FACILITATOR_URL = "https://x402.org/facilitator";

export function getPaywallConfig(env = process.env) {
  const useCdp = Boolean(env.CDP_API_KEY_ID && env.CDP_API_KEY_SECRET);
  return {
    payTo: env.X402_PAY_TO || DEFAULT_PAY_TO,
    price: env.X402_PRICE || DEFAULT_PRICE,
    network: env.X402_NETWORK || DEFAULT_NETWORK,
    useCdp,
    facilitatorUrl: useCdp ? "cdp" : env.X402_FACILITATOR_URL || DEFAULT_FACILITATOR_URL,
  };
}

function createFacilitatorClient(cfg, env = process.env) {
  if (cfg.useCdp) {
    // Authenticated Coinbase CDP facilitator (https://api.cdp.coinbase.com/platform/v2/x402).
    return new HTTPFacilitatorClient(createFacilitatorConfig(env.CDP_API_KEY_ID, env.CDP_API_KEY_SECRET));
  }
  return new HTTPFacilitatorClient({ url: cfg.facilitatorUrl });
}

// Minimal HTTPAdapter over a Web `Request` (Vercel Routing Middleware).
class WebRequestAdapter {
  constructor(request, url) {
    this.req = request;
    this.url = url;
  }
  getHeader(name) {
    return this.req.headers.get(name) ?? undefined;
  }
  getMethod() {
    return this.req.method;
  }
  getPath() {
    return this.url.pathname;
  }
  getUrl() {
    return this.req.url;
  }
  // Always answer bots with machine-readable JSON requirements (never the HTML wallet paywall).
  getAcceptHeader() {
    return "application/json";
  }
  getUserAgent() {
    return this.req.headers.get("user-agent") || "";
  }
  getQueryParams() {
    const params = {};
    this.url.searchParams.forEach((value, key) => {
      const existing = params[key];
      if (existing === undefined) params[key] = value;
      else if (Array.isArray(existing)) existing.push(value);
      else params[key] = [existing, value];
    });
    return params;
  }
  getQueryParam(name) {
    const all = this.url.searchParams.getAll(name);
    if (all.length === 0) return undefined;
    return all.length === 1 ? all[0] : all;
  }
}

let cached = null; // { key, httpServer, initPromise }

function getHttpServer(env = process.env) {
  const cfg = getPaywallConfig(env);
  const key = JSON.stringify(cfg);
  if (cached && cached.key === key) return cached;

  const resourceServer = new x402ResourceServer(createFacilitatorClient(cfg, env)).register(
    cfg.network,
    new ExactEvmScheme(),
  );
  // Single RouteConfig => applies to every path the middleware forwards here.
  const httpServer = new x402HTTPResourceServer(resourceServer, {
    accepts: { scheme: "exact", price: cfg.price, network: cfg.network, payTo: cfg.payTo },
    description: "Paid access for automated agents",
    mimeType: "text/html",
  });
  cached = { key, httpServer, initPromise: null, initFailedAt: 0 };
  return cached;
}

const INIT_RETRY_MS = 60_000;

async function ensureInitialized(entry) {
  // After a failed init (facilitator down / unsupported network), fail open fast instead of
  // hitting the facilitator on every bot request; retry after INIT_RETRY_MS.
  if (entry.initFailedAt && Date.now() - entry.initFailedAt < INIT_RETRY_MS) {
    throw new Error("x402 facilitator init failed recently; skipping until retry window");
  }
  if (!entry.initPromise) {
    entry.initPromise = entry.httpServer.initialize().then(
      () => {
        entry.initFailedAt = 0;
      },
      (err) => {
        entry.initPromise = null; // allow retry later
        entry.initFailedAt = Date.now();
        throw err;
      },
    );
  }
  await entry.initPromise;
}

function decodePath(path) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * Handle a request from a chargeable bot.
 * @returns {Promise<{ action: "pass", headers?: Record<string,string> } | { action: "respond", response: Response }>}
 *   "pass" => let the static page be served (optionally adding response headers).
 * Throws on infrastructure errors; the caller fails open.
 */
export async function handleBotRequest(request, env = process.env) {
  const url = new URL(request.url);
  const entry = getHttpServer(env);
  const { httpServer } = entry;
  const adapter = new WebRequestAdapter(request, url);
  const context = {
    adapter,
    path: url.pathname,
    decodedPath: decodePath(url.pathname),
    method: request.method,
    paymentHeader: adapter.getHeader("payment-signature") || adapter.getHeader("x-payment"),
  };

  if (!httpServer.requiresPayment(context)) return { action: "pass" };

  await ensureInitialized(entry);
  const result = await httpServer.processHTTPRequest(context);

  switch (result.type) {
    case "no-payment-required":
      return { action: "pass" };

    case "payment-error": {
      const { status, headers, body } = result.response;
      let payload = body;
      // v2 carries requirements in the PAYMENT-REQUIRED header; mirror them in the JSON body.
      const encoded = headers?.["PAYMENT-REQUIRED"];
      if (encoded && (!payload || (typeof payload === "object" && Object.keys(payload).length === 0))) {
        payload = decodePaymentRequiredHeader(encoded);
      }
      const out = new Headers(headers || {});
      out.set("Content-Type", "application/json");
      return {
        action: "respond",
        response: new Response(typeof payload === "string" ? payload : JSON.stringify(payload ?? {}), {
          status,
          headers: out,
        }),
      };
    }

    case "payment-verified": {
      // Static content: there is no handler response to inspect, so settle now, then serve.
      const settle = await httpServer.processSettlement(
        result.paymentPayload,
        result.paymentRequirements,
        result.declaredExtensions,
        { request: context },
        undefined,
        result.beforeHandlerSettlement,
      );
      if (!settle.success) {
        const r = settle.response;
        const body = r.isHtml ? r.body : JSON.stringify(r.body ?? {});
        return { action: "respond", response: new Response(body, { status: r.status, headers: r.headers }) };
      }
      return {
        action: "pass",
        headers: { ...settle.headers, "Cache-Control": "private, no-store" },
      };
    }

    default:
      return { action: "pass" };
  }
}
