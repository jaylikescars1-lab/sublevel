/* SUBLEVEL AI: a small Cloudflare Worker that lets the phone app use Claude without each person
   needing their own Anthropic key. Your key stays here as a secret; people get in with an access code.

   Secrets (Cloudflare dashboard → this Worker → Settings → Variables and Secrets):
     ANTHROPIC_API_KEY  your Anthropic API key
     ACCESS_CODES       comma-separated codes you hand out, like "JAY-7Q2K,MIKE-91XD"
     PAUSED             optional; set to 1 to turn AI off for everyone */
import Anthropic from "@anthropic-ai/sdk";

const ORIGINS = ["https://jaylikescars1-lab.github.io"];
const MODEL = "claude-opus-5-5";
const MAX_TOKENS = 32000;
const EFFORTS = ["low", "medium", "high"];
const MAX_BODY = 8_000_000; // bytes; a few phone photos fit, a video doesn't

export default {
  async fetch(req, env) {
    const cors = corsFor(req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/") return json(200, { ok: true, service: "SUBLEVEL AI" }, cors);
    if (req.method !== "POST" || url.pathname !== "/v1/messages") return fail(404, "not_found_error", "Not found.", cors);

    const code = (req.headers.get("x-sublevel-code") || "").trim().toUpperCase();
    const codes = String(env.ACCESS_CODES || "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (!code || !codes.includes(code)) return fail(401, "authentication_error", "That access code isn't valid.", cors, "sublevel_code_invalid");
    if (String(env.PAUSED || "") === "1") return fail(503, "overloaded_error", "SUBLEVEL AI is paused right now.", cors, "sublevel_paused");
    if (!env.ANTHROPIC_API_KEY) return fail(500, "api_error", "The server has no Anthropic key set.", cors);

    if (+(req.headers.get("content-length") || 0) > MAX_BODY) return fail(413, "request_too_large", "That request is too big.", cors);
    let body;
    try { body = await req.json(); } catch (e) { return fail(400, "invalid_request_error", "Couldn't read the request.", cors); }
    const params = clean(body);
    if (typeof params === "string") return fail(400, "invalid_request_error", params, cors);

    // The app already retries; retrying here too would multiply requests.
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined, maxRetries: 0 });
    try {
      const upstream = await client.beta.messages.create(params).asResponse();
      return new Response(upstream.body, { status: upstream.status, headers: { ...cors, "content-type": upstream.headers.get("content-type") || "text/event-stream", "cache-control": "no-store" } });
    } catch (e) {
      if (e instanceof Anthropic.APIError && e.status) return json(e.status, e.error || { type: "error", error: { type: "api_error", message: "Claude returned an error." } }, cors);
      return fail(502, "api_error", "Couldn't reach Claude.", cors);
    }
  },
};

/* Rebuild the request from scratch: only the model, sizes and features the app uses get through. */
function clean(b) {
  if (!b || !Array.isArray(b.messages) || !b.messages.length || b.messages.length > 60) return "messages: expected 1 to 60 turns.";
  const messages = [];
  for (const m of b.messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return "messages: role must be user or assistant.";
    if (typeof m.content === "string") { messages.push({ role: m.role, content: m.content }); continue; }
    if (!Array.isArray(m.content)) return "messages: content must be text or blocks.";
    const blocks = [];
    for (const c of m.content) {
      if (c && c.type === "text" && typeof c.text === "string") blocks.push({ type: "text", text: c.text });
      else if (c && c.type === "image" && c.source && c.source.type === "base64" && /^image\/(jpeg|png|webp|gif)$/.test(c.source.media_type)) {
        if (blocks.filter((x) => x.type === "image").length >= 4) return "Up to 4 photos per request.";
        blocks.push({ type: "image", source: { type: "base64", media_type: c.source.media_type, data: String(c.source.data) } });
      } else return "messages: only text and image blocks are allowed.";
    }
    messages.push({ role: m.role, content: blocks });
  }
  const p = { model: MODEL, max_tokens: Math.max(1, Math.min(+b.max_tokens || 16000, MAX_TOKENS)), messages, stream: true };
  const oc = b.output_config || {};
  p.output_config = { effort: EFFORTS.includes(oc.effort) ? oc.effort : "medium" };
  if (oc.format && oc.format.type === "json_schema" && oc.format.schema && typeof oc.format.schema === "object") p.output_config.format = { type: "json_schema", schema: oc.format.schema };
  if (b.fallbacks === "default") Object.assign(p, { fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });
  return p;
}

function corsFor(req) {
  const origin = req.headers.get("origin") || "";
  return {
    "access-control-allow-origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": req.headers.get("access-control-request-headers") || "content-type, x-sublevel-code",
    "access-control-expose-headers": "request-id",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}
const json = (status, data, cors) => new Response(JSON.stringify(data), { status, headers: { ...cors, "content-type": "application/json" } });
const fail = (status, type, message, cors, error_code) => json(status, { type: "error", error: { type, message, ...(error_code ? { details: { error_code } } : {}) } }, cors);
