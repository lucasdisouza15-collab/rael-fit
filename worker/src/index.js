// Avisos de fim de descanso do Frangômetro (Cloudflare Worker + Durable Object).
// O site agenda o aviso (POST /agenda) e o Durable Object dispara um Web Push sem conteúdo no horário certo;
// o service worker do site (sw.js) mostra a notificação com uma frase do Rael.
const ORIGENS = ["https://lucasdisouza15-collab.github.io"];
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^web\.push\.apple\.com$/, /\.push\.apple\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^updates\.push\.services\.mozilla\.com$/];
const VAPID_PUBLICA = "BJaFRYvPv7GX37tIkqe2STVZw7X6WRshqKbPJgkup86YPdNrDsVBlZof6IQosdmWXb7nSmYHPs_NYZuz3BMt3HM";
const VAPID_ASSUNTO = "https://lucasdisouza15-collab.github.io/rael-fit/";

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const txt = s => new TextEncoder().encode(s);

function cors(req, extra = {}) {
  const o = req.headers.get("Origin");
  return Object.assign({ "Access-Control-Allow-Origin": ORIGENS.includes(o) ? o : ORIGENS[0], "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Vary": "Origin" }, extra);
}
const resp = (req, status, obj) => new Response(JSON.stringify(obj), { status, headers: cors(req, { "content-type": "application/json" }) });

async function jwtVapid(endpoint, jwkTxt) {
  const aud = new URL(endpoint).origin;
  const cab = b64u(txt(JSON.stringify({ typ: "JWT", alg: "ES256" }))), corpo = b64u(txt(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_ASSUNTO })));
  const key = await crypto.subtle.importKey("jwk", JSON.parse(jwkTxt), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, txt(cab + "." + corpo));
  return cab + "." + corpo + "." + b64u(sig);
}
export async function enviaPush(endpoint, env) {
  const jwt = await jwtVapid(endpoint, env.VAPID_PRIVATE_JWK);
  return fetch(endpoint, { method: "POST", headers: { Authorization: "vapid t=" + jwt + ", k=" + VAPID_PUBLICA, TTL: "120", Urgency: "high", "Content-Length": "0" } });
}

export class Descanso {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(req) {
    const u = new URL(req.url), body = await req.json().catch(() => ({}));
    if (u.pathname === "/agenda") {
      await this.state.storage.put("endpoint", body.endpoint);
      await this.state.storage.setAlarm(Date.now() + body.seg * 1000);
      return new Response("ok");
    }
    if (u.pathname === "/cancela") { await this.state.storage.deleteAlarm(); return new Response("ok"); }
    return new Response("?", { status: 404 });
  }
  async alarm() {
    const endpoint = await this.state.storage.get("endpoint"); if (!endpoint) return;
    const r = await enviaPush(endpoint, this.env);
    if (r.status === 404 || r.status === 410) await this.state.storage.deleteAll();
  }
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
    const u = new URL(req.url);
    if (req.method !== "POST" || !["/agenda", "/cancela"].includes(u.pathname)) return resp(req, 404, { erro: "rota" });
    if (!ORIGENS.includes(req.headers.get("Origin"))) return resp(req, 403, { erro: "origem" });
    const b = await req.json().catch(() => null), sub = b && b.sub, ep = sub && sub.endpoint;
    let host = ""; try { const x = new URL(ep); if (x.protocol !== "https:") throw 0; host = x.hostname; } catch (e) { return resp(req, 400, { erro: "endpoint" }); }
    if (!PUSH_HOSTS.some(r => r.test(host))) return resp(req, 400, { erro: "servico de push nao permitido" });
    const id = env.DESCANSO.idFromName(b64u(await crypto.subtle.digest("SHA-256", txt(ep))));
    const seg = Math.min(1800, Math.max(5, Math.round(+b.seg || 0)));
    return env.DESCANSO.get(id).fetch("https://do" + u.pathname, { method: "POST", body: JSON.stringify({ endpoint: ep, seg }) }).then(() => resp(req, 200, { ok: true }));
  }
};
