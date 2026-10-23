// "Ask Japa Info" chat helper — Cloudflare Worker.
// Deploy: Cloudflare Workers Builds, connected to this repo with root directory "worker" (see wrangler.toml).
// wrangler.toml adds the Workers AI binding (AI) and the custom domain ask.japainfong.com.
// The site widget (assets/ask.js) posts to https://ask.japainfong.com/chat.

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const SITE = "https://japainfong.com";
const ALLOWED_ORIGINS = ["https://japainfong.com", "https://www.japainfong.com", "https://promoradarng.github.io"];
const MAX_TURNS = 10;        // messages kept from the conversation
const MAX_CHARS = 800;       // per user message
const PER_IP_PER_HOUR = 30;  // simple abuse guard (per Worker instance)

const GUIDES = `Japa Info guide pages (link the most relevant one when it helps):
- Visa routes (UK student, Graduate, Skilled Worker; Canada study and Express Entry; Germany Opportunity Card): ${SITE}/visa-routes/
- Study abroad and affordable universities: ${SITE}/study-abroad/
- Proof of funds calculator in naira: ${SITE}/funds-calculator/
- Passport and visa costs: ${SITE}/costs/
- Best time to apply: ${SITE}/when-to-apply/
- What happens if you overstay: ${SITE}/overstaying/
- How to spot fake visas and japa scams: ${SITE}/visa-scams/
- Latest visa news: ${SITE}/news/`;

const SYSTEM = `You are "Ask Japa Info", the assistant on japainfong.com, a news and guide site about legal ways for Nigerians to study, work, visit or relocate abroad ("japa").

How to answer:
- Be warm, clear and practical. Short paragraphs or a few bullet points. Plain English; light Nigerian Pidgin is fine if the reader writes in Pidgin.
- Give general information only. You are not a lawyer, a regulated immigration adviser or a visa agent, and you cannot assess anyone's individual case, check documents or predict whether a visa will be approved.
- Immigration rules, fees and processing times change often. Say so when you give figures, and tell the reader to confirm on the official government website (for example gov.uk for the UK, canada.ca for Canada, travel.state.gov for the USA, auswaertiges-amt.de / make-it-in-germany.com for Germany, immi.homeaffairs.gov.au for Australia, immigration.govt.nz for New Zealand, the Nigeria Immigration Service at immigration.gov.ng for passports).
- If you are not sure of a current figure or rule, say you are not sure rather than guessing, and point to the official site.
- Point readers to the most relevant Japa Info page or recent news story when it genuinely helps.
- For a specific personal case (refusals, appeals, overstays, deportation, complex history), recommend a regulated adviser: in the UK an OISC-registered adviser or solicitor, in Canada a CICC-licensed consultant (RCIC) or lawyer, in Australia a MARA-registered agent.

Safety rules (never break these):
- Only help with legal routes. Never help with fake documents, fake bank statements or "funds lending" for proof of funds, sham marriages, lying on applications, overstaying on purpose, entering a country illegally, or dodging immigration checks. If asked, refuse briefly and explain the legal alternative and the risks (bans, deportation, prosecution).
- Warn about scams: no one can guarantee a visa; embassies do not use paid agents to "speed up" decisions; never pay anyone who asks for money to secure a job offer or visa slot; check sponsors and schools on official registers.
- Never ask for or store passport numbers, BVN, bank details or other sensitive personal data. If a reader shares them, tell them not to.
- Stay on topic: travel, visas, study abroad, work abroad, relocation, passports and related money matters. For unrelated requests, politely say you only help with japa questions.
- Do not invent Japa Info pages or news stories; only link to the pages and stories listed below.

${GUIDES}`;

const hits = new Map();

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin || "");
  return {
    "Access-Control-Allow-Origin": ok ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) } });
}

async function latestNews(ctx) {
  const cache = caches.default;
  const key = new Request(SITE + "/data/news.json");
  let res = await cache.match(key);
  if (!res) {
    try {
      const fresh = await fetch(key, { cf: { cacheTtl: 1800 } });
      if (!fresh.ok) return "";
      res = new Response(await fresh.text(), { headers: { "Content-Type": "application/json", "Cache-Control": "max-age=1800" } });
      ctx.waitUntil(cache.put(key, res.clone()));
    } catch { return ""; }
  }
  try {
    const data = await res.json();
    return (data.stories || []).slice(0, 15).map(s =>
      `- ${s.date} [${s.country}] ${s.headline}: ${s.summary} (Japa Info page: ${SITE}/news/${s.id}/)`).join("\n");
  } catch { return ""; }
}

// Text of the site's own guide pages + the funds calculator figures, cached for 3 hours.
const GUIDE_PATHS = ["/visa-routes/", "/funds-calculator/", "/costs/", "/when-to-apply/", "/study-abroad/", "/overstaying/", "/visa-scams/"];

