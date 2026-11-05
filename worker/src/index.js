// Avisos do Frangômetro (Cloudflare Worker + Durable Objects).
// Web Push SEM conteúdo: ao disparar, o service worker pergunta aqui (/proximo) o que mostrar.
//  - Descanso: o site agenda (POST /agenda) e um alarme dispara no horário.
//  - Lembretes do dia: o site manda config + estado do dia (POST /config); o alarme avalia cada lembrete,
//    pula o que já foi feito, respeita o máximo de 4 por dia e a janela 07:00–22:30.
//  - Novidade: o GitHub Actions chama POST /novidade (autenticado) quando um commit traz "[avisar]".
import { MAX_DIA, JANELA_MIN, TIPOS, limpaCfg, limpaEstado, local, proximo, motivoPular, monta } from "./logica.js";

const ORIGENS = ["https://lucasdisouza15-collab.github.io"];
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^web\.push\.apple\.com$/, /\.push\.apple\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^updates\.push\.services\.mozilla\.com$/];
const VAPID_PUBLICA = "BJaFRYvPv7GX37tIkqe2STVZw7X6WRshqKbPJgkup86YPdNrDsVBlZof6IQosdmWXb7nSmYHPs_NYZuz3BMt3HM";
const VAPID_ASSUNTO = "https://lucasdisouza15-collab.github.io/rael-fit/";

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const txt = s => new TextEncoder().encode(s);
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

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
export async function enviaPush(endpoint, env, urgencia = "high") {
  const jwt = await jwtVapid(endpoint, env.VAPID_PRIVATE_JWK);
  return fetch(endpoint, { method: "POST", headers: { Authorization: "vapid t=" + jwt + ", k=" + VAPID_PUBLICA, TTL: "120", Urgency: urgencia, "Content-Length": "0" } });
}
async function idDoEndpoint(env, ep) { return env.DESCANSO.idFromName(b64u(await crypto.subtle.digest("SHA-256", txt(ep)))); }
async function tokenAdmin(env) { return hex(await crypto.subtle.digest("SHA-256", txt("admin:" + JSON.parse(env.VAPID_PRIVATE_JWK).d))); }

export class Descanso {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(req) {
    const u = new URL(req.url), b = await req.json().catch(() => ({})), st = this.state.storage;
    if (u.pathname === "/agenda") {
      await st.put("endpoint", b.endpoint); await st.put("rest", { at: Date.now() + b.seg * 1000 });
      await this.reagenda(); return new Response("ok");
    }
    if (u.pathname === "/cancela") { await st.delete("rest"); await this.reagenda(); return new Response("ok"); }
    if (u.pathname === "/config") {
      await st.put("endpoint", b.endpoint);
      await st.put("cfg", limpaCfg(b.cfg)); await st.put("estado", limpaEstado(b.estado));
      await st.put("tz", Math.max(-840, Math.min(840, Math.round(+b.tz || 0))));
      if (!(await st.get("reg"))) { await this.registro("/add", { hash: b.hash }); await st.put("reg", true); }
      await this.reagenda(); return new Response("ok");
    }
    if (u.pathname === "/sair") { await st.deleteAlarm(); await st.deleteAll(); await this.registro("/del", { hash: b.hash }); return new Response("ok"); }
    if (u.pathname === "/proximo") {
      const fila = (await st.get("fila")) || [], m = fila.shift(); await st.put("fila", fila);
      return new Response(JSON.stringify(m || { tipo: "descanso" }), { headers: { "content-type": "application/json" } });
    }
    if (u.pathname === "/novidade") {
      const endpoint = await st.get("endpoint"); if (!endpoint) return new Response("sem");
      await this.empilha({ tipo: "novidade", titulo: "Novidade no Frangômetro", corpo: b.texto || "O Frangômetro atualizou. Abra o app para ver o que mudou.", tag: "rael-novidade" });
      await this.dispara(endpoint, "normal"); return new Response("ok");
    }
    return new Response("?", { status: 404 });
  }
  registro(rota, corpo) { return this.env.REGISTRO.get(this.env.REGISTRO.idFromName("global")).fetch("https://do" + rota, { method: "POST", body: JSON.stringify(corpo) }).catch(() => {}); }
  async empilha(m) { const st = this.state.storage, f = (await st.get("fila")) || []; f.push(m); await st.put("fila", f.slice(-5)); }
  async dispara(endpoint, urgencia = "high") {
    let r; try { r = await enviaPush(endpoint, this.env, urgencia); } catch (e) { return 0; }
    if (r.status === 404 || r.status === 410) { await this.state.storage.deleteAlarm(); await this.state.storage.deleteAll(); }
    return r.status;
  }
  async hist() { const st = this.state.storage, h = (await st.get("hist")) || { dia: "", n: 0, env: {}, ult: {} }; return h; }
  /** Agenda o próximo alarme: o que vier primeiro entre o fim do descanso e o próximo lembrete. */
  async reagenda() {
    const st = this.state.storage, agora = Date.now(), rest = await st.get("rest"), cfg = await st.get("cfg"), tz = (await st.get("tz")) || 0, h = await this.hist();
    let prox = rest ? rest.at : Infinity;
    if (cfg) for (const t of TIPOS) if (cfg[t].on) prox = Math.min(prox, proximo(agora, tz, t, cfg[t].h, h.env[t]));
    if (prox === Infinity) await st.deleteAlarm(); else await st.setAlarm(Math.max(prox, agora + 1000));
  }
  async alarm() {
    try {
      const st = this.state.storage, agora = Date.now(), endpoint = await st.get("endpoint"); if (!endpoint) return;
      const rest = await st.get("rest");
      if (rest && rest.at <= agora + 1500) {
        await st.delete("rest"); await this.empilha({ tipo: "descanso" }); await this.dispara(endpoint);
      }
      const cfg = await st.get("cfg"), tz = (await st.get("tz")) || 0, e = await st.get("estado"), L = local(agora, tz), h = await this.hist();
      if (h.dia !== L.dia) { h.dia = L.dia; h.n = 0; }
      if (cfg) {
        const ontem = local(agora - 86400000, tz).dia;
        for (const t of TIPOS) {
          const c = cfg[t]; if (!c.on || h.env[t] === L.dia) continue;
          const alvo = +c.h.slice(0, 2) * 60 + +c.h.slice(3);
          if (L.min < alvo || L.min >= alvo + JANELA_MIN) continue;
          h.env[t] = L.dia;                                            // marca antes: nunca manda 2x no mesmo dia
          if (motivoPular(t, e, L.dia, ontem, L.dow) || h.n >= MAX_DIA) continue;
          const m = monta(t, e, L.dow, Math.random, h.ult[t] ?? -1); if (!m) continue;
          h.n++; if (m.idx >= 0) h.ult[t] = m.idx;
          await this.empilha({ tipo: t, titulo: m.titulo, corpo: m.corpo, tag: m.tag });
          await this.dispara(endpoint, "normal");
          break;                                                        // no máximo um lembrete por disparo
        }
      }
      await st.put("hist", h);
    } catch (err) { /* sem relançar: o alarme não deve repetir e duplicar avisos */ }
    finally { try { await this.reagenda(); } catch (e) {} }
  }
}

