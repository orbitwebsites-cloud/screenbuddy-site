// Vercel Routing Middleware: x402 bot paywall.
// Humans browse free (UA check only). AI crawlers/scrapers get HTTP 402 + x402 payment requirements;
// if they pay, the page is served. Any error fails open (page served normally).
import { next } from "@vercel/functions";
import { isChargeableBot, isFreePath } from "./x402/bot-patterns.js";

export const config = {
  // Skip obvious static assets at the edge; everything else is filtered in code.
  matcher: ["/((?!assets/|favicon|robots\\.txt|llms\\.txt|\\.well-known/|api/).*)"],
  runtime: "nodejs",
};

export default async function middleware(request) {
  try {
    if (String(process.env.X402_ENABLED ?? "true").trim().toLowerCase() === "false") return next();
    if (!isChargeableBot(request.headers.get("user-agent"))) return next();
    if (isFreePath(new URL(request.url).pathname)) return next();

    // Lazy-load the x402 libs only for chargeable bot traffic.
    const { handleBotRequest } = await import("./x402/bot-paywall.js");
    const outcome = await handleBotRequest(request);
    if (outcome.action === "respond") return outcome.response;
    return next(outcome.headers ? { headers: outcome.headers } : undefined);
  } catch (err) {
    console.error("[x402-bot-paywall] failing open:", err);
    return next();
  }
}