function pageText(html) {
  const m = html.match(/<main>([\s\S]*?)<\/main>/i);
  let t = (m ? m[1] : html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/li|\/h\d|\/tr|\/div)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&pound;/g, "£").replace(/&euro;/g, "€")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return t.slice(0, 6000);
}

async function guideText(ctx) {
  const cache = caches.default;
  const key = new Request(SITE + "/__ask_guides_v1");
  const hit = await cache.match(key);
  if (hit) return hit.text();
  const parts = await Promise.all(GUIDE_PATHS.map(async p => {
    try { const r = await fetch(SITE + p); return r.ok ? `### Page ${SITE}${p}\n${pageText(await r.text())}` : ""; } catch { return ""; }
  }));
  try {
    const js = await (await fetch(SITE + "/assets/calc.js")).text();
    const rows = [...js.matchAll(/"([\w-]+)":\{amt:(\d+),cur:"([^"]+)",name:"\w+",note:"([^"]+)"\}/g)]
      .map(m => `- ${m[1]}: ${m[3]}${Number(m[2]).toLocaleString("en-GB")} (${m[4]})`);
    const labels = [...(parts[1] || "").matchAll(/UK Student[^\n]*|Canada Study[^\n]*|Germany Opportunity[^\n]*|Ireland Student[^\n]*|New Zealand Student[^\n]*/g)].map(m => m[0]);
    if (rows.length) parts.push(`### Proof-of-funds figures used by the Japa Info calculator (living costs only unless stated; keys: uk-lon = UK London before 30 Nov 2026, uk-out = UK outside London before 30 Nov 2026, uk-lon-new / uk-out-new = from 30 Nov 2026, ca = Canada, de = Germany Opportunity Card, ie = Ireland, nz = New Zealand)\n${rows.join("\n")}${labels.length ? "\nCalculator options: " + labels.join("; ") : ""}`);
  } catch {}
  const text = parts.filter(Boolean).join("\n\n");
  if (text) ctx.waitUntil(cache.put(key, new Response(text, { headers: { "Cache-Control": "max-age=10800" } })));
  return text;
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (url.pathname === "/" && request.method === "GET") return new Response("Ask Japa Info is running.", { headers: cors(origin) });
    if (url.pathname !== "/chat" || request.method !== "POST") return json({ error: "Not found" }, 404, origin);

    const allowed = ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
    if (!allowed) return json({ error: "This assistant only works on japainfong.com." }, 403, origin);

    // simple per-IP limit
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const now = Date.now(), hour = 3600_000;
    const rec = (hits.get(ip) || []).filter(t => now - t < hour);
    if (rec.length >= PER_IP_PER_HOUR) return json({ error: "You've asked a lot of questions this hour. Please try again a bit later." }, 429, origin);
    rec.push(now); hits.set(ip, rec);
    if (hits.size > 5000) hits.clear();

    let body;
    try { body = await request.json(); } catch { return json({ error: "Bad request" }, 400, origin); }
    const msgs = Array.isArray(body?.messages) ? body.messages : [];
    const clean = msgs
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-MAX_TURNS)
      .map(m => ({ role: m.role, content: m.content.slice(0, m.role === "user" ? MAX_CHARS : 2000) }));
    if (!clean.length || clean[clean.length - 1].role !== "user") return json({ error: "Please type a question." }, 400, origin);

    const [news, guides] = await Promise.all([latestNews(ctx), guideText(ctx)]);
    const today = new Date().toISOString().slice(0, 10);
    const system = `${SYSTEM}

Facts to rely on:
- Base every figure (money amounts, fees, dates, processing times, points) ONLY on the Japa Info guide text and news below. Copy figures exactly as written there, with the date they apply from. Never invent or "update" a figure.
- If the guide text and news do not cover something, say clearly that you don't have a confirmed figure, explain the general rule if you know it, and send the reader to the official site.
- Keep answers short: usually under 150 words. Write clean, complete sentences.

Today's date: ${today}.

${guides ? "JAPA INFO GUIDE TEXT:\n" + guides : ""}

${news ? "LATEST JAPA INFO NEWS (most recent first):\n" + news : ""}`;

    try {
      const out = await env.AI.run(MODEL, { messages: [{ role: "system", content: system }, ...clean], max_tokens: 500, temperature: 0.2 });
      const reply = (out && (out.response || out.result?.response) || "").trim();
      if (!reply) return json({ error: "Sorry, I couldn't answer that just now. Please try again." }, 502, origin);
      return json({ reply }, 200, origin);
    } catch (err) {
      return json({ error: "The assistant is busy right now. Please try again in a minute." }, 503, origin);
    }
  },
};