// Lista de aparelhos (só hashes) para a "novidade". Processa em lotes por causa do limite de subrequests.
export class Registro {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(req) {
    const u = new URL(req.url), b = await req.json().catch(() => ({})), st = this.state.storage;
    const subs = (await st.get("subs")) || {};
    if (u.pathname === "/add") { if (b.hash) { subs[b.hash] = 1; await st.put("subs", subs); } return new Response("ok"); }
    if (u.pathname === "/del") { delete subs[b.hash]; await st.put("subs", subs); return new Response("ok"); }
    if (u.pathname === "/novidade") {
      if (b.ver && (await st.get("ultVer")) === b.ver) return new Response(JSON.stringify({ repetido: true }));
      await st.put("ultVer", b.ver || ""); await st.put("texto", b.texto || ""); await st.put("fila", Object.keys(subs));
      await st.setAlarm(Date.now() + 500);
      return new Response(JSON.stringify({ aparelhos: Object.keys(subs).length }));
    }
    return new Response("?", { status: 404 });
  }
  async alarm() {
    const st = this.state.storage, fila = (await st.get("fila")) || [], texto = await st.get("texto"), lote = fila.splice(0, 40);
    for (const hash of lote) {
      try { await this.env.DESCANSO.get(this.env.DESCANSO.idFromName(hash)).fetch("https://do/novidade", { method: "POST", body: JSON.stringify({ texto }) }); } catch (e) {}
    }
    await st.put("fila", fila); if (fila.length) await st.setAlarm(Date.now() + 2000);
  }
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
    const u = new URL(req.url);
    if (req.method !== "POST") return resp(req, 404, { erro: "rota" });
    if (u.pathname === "/novidade") {                      // chamado pelo GitHub Actions, não pelo navegador
      if (req.headers.get("x-admin") !== await tokenAdmin(env)) return resp(req, 403, { erro: "admin" });
      const b = await req.json().catch(() => ({}));
      return env.REGISTRO.get(env.REGISTRO.idFromName("global")).fetch("https://do/novidade", { method: "POST", body: JSON.stringify({ ver: String(b.ver || ""), texto: String(b.texto || "").slice(0, 160) }) });
    }
    if (!["/agenda", "/cancela", "/config", "/sair", "/proximo"].includes(u.pathname)) return resp(req, 404, { erro: "rota" });
    if (!ORIGENS.includes(req.headers.get("Origin"))) return resp(req, 403, { erro: "origem" });
    const b = await req.json().catch(() => null), sub = b && b.sub, ep = sub && sub.endpoint;
    let host = ""; try { const x = new URL(ep); if (x.protocol !== "https:") throw 0; host = x.hostname; } catch (e) { return resp(req, 400, { erro: "endpoint" }); }
    if (!PUSH_HOSTS.some(r => r.test(host))) return resp(req, 400, { erro: "servico de push nao permitido" });
    const id = await idDoEndpoint(env, ep), hash = b64u(await crypto.subtle.digest("SHA-256", txt(ep)));
    const seg = Math.min(1800, Math.max(5, Math.round(+b.seg || 0)));
    const r = await env.DESCANSO.get(id).fetch("https://do" + u.pathname, { method: "POST", body: JSON.stringify({ endpoint: ep, seg, cfg: b.cfg, estado: b.estado, tz: b.tz, hash }) });
    if (u.pathname === "/proximo") return new Response(await r.text(), { headers: cors(req, { "content-type": "application/json" }) });
    return resp(req, 200, { ok: true });
  }
};
