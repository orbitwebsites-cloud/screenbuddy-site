// Dependency-free bot detection + free-path rules for the x402 bot paywall.
// Kept separate from the paywall module so non-bot requests only pay for a UA check.

// AI crawlers / scrapers / generic HTTP clients that get charged (case-insensitive substring).
export const BOT_UA_PATTERNS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "CCBot",
  "PerplexityBot",
  "Perplexity-User",
  "Bytespider",
  "Amazonbot",
  "Applebot-Extended",
  "Google-Extended",
  "Meta-ExternalAgent",
  "meta-externalfetcher",
  "FacebookBot",
  "Diffbot",
  "cohere-ai",
  "cohere-training-data-crawler",
  "YouBot",
  "AI2Bot",
  "Ai2Bot-Dolma",
  "Timpibot",
  "ImagesiftBot",
  "omgili",
  "PetalBot",
  "Scrapy",
  "python-requests",
  "aiohttp",
  "Go-http-client",
  "curl",
  "wget",
  "HeadlessChrome",
  "PhantomJS",
];

// Search engines, link unfurlers, platform + uptime monitors: always free, checked first.
// "Applebot" is matched only when it is NOT "Applebot-Extended" (that one is charged).
export const ALLOWED_UA_PATTERNS = [
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  "Slurp",
  /applebot(?!-extended)/i,
  "Twitterbot",
  "facebookexternalhit",
  "LinkedInBot",
  "Slackbot",
  "Discordbot",
  "WhatsApp",
  "TelegramBot",
  "Vercel",
  // uptime monitors
  "UptimeRobot",
  "Pingdom",
  "StatusCake",
  "BetterUptime",
  "Better Stack",
  "Site24x7",
  "Datadog",
  "Checkly",
  "Freshping",
  "Uptime-Kuma",
  "HetrixTools",
  "Better Uptime Bot",
];

const lower = (list) => list.map((p) => (typeof p === "string" ? p.toLowerCase() : p));
const BOT_LOWER = lower(BOT_UA_PATTERNS);
const ALLOW_LOWER = lower(ALLOWED_UA_PATTERNS);

function matchesAny(uaLower, patterns) {
  for (const p of patterns) {
    if (typeof p === "string" ? uaLower.includes(p) : p.test(uaLower)) return true;
  }
  return false;
}

/** True when the User-Agent should be charged via x402. */
export function isChargeableBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  if (matchesAny(ua, ALLOW_LOWER)) return false;
  return matchesAny(ua, BOT_LOWER);
}

const STATIC_EXT =
  /\.(?:css|js|mjs|map|json|png|jpe?g|gif|svg|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp4|webm|mp3|txt|xml|webmanifest)$/i;

/** Paths that are never charged (crawl metadata, static assets, API/webhook routes). */
export function isFreePath(pathname) {
  const p = pathname || "/";
  return (
    p === "/robots.txt" ||
    p === "/llms.txt" ||
    /^\/sitemap[^/]*\.xml$/i.test(p) ||
    p.startsWith("/favicon") ||
    p.startsWith("/.well-known/") ||
    p.startsWith("/_next/static/") ||
    p.startsWith("/assets/") ||
    p.startsWith("/images/") ||
    p.startsWith("/fonts/") ||
    p.startsWith("/css/") ||
    p.startsWith("/js/") ||
    p === "/api" ||
    p.startsWith("/api/") ||
    STATIC_EXT.test(p)
  );
}
